# Refactor GarageCar · 04/11/2026

Đợt này rà soát 149 file source/config trong backend, frontend, script và kiểm thử. Các thay đổi dựa trên phiên bản `1a8b5bd`, tập trung vào phần lặp, tên khó hiểu và thao tác tra cứu có thể đơn giản hóa. Các model, migration lịch sử và dữ liệu tham khảo được giữ khi không cần thay đổi. Rà soát toàn project không đồng nghĩa cần viết lại từng file.

## Code đã tối ưu

Toàn bộ code đã được sửa trực tiếp trong repository. Các điểm vào quan trọng:

| Nhóm                   | Mã nguồn đầy đủ                                                                        | Nội dung                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Chuyển dữ liệu ORM     | [core/serialization.py](../be/core/serialization.py)                                   | Chuyển đúng các cột của model nghiệp vụ; tài khoản vẫn qua schema để kiểm soát trường trả về |
| Ghi lịch sử kho        | [inventory_service.py](../be/services/inventory_service.py)                            | Dùng chung cho tồn đầu, nhập thêm, điều chỉnh và xuất/hoàn vật tư sửa chữa                   |
| Bảo dưỡng              | [maintenance_service.py](../be/services/maintenance_service.py)                        | Lập mục lục lần thực hiện cuối theo bộ phận/thao tác và tra quy tắc nhắc hạn                 |
| Phiếu sửa              | [repair_service.py](../be/services/repair_service.py)                                  | Gom thống kê số lượng vật tư, đổi tên biến rõ nghĩa và dùng helper ghi ledger                |
| Phân quyền             | [middleware/auth.py](../be/middleware/auth.py)                                         | Tách quyết định nhóm quyền khỏi dependency xác thực vai trò                                  |
| Tài chính              | [finance_operations.py](../be/routers/finance_operations.py)                           | Dùng chung thao tác khóa/đọc đề nghị chi; biến `expense` thể hiện đúng đối tượng             |
| Frontend chung         | [core.js](../fe/shared/core.js), [forms.js](../fe/shared/forms.js)                     | Một nguồn quyền mặc định, chuyển portal và quy trình gửi dialog                              |
| Portal và nghiệp vụ UI | [shared](../fe/shared), [admin/js](../fe/admin/js), [staff/app.js](../fe/staff/app.js) | Tái sử dụng helper, bộ định dạng tiền/ngày và hạn chế render danh sách lặp                   |
| Kiểm thử hồi quy       | [test_refactor_contracts.py](../be/tests/test_refactor_contracts.py)                   | Thứ tự lịch sử bảo dưỡng, ranh giới workshop/finance và mật khẩu Unicode                     |

Ví dụ helper gửi biểu mẫu là mã dùng thật trong `fe/shared/forms.js`. Các module vẫn xây nội dung dialog và quyết định thao tác nghiệp vụ; helper chỉ thống nhất bước chặn gửi trùng, kiểm tra form, lưu, đóng khi thành công và hiển thị lỗi.

## Danh sách các điểm cải tiến

| Trước                                                              | Sau                                                                   | Ý nghĩa                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| API nhân sự/tài chính phụ thuộc hàm `row_dict` ở service bảo dưỡng | `serialize_columns` nằm trong `core`                                  | Giảm phụ thuộc giữa các phân hệ không liên quan                   |
| Khởi tạo `InventoryMovement` giống nhau ở nhiều luồng              | `add_stock_movement` dùng chung                                       | Giữ một cách ghi số dư và tham chiếu; helper không tự commit      |
| Mỗi quy tắc lọc rồi sort lịch sử bảo dưỡng                         | Duyệt lịch sử một lần để chọn bản cuối theo từng cặp bộ phận/thao tác | Giảm quét lặp; giữ thứ tự ngày, ODO, ID và trường hợp hòa thứ tự  |
| Mỗi nhắc hạn dùng `next()` tìm lại quy tắc                         | Mục lục quy tắc theo key, giữ bản đầu như cũ                          | Giảm tìm tuyến tính trong vòng lặp                                |
| Bảng quyền nằm ở access, admin và staff                            | Một định nghĩa trong `core.js`, trả bản sao qua helper                | Tránh lệch quyền hiển thị giữa các portal                         |
| Năm module lặp quy trình gửi form dialog                           | `Garage.bindDialogForm`                                               | Giữ bản nháp khi lỗi và tránh sửa lệch cơ chế chặn gửi trùng      |
| Tạo `Intl.NumberFormat`/`DateTimeFormat` trong vòng lặp            | Tạo một lần trong module và tái sử dụng                               | Giảm khởi tạo bộ định dạng; giữ locale, múi giờ và cách chuyển số |
| Danh mục tiền công nối `innerHTML` sau từng dòng                   | Tạo chuỗi danh sách rồi gán một lần                                   | Giảm số lần phân tích HTML và dựng lại DOM                        |
| Nhiều điều kiện chọn quyền trong dependency                        | `_request_permission` với các nhánh theo resource                     | Dễ đọc quy tắc kế toán/admin chỉ có tài chính và thợ tra vật tư   |
| Kiểm tra giới hạn UTF-8 của mật khẩu viết hai lần                  | Helper validation chung                                               | Giữ nguyên giới hạn ký tự, byte, trường lỗi và thông báo          |
| Schema `TokenResponse` không được dùng                             | Bỏ định nghĩa dư                                                      | Không tác động schema thực tế của API                             |

Tên biến như `old`/`needed`, `row`, `dirty` và `pending` được thay ở các luồng liên quan bằng tên thể hiện đối tượng hoặc trạng thái: `previous_quantities`, `requested_quantities`, `expense`, `dirtyScopes`, `refreshPending`. Tên trường API/database được giữ để tương thích.

## Bảo toàn hành vi

Đối chiếu với bản trước refactor cho kết quả:

- Toàn bộ tài liệu OpenAPI khớp, gồm 78 path và các phương thức/schema tương ứng.
- 29 model ORM khớp tên cột, kiểu, nullable, khóa chính và khóa ngoại.
- 1.000 kịch bản bảo dưỡng với 6.000 kết quả quy tắc khớp dữ liệu cũ.
- 9.680 quyết định chọn quyền trên các đường dẫn/phương thức/vai trò khớp cách xử lý cũ.

Các phép so sánh thuật toán chứng minh tính tương đương trong tập dữ liệu đã kiểm tra; không phải phép đo tải production. Giao dịch vẫn commit tại các điểm gọi cũ; helper kho và serializer không thêm giao dịch hoặc truy vấn. Thông báo lỗi, khóa bản ghi, giá trị tiền và giới hạn quyền được kiểm tra bằng bộ test nghiệp vụ hiện có.

## Kết quả kiểm tra

| Hạng mục                                             | Kết quả                                            |
| ---------------------------------------------------- | -------------------------------------------------- |
| Backend trước refactor                               | 37/37 kiểm thử đạt                                 |
| Backend sau refactor                                 | 40/40 kiểm thử đạt, gồm 3 kiểm thử hồi quy bổ sung |
| Frontend trước và sau refactor                       | 58/58 kiểm thử đạt                                 |
| Ruff lint và định dạng Python                        | Đạt                                                |
| Kiểm tra tài nguyên, đường dẫn và cú pháp JavaScript | Đạt qua `check:files`                              |
| Prettier và `git diff --check`                       | Đạt                                                |

Bộ backend còn 347 cảnh báo `DeprecationWarning` từ thư viện `python-jose`, giống trước refactor; đây không phải lỗi kiểm thử. Chưa nâng cấp thư viện trong đợt này để giữ phạm vi thay đổi.

## Cách kiểm tra lại

```powershell
.\.venv\Scripts\python.exe -m ruff check be scripts
.\.venv\Scripts\python.exe -m ruff format --check be scripts
.\.venv\Scripts\python.exe -m pytest -q
npm.cmd run check:files
npm.cmd test
npm.cmd run format:check
```

PWA tăng cache lên v15 để nhận helper mới. Kiểm tra trên thiết bị thật vẫn cần cho camera, cài PWA và in; bộ test frontend dùng jsdom. Đợt này không chạy seed hoặc migration trên database nghiệp vụ của người dùng.
