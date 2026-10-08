# GarageCar — Quản lý garage ô tô

FastAPI + SQLAlchemy async + PostgreSQL; frontend HTML/CSS/JavaScript thuần và PWA cho quản trị, cố vấn dịch vụ, kế toán, nhân sự, thợ và khách hàng.

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
if (!(Test-Path be/.env)) { Copy-Item be/.env.example be/.env }
notepad be/.env
```

Nội dung sau được lưu **trong file `be/.env`**, không dán vào PowerShell. Thay `USER`, `PASSWORD` bằng tài khoản PostgreSQL đang dùng và thay `JWT_SECRET` bằng chuỗi bí mật riêng:

```dotenv
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@localhost:5432/garagecar
JWT_SECRET=replace-with-a-long-random-secret
PORT=8000
AI_PROVIDER=mock
```

Lỗi `DATABASE_URL=... is not recognized` xuất hiện khi chạy nội dung `.env` như lệnh PowerShell. Backend tự đọc `be/.env`; lưu file rồi khởi động server. Nếu cần đặt biến tạm cho phiên PowerShell thì cú pháp là `$env:PORT = "8000"`. Mật khẩu kết nối là mật khẩu tài khoản PostgreSQL, không phải mật khẩu mở pgAdmin.

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

Hoặc dùng script khởi động ở thư mục gốc:

```powershell
.\start.cmd
```

Mở trình duyệt:

| Trang | URL |
|---|---|
| Trang chủ / đặt lịch | http://localhost:8000 |
| Đăng nhập | http://localhost:8000/login |
| Admin | http://localhost:8000/admin |
| Thợ | http://localhost:8000/mechanic |
| Khách hàng | http://localhost:8000/customer |
| Cố vấn dịch vụ | http://localhost:8000/advisor |
| Kế toán | http://localhost:8000/accountant |
| Nhân sự | http://localhost:8000/hr |
| Tài liệu API | http://localhost:8000/docs |

Tài khoản demo: `admin@autopro.com`, `mechanic@autopro.com`, `customer@autopro.com` — mật khẩu `123456`.

`start.cmd` ưu tiên Python trong `.venv/Scripts`. Trên máy hiện tại, script cũng hỗ trợ runtime Python của pgAdmin với thư viện đã cài riêng trong `.venv/Lib/site-packages`; không cài thư viện vào thư mục pgAdmin. Frontend được FastAPI phục vụ trực tiếp, không cần Live Server.

## Các phân hệ admin

Admin dùng chung bố cục: tiêu đề và thao tác chính, thẻ số liệu, bộ lọc, bảng dữ liệu và form chi tiết. Giao diện tự chuyển cột trên màn hình nhỏ; bảng rộng có thể cuộn ngang.

| Phân hệ | Chức năng hiện có |
|---|---|
| Tiếp nhận & Lịch hẹn | Tìm xe, tiếp nhận lại, liên kết tài khoản khách, xem lịch sử sửa, giao xe sau thanh toán; xác nhận/hủy yêu cầu đặt lịch từ trang chủ. |
| Sửa chữa & Dịch vụ | Thống kê theo trạng thái, tìm phiếu/lọc thợ, tạo phiếu nhiều hạng mục và số lượng vật tư, sửa phiếu chờ, phân công, checklist tiến độ, xem chi tiết và chuyển đến mục Thu tiền. |
| Kho & Dữ liệu | Tổng mã vật tư/số lượng/giá trị theo đơn giá; tìm kiếm, lọc sắp hết/hết hàng; nhập mới hoặc nhập thêm, sửa tên/đơn giá, nhật ký nhập–xuất–hoàn kho. Thêm/sửa/xóa hiệu xe và tiền công; giới hạn tiếp nhận mỗi ngày. |
| Tài chính · Thu tiền | Phân biệt số tiền chờ thu và đã thu; chọn phiếu hoàn thành, kiểm tra hạng mục, xác nhận nhận đủ tiền; tra cứu lịch sử, xem và in lại phiếu thu. |
| Báo cáo & Thống kê | Chọn tháng, doanh thu thực thu, số phiếu, bình quân mỗi phiếu, số hiệu xe; biểu đồ/cơ cấu doanh thu, bảng chi tiết và xuất CSV. |
| Quản trị Nhân sự | Tìm/lọc kỹ thuật viên và tài khoản theo vai trò, trạng thái; tạo tài khoản khách hàng/thợ/admin/cố vấn/kế toán/nhân sự, liên kết xe hoặc hồ sơ thợ; sửa tên/email, khóa/mở khóa, đặt lại mật khẩu và xem lần đăng nhập gần nhất. Hiển thị xe chưa có tài khoản để xử lý liên kết. |

Thẻ số liệu và danh sách lấy từ API. Giao diện hiển thị trạng thái trống khi chưa có dữ liệu; không dùng doanh thu hoặc phiếu thu giả. Giá trị tồn kho là `số lượng × đơn giá hiện tại`, không phải báo cáo giá vốn kế toán.

## Khách hàng, kỹ thuật viên và trang công khai

Các trang dùng chung màu, font, nút, bảng và bố cục responsive với admin qua `fe/shared/workspace.css`.

| Trang | Chức năng |
|---|---|
| Khách hàng | Tổng quan xe, phiếu đang xử lý, tiền chờ thanh toán và đã thanh toán; tìm/lọc xe, xem lịch sử theo xe; lọc phiếu, xem tiến độ và chi phí từng hạng mục; in/lưu PDF phiếu đã thanh toán. Gửi yêu cầu đặt lịch ngay trong tài khoản. |
| Kỹ thuật viên | Thống kê phiếu chờ/đang làm/hoàn thành; tìm theo phiếu, biển số, hạng mục; lọc và sắp xếp; bắt đầu phiếu, cập nhật checklist, hoàn thành khi đủ hạng mục; tra cứu tồn kho và lọc sắp hết/hết hàng. |
| Trang chào đón | Giới thiệu quy trình, danh mục tiền công lấy từ API, form đặt lịch và lối vào không gian theo vai trò. |
| Đăng nhập / Đăng ký | Giao diện chung, hiện/ẩn mật khẩu, kiểm tra nhập lại mật khẩu, tự điền email sau đăng ký; giữ phân quyền và giới hạn đăng nhập từ backend. Tự đăng ký chỉ tạo khách hàng. |

Form đặt lịch ở trang chủ và trang khách hàng cùng gửi `POST /api/bookings`. Yêu cầu lưu vào PostgreSQL để admin xác nhận/hủy; gửi thành công chưa có nghĩa là lịch đã được xác nhận. Hiện chưa có API lịch hẹn riêng theo tài khoản khách, nên giao diện hiển thị mã yêu cầu để khách lưu lại.

Tiền chờ thanh toán chỉ gồm phiếu `completed`; đã thanh toán chỉ gồm `paid`. In/lưu PDF dùng hộp thoại in của trình duyệt. Phiếu đang sửa không được hiển thị như một khoản đã thu.

### Tài khoản cho từng vai trò

- **Khách hàng:** tự đăng ký hoặc được admin tạo tài khoản. Khi tạo trong admin có thể chọn một/nhiều xe chưa liên kết; tài khoản có sẵn được liên kết tại Tiếp nhận.
- **Kỹ thuật viên:** nút Thêm kỹ thuật viên mở luồng tạo tài khoản và hồ sơ cùng lúc; có thể chọn hồ sơ cũ chưa liên kết. Từ nút Tài khoản tại hồ sơ thợ có thể cấp tài khoản ngay, tránh trùng nhân sự. Thông tin điện thoại, chuyên môn được bổ sung tại Sửa hồ sơ.
- **Quản trị viên:** admin đang đăng nhập cấp tài khoản quản trị khác. Đăng ký công khai chỉ tạo khách hàng.
- Các vai trò có nút **Tài khoản của tôi** để xem thông tin và đổi mật khẩu bằng mật khẩu hiện tại. Đổi mật khẩu kết thúc các phiên đăng nhập và yêu cầu đăng nhập lại.
- Admin quản lý thông tin, trạng thái và đặt lại mật khẩu tại **Quản trị Nhân sự → Tài khoản**. Khóa tài khoản giữ nguyên hồ sơ/lịch sử và thu hồi phiên cũ; không tự thay trạng thái hồ sơ nhân sự. Không thể tự khóa tài khoản đang sử dụng. Vai trò được giữ cố định sau khi tạo để bảo toàn các liên kết dữ liệu.
- Email phải do chủ tài khoản cung cấp. Không tự tạo email hoặc ghép danh tính từ tên của hồ sơ cũ. Mật khẩu được băm ở backend và không xuất hiện trong danh sách tài khoản.

Thay đổi tài khoản cần migration `003_account_management` (sau `002_login_attempts`). Chạy `python be/manage.py upgrade` từ thư mục gốc để sao lưu trước khi nâng cấp. Migration giữ các tài khoản hiện tại hoạt động và bổ sung `isActive`, `sessionVersion`, `lastLoginAt`; không đổi mật khẩu hay liên kết xe cũ.

## Nâng cấp database (có dữ liệu cũ)

```powershell
python be/manage.py upgrade
```

Lệnh tự động backup PostgreSQL vào `.backups/` trước khi chạy Alembic. Nếu backup thất bại, migration không chạy.

Kiểm tra các liên kết còn thiếu sau nâng cấp:

```powershell
python be/manage.py audit
```

Database cũ dùng họ tên để ghép tài khoản nên cần xác nhận lại liên kết:

1. Tiếp nhận → Sửa xe → chọn tài khoản khách hàng theo email.
2. Nhân sự → Tài khoản tại hồ sơ kỹ thuật viên → chọn tài khoản thợ.
3. Sửa chữa → Sửa/Phân công/Liên kết thợ → chọn đúng hồ sơ cho phiếu cũ.

Xe khách vãng lai và hồ sơ thợ chưa có tài khoản có thể để trống liên kết. Migration không đoán danh tính từ tên, không trừ kho hồi tố và không thay tổng tiền của phiếu đã thu. Xem [thiết kế dữ liệu và hướng dẫn chuyển đổi](docs/DATA_WORKFLOW.md).

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
- **Tự động làm mới:** Các portal polling mỗi 20 giây và đồng bộ qua `localStorage` khi có thao tác ghi; trì hoãn cập nhật khi đang nhập liệu/mở form, không tải lại toàn trang.
- **Tính tiền:** Backend lấy giá vật tư từ kho và tính `số lượng × đơn giá + tiền công hạng mục`. Giá/tên trên phiếu là thông tin lưu tại thời điểm lập phiếu; sửa đơn giá danh mục không thay đổi phiếu đã lập.
- **Nhân sự:** Không thể ngừng hoạt động thợ còn phiếu chờ/đang sửa. Sửa hồ sơ hoặc trạng thái không làm mất liên kết tài khoản.
- **Lưu lịch sử:** Chỉ xóa phiếu chưa bắt đầu; xe và vật tư có lịch sử được bảo vệ. Hệ thống hiện thu đủ tiền một lần cho mỗi phiếu, chưa có trả góp/thanh toán một phần/hoàn tiền.

## Kiểm thử

Backend (cần PostgreSQL, tạo schema test ngẫu nhiên, tự dọn sau khi xong):

```powershell
pip install -r be/requirements-dev.txt
cd be
python -m pytest tests -q
```

Frontend (DOM + API giả lập):

```powershell
npm.cmd ci
npm.cmd test
```

Kiểm thử frontend chạy HTML và JavaScript thật trong jsdom, với dữ liệu API giả lập; kiểm tra form, bộ lọc, payload, thu tiền và báo cáo. Đây không phải kiểm thử bố cục bằng trình duyệt thật.

## Cấu trúc

```
be/
  models/          # ORM: User, Vehicle, RepairTicket, RepairItem, Inventory,
                   #       InventoryMovement, Mechanic, Booking, Settings
  schemas/         # Pydantic: validate input & shape response
  routers/         # API: auth, vehicles, repairs, inventory, mechanics,
                   #       bookings, reports, settings, ai, maintenance, service, employees
  data/            # Danh mục bộ phận và mẫu lịch có nguồn
  services/        # Sửa chữa, tính lịch bảo dưỡng và tác vụ nhắc hạn
  middleware/      # JWT auth, phan quyen role
  migrations/      # Alembic versioned migrations
  core/            # response helpers, time utils, constants
  manage.py        # CLI: upgrade (backup + migrate), audit

fe/
  shared/
    core.js        # API client, toast, auto-refresh, escape, date helpers
    portal.js      # điều hướng, tab, định dạng, tài khoản cá nhân và đổi mật khẩu
    ui.css         # style dung chung
    workspace.css  # bố cục, màu, font và thành phần chung của ba vai trò
    portals.css    # checklist, tiến độ, chi tiết phiếu
    public.css     # trang chào đón và khung đăng nhập
    booking.js     # form đặt lịch dùng chung cho trang chủ và khách hàng
  admin/           # portal quản trị
  mechanic/        # portal tho (tasks, inventory)
  customer/        # portal khách: xe cá nhân, tiến độ và lịch sử sửa
  advisor/         # portal cố vấn riêng
  accountant/      # portal kế toán riêng
  hr/              # portal nhân sự riêng
  staff/           # adapter giao diện dùng chung và chuyển vai trò cũ
  manifest.webmanifest # PWA dùng chung
  service-worker.js    # Cache giao diện công khai
  login/           # trang dang nhap
  index.html       # trang chu + form dat lich
```

## Bảo dưỡng, quy trình gara và PWA (bản 3)

Đã triển khai [nghiên cứu 41 nhóm bộ phận và 15 hãng xe](docs/BAO_DUONG_VA_VAN_HANH.md), gồm cách kiểm tra, vật tư liên quan, nguồn hãng và giới hạn từng cấu hình. Admin/khách/thợ đều có **Bảo dưỡng & Nhắc hạn** và **Báo giá / Kiểm tra kỹ**.

| Vị trí | Quyền và màn hình |
|---|---|
| Quản trị | Các phân hệ hiện có; nhập/xác minh lịch hãng; điều phối, báo giá, nghiệm thu; cấp tài khoản 6 vai trò và khóa chức năng; hồ sơ mọi vị trí |
| Cố vấn dịch vụ (`advisor`) | `/advisor`: tiếp nhận, lịch hẹn, liên kết khách, kiểm tra đầu vào, báo giá, phân công, hồ sơ bảo dưỡng, kiểm tra nhắc hạn, nghiệm thu/giao xe |
| Kế toán (`accountant`) | `/accountant`: thu đủ tiền một lần, phiếu thu có phương thức/người nhận/mã giao dịch, đề nghị chi và chi sau duyệt, doanh thu theo tháng/quý/năm; không sửa nội dung phiếu, xuất kho hoặc cấp tài khoản |
| Nhân sự (`hr`) | `/hr`: hồ sơ/liên hệ/bộ phận/vị trí/ngày vào làm, phân ca, duyệt nghỉ và xác minh/thu hồi chứng chỉ; không cấp quyền hoặc đặt lại mật khẩu |
| Thợ | `/mechanic`: chẩn đoán lượt được giao, checklist có ảnh kết quả, ảnh bao bì và mã sản phẩm, tra vật tư; đọc hồ sơ bảo dưỡng/nhắc hạn của xe được giao |
| Khách | `/customer`: xe cá nhân, lịch bảo dưỡng, thông báo trong app, duyệt/từ chối đúng phiên bản báo giá, tiến độ, chi phí và đặt lịch |

**Luồng mới:** kiểm tra đầu vào → khách xác nhận sơ bộ → thợ kiểm tra kỹ → báo giá chính thức → khách duyệt → tạo phiếu/xuất kho → thợ hoàn thành → cố vấn nghiệm thu → kế toán thu tiền → giao xe. Nếu xác nhận tại quầy/điện thoại, cố vấn phải ghi căn cứ khách xác nhận. Báo giá lưu từng phiên bản và chưa trừ vật tư; đổi giá, thiếu tồn hoặc xác nhận lỗi thời sẽ chặn chuyển phiếu. Phiếu theo báo giá không sửa các dòng khách đã duyệt. Phiếu cũ không bị dựng lịch sử phê duyệt hay nghiệm thu hồi tố.

**Lịch bảo dưỡng:** hồ sơ phải khớp hãng/dòng/năm/động cơ/hộp số/thị trường/điều kiện dùng. Cố vấn lập lịch nháp kèm nguồn/trang/phiên bản; admin xác minh trước khi áp dụng. Có mốc đầu, mốc lặp theo km/tháng; kiểm tra không reset lịch thay. Mốc lặp chưa biết hiện “Cần xác minh”. ODO cũ trên 90 ngày được đánh dấu để cập nhật.

**Nhắc hạn:** tác vụ server quét mỗi 5 phút, có thể quét thủ công; hàng đợi không tạo trùng trong cùng chu kỳ. Cố vấn xem lại lịch sử/ODO rồi gửi thông báo vào app của chủ xe đã liên kết. Đây là thông báo trong ứng dụng, chưa phải push/SMS/email khi đóng app.

**Cài PWA:** Chrome Android chọn **Cài AutoPro**; Safari iPhone chọn **Chia sẻ → Thêm vào Màn hình chính**. Trên điện thoại cần địa chỉ HTTPS; HTTP localhost dùng để thử trên máy chạy server. Manifest và service worker dùng chung các portal; chỉ cache file giao diện công khai, không cache API có dữ liệu cá nhân và không gửi lại giao dịch khi mất mạng. Xem [yêu cầu cài PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

**Database:** migration `004_garage_care` thêm 7 bảng cho lịch/lịch sử/nhắc hạn/lượt dịch vụ/báo giá/nhân sự; thêm `users.disabledPermissions` và `repair_tickets.serviceVisitId`. Với database đã có dữ liệu, chạy:

```powershell
cd be
python manage.py upgrade
```

Lệnh yêu cầu `pg_dump` trong PATH và backup thành công trước khi migrate. Sau đó khởi động lại server. Không có lịch hãng được tự duyệt hoặc gán vào xe cũ; mẫu nghiên cứu khác thị trường vẫn là mẫu nháp cần kiểm tra.

Xem [bản thiết kế gốc](docs/NGHIEN_CUU_NANG_CAP_GARAGE.md) và [dữ liệu nghiên cứu trước](docs/research/maintenance-reference.json). Hóa đơn điện tử, tính lương, mã phụ tùng theo VIN, thanh toán một phần và push nền chưa triển khai.

## Nghiệp vụ chuyên sâu (08/10/2026)

Ba portal `/advisor`, `/accountant`, `/hr` có menu riêng; `/staff` chuyển về vai trò hiện tại. Phân quyền API và khóa tính năng vẫn do backend kiểm soát.

- **Thợ:** khi xác nhận một hạng mục phải gửi ảnh kết quả và ghi chú. Có vật tư thì thêm ảnh bao bì, mã sản phẩm/SKU hoặc barcode, số lô nếu có. Mở lại hạng mục cần ảnh mới; ảnh cũ giữ lịch sử. Khách, thợ phụ trách, cố vấn và quản trị có quyền xem ảnh; kế toán/nhân sự không truy cập ảnh.
- **Kho:** Sửa vật tư để nhập SKU thật, barcode, hãng sản xuất và cờ cao áp. Nút Tương thích quản lý hãng/dòng/năm/động cơ và nguồn xác nhận; cấu hình đã khai báo không khớp hồ sơ xe sẽ chặn xuất vật tư.
- **Kế toán:** phiếu thu mới lưu người nhận, phương thức và mã giao dịch. Đề nghị chi có số chứng từ duy nhất; quản trị duyệt, người lập không tự duyệt; chỉ chi một lần sau duyệt.
- **Nhân sự:** phân ca không trùng, xử lý nghỉ phép có kiểm tra ca, xác minh chứng chỉ có đơn vị cấp/mã/thời hạn và thu hồi có căn cứ. Vật tư cao áp yêu cầu hồ sơ an toàn EV còn hiệu lực; hồ sơ không thay thế đào tạo thực tế.
- **Cố vấn:** xem bằng chứng khi nghiệm thu; ghi nhận phản hồi sau bàn giao, đánh giá, ngày gọi lại hoặc yêu cầu kiểm tra lại.
- **Danh mục:** 15 hãng, 100 dòng xe, 41 nhóm bộ phận, có VinFast. Bộ lọc theo dòng/hệ truyền động tách VF thuần điện khỏi Fadil/Lux/President có động cơ đốt trong. Gợi ý nhóm bộ phận không phải mã OEM hoặc lịch thay đã được hãng duyệt.

Cần migration `005_professional_workflow` và `006_car_brands` (bổ sung hãng vào danh mục database, giữ hãng cũ). Chạy `python be/manage.py upgrade` để sao lưu và nâng cấp, rồi khởi động lại server. Phiếu/lịch sử cũ giữ nguyên; không tự tạo thông tin thanh toán, mã phụ tùng hoặc chứng chỉ cho dữ liệu cũ.

Ảnh được lưu riêng trong PostgreSQL, cùng giao dịch và backup; không có URL công khai, không cache trong PWA. File sau nén tối đa 3 MB, server kiểm tra ảnh thật, bỏ EXIF và giới hạn kích thước. Xem [hướng dẫn nghiệp vụ và nguồn nghiên cứu](docs/NGHIEP_VU_CHUYEN_SAU.md). Chưa có OCR, quét barcode tự động, hóa đơn điện tử, tính lương, chấm công, chốt quỹ hoặc đặt phụ tùng tự động theo VIN.
