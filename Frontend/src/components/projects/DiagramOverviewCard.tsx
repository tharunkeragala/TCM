import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { FaProjectDiagram, FaExpand, FaDownload } from "react-icons/fa";
import API from "../../services/api";

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

type ShapeType = "start" | "end" | "process" | "decision" | "note";

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
    end: "rounded-full bg-gray-700 border-gray-800 text-white dark:bg-gray-600",
    process:
      "rounded-lg bg-white dark:bg-gray-800 border-blue-400 text-gray-800 dark:text-gray-100",
    decision:
      "bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-gray-800 dark:text-gray-100",
    note: "rounded-md bg-yellow-50 dark:bg-yellow-900/20 border-dashed border-gray-400 text-gray-700 dark:text-gray-200",
  };

  const sizeClasses: Record<ShapeType, string> = {
    start: "min-w-[90px] px-4 py-2",
    end: "min-w-[90px] px-4 py-2",
    process: "min-w-[110px] px-3 py-2",
    decision: "w-[130px] h-[85px] flex items-center justify-center px-7",
    note: "min-w-[110px] px-3 py-2",
  };

  const clipStyle =
    data.shape === "decision"
      ? {
          clipPath: "polygon(50% 0%,100% 50%,50% 100%,0% 50%)",
        }
      : undefined;

  return (
    <div
      style={clipStyle}
      className={`border-2 text-[11px] font-medium text-center ${shapeClasses[data.shape]} ${sizeClasses[data.shape]}`}
    >
      {data.label}
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

  const downloadImage = async () => {
    if (!nodes.length) return;

    const bounds = getNodesBounds(nodes);

    const imageWidth = Math.max(1024, Math.round(bounds.width + 200));

    const imageHeight = Math.max(768, Math.round(bounds.height + 200));

    const viewport = getViewportForBounds(
      bounds,
      imageWidth,
      imageHeight,
      0.2,
      2,
      0.15,
    );

    const viewportEl = document.querySelector(
      "#diagram-preview-canvas .react-flow__viewport",
    ) as HTMLElement | null;

    if (!viewportEl) return;

    const isDark = document.documentElement.classList.contains("dark");

    const dataUrl = await toPng(viewportEl, {
      backgroundColor: isDark ? "#111827" : "#ffffff",
      width: imageWidth,
      height: imageHeight,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });

    const link = document.createElement("a");

    const safeName = (projectName || "project")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase();

    link.download = `${safeName}-flow-diagram.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="flex flex-col h-full">
      <div
        id="diagram-preview-canvas"
        className="flex-1 min-h-0 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/40"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background gap={14} />
        </ReactFlow>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => navigate(`/projects/${projectId}/diagram`)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700"
        >
          <FaExpand className="w-3 h-3" />
          Open Editor
        </button>

        <button
          onClick={downloadImage}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          title="Download PNG"
        >
          <FaDownload className="w-3 h-3" />
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
        setNodes(res.data.data.nodes || []);
        setEdges(res.data.data.edges || []);
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
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col overflow-hidden ${
        nodes.length === 0 && !loading ? "min-h-[336px]" : "h-[336px]"
      }`}
    >
      <p className="flex items-center gap-1 text-xs font-semibold tracking-wide text-gray-400 dark:text-gray-500 mb-3">
        <span>Diagram Version:</span>

        {latestVersion > 0 && (
          <span className="normal-case font-normal text-gray-400">
            v{latestVersion}
          </span>
        )}
      </p>

      <div className="flex-1 min-h-[240px]">
        {loading ? (
          <div className="h-full min-h-[240px] flex items-center justify-center">
            <p className="text-sm text-gray-400">Loading diagram...</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-sm text-gray-400 italic mb-4">
              No diagram has been created yet.
            </p>

            <button
              onClick={() => navigate(`/projects/${projectId}/diagram`)}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700"
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
