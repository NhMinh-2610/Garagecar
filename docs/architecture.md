# Kiến trúc và dữ liệu

## Cấu trúc project

```text
be/
  config/        Cau hinh tu bien moi truong
  core/          Bao mat, phan quyen, response
  database/      Engine, session, kiem tra schema
  models/        SQLAlchemy models
  schemas/       Pydantic request/response
  routers/       HTTP endpoints
  services/      Nghiep vu, AI, worker, demo seed
  migrations/    Alembic revisions
  data/          Danh muc bao duong va anh gia lap
  tests/         Kiem thu backend
fe/
  shared/        UI, HTTP client, quyen, session, workspace va module dung chung
  admin/         Portal quan tri
  advisor/       Portal co van
  accountant/    Portal ke toan
  hr/            Portal nhan su
  mechanic/      Portal ky thuat vien
  customer/      Portal khach hang
  login/         Dang nhap va dang ky
  staff/         Chuyen huong tu duong dan cu sang portal dung vai tro
docs/            Huong dan va tai lieu nghien cuu
scripts/         Kiem tra tai nguyen va lien ket
tests/           Kiem thu frontend bang jsdom
```

FastAPI kiểm tra đầu vào và quyền, gọi nghiệp vụ trong service rồi truy cập PostgreSQL qua SQLAlchemy async. Alembic quản lý schema; startup chỉ kiểm tra tính sẵn sàng, không tự tạo/sửa bảng. Frontend gọi cùng origin `/api`, dùng `Garage.request` để thống nhất xác thực, lỗi và đồng bộ.

## Các nhóm dữ liệu

| Nhóm            | Bảng chính và quan hệ                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Danh tính       | `users` → `vehicles.customerId`; `users` → `mechanics.userId`; `employee_profiles` cho nhân viên      |
| Sửa chữa        | `vehicles` → `repair_tickets` → `repair_items`; thợ liên kết bằng `mechanicId`                        |
| Tiếp nhận       | `bookings`, `service_visits`, `service_quotes`; phiếu sửa liên kết lượt dịch vụ bằng `serviceVisitId` |
| Kho             | `inventories`, `inventory_movements`; SKU, barcode, cấu hình tương thích và cờ cao áp                 |
| Bảo dưỡng       | `vehicle_care`, `maintenance_profiles`, `maintenance_records`, `maintenance_reminders`                |
| Bằng chứng      | `repair_evidence` theo hạng mục và lần thực hiện; dữ liệu ảnh nằm trong PostgreSQL                    |
| Tài chính       | `payment_receipts`, `expenses`; phiếu đã thanh toán giữ giá trị lịch sử                               |
| Nhân sự         | `staff_shifts`, `staff_certificates`, `leave_requests`                                                |
| Chăm sóc & chat | `service_followups`, `support_conversations`, `support_messages`, `support_reads`                     |
| Danh mục        | `brands`, `wages`, `system_parameters`; `login_attempts` phục vụ kiểm soát đăng nhập                  |

Các cột/API đang dùng tên camelCase được giữ để tương thích. Đổi tên file không đồng nghĩa đổi tên bảng, trường hay revision migration.

## Quy tắc nhất quán

- Chủ xe xác định bằng `customerId`, thợ bằng `userId`/`mechanicId`; không suy quyền từ tên hoặc số điện thoại.
- Giá vật tư/công trên phiếu là giá tại thời điểm lập. Thay danh mục không được đổi lại tiền của phiếu đã thu.
- Xuất/trả kho và sửa hạng mục thuộc cùng giao dịch; không cho số lượng âm. Tạo phiếu từ báo giá chỉ thành công khi toàn bộ điều kiện hợp lệ.
- Báo giá có phiên bản; xác nhận của khách phải trỏ đúng phiên bản đang hiển thị.
- Khóa tài khoản/đổi mật khẩu làm hết hiệu lực phiên cũ qua `sessionVersion`; giới hạn chức năng chỉ thu hẹp quyền vai trò.
- API ảnh yêu cầu token và trả `private, no-store`. Service worker bỏ qua toàn bộ API và request có Authorization.
- Tin nhắn có mã gửi do client tạo để retry không trùng; con trỏ đọc chỉ tiến lên. Phân quyền chat được kiểm tra trong API.

Frontend đồng bộ nghiệp vụ mỗi 20 giây, hộp thư khoảng 5 giây. Các module giữ bộ lọc/lựa chọn, trì hoãn render khi đang nhập liệu và không reload trang. Bản nháp chat giữ trong bộ nhớ của tab, không lưu vĩnh viễn.

Xem [nghiệp vụ](workflows.md), [AI/chat](ai-and-messaging.md) và [vận hành](operations.md) để biết điều kiện, giới hạn và cách nâng cấp.
