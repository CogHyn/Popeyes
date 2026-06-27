import type { ISearchEngine, SearchQuery, SearchResponse } from '@/ai_engine/search/search.interface';
import type { ISummaryEngine, SummaryQuery, SummaryResponse } from '@/ai_engine/summary/summary.interface';
import type { ITranslateEngine, TranslateQuery, TranslateResponse } from '@/ai_engine/translate/translate.interface';

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:3001';
const BACKEND_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_BACKEND_BASE_URL || DEFAULT_BACKEND_BASE_URL);

interface ApiErrorPayload {
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

export class BackendApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

export class BackendAiEngine implements ISearchEngine, ISummaryEngine, ITranslateEngine {
  search(query: SearchQuery): Promise<SearchResponse> {
    return requestJson<SearchQuery, SearchResponse>('/api/search', query);
  }

  summarize(query: SummaryQuery): Promise<SummaryResponse> {
    return requestJson<SummaryQuery, SummaryResponse>('/api/summary', query);
  }

  translate(query: TranslateQuery): Promise<TranslateResponse> {
    return requestJson<TranslateQuery, TranslateResponse>('/api/translate', query);
  }
}

async function requestJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new BackendApiError(
      0,
      `Không kết nối được backend tại ${BACKEND_BASE_URL}. Kiểm tra server backend đang chạy.`,
      getErrorCode(error),
    );
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const apiError = payload as ApiErrorPayload | undefined;
    const message = typeof apiError?.error?.message === 'string'
      ? apiError.error.message
      : `Backend trả về HTTP ${response.status}`;
    const code = typeof apiError?.error?.code === 'string' ? apiError.error.code : undefined;

    throw new BackendApiError(response.status, message, code);
  }

  return payload as TResponse;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new BackendApiError(response.status, 'Backend trả về dữ liệu không phải JSON.');
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function getErrorCode(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}
