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
    asset_kind: str | None = None
    mime_type: str | None = None
    source_filename: str | None = None


class LoreEntryCreate(LoreEntryBase):
    pass


class LoreEntryUpdate(BaseModel):
    entry_type: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    tags: list[str] | None = None
    asset_path: str | None = None
    asset_kind: str | None = None
    mime_type: str | None = None
    source_filename: str | None = None


class LoreEntryRead(LoreEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class ShotBase(BaseModel):
    order_index: int
    description: str = ""
    characters: list[str] = Field(default_factory=list)
    setting: str = ""
    mood: str = ""
    has_dialogue: bool = False
    music_notes: str = ""
    status: str = "planned"
    generation_started: bool = False
    locked: bool = False


class ShotPlanInput(BaseModel):
    order_index: int
    description: str = ""
    characters: list[str] = Field(default_factory=list)
    setting: str = ""
    mood: str = ""
    has_dialogue: bool = False
    music_notes: str = ""


class BeginProductionRequest(BaseModel):
    shots: list[ShotPlanInput]


class ShotUpdate(BaseModel):
    order_index: int | None = None
    description: str | None = None
    characters: list[str] | None = None
    setting: str | None = None
    mood: str | None = None
    has_dialogue: bool | None = None
    music_notes: str | None = None
    status: str | None = None
    generation_started: bool | None = None
    locked: bool | None = None


class ShotRead(ShotBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    episode_id: int
    created_at: datetime
    updated_at: datetime


class ImageInputSlotPayload(BaseModel):
    slot_index: int
    label: str = ""
    source_type: str = "library"
    library_entry_id: int | None = None
    file_path: str | None = None
    url: str | None = None


class ImageGenerateRequest(BaseModel):
    frame_type: str
    prompt: str
    resolution: str = "1K"
    aspect_ratio: str = "16:9"
    input_slots: list[ImageInputSlotPayload] = Field(default_factory=list)


class ImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    shot_id: int
    frame_type: str
    prompt: str
    resolution: str
    aspect_ratio: str
    provider: str
    prediction_id: str | None = None
    file_path: str
    approved: bool
    input_slots: list[dict] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class VideoGenerateRequest(BaseModel):
    prompt: str
    model: str = "p-video"
    duration_seconds: int = 4
    fps: int = 24
    resolution: str = "720p"
    draft_mode: bool = True
    seed: int | None = None


class VideoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    shot_id: int
    prompt: str
    model: str
    duration_seconds: int
    fps: int
    resolution: str
    draft_mode: bool
    seed: int | None = None
    provider: str
    prediction_id: str | None = None
    file_path: str
    approved: bool
    created_at: datetime
    updated_at: datetime


class PromptHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    shot_id: int
    target_type: str
    prompt: str
    provider: str
    model: str
    created_at: datetime
    updated_at: datetime


class ShotProductionRead(BaseModel):
    shot: ShotRead
    images: list[ImageRead]
    videos: list[VideoRead]
    prompt_history: list[PromptHistoryRead]


class PromptAssistRequest(BaseModel):
    target_type: str
    frame_type: str | None = None
    input_slots: list[ImageInputSlotPayload] = Field(default_factory=list)


class PromptAssistRead(BaseModel):
    prompt: str


class UploadRead(BaseModel):
    file_path: str
    url: str
    asset_kind: str
    mime_type: str
    source_filename: str | None = None
