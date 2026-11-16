# Hướng dẫn đóng góp

Đọc [README](README.md), hoàn thành [cài đặt](docs/setup.md), sau đó tạo nhánh riêng cho phần việc. Project dùng tiếng Anh cho tên code/file và tiếng Việt cho giao diện, tài liệu. Chú thích có thể viết tiếng Việt không dấu; ưu tiên giải thích quy tắc nghiệp vụ hoặc lý do cần kiểm soát.

## Quy ước code

- Đặt xử lý API trong `be/routers`, nghiệp vụ dùng lại trong `be/services`, kiểm tra đầu vào trong `be/schemas`.
- Giữ nguyên tên trường API/database đang được sử dụng. Thay đổi schema qua migration mới; không sửa revision đã triển khai.
- Cập nhật tồn kho, phiếu sửa, báo giá và thu tiền trong giao dịch. Quyền truy cập phải được kiểm tra ở API.
- Frontend gọi `Garage.request` và dùng các module `fe/shared`; không sao chép xác thực, điều hướng hoặc HTTP client sang portal mới.
- Dữ liệu nhập từ người dùng phải được escape hoặc gán bằng `textContent`. Tránh thay cả vùng giao diện khi đang có bản nháp.
- Tên file tiếng Anh, ASCII; tài liệu dùng `kebab-case`. Không đổi tên model/cột chỉ để làm đẹp.
- Không đưa `.env`, token, ảnh khách hàng, bản backup hoặc log chứa thông tin riêng vào Git.

## Cài công cụ kiểm tra

Chạy tại thư mục gốc:

```powershell
.\.venv\Scripts\python.exe -m pip install -r be/requirements-dev.txt
npm.cmd ci
```

Node.js phục vụ kiểm thử và định dạng code; ứng dụng không cần bước build frontend.

## Kiểm tra trước khi commit

Trên Windows có thể chạy toàn bộ bằng `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify.ps1`. Script dừng ngay khi một bước lỗi. Chi tiết phạm vi tại [báo cáo kiểm tra](docs/verification.md).

```powershell
.\.venv\Scripts\python.exe -m ruff check be scripts
.\.venv\Scripts\python.exe -m ruff format --check be scripts
.\.venv\Scripts\python.exe -m pytest -q
npm.cmd run format:check
npm.cmd run check:files
npm.cmd test
```

Các test backend dùng database/schema kiểm thử riêng theo fixture; không dùng lệnh seed để thay cho kiểm thử. Test frontend dùng jsdom, kiểm tra DOM và tương tác; chưa thay thế kiểm tra trực quan trên điện thoại/trình duyệt thật.

Định dạng lại khi cần:

```powershell
.\.venv\Scripts\python.exe -m ruff check be --fix
.\.venv\Scripts\python.exe -m ruff format be
npm.cmd run format
```

Các revision trong `be/migrations/versions` được giữ nguyên định dạng lịch sử. File JSON nghiên cứu/danh mục và tài liệu Word được giữ riêng khỏi bộ định dạng code.

## Commit và review

Mỗi commit giải quyết một phần việc có thể hiểu và kiểm tra độc lập. Dùng câu tiếng Anh ngắn, ví dụ `Add support chat`, `Group workspace menus`, `Update setup guide`. Tránh đưa thay đổi nghiệp vụ không liên quan vào commit định dạng.

Mô tả review nêu vấn đề, hành vi sau sửa và các kiểm tra đã chạy. Nếu có migration, ghi rõ yêu cầu backup, lệnh nâng cấp và giới hạn chuyển đổi dữ liệu. Xem [quy trình Git](GITHUB_GUIDE.md).
