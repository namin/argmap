# ArgMap

_open-ended argument mapping_

## Features

- **Open-ended types**: LLM chooses appropriate node and edge types for each argument
- **Provenance tracking**: Links claims back to exact positions in source text
- **Interactive visualization**: Force-directed graph with draggable nodes
- **Flexible API**: Supports Gemini API key or Google Cloud Project authentication

## Quick Start

### Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Set your API key (one of these options)
export GEMINI_API_KEY="your-key"
# OR
export GOOGLE_CLOUD_PROJECT="your-project"

# Run the server
python server.py
```

Server runs at http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173

## Usage

1. Enter philosophical or argumentative text
2. (Optional) Enter your Gemini API key
3. Click "Extract Argument Map"
4. Explore the graph, summary, and JSON output
5. Click on nodes/edges to see details

## API

### POST /api/extract

Extract argument map from text.

Request:
```json
{
  "text": "Your philosophical text here...",
  "api_key": "optional-api-key",
  "temperature": 0.0,
  "model": "gemini-2.5-flash"
}
```

Response:
```json
{
  "success": true,
  "result": {
    "version": "1.0",
    "source_text": "...",
    "nodes": [
      {
        "id": "n1",
        "content": "the claim",
        "type": "premise",
        "rhetorical_force": "asserts",
        "span": {"start": 0, "end": 50}
      }
    ],
    "edges": [
      {
        "source": "n1",
        "target": "n2",
        "type": "supports",
        "explanation": "provides evidence for"
      }
    ],
    "summary": "Overview of the argument",
    "key_tensions": ["list of gaps or issues"]
  }
}
```

## Environment Variables

- `GEMINI_API_KEY`: Gemini API key
- `GOOGLE_CLOUD_PROJECT`: Google Cloud project (for Vertex AI)
- `GOOGLE_CLOUD_LOCATION`: Cloud location (default: us-central1)
- `LLM_MODEL`: Model to use (default: gemini-2.5-flash)
- `CACHE_LLM`: Enable LLM response caching
- `LLM_CACHE_DIR`: Cache directory (default: .cache/llm)

## Project Structure

```
argmap/
├── argmap/
│   ├── llm.py           # LLM client with dual auth
│   ├── schema.py        # Pydantic models
│   ├── prompts.py       # Extraction prompts
│   └── extract.py       # Core extraction logic
├── frontend/
│   ├── src/
│   │   ├── App.tsx      # Main application
│   │   ├── types/       # TypeScript types
│   │   └── components/
│   │       ├── ArgumentGraph.tsx  # Graph visualization
│   │       └── NodeDetails.tsx    # Detail panel
├── server.py            # FastAPI server
└── requirements.txt
```

## License

MIT
