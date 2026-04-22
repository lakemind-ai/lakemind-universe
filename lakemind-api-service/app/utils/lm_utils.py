import json
import os
from pathlib import Path
from typing import Optional


def get_version_info() -> Optional[dict]:
    """Load product version info from version.json."""
    VERSION_FILE = Path("version.json")
    if not VERSION_FILE.exists():
        return {}
    try:
        with open(VERSION_FILE) as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {}


def get_databricks_host() -> Optional[str]:
    host = os.getenv("DATABRICKS_HOST")
    if host and not host.startswith(("http://", "https://")):
        host = f"https://{host}"
    return host
