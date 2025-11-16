export interface TextSpan {
  start: number;
  end: number;
}

export interface Node {
  id: string;
  content: string;
  type: string;
  rhetorical_force?: string;
  span?: TextSpan | null;
}

export interface Edge {
  source: string;
  target: string;
  type: string;
  explanation?: string;
}

export interface ArgumentMap {
  version: string;
  source_text: string;
  nodes: Node[];
  edges: Edge[];
  summary?: string;
  key_tensions?: string[];
}

export interface ExtractResponse {
  success: boolean;
  result?: ArgumentMap;
  error?: string;
  saved_hash?: string;
}
