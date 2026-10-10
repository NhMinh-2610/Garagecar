# GarageCar · AutoPro

Ứng dụng quản lý garage ô tô vừa và lớn, kết nối tiếp nhận, xưởng, kho, tài chính, nhân sự và khách hàng trên cùng dữ liệu. **GarageCar** là tên project; **AutoPro** là tên hiển thị trên giao diện.

Khách hàng và kỹ thuật viên có thể cài PWA từ trình duyệt điện thoại. Quản trị viên, cố vấn, kế toán và nhân sự có các portal riêng, dùng chung hệ thống tài khoản và phân quyền.

## Chức năng chính

| Nhóm                | Nội dung                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Tiếp nhận & dịch vụ | Lịch hẹn, hồ sơ xe, kiểm tra đầu vào, báo giá theo phiên bản, khách duyệt, nghiệm thu và giao xe                 |
| Xưởng & kho         | Phiếu sửa, phân thợ, checklist, ảnh hoàn thành, ảnh bao bì và mã vật tư, nhập/xuất kho, cấu hình tương thích     |
| Bảo dưỡng           | 41 nhóm bộ phận, 15 hãng và 100 dòng xe, gồm VinFast; lịch theo cấu hình xe, nguồn xác minh và hàng đợi nhắc hạn |
| Tài chính & báo cáo | Thu tiền phiếu hoàn thành, đề nghị/duyệt chi, báo cáo doanh thu theo kỳ                                          |
| Nhân sự & tài khoản | Hồ sơ, phân ca, nghỉ phép, chứng chỉ; cấp tài khoản, khóa chức năng và thu hồi phiên đăng nhập                   |
| Hỗ trợ khách hàng   | Hỏi AI về xe, tùy chọn chia sẻ lịch sử xe; nhắn trực tiếp garage, phân công cố vấn và theo dõi tin chưa đọc      |

Giao diện dùng chung bố cục, điều hướng theo nhóm công việc, bảng phân trang và biểu mẫu. Đồng bộ dữ liệu không tải lại trang và trì hoãn cập nhật khi người dùng đang nhập liệu.

**Tạo phiếu:** chọn **Mở hồ sơ dịch vụ** trên xe hoặc **Tạo phiếu sửa** trong Xưởng. Giao diện hướng dẫn bước tiếp theo, điền tiền công từ bảng giá và cho dùng lại hạng mục báo giá; xem [hướng dẫn thao tác](docs/workflows.md#thao-tác-tạo-phiếu-trên-giao-diện).

## Công nghệ

| Thành phần | Giải pháp trong code                                              |
| ---------- | ----------------------------------------------------------------- |
| Backend    | Python 3.11+, FastAPI, SQLAlchemy async, Pydantic                 |
| Dữ liệu    | PostgreSQL, asyncpg, Alembic; pgAdmin 4 dùng để quản trị database |
| Frontend   | HTML, CSS, JavaScript thuần; Chart.js và Font Awesome             |
| Xác thực   | JWT, mật khẩu Argon2, quyền theo vai trò và chức năng             |
| AI         | Mock để demo; adapter OpenAI, Gemini hoặc Ollama qua cấu hình     |
| Kiểm tra   | Pytest, Node test runner + jsdom, Ruff, Prettier                  |

## Chạy nhanh trên Windows

**Demo bằng Docker Desktop:** bật Docker Engine rồi chạy lệnh sau tại thư mục gốc; script build, chờ dịch vụ sẵn sàng và tạo dữ liệu mẫu:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1
```

Mở `http://localhost:3000`. Database Docker riêng, không tự dùng dữ liệu PostgreSQL trên máy. Hướng dẫn pgAdmin, điện thoại/HTTPS, backup và xử lý cổng nằm tại [Docker và demo Windows](docs/deployment.md).

**Chạy bằng Python và PostgreSQL trên máy:**

Cần Python 3.11+ và một database PostgreSQL đang chạy. Các lệnh dưới đây chạy tại thư mục gốc project:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r be/requirements.txt
if (!(Test-Path be/.env)) { Copy-Item be/.env.example be/.env }
notepad be/.env
```

Sửa `DATABASE_URL` theo tài khoản, mật khẩu, port PostgreSQL thực tế và đặt `JWT_SECRET` riêng. Nội dung `.env` được lưu trong file, không chạy như lệnh PowerShell.

**Với database mới, chưa có dữ liệu:**

```powershell
.\.venv\Scripts\python.exe -m alembic -c be/alembic.ini upgrade head
.\.venv\Scripts\python.exe be/seed.py --demo
.\start.cmd --reload
```

**Với database đã có dữ liệu:** dùng quy trình [backup và nâng cấp](docs/operations.md) trước khi khởi động.

Mở [ứng dụng](http://localhost:8000), [đăng nhập](http://localhost:8000/login) hoặc [API docs](http://localhost:8000/docs). Script `start.cmd` luôn dùng Python của `.venv`; hướng dẫn chạy thủ công và xử lý lỗi có trong [cài đặt](docs/setup.md).

## Tài khoản demo

Sau khi chạy `seed.py --demo`, đăng nhập bằng email `{role}.demo@autopro.com`, với `role` là `admin`, `advisor`, `accountant`, `hr`, `mechanic` hoặc `customer`. Mật khẩu ban đầu của cả 6 tài khoản: **`Demo123456!`**.

Dữ liệu demo được đánh dấu và tạo một lần, không ghi đè dữ liệu có sẵn. Xem [danh sách tài khoản và kịch bản demo](docs/demo-data.md). `AI_PROVIDER=mock` là phản hồi mô phỏng, chưa phải LLM thật.

Xe và các hồ sơ nghiệp vụ demo được lưu trong PostgreSQL. Thư viện tham khảo bảo dưỡng đọc từ JSON; số liệu bảng điều hành được tổng hợp từ API. Xem [nguồn dữ liệu hiển thị](docs/architecture.md#nguồn-dữ-liệu-hiển-thị) để phân biệt dữ liệu đã lưu, tài nguyên tham khảo và phản hồi AI.

## Tài liệu

| Tài liệu                                                     | Dùng khi                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| [Cài đặt](docs/setup.md)                                     | Cấu hình môi trường, PostgreSQL, chạy ứng dụng và xử lý lỗi |
| [Kiến trúc](docs/architecture.md)                            | Tìm vị trí code, quan hệ dữ liệu và quy tắc giao dịch       |
| [Nghiệp vụ & vai trò](docs/workflows.md)                     | Hiểu công việc của từng chức danh và luồng sửa chữa         |
| [Bảo dưỡng & nguồn nghiên cứu](docs/maintenance-research.md) | Tra phạm vi hãng xe, xác minh lịch và quản lý nhắc hạn      |
| [AI & nhắn tin](docs/ai-and-messaging.md)                    | Cấu hình AI, quyền riêng tư và hỗ trợ khách hàng            |
| [Vận hành](docs/operations.md)                               | Backup, migration, audit và kiểm tra sau nâng cấp           |
| [Dữ liệu demo](docs/demo-data.md)                            | Chuẩn bị trình bày, tài khoản và kịch bản dùng thử          |
| [Docker](docs/deployment.md)                                 | Demo Windows, điện thoại/HTTPS và hướng triển khai web      |
| [Kiểm tra chức năng](docs/verification.md)                   | Phạm vi kiểm thử, kết quả và các giới hạn đã biết           |
| [Định hướng](docs/roadmap.md)                                | Phạm vi đã làm và các phần cần phát triển tiếp              |
| [Đóng góp code](CONTRIBUTING.md) · [Git](GITHUB_GUIDE.md)    | Kiểm tra chất lượng, chia commit và review qua nhánh riêng  |

Giấy phép: [MIT](LICENSE).
