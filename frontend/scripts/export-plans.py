"""Write the backend's plan catalog to src/demo/plans.json, so the demo shows the
real prices. Run from the repo root after changing backend/kothora/plans.py:

    backend/.venv/bin/python frontend/scripts/export-plans.py
"""

import json
import pathlib

from fastapi.testclient import TestClient

from kothora.config import Settings
from kothora.main import create_app

OUTPUT = pathlib.Path(__file__).resolve().parents[1] / "src" / "demo" / "plans.json"

settings = Settings(env="test", database_url="sqlite+aiosqlite:///:memory:")
with TestClient(create_app(settings)) as client:
    plans = client.get("/api/billing/plans").json()
OUTPUT.write_text(json.dumps(plans, indent=2, ensure_ascii=False) + "\n")
print(f"Wrote {len(plans)} plans to {OUTPUT}")
