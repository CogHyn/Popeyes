import type { ISearchEngine, SearchQuery, SearchResponse } from './search.interface';

export class MockSearchEngine implements ISearchEngine {
  async search(query: SearchQuery): Promise<SearchResponse> {
    const normalizedQuery = query.query.replace(/\s+/g, ' ').trim() || 'selected text';
    const encodedQuery = encodeURIComponent(normalizedQuery);

    return {
      results: [
        {
          title: `Mock result for "${truncate(normalizedQuery, 48)}"`,
          link: `https://example.com/search?q=${encodedQuery}`,
        },
        {
          title: 'Mock background context source',
          link: 'https://example.com/context',
        },
        {
          title: 'Mock related reading',
          link: 'https://example.com/related',
        },
      ],
    };
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
