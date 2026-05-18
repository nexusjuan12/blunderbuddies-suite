from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EpisodeBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    type: str = "short"
    buddy_day_name: str = ""
    script_text: str = ""
    status: str = "draft"


class EpisodeCreate(EpisodeBase):
    pass


class EpisodeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    type: str | None = None
    buddy_day_name: str | None = None
    script_text: str | None = None
    status: str | None = None


class EpisodeRead(EpisodeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class LoreEntryBase(BaseModel):
    entry_type: str = "lore"
    title: str = Field(min_length=1, max_length=255)
    content: str = ""
    tags: list[str] = Field(default_factory=list)
    asset_path: str | None = None


class LoreEntryCreate(LoreEntryBase):
    pass


class LoreEntryUpdate(BaseModel):
    entry_type: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    tags: list[str] | None = None
    asset_path: str | None = None


class LoreEntryRead(LoreEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime

