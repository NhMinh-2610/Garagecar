"""Shared input validation for identifiers, names and exact money values."""

from decimal import Decimal
from typing import Annotated

from pydantic import Field, StringConstraints

Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]
Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]
PositiveId = Annotated[int, Field(gt=0)]
