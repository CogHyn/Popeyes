import { completeWithGroq, type GroqCompletionOptions } from '@/ai_engine/shared/groq';
import type { AnswerStyle, SummaryLength } from '@/dashboard/settings';
import type { ISummaryEngine, SummaryQuery, SummaryResponse } from './summary.interface';

interface GroqSummaryEngineOptions extends GroqCompletionOptions {
  summaryPrompt?: string;
  summaryLength?: SummaryLength;
  answerStyle?: AnswerStyle;
}

const DEFAULT_SUMMARY_PROMPT = [
  'You summarize text for Vietnamese users.',
  'Return only the summary, without prefacing or explaining your answer.',
].join(' ');

export class GroqSummaryEngine implements ISummaryEngine {
  constructor(private readonly options: GroqSummaryEngineOptions = {}) {}

  async summarize(query: SummaryQuery): Promise<SummaryResponse> {
    const summaryText = await completeWithGroq(
      this.options.summaryPrompt?.trim() || DEFAULT_SUMMARY_PROMPT,
      [
        `Summary length: ${describeSummaryLength(this.options.summaryLength)}`,
        `Answer style: ${describeAnswerStyle(this.options.answerStyle)}`,
        '',
        'Summarize the following content in Vietnamese, preserving the key ideas and important details:',
        query.content,
      ].join('\n'),
      getSummaryTokenBudget(this.options.summaryLength),
      this.options,
    );

    return { summaryText };
  }
}

function describeSummaryLength(length: SummaryLength = 'medium'): string {
  if (length === 'short') return 'short, 2-4 concise bullet points or sentences';
  if (length === 'detailed') return 'detailed, include nuance and important supporting details';
  return 'medium, enough detail to understand the main ideas quickly';
}

function describeAnswerStyle(style: AnswerStyle = 'concise'): string {
  if (style === 'bullet_points') return 'bullet points';
  if (style === 'detailed') return 'detailed but organized';
  return 'concise and direct';
}

function getSummaryTokenBudget(length: SummaryLength = 'medium'): number {
  if (length === 'short') return 280;
  if (length === 'detailed') return 800;
  return 500;
}
