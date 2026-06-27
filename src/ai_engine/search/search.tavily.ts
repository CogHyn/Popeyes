import { config, requireConfigValue } from '@/ai_engine/shared/config';
import { getErrorMessage, UpstreamError } from '@/ai_engine/shared/errors';
import type { ISearchEngine, SearchQuery, SearchResponse } from './search.interface';

interface TavilyResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

const MAX_TAVILY_QUERY_LENGTH = 400;

export class TavilySearchEngine implements ISearchEngine {
  async search(query: SearchQuery): Promise<SearchResponse> {
    const apiKey = requireConfigValue(config.tavilyApiKey, 'VITE_TAVILY_API_KEY');
    const retrievalQuery = truncateForSearch(query.query);

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: retrievalQuery,
          search_depth: 'basic',
          max_results: 5,
          include_answer: false,
          include_raw_content: false,
          include_images: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await readErrorBody(response)}`);
      }

      const payload = (await response.json()) as TavilyResponse;
      const results = Array.isArray(payload.results)
        ? payload.results.flatMap((result) => {
            const title = asNonEmptyString(result.title);
            const link = asNonEmptyString(result.url);
            const snippet = asNonEmptyString(result.content);

            if (!title || !link) return [];
            return snippet ? [{ title, link, snippet }] : [{ title, link }];
          })
        : [];

      return { results };
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      throw new UpstreamError('Tavily', getErrorMessage(error));
    }
  }
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function truncateForSearch(value: string): string {
  const normalized = normalizeForSearch(value);

  return normalized.length > MAX_TAVILY_QUERY_LENGTH
    ? normalized.slice(0, MAX_TAVILY_QUERY_LENGTH).trim()
    : normalized;
}

function normalizeForSearch(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return 'Unable to read upstream error body';
  }
}
