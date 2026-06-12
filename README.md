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
- **API Backend Mạnh Mẽ**: Sử dụng Express.js và Sequelize ORM (SQLite) được bảo vệ chặt chẽ bằng Role-Based Access Control (RBAC).

## 🏗️ Cấu Trúc Dự Án

Dự án được tổ chức chặt chẽ theo mô hình Client-Server:

```text
AutoPro_Garage/
├── be/                     # Backend Server (Node.js/Express)
│   ├── config/             # Cấu hình kết nối cơ sở dữ liệu
│   ├── constants/          # Định nghĩa phân quyền (roles) & mã lỗi
│   ├── db/                 # Khởi tạo SQLite
│   ├── middleware/         # Xác thực JWT & phân quyền (requireRole)
│   ├── models/             # Sequelize ORM models
│   ├── routes/             # RESTful API Endpoints
│   ├── scripts/            # Script tạo dữ liệu mẫu (Seed Data)
│   ├── utils/              # Tiện ích (Logger, Validation, Response)
│   ├── server.js           # Entry point của Backend
│   └── package.json        # Dependencies
└── fe/                     # Frontend Client (HTML/CSS/JS thuần)
    ├── admin/              # Portal dành cho Quản Trị Viên
    ├── mechanic/           # Portal dành cho Kỹ Thuật Viên
    ├── customer/           # Portal dành cho Khách Hàng
    ├── login/              # Trang Đăng nhập & Điều hướng tự động (Smart Routing)
    └── index.html          # Trang chủ / Landing Page
```

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

Ứng dụng được chia làm 2 phần độc lập: **Backend** (Xử lý dữ liệu & API) và **Frontend** (Giao diện người dùng). Bạn cần chạy đồng thời cả 2 phần để hệ thống hoạt động.

### 📋 Yêu cầu hệ thống
- **Node.js**: Phiên bản v16.x trở lên.
- **NPM**: Cài đặt kèm theo Node.js.
- **Lưu ý cho người dùng WSL (Windows):** Vui lòng chạy lệnh cài đặt (`npm install`) ngay bên trong môi trường WSL. Không copy thư mục `node_modules` từ Windows sang WSL để tránh lỗi tệp thực thi.

---

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
