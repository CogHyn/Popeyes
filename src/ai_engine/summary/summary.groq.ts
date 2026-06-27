import { completeWithGroq } from '@/ai_engine/shared/groq';
import type { ISummaryEngine, SummaryQuery, SummaryResponse } from './summary.interface';

export class GroqSummaryEngine implements ISummaryEngine {
  async summarize(query: SummaryQuery): Promise<SummaryResponse> {
    const summaryText = await completeWithGroq(
      'You summarize text for Vietnamese users. Return only the summary, without prefacing or explaining your answer.',
      `Summarize the following content in Vietnamese, preserving the key ideas and important details:\n\n${query.content}`,
      500,
    );

    return { summaryText };
  }
}
