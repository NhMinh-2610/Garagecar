# Cài đặt và chạy local

## Yêu cầu

| Thành phần                    | Mục đích                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Python 3.11+                  | Backend; Docker dùng Python 3.11, môi trường phát triển đã kiểm tra với 3.13 |
| PostgreSQL                    | Lưu dữ liệu; Compose dùng PostgreSQL 16                                      |
| pgAdmin 4                     | Công cụ quản trị tùy chọn, không thay thế PostgreSQL server                  |
| `pg_dump` trong PATH          | Backup trước khi nâng cấp database đang sử dụng                              |
| Node.js có `node:test` và npm | Chỉ cần cho kiểm thử/định dạng frontend                                      |

## 1. Tạo môi trường

Chạy tại thư mục gốc project:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r be/requirements.txt
if (!(Test-Path be/.env)) { Copy-Item be/.env.example be/.env }
notepad be/.env
```

Cấu hình tối thiểu **lưu trong `be/.env`**:

```dotenv
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@localhost:5432/garagecar
JWT_SECRET=replace-with-a-long-random-secret
PORT=8000
AI_PROVIDER=mock
```

Thay `USER`, `PASSWORD`, port và tên database theo PostgreSQL thực tế. Mật khẩu là của tài khoản PostgreSQL, không phải mật khẩu mở pgAdmin. Nếu mật khẩu chứa ký tự đặc biệt trong URL, cần URL-encode phần mật khẩu. Đặt chuỗi bí mật riêng cho JWT; không commit file `.env`.

PowerShell dùng `$env:PORT = "8000"` nếu cần biến môi trường tạm. Dòng `PORT=8000` chỉ hợp lệ trong file `.env`, không phải lệnh PowerShell.

## 2. Chuẩn bị database

Trong pgAdmin, kết nối server và tạo database `garagecar` với owner có quyền tạo bảng. Xem mục Connection của server để xác định port, thường là `5432`, nhưng máy có nhiều PostgreSQL có thể dùng `5433` hoặc port khác.

Với **database mới, chưa có dữ liệu**, chạy:

```powershell
.\.venv\Scripts\python.exe -m alembic -c be/alembic.ini upgrade head
.\.venv\Scripts\python.exe be/seed.py --demo
```

Với **database đã sử dụng**, làm theo [backup và nâng cấp](operations.md). Không xóa database hoặc chạy lại seed để sửa lỗi schema. Chi tiết seed và dữ liệu giả lập có trong [demo-data.md](demo-data.md).

## 3. Khởi động

Tại thư mục gốc:

```powershell
.\start.cmd --reload
```

Hoặc chạy thủ công:

```powershell
cd be
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

`start.cmd` mặc định bind `127.0.0.1:8000`; truyền thêm cờ Uvicorn để thay đổi, ví dụ `.\start.cmd --port 8001`. `PORT` trong settings được dùng khi chạy `python main.py`; lệnh Uvicorn/launcher sử dụng cờ `--port` của chính nó.

Mở [trang chủ](http://localhost:8000), [đăng nhập](http://localhost:8000/login), [Swagger](http://localhost:8000/docs) hoặc [health](http://localhost:8000/api/health). Backend phục vụ frontend tại `/static/`; không mở bằng `file://` hoặc dùng Live Server làm cách chạy chính.

## Lỗi thường gặp

| Hiện tượng                           | Cách xử lý                                                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL=... is not recognized` | Lưu cấu hình trong `be/.env`; không dán như lệnh PowerShell                                                                  |
| `No module named 'PIL'`              | Cài lại requirements bằng Python `.venv`; gói tên `Pillow`, import tên `PIL`; khởi động bằng `python -m uvicorn` của `.venv` |
| Không kết nối database               | Kiểm tra PostgreSQL đang chạy, database tồn tại, user/password/port đúng và quyền owner                                      |
| `Database needs migration`           | Dừng backend, backup và nâng cấp theo [vận hành](operations.md)                                                              |
| `pg_dump not found`                  | Thêm thư mục `bin` của PostgreSQL vào PATH, mở lại terminal rồi thử `pg_dump --version`                                      |
| Cổng 8000 đã dùng                    | Dừng server cũ do mình chạy hoặc chọn `--port 8001`                                                                          |
| Giao diện PWA còn bản cũ             | Tải lại khi có thông báo cập nhật; có thể gỡ service worker/site data trong DevTools ở môi trường local                      |

Cách chạy bằng container được tách tại [deployment.md](deployment.md).
