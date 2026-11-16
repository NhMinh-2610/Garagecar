"""Reserve, mutate and save a response in the SAME database transaction.

The PostgreSQL unique index serializes even requests in different processes.
No TTL: forgetting a successful stock operation would make a late retry unsafe.
"""

import hashlib
import json
from typing import Annotated

from fastapi import Header, HTTPException
from fastapi.responses import JSONResponse
from models.request_control import RequestReplay
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

OperationKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key",
        min_length=8,
        max_length=128,
        pattern=r"^[A-Za-z0-9_.:-]+$",
    ),
]


async def reserve(db, user_id, scope, key, payload):
    encoded = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )
    fingerprint = hashlib.sha256(encoded.encode()).hexdigest()
    operation_id = await db.scalar(
        insert(RequestReplay)
        .values(userId=user_id, scope=scope, key=key, requestHash=fingerprint)
        .on_conflict_do_nothing(constraint="uq_request_identity")
        .returning(RequestReplay.id)
    )
    if operation_id is not None:
        return await db.get(RequestReplay, operation_id), None
    # An uncommitted conflicting insert is waited on by PostgreSQL above.
    operation = await db.scalar(
        select(RequestReplay).where(
            RequestReplay.userId == user_id,
            RequestReplay.scope == scope,
            RequestReplay.key == key,
        )
    )
    if operation.requestHash != fingerprint:
        raise HTTPException(409, "Mã thao tác đã được dùng với nội dung khác")
    if operation.response is None:
        raise HTTPException(409, "Thao tác chưa có kết quả; thử lại với cùng mã")
    return operation, JSONResponse(operation.response, status_code=operation.statusCode)


def finish(operation, response):
    operation.response = json.loads(response.body)
    operation.statusCode = response.status_code
