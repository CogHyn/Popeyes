export interface SearchQuery {
  query: string;
}

export interface SearchResult {
  title: string;
  link: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface SummaryQuery {
  content: string;
}

export interface SummaryResponse {
  summaryText: string;
}

export interface TranslateQuery {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
}

export interface TranslateResponse {
  translatedText: string;
}
