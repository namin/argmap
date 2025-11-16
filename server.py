"""FastAPI server for ArgMap."""
from typing import Optional
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from argmap.extract import extract_argument_map
from argmap.llm import set_request_api_key, LLMConfigurationError, LLMNotConfigured


app = FastAPI(
    title="ArgMap",
    description="Open-ended argument mapping with LLM-chosen ontologies",
    version="0.1.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExtractRequest(BaseModel):
    """Request body for argument extraction."""
    text: str
    api_key: Optional[str] = None
    temperature: float = 0.0
    model: Optional[str] = None


class ExtractResponse(BaseModel):
    """Response from argument extraction."""
    success: bool
    result: Optional[dict] = None
    error: Optional[str] = None


@app.get("/")
def root():
    """Health check."""
    return {"status": "ok", "service": "argmap"}


@app.post("/api/extract", response_model=ExtractResponse)
def extract_argument(
    req: ExtractRequest,
    x_api_key: Optional[str] = Header(None)
):
    """
    Extract argument map from text.

    API key can be provided via:
    - Request body (api_key field)
    - X-API-Key header
    - Environment variable (GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT)
    """
    # Set API key from header or body
    api_key = x_api_key or req.api_key
    if api_key:
        set_request_api_key(api_key)

    try:
        argument_map = extract_argument_map(
            req.text,
            api_key=api_key,
            temperature=req.temperature,
            model=req.model
        )

        return ExtractResponse(
            success=True,
            result=argument_map.model_dump()
        )

    except LLMNotConfigured as e:
        return ExtractResponse(
            success=False,
            error=f"LLM not configured: {str(e)}"
        )
    except LLMConfigurationError as e:
        return ExtractResponse(
            success=False,
            error=f"LLM configuration error: {str(e)}"
        )
    except ValueError as e:
        return ExtractResponse(
            success=False,
            error=f"Extraction error: {str(e)}"
        )
    except Exception as e:
        return ExtractResponse(
            success=False,
            error=f"Unexpected error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
