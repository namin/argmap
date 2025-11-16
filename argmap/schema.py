"""Pydantic models for open-ended argument maps."""
from typing import Optional, List
from pydantic import BaseModel, Field


class TextSpan(BaseModel):
    """Reference to a span in the source text."""
    start: int = Field(..., description="Start character index (inclusive)")
    end: int = Field(..., description="End character index (exclusive)")


class Node(BaseModel):
    """A node in the argument map representing a claim, concept, or inference."""
    id: str = Field(..., description="Unique identifier for this node")
    content: str = Field(..., description="The actual text/claim")
    type: str = Field(..., description="LLM-chosen type (e.g., 'premise', 'conclusion', 'assumption', 'definition')")
    rhetorical_force: Optional[str] = Field(
        None,
        description="How the claim is presented: 'asserts', 'suggests', 'questions', 'assumes', 'hypothesizes'"
    )
    span: Optional[TextSpan] = Field(
        None,
        description="Location in source text (null if implicit/not directly quoted)"
    )


class Edge(BaseModel):
    """A relationship between two nodes in the argument map."""
    source: str = Field(..., description="ID of the source node")
    target: str = Field(..., description="ID of the target node")
    type: str = Field(..., description="LLM-chosen relationship type (e.g., 'supports', 'attacks', 'presupposes', 'refines')")
    explanation: Optional[str] = Field(
        None,
        description="Brief explanation of why this relationship exists"
    )


class ArgumentMap(BaseModel):
    """Complete argument map extracted from text."""
    version: str = Field(default="1.0", description="Schema version")
    source_text: str = Field(..., description="Original input text")
    nodes: List[Node] = Field(default_factory=list, description="All nodes in the argument")
    edges: List[Edge] = Field(default_factory=list, description="All relationships between nodes")
    summary: Optional[str] = Field(
        None,
        description="Brief overview of the argument's main thrust"
    )
    key_tensions: Optional[List[str]] = Field(
        None,
        description="Identified conflicts, gaps, or unresolved issues"
    )
