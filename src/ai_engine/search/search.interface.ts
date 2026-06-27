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

export interface ISearchEngine {
  search(query: SearchQuery): Promise<SearchResponse>;
}