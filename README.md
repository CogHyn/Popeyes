# AI Inline Command Assistant

Chrome extension thử nghiệm cho workflow: bôi đen text trên web, mở popup inline cạnh selection, chọn Translate/Summary hoặc gõ câu hỏi, rồi stream kết quả ngay trong popup.

Hiện dự án đang ở giai đoạn **UI + real API adapters cơ bản**. Background gọi Groq cho Translate/Summary và Tavily cho Search thông qua các interface trong `src/ai_engine`. Mock engines vẫn được giữ lại để test/dev.

## 1. Sản phẩm hiện làm gì

- User bôi đen text trên trang web.
- Popup tự hiện sau selection ổn định khoảng `500ms`, hoặc mở ngay bằng context menu chuột phải `Open AI Assistant`.
- Popup luôn ưu tiên đặt ở phía bên phải dưới selection và clamp vào viewport khi sát mép màn hình.
- Extension classify intent local:
  - text tiếng Việt hoặc text dài `>= 1000` ký tự -> ưu tiên Summary
  - còn lại -> ưu tiên Translate
- Trong action list:
  - `1`/`2` hoặc click option chỉ đổi option đang chọn
  - `Enter` mới execute option đang active
- User có thể gõ câu hỏi để vào Search Mode dạng chat one-shot.
- Kết quả stream qua long-lived runtime port.
- User có thể Copy, Insert, Back, Stop hoặc đóng popup bằng `Esc`.

## 2. Product flow hiện tại

```text
User bôi đen text
  -> debounce 500ms hoặc chọn context menu
  -> classify intent rule-based
  -> popup hiện bên phải dưới selection
  -> chọn Translate/Summary bằng click hoặc hotkey
  -> Enter để execute
  -> background gọi Groq/Tavily adapter qua AI engine interface
  -> stream kết quả về popup
  -> Copy / Insert cho Translate-Summary hoặc Copy chat answer / Back / Stop / Esc
```

## 3. Tech stack

| Layer | Công nghệ |
|---|---|
| Framework | WXT `0.20` |
| Language | TypeScript |
| Extension | Chrome MV3 |
| UI runtime | DOM components tự viết, không dùng React hiện tại |
| Popup isolation | Shadow DOM custom host `<selection-assist-ui>` |
| AI runtime hiện tại | Groq adapters + Tavily adapter qua feature interfaces |
| Context menu | `chrome.contextMenus` qua WXT/browser API |

Dependencies xem `src/package.json`.

## 4. Setup & Build

Chạy lệnh trong thư mục `src/`:

```bash
cd src
npm install
npm run compile
npm run build
```

Tạo `.env` ở root repo trước khi build. `src/wxt.config.ts` đã cấu hình Vite `envDir: '..'` để WXT load file này khi chạy trong thư mục `src/`.

```bash
VITE_GROQ_API_KEY=gsk_...
VITE_TAVILY_API_KEY=tvly-...
VITE_GROQ_MODEL=qwen/qwen3-32b
```

Các biến `VITE_*` được inline vào bundle lúc build. Đây ổn cho bản dev/cá nhân, nhưng chưa an toàn cho extension public. Production nên chuyển sang `chrome.storage.local` + settings UI.

Output production:

```text
src/.output/chrome-mv3
```

Load unpacked:

```text
chrome://extensions
-> bật Developer mode
-> Load unpacked
-> chọn src/.output/chrome-mv3
```

Scripts:

- `npm run dev` - WXT dev server
- `npm run compile` - `tsc --noEmit`
- `npm run build` - build Chrome MV3
- `npm run zip` - package extension

## 5. Kiến trúc file hiện tại

```text
src/
├── entrypoints/
│   ├── content.ts                    Mount Shadow DOM, detect selection, keyboard capture, context-menu open
│   ├── background.ts                 Service worker: context menu, classify intent, stream AI adapter result
│   └── popup/                        Browser action popup starter UI
├── components/
│   ├── SelectionPopupApp.ts          Root UI state machine + runtime port bridge
│   ├── ActionList.ts                 Option list, hotkey index, selected state
│   ├── ChatView.ts                   One-shot chat transcript for typed search questions
│   ├── SearchQueryView.ts            Search/question input view
│   ├── StreamView.ts                 Streaming/completed/error output view
│   └── dom.ts                        Small DOM element/button helpers
├── ai_engine/
│   ├── translate/
│   │   ├── translate.interface.ts
│   │   ├── translate.groq.ts
│   │   └── translate.mock.ts
│   ├── summary/
│   │   ├── summary.interface.ts
│   │   ├── summary.groq.ts
│   │   └── summary.mock.ts
│   └── search/
│       ├── search.interface.ts
│       ├── search.tavily.ts
│       └── search.mock.ts
├── ai_engine/shared/
│   ├── config.ts                     Build-time env config
│   ├── errors.ts                     Shared upstream error helpers
│   └── groq.ts                       Groq chat completion fetch helper
├── styles/
│   └── popup.ts                      CSS injected into Shadow DOM
├── utils/
│   └── selectionUtils.ts             Selection, position, copy, replace utilities
├── types/
│   └── index.ts                      Shared action/stream/selection types
└── wxt.config.ts                     Manifest config, currently contextMenus permission
```

## 6. UI state & bridge

Popup state:

```ts
type PopupState = 'list' | 'streaming' | 'completed' | 'error';
```

Bridge path:

```text
SelectionPopupApp
  -> browser.runtime.connect({ name: 'ai-stream' })
  -> StreamRequest
  -> background.ts
  -> GroqTranslateEngine / GroqSummaryEngine / TavilySearchEngine
  -> StreamMessage chunks
  -> StreamView for Translate/Summary, ChatView for typed Search questions
```

Stream messages:

- `chunk` - append display output
- `replacement` - clean text used by Insert, currently important for Translate
- `done` - mark completed
- `error` - show failure

## 7. AI engine interfaces

Feature contracts live under `src/ai_engine/[feature]`.

- `ITranslateEngine.translate(query): Promise<TranslateResponse>`
- `ISummaryEngine.summarize(query): Promise<SummaryResponse>`
- `ISearchEngine.search(query): Promise<SearchResponse>`

Runtime currently uses real adapters:

- `GroqTranslateEngine`
- `GroqSummaryEngine`
- `TavilySearchEngine`

Mock implementations are still available:

- `MockTranslateEngine`
- `MockSummaryEngine`
- `MockSearchEngine`

This keeps UI testable when API keys are not available or while developing adapter behavior.

## 8. UX rules currently implemented

- Popup debounce: `SELECTION_CONFIRM_DELAY_MS = 500`.
- Minimum selection length: `MIN_SELECTION_LENGTH = 2`.
- Position is viewport-relative from `getBoundingClientRect()`.
- Do not add `window.scrollX/scrollY` when host is `position: fixed`.
- Popup root prevents mousedown default/propagation to avoid losing selection.
- Keyboard listener runs in capture phase while popup is active.
- Click outside closes popup.
- Action `1`/`2` selects only; `Enter` executes.
- Typed search query uses one-shot chat UI: user bubble plus assistant streaming bubble.
- Translate Insert prefers `replacementText` instead of display/debug text.

## 9. Known issues / notes

UI issue notes are tracked in `notes/`:

- `notes/UI_VERSION_1.md` - popup timing, hotkey index, mock interface integration.
- `notes/UI_VERSION_2.md` - select-before-enter UX, clean translate replacement text.
- `notes/UI_VERSION_3.md` - Messenger/contentEditable insert loses content after replacement.

Important current limitation:

- Insert into `textarea`/`input` is supported.
- Insert into complex `contentEditable` editors such as Messenger may be unstable because direct DOM mutation can be reverted by React/editor state. See `notes/UI_VERSION_3.md`.

## 10. Testing / Debug

Basic checks:

```bash
cd src
npm run compile
npm run build
```

Chrome manual test:

1. Build extension.
2. Reload extension in `chrome://extensions`.
3. Reload the tested web tab to avoid stale content scripts.
4. Select text on an HTTP/HTTPS page.
5. Wait `500ms` or use right-click context menu `Open AI Assistant`.
6. Verify:
   - popup appears beside lower-right of selection
   - `1`/`2` only changes selected option
   - `Enter` executes selected option
   - typed query shows user bubble and streaming assistant bubble
   - Copy/Insert/Back/Stop/Esc work

Optional Chrome launch:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-test" \
  --load-extension="$(pwd)/src/.output/chrome-mv3"
```

## 11. Config knobs

| Constant | File | Current | Meaning |
|---|---|---:|---|
| `SELECTION_CONFIRM_DELAY_MS` | `src/utils/selectionUtils.ts` | `500` | Delay before auto-opening popup after selection |
| `MIN_SELECTION_LENGTH` | `src/utils/selectionUtils.ts` | `2` | Minimum selected chars |
| `SUMMARY_LENGTH_THRESHOLD` | `src/entrypoints/background.ts` / `SelectionPopupApp.ts` | `1000` | Long text prefers Summary |
| `POPUP_WIDTH` | `src/utils/selectionUtils.ts` | `340` | Estimated popup width for viewport clamp |
| `POPUP_HEIGHT` | `src/utils/selectionUtils.ts` | `320` | Estimated popup height for viewport clamp |
| `POPUP_GAP` | `src/utils/selectionUtils.ts` | `10` | Gap from selection rect |
| `VIEWPORT_MARGIN` | `src/utils/selectionUtils.ts` | `12` | Minimum viewport margin |

## 12. Roadmap

- Fix robust Insert for Messenger/contentEditable editors.
- Add settings UI for API keys instead of build-time `.env`.
- Improve browser action popup or remove starter UI if not needed.
- Add automated tests for selection positioning and replacement behavior.
