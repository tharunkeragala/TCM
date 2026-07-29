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
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  MarkerType,
  Handle,
  Position,
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
} from "react-icons/fa";
import API from "../../services/api";
import PageMeta from "../../components/common/PageMeta";
import { usePermissions } from "../../hooks/usePermissions";

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// ─── Types ──────────────────────────────────────────────────────────────────
type ShapeType = "start" | "end" | "process" | "decision" | "note";

interface ShapeNodeData extends Record<string, unknown> {
  label: string;
  shape: ShapeType;
  onLabelChange?: (id: string, label: string) => void;
}

interface DiagramVersion {
  id: number;
  project_id: number;
  version_number: number;
  label: string | null;
  created_by_name?: string;
  created_at: string;
}

const SHAPE_LABELS: Record<ShapeType, string> = {
  start: "Start",
  end: "End",
  process: "New Step",
  decision: "Condition?",
  note: "Note",
};

// Every node gets an explicit width/height at creation time (rather than
// "auto"). This is required for NodeResizer to work cleanly — a node with no
// explicit size has nothing for the resize handles to grab onto.
const DEFAULT_SIZE: Record<ShapeType, { width: number; height: number }> = {
  start: { width: 130, height: 52 },
  end: { width: 130, height: 52 },
  process: { width: 160, height: 64 },
  decision: { width: 180, height: 120 },
  note: { width: 160, height: 72 },
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
      {/* Renders drag handles around the node when selected. It resizes the
          node's own width/height directly (works fine with our controlled
          nodes state — resize changes come back through onNodesChange like
          any other change type). */}
      <NodeResizer
        isVisible={selected}
        minWidth={90}
        minHeight={40}
        handleClassName="!bg-brand-500 !border-none !w-2.5 !h-2.5 !rounded-sm"
        lineClassName="!border-brand-400"
      />
      <div
        style={clipStyle}
        onDoubleClick={() => setEditing(true)}
        className={`relative w-full h-full flex items-center justify-center border-2 text-sm font-medium text-center shadow-sm select-none ${shapeClasses[nodeData.shape]} ${
          nodeData.shape === "decision" ? "px-9" : "px-4 py-2"
        } ${selected ? "ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-gray-900" : ""}`}
      >
        <Handle type="target" position={Position.Top} id="top" className="!bg-gray-400 !w-2 !h-2" />
        <Handle type="target" position={Position.Left} id="left" className="!bg-gray-400 !w-2 !h-2" />

        {editing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setValue(nodeData.label);
                setEditing(false);
              }
            }}
            className="nodrag w-full bg-transparent text-center outline-none border-b border-current"
          />
        ) : (
          <span className="whitespace-pre-wrap break-words">{nodeData.label}</span>
        )}

        <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-gray-400 !w-2 !h-2" />
        <Handle type="source" position={Position.Right} id="right" className="!bg-gray-400 !w-2 !h-2" />
      </div>
    </>
  );
}

const nodeTypes = { shapeNode: ShapeNode };

// Strip runtime-only fields (callbacks) before sending nodes to the API.
// width/height are included so resizing persists across reloads.
const serializeNodes = (nodes: Node[]) =>
  nodes.map((n) => {
    const shape = (n.data as ShapeNodeData).shape;
    return {
      id: n.id,
      type: n.type,
      position: n.position,
      width: n.width ?? n.measured?.width ?? DEFAULT_SIZE[shape].width,
      height: n.height ?? n.measured?.height ?? DEFAULT_SIZE[shape].height,
      data: { label: (n.data as ShapeNodeData).label, shape },
    };
  });

// Nodes saved before resizing existed (or loaded without dimensions for any
// other reason) need a fallback size, otherwise the "w-full h-full" node
// body collapses to nothing.
const withDefaults = (n: Node, onLabelChange: (id: string, label: string) => void): Node => {
  const shape = (n.data as ShapeNodeData).shape;
  return {
    ...n,
    width: n.width ?? DEFAULT_SIZE[shape]?.width,
    height: n.height ?? DEFAULT_SIZE[shape]?.height,
    data: { ...n.data, onLabelChange },
  };
};

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
      setVersions((prev) => prev.filter((v) => v.id !== versionId));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[999998] w-full max-w-sm bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FaHistory className="w-3.5 h-3.5" /> Version History
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <FaTimes />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Loading versions…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6 italic">
            No saved versions yet. Use "Save as New Version" to create one.
          </p>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  v{v.version_number}
                  {v.label ? (
                    <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                      — {v.label}
                    </span>
                  ) : null}
                </p>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {v.created_by_name || "Unknown"} · {new Date(v.created_at).toLocaleString()}
              </p>
              <div className="flex gap-2 mt-2">
                {canEdit && (
                  <button
                    onClick={() => onRestore(v.id)}
                    disabled={busyId === v.id}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                  >
                    <FaUndo className="w-3 h-3" /> Restore
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(v.id)}
                    disabled={busyId === v.id}
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [latestVersion, setLatestVersion] = useState(0);

  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const idCounter = useRef(0);
  const nextId = () => `node_${Date.now()}_${idCounter.current++}`;

  const { screenToFlowPosition, getNodes, toObject, fitView, getViewport, setViewport } =
    useReactFlow();
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  const onLabelChange = useCallback((id: string, label: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
    );
    setDirty(true);
  }, []);

  // ── Load project name + diagram draft ──────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [projectRes, diagramRes] = await Promise.all([
          API.get(`/api/projects/${projectId}`, { headers: authHeaders() }),
          API.get(`/api/projects/${projectId}/diagram`, { headers: authHeaders() }),
        ]);
        if (projectRes.data.success) setProjectName(projectRes.data.data.project_name);
        if (diagramRes.data.success) {
          const d = diagramRes.data.data;
          setNodes((d.nodes || []).map((n: Node) => withDefaults(n, onLabelChange)));
          setEdges(d.edges || []);
          setLatestVersion(d.latest_version_number || 0);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Silent autosave draft ───────────────────────────────────────────────
  const persistDraft = useCallback(async () => {
    if (!canEdit) return;
    setSaveState("saving");
    try {
      await API.put(
        `/api/projects/${projectId}/diagram`,
        { nodes: serializeNodes(nodes), edges, viewport: toObject().viewport },
        { headers: authHeaders() },
      );
      setDirty(false);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, nodes, edges, canEdit]);

  useEffect(() => {
    if (!dirty || loading) return;
    const t = setTimeout(() => {
      void persistDraft();
    }, 1500);
    return () => clearTimeout(t);
  }, [dirty, loading, persistDraft]);

  // Warn on tab close with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ── Canvas handlers ─────────────────────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    if (changes.some((c) => c.type !== "select")) setDirty(true);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    if (changes.some((c) => c.type !== "select")) setDirty(true);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) =>
      addEdge(
        { ...connection, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } },
        eds,
      ),
    );
    setDirty(true);
  }, []);

  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const next = window.prompt("Edge label", (edge.label as string) || "");
    if (next === null) return;
    setEdges((eds) => eds.map((e) => (e.id === edge.id ? { ...e, label: next } : e)));
    setDirty(true);
  }, []);

  const addNode = (shape: ShapeType) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 + Math.random() * 60 - 30,
      y: window.innerHeight / 2 + Math.random() * 60 - 30,
    });
    const newNode: Node = {
      id: nextId(),
      type: "shapeNode",
      position,
      width: DEFAULT_SIZE[shape].width,
      height: DEFAULT_SIZE[shape].height,
      data: { label: SHAPE_LABELS[shape], shape, onLabelChange },
    };
    setNodes((nds) => [...nds, newNode]);
    setDirty(true);
  };

  // ── Save as new version ─────────────────────────────────────────────────
  const saveVersion = async () => {
    setSavingVersion(true);
    try {
      // Flush the current state as a draft first so drafts and versions
      // never drift apart, then snapshot it.
      await persistDraft();
      const res = await API.post(
        `/api/projects/${projectId}/diagram/versions`,
        {
          nodes: serializeNodes(nodes),
          edges,
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
      const d = res.data.data;
      setNodes((d.nodes || []).map((n: Node) => withDefaults(n, onLabelChange)));
      setEdges(d.edges || []);
      setDirty(false);
      setSaveState("saved");
      setShowHistory(false);
    }
  };

  // ── Download as PNG ─────────────────────────────────────────────────────
  // Rather than hand-computing a crop box (which was clipping nodes near the
  // edges), we fit every node into view first and then screenshot exactly
  // that — guaranteed to include the whole diagram since nothing is panned
  // out of frame. pixelRatio upscales the export so it isn't limited to the
  // user's current on-screen canvas size. We capture ".react-flow__renderer"
  // specifically (not the outer ".react-flow" container) so the MiniMap,
  // Controls, and the shape palette panel are excluded from the image.
  const downloadImage = async () => {
    const allNodes = getNodes();
    if (allNodes.length === 0 || !flowWrapperRef.current) return;

    const previousViewport = getViewport();

    fitView({ padding: 0.2, duration: 0 });
    // Let the fitted transform actually paint before we snapshot it.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const target = flowWrapperRef.current.querySelector(
      ".react-flow__renderer",
    ) as HTMLElement | null;

    if (target) {
      const isDark = document.documentElement.classList.contains("dark");
      try {
        const dataUrl = await toPng(target, {
          backgroundColor: isDark ? "#111827" : "#ffffff",
          pixelRatio: 2,
          cacheBust: true,
        });
        const link = document.createElement("a");
        const safeName = (projectName || "project").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        link.download = `${safeName}-flow-diagram.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("Diagram PNG export failed:", err);
      }
    }

    // Put the user's pan/zoom back the way it was.
    setViewport(previousViewport, { duration: 0 });
  };

  const nodeTypesMemo = useMemo(() => nodeTypes, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh] text-sm text-gray-400">
        Loading diagram…
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          title="Back to project overview"
        >
          <FaArrowLeft />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {projectName || "Project"} — Flow Diagram
          </h1>
          <p className="text-[11px] text-gray-400">
            {latestVersion > 0 ? `Latest saved version: v${latestVersion}` : "No versions saved yet"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1.5 mr-2">
            {saveState === "saving" && "Saving draft…"}
            {saveState === "saved" && !dirty && (
              <>
                <FaCheckCircle className="text-green-500 w-3 h-3" /> Draft saved
              </>
            )}
            {saveState === "error" && <span className="text-red-500">Autosave failed</span>}
          </span>

          <button
            onClick={downloadImage}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <FaDownload className="w-3 h-3" /> Download PNG
          </button>

          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <FaHistory className="w-3 h-3" /> History
          </button>

          {canEdit && (
            <button
              onClick={() => setShowVersionModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700"
            >
              <FaSave className="w-3 h-3" /> Save as New Version
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={canEdit ? onNodesChange : undefined}
          onEdgesChange={canEdit ? onEdgesChange : undefined}
          onConnect={canEdit ? onConnect : undefined}
          onEdgeDoubleClick={canEdit ? onEdgeDoubleClick : undefined}
          nodeTypes={nodeTypesMemo}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          elementsSelectable={canEdit}
          deleteKeyCode={canEdit ? ["Backspace", "Delete"] : []}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-white dark:!bg-gray-900" />

          {canEdit && (
            <Panel position="top-left">
              <div className="flex flex-col gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2 shadow-sm">
                {(["start", "process", "decision", "note", "end"] as ShapeType[]).map((shape) => (
                  <button
                    key={shape}
                    onClick={() => addNode(shape)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <FaPlus className="w-2.5 h-2.5" />
                    {SHAPE_LABELS[shape]}
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Save-as-new-version modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Save as New Version
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              This will become v{latestVersion + 1}. Versions are permanent and can be restored later.
            </p>
            <input
              autoFocus
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="Optional label, e.g. 'After auth redesign'"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowVersionModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveVersion}
                disabled={savingVersion}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg"
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