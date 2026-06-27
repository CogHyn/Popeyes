# Search Feature

Search Mode answers a user's popup query using the selected text, surrounding page context, and optional web results.

Current implementation is mock-only via `MockSearchEngine`. The contract is intentionally small so the UI can be tested before a real web-search/LLM adapter exists.

## Current Interface

- `SearchQuery`: contains `query`.
- `SearchResult`: contains `title` and `link`.
- `SearchResponse`: contains `results`.
- `ISearchEngine.search(query)`: returns a `Promise<SearchResponse>`.

## Expansion Direction

Search should grow in two modes:

- `quick`: short, low-latency popup answer.
- `deep`: multi-step research with planning, source reading, synthesis, citations, and uncertainty/gap reporting.

Detailed spec:

- `search_modules/SPEC.md`
- `src/ai_engine/search/search.spec.md`
