"""FastAPI server for ArgMap."""
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from argmap.extract import extract_argument_map, extract_argument_map_stream
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
    saved_hash: Optional[str] = None


def save_query(req: ExtractRequest) -> str:
    """Save a query to the saved/ directory and return its hash."""
    saved_dir = Path("saved")
    saved_dir.mkdir(exist_ok=True)

    # Create query data with timestamp
    query_data = {
        "text": req.text,
        "temperature": req.temperature,
        "model": req.model,
        "timestamp": datetime.now().isoformat()
    }

    # Generate hash from the query content (excluding timestamp and api_key)
    query_str = json.dumps(
        {k: v for k, v in query_data.items() if k != "timestamp"},
        sort_keys=True
    )
    query_hash = hashlib.sha256(query_str.encode()).hexdigest()[:12]

    # Save to file
    file_path = saved_dir / f"{query_hash}.json"
    with open(file_path, 'w') as f:
        json.dump(query_data, f, indent=2)

    return query_hash


def save_results(query_hash: str, response: dict) -> None:
    """Save full results to saved-results/ directory."""
    results_dir = Path("saved-results")
    results_dir.mkdir(exist_ok=True)

    file_path = results_dir / f"{query_hash}.json"
    with open(file_path, 'w') as f:
        json.dump(response, f, indent=2)


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

        # Save query and results
        saved_hash = save_query(req)

        response = ExtractResponse(
            success=True,
            result=argument_map.model_dump(),
            saved_hash=saved_hash
        )

        # Cache full results
        save_results(saved_hash, response.model_dump())

        return response

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


@app.get("/api/saved")
def list_saved_queries() -> List[Dict[str, Any]]:
    """List all saved queries with previews."""
    saved_dir = Path("saved")
    if not saved_dir.exists():
        return []

    queries = []
    for file_path in saved_dir.glob("*.json"):
        try:
            with open(file_path) as f:
                data = json.load(f)
                queries.append({
                    "hash": file_path.stem,
                    "text": data.get("text", ""),
                    "timestamp": data.get("timestamp"),
                    "temperature": data.get("temperature"),
                    "model": data.get("model")
                })
        except Exception:
            continue

    # Sort by timestamp (newest first)
    queries.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return queries


@app.get("/api/saved/{query_hash}")
def get_saved_query(query_hash: str) -> Dict[str, Any]:
    """Retrieve a specific saved query by hash."""
    file_path = Path("saved") / f"{query_hash}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Saved query not found")

    with open(file_path) as f:
        return json.load(f)


@app.get("/api/results/{query_hash}")
def get_saved_results(query_hash: str) -> Dict[str, Any]:
    """Retrieve cached results for a saved query."""
    file_path = Path("saved-results") / f"{query_hash}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Cached results not found")

    with open(file_path) as f:
        return json.load(f)


@app.post("/api/extract/stream")
async def extract_argument_stream(
    req: ExtractRequest,
    x_api_key: Optional[str] = Header(None)
):
    """
    Extract argument map from text with streaming response.

    Streams JSON chunks as they're generated, then sends the final parsed result.
    This keeps the connection alive during LLM processing to avoid timeouts.
    """
    api_key = x_api_key or req.api_key
    if api_key:
        set_request_api_key(api_key)

    def generate():
        try:
            # Stream the JSON generation
            full_json = ""
            gen = extract_argument_map_stream(
                req.text,
                api_key=api_key,
                temperature=req.temperature,
                model=req.model
            )

            # Yield chunks as they come
            for chunk in gen:
                full_json += chunk
                # Send chunk wrapped in SSE format
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

            # Parse the complete response
            data = json.loads(full_json)

            # Save query and results
            saved_hash = save_query(req)

            # Build the response
            from argmap.schema import Node, Edge, TextSpan, ArgumentMap
            nodes = []
            for node_data in data.get("nodes", []):
                span = None
                if node_data.get("span"):
                    span = TextSpan(**node_data["span"])
                nodes.append(Node(
                    id=node_data["id"],
                    content=node_data["content"],
                    type=node_data["type"],
                    rhetorical_force=node_data.get("rhetorical_force"),
                    span=span
                ))

            edges = []
            for edge_data in data.get("edges", []):
                edges.append(Edge(
                    source=edge_data["source"],
                    target=edge_data["target"],
                    type=edge_data["type"],
                    explanation=edge_data.get("explanation")
                ))

            argument_map = ArgumentMap(
                source_text=req.text,
                nodes=nodes,
                edges=edges,
                summary=data.get("summary"),
                key_tensions=data.get("key_tensions")
            )

            response = ExtractResponse(
                success=True,
                result=argument_map.model_dump(),
                saved_hash=saved_hash
            )

            # Cache full results
            save_results(saved_hash, response.model_dump())

            # Send final result
            yield f"data: {json.dumps({'type': 'result', 'data': response.model_dump()})}\n\n"

        except LLMNotConfigured as e:
            yield f"data: {json.dumps({'type': 'error', 'error': f'LLM not configured: {str(e)}'})}\n\n"
        except LLMConfigurationError as e:
            yield f"data: {json.dumps({'type': 'error', 'error': f'LLM configuration error: {str(e)}'})}\n\n"
        except ValueError as e:
            yield f"data: {json.dumps({'type': 'error', 'error': f'Extraction error: {str(e)}'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': f'Unexpected error: {str(e)}'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
