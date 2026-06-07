# 📤 Hướng dẫn đẩy code lên GitHub

## Bước 1: Tạo repository trên GitHub

1. Truy cập [GitHub](https://github.com)
2. Click vào nút **"New"** hoặc **"+"** ở góc trên bên phải
3. Chọn **"New repository"**
4. Điền thông tin:
   - **Repository name**: `auto-garage` (hoặc tên khác bạn muốn)
   - **Description**: "Hệ thống quản lý garage AutoPro"
   - Chọn **Public** hoặc **Private**
   - **KHÔNG** chọn "Initialize this repository with a README" (vì bạn đã có code)
5. Click **"Create repository"**

## Bước 2: Cấu hình Git cục bộ (nếu lần đầu)

```bash
# Cấu hình tên và email
git config --global user.name "Tên của bạn"
git config --global user.email "email@example.com"
```

## Bước 3: Khởi tạo Git trong dự án (nếu chưa có .git)

```bash
# Di chuyển vào thư mục dự án
cd c:\Users\nnhat\.gemini\antigravity\scratch\auto_garage

# Khởi tạo git (nếu chưa có)
git init
```

## Bước 4: Tạo file .gitignore

Tạo file `.gitignore` trong thư mục gốc để bỏ qua các file không cần thiết:

```bash
# File .gitignore đã được tạo sẵn, kiểm tra nội dung
```

## Bước 5: Add và Commit code

```bash
# Xem trạng thái hiện tại
git status

# Thêm tất cả file vào staging
git add .

# Hoặc add từng file cụ thể
git add README.md
git add be/
git add fe/

# Commit với message
git commit -m "Initial commit: AutoPro Garage Management System"
```

## Bước 6: Kết nối với GitHub repository

```bash
# Thêm remote repository (thay <username> và <repository-name> của bạn)
git remote add origin https://github.com/<username>/<repository-name>.git

# Ví dụ:
# git remote add origin https://github.com/nnhat/auto-garage.git

# Kiểm tra remote đã add chưa
git remote -v
```

## Bước 7: Đẩy code lên GitHub

```bash
# Đẩy code lên branch main (hoặc master)
git push -u origin main

# Nếu repository sử dụng branch "master"
git branch -M main
git push -u origin main
```

## Bước 8: Xác thực (nếu được yêu cầu)

GitHub có thể yêu cầu xác thực. Bạn có 2 cách:

### Cách 1: Personal Access Token (Khuyến nghị)

1. Vào GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Đặt tên note: "AutoGarage Project"
4. Chọn scopes: **repo** (tất cả các quyền repo)
5. Click **"Generate token"**
6. **SAO CHÉP TOKEN** (chỉ hiển thị 1 lần!)
7. Khi push, nhập:
   - Username: username GitHub của bạn
   - Password: **token vừa tạo** (không phải password GitHub)

### Cách 2: GitHub CLI

```bash
# Cài đặt GitHub CLI
winget install --id GitHub.cli

# Đăng nhập
gh auth login

# Làm theo hướng dẫn
```

## 🔄 Cập nhật code sau này

Khi bạn có thay đổi mới:

```bash
# 1. Kiểm tra trạng thái
git status

# 2. Add file đã thay đổi
git add .

# 3. Commit với message mô tả
git commit -m "Add: Thêm tính năng quản lý phụ tùng"

# 4. Push lên GitHub
git push
```

## 📋 Các lệnh Git hữu ích

```bash
# Xem lịch sử commit
git log

# Xem lịch sử ngắn gọn
git log --oneline

# Xem branch hiện tại
git branch

# Tạo branch mới
git checkout -b feature/new-feature

# Chuyển branch
git checkout main

# Pull code mới nhất từ GitHub
git pull

# Xem thay đổi chưa commit
git diff

# Hủy thay đổi chưa commit
git checkout -- <file>

# Xem remote repository
git remote -v
```

## ⚠️ Lưu ý quan trọng

1. **Không push file `.env`** - Chứa thông tin nhạy cảm
2. **Không push `node_modules/`** - Quá lớn, cài lại bằng `npm install`
3. **Không push `database.sqlite`** - Dữ liệu local, tạo lại bằng `npm run seed`
4. **Luôn kiểm tra `.gitignore`** trước khi push
5. **Viết commit message rõ ràng** - Giúp người khác hiểu bạn làm gì

## 🔐 File .gitignore mẫu

```gitignore
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.*.local

# Database
*.sqlite
*.db

# Logs
logs/
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db
desktop.ini

# Editor
.vscode/
.idea/
*.swp
*.swo
*~

# Build
dist/
build/
```

## 🎯 Workflow làm việc nhóm

```bash
# 1. Pull code mới nhất trước khi làm việc
git pull

# 2. Tạo branch cho tính năng mới
git checkout -b feature/ten-tinh-nang

# 3. Làm việc và commit thường xuyên
git add .
git commit -m "Mô tả ngắn gọn"

# 4. Push branch lên GitHub
git push -u origin feature/ten-tinh-nang

# 5. Tạo Pull Request trên GitHub để merge vào main

# 6. Sau khi merge, về branch main và pull
git checkout main
git pull

# 7. Xóa branch cũ
git branch -d feature/ten-tinh-nang
```

## 🆘 Xử lý sự cố

### Lỗi: "fatal: remote origin already exists"

```bash
git remote remove origin
git remote add origin <URL-mới>
```

### Lỗi: "Updates were rejected"

```bash
git pull --rebase origin main
git push
```

### Quên không thêm .gitignore trước khi commit

```bash
# Tạo .gitignore
# Sau đó:
git rm -r --cached .
git add .
git commit -m "Update .gitignore"
```

### Undo commit cuối cùng (chưa push)

```bash
git reset --soft HEAD~1
```

---

**Chúc bạn thành công! 🚀**
