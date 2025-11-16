import { useState, useEffect } from 'react';

interface SavedQuery {
  hash: string;
  text: string;
  timestamp: string;
  temperature?: number;
  model?: string;
}

export default function SavedQueries() {
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/saved')
      .then((res) => res.json())
      .then((data) => {
        setQueries(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load saved queries:', err);
        setError(`Failed to load saved queries: ${err.message || err}`);
        setLoading(false);
      });
  }, []);

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const truncateText = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading saved queries...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Saved Queries</h1>
            <p className="text-sm text-gray-600">
              {queries.length} saved argument maps
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            New Analysis
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {queries.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            No saved queries yet. Run an analysis to save it here.
          </div>
        ) : (
          <div className="space-y-4">
            {queries.map((query) => (
              <a
                key={query.hash}
                href={`/?saved=${query.hash}`}
                className="block bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="font-mono text-sm text-blue-600">{query.hash}</div>
                  <div className="text-sm text-gray-500">
                    {formatDate(query.timestamp)}
                  </div>
                </div>
                <div className="text-gray-700 mb-3">{truncateText(query.text)}</div>
                <div className="flex gap-3 text-xs text-gray-500">
                  {query.temperature !== undefined && (
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      temp: {query.temperature}
                    </span>
                  )}
                  {query.model && (
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      model: {query.model}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
