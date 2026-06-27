import type { ISearchEngine, SearchQuery, SearchResponse } from '@/ai_engine/search/search.interface';
import type { ISummaryEngine, SummaryQuery, SummaryResponse } from '@/ai_engine/summary/summary.interface';
import type { ITranslateEngine, TranslateQuery, TranslateResponse } from '@/ai_engine/translate/translate.interface';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const DEFAULT_GROQ_MODEL = 'qwen/qwen3-32b';

interface GroqCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

interface TavilyResult {
  title?: unknown;
  url?: unknown;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

interface ApiErrorPayload {
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

export class ProviderApiError extends Error {
  constructor(
    public readonly provider: string,
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ProviderApiError';
  }
}

export class ProviderAiEngine implements ISearchEngine, ISummaryEngine, ITranslateEngine {
  search(query: SearchQuery): Promise<SearchResponse> {
    return searchWithTavily(query);
  }

  summarize(query: SummaryQuery): Promise<SummaryResponse> {
    return summarizeWithGroq(query);
  }

  translate(query: TranslateQuery): Promise<TranslateResponse> {
    return translateWithGroq(query);
  }
}

async function summarizeWithGroq(query: SummaryQuery): Promise<SummaryResponse> {
  const summaryText = await completeWithGroq(
    'You summarize text for Vietnamese users. Return only the summary, without prefacing or explaining your answer.',
    `Summarize the following content in Vietnamese, preserving the key ideas and important details:\n\n${query.content}`,
    500,
  );

  return { summaryText };
}

async function translateWithGroq(query: TranslateQuery): Promise<TranslateResponse> {
  const sourceLanguage = query.sourceLanguage || 'auto-detect';
  const translatedText = await completeWithGroq(
    'You are a precise translation engine. Return only the translated text.',
    [
      `Source language: ${sourceLanguage}`,
      `Target language: ${query.targetLanguage}`,
      '',
      'Translate this text while preserving meaning, tone, formatting, and proper nouns:',
      query.text,
    ].join('\n'),
    500,
  );

  return { translatedText };
}

async function completeWithGroq(
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens: number,
): Promise<string> {
  const apiKey = requireEnvValue(import.meta.env.VITE_GROQ_API_KEY, 'VITE_GROQ_API_KEY');
  const model = import.meta.env.VITE_GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const payload = await requestProviderJson<GroqCompletionResponse>('Groq', GROQ_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      reasoning_effort: 'none',
      max_completion_tokens: maxCompletionTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new ProviderApiError('Groq', 502, 'Groq trả về phản hồi rỗng.');
  }

  return content.trim();
}

async function searchWithTavily(query: SearchQuery): Promise<SearchResponse> {
  const apiKey = requireEnvValue(import.meta.env.VITE_TAVILY_API_KEY, 'VITE_TAVILY_API_KEY');
  const payload = await requestProviderJson<TavilyResponse>('Tavily', TAVILY_SEARCH_URL, {
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

  const results = Array.isArray(payload.results)
    ? payload.results.flatMap((result) => {
        const title = asNonEmptyString(result.title);
        const link = asNonEmptyString(result.url);

        return title && link ? [{ title, link }] : [];
      })
    : [];

  return { results };
}

async function requestProviderJson<TResponse>(
  provider: string,
  url: string,
  init: RequestInit,
): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new ProviderApiError(
      provider,
      0,
      `Không kết nối được ${provider}. Kiểm tra mạng hoặc quyền truy cập API.`,
      getErrorCode(error),
    );
  }

  const payload = await readJson(response, provider);

  if (!response.ok) {
    const apiError = payload as ApiErrorPayload | undefined;
    const message = typeof apiError?.error?.message === 'string'
      ? apiError.error.message
      : `${provider} trả về HTTP ${response.status}`;
    const code = typeof apiError?.error?.code === 'string' ? apiError.error.code : undefined;

    throw new ProviderApiError(provider, response.status, message, code);
  }

  return payload as TResponse;
}

async function readJson(response: Response, provider: string): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderApiError(provider, response.status, `${provider} trả về dữ liệu không phải JSON.`);
  }
}

function requireEnvValue(value: string | undefined, key: string): string {
  if (!value?.trim()) {
    throw new ProviderApiError('Config', 500, `Thiếu cấu hình ${key}. Rebuild extension sau khi thêm key.`);
  }

  return value;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getErrorCode(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}
