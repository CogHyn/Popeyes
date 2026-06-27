export class UpstreamError extends Error {
  constructor(
    readonly upstream: string,
    message: string,
  ) {
    super(`${upstream}: ${message}`);
    this.name = 'UpstreamError';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  return 'Unknown error';
}
