from pydantic import BaseModel, ConfigDict
from schemas.common import Money, Name

class BrandBase(BaseModel):
    name: Name

class BrandCreate(BrandBase):
    pass

class BrandResponse(BrandBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class WageBase(BaseModel):
    name: Name
    price: Money

class WageCreate(WageBase):
    pass

class WageResponse(WageBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class SystemParameterBase(BaseModel):
    key: str
    value: str

class SystemParameterCreate(SystemParameterBase):
    pass

class SystemParameterResponse(SystemParameterBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
