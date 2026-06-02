"""Configuration loaded from environment / .env."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
if getattr(sys, "frozen", False):
    load_dotenv(Path(sys.executable).parent / ".env", override=False)

DEFAULT_MODEL = "qwen/qwen3-30b-a3b-thinking-2507"


@dataclass(frozen=True)
class Settings:
    provider: str            # "auto" | openai | anthropic | bedrock | <preset>
    model: str               # default model (fallback for both tiers)
    model_reasoning: str     # heavy analysis — QoE generation
    model_fast: str          # interactive — chat Q&A / extraction
    base_url: str | None
    api_key: str | None
    aws_region: str
    data_root: Path
    db_path: Path
    index_dir: Path

    @classmethod
    def load(cls) -> "Settings":
        data_root = Path(os.getenv("QOE_DATA_ROOT", "./data"))
        model = os.getenv("LLM_MODEL", DEFAULT_MODEL)
        return cls(
            provider=os.getenv("LLM_PROVIDER", "auto").lower(),
            model=model,
            model_reasoning=os.getenv("LLM_MODEL_REASONING", model),
            model_fast=os.getenv("LLM_MODEL_FAST", model),
            base_url=os.getenv("LLM_BASE_URL"),
            api_key=os.getenv("LLM_API_KEY"),
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            data_root=data_root,
            db_path=Path(os.getenv("QOE_DB_PATH", str(data_root / "qoe.db"))),
            index_dir=Path(os.getenv("QOE_INDEX_DIR", "./index")),
        )


settings = Settings.load()
