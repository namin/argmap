import { useMemo, useState, useRef, useEffect } from 'react';
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

  // Compute initial layout using force-directed algorithm
  const initialPositions = useMemo(() => {
    const nodes = data.nodes;
    const edges = data.edges || [];
    const pos: Record<string, { x: number; y: number }> = {};
    const forces: Record<string, { x: number; y: number }> = {};

    // Initialize in circle
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
      pos[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
      forces[node.id] = { x: 0, y: 0 };
    });

    // Run force simulation
    for (let iter = 0; iter < 100; iter++) {
      // Reset forces
      nodes.forEach((node) => {
        forces[node.id] = { x: 0, y: 0 };
      });

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = pos[n2.id].x - pos[n1.id].x;
          const dy = pos[n2.id].y - pos[n1.id].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 8000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          forces[n1.id].x -= fx;
          forces[n1.id].y -= fy;
          forces[n2.id].x += fx;
          forces[n2.id].y += fy;
        }
      }

      // Attraction along edges
      edges.forEach((edge) => {
        const p1 = pos[edge.source];
        const p2 = pos[edge.target];
        if (!p1 || !p2) return;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * 0.05;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces[edge.source].x += fx;
        forces[edge.source].y += fy;
        forces[edge.target].x -= fx;
        forces[edge.target].y -= fy;
      });

      // Center gravity
      nodes.forEach((node) => {
        const dx = centerX - pos[node.id].x;
        const dy = centerY - pos[node.id].y;
        forces[node.id].x += dx * 0.01;
        forces[node.id].y += dy * 0.01;
      });

      // Apply forces with damping
      const damping = 0.85;
      nodes.forEach((node) => {
        pos[node.id].x += forces[node.id].x * 0.1 * damping;
        pos[node.id].y += forces[node.id].y * 0.1 * damping;
        // Keep within bounds
        pos[node.id].x = Math.max(60, Math.min(width - 60, pos[node.id].x));
        pos[node.id].y = Math.max(60, Math.min(height - 60, pos[node.id].y));
      });
    }

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
