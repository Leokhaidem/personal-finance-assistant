"""Block until the database accepts connections."""

import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings


def get_sync_database_url() -> str:
    url = settings.DATABASE_URL
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("sqlite+aiosqlite://"):
        return url.replace("sqlite+aiosqlite://", "sqlite://", 1)
    return url


def main() -> None:
    url = get_sync_database_url()
    if url.startswith("sqlite"):
        return

    engine = create_engine(url, pool_pre_ping=True)
    deadline = time.time() + 60

    while time.time() < deadline:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            engine.dispose()
            return
        except OperationalError:
            time.sleep(1)

    engine.dispose()
    print("Database did not become ready within 60 seconds.", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
