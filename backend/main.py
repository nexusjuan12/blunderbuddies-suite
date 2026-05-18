from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session, init_db
from models import Episode, LoreEntry
from schemas import (
    EpisodeCreate,
    EpisodeRead,
    EpisodeUpdate,
    LoreEntryCreate,
    LoreEntryRead,
    LoreEntryUpdate,
)

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
        stmt = stmt.where(or_(LoreEntry.title.ilike(like), LoreEntry.content.ilike(like)))
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

