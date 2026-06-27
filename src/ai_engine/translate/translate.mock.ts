import type { ITranslateEngine, TranslateQuery, TranslateResponse } from './translate.interface';

export class MockTranslateEngine implements ITranslateEngine {
  async translate(query: TranslateQuery): Promise<TranslateResponse> {
    const normalizedText = normalizeText(query.text);

    return {
      translatedText: createCustomerReadyMockTranslation(normalizedText),
    };
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function createCustomerReadyMockTranslation(text: string): string {
  if (!text) return '';

  return text;
}
