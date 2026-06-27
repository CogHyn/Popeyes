import { completeWithGroq } from '@/ai_engine/shared/groq';
import type { ITranslateEngine, TranslateQuery, TranslateResponse } from './translate.interface';

export class GroqTranslateEngine implements ITranslateEngine {
  async translate(query: TranslateQuery): Promise<TranslateResponse> {
    const sourceLanguage = query.sourceLanguage || 'auto-detect';
    const translatedText = await completeWithGroq(
      'You are a precise translation engine. Return only the translated text.',
      [
        `Source language: ${sourceLanguage}`,
        `Target language: ${query.targetLanguage}`,
        '',
        'Translate this text while preserving meaning, tone, formatting, proper nouns, and customer-message nuance:',
        query.text,
      ].join('\n'),
      500,
    );

    return { translatedText };
  }
}
