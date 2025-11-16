"""LLM client infrastructure with dual auth support (Gemini API / Vertex AI)."""
from __future__ import annotations
import os
from typing import Optional, Union
from contextvars import ContextVar

from joblib import Memory
from google import genai
from google.genai import types


class LLMConfigurationError(Exception):
    """Raised when LLM client cannot be initialized."""
    pass


class LLMNotConfigured(LLMConfigurationError):
    """Raised when no API key or project is configured."""
    pass


class LLMCallError(RuntimeError):
    """Raised when LLM call fails."""
    pass


# Configuration
CACHE_LLM = os.getenv("CACHE_LLM") is not None
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")
_GOOGLE_LOCATION_DEFAULT = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

# Request-scoped API key (for multi-user scenarios)
_request_api_key: ContextVar[Optional[str]] = ContextVar('request_api_key', default=None)

# Optional caching
_memory: Optional[Memory] = None
if CACHE_LLM:
    _memory = Memory(os.path.expanduser(os.getenv("LLM_CACHE_DIR", ".cache/llm")), verbose=0)


def set_request_api_key(api_key: Optional[str]) -> None:
    """Set API key for the current request context."""
    _request_api_key.set(api_key)


def get_request_api_key() -> Optional[str]:
    """Get API key from current request context."""
    try:
        return _request_api_key.get()
    except LookupError:
        return None


def init_llm_client(
    api_key: Optional[str] = None,
    project: Optional[str] = None,
    location: Optional[str] = None,
    required: bool = True
):
    """
    Initialize LLM client with priority:
    1. Explicit api_key parameter
    2. Request-scoped API key
    3. GEMINI_API_KEY environment variable
    4. GOOGLE_CLOUD_PROJECT (Vertex AI)
    """
    gemini_api_key = api_key or get_request_api_key() or os.getenv("GEMINI_API_KEY")
    google_cloud_project = project or os.getenv("GOOGLE_CLOUD_PROJECT")
    google_cloud_location = location or _GOOGLE_LOCATION_DEFAULT

    try:
        if gemini_api_key:
            return genai.Client(api_key=gemini_api_key)
        if google_cloud_project:
            return genai.Client(
                vertexai=True,
                project=google_cloud_project,
                location=google_cloud_location
            )
    except Exception as e:
        if required:
            raise LLMConfigurationError(f"Failed to init google-genai client: {e}")
        return None

    if required:
        raise LLMNotConfigured("Set GEMINI_API_KEY.")
    return None


def init_llm_client_if_no_cache(required: bool = True):
    """
    Initialize LLM client only if caching is disabled.
    When caching is enabled, client is created inside cached function.
    """
    return None if CACHE_LLM else init_llm_client(required=required)


def generate_content(client, contents: Union[str, list], config=None, model: str = LLM_MODEL):
    """Generate content with optional caching."""
    if _memory is None:
        return client.models.generate_content(model=model, contents=contents, config=config)

    @(_memory.cache)
    def _cached_call(contents, m, cfg_repr):
        cached_client = init_llm_client(required=True)
        resp = cached_client.models.generate_content(model=m, contents=contents, config=cfg_repr)
        return getattr(resp, "text", None) or getattr(resp, "output_text", None) or ""

    text = _cached_call(contents, model, config)

    class Resp:
        def __init__(self, t):
            self.text = t

    return Resp(text)


def generate_json(
    prompt: str,
    *,
    system: Optional[str] = None,
    temperature: float = 0.0,
    model: str = LLM_MODEL
) -> str:
    """Generate JSON response from LLM."""
    client = init_llm_client_if_no_cache(required=True)
    combined = f"{system}\n\n{prompt}" if system else prompt
    cfg = types.GenerateContentConfig(
        temperature=temperature,
        response_mime_type="application/json"
    )
    resp = generate_content(client, contents=combined, config=cfg, model=model)
    text = getattr(resp, "text", None) or getattr(resp, "output_text", None) or ""

    if not isinstance(text, str):
        raise LLMCallError("LLM returned non-string content for JSON response.")

    return text
