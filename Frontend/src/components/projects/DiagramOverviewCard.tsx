import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Handle,
  MarkerType,
  Position,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { FaExpand, FaDownload } from "react-icons/fa";
import API from "../../services/api";

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

type ShapeType = "start" | "end" | "process" | "decision" | "note";

const DEFAULT_SIZE: Record<ShapeType, { width: number; height: number }> = {
  start: { width: 130, height: 52 },
  end: { width: 130, height: 52 },
  process: { width: 160, height: 64 },
  decision: { width: 180, height: 120 },
  note: { width: 160, height: 72 },
};

const EDGE_COLOR = "#64748b";
const EDGE_WIDTH = 2.25;

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeNode = (node: Node): Node => {
  const shape = (node.data as { shape: ShapeType }).shape;
  const fallback = DEFAULT_SIZE[shape] || DEFAULT_SIZE.process;
  const width =
    toFiniteNumber(node.style?.width) ??
    node.width ??
    node.measured?.width ??
    fallback.width;
  const height =
    toFiniteNumber(node.style?.height) ??
    node.height ??
    node.measured?.height ??
    fallback.height;

  return {
    ...node,
    style: {
      ...node.style,
      width,
      height,
    },
  };
};

const normalizeEdge = (edge: Edge): Edge => {
  const stroke =
    typeof edge.style?.stroke === "string" ? edge.style.stroke : EDGE_COLOR;

  return {
    ...edge,
    type: edge.type || "smoothstep",
    style: {
      ...edge.style,
      stroke,
      strokeWidth: edge.style?.strokeWidth || EDGE_WIDTH,
    },
    markerEnd:
      edge.markerEnd ||
      ({
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 18,
        height: 18,
      } as Edge["markerEnd"]),
    labelStyle: {
      fontSize: 12,
      fontWeight: 600,
      ...edge.labelStyle,
    },
    labelBgPadding: edge.labelBgPadding || [6, 4],
    labelBgBorderRadius: edge.labelBgBorderRadius || 5,
  };
};

function ShapeNodePreview({
  data,
}: {
  data: {
    label: string;
    shape: ShapeType;
  };
}) {
  const shapeClasses: Record<ShapeType, string> = {
    start: "rounded-full bg-green-500 border-green-600 text-white",
    end: "rounded-full bg-gray-700 border-gray-800 text-white dark:bg-gray-600 dark:border-gray-500",
    process:
      "rounded-lg bg-white dark:bg-gray-800 border-blue-400 text-gray-800 dark:text-gray-100",
    decision:
      "bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-gray-800 dark:text-gray-100",
    note: "rounded-md bg-yellow-50 dark:bg-yellow-900/20 border-dashed border-gray-400 text-gray-700 dark:text-gray-200",
  };

  const clipStyle =
    data.shape === "decision"
      ? { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }
      : undefined;

  return (
    <div
      style={clipStyle}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden border-2 px-4 py-2 text-center text-[11px] font-medium shadow-sm ${shapeClasses[data.shape]}`}
    >
      {/* Saved edges reference these exact handle ids. Keep the handles mounted
          in read-only previews, but visually hide them. */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!pointer-events-none !opacity-0"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!pointer-events-none !opacity-0"
      />

      <span className="max-h-full overflow-hidden whitespace-pre-wrap break-words">
        {data.label}
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!pointer-events-none !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!pointer-events-none !opacity-0"
      />
    </div>
  );
}

const nodeTypes = {
  shapeNode: ShapeNodePreview,
};

function PreviewCanvas({
  projectId,
  nodes,
  edges,
  projectName,
}: {
  projectId: string;
  nodes: Node[];
  edges: Edge[];
  projectName: string;
}) {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const defaultEdgeOptions = useMemo(
    () => normalizeEdge({ id: "default", source: "", target: "" } as Edge),
    [],
  );

  const downloadImage = async () => {
    const viewportElement = wrapperRef.current?.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;
    if (!nodes.length || !viewportElement) return;

    setExporting(true);
    try {
      const bounds = getNodesBounds(nodes);
      const imageWidth = Math.min(
        3200,
        Math.max(1200, Math.ceil(bounds.width + 280)),
      );
      const imageHeight = Math.min(
        2400,
        Math.max(800, Math.ceil(bounds.height + 280)),
      );
      const viewport = getViewportForBounds(
        bounds,
        imageWidth,
        imageHeight,
        0.1,
        2,
        0.12,
      );
      const isDark = document.documentElement.classList.contains("dark");

      const dataUrl = await toPng(viewportElement, {
        backgroundColor: isDark ? "#111827" : "#ffffff",
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        cacheBust: true,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
        },
      });

      const link = document.createElement("a");
      const safeName = (projectName || "project")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      link.download = `${safeName || "project"}-flow-diagram.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Diagram preview PNG export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <style>{`
        .diagram-preview-flow .react-flow__edge-path {
          stroke: ${EDGE_COLOR};
          stroke-width: ${EDGE_WIDTH};
        }
        .diagram-preview-flow .react-flow__arrowhead path {
          fill: ${EDGE_COLOR};
          stroke: ${EDGE_COLOR};
        }
        .diagram-preview-flow .react-flow__edge-text {
          fill: #334155;
        }
        .diagram-preview-flow .react-flow__edge-textbg {
          fill: #ffffff;
          fill-opacity: 0.94;
        }
        .dark .diagram-preview-flow .react-flow__edge-text {
          fill: #e5e7eb;
        }
        .dark .diagram-preview-flow .react-flow__edge-textbg {
          fill: #111827;
          fill-opacity: 0.94;
        }
      `}</style>

      <div
        ref={wrapperRef}
        className="diagram-preview-flow min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          onlyRenderVisibleElements={false}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background gap={14} />
        </ReactFlow>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectId}/diagram`)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
        >
          <FaExpand className="h-3 w-3" />
          Open Editor
        </button>

        <button
          type="button"
          onClick={downloadImage}
          disabled={exporting}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          title="Download PNG"
        >
          <FaDownload className="h-3 w-3" />
          <span className="sr-only">{exporting ? "Exporting" : "Download PNG"}</span>
        </button>
      </div>
    </div>
  );
}

export default function DiagramOverviewCard({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const navigate = useNavigate();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [latestVersion, setLatestVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDiagram = useCallback(async () => {
    setLoading(true);

    try {
      const res = await API.get(`/api/projects/${projectId}/diagram`, {
        headers: authHeaders(),
      });

      if (res.data.success) {
        setNodes((res.data.data.nodes || []).map((node: Node) => normalizeNode(node)));
        setEdges((res.data.data.edges || []).map((edge: Edge) => normalizeEdge(edge)));
        setLatestVersion(res.data.data.latest_version_number || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDiagram();
  }, [fetchDiagram]);

  return (
    <div className="flex h-[336px] min-h-[336px] flex-col overflow-hidden rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <p className="mb-3 flex items-center gap-1 text-xs font-semibold tracking-wide text-gray-400 dark:text-gray-500">
        <span>Diagram Version:</span>
        <span className="font-normal normal-case text-gray-400">
          {latestVersion > 0 ? `v${latestVersion}` : "Draft"}
        </span>
      </p>

      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">Loading diagram...</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <p className="mb-4 text-sm italic text-gray-400">
              No diagram has been created yet.
            </p>

            <button
              type="button"
              onClick={() => navigate(`/projects/${projectId}/diagram`)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700"
            >
              Create Diagram
            </button>
          </div>
        ) : (
          <ReactFlowProvider>
            <PreviewCanvas
              projectId={projectId}
              projectName={projectName}
              nodes={nodes}
              edges={edges}
            />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}