"""Bounded keyset pages with stable IDs, including when new records arrive."""

from fastapi import Query

from core.response import success_response


class Page:
    def __init__(
        self,
        limit: int = Query(default=100, ge=1, le=200),
        cursor: int | None = Query(default=None, gt=0),
        q: str = Query(default="", max_length=100),
        vehicleId: int | None = Query(default=None, gt=0),
        mechanicId: int | None = Query(default=None, gt=0),
        status: str | None = Query(default=None, max_length=50),
    ):
        self.limit, self.cursor, self.q = limit, cursor, q.strip()
        self.vehicle_id, self.mechanic_id, self.status = vehicleId, mechanicId, status

    async def load(self, db, query, identifier):
        if self.cursor is not None:
            query = query.where(identifier < self.cursor)
        rows = list(
            (
                await db.scalars(
                    query.order_by(None)
                    .order_by(identifier.desc())
                    .limit(self.limit + 1)
                )
            ).all()
        )
        return rows[: self.limit], len(rows) > self.limit

    def response(self, data, rows, more, summary=None):
        return success_response(
            data,
            pagination={
                "hasMore": more,
                "nextCursor": rows[-1].id if more else None,
                "pageSize": self.limit,
                **({"summary": summary} if summary is not None else {}),
            },
        )

    async def fetch(self, db, query, identifier, serialize, summary=None):
        rows, more = await self.load(db, query, identifier)
        return self.response([serialize(row) for row in rows], rows, more, summary)
