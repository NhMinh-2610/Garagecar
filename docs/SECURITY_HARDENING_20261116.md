# Bản vá bảo mật và toàn vẹn dữ liệu — 16/11/2026

Áp dụng trên checkout `2ad048c`. Checkout này có 6 vai trò và các adapter AI; bản vá giữ các chức năng hiện có. Không dùng số liệu kiểm thử của checkout đã audit trước để xác nhận phiên bản này.

## 1. Database và hạ tầng

| Thành phần | Thay đổi |
| --- | --- |
| Migration `007_request_integrity` | Thêm `request_replays`, unique `(userId, scope, key)`, hash nội dung, kết quả và HTTP status; kết quả đã hoàn thành không được sửa/xóa. Thêm `request_budgets` với khóa kép để cập nhật hạn mức bằng UPSERT nguyên tử. |
| Bằng chứng ảnh | Thêm `slot`, unique `(itemId, round, slot)`, CHECK slot 1–12 và trigger bắt buộc slot trên INSERT mới. Ảnh cũ được giữ nguyên, kể cả dữ liệu lịch sử vượt quota; không cấp thêm slot cho một vòng đã đủ ảnh. |
| Phân công | Trigger kiểm tra hồ sơ thợ/tài khoản/quyền xưởng và giữ khóa SHARE khi xác nhận điều kiện; partial unique index chặn nhiều phiếu chưa thu hoặc nhiều lượt chưa đóng trên cùng xe. |
| Migration `008_financial_audit` | Registry `expense_documents` giữ unique số chứng từ chuẩn hóa; giữ nguyên các dòng trùng cũ. Thêm snapshot phiếu thu, actor/request/lý do trong sổ kho và trigger giữ lịch sử bất biến. |
| Migration lịch sử | `001`, `004`, `005` dùng DDL đã đóng băng trong `legacy_schema.json`, không phụ thuộc ORM đang thay đổi. Không đổi revision hoặc đường nâng cấp của database cũ. |
| Nginx | Ghi đè X-Forwarded-For/X-Real-IP từ địa chỉ kết nối; rate limit riêng cho login/register/booking; lỗi 429 trả JSON và Retry-After; API no-store. |
| Docker | Chỉ tin CIDR mạng proxy cấu hình rõ; DB/API bind loopback; mạng database tách khỏi proxy. Image chạy UID 10001 và không chứa `.env`. |
| Dependency | `requirements.txt` đọc constraints `requirements.lock`; ghim cả uvloop Linux. Chuyển python-jose sang PyJWT, dùng bcrypt trực tiếp; nâng các dependency có cảnh báo. |

Migration sẽ dừng và rollback nếu dữ liệu đang mở vi phạm unique index. Không tự xóa hoặc gộp phiếu để vượt kiểm tra. Có thể kiểm tra trước bằng:

```sql
SELECT "vehicleId", array_agg(id)
FROM repair_tickets WHERE status <> 'paid'
GROUP BY "vehicleId" HAVING count(*) > 1;

SELECT "vehicleId", array_agg(id)
FROM service_visits WHERE status <> 'closed'
GROUP BY "vehicleId" HAVING count(*) > 1;
```

## 2. High/Critical

### Deadlock và quét bảo dưỡng

`record()` chỉ quét `[vehicle_id]` trong transaction đang giữ khóa xe đó. Quét toàn hệ thống đọc ID theo batch 50, dùng `FOR UPDATE SKIP LOCKED`, commit theo batch. Xe đang được cập nhật được bỏ qua trong batch nền và được chính request cập nhật đối chiếu lại; worker tiếp tục kiểm tra trong chu kỳ sau.

```diff
- await scan_reminders(db)
+ await scan_reminders(db, [vehicle_id])

- .with_for_update(of=Vehicle)
+ .with_for_update(of=Vehicle, skip_locked=skip_locked or vehicle_ids is None)
```

Code: `be/routers/maintenance.py`, `be/services/maintenance_service.py`, `be/services/reminder_worker.py`.

### Retry nhập kho và ảnh

Hai API sau bắt buộc header `Idempotency-Key` từ 8 đến 128 ký tự:

- `POST /api/inventory/{id}/receive`
- `POST /api/workshop/tickets/{ticketId}/items/{itemId}/evidence`

Một thao tác logic giữ nguyên key qua mọi lần retry. Thao tác nhập mới chủ ý phải có key mới, kể cả nội dung giống lần trước. Frontend dùng chung giữ key khi request mất response trong tab; caller bên ngoài cũng phải giữ key của thao tác. Không suy đoán thao tác trùng chỉ từ số lượng hoặc hash ảnh.

```python
operation, replay = await reserve(db, user_id, scope, key, payload)
if replay is not None:
    return replay
# Khóa và thay đổi nghiệp vụ trong cùng transaction.
finish(operation, response)
await db.commit()
return response
```

Unique index PostgreSQL xử lý cả request ở các process khác nhau. Cùng key/nội dung trả đúng kết quả cũ; cùng key/nội dung khác trả 409. Lỗi trước commit rollback cả reservation lẫn nghiệp vụ. Replay được kiểm tra trước quota ảnh nên retry vẫn thành công khi vòng đã đủ 12 ảnh. Không đặt TTL tự xóa danh tính của thao tác nhập kho đã thành công.

Code: `be/services/idempotency.py`, `be/models/request_control.py`, routers inventory/evidence và `fe/shared/core.js`.

### Proxy và JWT

```diff
+ proxy_set_header X-Forwarded-For $remote_addr;

+ FORWARDED_ALLOW_IPS: ${TRUSTED_PROXY_CIDR:-172.30.0.0/24}

- jwt_secret: str = "change_this_in_production_garagecar_2026"
+ jwt_secret: str
```

Checkout gốc của lần triển khai này chưa bật forwarding như checkout audit; cấu hình mới thiết lập đầy đủ ranh giới tin cậy thay vì chỉ bỏ wildcard. Secret thiếu, ngắn hơn 32 byte hoặc bằng giá trị mẫu làm ứng dụng từ chối khởi động. Giữ nguyên secret riêng hợp lệ để token HS256 cũ tiếp tục dùng được. Token được kiểm tra thuật toán, hạn dùng và ID; quyền/tình trạng phiên vẫn đọc từ DB.

### API công khai và công việc CPU

Budget request dùng UPSERT có unique key trong PostgreSQL, commit bộ đếm trước khi thực hiện công việc. Giới hạn đăng ký/booking/login áp dụng khi chạy trực tiếp API, bên cạnh rate limit Nginx. Giới hạn thất bại theo email được tuần tự hóa bằng advisory lock; ngưỡng IP rộng hơn email để giảm khóa oan người dùng chung NAT.

Hash/verify Argon2 và giải mã ảnh chạy ngoài event loop, có CapacityLimiter riêng. Mặc định `PASSWORD_WORKERS=2`, `IMAGE_WORKERS=2`; tăng phải dựa trên ngân sách CPU/RAM thực tế.

## 3. Medium

| Hạng mục | Cách xử lý và kiểm tra |
| --- | --- |
| Bcrypt cũ | Khai báo bcrypt 5.0.0; hỗ trợ 2a/2b/2y và ngữ nghĩa 72 byte của bcrypt cũ. Login đúng nâng sang Argon2id. Không phụ thuộc passlib có sẵn trên máy phát triển. |
| Thợ bị khóa quyền | Validator chung kiểm tra quyền workshop; API tạo phiếu, tiếp nhận, chuyển báo giá, phân công và bắt đầu đều dùng validator. Trigger DB bảo vệ cả INSERT/UPDATE trực tiếp. Resource picker cũng chỉ trả thợ đủ điều kiện. Field API hiện có là `mechanicId`. |
| Số chứng từ | Trim và từ chối chuỗi trắng ở schema. Registry giữ khóa lower/trim tại DB, trigger ngăn chèn trùng đồng thời hoặc bằng SQL trực tiếp. Số chứng từ đã tạo không được sửa/xóa làm mất dấu vết. |
| Snapshot phiếu thu | DB tạo snapshot xe/người trả tiền/hạng mục/tổng tiền khi ghi receipt; UPDATE/DELETE receipt bị chặn. Phiếu đã thu in từ snapshot. Báo cáo theo hãng ưu tiên snapshot thay cho hãng hiện tại của xe. |
| Dữ liệu cũ | Snapshot bổ sung cho receipt cũ có `legacy: true`: đó là dữ liệu quan sát lúc migration, không khẳng định khôi phục được thông tin gốc đã bị thay đổi trước đây. Chứng từ trùng cũ và số tiền được giữ nguyên. |
| Sổ kho | Ghi actor, request key nếu có, lý do điều chỉnh và tham chiếu nghiệp vụ trong cùng transaction. Điều chỉnh số lượng qua API bắt buộc lý do. UPDATE/DELETE ledger bị DB chặn; không đoán người thực hiện các dòng cũ. |
| Phân trang | Danh sách giữ `data` dạng array để giảm thay đổi hợp đồng; thêm metadata. Mặc định 100 dòng, tối đa 200, keyset cursor giảm dần theo ID. Không cắt cứng ở 100/200/500/1000 dòng. |
| Hiệu năng danh sách | Lượt dịch vụ tải xe/báo giá/trạng thái phiếu theo batch. Danh sách xe trả số phiếu và cờ chưa thanh toán; không nhúng toàn bộ lịch sử. Lịch sử được tải khi mở. Summary tài chính/kho được tổng hợp từ toàn bộ tập phù hợp, độc lập trang hiện tại. |
| UI và resource picker | Có Trang trước/Trang tiếp; tìm kiếm chính gửi lên server. Các selector cần đủ lựa chọn dùng hàm lấy lần lượt các trang theo yêu cầu. Resources có cursor riêng cho xe/thợ/vật tư và không bị tải lại toàn bộ mỗi chu kỳ đồng bộ nền. |

Ví dụ response:

```json
{
  "success": true,
  "data": [],
  "hasMore": true,
  "nextCursor": 901,
  "pageSize": 100,
  "summary": {"skuCount": 1106, "units": 5, "value": 500, "low": 1106}
}
```

Gọi trang tiếp: `GET /api/inventory?limit=100&cursor=901`. Giữ bộ lọc qua các trang. Đối với `/api/hr/operations`, ba tập dữ liệu dùng `offset/nextOffset` trong response chung; `/api/service/resources` trả `pages` và cursor riêng của từng tập. Record mới có ID lớn hơn cursor không làm lặp các trang lịch sử đã duyệt; refresh từ trang đầu để xem record mới.

## 4. Low

- Chart.js ghim 4.5.1, đường dẫn bundle rõ ràng, SHA-384 SRI và crossorigin.
- Thêm CI: PostgreSQL thử riêng, lint, pytest/JUnit, Node tests, audit dependency, build image và test bcrypt trong runtime sạch.
- README trỏ tới tài liệu này; không lấy số test của checkout khác làm số liệu phát hành.

## 5. Kết quả xác minh

| Kiểm tra | Kết quả thực chạy |
| --- | --- |
| Backend Windows/Python 3.13/PostgreSQL 16 | **38/38 đạt**; 365,37 giây |
| Frontend Node/jsdom | **26/26 đạt** |
| Container Python 3.11.18 cài từ manifest/lock, không passlib | **3/3 ca bcrypt 2a/2b/2y đạt**, nâng Argon2id và dùng token thành công |
| HTTP Nginx → Uvicorn → PostgreSQL | **2/2 đạt**; thêm kiểm tra cấu hình/SRI/CI đạt ở lượt cuối |
| Ruff, Compose config, nginx -t | Đạt |
| pip-audit trong môi trường Python sạch | **Không phát hiện lỗ hổng đã biết** sau nâng dependency; đây không phải quét OS/base image |
| Image runtime | Build thành công; UID 10001; `.env` không nằm trong image |

Image Python chính thức được lấy qua mirror Amazon ECR khi Docker Hub lỗi DNS. Image ứng dụng cục bộ dùng để kiểm chứng: `garagecar-hardening:20261116`. Không push image ra registry và không nâng cấp các container garage đang dùng.

| Edge case bắt buộc | Test chứng minh |
| --- | --- |
| Commit rồi mất response | `LostResponse` chạy app xong mới ném ReadTimeout; retry đồng thời chỉ cộng kho một lần, ảnh cùng ID và chỉ dùng một slot; retry khi đủ 12 slot vẫn trả kết quả cũ. |
| Update nhiều xe + global scan | Sáu request cùng giữ khóa sáu xe; quét global chạy khi cả sáu đang giữ khóa; toàn bộ request hoàn tất, đủ sáu bản ghi. |
| Direct API bypass | POST tạo phiếu/tiếp nhận và PUT phân công từ chối thợ khóa workshop; tồn không đổi, không có phiếu. INSERT SQL trực tiếp cũng bị chặn. |
| Clean legacy auth | Test trong container không passlib, chỉ cài manifest/lock; bcrypt các prefix cũ đều login được và đổi sang Argon2id. |
| Hơn 1.000 bản ghi | Duyệt đầy đủ 1.106 vật tư, 1.105 đề nghị chi; 1.051 xe, phiếu và lượt dịch vụ qua các trang, không trùng/mất ID. Số truy vấn mỗi trang dưới 20, không tăng theo 200 dòng. |

Test bổ sung còn kiểm tra key dùng lại với nội dung khác, quota SQL, normalized document insert đồng thời, bất biến chứng từ/ledger, giữ dữ liệu cũ qua migration chạy lại, JWT HS256 cũ, budget nguyên tử, event loop và key retry ở frontend.

Chưa chạy benchmark p95/p99 để công bố số người dùng đồng thời hỗ trợ, thử camera/PWA trên thiết bị thật hoặc diễn tập phục hồi backup trong đợt này.

## 6. Nâng cấp và chạy kiểm tra

Triển khai API và frontend cùng phiên bản: hai API ghi kể trên đã bắt buộc Idempotency-Key; client bên ngoài cần cập nhật. Các API danh sách cần đọc metadata để đi hết trang.

1. Cài dependency từ manifest/constraints. Đặt secret riêng hợp lệ nếu đang thiếu hoặc dùng mẫu; có thể tạo bằng `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
2. Tạm dừng thao tác ghi, backup và nâng cấp bằng quy trình có sẵn:

```powershell
.\.venv\Scripts\python.exe be/manage.py upgrade
.\.venv\Scripts\python.exe -m alembic -c be/alembic.ini current
```

Revision đích: `008_financial_audit`. Không chạy lệnh nâng cấp lên database đang phục vụ khách khi chưa có backup đã kiểm tra.

3. Chạy trên database kiểm thử riêng:

```powershell
.\.venv\Scripts\python.exe -m pip install -r be/requirements-dev.txt
.\.venv\Scripts\python.exe -m ruff check be
.\.venv\Scripts\python.exe -m pytest -q
npm.cmd ci
npm.cmd test
```

4. Kiểm tra container sạch:

```powershell
docker build --target runtime -t garagecar-hardening:20261116 be
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-clean-container.ps1 -DatabaseUrl '<URL PostgreSQL thử, truy cập được từ container>'
```

`scripts/test_proxy_runtime.py` chỉ chạy khi trỏ `GARAGE_PROXY_URL` và `GARAGE_PROXY_DATABASE_URL` vào stack thử riêng. File ở ngoài testpaths mặc định để không tự gửi HTTP tới dịch vụ đang dùng. Workflow CI tự chạy khi push hoặc mở pull request; kết quả kiểm thử cục bộ ở trên không thay thế kết quả của từng lần chạy CI.
