# Đọc và hiểu mã nguồn GarageCar

Tài liệu dành cho người đang học, sửa và bảo vệ đồ án này. Phạm vi ngày 04/11/2026: **5 vai trò, web/PWA, không tích hợp AI**. Quản trị viên phụ trách cả nhân sự. Tên hiển thị trên giao diện là AutoPro. Ứng dụng di động riêng trong phiếu nhiệm vụ **chưa có mã nguồn** trong repository này. Xem [nhật ký refactor](refactoring-20261104.md) để tra các phần dùng chung mới được tách.

## 1. Nên đọc theo thứ tự nào?

| Bước | Đọc                                                                                            | Cần hiểu sau khi đọc                                          |
| ---- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1    | [README](../README.md), [nghiệp vụ](workflows.md)                                              | Ai dùng hệ thống, xe đi qua những bước nào                    |
| 2    | [be/main.py](../be/main.py)                                                                    | Khởi động, đăng ký router, phục vụ frontend, worker           |
| 3    | [models](../be/models), [từ điển dữ liệu](report/data-dictionary.md)                           | Thông tin nào được lưu, quan hệ giữa các bản ghi              |
| 4    | [auth middleware](../be/middleware/auth.py), [permissions](../be/core/permissions.py)          | Phân biệt đăng nhập, quyền chức năng và quyền sở hữu          |
| 5    | [service router](../be/routers/service.py), [repair service](../be/services/repair_service.py) | Báo giá thành phiếu sửa và tồn kho thay đổi thế nào           |
| 6    | [frontend core](../fe/shared/core.js), [service UI](../fe/shared/service.js)                   | Nút bấm gọi API, giữ dữ liệu nhập và cập nhật giao diện       |
| 7    | [backend tests](../be/tests), [frontend tests](../tests)                                       | Đọc một tình huống đúng, một tình huống bị chặn, rồi sửa code |

Không cần học tất cả thư viện trước. Hãy theo một thao tác cụ thể từ nút bấm → request → kiểm tra quyền → giao dịch → response → giao diện.

## 2. Bản đồ thư mục

| Vị trí                                            | Trách nhiệm                                                  | Ví dụ                                                 |
| ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| `be/config`                                       | Đọc cấu hình môi trường                                      | Kết nối database, JWT, CORS                           |
| `be/core`                                         | Quy tắc dùng chung                                           | Vai trò, quyền, mã hóa mật khẩu, response, thời gian  |
| `be/database`                                     | Engine/session và kiểm tra schema                            | Mỗi request dùng session; Alembic mới được đổi schema |
| `be/models`                                       | Mô tả bảng bằng SQLAlchemy                                   | `Vehicle`, `RepairTicket`, `User`                     |
| `be/schemas`                                      | Kiểm tra dữ liệu đầu vào/đầu ra bằng Pydantic                | Số lượng dương, email, enum trạng thái                |
| `be/routers`                                      | Endpoint và điều phối xử lý                                  | Nhận JSON, kiểm tra quyền, đọc/ghi, trả HTTP          |
| `be/services`                                     | Nghiệp vụ dùng lại                                           | Tính giá, kiểm tra tồn, xử lý ảnh, tính hạn bảo dưỡng |
| `be/migrations`                                   | Các bước đổi cấu trúc/dữ liệu có phiên bản                   | `008_merge_hr_role` chuyển tài khoản nhân sự cũ       |
| `be/data`                                         | Tài nguyên có sẵn                                            | Danh mục tham khảo bảo dưỡng, ảnh demo                |
| `fe/shared`                                       | Mã dùng chung giữa các portal                                | HTTP, xác thực, bảng, hộp thư, bảo dưỡng, nghiệp vụ   |
| `fe/admin`                                        | Điều hành, kho, nhân sự, tài khoản và các nghiệp vụ quản trị | Các module trong `js/`                                |
| `fe/advisor`, `fe/accountant`                     | HTML riêng theo chức danh                                    | Dùng chung `fe/staff/app.js`                          |
| `fe/mechanic`, `fe/customer`                      | Công việc của thợ, hồ sơ của khách                           | Chỉ thao tác dữ liệu được phép                        |
| `fe/service-worker.js`, `fe/manifest.webmanifest` | Vỏ ứng dụng PWA                                              | Cài biểu tượng, tài nguyên tĩnh, trang offline        |
| `scripts`, `tests`, `be/tests`                    | Công cụ và kiểm thử                                          | Link/asset, DOM, giao dịch PostgreSQL                 |

`model` không phải AI model: ở đây đó là lớp ánh xạ bảng. `schema` trong Pydantic mô tả JSON, khác với schema PostgreSQL là không gian tên chứa bảng. `service` là hàm nghiệp vụ, không bắt buộc là một server riêng. Project hiện là một backend với nhiều module, không phải microservices.

## 3. Một request đi qua đâu?

Ví dụ cố vấn bấm **Tạo phiếu & Giao thợ**:

1. `fe/shared/service.js` lấy ID báo giá và thợ đã chọn; gọi `Garage.request`.
2. `fe/shared/core.js` gửi JSON đến `/api/service/quotes/{quote_id}/convert`, kèm Bearer token.
3. FastAPI chạy dependency trong `middleware/auth.py`: xác thực token, đọc lại người dùng, kiểm tra trạng thái tài khoản và phiên, rồi quyền.
4. `routers/service.py` khóa bản ghi xe/lượt, kiểm tra báo giá chính thức đã được duyệt và chưa chuyển phiếu.
5. `services/repair_service.py` kiểm tra người được giao, vật tư, cấu hình xe, tồn kho và giá hiện tại. Server tính tiền; không tin tổng tiền client gửi.
6. SQLAlchemy ghi phiếu, hạng mục, biến động kho và trạng thái trong một giao dịch. Đủ điều kiện mới `commit`; lỗi thì không lưu dở dang.
7. API trả `ticketId`; giao diện chuyển tới đúng phiếu và cập nhật dữ liệu liên quan.

Xem [sơ đồ tuần tự](report/diagrams/04-sequence-convert.svg). Một API trả thành công không có nghĩa màn hình khác đã cập nhật tức thời: nghiệp vụ đồng bộ khoảng 20 giây; hộp thư khoảng 5 giây.

## 4. Những lớp kiểm soát quyền phải giữ

| Lớp               | Ví dụ                                     | Vì sao cần                                           |
| ----------------- | ----------------------------------------- | ---------------------------------------------------- |
| Xác thực          | JWT hợp lệ, `isActive`, `sessionVersion`  | Token cũ phải mất hiệu lực sau khi khóa/đổi mật khẩu |
| Vai trò/chức năng | Kế toán có `finance`; admin có `hr`       | Không cho thợ ghi nhận thu tiền                      |
| Sở hữu/phân công  | `vehicles.customerId`; `mechanics.userId` | Khách chỉ xem xe mình; thợ chỉ sửa phiếu được giao   |
| Trạng thái        | Phiếu hoàn thành và QC trước thu          | Có quyền vẫn không được bỏ qua quy trình             |

`disabledPermissions` **chỉ bớt quyền**, không cấp quyền vượt vai trò. `hr` còn trong URL và danh sách quyền vì chức năng nhân sự vẫn tồn tại; **không còn vai trò `hr`**. Ẩn menu không bảo vệ API: server luôn kiểm tra lại. Không suy quyền bằng tên, email hiển thị hoặc số điện thoại.

## 5. Các đối tượng dễ nhầm

| Đối tượng        | Ý nghĩa                   | Liên hệ                                                     |
| ---------------- | ------------------------- | ----------------------------------------------------------- |
| `Booking`        | Yêu cầu đặt lịch          | Chưa phải phiếu sửa; hiện chưa có FK tài khoản khách        |
| `Vehicle`        | Hồ sơ một xe              | Có thể liên kết chủ xe qua `customerId`                     |
| `ServiceVisit`   | Một lượt đến garage       | Chứa tiếp nhận, chẩn đoán và nghiệm thu                     |
| `ServiceQuote`   | Một phiên bản báo giá     | `stage`: sơ bộ/chính thức; `items` lưu JSON                 |
| `RepairTicket`   | Phiếu thực hiện công việc | Có thể liên kết một lượt dịch vụ hoặc là phiếu trực tiếp cũ |
| `RepairItem`     | Một hạng mục của phiếu    | Vật tư có thể trống với công việc chỉ có tiền công          |
| `RepairEvidence` | Ảnh/mã xác nhận hạng mục  | Gắn `itemId` và lần thực hiện `evidenceRound`               |
| `PaymentReceipt` | Chứng từ thu              | Tối đa một chứng từ cho một phiếu                           |

Trạng thái **xe**, **lượt dịch vụ**, **báo giá** và **phiếu sửa** là các trường khác nhau. Phiếu `completed` chưa phải đã thu tiền. Xe `delivered` là đã bàn giao. Đừng gộp chúng thành một enum hoặc sửa trực tiếp DB để bỏ qua bước.

## 6. Tiền và kho: ví dụ để tự kiểm tra

Ví dụ giả lập: dùng 2 đơn vị vật tư, giá mỗi đơn vị 100.000 đồng, tiền công hạng mục 50.000 đồng. Tổng hạng mục là `2 × 100.000 + 50.000 = 250.000 đồng`. Tiền công không tự nhân thêm số lượng. Tồn đầu 5, xuất 2 thì tồn còn 3; một dòng biến động ghi số thay đổi -2 và số dư 3.

Backend lấy giá vật tư từ kho, lưu giá tại thời điểm lập trên hạng mục và cộng bằng `Decimal`. Sửa danh mục sau này không được làm đổi tiền phiếu đã thu. Khi chuyển báo giá, giá hoặc tổng tiền không còn khớp thì API từ chối để lập/xác nhận lại; không âm thầm thu theo giá khác.

Các vật tư được khóa theo thứ tự ID ổn định. Khóa xe trước phiếu giúp những request đồng thời thống nhất thứ tự chờ. Đừng bỏ `with_for_update`, chuyển `commit` vào giữa luồng hoặc tách trừ kho thành một request khác chỉ để rút ngắn code.

## 7. Ảnh, bảo dưỡng và tin nhắn

**Ảnh sửa chữa:** kiểm tra loại/kích thước, chuẩn hóa ảnh, bỏ metadata, lưu trong PostgreSQL. API đọc ảnh cần token. Hoàn thành hạng mục cần bằng chứng đúng lần thực hiện; vật tư cần ảnh bao bì và mã được nhập khớp. Mở lại hạng mục yêu cầu ảnh mới. Đây không phải OCR, nhận diện hình ảnh hay xác minh hàng chính hãng. Vật tư cao áp cần chứng chỉ `ev_safety` còn hiệu lực.

**Bảo dưỡng:** danh mục JSON là tài liệu tham khảo. Hồ sơ xe và lịch đã được xác minh nằm trong DB. Hàm nghiệp vụ tính hạn theo km/thời gian và đúng cấu hình xe. Worker tạo nhắc hạn chờ duyệt; người phụ trách công bố cho khách. Không gọi AI và không tự khẳng định mọi xe cùng tên có chung lịch bảo dưỡng.

**Tin nhắn:** khách trao đổi với cố vấn/admin; lưu DB. UUID do client tạo giúp gửi lại không trùng khi request đã lưu nhưng response bị mất. Con trỏ đọc theo người dùng chỉ tiến lên. Bản nháp ở bộ nhớ tab có thể mất khi đóng tab. Không có chuyển câu hỏi AI, WebSocket hay push nền.

## 8. Frontend hoạt động thế nào?

| Module                                          | Công việc                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `core.js`                                       | Gọi API cùng origin, xử lý lỗi, refresh và dữ liệu đang nhập        |
| `forms.js`                                      | Gửi dialog, chặn gửi lặp, hiện lỗi và giữ dữ liệu khi lưu thất bại  |
| `access.js`, `session.js`                       | Lấy quyền hiện tại, hiện menu, thông tin tài khoản và chuyển portal |
| `workspace.js`                                  | Nhóm menu, dashboard, lối tắt và menu điện thoại                    |
| `tables.js`                                     | Phân trang bảng; vẫn giữ các nút thao tác trên dòng                 |
| `service.js`                                    | Tiếp nhận, báo giá, khách xác nhận, chẩn đoán và QC                 |
| `professional.js`                               | Nhân sự, ca/nghỉ/chứng chỉ, thu–chi và công việc cá nhân            |
| `maintenance.js`, `evidence.js`, `messaging.js` | Bảo dưỡng, ảnh thực hiện, hộp thư                                   |

Không render lại cả vùng khi người dùng đang nhập. `refreshGuard` và phiên bản hoạt động giúp bỏ kết quả nền đã cũ. Khi thêm module mới, cần giữ bản nháp khi API lỗi, chặn bấm gửi lặp, escape nội dung người dùng và không chèn HTML từ tin nhắn.

PWA dùng cùng HTML/JS/API. Service worker cache tài nguyên tĩnh, bỏ qua API và request có Authorization. Mất mạng không thể tiếp tục giao dịch sửa chữa/thu tiền. Sau khi đổi tài nguyên đã cache, tăng phiên bản cache; bản refactor này dùng v15 và thêm `forms.js`. PWA cài ra biểu tượng riêng vẫn cần server; nó không phải ứng dụng native Android/iOS.

## 9. Muốn sửa tính năng thì vào đâu?

| Thay đổi               | Vị trí bắt đầu                                                                               | Cần kiểm tra thêm                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Thêm trường tiếp nhận  | `schemas/garage_care.py`, `models/garage_care.py`, `routers/service.py`, `shared/service.js` | Migration, dữ liệu cũ, chủ xe, test round-trip                       |
| Sửa cách tính tiền/tồn | `services/repair_service.py`                                                                 | Đồng thời, rollback, giá báo duyệt, báo cáo                          |
| Thêm quyền             | `core/permissions.py`, middleware, router, `shared/access.js` và UI liên quan                | Cả server và menu; không cho tự nâng quyền                           |
| Sửa ca/nghỉ/chứng chỉ  | `routers/hr_operations.py`, `shared/professional.js`                                         | Trùng ca, tự duyệt, chứng chỉ hết hạn                                |
| Sửa hộp thư            | `routers/messaging.py`, `shared/messaging.js`                                                | Quyền chủ hội thoại, retry, bản nháp, con trỏ đọc                    |
| Thêm lịch bảo dưỡng    | Maintenance schema/router/service và dữ liệu nguồn                                           | Đúng đời xe/cấu hình, người xác minh, không dùng demo làm nguồn thật |

Quy trình nhỏ: tái hiện lỗi → tìm test liên quan → sửa đúng lớp → chạy test liên quan → kiểm tra đầy đủ khi đổi nghiệp vụ → cập nhật tài liệu. Không sửa migrations 001–007 để biểu diễn một thay đổi mới; thêm revision mới.

## 10. Chạy, kiểm tra và gỡ lỗi

Làm theo [cài đặt](setup.md). Với DB đã có dữ liệu, dùng [backup/migration](operations.md), không seed lại để sửa schema.

```powershell
.\.venv\Scripts\python.exe -m ruff check be scripts
.\.venv\Scripts\python.exe -m pytest -q
npm.cmd run check:files
npm.cmd test
npm.cmd run format:check
```

| Triệu chứng                  | Kiểm tra đầu tiên                                              |
| ---------------------------- | -------------------------------------------------------------- |
| HTTP 401                     | Token, khóa tài khoản, phiên cũ sau đổi mật khẩu               |
| HTTP 403                     | Vai trò, `disabledPermissions`, chủ xe/thợ được giao           |
| HTTP 409                     | Trạng thái không phù hợp, thiếu tồn, báo giá cũ, request trùng |
| HTTP 422                     | Dữ liệu request không đúng schema                              |
| Giao diện chưa cập nhật      | Network response, refresh guard, cache PWA                     |
| Không khởi động sau cập nhật | Revision DB và thông báo bảng/cột thiếu                        |

Tests backend tạo schema PostgreSQL tạm `garage_test_*` và xóa schema đó sau test; không chạy các kịch bản ghi trực tiếp vào bảng production. Tests frontend chạy jsdom để kiểm tra DOM/JS; không thay việc thử camera, in và cài PWA trên thiết bị thật.

## 11. Những câu có thể giải thích khi bảo vệ

- **Vì sao tách cố vấn và thợ?** Cố vấn thống nhất phạm vi/chi phí, nghiệm thu và chăm sóc; thợ thực hiện/chẩn đoán và nộp bằng chứng. Quyền thu tiền thuộc kế toán/admin.
- **Vì sao nhân sự gộp vào admin?** Giảm một vai trò nhưng giữ hồ sơ, ca, nghỉ và chứng chỉ; phân hệ không mất đi.
- **Tính đúng tồn kho bảo đảm ở đâu?** Giao dịch và khóa dòng trong backend, không phụ thuộc lời nhắc trên trình duyệt.
- **Không dùng AI thì nhắc bảo dưỡng từ đâu?** Quy tắc km/thời gian, cấu hình xe và lịch đã được người phụ trách xác minh.
- **Đã có app riêng chưa?** Có web/PWA cài được qua trình duyệt; chưa có mã nguồn ứng dụng di động riêng. Đây là phần cần hoàn thành nếu giữ trong phạm vi phiếu nhiệm vụ.

Xem [bộ tài liệu báo cáo](report/README.md) để lấy bảng yêu cầu, use case, thiết kế, từ điển dữ liệu, kế hoạch và kịch bản demo.
