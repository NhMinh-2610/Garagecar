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

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

Ứng dụng được chia làm 2 phần độc lập: **Backend** (Xử lý dữ liệu & API) và **Frontend** (Giao diện người dùng). Bạn cần chạy đồng thời cả 2 phần để hệ thống hoạt động.

### 📋 Yêu cầu hệ thống
- **Node.js**: Phiên bản v16.x trở lên.
- **NPM**: Cài đặt kèm theo Node.js.
- **Lưu ý cho người dùng WSL (Windows):** Vui lòng chạy lệnh cài đặt (`npm install`) ngay bên trong môi trường WSL. Không copy thư mục `node_modules` từ Windows sang WSL để tránh lỗi tệp thực thi (như `nodemon: not found`).

---

### Bước 1: Khởi động Backend (Máy chủ API)

1. **Mở Terminal** và di chuyển vào thư mục `be`:
   ```bash
   cd be
   ```

2. **Cài đặt thư viện (Dependencies):**
   *(Nếu bạn đang dùng WSL mà trước đó đã lỡ cài bên Windows, hãy chạy `rm -rf node_modules` trước)*
   ```bash
   npm install
   ```

3. **Tạo cấu hình môi trường:**
   Tạo một file mới tinh có tên chính xác là `.env` (có dấu chấm ở đầu) nằm trong thư mục `be`. Sau đó dán nội dung sau vào file (Tuyệt đối không dán trực tiếp lệnh này vào Terminal):
   ```env
   PORT=3000
   JWT_SECRET=super_secret_jwt_key
   NODE_ENV=development
   ```

4. **Khởi chạy Backend:**
   ```bash
   npm run dev
   ```
   ✅ *Thành công: Terminal sẽ hiển thị dòng chữ báo Backend đang lắng nghe tại `http://localhost:3000`.*

---

### Bước 2: Khởi động Frontend (Giao diện Web)

Phần Frontend được code bằng HTML/CSS/JS thuần nên không cần phải `npm install`. Bạn có thể chạy ngay bằng 1 trong 3 cách sau:

- **Cách 1: Mở trực tiếp (Dễ nhất)**
  Sử dụng File Explorer (My Computer), vào thư mục `fe` và click đúp chuột vào tệp `index.html` để mở trên trình duyệt.

- **Cách 2: Dùng VS Code Live Server (Khuyên dùng)**
  Mở thư mục dự án bằng VS Code. Cài đặt Extension **"Live Server"**. Nhấn chuột phải vào tệp `fe/index.html` và chọn **"Open with Live Server"**. Tính năng này giúp trang web tự động tải lại mỗi khi bạn sửa code.

- **Cách 3: Chạy bằng Terminal (HTTP Server)**
  Mở một tab Terminal **mới** (vẫn giữ tab Backend đang chạy), đảm bảo bạn đang ở thư mục gốc của dự án và chạy lệnh:
  ```bash
  npx http-server fe -p 8080
  ```
  ✅ *Sau đó mở trình duyệt và truy cập đường dẫn: `http://localhost:8080`*

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
