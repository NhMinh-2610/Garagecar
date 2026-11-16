# Nhắn tin giữa khách hàng và garage

Hộp thư là trao đổi giữa người dùng thật: khách hàng, cố vấn dịch vụ và quản trị viên. Tin nhắn được lưu trong PostgreSQL. **Không có chatbot, AI, mô hình local hoặc cuộc gọi API nhà cung cấp AI.**

| Quyền             | Khách hàng                    | Cố vấn                                                 | Quản trị viên                     |
| ----------------- | ----------------------------- | ------------------------------------------------------ | --------------------------------- |
| Mở hội thoại      | Chung hoặc theo xe thuộc mình | Xem chưa phân công và hội thoại mình xử lý             | Xem/phân công theo quyền messages |
| Gửi tin           | Trong hội thoại của mình      | Trong phạm vi phụ trách; nhận hội thoại chưa phân công | Trong phạm vi quản trị            |
| Phân công lại     | Không                         | Không                                                  | Có                                |
| Đóng/mở hội thoại | Không                         | Theo quyền phụ trách                                   | Có                                |

Kế toán và kỹ thuật viên không có quyền hộp thư. Quyền `messages` có thể bị khóa trên tài khoản. API kiểm tra cả quyền và quyền sở hữu xe/hội thoại; ẩn menu không thay thế kiểm tra server.

Mỗi tin có UUID do client tạo. Khi mất phản hồi và thử lại, client dùng lại UUID; server trả tin đã lưu thay vì tạo thêm. Nội dung được hiển thị như văn bản, không chạy HTML. Con trỏ đã đọc lưu theo từng người và chỉ tăng. Frontend kiểm tra tin mới khoảng 5 giây, giữ bản nháp trong bộ nhớ tab.

Dữ liệu nằm ở `support_conversations`, `support_messages`, `support_reads`. Xem [API](report/api-catalog.md) và [ERD](report/diagrams/07-data-support.svg). Không có WebSocket, đính kèm ảnh, gọi thoại, chat nhóm, push khi đóng app hay gửi ngoại tuyến tự động.

Để thử: mở khách demo và cố vấn demo trong hai phiên trình duyệt, tạo hội thoại, gửi/trả lời, kiểm tra tin chưa đọc; mất mạng khi gửi rồi thử lại để xác minh một tin duy nhất. Quản trị viên có thể kiểm tra phân công lại; khách khác không được xem hội thoại đó.
