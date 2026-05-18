from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Episode(TimestampMixin, Base):
    __tablename__ = "episodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), default="short")
    buddy_day_name: Mapped[str] = mapped_column(String(255), default="")
    script_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="draft")

    shots: Mapped[list["Shot"]] = relationship(back_populates="episode", cascade="all, delete-orphan")
    music_tracks: Mapped[list["MusicTrack"]] = relationship(back_populates="episode", cascade="all, delete-orphan")


class Shot(TimestampMixin, Base):
    __tablename__ = "shots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    episode_id: Mapped[int] = mapped_column(ForeignKey("episodes.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    characters: Mapped[list[str]] = mapped_column(JSON, default=list)
    setting: Mapped[str] = mapped_column(Text, default="")
    mood: Mapped[str] = mapped_column(String(255), default="")
    has_dialogue: Mapped[bool] = mapped_column(Boolean, default=False)
    music_notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="planned")
    generation_started: Mapped[bool] = mapped_column(Boolean, default=False)
    locked: Mapped[bool] = mapped_column(Boolean, default=False)

    episode: Mapped[Episode] = relationship(back_populates="shots")
    images: Mapped[list["Image"]] = relationship(back_populates="shot", cascade="all, delete-orphan")
    videos: Mapped[list["Video"]] = relationship(back_populates="shot", cascade="all, delete-orphan")
    prompt_history: Mapped[list["PromptHistory"]] = relationship(back_populates="shot", cascade="all, delete-orphan")
    audio_lines: Mapped[list["AudioLine"]] = relationship(back_populates="shot", cascade="all, delete-orphan")


class LoreEntry(TimestampMixin, Base):
    __tablename__ = "lore_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    asset_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    asset_kind: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)


class Image(TimestampMixin, Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shot_id: Mapped[int] = mapped_column(ForeignKey("shots.id"), nullable=False)
    frame_type: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, default="")
    resolution: Mapped[str] = mapped_column(String(32), default="1K")
    aspect_ratio: Mapped[str] = mapped_column(String(32), default="16:9")
    provider: Mapped[str] = mapped_column(String(64), default="mock")
    prediction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str] = mapped_column(String(1024), default="")
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    input_slots: Mapped[list[dict]] = mapped_column(JSON, default=list)

    shot: Mapped[Shot] = relationship(back_populates="images")


class Video(TimestampMixin, Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shot_id: Mapped[int] = mapped_column(ForeignKey("shots.id"), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, default="")
    model: Mapped[str] = mapped_column(String(64), default="p-video")
    duration_seconds: Mapped[int] = mapped_column(Integer, default=4)
    fps: Mapped[int] = mapped_column(Integer, default=24)
    resolution: Mapped[str] = mapped_column(String(32), default="720p")
    draft_mode: Mapped[bool] = mapped_column(Boolean, default=True)
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provider: Mapped[str] = mapped_column(String(64), default="mock")
    prediction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str] = mapped_column(String(1024), default="")
    approved: Mapped[bool] = mapped_column(Boolean, default=False)

    shot: Mapped[Shot] = relationship(back_populates="videos")


class PromptHistory(TimestampMixin, Base):
    __tablename__ = "prompt_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shot_id: Mapped[int] = mapped_column(ForeignKey("shots.id"), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, default="")
    provider: Mapped[str] = mapped_column(String(64), default="mock")
    model: Mapped[str] = mapped_column(String(128), default="mock")

    shot: Mapped[Shot] = relationship(back_populates="prompt_history")


class AudioLine(TimestampMixin, Base):
    __tablename__ = "audio_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shot_id: Mapped[int] = mapped_column(ForeignKey("shots.id"), nullable=False)
    character_name: Mapped[str] = mapped_column(String(255), default="")
    line_text: Mapped[str] = mapped_column(Text, default="")
    file_path: Mapped[str] = mapped_column(String(1024), default="")
    silence_start_ms: Mapped[int] = mapped_column(Integer, default=0)
    silence_end_ms: Mapped[int] = mapped_column(Integer, default=0)
    padded_file_path: Mapped[str] = mapped_column(String(1024), default="")
    total_duration_ms: Mapped[int] = mapped_column(Integer, default=0)

    shot: Mapped[Shot] = relationship(back_populates="audio_lines")


class MusicTrack(TimestampMixin, Base):
    __tablename__ = "music_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    episode_id: Mapped[int] = mapped_column(ForeignKey("episodes.id"), nullable=False)
    scene_reference: Mapped[str] = mapped_column(String(255), default="")
    track_type: Mapped[str] = mapped_column(String(32), default="music")
    file_path: Mapped[str] = mapped_column(String(1024), default="")
    notes: Mapped[str] = mapped_column(Text, default="")

    episode: Mapped[Episode] = relationship(back_populates="music_tracks")
