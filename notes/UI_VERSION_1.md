# UI Version Notes

## Current Popup UX Issues

- [x] **Popup biến mất khi user nhập text ngay lập tức**
  - Hiện tượng: sau khi popup xuất hiện, nếu user gõ ngay thì khung popup có thể biến mất hoặc state bị reset.
  - Kỳ vọng: khi popup đã active, keyboard input phải được giữ trong popup/search mode, không làm mất selection hoặc đóng popup ngoài ý muốn.
  - Đã xử lý: bỏ listener `keyup` dùng để re-check selection khi popup active; popup không tự đóng chỉ vì selection biến mất trong lúc focus input, và click ra ngoài mới đóng popup.

- [x] **Index/hotkey của các option bị lệch**
  - Hiện tượng: component đứng đầu có thể hiển thị hotkey `2`, component đứng cuối lại hiển thị hotkey `1`.
  - Kỳ vọng: option hiển thị đầu tiên luôn tương ứng hotkey `1`, option tiếp theo là `2`, bất kể thứ tự recommend Translate/Summary thay đổi.
  - Đã xử lý: hotkey hiển thị và phím tắt `1`/`2` giờ map theo index render thay vì field cố định trong action.

- [x] **Popup đang hiện quá sớm**
  - Hiện tượng: popup xuất hiện gần như ngay sau khi user bôi đen text, có thể gây khó chịu khi user chỉ muốn copy/đọc/chọn tạm.
  - Kỳ vọng UX mới:
    - Popup chỉ tự hiện khi user giữ selection ổn định khoảng `750ms`.
    - Hoặc popup hiện khi user chọn action từ context menu chuột phải.
    - Không mở popup khi selection ngắn, collapsed, hoặc user chỉ drag/chọn thoáng qua.
  - Đã xử lý: debounce selection đổi từ `350ms` sang `750ms`; thêm context menu `Open AI Assistant` cho selection để mở popup ngay bằng chuột phải.

## Integration Tasks

- [x] **Integrate các interface trong `src/ai_engine/[FEATURE]`**
  - Dùng các interface hiện có làm contract chính cho từng feature:
    - `src/ai_engine/translate/translate.interface.ts`
    - `src/ai_engine/summary/summary.interface.ts`
    - `src/ai_engine/search/search.interface.ts`
  - Mục tiêu: background/streaming layer gọi qua adapter theo interface thay vì hardcode logic trực tiếp trong UI component.
  - Kỳ vọng: dễ thay Groq/Tavily/mock/local implementation mà không phải sửa popup components.
  - Đã xử lý: thêm mock class implement từng interface và route background streaming qua các mock engine.

## UX Acceptance Criteria

- Popup không làm mất vùng bôi đen khi user click vào popup.
- Popup không leak phím sang trang host khi đang active.
- Popup ưu tiên nằm phía bên phải dưới selection, chỉ clamp vào viewport khi sát mép màn hình.
- User có thể gõ câu hỏi tự nhiên sau khi popup hiện mà không bị đóng hoặc reset.
- Hotkey hiển thị phải khớp trực giác thị giác: item đầu là `1`, item hai là `2`.
