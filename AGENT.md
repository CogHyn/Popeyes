# AGENT.md

Hướng dẫn cho mọi AI/coding agent khi làm việc trong repo này. Đọc file này trước, sau đó đối chiếu với `README.md` và code hiện tại trước khi sửa.

## Product North Star

Đây là Chrome extension **AI Inline Command Assistant**:

- User bôi đen text trên web, popup nhỏ hiện ngay cạnh vùng chọn sau debounce.
- Popup gợi ý action nhanh: **Translate** hoặc **Summary**.
- User có thể gõ câu hỏi tự do để vào **Search Mode**; AI trả lời dựa trên selection, context trang và web search.
- Kết quả phải stream realtime trong popup; user có thể **Copy**, **Insert**, **Back**, **Stop**, hoặc đóng bằng `Esc`.
- Trải nghiệm chính là inline, nhanh, ít ma sát: không bắt user mở tab ChatGPT, không ép flow dài.

Repo hiện tại có thể chưa khớp hoàn toàn với kiến trúc trong `README.md`. Luôn kiểm tra file thật trước khi giả định module đã tồn tại.

## Tech Context

- Framework: WXT `0.20`
- Language: TypeScript
- Extension target: Chrome MV3
- UI target: React + Shadow DOM theo spec trong `README.md`; nếu code hiện tại còn starter, nâng cấp dần theo spec thay vì vá chắp nối.
- AI features hiện có interface trong `src/ai_engine/*`:
  - `translate`
  - `summary`
  - `search`
- Build và type-check chạy trong thư mục `src/`.

Các lệnh thường dùng:

```bash
cd src
npm install
npm run compile
npm run build
npm run dev
```

Không commit `.env`, `.output`, `.wxt`, `node_modules`, hoặc API keys.

## Source Of Truth

Ưu tiên theo thứ tự:

1. Yêu cầu mới nhất của user.
2. `README.md` cho product behavior, UX flow, cạm bẫy kỹ thuật và roadmap.
3. Code hiện tại cho API, naming, cấu trúc thật và ràng buộc build.
4. Feature docs trong `src/ai_engine/**.feature.md`.

Nếu `README.md` và code lệch nhau, ghi nhận lệch đó trong quá trình làm và sửa theo hướng đưa code gần spec hơn, trừ khi user yêu cầu khác.

## Architecture Rules

- Content script chịu trách nhiệm selection detection, popup positioning, keyboard capture và mount UI trong Shadow DOM.
- Background/service worker chịu trách nhiệm classify intent, gọi Groq, gọi Tavily và stream kết quả qua long-lived port.
- UI không gọi thẳng API key-sensitive service nếu việc đó có thể đặt trong background.
- Tách rõ:
  - selection utilities
  - streaming/port lifecycle
  - keyboard behavior
  - presentational components
  - AI engine interfaces/adapters
- Khi tạo port stream mới, disconnect port cũ trước.
- Mọi external API cần có `host_permissions` trong `src/wxt.config.ts`.
- Không dùng reload tự động của page để chữa stale context. Khi extension reload, content script cũ phải được xử lý bằng message rõ ràng hoặc user reload tab.

## UX Principles

Trải nghiệm phải cảm giác như một công cụ inline chuyên nghiệp, không phải một popup extension thô.

- **Nhanh:** selection debounce khoảng 350ms; popup không hiện khi selection collapsed, quá ngắn hoặc vị trí không xác định.
- **Ít ma sát:** action đầu tiên có thể chạy bằng `Enter`; `1`/`2` chọn Translate/Summary khi chưa gõ query.
- **Không làm hỏng trang host:** swallow keyboard event ở capture phase khi popup đang active; ngăn phím leak vào Slack/Gmail/editor.
- **Giữ selection:** popup root dùng `onMouseDown` với `preventDefault()` và `stopPropagation()` để click không làm mất vùng chọn.
- **Định vị thông minh:** tính tọa độ theo viewport từ `getBoundingClientRect()`; không cộng `window.scrollX/scrollY` khi host là `position: fixed`.
- **Không che nội dung vô lý:** popup phải clamp trong viewport, ưu tiên gần selection, có fallback khi rect zero-size.
- **Streaming rõ trạng thái:** có loading/streaming/completed/error state; partial output phải đọc được ngay.
- **Error tử tế:** API/search fail thì degrade gracefully, thông báo ngắn và vẫn trả lời nếu còn dữ liệu.
- **Control rõ ràng:** Copy, Insert, Back, Stop và Close phải có affordance dễ nhận biết.
- **Không nhảy layout:** popup width/height ổn định; text wrap đẹp; không để button hoặc output làm resize giật.
- **Accessible enough:** focus state rõ, phím `Esc` đóng, button có label/title phù hợp, contrast tốt.
- **Tone tiếng Việt:** kết quả mặc định bằng tiếng Việt, ngắn gọn, hữu ích; Search Mode ưu tiên 3-5 câu trừ khi user hỏi sâu.

## UI Design Guidance

- Popup là một công cụ nhỏ, không phải landing page.
- Ưu tiên density vừa phải: nội dung scan nhanh, action nổi rõ, ít trang trí.
- Tránh visual quá nặng, gradient/orb/background phức tạp hoặc animation làm chậm cảm giác inline.
- Dùng icon khi phù hợp cho Copy/Insert/Back/Stop/Close, nhưng label hoặc tooltip phải đủ rõ.
- Không dùng card lồng card. Popup có thể là một panel duy nhất với các vùng chức năng rõ ràng.
- Responsive cho viewport nhỏ; không để popup tràn cạnh màn hình.
- Không để text tiếng Việt dài làm vỡ button; wrap hoặc dùng kích thước ổn định.

## Feature Behavior

### Intent Classification

Rule-based local trước, không tốn API:

- Text có dấu tiếng Việt: ưu tiên **Summary**.
- Text dài từ khoảng `1000` ký tự: ưu tiên **Summary**.
- Còn lại: ưu tiên **Translate**.
- Action được recommend nên có confidence để UI giải thích nhẹ nhàng nếu cần.

### Translate

- Dịch selection sang tiếng Việt theo mặc định nếu không có target khác.
- Giữ nghĩa, thuật ngữ và formatting quan trọng.
- Với đoạn ngắn, trả lời trực tiếp, không thêm giải thích dài.

### Summary

- Tóm tắt súc tích, giữ ý chính và các chi tiết có thể hành động.
- Với nội dung dài, ưu tiên bullet ngắn hoặc đoạn ngắn dễ đọc trong popup.

### Search Mode

- Query là những gì user gõ trong popup.
- Prompt nên dùng selection + surrounding context + Tavily top results.
- Tavily lỗi thì vẫn trả lời dựa trên selection/context và nói rõ nếu thiếu web results.
- Không bịa nguồn. Nếu có nguồn, giữ title/link trong data model để UI có thể hiển thị sau này.

## Keyboard Contract

- `Enter`: chạy action đang chọn hoặc submit search query.
- `1` / `2`: chọn action chỉ khi query rỗng.
- `ArrowUp` / `ArrowDown`: đổi action focus khi ở action list.
- `Esc`: đóng popup hoặc quay lại state trước nếu đang trong output/search.
- Khi user đang gõ query, phím số là text input bình thường, không phải hotkey.
- Chỉ xử lý logic chính ở `keydown`; nếu swallow thì swallow cả `keydown`, `keypress`, `keyup`.

## State Machine

Theo `README.md`, hướng mục tiêu:

```ts
type PopupState = 'list' | 'streaming' | 'completed';
```

- `list` + `query === ''`: render action list.
- `list` + `query !== ''`: render search query view.
- `streaming`: render stream output và Stop.
- `completed`: render output cùng Copy/Insert/Back.

Nếu cần thêm `error` hoặc `idle`, giữ mapping UX rõ và không làm flow chính rối hơn.

## Security & Privacy

- Không log API keys, raw prompts dài, hoặc nội dung selection nhạy cảm nếu không cần debug.
- `.env` chỉ dùng local; với production nên chuyển API key sang `chrome.storage.local` + settings UI.
- Nhớ rằng key `VITE_*` bị inline vào bundle khi build.
- Hạn chế permissions; chỉ thêm host permissions thật sự cần.
- Không gửi context trang nhiều hơn mức cần thiết; truncate surrounding context.

## Testing Checklist

Trước khi báo xong với user:

1. Chạy `npm run compile` trong `src/` nếu có sửa TypeScript.
2. Chạy `npm run build` trong `src/` nếu có sửa extension runtime/config.
3. Nếu sửa UI/UX, mở extension trong Chrome và kiểm tra thực tế:
   - selection bình thường
   - selection trong input/contentEditable
   - popup gần cạnh viewport
   - keyboard không leak vào host page
   - stream/done/error
   - Copy/Insert/Back/Esc
4. Sau reload extension, reload cả tab test để tránh stale content script.

Debug Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-test" \
  --load-extension="$(pwd)/src/.output/chrome-mv3"
```

## Known Pitfalls

- `getBoundingClientRect()` đã là viewport-relative; không cộng scroll khi popup host fixed.
- Rect zero-size cần fallback hoặc bỏ qua.
- Reload extension làm content script cũ stale.
- Thiếu `host_permissions` có thể khiến MV3 fetch fail khó thấy.
- Click popup có thể làm mất selection nếu không prevent mousedown.
- Port stream leak nếu không disconnect.
- Hotkey có thể phá input nếu không guard `query`.
- WXT output nằm trong `src/.output/chrome-mv3` khi build từ `src/`.

## Code Style

- Giữ TypeScript strict-friendly; ưu tiên type rõ cho message/port payload.
- Không thêm abstraction trước khi có nhu cầu thật.
- Không hardcode magic values rải rác; đưa vào constants có tên rõ.
- Không chỉnh file generated hoặc dependency.
- Sửa nhỏ, đúng phạm vi. Nếu refactor lớn, chia bước để dễ review.
- Comment ngắn khi logic selection/keyboard/port lifecycle khó đọc; tránh comment hiển nhiên.

## Done Definition

Một thay đổi được coi là xong khi:

- Behavior khớp flow trong README hoặc user request mới hơn.
- UX inline không gây khó chịu trên trang host.
- Type-check/build phù hợp đã chạy hoặc lý do không chạy được được nói rõ.
- Không lộ secrets, không thêm permissions thừa, không phá selection/keyboard.
- Tài liệu được cập nhật nếu thay đổi behavior hoặc setup.
