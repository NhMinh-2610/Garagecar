# Hướng Dẫn Đóng Góp cho GarageCar

Cảm ơn bạn đã quan tâm đến việc đóng góp cho GarageCar! Hướng dẫn này giúp bạn bắt đầu nhanh chóng.

## 1. Tìm issue hoặc đề xuất tính năng

Trước khi bắt đầu code, hãy tạo một Issue trên GitHub để thảo luận về bug hoặc tính năng bạn muốn thêm. Điều này giúp tránh trùng lặp công việc.

## 2. Fork & tạo branch

Fork repository và tạo branch với tên mô tả rõ ràng:

```bash
# Ví dụ cho issue #42
git checkout -b 42-them-tinh-nang-tim-kiem-xe
```

## 3. Cài đặt môi trường phát triển

```bash
# Clone fork của bạn
git clone https://github.com/<your-username>/Garagecar.git
cd Garagecar

# Cài đặt backend
cd be
pip install -r requirements.txt
cp .env.example .env

# Tạo dữ liệu mẫu
python seed.py

# Chạy backend (dev mode)
uvicorn main:app --reload --port 8000
```

Frontend không cần cài đặt — mở `fe/login/index.html` bằng Live Server là dùng được.

## 4. Coding Style

### Backend (Python/FastAPI)

- Code theo chuẩn **PEP 8**, dùng type hints
- Mọi route handler phải là `async def`
- Dùng `success_response()` và `error_response()` từ `core/response.py`
- Validation qua **Pydantic v2 schemas** trong `schemas/`
- Không dùng raw SQL — chỉ dùng SQLAlchemy ORM

```python
# ✅ Đúng
@router.get("/items")
async def list_items(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
) -> JSONResponse:
    result = await db.execute(select(Item))
    items = result.scalars().all()
    return success_response([ItemResponse.model_validate(i).model_dump() for i in items])

# ❌ Sai — không dùng raw SQL, không return dict trực tiếp
```

### Frontend (Vanilla JS)

- Không dùng framework — chỉ HTML/CSS/JS thuần
- `API_URL` đã khai báo trong `app.js` của mỗi portal — không hardcode URL trong file khác
- Dùng `showToast(message, type)` để hiển thị thông báo
- Dùng `formatCurrency(amount)` và `formatDate(dateStr)` cho formatting

### CSS

- Dùng CSS Variables đã định nghĩa trong `:root {}` thay vì hardcode màu
- Mỗi portal có file CSS riêng trong `css/`

## 5. Commit Message

Dùng format rõ ràng:

```
feat: Thêm tính năng tìm kiếm xe theo biển số
fix: Sửa lỗi redirect khi token hết hạn
docs: Cập nhật hướng dẫn cài đặt
style: Sửa indent và whitespace
refactor: Tách logic sidebar thành hàm riêng
```

## 6. Tạo Pull Request

```bash
# Đồng bộ với main trước khi push
git remote add upstream https://github.com/NhMinh-2610/Garagecar.git
git fetch upstream
git rebase upstream/main

# Push branch
git push origin 42-them-tinh-nang-tim-kiem-xe
```

Sau đó vào GitHub và tạo Pull Request. Mô tả rõ:
- Vấn đề đang giải quyết
- Cách tiếp cận thực hiện
- Cách test thủ công

## 7. Review checklist

Trước khi submit PR, hãy tự kiểm tra:

- [ ] Code không hardcode port, URL hay secret
- [ ] Mọi route mới đều có authentication (`require_role` hoặc `get_current_user`)
- [ ] Response đều dùng `success_response()` / `error_response()`
- [ ] Không commit file `.env` hay `database.sqlite`
- [ ] Đã test thủ công với các vai trò khác nhau (admin, mechanic, customer)

---

Cảm ơn bạn! 🚀
