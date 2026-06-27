# AI Inline Command Assistant

Chrome extension siêu nhẹ: bôi đen text bất kỳ trên web → popup nhỏ hiện ngay cạnh vùng chọn → AI gợi ý action (Translate / Summary) hoặc trả lời câu hỏi tự do → kết quả stream ngay trong popup. **Không cần mở tab ChatGPT.**

---

## 1. Sản phẩm làm gì

- User bôi đen text → không cần shortcut, popup tự hiện.
- Extension đoán intent (dịch hay tóm tắt) và recommend action.
- User có 2 lựa chọn:
  - **Chọn action** (Translate / Summary) bằng click, hotkey `1`/`2`, hoặc Enter.
  - **Gõ thẳng câu hỏi** → vào Search Mode → AI trả lời dựa trên selection + context trang + web search.
- Kết quả stream realtime; user đọc → Copy / Insert / đóng.

## 2. Product flow

```
User bôi đen text
  → debounce 350ms (xác nhận selection ổn định)
  → classify intent (rule-based, local)
  → popup hiện gần selection
  → ┌─ chọn Translate/Summary ──────────┐
    └─ hoặc gõ câu hỏi → Search Mode ───┘
  → AI stream kết quả trong popup
  → đọc / Copy / Insert / Esc đóng
```

## 3. Tech stack

| Layer | Công nghệ |
|---|---|
| Framework | [WXT](https://wxt.dev) `0.20` |
| UI | React `19` + TypeScript `6` |
| Extension | Chrome MV3 (manifest v3) |
| Popup isolation | Shadow DOM qua `createShadowRootUi` |
| LLM | Groq API — model `qwen/qwen3-32b` (stream + non-stream) |
| Web search | Tavily API |

Dependencies xem `package.json`. Cài: `npm install`.

## 4. Setup & Build

```bash
# 1. Cài deps
npm install

# 2. Tạo .env ở root (ĐÃ gitignore — không commit)
#    VITE_GROQ_API_KEY=gsk_...
#    VITE_TAVILY_API_KEY=tvly-...

# 3. Build production
npm run build          # → output: .output/chrome-mv3

# 4. Load unpacked
#    chrome://extensions → bật Developer mode
#    → Load unpacked → chọn folder .output/chrome-mv3
```

Scripts khác:
- `npm run dev` — dev server, hot-reload (WXT tự reload extension).
- `npm run compile` — `tsc --noEmit`, type-check không build.
- `npm run zip` — đóng gói để publish.

> ⚠️ API key đọc qua `import.meta.env.VITE_*` lúc build. **Đổi key → phải build lại.** Key bị inline vào `background.js` (bundle) — không an toàn cho extension public; với bản dev/cá nhân thì chấp nhận được. Muốn production an toàn: chuyển sang `chrome.storage.local` + UI nhập key.

## 5. Kiến trúc & file map

```
src/
├── entrypoints/
│   ├── selection-assist.content.tsx   Content script: mount React vào Shadow DOM (createShadowRootUi)
│   └── background.ts                  Service worker: classify intent + Groq stream + Tavily search
├── hooks/
│   ├── useSelectionDetection.ts       Detect selection (input/contentEditable/range) + debounce + tính vị trí
│   ├── useStreamingPort.ts            Quản lý port `ai-stream`, nhận chunk/done/error, copy/insert/back/reset
│   └── useKeyboardNavigation.ts       Capture keyboard, gõ query (search), swallow phím để không leak host page
├── components/
│   ├── SelectionPopupApp.tsx          Root: state machine + wiring tất cả hook/component
│   ├── ActionList.tsx                 Danh sách action + confidence badge + hotkey
│   ├── SearchQueryView.tsx            UI khi user đang gõ câu hỏi (search mode)
│   └── StreamView.tsx                 Hộp output stream + nút Stop/Insert/Copy/Back
├── utils/
│   └── selectionUtils.ts              getVisibleSelection, getSurroundingContext, calculatePopupPosition, replaceSelectedText
├── styles/popup.ts                    CSS popup (inline trong Shadow Root)
└── types/index.ts                     Action, VisibleSelection, PopupState, ACTIONS
```

## 6. Data flow / state machine

**`PopupState = 'list' | 'streaming' | 'completed'`** (trong `useStreamingPort`).

- Trong state `list`: phân biệt **action list** vs **search** bằng `query !== ''`.
  - `query === ''` → render `<ActionList>`
  - `query !== ''` → render `<SearchQueryView>`
- `streaming` / `completed` → render `<StreamView>`.

**Giao tiếp content ↔ background:**
- `CLASSIFY_INTENT` qua `chrome.runtime.sendMessage` (one-shot, non-stream).
- `ai-stream` qua `chrome.runtime.connect({ name: 'ai-stream' })` (long-lived port, stream chunk).

## 7. Tính năng & logic

### Intent classification (rule-based, local — không tốn API call)
Trong `background.ts`:
- Text chứa ký tự **tiếng Việt** (`VIETNAMESE_RE`) → **Summary**.
- Text dài **≥ `SUMMARY_LENGTH_THRESHOLD` (1000)** ký tự → **Summary**.
- Còn lại → **Translate**.

Action đứng đầu được gán confidence 0.92, còn lại 0.72.

### Search Mode
`buildPrompt('search', ...)` ghép: `selectedText` + `query` (user gõ) + `context` (đoạn văn quanh selection, lấy bởi `getSurroundingContext`) + **Tavily top-3** kết quả web → Groq stream trả lời tiếng Việt (3-5 câu).
- Tavily fail/lỗi → **degrade gracefully**: vẫn trả lời, chỉ không có web results.
- `max_completion_tokens`: 600 cho search, 300 cho translate/summary.

## 8. ⚠️ Cạm bẫy quan trọng (đã fix — ĐỪNG lặp lại)

| Vấn đề | Nguyên nhân & cách xử lý |
|---|---|
| **Popup hiện sai chỗ** | `:host` là `position: fixed` → toạ độ tính theo **viewport**. KHÔNG cộng `window.scrollX/scrollY` vào rect (rect từ `getBoundingClientRect()` đã viewport-relative). Xem `calculatePopupPosition`. |
| **Popup không hiện** | `selection.rect` zero-size (off-screen/collapsed) → guard `rect.width \|\| rect.height`, fallback `element.getBoundingClientRect()`, không có thì return sớm. |
| **Reload extension → popup chết** | KHÔNG auto `window.location.reload()` (gây loop / mất state). Thay bằng message "Extension was updated. Please refresh this page." |
| **Extension context invalidated** | Reload extension thì content script cũ thành stale → **phải reload cả tab web**. |
| **Port leak** | Disconnect port cũ TRƯỚC khi tạo port mới trong `executeAction` (`disconnectPort()`). |
| **API bị block** | Mọi external API (Groq, Tavily) PHẢI khai trong `wxt.config.ts` → `host_permissions`. Thiếu → MV3 service worker fetch bị chặn im lặng. |
| **Mất selection khi click popup** | `onMouseDown` → `preventDefault()` + `stopPropagation()` ở popup root. |
| **Phím leak sang host page** (Slack/Gmail) | Listener ở **capture phase** trên `window`; swallow ở keydown/keypress/keyup; chỉ **keydown** dispatch logic (tránh Enter fire nhiều lần). |
| **Popup hiện quá gắt** | Debounce **350ms** xác nhận selection ổn định trước khi classify + mở popup. |
| **Hotkey `1`/`2` nuốt mất khi đang gõ search** | Guard `['1','2'].includes(key) && !query` — chỉ là hotkey khi không ở search mode. |

## 9. Testing / Debug

Chạy Chrome với remote debugging (cho Chrome DevTools MCP, port 9222):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-test" \
  --load-extension="$(pwd)/.output/chrome-mv3"
```

**Debug checklist (theo thứ tự):**
1. `npm run build`
2. Reload extension trong `chrome://extensions`
3. **Reload tab web** (quan trọng — tránh stale content script)
4. Kiểm tra shadow host đã inject:
   ```js
   Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot)
   // phải thấy <selection-assist-ui>
   ```
5. Bôi đen text → check console page logs:
   - `[SELECTION_CAPTURED]` — đã detect
   - `[STREAM_START]` / `[STREAM_ERROR]` / `[STREAM_DONE]` — luồng stream
6. Background im → mở **service worker console** (`chrome://extensions` → Inspect views: service worker).

## 10. Config knobs

| Hằng số | File | Mặc định | Ý nghĩa |
|---|---|---|---|
| `SELECTION_CONFIRM_DELAY_MS` | `useSelectionDetection.ts` | 350 | Debounce xác nhận selection |
| `MIN_SELECTION_LENGTH` | `useSelectionDetection.ts` | 2 | Số ký tự tối thiểu để mở popup |
| `SUMMARY_LENGTH_THRESHOLD` | `background.ts` | 1000 | ≥ ngưỡng này → ưu tiên Summary |
| `VIETNAMESE_RE` | `background.ts` | — | Regex nhận diện tiếng Việt → Summary |
| `GROQ_MODEL` | `background.ts` | `qwen/qwen3-32b` | Model Groq |
| `max_completion_tokens` | `background.ts` | 300 / 600 | Giới hạn output (search = 600) |
| Tavily `max_results` | `background.ts` | 3 | Số kết quả web search |
| context truncate | `selectionUtils.ts` | 500 | Độ dài context quanh selection |
| popup width / height | `selectionUtils.ts` | 320 / 220 | Kích thước ước lượng để định vị |

## 11. Roadmap

- ✅ **Đã có:** Translate, Summary, Search Mode (Tavily + Groq), keyboard nav, insert/copy.
- ⬜ **Chưa làm:** history / home, pin kết quả, polish action, chọn ngôn ngữ đích, chọn model, đưa API key ra `chrome.storage` + settings UI.
