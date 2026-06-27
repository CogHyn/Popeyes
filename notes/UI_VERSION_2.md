# UI Version 2 Notes

## Current Popup UX Issues

- [x] **Chọn feature không nên execute ngay**
  - Hiện tượng: khi user nhấn option `1`/`2` hoặc click option, popup thực hiện action ngay lập tức.
  - Kỳ vọng UX mới:
    - Nhấn option bằng phím số `1`/`2`/`3`/... chỉ chuyển trạng thái UI sang option đó.
    - Click option cũng chỉ select/highlight option, không execute ngay.
    - `Enter` mới là hành động confirm để chạy option đang được chọn.
    - UI phải thể hiện rõ option nào đang được focus/selected trước khi user nhấn `Enter`.
  - Lý do: tránh việc user vô tình gọi AI action khi chỉ đang duyệt lựa chọn; flow mới có bước preview/confirmation nhẹ nhưng vẫn nhanh.
  - Đã xử lý: click option và phím số `1`/`2` chỉ update `activeActionId`; `Enter` mới execute action đang active.

- [x] **Replace nội dung translate phải giữ nuance của câu được dịch**
  - Hiện tượng: khi user dùng `Insert`/replace cho task translate, output có thể không phù hợp sắc thái câu gốc hoặc ngữ cảnh giao tiếp.
  - Kỳ vọng UX/sản phẩm:
    - Với task `translate`, nội dung replace phải là bản dịch tự nhiên, giữ đúng nuance, tone, lịch sự/thân mật, ý định và mức độ mềm/cứng của câu gốc.
    - Use case ưu tiên: user đang nhắn tin với khách hàng nước ngoài, nên câu dịch phải đủ tự nhiên để gửi trực tiếp.
    - Không replace bằng text có prefix kiểu `[Mock Translate]`, nhãn debug, markdown không cần thiết, hoặc giải thích dài.
    - Nếu output có nhiều phần, chỉ phần bản dịch cuối cùng/sạch nhất được dùng để replace.
  - Gợi ý triển khai:
    - Phân biệt `displayText` và `replacementText` trong stream result.
    - Translate engine nên trả về text sạch để insert, còn metadata/debug chỉ dùng cho UI dev nếu cần.
    - Có thể bổ sung prompt/adapter yêu cầu giữ nuance theo ngữ cảnh customer messaging.
  - Đã xử lý: stream message có `replacementText` riêng; `Insert` ưu tiên dùng replacement text sạch. Mock translate không còn trả về prefix `[Mock Translate]` hoặc nhãn debug.

## UX Acceptance Criteria

- User có thể nhấn `1`/`2` để đổi option đang chọn mà popup chưa gọi action.
- `Enter` chạy đúng option đang được highlight.
- Click option chỉ highlight; double click không cần là flow chính.
- `Insert` cho translate chỉ thay selection bằng bản dịch sạch, tự nhiên, không kèm nhãn mock/debug.
- Bản dịch phù hợp tình huống nhắn tin với khách hàng nước ngoài: rõ ý, đúng tone, không máy móc.
