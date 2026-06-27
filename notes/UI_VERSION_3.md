# UI Version 3 Notes

## Current Insert/Replace Issues

- [ ] **Messenger input mất nội dung ngay sau khi Insert**
  - Hiện tượng: trong app Messenger/Facebook Messenger, sau khi user bôi đen nội dung trong input box và nhấn `Insert`, text vừa được replace có thể biến mất ngay.
  - Use case ưu tiên: user đang nhắn tin với khách hàng nước ngoài, dùng Translate rồi Insert trực tiếp vào ô chat.
  - Giả thuyết kỹ thuật:
    - Messenger input thường là `contentEditable`/React-controlled editor, không phải `textarea` hoặc `input` thường.
    - Logic replace hiện tại chủ yếu xử lý `HTMLInputElement`/`HTMLTextAreaElement` bằng `setRangeText`, còn contentEditable fallback dùng DOM `Range.deleteContents()` + `insertNode()`.
    - React/editor nội bộ của Messenger có thể không nhận biết mutation DOM trực tiếp, sau đó reconcile state cũ và xóa nội dung vừa insert.
    - Popup focus/click cũng có thể làm selection trong editor stale trước khi insert.
  - Kỳ vọng UX/sản phẩm:
    - Insert vào Messenger/contentEditable phải giữ nội dung ổn định sau khi editor re-render.
    - Không làm mất draft message hiện có ngoài selection.
    - Sau khi insert, caret đặt sau nội dung mới để user tiếp tục gõ hoặc gửi.
    - Translate insert vẫn dùng `replacementText` sạch, không kèm debug/mock label.
  - Gợi ý triển khai:
    - Lưu selection range/contentEditable host trước khi popup nhận focus.
    - Với contentEditable, ưu tiên mô phỏng user input bằng `beforeinput`/`input` event hoặc `execCommand('insertText')` fallback thay vì chỉ mutate DOM.
    - Dispatch đúng `InputEvent` với `inputType: 'insertReplacementText'`, `data`, `bubbles: true`, `composed: true` nếu browser hỗ trợ.
    - Sau insert, verify host textContent/value đã đổi; nếu bị revert, fallback copy replacement text và hiển thị hướng dẫn paste thủ công.

## UX Acceptance Criteria

- Insert trong `textarea`/`input` vẫn hoạt động như hiện tại.
- Insert trong Messenger contentEditable không bị mất text sau vài frame/re-render.
- Chỉ selection được thay thế, phần draft còn lại được giữ nguyên.
- Caret nằm ngay sau replacement text.
- Nếu không thể insert an toàn, popup không phá nội dung hiện tại và báo fallback rõ ràng.
