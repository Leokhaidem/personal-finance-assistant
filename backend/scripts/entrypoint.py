"""Container entrypoint: wait for DB, run migrations, optionally seed, then start app."""

import os
import subprocess
import sys


def run_command(command: list[str], label: str) -> None:
    print(label)
    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        sys.exit(result.returncode)


def main() -> None:
    run_command([sys.executable, "scripts/wait_for_db.py"], "Waiting for database...")
    run_command(["alembic", "upgrade", "head"], "Running database migrations...")

    if os.getenv("SEED_DATABASE", "false").lower() == "true":
        run_command([sys.executable, "scripts/seed.py"], "Seeding database...")

    print("Starting application...")
    os.execvp(sys.argv[1], sys.argv[1:])


if __name__ == "__main__":
    main()
