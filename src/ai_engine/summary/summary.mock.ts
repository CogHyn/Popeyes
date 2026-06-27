import type { ISummaryEngine, SummaryQuery, SummaryResponse } from './summary.interface';

export class MockSummaryEngine implements ISummaryEngine {
  async summarize(query: SummaryQuery): Promise<SummaryResponse> {
    const normalizedContent = normalizeText(query.content);
    const sentences = normalizedContent
      .split(/(?<=[.!?。！？])\s+/)
      .filter(Boolean)
      .slice(0, 2);
    const summary = sentences.join(' ') || normalizedContent.slice(0, 180);

    return {
      summaryText: [
        '[Mock Summary]',
        `- Ý chính: ${summary}${normalizedContent.length > summary.length ? '...' : ''}`,
        `- Độ dài gốc: ${normalizedContent.length} ký tự.`,
      ].join('\n'),
    };
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
