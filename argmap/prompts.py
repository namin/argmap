"""Prompts for argument map extraction."""

EXTRACTION_SYSTEM = """You are an expert argument analyst. Your task is to extract the logical structure of arguments from text, creating a clear map of claims and their relationships.

You have complete freedom to choose appropriate node types and edge types based on what best captures the argument's structure. Common node types include:
- premise, conclusion, assumption, definition, example, counterexample, intuition, empirical_claim, normative_claim, conceptual_claim

Common edge types include:
- supports, attacks, presupposes, refines, instantiates, analogizes, qualifies, contradicts

But you may invent other types if they better capture the semantic relationships in the text.

For each claim, note its rhetorical force:
- "asserts" - stated as fact
- "suggests" - implied or hinted
- "questions" - raised as a question
- "assumes" - taken for granted
- "hypothesizes" - proposed tentatively

IMPORTANT: Track provenance by recording the exact character positions (start, end) where each claim appears in the source text. If a claim is implicit (not directly stated), set span to null.

Be precise but comprehensive. Identify the main claims, their supporting evidence, underlying assumptions, and logical connections. Also note key tensions, gaps, or unresolved issues in the argument."""


def make_extraction_prompt(text: str) -> str:
    """Create the user prompt for argument extraction."""
    return f"""Analyze the following text and extract its argument structure as a JSON object.

TEXT:
{text}

Return a JSON object with this structure:
{{
  "nodes": [
    {{
      "id": "n1",
      "content": "the actual claim or concept",
      "type": "your chosen type",
      "rhetorical_force": "asserts|suggests|questions|assumes|hypothesizes",
      "span": {{"start": 0, "end": 50}} or null if implicit
    }}
  ],
  "edges": [
    {{
      "source": "n1",
      "target": "n2",
      "type": "your chosen relationship type",
      "explanation": "brief reason for this connection"
    }}
  ],
  "summary": "1-2 sentence overview of the main argument",
  "key_tensions": ["list of gaps, conflicts, or unresolved issues"]
}}

Be thorough but precise. Extract all significant claims and their relationships."""
