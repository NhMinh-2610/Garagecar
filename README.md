# GarageCar — Quản lý garage ô tô

FastAPI + SQLAlchemy async + PostgreSQL; frontend HTML/CSS/JavaScript thuần cho admin, thợ và khách hàng.

## Yêu cầu

- Python 3.11+
- PostgreSQL (đang chạy, đã tạo database `garagecar`)
- `pg_dump` trong PATH (để backup trước migration)
- Node.js (chỉ cần khi chạy kiểm thử frontend)

## Cài đặt và chạy

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r be/requirements.txt
```

Tạo file cấu hình (nếu chưa có):

```powershell
Copy-Item be/.env.example be/.env
```

Nội dung `be/.env`:

```dotenv
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@localhost:5432/garagecar
JWT_SECRET=replace-with-a-long-random-secret
PORT=8000
AI_PROVIDER=mock
```

Chạy migration và seed dữ liệu demo (chỉ khi bảng `users` chưa có tài khoản):

```powershell
cd be
python -m alembic upgrade head
python seed.py
```

Khởi động server:

```powershell
uvicorn main:app --reload --port 8000
```

Hoặc dùng script tắt nhanh ở thư mục gốc:

```powershell
start.cmd
```

Mở trình duyệt:

| Trang | URL |
|---|---|
| Trang chủ / đặt lịch | http://localhost:8000 |
| Đăng nhập | http://localhost:8000/login |
| Admin | http://localhost:8000/admin |
| Thợ | http://localhost:8000/mechanic |
| Khách hàng | http://localhost:8000/customer |
| Tài liệu API | http://localhost:8000/docs |

Tài khoản demo: `admin@autopro.com`, `mechanic@autopro.com`, `customer@autopro.com` — mật khẩu `123456`.

## Nâng cấp database (có dữ liệu cũ)

```powershell
python be/manage.py upgrade
```

Lệnh tự động backup PostgreSQL vào `.backups/` trước khi chạy Alembic. Nếu backup thất bại, migration không chạy.

Kiểm tra các liên kết còn thiếu sau nâng cấp:

```powershell
python be/manage.py audit
```

## Docker

```powershell
docker compose up --build
```

| Cổng | Dịch vụ |
|---|---|
| 3000 | Frontend (Nginx) |
| 8000 | Backend (FastAPI) |
| 5432 | PostgreSQL |

Nginx proxy `/api` về backend. Container backend chạy migration tự động khi khởi động.

> **Lưu ý:** Không chạy `docker compose down -v` nếu cần giữ dữ liệu.

## Quy tắc nghiệp vụ

- **Vòng đời phiếu:** `draft → working → completed → paid`. Phải phân công thợ trước khi bắt đầu; hoàn tất mọi hạng mục trước khi chuyển trạng thái.
- **Tồn kho:** Vật tư bị trừ khi tạo phiếu; hoàn kho khi xóa phiếu chờ. Tồn kho được khóa giao dịch để tránh xuất quá số dư.
- **Doanh thu:** Chỉ tính phiếu đã `paid`, theo `paidAt`, múi giờ Việt Nam.
- **Đặt lịch:** Yêu cầu từ trang chủ lưu vào database với trạng thái `pending`; admin xác nhận hoặc huỷ tại tab Tiếp nhận.
- **Tự động làm mới:** Các portal polling mỗi 20 giây và đồng bộ qua `localStorage` khi có thao tác ghi.

## Kiểm thử

Backend (cần PostgreSQL, tạo schema test ngẫu nhiên, tự dọn sau khi xong):

```powershell
pip install -r be/requirements-dev.txt
cd be
python -m pytest tests -q
```

Frontend (DOM + API giả lập):

```powershell
npm ci
npm test
```

## Cấu trúc

```
be/
  models/          # ORM: User, Vehicle, RepairTicket, RepairItem, Inventory,
                   #       InventoryMovement, Mechanic, Booking, Settings
  schemas/         # Pydantic: validate input & shape response
  routers/         # API: auth, vehicles, repairs, inventory, mechanics,
                   #       bookings, reports, settings, ai
  services/        # repair_service.py: tinh tien, xuat/hoan kho, chuyen trang thai
  middleware/      # JWT auth, phan quyen role
  migrations/      # Alembic versioned migrations
  core/            # response helpers, time utils, constants
  manage.py        # CLI: upgrade (backup + migrate), audit

fe/
  shared/
    core.js        # API client, toast, auto-refresh, escape, date helpers
    portal.js      # khoi tao portal chung (auth check, polling setup)
    ui.css         # style dung chung
  admin/           # portal quan tri (repair, reception, inventory, hr, finance...)
  mechanic/        # portal tho (tasks, inventory)
  customer/        # portal khach (vehicles, repairs, booking)
  login/           # trang dang nhap
  index.html       # trang chu + form dat lich
```
