from pydantic import BaseModel, Field


class ShelfOut(BaseModel):
    id: int
    name: str
    room: str
    item_count: int


class ItemOut(BaseModel):
    id: int
    name: str
    crest: str
    category: str
    slot: str
    shelf_id: int
    shelf_name: str
    room: str


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    crest: str = Field(default="", max_length=300)
    category: str = Field(default="Uncategorised", max_length=80)
    slot: str = Field(default="", max_length=40)
    shelf_id: int
