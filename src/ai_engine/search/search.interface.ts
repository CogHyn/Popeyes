export interface SearchQuery {
  query: string;
  selectedText?: string;
  context?: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet?: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface ISearchEngine {
  search(query: SearchQuery): Promise<SearchResponse>;
}
