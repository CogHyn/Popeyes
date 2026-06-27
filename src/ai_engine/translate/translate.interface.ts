export interface TranslateQuery {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
}

export interface TranslateResponse {
  translatedText: string;
}

export interface ITranslateEngine {
  translate(query: TranslateQuery): Promise<TranslateResponse>;
}
