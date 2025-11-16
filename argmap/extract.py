"""Core extraction logic for argument maps."""
import json
from typing import Optional

from .llm import generate_json, set_request_api_key
from .schema import ArgumentMap, Node, Edge, TextSpan
from .prompts import EXTRACTION_SYSTEM, make_extraction_prompt


def extract_argument_map(
    text: str,
    *,
    api_key: Optional[str] = None,
    temperature: float = 0.0,
    model: Optional[str] = None
) -> ArgumentMap:
    """
    Extract an argument map from text using LLM.

    Args:
        text: The source text to analyze
        api_key: Optional API key (uses env var if not provided)
        temperature: LLM temperature (0.0 for deterministic)
        model: Optional model override

    Returns:
        ArgumentMap with nodes, edges, summary, and key tensions
    """
    if api_key:
        set_request_api_key(api_key)

    prompt = make_extraction_prompt(text)

    kwargs = {
        "prompt": prompt,
        "system": EXTRACTION_SYSTEM,
        "temperature": temperature
    }
    if model:
        kwargs["model"] = model

    response_text = generate_json(**kwargs)

    # Parse the JSON response
    try:
        data = json.loads(response_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}")

    # Convert to Pydantic models with validation
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

    return ArgumentMap(
        source_text=text,
        nodes=nodes,
        edges=edges,
        summary=data.get("summary"),
        key_tensions=data.get("key_tensions")
    )
