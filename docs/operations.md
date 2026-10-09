# Backup, migration và vận hành

Chạy các lệnh tại thư mục gốc bằng Python `.venv`. `be/manage.py` đọc cùng cấu hình `be/.env` với backend.

## Nâng cấp database đang sử dụng

1. Dừng backend hoặc tạm ngừng thao tác ghi để nâng cấp nhất quán.
2. Kiểm tra cấu hình trỏ đúng database và `pg_dump` có trong PATH.
3. Chạy lệnh nâng cấp có backup bắt buộc:

```powershell
.\.venv\Scripts\python.exe be/manage.py upgrade
```

Lệnh tạo bản dump dạng custom trong `.backups/`, chạy Alembic đến `head` rồi audit. Nếu backup thất bại, không chạy migration. Có thể backup/audit độc lập:

```powershell
.\.venv\Scripts\python.exe be/manage.py backup
.\.venv\Scripts\python.exe be/manage.py audit
.\.venv\Scripts\python.exe -m alembic -c be/alembic.ini current
```

Backup/audit không tự liên kết xe với khách hoặc thợ với tài khoản dựa vào tên. Dữ liệu cũ thiếu liên kết cần quản trị kiểm tra danh tính rồi cập nhật qua giao diện. Audit chỉ báo phiếu đã thu có tổng tiền cần xem lại, không tự sửa tiền lịch sử.

## Migration hiện tại

| Revision           | Nội dung                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| `001`              | Chuẩn hóa dữ liệu và liên kết nghiệp vụ ban đầu                          |
| `002`              | Chống dò đăng nhập                                                       |
| `003`              | Tài khoản và kiểm soát phiên đăng nhập                                   |
| `004`              | Hồ sơ/lịch bảo dưỡng, tiếp nhận/báo giá, nhân viên và giới hạn chức năng |
| `005`              | Ảnh/mã vật tư, thu–chi, phân ca/chứng chỉ/nghỉ phép, chăm sóc sau sửa    |
| `006`              | Bổ sung thương hiệu xe, gồm VinFast                                      |
| `007_support_chat` | Hội thoại, tin nhắn và con trỏ đọc hỗ trợ khách hàng                     |

Tên đầy đủ và phụ thuộc xem trong [migrations/versions](../be/migrations/versions). Migration mới nhất thêm ba bảng chat; không cần xóa hoặc tạo lại database để dùng tính năng.

## Kiểm tra sau nâng cấp

- Backend khởi động và `/api/health` trả thành công; startup sẽ báo tên bảng/cột còn thiếu.
- Đăng nhập bằng từng vai trò, kiểm tra menu và API đúng phạm vi.
- Kiểm tra tổng phiếu đã thu, tồn kho, lịch sử biến động và các liên kết dữ liệu cũ.
- Trên database thử nghiệm: chạy tiếp nhận → báo giá → khách duyệt → sửa/ảnh → nghiệm thu → thu tiền → giao xe.
- Kiểm tra giữ bản nháp khi đồng bộ, hộp thư và thông báo đã công bố cho khách.

Quy trình thêm dữ liệu giả lập được tách tại [demo-data.md](demo-data.md); không seed dữ liệu demo vào môi trường phục vụ khách thật.

## Đối chiếu phiếu thanh toán và chứng từ

Trong Query Tool của pgAdmin, truy vấn chỉ đọc sau liệt kê phiếu ở trạng thái `paid` nhưng chưa có chứng từ trong sổ thu:

```sql
SELECT r.id, r."vehicleId", r."totalAmount", r."paidAt"
FROM repair_tickets AS r
LEFT JOIN payment_receipts AS p ON p."ticketId" = r.id
WHERE r.status = 'paid' AND p.id IS NULL
ORDER BY r.id;
```

Báo cáo doanh thu hiện tổng hợp phiếu đã thanh toán, còn sổ thu liệt kê chứng từ thu. Nếu truy vấn trả kết quả, cần đối chiếu giao dịch gốc, phương thức, mã tham chiếu và người nhận trước khi bổ sung chứng từ. Không đặt lại trạng thái hoặc tạo chứng từ giả chỉ để làm hai bảng khớp nhau.

## Khôi phục và theo dõi

Giữ bản dump ngoài thư mục làm việc và thử phục hồi vào **database thử riêng** bằng công cụ Restore của pgAdmin/`pg_restore`. Xác minh dữ liệu và cấu hình trước khi quyết định chuyển ứng dụng sang bản phục hồi; không phục hồi đè database đang dùng để thử nghiệm.

Theo dõi lỗi API, dung lượng PostgreSQL/ảnh, backup, worker nhắc hạn và dịch vụ AI. Ảnh đang nằm trong database nên dung lượng backup sẽ tăng theo sử dụng. Không ghi token, mật khẩu, API key hoặc toàn bộ nội dung chat riêng vào log.

Compose local tự chạy migration khi backend khởi động, phù hợp thử nghiệm; database đang sử dụng vẫn cần backup và quy trình nâng cấp riêng. Xem [Docker](deployment.md).
