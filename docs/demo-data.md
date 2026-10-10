# Tài khoản và dữ liệu demo

## Tạo bộ demo đầy đủ

Sau khi database đã ở migration mới nhất, chạy tại thư mục gốc:

```powershell
.\.venv\Scripts\python.exe be/seed.py --demo --preview
.\.venv\Scripts\python.exe be/seed.py --demo
```

`--preview` tạo dữ liệu trong giao dịch rồi rollback để kiểm tra. `--demo` thêm bộ kịch bản liên kết trong một giao dịch, giữ nguyên các dòng có trước. Nếu mã dành riêng cho demo bị trùng, thao tác dừng mà không ghi dữ liệu.

Sau lần tạo thành công, manifest `demo_dataset_v1` trong `system_parameters` đánh dấu bộ đã cài. Chạy lại không nhân bản hoặc reset mật khẩu/trạng thái đã được người dùng thay đổi. Không xóa manifest để ép seed lại trên database đang dùng; muốn trình bày từ đầu hãy tạo database thử riêng.

## Đăng nhập

| Vai trò       | Email                         | Portal        |
| ------------- | ----------------------------- | ------------- |
| Quản trị      | `admin.demo@autopro.com`      | `/admin`      |
| Cố vấn        | `advisor.demo@autopro.com`    | `/advisor`    |
| Kế toán       | `accountant.demo@autopro.com` | `/accountant` |
| Nhân sự       | `hr.demo@autopro.com`         | `/hr`         |
| Kỹ thuật viên | `mechanic.demo@autopro.com`   | `/mechanic`   |
| Khách hàng    | `customer.demo@autopro.com`   | `/customer`   |

Mật khẩu ban đầu của cả 6 tài khoản: **`Demo123456!`**. Nếu đã đổi mật khẩu, seed không đặt lại.

Lệnh cũ `python be/seed.py` chỉ tạo bộ tối thiểu khi bảng `users` trống: `admin@autopro.com`, `mechanic@autopro.com`, `customer@autopro.com`, mật khẩu ban đầu `123456`. Nó bỏ qua database đã có người dùng; không tạo tài khoản cố vấn/kế toán/nhân sự. Dùng `--demo` để thử đầy đủ chức năng.

## Các tình huống có sẵn

| Phần trình bày | Dữ liệu/kịch bản                                                                         |
| -------------- | ---------------------------------------------------------------------------------------- |
| Tiếp nhận      | Xe/lịch hẹn ở nhiều trạng thái, lượt tiếp nhận và lượt chờ kiểm tra kỹ                   |
| Báo giá        | Sơ bộ/chính thức, khách chờ duyệt, phiên bản và lượt đã chuyển phiếu                     |
| Xưởng          | Phiếu nháp, đang làm, hoàn thành/chờ thu và đã thu; vật tư/công, ảnh bằng chứng mô phỏng |
| Kho            | Vật tư có mã/cấu hình, biến động nhập–xuất, phụ tùng xe xăng và VinFast điện             |
| Tài chính      | Phiếu thu, phương thức thanh toán, đề nghị chi ở nhiều trạng thái và dữ liệu báo cáo     |
| Bảo dưỡng      | Hồ sơ xe, lịch giả lập, lịch sử và nhắc hạn chờ duyệt/đã công bố                         |
| Nhân sự        | Hồ sơ, ca làm, chứng chỉ, yêu cầu nghỉ và chăm sóc sau sửa                               |
| Hỗ trợ         | Hội thoại chung/theo xe, cố vấn được phân công, tin nhắn và trạng thái đọc               |

## Gợi ý trình bày

1. Quản trị mở bảng điều hành để giới thiệu các nhóm công việc và dữ liệu tổng hợp.
2. Cố vấn xem xe/lượt tiếp nhận; khách mở báo giá đang chờ để thấy cơ chế xác nhận.
3. Thợ mở phiếu được giao, ảnh bao bì/mã vật tư và checklist; cố vấn xem phần nghiệm thu.
4. Kế toán xem phiếu chờ thu/chứng từ; nhân sự xem phân ca, chứng chỉ và nghỉ phép.
5. Khách xem bảo dưỡng, hỏi AI với `mock` rồi nhắn garage; cố vấn trả lời trong hộp thư riêng.

Thao tác xác nhận/thu tiền sẽ thay đổi trạng thái của chính bản demo. Ngày dữ liệu được neo tại lần seed đầu, không tự dịch sang ngày mới mỗi lần chạy. Nên dùng database thử riêng nếu cần lặp lại bài trình bày từ đầu.

## Nhận biết dữ liệu giả lập

Email có `.demo`, biển số/mã vật tư và ghi chú có dấu `DEMO`. Ảnh [demo_evidence.jpg](../be/data/demo_evidence.jpg) là ảnh minh họa được đánh dấu mô phỏng, không phải bằng chứng sửa xe thật.

Kiểm tra các xe demo bằng Query Tool của pgAdmin, trên đúng database cấu hình trong `be/.env`:

```sql
SELECT id, "licensePlate", "carBrand", "carModel", status
FROM vehicles
WHERE "licensePlate" LIKE 'DEMO%'
ORDER BY id;
```

Lệnh chỉ đọc dữ liệu. Bộ demo đầy đủ có 8 xe, gồm VinFast VF 5 và VF 8; xe đã bị xóa hoặc thay biển số sẽ không còn khớp truy vấn này.

Lịch bảo dưỡng demo dùng [trang nguồn giả lập](../fe/demo/maintenance.html), chỉ khớp cấu hình `DEMO`. Không dùng mốc bảo dưỡng, chứng chỉ, mã sản phẩm hoặc ảnh demo cho công việc thực tế. Dữ liệu người dùng đang có và mật khẩu cũ được giữ nguyên.
