import { config, requireConfigValue } from '../config.js';
import type { SearchQuery, SearchResponse } from '../contracts.js';
import { getErrorMessage, UpstreamError } from '../errors.js';

interface TavilyResult {
  title?: unknown;
  url?: unknown;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return 'Unable to read upstream error body';
  }
}

export async function searchWithTavily(query: SearchQuery): Promise<SearchResponse> {
  const apiKey = requireConfigValue(config.tavilyApiKey, 'TAVILY_API_KEY');

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query.query,
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

    const payload = await response.json() as TavilyResponse;
    const results = Array.isArray(payload.results)
      ? payload.results.flatMap((result) => {
          const title = asNonEmptyString(result.title);
          const link = asNonEmptyString(result.url);

          return title && link ? [{ title, link }] : [];
        })
      : [];

    return { results };
  } catch (error) {
    throw new UpstreamError('Tavily', getErrorMessage(error));
  }
}
