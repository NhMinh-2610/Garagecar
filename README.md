# 🚗 AutoPro Garage Management System

<div align="center">
  <h3>Hệ thống quản lý garage tự động đa vai trò với giao diện web cao cấp và API backend mạnh mẽ.</h3>
</div>

---

## 📋 Giới Thiệu

**AutoPro** là một giải pháp phần mềm quản lý garage ô tô toàn diện được thiết kế với chuẩn mực doanh nghiệp (Enterprise Standard). Hệ thống cung cấp trải nghiệm UI/UX cao cấp, thao tác mượt mà và quản lý dữ liệu tập trung qua RESTful API, phục vụ chuyên biệt cho 3 đối tượng người dùng chính: **Quản Trị Viên (Admin), Kỹ Thuật Viên (Thợ) và Khách Hàng**.

### ✨ Các Tính Năng Nổi Bật

- **Hệ Thống Đa Vai Trò (Multi-Role Portals)**:
  - 👑 **Admin Portal**: Quản lý toàn diện (Tiếp nhận xe, Phiếu sửa chữa, Kho, Nhân sự, Tài chính, Báo cáo).
  - 🔧 **Mechanic Portal**: Nhận việc, check tiến độ từng hạng mục, tra cứu vật tư.
  - 🚗 **Customer Portal**: Quản lý xe cá nhân, theo dõi tiến độ sửa chữa realtime qua thanh progress bar.
- **Giao Diện Cao Cấp (Premium UI/UX)**: Thiết kế hiện đại (Glassmorphism), animations mượt mà, sử dụng phông chữ Outfit. Mỗi portal mang một tone màu đặc trưng.
- **Quản Lý Cập Nhật Trực Tiếp**: Thợ tick hoàn thành hạng mục, Admin và Khách hàng lập tức thấy được tiến độ cập nhật.
- **🐍 Python/FastAPI Backend (v2)**: Backend thế hệ mới viết bằng Python — async SQLAlchemy, Pydantic v2 validation, tự động sinh OpenAPI docs tại `/docs`.
- **🤖 AI Assistant Module**: Tích hợp LLM hỗ trợ chẩn đoán lỗi xe, ước tính chi phí, tóm tắt phiếu sửa chữa, tư vấn bảo dưỡng và chatbot kỹ thuật ô tô.

## 🏗️ Cấu Trúc Dự Án

```text
Garagecar/
├── be/                       # Backend Node.js/Express (legacy v1)
│   ├── routes/               # RESTful API Endpoints
│   ├── models/               # Sequelize ORM models
│   ├── middleware/           # JWT & RBAC middleware
│   ├── utils/                # Logger, Validation, Response helpers
│   └── server.js             # Entry point
├── be_python/                # 🐍 Backend Python/FastAPI (v2) ← MỚI
│   ├── main.py               # FastAPI app entry point (uvicorn)
│   ├── config/settings.py    # Pydantic Settings (env vars)
│   ├── core/                 # Security (bcrypt/JWT), constants, response
│   ├── database/             # SQLAlchemy async engine + session
│   ├── models/               # ORM models (User, Vehicle, Repair...)
│   ├── schemas/              # Pydantic request/response schemas
│   ├── middleware/auth.py    # JWT Bearer dependency + require_role()
│   ├── routers/              # Auth, Vehicles, Repairs, Inventory, Mechanics, AI
│   ├── services/ai_service.py# 🤖 LLM adapter (Mock/OpenAI/Gemini/Ollama)
│   └── requirements.txt
├── fe/                       # Frontend Client (HTML/CSS/JS)
│   ├── admin/                # Admin Portal
│   ├── mechanic/             # Mechanic Portal
│   ├── customer/             # Customer Portal
│   └── login/                # Smart login routing
└── data/database.sqlite      # Shared SQLite database (used by both backends)
```

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 🐍 Python Backend (Khuyên dùng — v2 với AI)

**Yêu cầu**: Python 3.11+

```bash
cd be_python
pip install -r requirements.txt
cp .env.example .env          # chỉnh sửa .env nếu cần
uvicorn main:app --reload --port 8000
```

Swagger UI: **http://localhost:8000/docs**

#### Cấu hình AI Provider (tuỳ chọn)

```env
# .env
AI_PROVIDER=mock              # mock | openai | gemini | ollama
OPENAI_API_KEY=sk-...         # nếu dùng OpenAI
GEMINI_API_KEY=AIza...        # nếu dùng Gemini
OLLAMA_BASE_URL=http://localhost:11434  # nếu dùng Ollama local
```

#### 🤖 AI Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/api/ai/diagnose` | Chẩn đoán lỗi xe từ triệu chứng |
| `POST` | `/api/ai/estimate-cost` | Ước tính chi phí sửa chữa |
| `POST` | `/api/ai/summarize-repair` | Tóm tắt phiếu sửa chữa |
| `POST` | `/api/ai/maintenance-advice` | Lịch bảo dưỡng định kỳ |
| `POST` | `/api/ai/chat` | Chatbot kỹ thuật ô tô |

---

### 📦 Node.js Backend (v1 — legacy)

**Yêu cầu**: Node.js v16+, NPM



### Bước 1: Khởi động Backend & Tạo dữ liệu mẫu

1. **Mở Terminal** và di chuyển vào thư mục `be`:
   ```bash
   cd be
   ```

2. **Cài đặt thư viện (Dependencies):**
   ```bash
   npm install
   ```

3. **Tạo cấu hình môi trường:**
   Tạo file `.env` nằm trong thư mục `be` với nội dung:
   ```env
   PORT=3000
   JWT_SECRET=super_secret_jwt_key
   NODE_ENV=development
   ```

4. **Khởi tạo Database & Dữ liệu mẫu (Tùy chọn nhưng khuyên dùng):**
   ```bash
   npm run seed
   ```
   *Lệnh này sẽ tạo ra các tài khoản test sẵn cho Admin, Thợ và Khách hàng.*

5. **Khởi chạy Backend:**
   ```bash
   npm start
   ```
   ✅ *Thành công: Terminal sẽ hiển thị Backend đang lắng nghe tại `http://localhost:3000`.*

---

### Bước 2: Khởi động Frontend (Giao diện Web)

Phần Frontend được code bằng HTML/CSS/JS thuần nên không cần cài đặt package. Bạn có thể dùng **Live Server**:

1. Mở thư mục dự án bằng VS Code.
2. Cài đặt Extension **"Live Server"**.
3. Nhấn chuột phải vào tệp `fe/login/index.html` và chọn **"Open with Live Server"**.
4. Trình duyệt sẽ mở ra. Sử dụng các tài khoản mẫu để trải nghiệm (nếu đã chạy lệnh seed):
   - **Admin**: `admin@autopro.com` / `123456`
   - **Kỹ thuật viên**: `mechanic@autopro.com` / `123456`
   - **Khách hàng**: `customer@autopro.com` / `123456`

*(Lưu ý: Mọi tài khoản sau khi đăng nhập thành công sẽ tự động được hệ thống chuyển hướng về đúng giao diện Portal của role tương ứng)*

## 📡 Tài Liệu API (Endpoints)

Đa số các API đều yêu cầu xác thực qua Header `Authorization: Bearer <token>` và được bảo vệ theo role (RBAC).

### 🔐 Authentication (`/api/auth`)
- `POST /login`: Xác thực và nhận Token.
- `POST /register`: Tạo tài khoản Khách hàng.
- `POST /register-staff`: (Admin Only) Tạo tài khoản cho nhân sự hệ thống.
- `GET /users`, `DELETE /users/:id`: (Admin Only) Quản lý tài khoản.

### 🚗 Vehicles (`/api/vehicles`)
- `GET /my-vehicles`: Xe thuộc về khách hàng đang đăng nhập.
- `GET /`, `POST /`, `PUT /`, `DELETE /`: (Admin Only) Quản lý hệ thống xe.

### 🛠️ Repairs (`/api/repairs`)
- `GET /my-tasks`: Phiếu sửa được giao cho Thợ đang đăng nhập.
- `GET /my-repairs`: Phiếu sửa xe của Khách đang đăng nhập.
- `PUT /:id/items/:itemId/toggle`: (Admin/Mechanic) Cập nhật trạng thái từng hạng mục sửa.
- `POST /`, `DELETE /`: (Admin Only) Tạo/Xóa phiếu sửa chữa.

### 📦 Inventory & 👷 Mechanics
- `/api/inventory` & `/api/mechanics`: Các tác vụ Read (GET) cho phép Admin/Mechanic truy cập, các thao tác thay đổi (POST, PUT, DELETE) chỉ dành cho Admin.

## 🤝 Hướng Dẫn Đóng Góp (Contributing)

Chúng tôi hoan nghênh mọi đóng góp từ cộng đồng! Vui lòng đọc file `CONTRIBUTING.md` để biết chi tiết.

## 📄 Bản Quyền (License)

Dự án này được phân phối dưới giấy phép **MIT License**. Bạn được tự do sử dụng, sửa đổi và phân phối.

---
<p align="center">Được phát triển với sự tỉ mỉ dành cho hệ thống dịch vụ ô tô chuẩn tương lai. 🚀</p>
