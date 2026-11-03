"""Xuất bảng API và từ điển dữ liệu từ source; không kết nối database."""

import inspect
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "be"))

from main import app  # noqa: E402

from database.engine import Base  # noqa: E402


def export():
    target = ROOT / "docs/report"
    target.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Từ điển dữ liệu từ mã nguồn",
        "",
        "Sinh bằng `python scripts/export-code-reference.py`; chỉ đọc metadata SQLAlchemy, không đọc dữ liệu hay mật khẩu. Các cột camelCase được giữ nguyên.",
        "",
        "PK: khóa chính; FK: khóa ngoại; UNIQUE: duy nhất. Ràng buộc tổng hợp được liệt kê dưới mỗi bảng. Điều kiện nghiệp vụ còn được kiểm tra trong router/service; nullable không thay thế quy tắc nhập liệu.",
        "",
    ]
    for table in sorted(Base.metadata.tables.values(), key=lambda t: t.name):
        lines += [
            f"## `{table.name}`",
            "",
            "| Cột | Kiểu | Cho phép NULL | Khóa |",
            "| --- | --- | --- | --- |",
        ]
        for col in table.columns:
            keys = (["PK"] if col.primary_key else []) + (
                ["UNIQUE"] if col.unique else []
            )
            keys += [f"FK → `{fk.target_fullname}`" for fk in col.foreign_keys]
            lines.append(
                f"| `{col.name}` | `{col.type}` | {'Có' if col.nullable else 'Không'} | {'; '.join(keys) or '—'} |"
            )
        lines.append("")
        for constraint in sorted(table.constraints, key=lambda c: str(c.name)):
            if constraint.__class__.__name__ == "UniqueConstraint":
                lines += [
                    "- Duy nhất: "
                    + ", ".join(f"`{c.name}`" for c in constraint.columns)
                    + "."
                ]
            elif constraint.__class__.__name__ == "CheckConstraint":
                lines += [f"- Điều kiện DB: `{constraint.sqltext}`."]
        lines.append("")
    lines += [
        "## Bảng kỹ thuật ngoài ORM",
        "",
        "`alembic_version` lưu revision. Migration `008_merge_hr_role` tạo `legacy_hr_role_migration`: `userId` (PK/FK users), `wasActive` (boolean), `disabledPermissions` (JSON), `migratedAt` (timestamp). Bảng này giữ trạng thái tài khoản HR trước chuyển đổi; không phải vai trò hoặc phân hệ mới.",
        "",
    ]
    (target / "data-dictionary.md").write_text("\n".join(lines), encoding="utf-8")
    lines = [
        "# Danh mục API từ mã nguồn",
        "",
        "Sinh từ các route FastAPI mà không chạy startup hoặc gọi database. Đường dẫn bên dưới đã có tiền tố `/api`. Xem `/docs` khi chạy ứng dụng để xem request/response chi tiết. Quyền theo vai trò và sở hữu được mô tả trong [yêu cầu](requirements.md); một dependency xác thực không có nghĩa mọi tài khoản đều được thao tác.",
        "",
        "| Phương thức | Đường dẫn | Hàm xử lý trong source |",
        "| --- | --- | --- |",
    ]
    routes = [
        r for r in app.routes if r.path.startswith("/api") and hasattr(r, "endpoint")
    ]
    for route in sorted(routes, key=lambda r: (r.path, sorted(r.methods))):
        endpoint = route.endpoint
        source = Path(inspect.getsourcefile(endpoint)).relative_to(ROOT).as_posix()
        lines.append(
            f"| {', '.join(sorted(route.methods))} | `{route.path}` | [`{endpoint.__name__}`](../../{source}) |"
        )
    lines += [
        "",
        "Không có endpoint AI. `/api/hr/*` là nghiệp vụ nhân sự do quản trị viên quản lý; nhân viên vẫn xem lịch và gửi nghỉ phép của chính mình.",
        "",
    ]
    (target / "api-catalog.md").write_text("\n".join(lines), encoding="utf-8")
    print(
        f"Exported {len(Base.metadata.tables)} ORM tables and {len(routes)} API routes."
    )


if __name__ == "__main__":
    export()
