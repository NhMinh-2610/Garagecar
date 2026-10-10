# AI và nhắn tin hỗ trợ

## Hai kênh độc lập

| Kênh         | Mục đích                                                      | Lưu dữ liệu                                                    |
| ------------ | ------------------------------------------------------------- | -------------------------------------------------------------- |
| Hỏi AI về xe | Giải thích triệu chứng, kiểm tra ban đầu và câu hỏi bảo dưỡng | Lịch sử trong bộ nhớ tab; client gửi lại ngữ cảnh khi hỏi tiếp |
| Nhắn garage  | Trao đổi với cố vấn, tiến độ và yêu cầu hỗ trợ                | PostgreSQL; có phân công, tin chưa đọc và lịch sử              |

Nút chuyển câu hỏi AI sang garage chỉ tạo **bản nháp**, khách vẫn phải bấm gửi. Bản nháp đang có không bị ghi đè. Tin nhắn giữa khách và cố vấn không được tự chuyển sang nhà cung cấp AI.

## Cấu hình AI

Sửa `be/.env` rồi khởi động lại backend. Bảng mô tả adapter đã có trong code; model cần tồn tại và được phép sử dụng tại nhà cung cấp/local runtime của bạn.

| `AI_PROVIDER` | Biến liên quan                    | Hành vi                                                        |
| ------------- | --------------------------------- | -------------------------------------------------------------- |
| `mock`        | Không cần API key                 | Mô phỏng có nhãn demo; dùng thử giao diện, không phải LLM thật |
| `ollama`      | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Gọi model chạy tại dịch vụ Ollama đã cài riêng                 |
| `openai`      | `OPENAI_API_KEY`, `OPENAI_MODEL`  | Gọi adapter OpenAI ở backend                                   |
| `gemini`      | `GEMINI_API_KEY`, `GEMINI_MODEL`  | Gọi Gemini bằng HTTP ở backend                                 |

Giá trị mặc định nằm trong [settings.py](../be/config/settings.py); ví dụ biến nằm ở [.env.example](../be/.env.example). Project không tự tải model hoặc khởi động Ollama. Giữ API key trong `.env`/biến môi trường phía server, không đặt trong JavaScript hoặc commit lên Git.

## Ngữ cảnh xe và quyền riêng tư

Mặc định hỏi không kèm hồ sơ xe. Khách có thể chọn chia sẻ ngữ cảnh của xe thuộc tài khoản mình; backend kiểm tra quyền sở hữu và chỉ lấy thông tin nghiệp vụ cần thiết. Không đưa tên, điện thoại hoặc VIN vào ngữ cảnh do hệ thống tự dựng. Nội dung người dùng tự nhập vẫn được gửi đến provider đã chọn, nên giao diện hiển thị nhà cung cấp và lựa chọn chia sẻ trước khi hỏi.

Ngữ cảnh có thể gồm cấu hình xe, lịch sử dịch vụ và dữ liệu bảo dưỡng đã xác minh phù hợp. Danh sách nguồn trong phản hồi trỏ tới dữ liệu project đã sử dụng, không có nghĩa model đã đọc toàn bộ sách hãng. Đây chưa phải hệ thống RAG đọc PDF hoặc tra phụ tùng OEM theo VIN.

Chat giới hạn lịch sử tối đa 21 lượt, 4.000 ký tự mỗi tin và tổng 16.000 ký tự mỗi yêu cầu. Backend giới hạn tần suất/số yêu cầu đồng thời theo người dùng trong tiến trình. Mất kết nối giữ câu hỏi để thử lại; trả lỗi provider không được giả làm trả lời LLM thành công.

## Hộp thư garage

- Mỗi khách có hội thoại chung và hội thoại theo xe; API kiểm tra xe thuộc khách đó.
- Cố vấn nhận hội thoại chưa phân công và xử lý hội thoại mình phụ trách. Quản trị phân công lại khi cần.
- Khách chỉ xem/gửi trong hội thoại của mình. Kế toán, nhân sự và thợ không có quyền hộp thư theo mặc định.
- Tin nhắn bất biến, kèm người gửi/vai trò/thời điểm. Mã gửi UUID giúp retry sau lỗi mạng không tạo tin trùng.
- Con trỏ đọc tăng theo tin đã xem, hỗ trợ nhãn chưa đọc/đã đọc. Giao diện polling khoảng 5 giây, giữ nội dung nhập và vị trí đang thao tác.
- Hội thoại lưu trong PostgreSQL, cùng quy trình backup và migration `007_support_chat`.

Chưa có WebSocket, gửi ảnh trong chat, gọi thoại, chat nhóm hoặc push khi đóng ứng dụng. Không có gửi ngoại tuyến tự động. AI chỉ hỗ trợ trao đổi, không thay chẩn đoán trực tiếp và xác nhận nghiệp vụ của garage.

## Kiểm tra mà không gọi dịch vụ trả phí

Đặt `AI_PROVIDER=mock`, đăng nhập tài khoản khách demo và thử hỏi, bật/tắt chia sẻ xe, chuyển sang bản nháp garage rồi gửi. Đăng nhập cố vấn demo ở trình duyệt/phiên khác để xem và trả lời. Các test AI dùng mock HTTP, không yêu cầu API key thật.
