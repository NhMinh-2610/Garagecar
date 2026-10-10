# Docker và demo trên Windows

Phương án demo: **Docker Desktop → PostgreSQL + FastAPI + Nginx**, truy cập chung tại `http://localhost:3000`. Không cần chạy Uvicorn hoặc PostgreSQL trên máy cho bộ Docker này. Node.js chỉ dùng để kiểm thử frontend.

## 1. Khởi động

Cài [Docker Desktop cho Windows](https://docs.docker.com/desktop/setup/install/windows-install/), bật WSL 2/Linux containers và đợi Docker Engine chạy. Trong PowerShell tại thư mục gốc project:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1
```

Script tạo `be/.env` với JWT secret ngẫu nhiên **chỉ khi file chưa tồn tại**, build image, chờ các dịch vụ healthy rồi tạo dữ liệu demo. Lần đầu cần Internet để tải image và thư viện. Những lần sau Docker dùng lại các lớp đã build. Seed demo chạy lặp không tạo lại bộ dữ liệu đã đánh dấu.

Nếu đã có `be/.env`, script giữ nguyên file; kiểm tra JWT secret riêng và đặt `AI_PROVIDER=mock` khi muốn demo không gọi dịch vụ AI trả phí. Để chạy mà không seed: thêm `-NoSeed`.

Mở **[ứng dụng](http://localhost:3000)**. Email demo: `{role}.demo@autopro.com`, role gồm `admin`, `advisor`, `accountant`, `hr`, `mechanic`, `customer`; mật khẩu `Demo123456!`. Xem [kịch bản dữ liệu mẫu](demo-data.md).

Có thể dùng lệnh Docker trực tiếp sau khi chuẩn bị `.env`:

```powershell
docker compose up --build -d --wait --wait-timeout 180
docker compose exec -T backend python seed.py --demo
docker compose ps
```

## 2. Cổng và database

| Địa chỉ                 | Mục đích                                        |
| ----------------------- | ----------------------------------------------- |
| `http://localhost:3000` | Web và API qua Nginx; dùng địa chỉ này khi demo |
| `http://127.0.0.1:8001` | Backend trực tiếp; Swagger tại `/docs`          |
| `127.0.0.1:5434`        | Kết nối pgAdmin đến PostgreSQL Docker           |
| `/api/health`           | Kiểm tra API đang chạy                          |
| `/api/ready`            | Kiểm tra kết nối database; lỗi trả HTTP 503     |

Trong pgAdmin tạo connection với host `127.0.0.1`, port `5434`, database/user/password đều là `garagecar`. Đây là tài khoản **demo local**. Cổng PostgreSQL/API chỉ bind loopback; cổng web 3000 cho phép điện thoại trong LAN truy cập nếu Windows Firewall cho phép.

**Database Docker và PostgreSQL cài trên Windows là hai database riêng.** Dữ liệu hiện có ở bản Windows không tự chuyển sang Docker. Compose ghi đè `DATABASE_URL` trong container để kết nối `db:5432`, giữ PostgreSQL Windows nguyên trạng. Nếu cần chuyển dữ liệu, backup bằng pgAdmin rồi thử restore vào database riêng trước; xem [vận hành](operations.md).

Nếu cổng đang bận, đặt biến cho phiên PowerShell rồi chạy script:

```powershell
$env:WEB_PORT = "3001"
$env:API_PORT = "8002"
$env:DB_PORT = "5435"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1
```

Backend trong Docker vẫn dùng `db:5432`; không sửa URL nội bộ theo cổng host.

## 3. Mở trên điện thoại và cài PWA

**Cùng Wi-Fi/LAN:** chạy `ipconfig`, lấy IPv4 của adapter đang dùng rồi mở `http://IP_MAY_TINH:3000` trên điện thoại. Cho phép cổng 3000 trên mạng Private trong Windows Firewall khi cần. HTTP qua IP dùng để xem web; cài PWA/camera cần môi trường HTTPS được trình duyệt chấp nhận.

**Demo qua HTTPS, kể cả ngoài mạng LAN:** dùng một Cloudflare Quick Tunnel tạm thời. Lệnh sau chỉ công khai cổng web khi bạn tự chạy, không công khai PostgreSQL:

```powershell
docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:3000
```

Mở URL `https://....trycloudflare.com` được in trong terminal trên điện thoại. Android: menu trình duyệt → Cài đặt ứng dụng; iPhone/Safari: Chia sẻ → Thêm vào Màn hình chính. Giữ terminal tunnel và Docker đang chạy; `Ctrl+C` dừng URL. Nếu đổi `WEB_PORT`, sửa port trong lệnh tunnel.

Quick Tunnel dành cho thử nghiệm, URL thay đổi mỗi lần chạy và không bảo đảm uptime; người có URL có thể truy cập trang đăng nhập. Chỉ đưa bộ dữ liệu demo lên đường dẫn tạm này. Xem [hướng dẫn chính thức và giới hạn](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

PWA cần mạng để đọc/ghi dữ liệu cá nhân; chưa có công việc offline hoặc push khi đóng app. Khi URL tunnel đổi, hãy mở/cài từ URL mới. Máy tính tắt/ngủ hoặc Docker dừng thì web không còn phục vụ.

## 4. Kiểm tra và vận hành demo

```powershell
docker compose ps
docker compose logs --tail 100 backend frontend
python scripts/smoke-test.py --demo
```

Nếu Python không có trong PATH, dùng `.\.venv\Scripts\python.exe scripts/smoke-test.py --demo` hoặc `py scripts/smoke-test.py --demo`. Với cổng khác, thêm `--url http://localhost:3001`. Script kiểm tra HTTP thật, đăng nhập và đọc API theo sáu vai trò; không tạo phiếu, thu tiền hoặc sửa dữ liệu nghiệp vụ. Bỏ `--demo` để chỉ kiểm tra tài nguyên công khai/readiness.

Sau khi sửa code:

```powershell
docker compose up --build -d --wait --wait-timeout 180
```

Frontend được mount chỉ đọc từ `fe/`; backend cần rebuild để nhận code Python mới. Compose khởi động lại Nginx sau khi cập nhật backend để nhận đúng địa chỉ container. Khi chỉ đổi cấu hình Nginx, chạy `docker compose restart frontend`. Không dùng `--reload` trong Docker để tránh quét OneDrive liên tục. Nginx nén CSS/JS/JSON; API không cache, các file giao diện được kiểm tra lại để tránh phiên bản cũ. Giữ một worker backend cho demo vì giới hạn AI và tác vụ nhắc hạn hiện nằm trong từng tiến trình.

Dừng dịch vụ mà giữ dữ liệu:

```powershell
docker compose down
```

Volume `pgdata` giữ dữ liệu PostgreSQL. Không dùng `down --volumes` hoặc prune volume khi cần giữ dữ liệu.

## 5. Backup Docker

Không chuyển file dump nhị phân qua toán tử `>` của Windows PowerShell 5.1. Tạo dump trong container rồi copy ra:

```powershell
New-Item -ItemType Directory -Force .backups | Out-Null
$backupName = "garagecar-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
docker compose exec -T db pg_dump -U garagecar -d garagecar -Fc -f /tmp/garagecar.dump
if ($LASTEXITCODE -ne 0) { throw "Backup failed" }
docker compose cp db:/tmp/garagecar.dump ".backups/$backupName"
```

Giữ thêm bản backup ngoài máy và thử Restore bằng pgAdmin vào database thử riêng. Ảnh đang lưu trong PostgreSQL nên dump bao gồm ảnh. Compose local tự chạy migration trước API; nếu database Docker đã dùng thật, backup và dừng thao tác ghi trước khi nâng cấp.

## 6. Khi cần web chạy liên tục

Demo Windows phù hợp trình bày và thử nghiệm. Để phục vụ khách ổn định, đưa hệ thống lên server luôn hoạt động, có hostname HTTPS cố định, thông tin đăng nhập riêng, backup/restore và giám sát. Không dùng tài khoản/mật khẩu Docker demo khi triển khai Internet. Tách cấu hình production, đóng cổng database/API và giữ code trong image theo [hướng dẫn Docker](https://docs.docker.com/compose/how-tos/production/); có thể đặt [Caddy để quản lý HTTPS](https://caddyserver.com/docs/automatic-https) trước backend.

Xem [báo cáo kiểm tra](verification.md), [vận hành](operations.md) và [phạm vi còn thiếu](roadmap.md) trước khi mở cho khách thật.
