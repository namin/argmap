import { useMemo, useState, useRef, useEffect } from 'react';
import dagre from 'dagre';
import type { ArgumentMap, Node, Edge } from '../types';

interface Props {
  data: ArgumentMap;
  onNodeClick?: (node: Node) => void;
  onEdgeClick?: (edge: Edge) => void;
}

// Generate distinct colors for different types
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, 65%, 55%)`;
}

export default function ArgumentGraph({ data, onNodeClick, onEdgeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);

  const width = 900;
  const height = 600;

  // Compute initial layout using dagre for hierarchical layout
  const initialPositions = useMemo(() => {
    const nodes = data.nodes;
    const edges = data.edges || [];
    const pos: Record<string, { x: number; y: number }> = {};

    // Create a new directed graph
    const g = new dagre.graphlib.Graph();

    // Set graph options for layout
    g.setGraph({
      rankdir: 'TB', // Top to bottom layout (use 'LR' for left-to-right)
      nodesep: 80,   // Horizontal separation between nodes
      ranksep: 100,  // Vertical separation between ranks
      marginx: 60,
      marginy: 60,
    });

    // Default to assigning a new object as a label for each new edge
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to the graph
    nodes.forEach((node) => {
      g.setNode(node.id, {
        width: 100,  // Node width for layout calculation
        height: 80,  // Node height for layout calculation
      });
    });

    // Add edges to the graph
    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    // Run the layout algorithm
    dagre.layout(g);

    // Extract positions from dagre layout
    nodes.forEach((node) => {
      const nodeData = g.node(node.id);
      if (nodeData) {
        pos[node.id] = {
          x: nodeData.x,
          y: nodeData.y,
        };
      }
    });

    // Scale and center the layout to fit the canvas
    const xs = Object.values(pos).map(p => p.x);
    const ys = Object.values(pos).map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const graphWidth = maxX - minX || 1;
    const graphHeight = maxY - minY || 1;
    const availableWidth = width - 120;
    const availableHeight = height - 120;

    const scale = Math.min(
      availableWidth / graphWidth,
      availableHeight / graphHeight,
      1 // Don't scale up, only down if needed
    );

    const offsetX = (width - graphWidth * scale) / 2 - minX * scale;
    const offsetY = (height - graphHeight * scale) / 2 - minY * scale;

    // Apply scaling and centering
    Object.keys(pos).forEach(id => {
      pos[id] = {
        x: pos[id].x * scale + offsetX,
        y: pos[id].y * scale + offsetY,
      };
    });

    return pos;
  }, [data.nodes, data.edges, width, height]);

  // Initialize positions
  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  // Drag handlers
  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPositions((prev) => ({
      ...prev,
      [dragging]: { x: Math.max(60, Math.min(width - 60, x)), y: Math.max(60, Math.min(height - 60, y)) },
    }));
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  // Get unique types for legend
  const nodeTypes = useMemo(() => {
    const types = new Set<string>();
    data.nodes.forEach((n) => types.add(n.type));
    return Array.from(types);
  }, [data.nodes]);

  const edgeTypes = useMemo(() => {
    const types = new Set<string>();
    data.edges.forEach((e) => types.add(e.type));
    return Array.from(types);
  }, [data.edges]);

  if (Object.keys(positions).length === 0) {
    return <div className="text-gray-500">Loading graph...</div>;
  }

  return (
    <div className="relative">
      {/* Legend */}
      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md text-sm z-10">
        <div className="font-semibold mb-2">Node Types</div>
        {nodeTypes.map((type) => (
          <div key={type} className="flex items-center gap-2 mb-1">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: stringToColor(type) }}
            />
            <span>{type}</span>
          </div>
        ))}
        <div className="font-semibold mt-3 mb-2">Edge Types</div>
        {edgeTypes.map((type) => (
          <div key={type} className="flex items-center gap-2 mb-1">
            <div className="w-8 h-0.5" style={{ backgroundColor: stringToColor(type) }} />
            <span>{type}</span>
          </div>
        ))}
      </div>

      {/* Graph */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-gray-50 rounded-lg border border-gray-200"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Arrow markers */}
        <defs>
          {data.edges.map((edge, i) => (
            <marker
              key={i}
              id={`arrow-${i}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={stringToColor(edge.type)} />
            </marker>
          ))}
        </defs>

        {/* Edges */}
        {data.edges.map((edge, i) => {
          const p1 = positions[edge.source];
          const p2 = positions[edge.target];
          if (!p1 || !p2) return null;

          // Shorten line to not overlap with node circles
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const nodeRadius = 40;
          const startX = p1.x + (dx / dist) * nodeRadius;
          const startY = p1.y + (dy / dist) * nodeRadius;
          const endX = p2.x - (dx / dist) * (nodeRadius + 8);
          const endY = p2.y - (dy / dist) * (nodeRadius + 8);

          return (
            <g key={i}>
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={stringToColor(edge.type)}
                strokeWidth={hoveredEdge === i ? 4 : 2}
                markerEnd={`url(#arrow-${i})`}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredEdge(i)}
                onMouseLeave={() => setHoveredEdge(null)}
                onClick={() => onEdgeClick?.(edge)}
              />
              {/* Edge label */}
              <text
                x={(startX + endX) / 2}
                y={(startY + endY) / 2 - 8}
                textAnchor="middle"
                className="text-xs fill-gray-600 pointer-events-none"
              >
                {edge.type}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {data.nodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;

          return (
            <g key={node.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={40}
                fill={stringToColor(node.type)}
                stroke={hoveredNode === node.id ? '#1f2937' : '#ffffff'}
                strokeWidth={hoveredNode === node.id ? 3 : 2}
                className="cursor-grab active:cursor-grabbing transition-all"
                onMouseDown={(e) => handleMouseDown(node.id, e)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => !dragging && onNodeClick?.(node)}
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-sm font-semibold fill-white pointer-events-none"
              >
                {node.id}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white p-3 rounded-lg shadow-lg max-w-md text-sm">
          <div className="font-semibold">{data.nodes.find((n) => n.id === hoveredNode)?.type}</div>
          <div className="mt-1">{data.nodes.find((n) => n.id === hoveredNode)?.content}</div>
        </div>
      )}

      {hoveredEdge !== null && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white p-3 rounded-lg shadow-lg max-w-md text-sm">
          <div className="font-semibold">
            {data.edges[hoveredEdge].source} → {data.edges[hoveredEdge].target}
          </div>
          <div className="mt-1">{data.edges[hoveredEdge].explanation || data.edges[hoveredEdge].type}</div>
        </div>
      )}
    </div>
  );
}
