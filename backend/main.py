import os
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session, init_db
from models import Episode, Image, LoreEntry, PromptHistory, Shot, Video
from schemas import (
    BeginProductionRequest,
    EpisodeCreate,
    EpisodeRead,
    EpisodeUpdate,
    ImageGenerateRequest,
    ImageRead,
    LoreEntryCreate,
    LoreEntryRead,
    LoreEntryUpdate,
    PromptAssistRead,
    PromptAssistRequest,
    ShotRead,
    ShotProductionRead,
    ShotUpdate,
    UploadRead,
    VideoGenerateRequest,
    VideoRead,
)
from services.llm_service import generate_image_prompt, generate_shot_breakdown, generate_video_prompt

UPLOAD_ROOT = Path(os.getenv("UPLOADS_DIR", "./uploads")).resolve()
LIBRARY_UPLOAD_DIR = UPLOAD_ROOT / "library"
LIBRARY_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MOCK_ASSET_ROOT = (Path(__file__).resolve().parent.parent / "mock-assets").resolve()

ALLOWED_ASSET_EXTENSIONS = {
    "image": {".png", ".jpg", ".jpeg", ".webp", ".gif"},
    "audio": {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".aac"},
    "video": {".mp4", ".mov", ".webm", ".mkv"},
}


def classify_asset(content_type: str | None, filename: str | None) -> tuple[str, str]:
    content_type = content_type or "application/octet-stream"
    suffix = Path(filename or "").suffix.lower()
    if content_type.startswith("image/") or suffix in ALLOWED_ASSET_EXTENSIONS["image"]:
        return "image", suffix if suffix in ALLOWED_ASSET_EXTENSIONS["image"] else ".png"
    if content_type.startswith("audio/") or suffix in ALLOWED_ASSET_EXTENSIONS["audio"]:
        return "audio", suffix if suffix in ALLOWED_ASSET_EXTENSIONS["audio"] else ".wav"
    if content_type.startswith("video/") or suffix in ALLOWED_ASSET_EXTENSIONS["video"]:
        return "video", suffix if suffix in ALLOWED_ASSET_EXTENSIONS["video"] else ".mp4"
    raise HTTPException(status_code=400, detail="Library uploads support image, audio, and video files")

app = FastAPI(title="Blunderbuddies Production Suite")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/uploads/library", response_model=UploadRead, status_code=201)
async def upload_library_asset(file: UploadFile = File(...)) -> dict[str, str]:
    asset_kind, suffix = classify_asset(file.content_type, file.filename)

    filename = f"{uuid4().hex}{suffix}"
    asset_dir = LIBRARY_UPLOAD_DIR / asset_kind
    asset_dir.mkdir(parents=True, exist_ok=True)
    destination = asset_dir / filename
    with destination.open("wb") as output:
        shutil.copyfileobj(file.file, output)

    public_path = f"/uploads/library/{asset_kind}/{filename}"
    return {
        "file_path": public_path,
        "url": public_path,
        "asset_kind": asset_kind,
        "mime_type": file.content_type or "application/octet-stream",
        "source_filename": file.filename,
    }


@app.get("/episodes", response_model=list[EpisodeRead])
async def list_episodes(session: AsyncSession = Depends(get_session)) -> list[Episode]:
    result = await session.execute(select(Episode).order_by(Episode.updated_at.desc(), Episode.id.desc()))
    return list(result.scalars())


@app.post("/episodes", response_model=EpisodeRead, status_code=201)
async def create_episode(payload: EpisodeCreate, session: AsyncSession = Depends(get_session)) -> Episode:
    episode = Episode(**payload.model_dump())
    session.add(episode)
    await session.commit()
    await session.refresh(episode)
    return episode


@app.patch("/episodes/{episode_id}", response_model=EpisodeRead)
async def update_episode(
    episode_id: int,
    payload: EpisodeUpdate,
    session: AsyncSession = Depends(get_session),
) -> Episode:
    episode = await session.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(episode, key, value)
    await session.commit()
    await session.refresh(episode)
    return episode


@app.delete("/episodes/{episode_id}", status_code=204)
async def delete_episode(episode_id: int, session: AsyncSession = Depends(get_session)) -> None:
    episode = await session.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    await session.delete(episode)
    await session.commit()


@app.post("/episodes/{episode_id}/shot-breakdown")
async def create_shot_breakdown(episode_id: int, session: AsyncSession = Depends(get_session)) -> dict:
    episode = await session.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    if episode.status not in {"script_locked", "planning", "in_production"}:
        raise HTTPException(status_code=400, detail="Lock the script before generating a shot breakdown")
    return generate_shot_breakdown(episode.script_text)


@app.get("/episodes/{episode_id}/shots", response_model=list[ShotRead])
async def list_shots(episode_id: int, session: AsyncSession = Depends(get_session)) -> list[Shot]:
    result = await session.execute(select(Shot).where(Shot.episode_id == episode_id).order_by(Shot.order_index.asc()))
    return list(result.scalars())


@app.post("/episodes/{episode_id}/shots/begin-production", response_model=list[ShotRead], status_code=201)
async def begin_production(
    episode_id: int,
    payload: BeginProductionRequest,
    session: AsyncSession = Depends(get_session),
) -> list[Shot]:
    episode = await session.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    if not payload.shots:
        raise HTTPException(status_code=400, detail="At least one shot is required")

    existing_result = await session.execute(select(Shot).where(Shot.episode_id == episode_id))
    existing_shots = list(existing_result.scalars())
    if any(shot.generation_started for shot in existing_shots):
        raise HTTPException(status_code=400, detail="Cannot replace a shot list after generation has started")
    for shot in existing_shots:
        await session.delete(shot)

    created: list[Shot] = []
    for index, shot_input in enumerate(payload.shots, start=1):
        shot = Shot(
            episode_id=episode_id,
            order_index=index,
            description=shot_input.description,
            characters=shot_input.characters,
            setting=shot_input.setting,
            mood=shot_input.mood,
            has_dialogue=shot_input.has_dialogue,
            music_notes=shot_input.music_notes,
            status="planned",
            generation_started=False,
            locked=False,
        )
        session.add(shot)
        created.append(shot)

    episode.status = "in_production"
    await session.commit()
    for shot in created:
        await session.refresh(shot)
    return created


@app.patch("/shots/{shot_id}", response_model=ShotRead)
async def update_shot(shot_id: int, payload: ShotUpdate, session: AsyncSession = Depends(get_session)) -> Shot:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    if shot.locked or shot.generation_started:
        locked_fields = {"description", "characters", "setting", "mood", "has_dialogue", "music_notes"}
        if locked_fields.intersection(payload.model_dump(exclude_unset=True)):
            raise HTTPException(status_code=400, detail="Shot creative fields are locked after generation starts")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(shot, key, value)
    await session.commit()
    await session.refresh(shot)
    return shot


@app.get("/shots/{shot_id}/production", response_model=ShotProductionRead)
async def get_shot_production(shot_id: int, session: AsyncSession = Depends(get_session)) -> dict:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    images_result = await session.execute(
        select(Image).where(Image.shot_id == shot_id).order_by(Image.created_at.desc(), Image.id.desc())
    )
    videos_result = await session.execute(
        select(Video).where(Video.shot_id == shot_id).order_by(Video.created_at.desc(), Video.id.desc())
    )
    prompts_result = await session.execute(
        select(PromptHistory).where(PromptHistory.shot_id == shot_id).order_by(PromptHistory.created_at.desc(), PromptHistory.id.desc())
    )
    return {
        "shot": shot,
        "images": list(images_result.scalars()),
        "videos": list(videos_result.scalars()),
        "prompt_history": list(prompts_result.scalars()),
    }


@app.post("/shots/{shot_id}/prompt-assist", response_model=PromptAssistRead)
async def assist_prompt(shot_id: int, payload: PromptAssistRequest, session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    shot_payload = {
        "description": shot.description,
        "characters": shot.characters,
        "setting": shot.setting,
        "mood": shot.mood,
        "has_dialogue": shot.has_dialogue,
        "music_notes": shot.music_notes,
    }
    if payload.target_type == "video":
        prompt = generate_video_prompt(shot_payload)
    else:
        prompt = generate_image_prompt(
            shot_payload,
            payload.frame_type or "first",
            [slot.model_dump() for slot in payload.input_slots],
        )
    return {"prompt": prompt}


@app.post("/shots/{shot_id}/images/generate", response_model=ImageRead, status_code=201)
async def generate_mock_image(
    shot_id: int,
    payload: ImageGenerateRequest,
    session: AsyncSession = Depends(get_session),
) -> Image:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    if payload.frame_type not in {"first", "last"}:
        raise HTTPException(status_code=400, detail="frame_type must be first or last")

    shot.generation_started = True
    if shot.status == "planned":
        shot.status = "active"
    if payload.frame_type == "first":
        shot.status = "frames_in_progress"

    image = Image(
        shot_id=shot_id,
        frame_type=payload.frame_type,
        prompt=payload.prompt,
        resolution=payload.resolution,
        aspect_ratio=payload.aspect_ratio,
        provider="mock",
        prediction_id=f"mock-image-{uuid4().hex[:10]}",
        file_path=f"/mock-assets/sample-{payload.frame_type}.svg",
        approved=False,
        input_slots=[slot.model_dump() for slot in payload.input_slots],
    )
    history = PromptHistory(
        shot_id=shot_id,
        target_type=f"image_{payload.frame_type}",
        prompt=payload.prompt,
        provider="mock",
        model="mock-generation",
    )
    session.add_all([image, history])
    await session.commit()
    await session.refresh(image)
    return image


@app.post("/images/{image_id}/approve", response_model=ImageRead)
async def approve_image(image_id: int, session: AsyncSession = Depends(get_session)) -> Image:
    image = await session.get(Image, image_id)
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    shot = await session.get(Shot, image.shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")

    existing_result = await session.execute(
        select(Image).where(Image.shot_id == image.shot_id, Image.frame_type == image.frame_type)
    )
    for existing in existing_result.scalars():
        existing.approved = existing.id == image.id

    if image.frame_type == "first":
        shot.status = "frames_in_progress"
    else:
        first_result = await session.execute(
            select(Image).where(Image.shot_id == image.shot_id, Image.frame_type == "first", Image.approved.is_(True))
        )
        if first_result.scalar_one_or_none() is not None:
            shot.status = "frames_approved"

    await session.commit()
    await session.refresh(image)
    return image


@app.post("/shots/{shot_id}/videos/generate", response_model=VideoRead, status_code=201)
async def generate_mock_video(
    shot_id: int,
    payload: VideoGenerateRequest,
    session: AsyncSession = Depends(get_session),
) -> Video:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")

    first_result = await session.execute(
        select(Image).where(Image.shot_id == shot_id, Image.frame_type == "first", Image.approved.is_(True))
    )
    last_result = await session.execute(
        select(Image).where(Image.shot_id == shot_id, Image.frame_type == "last", Image.approved.is_(True))
    )
    if first_result.scalar_one_or_none() is None or last_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="Approve first and last frames before generating video")

    seed = payload.seed or int(uuid4().int % 2_147_483_647)
    shot.status = "video_in_progress"
    video = Video(
        shot_id=shot_id,
        prompt=payload.prompt,
        model=payload.model,
        duration_seconds=payload.duration_seconds,
        fps=payload.fps,
        resolution=payload.resolution,
        draft_mode=payload.draft_mode,
        seed=seed,
        provider="mock",
        prediction_id=f"mock-video-{uuid4().hex[:10]}",
        file_path="",
        approved=False,
    )
    history = PromptHistory(
        shot_id=shot_id,
        target_type="video",
        prompt=payload.prompt,
        provider="mock",
        model=payload.model,
    )
    session.add_all([video, history])
    await session.commit()
    await session.refresh(video)
    return video


@app.post("/videos/{video_id}/approve", response_model=VideoRead)
async def approve_video(video_id: int, session: AsyncSession = Depends(get_session)) -> Video:
    video = await session.get(Video, video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    shot = await session.get(Shot, video.shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")

    existing_result = await session.execute(select(Video).where(Video.shot_id == video.shot_id))
    for existing in existing_result.scalars():
        existing.approved = existing.id == video.id
    shot.status = "approved"
    shot.locked = True
    await session.commit()
    await session.refresh(video)
    return video


@app.get("/library", response_model=list[LoreEntryRead])
async def list_library(
    q: str = Query(default=""),
    entry_type: str = Query(default=""),
    session: AsyncSession = Depends(get_session),
) -> list[LoreEntry]:
    stmt = select(LoreEntry)
    if entry_type:
        stmt = stmt.where(LoreEntry.entry_type == entry_type)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                LoreEntry.title.ilike(like),
                LoreEntry.content.ilike(like),
                LoreEntry.source_filename.ilike(like),
            )
        )
    result = await session.execute(stmt.order_by(LoreEntry.updated_at.desc(), LoreEntry.id.desc()))
    return list(result.scalars())


@app.post("/library", response_model=LoreEntryRead, status_code=201)
async def create_library_entry(payload: LoreEntryCreate, session: AsyncSession = Depends(get_session)) -> LoreEntry:
    entry = LoreEntry(**payload.model_dump())
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


@app.patch("/library/{entry_id}", response_model=LoreEntryRead)
async def update_library_entry(
    entry_id: int,
    payload: LoreEntryUpdate,
    session: AsyncSession = Depends(get_session),
) -> LoreEntry:
    entry = await session.get(LoreEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Library entry not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    await session.commit()
    await session.refresh(entry)
    return entry


@app.delete("/library/{entry_id}", status_code=204)
async def delete_library_entry(entry_id: int, session: AsyncSession = Depends(get_session)) -> None:
    entry = await session.get(LoreEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Library entry not found")
    await session.delete(entry)
    await session.commit()


app.mount("/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")
app.mount("/mock-assets", StaticFiles(directory=MOCK_ASSET_ROOT), name="mock-assets")
