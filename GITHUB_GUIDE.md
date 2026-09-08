# Hướng Dẫn Đẩy Code Lên GitHub

## Bước 1: Tạo Repository Trên GitHub

1. Truy cập [GitHub](https://github.com)
2. Click **"New"** hoặc **"+"** góc trên phải → **"New repository"**
3. Điền thông tin:
   - **Repository name**: `garagecar` (hoặc tên bạn muốn)
   - **Description**: "Garage Management System - Python/FastAPI"
   - Chọn **Public** hoặc **Private**
   - **KHÔNG** chọn "Initialize this repository with a README"
4. Click **"Create repository"**

## Bước 2: Cấu Hình Git Cục Bộ (Lần Đầu)

```bash
git config --global user.name "Ten cua ban"
git config --global user.email "email@example.com"
```

## Bước 3: Khởi Tạo Git Trong Thư Mục Dự Án

```bash
cd Garagecar   # di chuyen vao thu muc goc du an
git init
```

## Bước 4: Kiểm Tra .gitignore

File `.gitignore` đã được cấu hình sẵn để bỏ qua:
- `.env` — chứa thông tin nhạy cảm
- `data/database.sqlite` — database local
- `__pycache__/`, `*.pyc` — Python cache
- `node_modules/` — (nếu có)

```bash
# Kiem tra xem .gitignore hoat dong dung chua
git status
```

## Bước 5: Add và Commit

```bash
# Them tat ca file
git add .

# Commit
git commit -m "Initial commit: GarageCar Management System"
```

## Bước 6: Kết Nối Với GitHub

```bash
# Thay <username> va <repo-name> bang cua ban
git remote add origin https://github.com/<username>/<repo-name>.git

# Kiem tra
git remote -v
```

## Bước 7: Push Lên GitHub

```bash
git branch -M main
git push -u origin main
```

## Bước 8: Xác Thực GitHub

GitHub yêu cầu Personal Access Token (không còn chấp nhận password):

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **"Generate new token (classic)"**
3. Note: `GarageCar Project`, chọn scope **repo**
4. Click **"Generate token"** → **Sao chép token ngay** (chỉ hiện 1 lần!)
5. Khi push, nhập:
   - Username: GitHub username của bạn
   - Password: **Token vừa tạo** (không phải password GitHub)

Hoặc dùng GitHub CLI:

```bash
winget install --id GitHub.cli
gh auth login
```

---

## Cập Nhật Code Sau Này

```bash
# 1. Xem thay doi
git status

# 2. Add file
git add .

# 3. Commit
git commit -m "fix: Mo ta ngan gon thay doi"

# 4. Push
git push
```

## Lệnh Git Hữu Ích

```bash
# Xem lich su commit
git log --oneline

# Xem branch hien tai
git branch

# Tao branch moi cho tinh nang
git checkout -b feature/ten-tinh-nang

# Pull code moi nhat
git pull

# Xem thay doi chua commit
git diff
```

---

## Workflow Làm Việc Nhóm

```bash
# 1. Truoc khi lam viec, pull code moi nhat
git pull

# 2. Tao branch rieng
git checkout -b feature/ten-tinh-nang

# 3. Code va commit thuong xuyen
git add .
git commit -m "Mo ta ngan gon"

# 4. Push branch len GitHub
git push -u origin feature/ten-tinh-nang

# 5. Tao Pull Request tren GitHub de merge vao main

# 6. Sau khi merge, quay ve main va cap nhat
git checkout main
git pull
git branch -d feature/ten-tinh-nang
```

---

## Xử Lý Sự Cố Thường Gặp

### "fatal: remote origin already exists"

```bash
git remote remove origin
git remote add origin <URL-moi>
```

### "Updates were rejected"

```bash
git pull --rebase origin main
git push
```

### Quên bỏ file vào .gitignore trước khi commit

```bash
# Sau khi cap nhat .gitignore:
git rm -r --cached .
git add .
git commit -m "fix: Update .gitignore"
```

### Undo commit cuối (chưa push)

```bash
git reset --soft HEAD~1
```

---

## Lưu Ý Quan Trọng

1. **Không push `.env`** — chứa JWT secret và API keys
2. **Không push `data/database.sqlite`** — dữ liệu local, tạo lại bằng `python seed.py`
3. **Không push `__pycache__/`** — Python cache, tự động sinh ra
4. **Luôn kiểm tra `git status`** trước khi commit

---

**Chúc bạn thành công! 🚀**
