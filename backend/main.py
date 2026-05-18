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
from models import AudioLine, Episode, Image, LoreEntry, MusicTrack, PromptHistory, Shot, Video
from schemas import (
    AssemblyRead,
    AudioLineRead,
    AudioLineUpdate,
    BeginProductionRequest,
    ChatRead,
    ChatRequest,
    EpisodeCreate,
    EpisodeRead,
    EpisodeUpdate,
    EpisodeAudioRead,
    ImageGenerateRequest,
    ImageRead,
    LoreEntryCreate,
    LoreEntryRead,
    LoreEntryUpdate,
    MusicTrackCreate,
    MusicTrackRead,
    MusicTrackUpdate,
    PromptAssistRead,
    PromptAssistRequest,
    ShotRead,
    ShotProductionRead,
    ShotSplitRequest,
    ShotUpdate,
    UploadRead,
    VideoGenerateRequest,
    VideoRead,
)
from services.llm_service import generate_image_prompt, generate_shot_breakdown, generate_video_prompt
from services.audio_service import pad_audio
from services import replicate_service

UPLOAD_ROOT = Path(os.getenv("UPLOADS_DIR", "./uploads")).resolve()
LIBRARY_UPLOAD_DIR = UPLOAD_ROOT / "library"
LIBRARY_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MOCK_ASSET_ROOT = (Path(__file__).resolve().parent.parent / "mock-assets").resolve()
OUTPUTS_ROOT = Path(os.getenv("OUTPUTS_DIR", "../outputs")).resolve()

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


def public_upload_path(path: Path) -> str:
    return f"/uploads/{path.relative_to(UPLOAD_ROOT).as_posix()}"


def slugify(value: str) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "_" for char in value).strip("_")
    return "_".join(part for part in cleaned.split("_") if part) or "episode"


def resolve_asset_path(file_path: str) -> Path | None:
    if not file_path:
        return None
    if file_path.startswith("/uploads/"):
        path = UPLOAD_ROOT / file_path.removeprefix("/uploads/")
    elif file_path.startswith("/mock-assets/"):
        path = MOCK_ASSET_ROOT / file_path.removeprefix("/mock-assets/")
    else:
        path = Path(file_path)
    return path if path.exists() else None


def copy_asset(file_path: str, destination: Path) -> str:
    source = resolve_asset_path(file_path)
    if source is None:
        return ""
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() == destination.resolve():
        return destination.name
    shutil.copy2(source, destination)
    return destination.name


def generation_mode() -> str:
    return os.getenv("GENERATION_MODE", "mock").lower()


def asset_for_replicate(file_path: str) -> str:
    if not file_path:
        return ""
    if file_path.startswith("http://") or file_path.startswith("https://"):
        return file_path
    source = resolve_asset_path(file_path)
    if source is None:
        raise HTTPException(status_code=400, detail=f"Asset is not available locally: {file_path}")
    return replicate_service.upload_reference_file(source)


def save_remote_generated_asset(url: str, folder: str, suffix: str) -> str:
    destination = UPLOAD_ROOT / "generated" / folder / f"{uuid4().hex}{suffix}"
    replicate_service.download_output_to_path(url, destination)
    return public_upload_path(destination)

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


@app.get("/config")
async def config() -> dict[str, str]:
    return {
        "llm_provider": os.getenv("LLM_PROVIDER", "mock"),
        "generation_mode": os.getenv("GENERATION_MODE", "mock"),
        "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o"),
    }


@app.post("/assistant/chat", response_model=ChatRead)
async def assistant_chat(payload: ChatRequest, session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    entries = []
    if payload.context_entry_ids:
        result = await session.execute(select(LoreEntry).where(LoreEntry.id.in_(payload.context_entry_ids)))
        entries = [
            {
                "title": entry.title,
                "content": entry.content,
                "entry_type": entry.entry_type,
                "tags": entry.tags,
            }
            for entry in result.scalars()
        ]
    from services.llm_service import generate_chat_response

    try:
        response = await generate_chat_response(
            payload.system_prompt,
            [message.model_dump() for message in payload.messages],
            entries,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Assistant request failed: {exc}") from exc
    return {"response": response}


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
    try:
        return await generate_shot_breakdown(episode.script_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Shot breakdown failed: {exc}") from exc


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


@app.post("/shots/{shot_id}/split", response_model=list[ShotRead], status_code=201)
async def split_shot(shot_id: int, payload: ShotSplitRequest, session: AsyncSession = Depends(get_session)) -> list[Shot]:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    if shot.generation_started or shot.locked:
        raise HTTPException(status_code=400, detail="Cannot split a shot after generation has started")

    if payload.first_description:
        shot.description = payload.first_description

    later_result = await session.execute(
        select(Shot)
        .where(Shot.episode_id == shot.episode_id, Shot.order_index > shot.order_index)
        .order_by(Shot.order_index.desc())
    )
    for later_shot in later_result.scalars():
        later_shot.order_index += 1

    new_shot = Shot(
        episode_id=shot.episode_id,
        order_index=shot.order_index + 1,
        description=payload.second_description or f"Continuation of shot {shot.order_index}",
        characters=shot.characters,
        setting=shot.setting,
        mood=shot.mood,
        has_dialogue=shot.has_dialogue,
        music_notes=shot.music_notes,
        status="planned",
        generation_started=False,
        locked=False,
    )
    session.add(new_shot)
    await session.commit()

    result = await session.execute(select(Shot).where(Shot.episode_id == shot.episode_id).order_by(Shot.order_index.asc()))
    return list(result.scalars())


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
        prompt = await generate_video_prompt(shot_payload)
    else:
        prompt = await generate_image_prompt(
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

    provider = generation_mode()
    prediction_id = f"mock-image-{uuid4().hex[:10]}"
    file_path = f"/mock-assets/sample-{payload.frame_type}.svg"
    if provider == "replicate":
        try:
            image_inputs = [asset_for_replicate(slot.file_path or slot.url or "") for slot in payload.input_slots]
            image_inputs = [item for item in image_inputs if item]
            output_url = replicate_service.generate_image(payload.prompt, image_inputs, payload.resolution, payload.aspect_ratio)
            file_path = save_remote_generated_asset(output_url, "images", ".png")
            prediction_id = output_url
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Replicate image generation failed: {exc}") from exc
    elif provider != "mock":
        raise HTTPException(status_code=400, detail="GENERATION_MODE must be mock or replicate")

    image = Image(
        shot_id=shot_id,
        frame_type=payload.frame_type,
        prompt=payload.prompt,
        resolution=payload.resolution,
        aspect_ratio=payload.aspect_ratio,
        provider=provider,
        prediction_id=prediction_id,
        file_path=file_path,
        approved=False,
        input_slots=[slot.model_dump() for slot in payload.input_slots],
    )
    history = PromptHistory(
        shot_id=shot_id,
        target_type=f"image_{payload.frame_type}",
        prompt=payload.prompt,
        provider=provider,
        model="replicate" if provider == "replicate" else "mock-generation",
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
    first_frame = first_result.scalar_one_or_none()
    last_frame = last_result.scalar_one_or_none()
    if first_frame is None or last_frame is None:
        raise HTTPException(status_code=400, detail="Approve first and last frames before generating video")

    seed = payload.seed or int(uuid4().int % 2_147_483_647)
    if payload.upgrade_from_video_id:
        previous = await session.get(Video, payload.upgrade_from_video_id)
        if previous is None or previous.shot_id != shot_id:
            raise HTTPException(status_code=404, detail="Source draft video not found")
        seed = previous.seed or seed

    shot.status = "video_in_progress"
    provider = generation_mode()
    prediction_id = f"mock-video-{uuid4().hex[:10]}"
    file_path = ""
    if provider == "replicate":
        try:
            image_url = asset_for_replicate(first_frame.file_path)
            audio_url = asset_for_replicate(payload.audio_url) if payload.audio_url else ""
            output_url = replicate_service.generate_video(
                payload.prompt,
                image_url,
                audio_url,
                payload.duration_seconds,
                payload.resolution,
                payload.fps,
                payload.draft_mode,
                seed,
            )
            file_path = save_remote_generated_asset(output_url, "videos", ".mp4")
            prediction_id = output_url
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Replicate video generation failed: {exc}") from exc
    elif provider != "mock":
        raise HTTPException(status_code=400, detail="GENERATION_MODE must be mock or replicate")

    video = Video(
        shot_id=shot_id,
        prompt=payload.prompt,
        model=payload.model,
        duration_seconds=payload.duration_seconds,
        fps=payload.fps,
        resolution=payload.resolution,
        draft_mode=payload.draft_mode,
        seed=seed,
        provider=provider,
        prediction_id=prediction_id,
        file_path=file_path,
        approved=False,
    )
    history = PromptHistory(
        shot_id=shot_id,
        target_type="video",
        prompt=payload.prompt,
        provider=provider,
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


async def ensure_audio_lines(episode_id: int, session: AsyncSession) -> list[AudioLine]:
    shots_result = await session.execute(
        select(Shot).where(Shot.episode_id == episode_id, Shot.has_dialogue.is_(True)).order_by(Shot.order_index.asc())
    )
    shots = list(shots_result.scalars())
    created: list[AudioLine] = []
    for shot in shots:
        existing_result = await session.execute(select(AudioLine).where(AudioLine.shot_id == shot.id))
        existing_names = {line.character_name for line in existing_result.scalars()}
        character_names = shot.characters or ["Dialogue"]
        for character_name in character_names:
            if character_name not in existing_names:
                line = AudioLine(
                    shot_id=shot.id,
                    character_name=character_name,
                    line_text="",
                )
                session.add(line)
                created.append(line)
    if created:
        await session.commit()
        for line in created:
            await session.refresh(line)
    return created


@app.get("/episodes/{episode_id}/audio", response_model=EpisodeAudioRead)
async def get_episode_audio(episode_id: int, session: AsyncSession = Depends(get_session)) -> dict:
    episode = await session.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    await ensure_audio_lines(episode_id, session)

    shots_result = await session.execute(
        select(Shot).where(Shot.episode_id == episode_id, Shot.has_dialogue.is_(True)).order_by(Shot.order_index.asc())
    )
    shots = list(shots_result.scalars())
    dialogue_shots = []
    for shot in shots:
        lines_result = await session.execute(select(AudioLine).where(AudioLine.shot_id == shot.id).order_by(AudioLine.id.asc()))
        dialogue_shots.append({"shot": shot, "lines": list(lines_result.scalars())})

    music_result = await session.execute(
        select(MusicTrack).where(MusicTrack.episode_id == episode_id).order_by(MusicTrack.id.desc())
    )
    return {"dialogue_shots": dialogue_shots, "music_tracks": list(music_result.scalars())}


@app.patch("/audio-lines/{line_id}", response_model=AudioLineRead)
async def update_audio_line(
    line_id: int,
    payload: AudioLineUpdate,
    session: AsyncSession = Depends(get_session),
) -> AudioLine:
    line = await session.get(AudioLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="Audio line not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(line, key, value)
    await session.commit()
    await session.refresh(line)
    return line


@app.post("/audio-lines/{line_id}/upload", response_model=AudioLineRead)
async def upload_audio_line(
    line_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> AudioLine:
    line = await session.get(AudioLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="Audio line not found")
    asset_kind, suffix = classify_asset(file.content_type, file.filename)
    if asset_kind != "audio":
        raise HTTPException(status_code=400, detail="Audio lines only accept audio files")

    destination_dir = UPLOAD_ROOT / "audio-lines"
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / f"{uuid4().hex}{suffix}"
    with destination.open("wb") as output:
        shutil.copyfileobj(file.file, output)
    line.file_path = public_upload_path(destination)
    await session.commit()
    await session.refresh(line)
    return line


@app.post("/audio-lines/{line_id}/pad", response_model=AudioLineRead)
async def pad_audio_line(line_id: int, session: AsyncSession = Depends(get_session)) -> AudioLine:
    line = await session.get(AudioLine, line_id)
    if line is None:
        raise HTTPException(status_code=404, detail="Audio line not found")
    if not line.file_path:
        raise HTTPException(status_code=400, detail="Upload audio before applying padding")

    source_path = UPLOAD_ROOT / line.file_path.removeprefix("/uploads/")
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Uploaded audio file not found")
    shot = await session.get(Shot, line.shot_id)
    episode = await session.get(Episode, shot.episode_id) if shot else None
    if shot is None or episode is None:
        raise HTTPException(status_code=404, detail="Shot or episode not found")

    output_dir = OUTPUTS_ROOT / slugify(episode.title) / "audio"
    output_dir.mkdir(parents=True, exist_ok=True)
    character = slugify(line.character_name)
    output_path = output_dir / f"shot_{shot.order_index:02d}_{character}_padded.wav"
    total_duration = pad_audio(str(source_path), str(output_path), line.silence_start_ms, line.silence_end_ms)
    line.padded_file_path = str(output_path)
    line.total_duration_ms = total_duration
    await session.commit()
    await session.refresh(line)
    return line


@app.post("/episodes/{episode_id}/music-tracks", response_model=MusicTrackRead, status_code=201)
async def create_music_track(
    episode_id: int,
    payload: MusicTrackCreate,
    session: AsyncSession = Depends(get_session),
) -> MusicTrack:
    episode = await session.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    track = MusicTrack(episode_id=episode_id, **payload.model_dump())
    session.add(track)
    await session.commit()
    await session.refresh(track)
    return track


@app.patch("/music-tracks/{track_id}", response_model=MusicTrackRead)
async def update_music_track(
    track_id: int,
    payload: MusicTrackUpdate,
    session: AsyncSession = Depends(get_session),
) -> MusicTrack:
    track = await session.get(MusicTrack, track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Music track not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(track, key, value)
    await session.commit()
    await session.refresh(track)
    return track


@app.post("/music-tracks/{track_id}/upload", response_model=MusicTrackRead)
async def upload_music_track(
    track_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> MusicTrack:
    track = await session.get(MusicTrack, track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Music track not found")
    asset_kind, suffix = classify_asset(file.content_type, file.filename)
    if asset_kind != "audio":
        raise HTTPException(status_code=400, detail="Music tracks only accept audio files")
    destination_dir = UPLOAD_ROOT / "music-tracks"
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / f"{uuid4().hex}{suffix}"
    with destination.open("wb") as output:
        shutil.copyfileobj(file.file, output)
    track.file_path = public_upload_path(destination)
    await session.commit()
    await session.refresh(track)
    return track


@app.delete("/music-tracks/{track_id}", status_code=204)
async def delete_music_track(track_id: int, session: AsyncSession = Depends(get_session)) -> None:
    track = await session.get(MusicTrack, track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Music track not found")
    await session.delete(track)
    await session.commit()


async def build_assembly(episode_id: int, session: AsyncSession, export_path: str | None = None) -> dict:
    episode = await session.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    shots_result = await session.execute(select(Shot).where(Shot.episode_id == episode_id).order_by(Shot.order_index.asc()))
    tracks_result = await session.execute(select(MusicTrack).where(MusicTrack.episode_id == episode_id))
    music_tracks = list(tracks_result.scalars())
    rows = []
    for shot in shots_result.scalars():
        first_result = await session.execute(
            select(Image).where(Image.shot_id == shot.id, Image.frame_type == "first", Image.approved.is_(True))
        )
        last_result = await session.execute(
            select(Image).where(Image.shot_id == shot.id, Image.frame_type == "last", Image.approved.is_(True))
        )
        video_result = await session.execute(select(Video).where(Video.shot_id == shot.id, Video.approved.is_(True)))
        audio_result = await session.execute(select(AudioLine).where(AudioLine.shot_id == shot.id))
        lines = list(audio_result.scalars())
        rows.append(
            {
                "shot": shot,
                "first_frame": "approved" if first_result.scalar_one_or_none() else "missing",
                "last_frame": "approved" if last_result.scalar_one_or_none() else "missing",
                "video": "approved" if video_result.scalar_one_or_none() else "missing",
                "audio": "padded" if any(line.padded_file_path for line in lines) else ("uploaded" if any(line.file_path for line in lines) else "missing"),
                "music": "attached" if music_tracks else "none",
            }
        )
    return {"episode": episode, "shots": rows, "export_path": export_path}


@app.get("/episodes/{episode_id}/assembly", response_model=AssemblyRead)
async def get_assembly(episode_id: int, session: AsyncSession = Depends(get_session)) -> dict:
    return await build_assembly(episode_id, session)


@app.post("/episodes/{episode_id}/assembly/export", response_model=AssemblyRead)
async def export_assembly(episode_id: int, session: AsyncSession = Depends(get_session)) -> dict:
    episode = await session.get(Episode, episode_id)
    if episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    output_root = OUTPUTS_ROOT / slugify(episode.title)
    for folder in ("images", "videos", "audio", "music"):
        (output_root / folder).mkdir(parents=True, exist_ok=True)
    assembly = await build_assembly(episode_id, session, str(output_root))
    lines = [
        f"EPISODE: {episode.title}",
        f"BUDDY DAY: {episode.buddy_day_name}",
        f"TYPE: {episode.type}",
        f"TOTAL SHOTS: {len(assembly['shots'])}",
        "",
    ]
    for row in assembly["shots"]:
        shot = row["shot"]
        first_result = await session.execute(
            select(Image).where(Image.shot_id == shot.id, Image.frame_type == "first", Image.approved.is_(True))
        )
        last_result = await session.execute(
            select(Image).where(Image.shot_id == shot.id, Image.frame_type == "last", Image.approved.is_(True))
        )
        video_result = await session.execute(select(Video).where(Video.shot_id == shot.id, Video.approved.is_(True)))
        audio_result = await session.execute(select(AudioLine).where(AudioLine.shot_id == shot.id))
        first_image = first_result.scalar_one_or_none()
        last_image = last_result.scalar_one_or_none()
        video = video_result.scalar_one_or_none()
        audio_lines = list(audio_result.scalars())

        first_name = ""
        if first_image:
            suffix = Path(first_image.file_path).suffix or ".png"
            first_name = copy_asset(first_image.file_path, output_root / "images" / f"shot_{shot.order_index:02d}_first{suffix}")
        last_name = ""
        if last_image:
            suffix = Path(last_image.file_path).suffix or ".png"
            last_name = copy_asset(last_image.file_path, output_root / "images" / f"shot_{shot.order_index:02d}_last{suffix}")
        video_name = ""
        if video and video.file_path:
            suffix = Path(video.file_path).suffix or ".mp4"
            video_name = copy_asset(video.file_path, output_root / "videos" / f"shot_{shot.order_index:02d}{suffix}")
        copied_audio = []
        for audio_line in audio_lines:
            if audio_line.padded_file_path:
                suffix = Path(audio_line.padded_file_path).suffix or ".wav"
                filename = f"shot_{shot.order_index:02d}_{slugify(audio_line.character_name)}_padded{suffix}"
                copied_name = copy_asset(audio_line.padded_file_path, output_root / "audio" / filename)
                if copied_name:
                    copied_audio.append(copied_name)
        lines.extend(
            [
                f"SHOT {shot.order_index:02d} - {shot.description}",
                f"  Characters: {', '.join(shot.characters)}",
                f"  Setting: {shot.setting}",
                f"  Mood: {shot.mood}",
                f"  First Frame: {first_name or row['first_frame']}",
                f"  Last Frame: {last_name or row['last_frame']}",
                f"  Video: {video_name or row['video']}",
                f"  Audio: {', '.join(copied_audio) if copied_audio else row['audio']}",
                f"  Music: {row['music']}",
                f"  Notes: {shot.music_notes}",
                "",
            ]
        )
    music_result = await session.execute(select(MusicTrack).where(MusicTrack.episode_id == episode_id))
    for index, track in enumerate(music_result.scalars(), start=1):
        if track.file_path:
            suffix = Path(track.file_path).suffix or ".wav"
            copy_asset(track.file_path, output_root / "music" / f"track_{index:02d}_{slugify(track.track_type)}{suffix}")
    (output_root / "shot_sheet.txt").write_text("\n".join(lines), encoding="utf-8")
    return assembly


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
