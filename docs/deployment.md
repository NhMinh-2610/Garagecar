# Chạy bằng Docker Compose

Cấu hình Compose hiện phục vụ phát triển/demo local. Có PostgreSQL, FastAPI và Nginx; chưa phải cấu hình vận hành production hoàn chỉnh.

## Chuẩn bị và khởi động

Tạo `be/.env` từ [.env.example](../be/.env.example) nếu chưa có, đặt `JWT_SECRET` riêng và chọn provider AI. Compose ghi đè `DATABASE_URL` để backend kết nối service `db`; không dùng PostgreSQL local của máy trong chế độ này.

```powershell
if (!(Test-Path be/.env)) { Copy-Item be/.env.example be/.env }
docker compose up --build -d
docker compose exec backend python seed.py --demo
```

Backend tự chạy `alembic upgrade head` trước Uvicorn. Seed là lệnh riêng, không tự chạy mỗi lần container lên. File `.env` được cấp lúc chạy qua `env_file` và được loại khỏi image bằng `be/.dockerignore`.

| Địa chỉ/service         | Chức năng                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `http://localhost:3000` | Nginx phục vụ frontend và proxy `/api/`                                              |
| `http://localhost:8000` | FastAPI phục vụ frontend, API và Swagger                                             |
| `localhost:5432`        | PostgreSQL container, tài khoản demo `garagecar` / `garagecar`, database `garagecar` |
| Volume `pgdata`         | Giữ dữ liệu PostgreSQL qua các lần khởi động                                         |

Nếu PostgreSQL local đang chiếm cổng 5432, đổi cổng **bên trái** trong ánh xạ `ports` của service `db`, ví dụ `5434:5432`. Backend bên trong Docker vẫn kết nối `db:5432`.

## Theo dõi và dừng

```powershell
docker compose ps
docker compose logs --tail 100 backend
docker compose down
```

Không thêm `--volumes` nếu muốn giữ dữ liệu. Database container và database local là hai nguồn riêng; tài khoản/dữ liệu tạo ở một bên không tự xuất hiện ở bên còn lại.

## PWA và điện thoại

PWA dùng manifest/service worker chung project, cache giao diện công khai và cần mạng để đọc/ghi dữ liệu cá nhân. Cài đặt/service worker cần HTTPS hoặc môi trường localhost được trình duyệt chấp nhận. Truy cập IP máy tính qua HTTP trên điện thoại không tương đương localhost của máy tính; dùng HTTPS khi thử cài qua mạng LAN.

Chưa có push khi đóng ứng dụng hoặc đồng bộ công việc offline. Cơ chế polling chỉ chạy khi ứng dụng đang mở.

## Trước khi vận hành thực tế

Thay thông tin đăng nhập demo/bí mật, thiết lập HTTPS, origin cụ thể, backup/restore và giám sát. Kiểm tra dung lượng ảnh trong PostgreSQL, kiểm soát tần suất AI khi chạy nhiều worker và chiến lược worker nhắc hạn. Cần đánh giá deployment và tải theo quy mô garage; xem [vận hành](operations.md) và [định hướng](roadmap.md).
