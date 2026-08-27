import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { GraphView, GraphNode, GraphEdge } from "../../types";
import { MasteryTierBadge } from "./MasteryTierBadge";
import {
  GitFork,
  Target,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Sparkles,
  Lock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface KnowledgeGraphViewProps {
  graph: GraphView | null;
  title?: string;
  subtitle?: string;
  highlightTraceOnly?: boolean;
  onViewRemediation?: (conceptId: string, conceptLabel: string) => void;
  showHoverMenu?: boolean;
  className?: string;
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  graph,
  title = "Prerequisite Dependency Network",
  subtitle = "Directed competency DAG mapped from foundation prerequisites to target concepts.",
  onViewRemediation,
  showHoverMenu = true,
  className = "",
}) => {
  const navigate = useNavigate();

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);

  // Click & Drag Canvas Pan State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const innerCanvasRef = useRef<HTMLDivElement | null>(null);
  const hoverEnterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [nodePositions, setNodePositions] = useState<
    Record<string, { x: number; y: number; width: number; height: number }>
  >({});

  // Node Map for fast prerequisite/dependent lookups
  const nodeMap = useMemo(() => {
    if (!graph || !graph.nodes) return new Map<string, GraphNode>();
    return new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]));
  }, [graph]);

  // Group nodes by topological level
  const levels = useMemo(() => {
    if (!graph || !graph.nodes) return [];
    const maxLevel = Math.max(0, ...graph.nodes.map((n) => n.level ?? 0));
    const grouped: GraphNode[][] = Array.from(
      { length: maxLevel + 1 },
      () => [],
    );

    graph.nodes.forEach((node) => {
      const lvl = Math.max(0, Math.min(node.level ?? 0, maxLevel));
      grouped[lvl].push(node);
    });

    return grouped;
  }, [graph]);

  // Stable calculation of node coordinates in unscaled canvas coordinate system
  const updatePositions = useCallback(() => {
    if (!innerCanvasRef.current) return;
    const canvasEl = innerCanvasRef.current;
    const newPositions: Record<
      string,
      { x: number; y: number; width: number; height: number }
    > = {};

    const nodeElements =
      canvasEl.querySelectorAll<HTMLElement>("[data-node-id]");
    nodeElements.forEach((el) => {
      const id = el.getAttribute("data-node-id");
      if (id) {
        // Calculate unscaled offset relative to innerCanvasRef container
        let cur: HTMLElement | null = el;
        let left = 0;
        let top = 0;
        while (cur && cur !== canvasEl) {
          left += cur.offsetLeft;
          top += cur.offsetTop;
          cur = cur.offsetParent as HTMLElement;
        }

        const width = el.offsetWidth;
        const height = el.offsetHeight;

        newPositions[id] = {
          x: left + width / 2,
          y: top + height / 2,
          width,
          height,
        };
      }
    });

    setNodePositions(newPositions);
  }, []);

  // Direct mouse wheel to zoom (smooth in/out when scrolling on canvas, ignores popover submenus)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      // If mouse is inside hover popover or its scrollable submenus, allow native scroll without zooming graph
      if (target && target.closest("[data-hover-popover]")) {
        return;
      }

      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((prev) =>
        Math.min(1.8, Math.max(0.35, Number((prev + delta).toFixed(2)))),
      );
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Mouse drag handlers for canvas panning
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't initiate drag pan when clicking interactive hover popover, buttons, or links
    if (
      target.closest("[data-hover-popover]") ||
      target.closest("button") ||
      target.closest("a")
    ) {
      return;
    }

    if (hoverEnterTimeoutRef.current)
      clearTimeout(hoverEnterTimeoutRef.current);
    if (hoverLeaveTimeoutRef.current)
      clearTimeout(hoverLeaveTimeoutRef.current);
    setHoveredNodeId(null);

    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    scrollContainerRef.current.scrollLeft =
      dragStartRef.current.scrollLeft - dx;
    scrollContainerRef.current.scrollTop = dragStartRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Update positions with ResizeObserver and animation frame
  useEffect(() => {
    updatePositions();
    const frameId = requestAnimationFrame(updatePositions);

    let resizeObserver: ResizeObserver | null = null;
    if (innerCanvasRef.current && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updatePositions();
      });
      resizeObserver.observe(innerCanvasRef.current);
    }

    window.addEventListener("resize", updatePositions);

    return () => {
      cancelAnimationFrame(frameId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", updatePositions);
    };
  }, [graph, levels, updatePositions]);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200/80 p-8 text-center space-y-2">
        <GitFork className="w-8 h-8 text-stone-400 mx-auto" />
        <h4 className="text-sm font-bold text-stone-800">
          No Graph Data Available
        </h4>
        <p className="text-xs text-stone-500 max-w-sm mx-auto">
          Assessment evidence has not yet resolved a directed competency graph
          for this scope.
        </p>
      </div>
    );
  }

  const getRoleBadge = (roles?: string[]) => {
    if (!roles || roles.length === 0) return null;

    const primaryRole =
      roles.find((r) => r === "ROOT_CAUSE") ||
      roles.find((r) => r === "TARGET") ||
      roles.find((r) => r === "PATH_CURRENT") ||
      roles.find((r) => r === "CONTRIBUTOR") ||
      roles.find((r) => r === "DIAGNOSTIC_REQUIRED") ||
      roles.find((r) => r.startsWith("PATH_")) ||
      roles[0];

    switch (primaryRole) {
      case "ROOT_CAUSE":
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300">
            <AlertTriangle className="w-2.5 h-2.5" /> Root Cause
          </span>
        );
      case "TARGET":
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-teal-100 text-teal-900 border border-teal-300">
            <Target className="w-2.5 h-2.5" /> Target
          </span>
        );
      case "CONTRIBUTOR":
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
            Contributor
          </span>
        );
      case "PATH_CURRENT":
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-600 text-white animate-pulse">
            Current Step
          </span>
        );
      case "DIAGNOSTIC_REQUIRED":
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-sky-100 text-sky-900 border border-sky-300">
            Diagnostic Req.
          </span>
        );
      default:
        if (primaryRole.startsWith("PATH_")) {
          return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono text-stone-600 bg-stone-100 border border-stone-200">
              {primaryRole.replace("PATH_", "")}
            </span>
          );
        }
        return null;
    }
  };

  const formatScore = (score: number | null | undefined) => {
    if (score == null) return null;
    return score <= 1.0 ? Math.round(score * 100) : Math.round(score);
  };

  // Helper to compute prerequisites & dependents for any node
  const getNodeConnections = (nodeId: string) => {
    const prereqIds = graph.edges
      .filter((e: GraphEdge) => e.target === nodeId)
      .map((e: GraphEdge) => e.source);

    const depIds = graph.edges
      .filter((e: GraphEdge) => e.source === nodeId)
      .map((e: GraphEdge) => e.target);

    return {
      prerequisites: prereqIds
        .map((id) => nodeMap.get(id))
        .filter(Boolean) as GraphNode[],
      dependents: depIds
        .map((id) => nodeMap.get(id))
        .filter(Boolean) as GraphNode[],
    };
  };

  const handleCardMouseEnter = (nodeId: string, immediate = false) => {
    if (hoverLeaveTimeoutRef.current) {
      clearTimeout(hoverLeaveTimeoutRef.current);
      hoverLeaveTimeoutRef.current = null;
    }

    if (hoveredNodeId === nodeId) return;

    if (hoverEnterTimeoutRef.current) {
      clearTimeout(hoverEnterTimeoutRef.current);
    }

    if (immediate) {
      setHoveredNodeId(nodeId);
    } else {
      // 500ms intentional hover delay before popover appears
      hoverEnterTimeoutRef.current = setTimeout(() => {
        setHoveredNodeId(nodeId);
      }, 500);
    }
  };

  const handleCardMouseLeave = () => {
    if (hoverEnterTimeoutRef.current) {
      clearTimeout(hoverEnterTimeoutRef.current);
      hoverEnterTimeoutRef.current = null;
    }

    if (hoverLeaveTimeoutRef.current) {
      clearTimeout(hoverLeaveTimeoutRef.current);
    }
    hoverLeaveTimeoutRef.current = setTimeout(() => {
      setHoveredNodeId(null);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (hoverEnterTimeoutRef.current)
        clearTimeout(hoverEnterTimeoutRef.current);
      if (hoverLeaveTimeoutRef.current)
        clearTimeout(hoverLeaveTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`bg-white rounded-xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-5 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
            <GitFork className="w-3.5 h-3.5" /> Knowledge Graph
          </div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900 mt-0.5">
            {title}
          </h2>
          <p className="text-xs text-stone-500">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-stone-600 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
          <span>
            Nodes:{" "}
            <strong className="text-stone-900">{graph.node_count}</strong>
          </span>
          <span>•</span>
          <span>
            Edges:{" "}
            <strong className="text-stone-900">{graph.edge_count}</strong>
          </span>
        </div>
      </div>

      {/* Scrollable & Draggable Graph Viewport */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative bg-stone-50/70 border border-stone-200/80 rounded-xl overflow-auto min-h-[440px] max-h-[720px] select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* Floating Zoom & Pan Controls Toolbar */}
        <div className="sticky top-3 float-right mr-3 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-md border border-stone-200/90 shadow-md rounded-xl p-1 text-xs">
          <div className="flex items-center gap-1 px-2 py-0.5 text-stone-400 font-mono text-[10px] hidden sm:flex border-r border-stone-200 mr-0.5">
            <Move className="w-3 h-3" />
            <span>Drag Pan</span>
          </div>

          <button
            onClick={() =>
              setZoom((z) => Math.max(0.35, Number((z - 0.1).toFixed(2))))
            }
            disabled={zoom <= 0.35}
            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-35 transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setZoom(1.0)}
            className="px-2 py-1 rounded-lg font-mono font-bold text-stone-700 hover:bg-stone-100 transition-all text-[11px]"
            title="Reset Zoom (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={() =>
              setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))))
            }
            disabled={zoom >= 1.8}
            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-35 transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-stone-200 mx-0.5" />

          <button
            onClick={() => {
              setZoom(1.0);
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = 0;
                scrollContainerRef.current.scrollTop = 0;
              }
            }}
            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all"
            title="Reset View & Position"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scaled Canvas Container */}
        <div
          ref={innerCanvasRef}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
          className="relative min-w-max p-8 sm:p-12 pb-48 sm:pb-56"
        >
          {/* SVG Edge Connecting Overlay embedded inside full scroll canvas */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
              <marker
                id="arrow-default"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#cbd5e1" />
              </marker>
              <marker
                id="arrow-focused"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0f766e" />
              </marker>
              <marker
                id="arrow-root"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#e11d48" />
              </marker>
              <marker
                id="arrow-path"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0f766e" />
              </marker>
            </defs>

            {graph.edges.map((edge) => {
              const src = nodePositions[edge.source];
              const tgt = nodePositions[edge.target];
              if (!src || !tgt) return null;

              const isRoot = edge.in_root_trace;
              const isPath = edge.in_learning_path;

              // Focus highlighting: If a node is hovered, highlight its incoming & outgoing edges
              const isConnectedToFocus =
                hoveredNodeId != null &&
                (edge.source === hoveredNodeId ||
                  edge.target === hoveredNodeId);

              const isDimmed = hoveredNodeId != null && !isConnectedToFocus;

              // Clean color scheme
              let strokeColor = "#cbd5e1"; // calm slate
              let strokeWidth = 1.5;
              let marker = "url(#arrow-default)";
              let opacity = 0.65;

              if (isRoot) {
                strokeColor = "#e11d48"; // vibrant rose
                strokeWidth = 2.5;
                marker = "url(#arrow-root)";
                opacity = 1;
              } else if (isPath) {
                strokeColor = "#0f766e"; // deep teal
                strokeWidth = 2.5;
                marker = "url(#arrow-path)";
                opacity = 1;
              } else if (isConnectedToFocus) {
                strokeColor = "#0f766e";
                strokeWidth = 2.5;
                marker = "url(#arrow-focused)";
                opacity = 1;
              }

              if (isDimmed) {
                opacity = 0.12;
              }

              // Card boundary anchor points (Right side of source -> Left side of target)
              const startX = src.x + src.width / 2;
              const startY = src.y;
              const endX = tgt.x - tgt.width / 2;
              const endY = tgt.y;

              const totalDx = endX - startX;
              const dy = endY - startY;

              // Horizontal stubs ensuring arrows enter and leave cards 100% perpendicular
              const leadOut = Math.min(18, Math.max(8, totalDx * 0.18));
              const leadIn = Math.min(18, Math.max(8, totalDx * 0.18));

              const p1X = startX + leadOut;
              const p1Y = startY;
              const p2X = endX - leadIn;
              const p2Y = endY;

              const spanX = p2X - p1X;
              const cOffset = Math.max(20, Math.abs(spanX) * 0.45);

              const pathD =
                Math.abs(dy) < 3
                  ? `M ${startX} ${startY} L ${endX} ${endY}`
                  : `M ${startX} ${startY} L ${p1X} ${p1Y} C ${p1X + cOffset} ${p1Y}, ${p2X - cOffset} ${p2Y}, ${p2X} ${p2Y} L ${endX} ${endY}`;

              return (
                <g key={edge.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isPath && !isRoot ? "5 4" : undefined}
                    markerEnd={marker}
                    opacity={opacity}
                    style={{
                      transition:
                        "opacity 0.2s ease, stroke 0.2s ease, stroke-width 0.2s ease",
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Level Columns Grid with generous breathing space */}
          <div className="relative z-10 flex items-start gap-16 sm:gap-20">
            {levels.map((levelNodes, levelIdx) => {
              const hasHoveredNode = levelNodes.some(
                (n) => n.id === hoveredNodeId,
              );

              return (
                <div
                  key={levelIdx}
                  className={`flex flex-col gap-4 w-60 sm:w-64 flex-shrink-0 relative transition-all ${
                    hasHoveredNode ? "z-40" : "z-10"
                  }`}
                >
                  <div className="text-center pb-2 border-b border-stone-200/80">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 font-mono">
                      {levelIdx === 0
                        ? "Foundation (Level 0)"
                        : levelIdx === levels.length - 1
                          ? `Target (Level ${levelIdx})`
                          : `Prerequisites (Level ${levelIdx})`}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    {levelNodes.map((node, nodeIdx) => {
                      const inRootTrace = node.roles?.includes("ROOT_CAUSE");
                      const isTarget = node.roles?.includes("TARGET");
                      const inLearningPath = node.roles?.some((r) =>
                        r.startsWith("PATH_"),
                      );
                      const isCriticalGap =
                        node.tier === "CRITICAL_GAP" || inRootTrace;

                      const formattedScore = formatScore(node.mastery_score);
                      const isHovered =
                        showHoverMenu && hoveredNodeId === node.id;

                      const connections = isHovered
                        ? getNodeConnections(node.id)
                        : { prerequisites: [], dependents: [] };

                      // Smart orientation: flip horizontally near right edge, flip vertically near bottom
                      const isLastCol = levelIdx >= levels.length - 2;
                      const isLowerHalf =
                        nodeIdx >=
                        Math.max(1, Math.floor(levelNodes.length / 2));
                      const verticalPlacement = isLowerHalf
                        ? "bottom-0"
                        : "top-0";
                      const horizontalPlacement = isLastCol
                        ? "right-[calc(100%+14px)]"
                        : "left-[calc(100%+14px)]";

                      return (
                        <div
                          key={node.id}
                          data-node-id={node.id}
                          onMouseEnter={() => {
                            if (showHoverMenu) handleCardMouseEnter(node.id);
                          }}
                          onMouseLeave={() => {
                            if (showHoverMenu) handleCardMouseLeave();
                          }}
                          className={`rounded-xl p-3 sm:p-3.5 border select-none relative bg-white transition-all ${
                            isHovered
                              ? "ring-2 ring-teal-700 shadow-md border-teal-600 scale-[1.02] z-50"
                              : inRootTrace
                                ? "border-rose-400 bg-rose-50/40 shadow-xs hover:border-rose-500 hover:shadow-sm"
                                : isTarget
                                  ? "border-teal-400 bg-teal-50/40 shadow-xs hover:border-teal-500 hover:shadow-sm"
                                  : inLearningPath
                                    ? "border-amber-300 bg-amber-50/40 shadow-xs hover:border-amber-400 hover:shadow-sm"
                                    : "border-stone-200/90 shadow-2xs hover:border-stone-400 hover:shadow-xs"
                          }`}
                        >
                          {/* Node Role Badge */}
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            {getRoleBadge(node.roles)}
                            {node.assessed ? (
                              <MasteryTierBadge
                                tier={node.tier}
                                score={formattedScore}
                                size="sm"
                              />
                            ) : (
                              <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wider">
                                Unassessed
                              </span>
                            )}
                          </div>

                          {/* Concept Title */}
                          <h4 className="text-xs font-bold text-stone-900 line-clamp-2 leading-snug">
                            {node.label}
                          </h4>

                          {/* Score and Gap Flags */}
                          <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-500 font-mono">
                            <span>
                              {node.assessed && formattedScore !== null
                                ? `Mastery: ${formattedScore}%`
                                : "No data"}
                            </span>
                            {isCriticalGap && (
                              <span className="text-rose-600 font-bold uppercase tracking-wider">
                                GAP
                              </span>
                            )}
                          </div>

                          {/* Interactive Hover Popover Menu */}
                          {isHovered && (
                            <div
                              data-hover-popover="true"
                              onMouseEnter={() =>
                                handleCardMouseEnter(node.id, true)
                              }
                              onMouseLeave={handleCardMouseLeave}
                              onMouseDown={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              onMouseMove={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              className={`absolute ${horizontalPlacement} ${verticalPlacement} w-80 bg-white border-2 border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.28)] rounded-xl z-[999] text-left cursor-default animate-in fade-in zoom-in-95 duration-150 overflow-hidden pointer-events-auto select-auto before:content-[''] before:absolute before:inset-y-0 ${
                                isLastCol
                                  ? "before:-right-4 before:w-4"
                                  : "before:-left-4 before:w-4"
                              }`}
                            >
                              {/* Popover Header Banner */}
                              <div className="bg-slate-900 text-white p-3.5 flex items-start justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] uppercase font-bold tracking-wider font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                                      Level {node.level}
                                    </span>
                                    <MasteryTierBadge
                                      tier={node.tier}
                                      score={formattedScore}
                                      size="sm"
                                    />
                                  </div>
                                  <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                                    {node.label}
                                  </h4>
                                </div>
                              </div>

                              {/* Popover Content Body */}
                              <div className="p-3.5 space-y-3 bg-white">
                                {/* Gate Status Pill */}
                                <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                                  <span className="text-slate-600 text-[11px] font-semibold">
                                    Progression Gate:
                                  </span>
                                  {node.can_progress ? (
                                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Meets
                                      Gate (&ge;70%)
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />{" "}
                                      Needs Work (&lt;70%)
                                    </span>
                                  )}
                                </div>

                                {/* Upstream Prerequisites List */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                    <span className="flex items-center gap-1">
                                      <Lock className="w-3 h-3 text-slate-500" />{" "}
                                      Needed First (
                                      {connections.prerequisites.length})
                                    </span>
                                  </div>
                                  {connections.prerequisites.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">
                                      None (Foundation Concept)
                                    </p>
                                  ) : (
                                    <div
                                      onWheel={(e) => e.stopPropagation()}
                                      className="space-y-1 max-h-28 overflow-y-auto pr-1 overscroll-contain"
                                    >
                                      {connections.prerequisites.map((p) => (
                                        <div
                                          key={p.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCardMouseEnter(p.id, true);
                                          }}
                                          className="p-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-teal-500 cursor-pointer flex items-center justify-between transition-all text-xs"
                                        >
                                          <span className="font-medium text-slate-800 truncate pr-2 text-[11px]">
                                            {p.label}
                                          </span>
                                          <MasteryTierBadge
                                            tier={p.tier}
                                            score={formatScore(p.mastery_score)}
                                            size="sm"
                                            showIcon={false}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Downstream Dependents List */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                    <span className="flex items-center gap-1">
                                      <ArrowRight className="w-3 h-3 text-teal-600" />{" "}
                                      Unlocks Next (
                                      {connections.dependents.length})
                                    </span>
                                  </div>
                                  {connections.dependents.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">
                                      None (Terminal Concept)
                                    </p>
                                  ) : (
                                    <div
                                      onWheel={(e) => e.stopPropagation()}
                                      className="space-y-1 max-h-28 overflow-y-auto pr-1 overscroll-contain"
                                    >
                                      {connections.dependents.map((d) => (
                                        <div
                                          key={d.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCardMouseEnter(d.id, true);
                                          }}
                                          className="p-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-teal-500 cursor-pointer flex items-center justify-between transition-all text-xs"
                                        >
                                          <span className="font-medium text-slate-800 truncate pr-2 text-[11px]">
                                            {d.label}
                                          </span>
                                          <MasteryTierBadge
                                            tier={d.tier}
                                            score={formatScore(d.mastery_score)}
                                            size="sm"
                                            showIcon={false}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* CTA Button to Remediation */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHoveredNodeId(null);
                                    if (onViewRemediation) {
                                      onViewRemediation(node.id, node.label);
                                    } else {
                                      navigate("/mastery");
                                    }
                                  }}
                                  className="w-full mt-2 py-2 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>View Remediation & Learning Path</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Graph Legend */}
      <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center gap-4 text-xs text-stone-600">
        <span className="font-semibold text-stone-800 text-[11px] uppercase tracking-wider">
          Legend:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-rose-600 inline-block" />
          <span>Root Cause Trace</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-teal-700 border-b border-dashed border-teal-700 inline-block" />
          <span>Learning Path Route</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-slate-300 inline-block" />
          <span>Standard Dependency</span>
        </div>
        <div className="ml-auto text-[11px] text-stone-400 font-mono flex items-center gap-2">
          <span>Hover node for details</span>
          <span>•</span>
          <span>Scroll to Zoom</span>
          <span>•</span>
          <span>Click & Drag to Pan</span>
        </div>
      </div>
    </div>
  );
};
