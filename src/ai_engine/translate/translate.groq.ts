import { completeWithGroq, type GroqCompletionOptions } from '@/ai_engine/shared/groq';
import type { ITranslateEngine, TranslateQuery, TranslateResponse } from './translate.interface';

interface GroqTranslateEngineOptions extends GroqCompletionOptions {
  translatePrompt?: string;
}

const DEFAULT_TRANSLATE_PROMPT = 'You are a precise translation engine. Return only the translated text.';

export class GroqTranslateEngine implements ITranslateEngine {
  constructor(private readonly options: GroqTranslateEngineOptions = {}) {}

  async translate(query: TranslateQuery): Promise<TranslateResponse> {
    const sourceLanguage = query.sourceLanguage || 'auto-detect';
    const translatedText = await completeWithGroq(
      this.options.translatePrompt?.trim() || DEFAULT_TRANSLATE_PROMPT,
      [
        `Source language: ${sourceLanguage}`,
        `Target language: ${query.targetLanguage}`,
        '',
        'Translate this text while preserving meaning, tone, formatting, proper nouns, and customer-message nuance:',
        query.text,
      ].join('\n'),
      500,
      this.options,
    );

    return { translatedText };
  }
}
