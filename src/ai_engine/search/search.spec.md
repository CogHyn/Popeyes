# Search Engine Spec

This spec mirrors `search_modules/SPEC.md` for the in-code search module.

## Current Contract

```ts
interface SearchQuery {
  query: string;
}

interface SearchResult {
  title: string;
  link: string;
}

interface SearchResponse {
  results: SearchResult[];
}

interface ISearchEngine {
  search(query: SearchQuery): Promise<SearchResponse>;
}
```

Current runtime uses `MockSearchEngine`.

## Target Direction

Search should support two levels:

- `quick`: fast popup answer, short Vietnamese response, small source set.
- `deep`: multi-step research with planning, source reading, synthesis, citations, and gap reporting.

The UI should continue talking to background through `StreamRequest`. Background should route to a search orchestrator that owns quick/deep logic.

## Proposed Interface Evolution

```ts
type SearchMode = 'quick' | 'deep';

interface SearchQuery {
  query: string;
  selectedText?: string;
  pageContext?: string;
  mode?: SearchMode;
  locale?: 'vi' | 'en';
  maxResults?: number;
  sourcePolicy?: 'none' | 'links' | 'citations';
}

interface SearchResult {
  title: string;
  link: string;
  snippet?: string;
  publishedAt?: string;
  sourceName?: string;
  score?: number;
}

interface SearchResponse {
  results: SearchResult[];
  answerText?: string;
  citations?: Array<{
    title: string;
    link: string;
    quote?: string;
  }>;
  confidence?: 'low' | 'medium' | 'high';
  missingInfo?: string[];
}
```

## Deep Research Workflow

```text
classify_research_need
  -> plan_queries
  -> web_search
  -> rank_sources
  -> read_sources
  -> extract_notes
  -> synthesize_answer
  -> verify_gaps
  -> final_answer
```

LangGraph TypeScript can own this workflow later. Keep it behind an engine/orchestrator interface so the popup does not depend on graph internals.

## Streaming Events

Background should map internal search/research events to popup `StreamMessage`.

Useful internal event types:

- `plan`
- `searching`
- `source`
- `reading`
- `partial`
- `final`
- `error`

## Non-Goals For Current UI Phase

- No full research report inside the tiny popup.
- No direct Tavily/Groq calls from UI components.
- No unbounded page-content scraping.

## Acceptance Criteria

- Quick Search remains fast and usable in popup.
- Deep Research can be added without rewriting UI components.
- Source links are real when citations are shown.
- Missing/uncertain evidence is explicitly represented.
