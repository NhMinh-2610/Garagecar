"""Chuyển các cột của bản ghi ORM thành dữ liệu, không duyệt relationship."""


def serialize_columns(record):
    """Dùng cho model nghiệp vụ đã chọn; tài khoản vẫn qua UserResponse."""
    return {
        column.name: getattr(record, column.name) for column in record.__table__.columns
    }
