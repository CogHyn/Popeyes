export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class UpstreamError extends HttpError {
  constructor(provider: string, details?: unknown) {
    super(502, `${provider} request failed`, 'UPSTREAM_ERROR', details);
    this.name = 'UpstreamError';
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
