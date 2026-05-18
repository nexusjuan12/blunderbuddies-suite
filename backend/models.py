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


class LoreEntry(TimestampMixin, Base):
    __tablename__ = "lore_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    asset_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)


class MusicTrack(TimestampMixin, Base):
    __tablename__ = "music_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    episode_id: Mapped[int] = mapped_column(ForeignKey("episodes.id"), nullable=False)
    scene_reference: Mapped[str] = mapped_column(String(255), default="")
    track_type: Mapped[str] = mapped_column(String(32), default="music")
    file_path: Mapped[str] = mapped_column(String(1024), default="")
    notes: Mapped[str] = mapped_column(Text, default="")

    episode: Mapped[Episode] = relationship(back_populates="music_tracks")

