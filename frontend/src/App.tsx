import { useState, useEffect } from 'react';
import ArgumentGraph from './components/ArgumentGraph';
import NodeDetails from './components/NodeDetails';
import type { ArgumentMap, Node, Edge, ExtractResponse } from './types';
import { API_BASE_URL } from './config';

function App() {
  const [text, setText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArgumentMap | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'json' | 'summary'>('graph');
  const [savedHash, setSavedHash] = useState<string | null>(null);
  const [shouldAutoAnalyze, setShouldAutoAnalyze] = useState(false);
  const [streamingChunks, setStreamingChunks] = useState<string>('');

  // Load saved query from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const savedHashParam = urlParams.get('saved');

    if (savedHashParam) {
      // Try to load cached results first
      fetch(`${API_BASE_URL}/api/results/${savedHashParam}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('No cached results');
        })
        .then((data) => {
          if (data.success && data.result) {
            setResult(data.result);
            setSavedHash(data.saved_hash);
            // Also load the query parameters
            return fetch(`${API_BASE_URL}/api/saved/${savedHashParam}`);
          }
          throw new Error('Invalid cached data');
        })
        .then((res) => res.json())
        .then((queryData) => {
          setText(queryData.text || '');
        })
        .catch(() => {
          // Fall back to loading query and re-analyzing
          fetch(`${API_BASE_URL}/api/saved/${savedHashParam}`)
            .then((res) => res.json())
            .then((data) => {
              setText(data.text || '');
              if (data.text?.trim()) {
                setShouldAutoAnalyze(true);
              }
            })
            .catch((err) => {
              console.error('Failed to load saved query:', err);
              setError(`Failed to load saved query: ${err.message}`);
            });
        });
    }
  }, []);

  // Auto-analyze when flag is set
  useEffect(() => {
    if (shouldAutoAnalyze && text.trim()) {
      setShouldAutoAnalyze(false);
      handleExtract();
    }
  }, [shouldAutoAnalyze, text]);

  const handleExtract = async () => {
    if (!text.trim()) {
      setError('Please enter some text to analyze');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSavedHash(null);
    setStreamingChunks('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/extract/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        body: JSON.stringify({ text, api_key: apiKey || undefined }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'chunk') {
                setStreamingChunks((prev) => prev + event.content);
              } else if (event.type === 'result') {
                const data: ExtractResponse = event.data;
                if (!data.success) {
                  setError(data.error || 'Unknown error occurred');
                } else if (data.result) {
                  setResult(data.result);
                  if (data.saved_hash) {
                    setSavedHash(data.saved_hash);
                    const newUrl = `${window.location.pathname}?saved=${data.saved_hash}`;
                    window.history.pushState({}, '', newUrl);
                  }
                }
              } else if (event.type === 'error') {
                setError(event.error);
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setStreamingChunks('');
    }
  };

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const handleEdgeClick = (edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const handleCloseDetails = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ArgMap</h1>
            <p className="text-sm text-gray-600">Open-ended argument mapping</p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/saved"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              📚 Saved Queries
            </a>
            <div className="w-80">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key (optional)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="GEMINI_API_KEY or leave empty"
              />
            </div>
            <a
              href="https://github.com/namin/argmap"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70 transition-opacity"
            >
              <img
                src="/github-mark.png"
                alt="GitHub"
                className="w-8 h-8"
              />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text to Analyze
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="Enter philosophical text or any argumentative content..."
            />
          </div>

          <button
            onClick={handleExtract}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Extracting...' : 'Extract Argument Map'}
          </button>

          {loading && streamingChunks && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
              <div className="font-medium mb-2">Receiving response... ({streamingChunks.length} characters)</div>
              <div className="text-xs font-mono bg-blue-100 p-2 rounded max-h-32 overflow-y-auto">
                {streamingChunks.slice(-500)}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {savedHash && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
              Saved! Shareable link:{' '}
              <a
                href={`/?saved=${savedHash}`}
                className="font-mono underline hover:text-green-900"
              >
                /?saved={savedHash}
              </a>
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('graph')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === 'graph'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Graph View
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === 'summary'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === 'json'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  JSON
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="flex">
              <div className="flex-1 p-6">
                {activeTab === 'graph' && (
                  <ArgumentGraph
                    data={result}
                    onNodeClick={handleNodeClick}
                    onEdgeClick={handleEdgeClick}
                  />
                )}

                {activeTab === 'summary' && (
                  <div className="space-y-6">
                    {result.summary && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Summary</h3>
                        <p className="text-gray-700">{result.summary}</p>
                      </div>
                    )}

                    {result.key_tensions && result.key_tensions.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Key Tensions</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {result.key_tensions.map((tension, i) => (
                            <li key={i} className="text-gray-700">
                              {tension}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-semibold mb-2">Statistics</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded">
                          <div className="text-2xl font-bold text-blue-600">
                            {result.nodes.length}
                          </div>
                          <div className="text-sm text-gray-600">Nodes</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded">
                          <div className="text-2xl font-bold text-green-600">
                            {result.edges.length}
                          </div>
                          <div className="text-sm text-gray-600">Edges</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-2">Node Types</h3>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(new Set(result.nodes.map((n) => n.type))).map((type) => (
                          <span
                            key={type}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                          >
                            {type} ({result.nodes.filter((n) => n.type === type).length})
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-2">Edge Types</h3>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(new Set(result.edges.map((e) => e.type))).map((type) => (
                          <span
                            key={type}
                            className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                          >
                            {type} ({result.edges.filter((e) => e.type === type).length})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'json' && (
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                )}
              </div>

              {/* Details Panel */}
              {(selectedNode || selectedEdge) && (
                <div className="w-96 border-l border-gray-200">
                  <NodeDetails
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    argumentMap={result}
                    onClose={handleCloseDetails}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
