"""Provider-agnostic LLM client — works with (almost) any API token / provider.

Drop in a token and the client figures out the rest. Set ``LLM_API_KEY`` (or a
standard provider var like ``ANTHROPIC_API_KEY`` / ``OPENAI_API_KEY``); ``LLM_PROVIDER``
selects a backend or a named preset:

    auto (default)   detect from the token prefix / which env var is set
    openai           any OpenAI-compatible endpoint (set LLM_BASE_URL)
    anthropic        Claude, via Anthropic's OpenAI-compatible endpoint
    openrouter / together / fireworks / dashscope / deepinfra
                     named presets — base_url filled in for you, just supply the token
    bedrock          Amazon Bedrock (AWS credentials, not a single token)

Any other OpenAI-compatible provider works via ``LLM_PROVIDER=openai`` + ``LLM_BASE_URL``.

`complete()` / `parse()` take an optional per-call `model` override, which is how the
app runs two tiers (a reasoning model for analysis, a fast model for chat) over one
provider/endpoint. The domain code never imports a vendor SDK.
"""

from __future__ import annotations

import json
import os
import re
from typing import Protocol, Type, TypeVar

from pydantic import BaseModel, ValidationError

from .config import settings

T = TypeVar("T", bound=BaseModel)

PRESET_BASE = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com/v1/",
    "openrouter": "https://openrouter.ai/api/v1",
    "together": "https://api.together.xyz/v1",
    "fireworks": "https://api.fireworks.ai/inference/v1",
    "dashscope": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "deepinfra": "https://api.deepinfra.com/v1/openai",
}

_ENV_KEYS = [
    ("anthropic", "ANTHROPIC_API_KEY"),
    ("openrouter", "OPENROUTER_API_KEY"),
    ("together", "TOGETHER_API_KEY"),
    ("fireworks", "FIREWORKS_API_KEY"),
    ("dashscope", "DASHSCOPE_API_KEY"),
    ("openai", "OPENAI_API_KEY"),
]


# How to ask for JSON back:
#   schema (default) — response_format={"type":"json_schema", strict}, over a
#                      strict-compliant schema (see _strict_schema). Grammar-enforced, so
#                      the JSON always parses and optional fields actually get filled.
#   object           — response_format={"type":"json_object"}; schema guidance from the
#                      prompt only. Use when a provider's strict mode is unreliable.
#   none             — no response_format at all.
JSON_MODE = os.getenv("LLM_JSON_MODE", "schema").lower()


def _strict_schema(node):
    """Make a Pydantic JSON Schema valid for OpenAI-style strict mode.

    Strict mode requires every object to set `additionalProperties: false` and to list
    EVERY property in `required` — Pydantic does neither, omitting any field that has a
    default. Sending its raw output is not merely lax: providers build a broken grammar
    from it and the model decodes until max_tokens, burning ~60s to return truncated
    JSON. Nullable fields keep their null branch, so "required" costs no information.
    """
    if isinstance(node, dict):
        out = {k: _strict_schema(v) for k, v in node.items()}
        if out.get("type") == "object" and "properties" in out:
            out["additionalProperties"] = False
            out["required"] = list(out["properties"].keys())
        return out
    if isinstance(node, list):
        return [_strict_schema(v) for v in node]
    return node


class TruncatedResponse(RuntimeError):
    """The model hit max_tokens mid-object. Retrying the same call won't help."""


def _aws_creds_present() -> bool:
    return bool(os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("AWS_PROFILE"))


def _resolve() -> tuple[str, str | None, str | None, str]:
    provider = (settings.provider or "auto").lower()
    key = settings.api_key
    if not key:
        for name, env in _ENV_KEYS:
            val = os.getenv(env)
            if val:
                key = val
                if provider == "auto":
                    provider = name
                break
    if provider == "auto":
        k = key or ""
        if k.startswith("sk-ant-"):
            provider = "anthropic"
        elif k.startswith("sk-or-"):
            provider = "openrouter"
        elif _aws_creds_present() and not k:
            provider = "bedrock"
        else:
            provider = "openai"
    if provider == "bedrock":
        return "bedrock", None, key, settings.model
    base = settings.base_url or PRESET_BASE.get(provider) or PRESET_BASE["openai"]
    return "openai", base, key, settings.model


def resolved() -> str:
    backend, base, key, model = _resolve()
    where = base if backend == "openai" else f"bedrock/{settings.aws_region}"
    return f"{backend} · {where} · key={'set' if key else 'MISSING'}"


def complete(prompt: str, *, system: str | None = None, model: str | None = None,
             max_tokens: int = 4096, temperature: float = 0.2) -> str:
    return _backend().chat(prompt, system=system, max_tokens=max_tokens,
                           temperature=temperature, model=model)


def ping() -> str:
    """Lightweight connectivity check — confirms the endpoint + token work."""
    return complete("Reply with the single word: ok", max_tokens=16)


def parse(prompt: str, schema: Type[T], *, system: str | None = None, model: str | None = None,
          max_tokens: int = 4096, retries: int = 2) -> T:
    """Completion constrained to a Pydantic schema. Optional per-call `model`."""
    schema_dict = schema.model_json_schema()
    # "Populate every field" matters: without grammar-constrained decoding the model
    # happily omits properties that carry a default (e.g. RedFlagReport.summary), which
    # then silently renders as blank in the UI.
    sys = (system or "").rstrip() + (
        "\n\nReturn ONLY a single JSON object that conforms to this JSON Schema. "
        "Populate EVERY field in the schema — including optional ones — unless the "
        "sources genuinely provide nothing for it. No prose, no markdown fences.\n"
        + json.dumps(schema_dict, indent=2)
    )
    err: Exception | None = None
    attempt_prompt = prompt
    for _ in range(retries + 1):
        raw = _backend().chat(attempt_prompt, system=sys, max_tokens=max_tokens,
                              temperature=0.0, json_schema=schema_dict, model=model)
        try:
            return schema.model_validate_json(_extract_json(raw))
        except (ValidationError, ValueError) as e:
            err = e
            attempt_prompt = prompt + f"\n\nYour previous answer failed validation:\n{e}\nReturn corrected JSON only."
    raise RuntimeError(f"Structured output failed after {retries + 1} attempts: {err}")


class _Backend(Protocol):
    def chat(self, prompt: str, *, system: str | None, max_tokens: int,
             temperature: float, json_schema: dict | None = None,
             model: str | None = None) -> str: ...


_INSTANCE: _Backend | None = None


def _backend() -> _Backend:
    global _INSTANCE
    if _INSTANCE is None:
        kind, base, key, model = _resolve()
        _INSTANCE = _Bedrock(model) if kind == "bedrock" else _OpenAICompatible(base, key, model)
    return _INSTANCE


class _OpenAICompatible:
    """Same client/endpoint for every tier — only the per-call `model` changes."""

    def __init__(self, base_url: str | None, api_key: str | None, model: str) -> None:
        from openai import OpenAI
        self.client = OpenAI(base_url=base_url, api_key=api_key or "EMPTY")
        self.model = model

    def chat(self, prompt, *, system=None, max_tokens=4096, temperature=0.2,
             json_schema=None, model=None) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        kwargs: dict = {"model": model or self.model, "messages": messages,
                        "max_tokens": max_tokens, "temperature": temperature}
        if json_schema is not None and JSON_MODE != "none":
            kwargs["response_format"] = (
                {"type": "json_schema",
                 "json_schema": {"name": "output", "schema": _strict_schema(json_schema),
                                 "strict": True}}
                if JSON_MODE == "schema"
                else {"type": "json_object"}
            )
        try:
            resp = self.client.chat.completions.create(**kwargs)
        except Exception:
            # Provider rejected the response_format — the schema is in the system
            # prompt regardless, so retry unconstrained.
            kwargs.pop("response_format", None)
            resp = self.client.chat.completions.create(**kwargs)
        choice = resp.choices[0]
        # Only fatal for structured output: a truncated JSON object can never validate,
        # so the retry loop would just burn another full generation. Free-text callers
        # (ping, prose completions) are happy with a short answer.
        if json_schema is not None and choice.finish_reason == "length":
            raise TruncatedResponse(
                f"model {kwargs['model']} hit max_tokens ({max_tokens}) before closing the "
                "response; raise max_tokens or shrink the context"
            )
        return choice.message.content or ""


class _Bedrock:
    def __init__(self, model: str) -> None:
        import boto3
        self.client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        self.model = model

    def chat(self, prompt, *, system=None, max_tokens=4096, temperature=0.2,
             json_schema=None, model=None) -> str:
        kwargs: dict = {
            "modelId": model or self.model,
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {"maxTokens": max_tokens, "temperature": temperature},
        }
        if system:
            kwargs["system"] = [{"text": system}]
        resp = self.client.converse(**kwargs)
        return resp["output"]["message"]["content"][0]["text"]


def _extract_json(text: str) -> str:
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        return fenced.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return text
