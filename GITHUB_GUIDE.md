# Quy trình Git và GitHub

Làm việc trên nhánh riêng để chủ project kiểm tra trước khi merge vào `main`. Các lệnh bên dưới chạy tại thư mục gốc; thay tên nhánh theo công việc thực tế.

## Bắt đầu phần việc

```powershell
git status
git fetch origin
git switch -c refactor/project-polish
```

Kiểm tra thay đổi đang có trước khi chuyển nhánh. Không dùng `reset --hard` hoặc xóa file chưa commit để dọn workspace.

## Chia commit

Nhóm theo chức năng: backend, giao diện, dữ liệu demo, công cụ kiểm tra, tài liệu. Với thay đổi có phụ thuộc, commit các file liên quan cùng nhau để từng mốc vẫn chạy được.

```powershell
git diff --stat
git diff -- be/routers/messaging.py
git add be/models/messaging.py be/schemas/messaging.py be/routers/messaging.py
git diff --cached --stat
git commit -m "Add support chat"
```

Đây là ví dụ chọn file; bổ sung đầy đủ migration, quyền, đăng ký router và test nếu thay đổi thực tế cần các file đó. Tránh `git add .` khi có file cấu hình hoặc dữ liệu riêng chưa kiểm tra. Giữ ngày commit thực tế, dùng câu tiếng Anh đơn giản.

## Push và review

Chạy các kiểm tra trong [CONTRIBUTING](CONTRIBUTING.md), rồi:

```powershell
git push -u origin refactor/project-polish
git status
git log --oneline origin/main..HEAD
```

Trên GitHub, tạo Pull Request với **base: `main`**, **compare: nhánh vừa push**. Mô tả ngắn nội dung, kết quả kiểm thử và migration nếu có. Chủ project review rồi tự merge; không push thẳng hoặc force-push lên `main`.

## Sau khi merge

Khi workspace đã sạch:

```powershell
git switch main
git pull --ff-only origin main
```

Nếu gặp xung đột, đọc thay đổi của cả hai phía và giải quyết theo nghiệp vụ. Không ghi đè toàn bộ file để bỏ qua xung đột.
