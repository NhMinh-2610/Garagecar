# 🚗 AutoPro Garage Management System

<div align="center">
  <h3>Hệ thống quản lý garage tự động với giao diện web cao cấp và API backend mạnh mẽ.</h3>
</div>

---

## 📋 Giới Thiệu

**AutoPro** là một giải pháp phần mềm quản lý garage ô tô toàn diện được thiết kế với chuẩn mực doanh nghiệp (Enterprise Standard). Hệ thống cung cấp trải nghiệm UI/UX cao cấp, tích hợp biểu đồ động, thao tác mượt mà và quản lý dữ liệu tập trung qua RESTful API.

### ✨ Các Tính Năng Nổi Bật

- **Giao Diện Cao Cấp (Premium UI/UX)**: Thiết kế Dark Mode hiện đại, sử dụng hiệu ứng Glassmorphism, animations mượt mà và phông chữ Outfit.
- **Quản Lý Phiếu Sửa Chữa Động**: Thêm công việc, vật tư, tự động tính toán tổng tiền.
- **Báo Cáo & Thống Kê**: Tích hợp Chart.js để trực quan hóa doanh thu theo hiệu xe và tháng.
- **Quản Lý Kho & Nhân Sự**: Quản lý xuất nhập phụ tùng, thợ sửa chữa.
- **API Backend Mạnh Mẽ**: Sử dụng Express.js và Sequelize ORM (SQLite).

## 🏗️ Cấu Trúc Dự Án

Dự án được tổ chức chặt chẽ theo mô hình Client-Server:

```text
AutoPro_Garage/
├── be/                     # Backend Server (Node.js/Express)
│   ├── config/             # Cấu hình kết nối cơ sở dữ liệu
│   ├── constants/          # Định nghĩa mã lỗi & trạng thái HTTP
│   ├── db/                 # Khởi tạo SQLite
│   ├── middleware/         # Xác thực JWT & phân quyền
│   ├── models/             # Sequelize ORM models
│   ├── routes/             # RESTful API Endpoints
│   ├── utils/              # Tiện ích (Logger, Validation, Response)
│   ├── server.js           # Entry point của Backend
│   └── package.json        # Dependencies
└── fe/                     # Frontend Client (HTML/CSS/JS thuần)
    ├── admin/              # Trang Dashboard Quản Trị
    │   ├── css/            # Stylesheet cao cấp cho admin
    │   ├── js/             # Logic từng module (Dashboard, Repairs, Finance, Report)
    │   └── index.html      # Giao diện chính admin
    ├── login/              # Trang Đăng nhập / Đăng ký (Giao diện động)
    │   ├── index.html
    │   └── styles.css
    ├── index.html          # Trang chủ / Landing Page
    └── styles.css          # Stylesheet trang chủ
```

## 🚀 Cài Đặt & Chạy Ứng Dụng

### Yêu cầu hệ thống

- **Node.js** (Phiên bản v14.x hoặc mới hơn)
- **NPM** (Node Package Manager)

### Bước 1: Khởi Tạo Backend

1. Di chuyển vào thư mục backend và cài đặt dependencies:
   ```bash
   cd be
   npm install
   ```

2. Cấu hình môi trường bằng cách tạo file `.env` trong thư mục `be/`:
   ```env
   PORT=3000
   JWT_SECRET=super_secret_jwt_key
   NODE_ENV=development
   ```

3. Khởi chạy máy chủ backend:
   ```bash
   npm run dev
   ```
   *Backend sẽ lắng nghe tại `http://localhost:3000`*

### Bước 2: Khởi Tạo Frontend

Frontend không yêu cầu cài đặt gói (No-build). Bạn có thể chạy bằng một trong các cách sau:

- **VS Code Live Server**: Mở `fe/index.html` và click "Go Live".
- **HTTP Server**:
  ```bash
  npx http-server fe -p 8080
  ```
- **Mở Trực Tiếp**: Mở file `fe/index.html` bằng trình duyệt web.

## 📡 Tài Liệu API (Endpoints)

Dưới đây là danh sách các API đã được chuẩn hóa. Đa số các thao tác (trừ Auth) yêu cầu token JWT qua Header `Authorization: Bearer <token>`.

### 🔐 Authentication (`/api/auth`)
- `POST /login`: Xác thực và nhận Token.
- `POST /register`: Tạo tài khoản mới.

### 🚗 Vehicles (`/api/vehicles`)
- `GET /`: Danh sách toàn bộ xe và trạng thái sửa chữa.
- `GET /my-vehicles`: Xe thuộc về user đang đăng nhập.
- `POST /`: Tiếp nhận xe mới.
- `PUT /:id` / `DELETE /:id`: Cập nhật/Xóa xe.

### 🛠️ Repairs (`/api/repairs`)
- `GET /`: Danh sách phiếu sửa chữa (để thanh toán, báo cáo).
- `POST /`: Tạo phiếu sửa chữa mới (kèm chi tiết hạng mục & vật tư).
- `PUT /:id`: Cập nhật trạng thái phiếu (ví dụ: `paid`).

### 📦 Inventory (`/api/inventory`)
- `GET /`: Xem danh sách phụ tùng tồn kho.
- `POST /`: Nhập kho mới.

### 👷 Mechanics (`/api/mechanics`)
- `GET /`: Danh sách thợ.
- `POST /`: Thêm thợ mới.
- `DELETE /:id`: Xóa thợ.

## 🤝 Hướng Dẫn Đóng Góp (Contributing)

Chúng tôi hoan nghênh mọi đóng góp từ cộng đồng! Vui lòng đọc file [CONTRIBUTING.md](CONTRIBUTING.md) để biết chi tiết về quy trình gửi Pull Request, báo cáo lỗi (Issues), và tiêu chuẩn mã nguồn.

## 📄 Bản Quyền (License)

Dự án này được phân phối dưới giấy phép **MIT License**. Bạn được tự do sử dụng, sửa đổi và phân phối. Chi tiết xem tại [LICENSE](LICENSE).

---
<p align="center">Được phát triển với sự tỉ mỉ dành cho hệ thống dịch vụ ô tô chuẩn tương lai. 🚀</p>
