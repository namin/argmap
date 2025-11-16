import type { Node, Edge, ArgumentMap } from '../types';

interface Props {
  selectedNode?: Node | null;
  selectedEdge?: Edge | null;
  argumentMap: ArgumentMap;
  onClose: () => void;
}

export default function NodeDetails({ selectedNode, selectedEdge, argumentMap, onClose }: Props) {
  if (!selectedNode && !selectedEdge) return null;

  const highlightText = (text: string, start?: number, end?: number) => {
    if (start === undefined || end === undefined) return text;
    return (
      <>
        {text.slice(0, start)}
        <mark className="bg-yellow-200 px-1 rounded">{text.slice(start, end)}</mark>
        {text.slice(end)}
      </>
    );
  };

  return (
    <div className="bg-white border-l border-gray-200 p-6 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Details</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-xl"
        >
          ×
        </button>
      </div>

      {selectedNode && (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-500">ID</div>
            <div className="text-lg font-mono">{selectedNode.id}</div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-500">Type</div>
            <div className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
              {selectedNode.type}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-500">Content</div>
            <div className="text-gray-900 mt-1">{selectedNode.content}</div>
          </div>

          {selectedNode.rhetorical_force && (
            <div>
              <div className="text-sm font-medium text-gray-500">Rhetorical Force</div>
              <div className="inline-block px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                {selectedNode.rhetorical_force}
              </div>
            </div>
          )}

          {selectedNode.span && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-2">Source Text</div>
              <div className="text-sm bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap">
                {highlightText(
                  argumentMap.source_text,
                  selectedNode.span.start,
                  selectedNode.span.end
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Characters {selectedNode.span.start}-{selectedNode.span.end}
              </div>
            </div>
          )}

          {/* Show connected edges */}
          <div>
            <div className="text-sm font-medium text-gray-500 mb-2">Connections</div>
            <div className="space-y-2">
              {argumentMap.edges
                .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                .map((edge, i) => (
                  <div key={i} className="text-sm bg-gray-50 p-2 rounded">
                    <span className="font-mono">{edge.source}</span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className="font-mono">{edge.target}</span>
                    <span className="ml-2 text-gray-600">({edge.type})</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {selectedEdge && (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-500">Connection</div>
            <div className="text-lg">
              <span className="font-mono">{selectedEdge.source}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="font-mono">{selectedEdge.target}</span>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-500">Type</div>
            <div className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
              {selectedEdge.type}
            </div>
          </div>

          {selectedEdge.explanation && (
            <div>
              <div className="text-sm font-medium text-gray-500">Explanation</div>
              <div className="text-gray-900 mt-1">{selectedEdge.explanation}</div>
            </div>
          )}

          {/* Show source and target node content */}
          <div>
            <div className="text-sm font-medium text-gray-500 mb-2">Source Node</div>
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <div className="text-sm font-mono text-gray-600">{selectedEdge.source}</div>
              <div className="text-sm mt-1">
                {argumentMap.nodes.find((n) => n.id === selectedEdge.source)?.content}
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-500 mb-2">Target Node</div>
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <div className="text-sm font-mono text-gray-600">{selectedEdge.target}</div>
              <div className="text-sm mt-1">
                {argumentMap.nodes.find((n) => n.id === selectedEdge.target)?.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
