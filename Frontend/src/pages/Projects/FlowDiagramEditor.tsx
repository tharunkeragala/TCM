import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  NodeResizer,
  NodeToolbar,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  MarkerType,
  Handle,
  Position,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import {
  FaArrowLeft,
  FaSave,
  FaHistory,
  FaDownload,
  FaPlus,
  FaTimes,
  FaUndo,
  FaCheckCircle,
  FaCopy,
  FaTrash,
  FaCompressArrowsAlt,
} from "react-icons/fa";
import API from "../../services/api";
import PageMeta from "../../components/common/PageMeta";
import { usePermissions } from "../../hooks/usePermissions";

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// html-to-image 1.11.11 is the stable version recommended by the React Flow
// download example. Keep that package version pinned in package.json.

// ─── Types ──────────────────────────────────────────────────────────────────
type ShapeType = "start" | "end" | "process" | "decision" | "note";

interface ShapeNodeData extends Record<string, unknown> {
  label: string;
  shape: ShapeType;
  onLabelChange?: (id: string, label: string) => void;
  onDuplicate?: (id: string) => void;
  onResetSize?: (id: string) => void;
  onDelete?: (id: string) => void;
}

interface DiagramVersion {
  id: number;
  project_id: number;
  version_number: number;
  label: string | null;
  created_by_name?: string;
  created_at: string;
}

interface NodeRuntimeHandlers {
  onLabelChange: (id: string, label: string) => void;
  onDuplicate: (id: string) => void;
  onResetSize: (id: string) => void;
  onDelete: (id: string) => void;
}

const SHAPE_LABELS: Record<ShapeType, string> = {
  start: "Start",
  end: "End",
  process: "New Step",
  decision: "Condition?",
  note: "Note",
};

const DEFAULT_SIZE: Record<ShapeType, { width: number; height: number }> = {
  start: { width: 130, height: 52 },
  end: { width: 130, height: 52 },
  process: { width: 160, height: 64 },
  decision: { width: 180, height: 120 },
  note: { width: 160, height: 72 },
};

const EDGE_COLOR = "#64748b";
const EDGE_WIDTH = 2.25;
const SNAP_GRID: [number, number] = [16, 16];

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const getNodeDimensions = (node: Node) => {
  const shape = (node.data as ShapeNodeData).shape;
  const fallback = DEFAULT_SIZE[shape] || DEFAULT_SIZE.process;

  return {
    width:
      toFiniteNumber(node.style?.width) ??
      node.width ??
      node.measured?.width ??
      fallback.width,
    height:
      toFiniteNumber(node.style?.height) ??
      node.height ??
      node.measured?.height ??
      fallback.height,
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

const serializeNodes = (nodes: Node[]) =>
  nodes.map((node) => {
    const shape = (node.data as ShapeNodeData).shape;
    const { width, height } = getNodeDimensions(node);

    return {
      id: node.id,
      type: node.type,
      position: node.position,
      style: {
        ...node.style,
        width,
        height,
      },
      data: {
        label: (node.data as ShapeNodeData).label,
        shape,
      },
    };
  });

const serializeEdges = (edges: Edge[]) =>
  edges.map((edge) => {
    const normalized = normalizeEdge(edge);
    return {
      id: normalized.id,
      source: normalized.source,
      target: normalized.target,
      sourceHandle: normalized.sourceHandle,
      targetHandle: normalized.targetHandle,
      type: normalized.type,
      label: normalized.label,
      animated: normalized.animated,
      style: normalized.style,
      markerEnd: normalized.markerEnd,
      labelStyle: normalized.labelStyle,
      labelBgStyle: normalized.labelBgStyle,
      labelBgPadding: normalized.labelBgPadding,
      labelBgBorderRadius: normalized.labelBgBorderRadius,
    };
  });

const attachNodeRuntime = (
  node: Node,
  handlers: NodeRuntimeHandlers,
): Node => {
  const { width, height } = getNodeDimensions(node);

  return {
    ...node,
    style: {
      ...node.style,
      width,
      height,
    },
    data: {
      ...node.data,
      ...handlers,
    },
  };
};

// ─── Custom node ────────────────────────────────────────────────────────────
function ShapeNode({ id, data, selected }: NodeProps) {
  const nodeData = data as ShapeNodeData;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nodeData.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(nodeData.label), [nodeData.label]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim() || "Untitled";
    if (trimmed !== nodeData.label) nodeData.onLabelChange?.(id, trimmed);
  };

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
    nodeData.shape === "decision"
      ? { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }
      : undefined;

  return (
    <>
      <NodeToolbar
        isVisible={selected && !editing}
        position={Position.Top}
        offset={12}
        className="nodrag nopan flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
      >
        <button
          type="button"
          onClick={() => nodeData.onDuplicate?.(id)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
          title="Duplicate node"
        >
          <FaCopy className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => nodeData.onResetSize?.(id)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
          title="Reset node size"
        >
          <FaCompressArrowsAlt className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => nodeData.onDelete?.(id)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
          title="Delete node"
        >
          <FaTrash className="h-3 w-3" />
        </button>
      </NodeToolbar>

      <NodeResizer
        isVisible={selected}
        minWidth={90}
        minHeight={40}
        maxWidth={640}
        maxHeight={360}
        keepAspectRatio={nodeData.shape === "decision"}
        handleClassName="!h-3 !w-3 !rounded-sm !border-2 !border-white !bg-brand-500 dark:!border-gray-900"
        lineClassName="!border-brand-400"
      />

      <div
        style={clipStyle}
        onDoubleClick={() => setEditing(true)}
        className={`relative flex h-full w-full select-none items-center justify-center overflow-hidden border-2 text-center text-sm font-medium shadow-sm ${shapeClasses[nodeData.shape]} ${
          nodeData.shape === "decision" ? "px-9" : "px-4 py-2"
        } ${selected ? "ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-gray-900" : ""}`}
      >
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-500 dark:!border-gray-900"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-500 dark:!border-gray-900"
        />

        {editing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              }
              if (event.key === "Escape") {
                setValue(nodeData.label);
                setEditing(false);
              }
            }}
            className="nodrag w-full border-b border-current bg-transparent text-center outline-none"
          />
        ) : (
          <span className="max-h-full overflow-hidden whitespace-pre-wrap break-words">
            {nodeData.label}
          </span>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-500 dark:!border-gray-900"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-500 dark:!border-gray-900"
        />
      </div>
    </>
  );
}

const nodeTypes = { shapeNode: ShapeNode };

// ─── Version history side panel ────────────────────────────────────────────
function VersionHistoryPanel({
  projectId,
  onClose,
  onRestore,
  canEdit,
  canDelete,
}: {
  projectId: string;
  onClose: () => void;
  onRestore: (versionId: number) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/projects/${projectId}/diagram/versions`, {
        headers: authHeaders(),
      });
      if (res.data.success) setVersions(res.data.data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleDelete = async (versionId: number) => {
    setBusyId(versionId);
    try {
      await API.delete(`/api/projects/diagram-versions/${versionId}`, {
        headers: authHeaders(),
      });
      setVersions((previous) => previous.filter((version) => version.id !== versionId));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[999998] flex w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <FaHistory className="h-3.5 w-3.5" /> Version History
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <FaTimes />
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-400">Loading versions…</p>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-gray-400">
            No saved versions yet. Use &quot;Save as New Version&quot; to create one.
          </p>
        ) : (
          versions.map((version) => (
            <div
              key={version.id}
              className="rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-700"
            >
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                v{version.version_number}
                {version.label ? (
                  <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                    — {version.label}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                {version.created_by_name || "Unknown"} ·{" "}
                {new Date(version.created_at).toLocaleString()}
              </p>
              <div className="mt-2 flex gap-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRestore(version.id)}
                    disabled={busyId === version.id}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                  >
                    <FaUndo className="h-3 w-3" /> Restore
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(version.id)}
                    disabled={busyId === version.id}
                    className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main canvas + toolbar ──────────────────────────────────────────────────
function DiagramCanvas({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = can("/projects", "can_edit");
  const canDelete = can("/projects", "can_delete");

  const [projectName, setProjectName] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [latestVersion, setLatestVersion] = useState(0);

  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [exporting, setExporting] = useState(false);

  const idCounter = useRef(0);
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  const nextId = useCallback(
    () => `node_${Date.now()}_${idCounter.current++}`,
    [],
  );

  const {
    screenToFlowPosition,
    getNodes,
    toObject,
    fitView,
  } = useReactFlow();

  const onLabelChange = useCallback((id: string, label: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label } } : node,
      ),
    );
    setDirty(true);
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) =>
      current.filter((edge) => edge.source !== id && edge.target !== id),
    );
    setDirty(true);
  }, []);

  const resetNodeSize = useCallback((id: string) => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== id) return node;
        const shape = (node.data as ShapeNodeData).shape;
        const size = DEFAULT_SIZE[shape] || DEFAULT_SIZE.process;
        return {
          ...node,
          style: {
            ...node.style,
            width: size.width,
            height: size.height,
          },
        };
      }),
    );
    setDirty(true);
  }, []);

  const duplicateNode = useCallback(
    (id: string) => {
      setNodes((current) => {
        const source = current.find((node) => node.id === id);
        if (!source) return current;

        const { width, height } = getNodeDimensions(source);
        const duplicate: Node = {
          ...source,
          id: nextId(),
          selected: true,
          position: {
            x: source.position.x + 32,
            y: source.position.y + 32,
          },
          style: {
            ...source.style,
            width,
            height,
          },
          data: {
            ...source.data,
            label: `${(source.data as ShapeNodeData).label} Copy`,
          },
        };

        return [
          ...current.map((node) => ({ ...node, selected: false })),
          duplicate,
        ];
      });
      setDirty(true);
    },
    [nextId],
  );

  const runtimeHandlers = useMemo<NodeRuntimeHandlers>(
    () => ({
      onLabelChange,
      onDuplicate: duplicateNode,
      onResetSize: resetNodeSize,
      onDelete: deleteNode,
    }),
    [deleteNode, duplicateNode, onLabelChange, resetNodeSize],
  );

  // ── Load project name + diagram draft ──────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [projectRes, diagramRes] = await Promise.all([
          API.get(`/api/projects/${projectId}`, { headers: authHeaders() }),
          API.get(`/api/projects/${projectId}/diagram`, {
            headers: authHeaders(),
          }),
        ]);

        if (projectRes.data.success) {
          setProjectName(projectRes.data.data.project_name);
        }

        if (diagramRes.data.success) {
          const diagram = diagramRes.data.data;
          setNodes(
            (diagram.nodes || []).map((node: Node) =>
              attachNodeRuntime(node, runtimeHandlers),
            ),
          );
          setEdges((diagram.edges || []).map((edge: Edge) => normalizeEdge(edge)));
          setLatestVersion(diagram.latest_version_number || 0);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, runtimeHandlers]);

  // ── Silent autosave draft ───────────────────────────────────────────────
  const persistDraft = useCallback(async () => {
    if (!canEdit) return;

    setSaveState("saving");
    try {
      await API.put(
        `/api/projects/${projectId}/diagram`,
        {
          nodes: serializeNodes(nodes),
          edges: serializeEdges(edges),
          viewport: toObject().viewport,
        },
        { headers: authHeaders() },
      );
      setDirty(false);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [canEdit, edges, nodes, projectId, toObject]);

  useEffect(() => {
    if (!dirty || loading) return;
    const timeoutId = window.setTimeout(() => {
      void persistDraft();
    }, 1500);
    return () => window.clearTimeout(timeoutId);
  }, [dirty, loading, persistDraft]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ── Canvas handlers ─────────────────────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
    if (changes.some((change) => change.type !== "select")) setDirty(true);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
    if (changes.some((change) => change.type !== "select")) setDirty(true);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source === connection.target) return;

    setEdges((current) =>
      addEdge(
        normalizeEdge({
          ...connection,
          id: `edge_${Date.now()}`,
        } as Edge),
        current,
      ),
    );
    setDirty(true);
  }, []);

  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const nextLabel = window.prompt(
        "Edge label",
        (edge.label as string) || "",
      );
      if (nextLabel === null) return;
      setEdges((current) =>
        current.map((item) =>
          item.id === edge.id ? { ...item, label: nextLabel.trim() } : item,
        ),
      );
      setDirty(true);
    },
    [],
  );

  const addNode = (shape: ShapeType) => {
    const wrapperBounds = flowWrapperRef.current?.getBoundingClientRect();
    const screenPosition = {
      x: (wrapperBounds?.left || 0) + (wrapperBounds?.width || window.innerWidth) / 2,
      y: (wrapperBounds?.top || 0) + (wrapperBounds?.height || window.innerHeight) / 2,
    };
    const position = screenToFlowPosition(screenPosition, { snapToGrid: true });
    const size = DEFAULT_SIZE[shape];

    const newNode = attachNodeRuntime(
      {
        id: nextId(),
        type: "shapeNode",
        position,
        style: {
          width: size.width,
          height: size.height,
        },
        data: {
          label: SHAPE_LABELS[shape],
          shape,
        },
      },
      runtimeHandlers,
    );

    setNodes((current) => [...current, newNode]);
    setDirty(true);
  };

  // ── Save as new version ─────────────────────────────────────────────────
  const saveVersion = async () => {
    setSavingVersion(true);
    try {
      await persistDraft();
      const res = await API.post(
        `/api/projects/${projectId}/diagram/versions`,
        {
          nodes: serializeNodes(nodes),
          edges: serializeEdges(edges),
          viewport: toObject().viewport,
          label: versionLabel.trim() || undefined,
        },
        { headers: authHeaders() },
      );

      if (res.data.success) {
        setLatestVersion(res.data.data.version_number);
        setShowVersionModal(false);
        setVersionLabel("");
      }
    } finally {
      setSavingVersion(false);
    }
  };

  // ── Restore a version into the canvas ───────────────────────────────────
  const restoreVersion = async (versionId: number) => {
    const res = await API.post(
      `/api/projects/diagram-versions/${versionId}/restore`,
      {},
      { headers: authHeaders() },
    );

    if (res.data.success) {
      const diagram = res.data.data;
      setNodes(
        (diagram.nodes || []).map((node: Node) =>
          attachNodeRuntime(node, runtimeHandlers),
        ),
      );
      setEdges((diagram.edges || []).map((edge: Edge) => normalizeEdge(edge)));
      setDirty(false);
      setSaveState("saved");
      setShowHistory(false);
      window.requestAnimationFrame(() => {
        void fitView({ padding: 0.2, duration: 250 });
      });
    }
  };

  // ── Download as PNG ─────────────────────────────────────────────────────
  const downloadImage = async () => {
    const allNodes = getNodes();
    const viewportElement = flowWrapperRef.current?.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;

    if (allNodes.length === 0 || !viewportElement) return;

    setExporting(true);
    try {
      const bounds = getNodesBounds(allNodes);
      const imageWidth = Math.min(
        3200,
        Math.max(1200, Math.ceil(bounds.width + 280)),
      );
      const imageHeight = Math.min(
        2400,
        Math.max(800, Math.ceil(bounds.height + 280)),
      );
      const exportViewport = getViewportForBounds(
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
          transform: `translate(${exportViewport.x}px, ${exportViewport.y}px) scale(${exportViewport.zoom})`,
          transformOrigin: "0 0",
        },
        filter: (domNode) => {
          const element = domNode as HTMLElement;
          return !(
            element.classList?.contains("react-flow__resize-control") ||
            element.classList?.contains("react-flow__node-toolbar")
          );
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
      console.error("Diagram PNG export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  const nodeTypesMemo = useMemo(() => nodeTypes, []);
  const defaultEdgeOptions = useMemo(
    () => normalizeEdge({ id: "default", source: "", target: "" } as Edge),
    [],
  );

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-sm text-gray-400">
        Loading diagram…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] min-h-[520px] flex-col overflow-hidden">
      <style>{`
        .diagram-flow .react-flow__edge-path {
          stroke: ${EDGE_COLOR};
          stroke-width: ${EDGE_WIDTH};
        }
        .diagram-flow .react-flow__arrowhead path {
          fill: ${EDGE_COLOR};
          stroke: ${EDGE_COLOR};
        }
        .diagram-flow .react-flow__edge-text {
          fill: #334155;
        }
        .diagram-flow .react-flow__edge-textbg {
          fill: #ffffff;
          fill-opacity: 0.94;
        }
        .dark .diagram-flow .react-flow__edge-text {
          fill: #e5e7eb;
        }
        .dark .diagram-flow .react-flow__edge-textbg {
          fill: #111827;
          fill-opacity: 0.94;
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectId}`)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Back to project overview"
        >
          <FaArrowLeft />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {projectName || "Project"} — Flow Diagram
          </h1>
          <p className="text-[11px] text-gray-400">
            {latestVersion > 0
              ? `Latest saved version: v${latestVersion}`
              : "No versions saved yet"}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-1 flex items-center gap-1.5 text-xs text-gray-400">
            {saveState === "saving" && "Saving draft…"}
            {saveState === "saved" && !dirty && (
              <>
                <FaCheckCircle className="h-3 w-3 text-green-500" /> Draft saved
              </>
            )}
            {saveState === "error" && (
              <span className="text-red-500">Autosave failed</span>
            )}
          </span>

          <button
            type="button"
            onClick={() => void fitView({ padding: 0.2, duration: 250 })}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title="Fit all nodes"
          >
            <FaCompressArrowsAlt className="h-3 w-3" /> Fit
          </button>

          <button
            type="button"
            onClick={downloadImage}
            disabled={exporting || nodes.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <FaDownload className="h-3 w-3" />
            {exporting ? "Exporting…" : "Download PNG"}
          </button>

          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <FaHistory className="h-3 w-3" /> History
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowVersionModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <FaSave className="h-3 w-3" /> Save as New Version
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={flowWrapperRef} className="diagram-flow relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={canEdit ? onNodesChange : undefined}
          onEdgesChange={canEdit ? onEdgesChange : undefined}
          onConnect={canEdit ? onConnect : undefined}
          onEdgeDoubleClick={canEdit ? onEdgeDoubleClick : undefined}
          nodeTypes={nodeTypesMemo}
          defaultEdgeOptions={defaultEdgeOptions}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          elementsSelectable={canEdit}
          deleteKeyCode={canEdit ? ["Backspace", "Delete"] : []}
          snapToGrid
          snapGrid={SNAP_GRID}
          selectionOnDrag={canEdit}
          panOnDrag={[1, 2]}
          onlyRenderVisibleElements={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          connectionLineStyle={{ stroke: EDGE_COLOR, strokeWidth: EDGE_WIDTH }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            className="!bg-white dark:!bg-gray-900"
            nodeStrokeWidth={3}
          />

          {canEdit && (
            <Panel position="top-left">
              <div className="flex max-w-[calc(100vw-32px)] flex-wrap gap-1.5 rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                {(
                  ["start", "process", "decision", "note", "end"] as ShapeType[]
                ).map((shape) => (
                  <button
                    type="button"
                    key={shape}
                    onClick={() => addNode(shape)}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <FaPlus className="h-2.5 w-2.5" />
                    {SHAPE_LABELS[shape]}
                  </button>
                ))}
              </div>
            </Panel>
          )}

          <Panel position="bottom-center">
            <div className="rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-[11px] text-gray-500 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-400">
              Double-click a node or edge to rename · Select a node to resize,
              duplicate, reset, or delete
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Save-as-new-version modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
              Save as New Version
            </h3>
            <p className="mb-4 text-xs text-gray-400">
              This will become v{latestVersion + 1}. Versions are permanent and
              can be restored later.
            </p>
            <input
              autoFocus
              value={versionLabel}
              onChange={(event) => setVersionLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setShowVersionModal(false);
                if (event.key === "Enter" && !savingVersion) void saveVersion();
              }}
              placeholder="Optional label, e.g. 'After auth redesign'"
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:text-gray-200"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVersionModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveVersion}
                disabled={savingVersion}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {savingVersion ? "Saving…" : "Save Version"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <VersionHistoryPanel
          projectId={projectId}
          onClose={() => setShowHistory(false)}
          onRestore={restoreVersion}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}

export default function FlowDiagramEditor() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;

  return (
    <>
      <PageMeta title="Flow Diagram" description="Project flow diagram editor" />
      <ReactFlowProvider>
        <DiagramCanvas projectId={id} />
      </ReactFlowProvider>
    </>
  );
}