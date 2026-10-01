"""Images are decoded, bounded and re-encoded without EXIF before storage."""

import base64
import binascii
import io
import warnings
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from models import RepairEvidence, Inventory, StaffCertificate
from schemas.garage_care import today

MAX_IMAGE_BYTES = 3 * 1024 * 1024


def sanitize_image(value):
    try:
        encoded = value.split(",", 1)[1] if value.startswith("data:image/") else value
        data = base64.b64decode(encoded, validate=True)
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("size")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if (
                    image.format not in ("JPEG", "PNG", "WEBP")
                    or image.width * image.height > 16000000
                ):
                    raise ValueError("format")
                image.load()
                result = ImageOps.exif_transpose(image).convert("RGB")
                result.thumbnail((1920, 1920))
                output = io.BytesIO()
                result.save(output, format="JPEG", quality=85)
                return output.getvalue()
    except (
        ValueError,
        IndexError,
        binascii.Error,
        OSError,
        UnidentifiedImageError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(
            422, "Ảnh phải là JPEG/PNG/WebP thật, tối đa 3 MB và 16 megapixel"
        )


async def check_ev_certificate(db, user, stock):
    if stock and stock.highVoltage:
        valid = await db.scalar(
            select(StaffCertificate.id).where(
                StaffCertificate.userId == user["id"],
                StaffCertificate.kind == "ev_safety",
                StaffCertificate.status == "verified",
                StaffCertificate.validFrom <= today(),
                StaffCertificate.validUntil >= today(),
            )
        )
        if not valid:
            raise HTTPException(
                409,
                "Vật tư cao áp cần hồ sơ đào tạo an toàn EV còn hiệu lực do nhân sự xác minh",
            )


async def require_item_evidence(db, item):
    rows = (
        await db.scalars(
            select(RepairEvidence).where(
                RepairEvidence.itemId == item.id,
                RepairEvidence.round == item.evidenceRound,
            )
        )
    ).all()
    if not any(r.kind == "completion" for r in rows):
        raise HTTPException(
            409, "Cần ảnh kết quả và ghi chú cho hạng mục trước khi xác nhận hoàn thành"
        )
    if item.inventoryId:
        stock = await db.get(Inventory, item.inventoryId)
        expected = item.partCode or (stock.sku if stock else None)
        if not expected or not any(
            r.kind == "package" and r.expectedCode == expected for r in rows
        ):
            raise HTTPException(
                409,
                "Cần ảnh bao bì và mã sản phẩm trùng mã vật tư đã khai báo trong kho",
            )


def evidence_metadata(row):
    return {
        key: getattr(row, key)
        for key in (
            "id",
            "itemId",
            "round",
            "kind",
            "productCode",
            "expectedCode",
            "lotNumber",
            "note",
            "sha256",
            "createdBy",
            "createdAt",
        )
    }
