# Search Module Spec

Search module là lớp AI engine chịu trách nhiệm trả lời câu hỏi dựa trên:

- query user gõ trong popup
- selected text
- surrounding page context
- web search results
- optional multi-step research workflow

Mục tiêu ngắn hạn là phục vụ Search Mode trong popup. Mục tiêu dài hạn là mở rộng thành Deep Research mà không phải viết lại UI.

## 1. Product Goals

### Quick Search

Quick Search dùng cho popup inline, cần trả lời nhanh, ngắn, ít ma sát.

- Latency mục tiêu: thấp, ưu tiên first-token nhanh.
- Output: 3-5 câu tiếng Việt.
- Sources: có thể dùng top 3 web results.
- UI surface: popup nhỏ, không phù hợp report dài.
- Failure mode: Tavily/web fail thì vẫn trả lời dựa trên selected text + context nếu đủ.

### Deep Research

Deep Research dùng khi câu hỏi cần nhiều bước phân tích hoặc nguồn.

- Latency mục tiêu: chấp nhận lâu hơn Quick Search.
- Output: structured answer/report, có citation/source list.
- Workflow: plan -> search -> read/summarize sources -> synthesize -> verify gaps -> final.
- UI surface tương lai: popup có thể hiển thị progress ngắn, còn full report nên mở ở panel/history view.
- Failure mode: trả về partial report + missing gaps thay vì im lặng.

## 2. Modes

```ts
type SearchMode = 'quick' | 'deep';
```

Default mode trong popup hiện tại là `quick`.

Gợi ý chọn mode:

- `quick`: query ngắn, cần câu trả lời tức thì, user đang thao tác inline.
- `deep`: query có dấu hiệu "research", "so sánh", "phân tích", "nguồn", "tổng hợp", hoặc user chọn explicit Deep Research.

## 3. Inputs

Search input nên mở rộng từ interface hiện tại:

```ts
interface SearchQuery {
  query: string;
  selectedText?: string;
  pageContext?: string;
  mode?: SearchMode;
  locale?: 'vi' | 'en';
  maxResults?: number;
  sourcePolicy?: 'none' | 'links' | 'citations';
}
```

Trong extension hiện tại:

- `query`: user gõ trong popup
- `selectedText`: selection từ content script
- `pageContext`: surrounding context từ `selectionUtils.ts`
- `mode`: default `quick`
- `locale`: default `vi`

## 4. Outputs

Search output cần tách result thô, answer hiển thị và metadata:

```ts
interface SearchResult {
  title: string;
  link: string;
  snippet?: string;
  publishedAt?: string;
  sourceName?: string;
  score?: number;
}

interface SearchAnswer {
  answerText: string;
  results: SearchResult[];
  citations?: Array<{
    title: string;
    link: string;
    quote?: string;
  }>;
  mode: SearchMode;
  confidence?: 'low' | 'medium' | 'high';
  missingInfo?: string[];
}
```

Popup hiện tại có thể chỉ stream `answerText`. Deep Research UI tương lai nên dùng `citations`, `missingInfo`, progress events.

## 5. Engine Contract

Interface hiện tại:

```ts
interface ISearchEngine {
  search(query: SearchQuery): Promise<SearchResponse>;
}
```

Nên tiến hóa thành:

```ts
interface ISearchEngine {
  search(query: SearchQuery): Promise<SearchResponse>;
}

interface IResearchEngine extends ISearchEngine {
  research(query: SearchQuery, events?: ResearchEventSink): Promise<SearchAnswer>;
}
```

Giữ `search()` để Quick Search không bị phức tạp. Thêm `research()` cho workflow nhiều bước.

## 6. Events For Streaming

Deep Research cần progress events thay vì chỉ final answer.

```ts
type ResearchEvent =
  | { type: 'plan'; steps: string[] }
  | { type: 'searching'; query: string }
  | { type: 'source'; result: SearchResult }
  | { type: 'reading'; link: string }
  | { type: 'partial'; text: string }
  | { type: 'final'; answer: SearchAnswer }
  | { type: 'error'; message: string };

type ResearchEventSink = (event: ResearchEvent) => void;
```

Trong Chrome extension, background sẽ map events sang `StreamMessage` để UI không phụ thuộc vào implementation cụ thể.

## 7. Architecture

```text
SelectionPopupApp
  -> StreamRequest(mode: 'search', query, selectedText, context)
  -> background.ts
  -> SearchOrchestrator
      -> SearchEngine adapter
      -> optional Reader/Summarizer
      -> optional ResearchGraph
  -> StreamMessage chunks/progress
  -> StreamView
```

Boundary:

- UI không gọi Tavily/Groq/LangGraph trực tiếp.
- Background là bridge giữa UI port và AI engine.
- Search module không biết DOM/selection; nó chỉ nhận structured input.

## 8. Deep Research Workflow

Recommended graph:

```text
START
  -> classify_research_need
  -> plan_queries
  -> web_search
  -> rank_sources
  -> read_sources
  -> extract_notes
  -> synthesize_answer
  -> verify_gaps
  -> final_answer
END
```

Conditional edges:

- If query is simple -> skip to Quick Search answer.
- If search returns weak results -> reformulate query.
- If sources disagree -> mark confidence lower and explain uncertainty.
- If max depth reached -> return partial with missing gaps.

LangGraph TypeScript là ứng viên tốt cho workflow này vì graph state rõ và dễ stream progress.

## 9. State Shape For LangGraph

```ts
interface ResearchState {
  query: string;
  selectedText?: string;
  pageContext?: string;
  plan: string[];
  searchQueries: string[];
  results: SearchResult[];
  notes: Array<{
    source: SearchResult;
    summary: string;
    useful: boolean;
  }>;
  answer?: SearchAnswer;
  errors: string[];
}
```

## 10. Quality Rules

- Không bịa nguồn.
- Nếu không có nguồn thật, nói rõ "chưa có nguồn web".
- Với source citations, title/link phải đến từ search/read layer.
- Ưu tiên câu trả lời tiếng Việt, ngắn và trực tiếp trong popup.
- Deep Research có thể dài hơn nhưng vẫn phải có summary đầu.
- Không gửi page context quá dài; truncate và redact nếu cần.

## 11. Privacy / Safety

- Search input có thể chứa nội dung nhạy cảm từ selected text.
- Không log raw selected text trong production.
- Không tự động gửi toàn bộ page content.
- Chỉ gửi selected text + context đã truncate.
- Nếu query trông như secret/API key/password, nên cảnh báo hoặc bỏ web search.

## 12. Implementation Phases

### Phase 1: Current Mock Search

- Keep `MockSearchEngine`.
- Extend mock response with snippets and realistic shape.
- Keep popup answer short.

### Phase 2: Quick Web Search Adapter

- Add Tavily adapter implementing `ISearchEngine`.
- Return `SearchResult[]` with title/link/snippet.
- Background synthesizes short answer via LLM adapter.

### Phase 3: Search Orchestrator

- Add `SearchOrchestrator` that decides quick vs deep.
- Keep UI contract unchanged.
- Add progress event mapping.

### Phase 4: Deep Research

- Add `IResearchEngine`.
- Use LangGraph TypeScript or equivalent graph runner.
- Add source reading, note extraction, synthesis, gap verification.

### Phase 5: UX Expansion

- Popup shows compact progress.
- Add history/pinned report view for deep research output.
- Add "Open full research" action outside tiny popup.

## 13. Acceptance Criteria

- Quick Search still works inside current popup without layout changes.
- Search module can be tested with mock engines.
- UI/background bridge does not change when swapping mock -> real adapter.
- Deep Research can stream progress without blocking popup controls.
- Final research answer includes source links and uncertainty when needed.
