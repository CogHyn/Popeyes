import type { ITranslateEngine, TranslateQuery, TranslateResponse } from './translate.interface';

export class MockTranslateEngine implements ITranslateEngine {
  async translate(query: TranslateQuery): Promise<TranslateResponse> {
    const sourceLanguage = query.sourceLanguage ?? 'auto';
    const targetLanguage = query.targetLanguage || 'vi';
    const normalizedText = normalizeText(query.text);

    return {
      translatedText: [
        `[Mock Translate: ${sourceLanguage} -> ${targetLanguage}]`,
        `Bản dịch tiếng Việt nháp: ${normalizedText}`,
      ].join('\n'),
    };
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
