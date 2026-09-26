from pydantic import BaseModel

class BrandBase(BaseModel):
    name: str

class BrandCreate(BrandBase):
    pass

class BrandResponse(BrandBase):
    id: int

    class Config:
        from_attributes = True

class WageBase(BaseModel):
    name: str
    price: float

class WageCreate(WageBase):
    pass

class WageResponse(WageBase):
    id: int

    class Config:
        from_attributes = True

class SystemParameterBase(BaseModel):
    key: str
    value: str

class SystemParameterCreate(SystemParameterBase):
    pass

class SystemParameterResponse(SystemParameterBase):
    id: int

    class Config:
        from_attributes = True
