# 🚗 GarageCar — Hệ Thống Quản Lý Garage Ô Tô

<div align="center">
  <h3>Giải pháp quản lý garage đa vai trò với giao diện web hiện đại và API backend Python/FastAPI.</h3>
</div>

---

## 📋 Giới Thiệu

**GarageCar** (AutoPro) là hệ thống quản lý garage ô tô toàn diện, hỗ trợ **3 vai trò** người dùng riêng biệt với giao diện và quyền hạn khác nhau:

| Vai trò | Mô tả |
|---------|-------|
| 👑 **Admin** | Tiếp nhận xe, tạo phiếu sửa chữa, quản lý kho, nhân sự, tài chính, báo cáo |
| 🔧 **Mechanic (Thợ)** | Xem công việc được giao, cập nhật tiến độ từng hạng mục, tra cứu vật tư |
| 🚗 **Customer (Khách)** | Quản lý xe cá nhân, theo dõi tiến độ sửa chữa realtime |

### ✨ Tính Năng Nổi Bật

- **Multi-Role Portals** — Mỗi vai trò có giao diện và quyền truy cập riêng, được điều hướng tự động sau đăng nhập
- **Realtime Progress** — Thợ tick hoàn thành hạng mục, Admin và Khách thấy ngay tiến độ cập nhật
- **Premium UI/UX** — Glassmorphism, smooth animations, font Outfit, dark mode
- **Python/FastAPI Backend** — Async SQLAlchemy, Pydantic v2 validation, tự động sinh OpenAPI docs tại `/docs`
- **🤖 AI Assistant** — Chẩn đoán lỗi xe, ước tính chi phí, tóm tắt phiếu, lịch bảo dưỡng, chatbot kỹ thuật

---

## 🏗️ Cấu Trúc Dự Án

```text
Garagecar/
├── be/                         # 🐍 Backend Python/FastAPI
│   ├── main.py                 # Entry point (uvicorn)
│   ├── seed.py                 # Script tạo dữ liệu mẫu
│   ├── requirements.txt
│   ├── .env.example
│   ├── config/
│   │   └── settings.py         # Pydantic Settings (đọc .env)
│   ├── core/
│   │   ├── security.py         # bcrypt hash + JWT encode/decode
│   │   ├── constants.py        # Enum Role, VehicleStatus, RepairStatus
│   │   └── response.py         # success_response / error_response
│   ├── database/
│   │   ├── engine.py           # SQLAlchemy async engine + Base
│   │   └── session.py          # AsyncSession dependency (get_db)
│   ├── models/                 # ORM models (SQLAlchemy)
│   │   ├── user.py
│   │   ├── vehicle.py
│   │   ├── mechanic.py
│   │   ├── repair_ticket.py
│   │   ├── repair_item.py
│   │   └── inventory.py
│   ├── schemas/                # Pydantic request/response schemas
│   │   ├── auth.py
│   │   ├── vehicle.py
│   │   ├── repair.py
│   │   ├── mechanic.py
│   │   ├── inventory.py
│   │   └── ai.py
│   ├── middleware/
│   │   └── auth.py             # get_current_user + require_role()
│   ├── routers/                # API route handlers
│   │   ├── auth.py             # /api/auth
│   │   ├── vehicles.py         # /api/vehicles
│   │   ├── repairs.py          # /api/repairs
│   │   ├── inventory.py        # /api/inventory
│   │   ├── mechanics.py        # /api/mechanics
│   │   └── ai.py               # /api/ai
│   └── services/
│       └── ai_service.py       # LLM adapter (Mock/OpenAI/Gemini/Ollama)
├── fe/                         # Frontend (Vanilla HTML/CSS/JS)
│   ├── index.html              # Landing page AutoPro
│   ├── styles.css / script.js
│   ├── login/                  # Trang đăng nhập & đăng ký
│   ├── admin/                  # Admin Portal
│   ├── mechanic/               # Mechanic Portal
│   └── customer/               # Customer Portal
└── data/
    └── database.sqlite         # SQLite database (gitignored)
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### Yêu cầu

- **Python 3.11+**
- Trình duyệt hiện đại (Chrome, Firefox, Edge)
- Extension **Live Server** (VS Code) — để chạy frontend

### Bước 1: Cài đặt Backend

```bash
cd be
pip install -r requirements.txt
```

### Bước 2: Cấu hình môi trường

```bash
# Sao chép file cấu hình mẫu
cp .env.example .env
```

Nội dung file `.env` tối thiểu (có thể giữ nguyên mặc định):

```env
PORT=8000
JWT_SECRET=your_jwt_secret_here_change_in_production
DATABASE_PATH=../data/database.sqlite
AI_PROVIDER=mock
```

### Bước 3: Tạo dữ liệu mẫu (khuyến nghị)

```bash
cd be
python seed.py
```

Lệnh này tạo các tài khoản test sẵn:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@autopro.com` | `123456` |
| Mechanic | `mechanic@autopro.com` | `123456` |
| Customer | `customer@autopro.com` | `123456` |

### Bước 4: Khởi động Backend

```bash
cd be
uvicorn main:app --reload --port 8000
```

✅ Backend đang chạy tại: **http://localhost:8000**
📖 Swagger UI (API docs): **http://localhost:8000/docs**

### Bước 5: Khởi động Frontend

Frontend được code bằng HTML/CSS/JS thuần, không cần build:

1. Mở thư mục dự án bằng **VS Code**
2. Cài extension **"Live Server"** (nếu chưa có)
3. Chuột phải vào `fe/login/index.html` → **"Open with Live Server"**
4. Trình duyệt tự mở → Dùng tài khoản mẫu ở trên để đăng nhập

> 💡 Sau khi đăng nhập thành công, hệ thống tự động chuyển đến đúng Portal tương ứng với vai trò.

---

## 🤖 Tích Hợp AI (Tùy chọn)

Cấu hình trong file `.env`:

```env
# Chọn provider: mock | openai | gemini | ollama
AI_PROVIDER=mock

# Nếu dùng OpenAI
OPENAI_API_KEY=sk-...

# Nếu dùng Google Gemini
GEMINI_API_KEY=AIza...

# Nếu dùng Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

**AI Endpoints:**

| Method | Path | Mô tả |
|--------|------|-------|
| `POST` | `/api/ai/diagnose` | Chẩn đoán lỗi xe từ triệu chứng |
| `POST` | `/api/ai/estimate-cost` | Ước tính chi phí sửa chữa |
| `POST` | `/api/ai/summarize-repair` | Tóm tắt phiếu sửa chữa |
| `POST` | `/api/ai/maintenance-advice` | Lịch bảo dưỡng định kỳ |
| `POST` | `/api/ai/chat` | Chatbot kỹ thuật ô tô |

---

## 📡 Tài Liệu API

Tất cả API (trừ `/login`, `/register`, `/health`) đều yêu cầu header:
```
Authorization: Bearer <token>
```

### 🔐 Authentication (`/api/auth`)
| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| `POST` | `/login` | Public | Đăng nhập, nhận JWT token |
| `POST` | `/register` | Public | Tạo tài khoản khách hàng |
| `POST` | `/register-staff` | Admin | Tạo tài khoản Admin/Mechanic |
| `GET` | `/users` | Admin | Danh sách tài khoản |
| `DELETE` | `/users/{id}` | Admin | Xóa tài khoản |

### 🚗 Vehicles (`/api/vehicles`)
| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| `GET` | `/my-vehicles` | Any | Xe của khách đang đăng nhập |
| `GET` | `/` | Admin | Tất cả xe |
| `POST` | `/` | Admin | Tiếp nhận xe mới |
| `PUT` | `/{id}` | Admin | Cập nhật thông tin xe |
| `DELETE` | `/{id}` | Admin | Xóa xe |

### 🛠️ Repairs (`/api/repairs`)
| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| `GET` | `/my-repairs` | Customer | Phiếu sửa xe của khách |
| `GET` | `/my-tasks` | Admin/Mechanic | Phiếu được giao cho thợ |
| `GET` | `/` | Admin | Tất cả phiếu |
| `POST` | `/` | Admin | Tạo phiếu mới |
| `PUT` | `/{id}` | Admin/Mechanic | Cập nhật trạng thái |
| `PUT` | `/{id}/items/{itemId}/toggle` | Admin/Mechanic | Tick hoàn thành hạng mục |
| `DELETE` | `/{id}` | Admin | Xóa phiếu (chỉ khi draft/working) |

### 📦 Inventory (`/api/inventory`) & 👷 Mechanics (`/api/mechanics`)
- `GET` — Admin và Mechanic xem được
- `POST`, `PUT`, `DELETE` — Chỉ Admin

---

## 🤝 Đóng Góp

Vui lòng đọc [CONTRIBUTING.md](CONTRIBUTING.md) trước khi đóng góp.

## 📄 Bản Quyền

Phân phối theo **MIT License** — tự do sử dụng, sửa đổi và phân phối.

---
<p align="center">Được phát triển với sự tỉ mỉ dành cho hệ thống dịch vụ ô tô 🚀</p>
