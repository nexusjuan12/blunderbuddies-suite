import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./blunderbuddies.db")

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    from models import Base as ModelsBase

    async with engine.begin() as conn:
        await conn.run_sync(ModelsBase.metadata.create_all)
        if DATABASE_URL.startswith("sqlite"):
            result = await conn.exec_driver_sql("PRAGMA table_info(lore_entries)")
            existing_columns = {row[1] for row in result.fetchall()}
            migrations = {
                "asset_kind": "ALTER TABLE lore_entries ADD COLUMN asset_kind VARCHAR(32)",
                "mime_type": "ALTER TABLE lore_entries ADD COLUMN mime_type VARCHAR(255)",
                "source_filename": "ALTER TABLE lore_entries ADD COLUMN source_filename VARCHAR(512)",
            }
            for column, statement in migrations.items():
                if column not in existing_columns:
                    await conn.exec_driver_sql(statement)
            for table, statements in {
                "images": {
                    "input_slots": "ALTER TABLE images ADD COLUMN input_slots JSON",
                    "updated_at": "ALTER TABLE images ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
                },
                "videos": {
                    "resolution": "ALTER TABLE videos ADD COLUMN resolution VARCHAR(32) DEFAULT '720p'",
                    "updated_at": "ALTER TABLE videos ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
                },
                "prompt_history": {
                    "updated_at": "ALTER TABLE prompt_history ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
                },
            }.items():
                table_result = await conn.exec_driver_sql(f"PRAGMA table_info({table})")
                table_columns = {row[1] for row in table_result.fetchall()}
                for column, statement in statements.items():
                    if table_columns and column not in table_columns:
                        await conn.exec_driver_sql(statement)
