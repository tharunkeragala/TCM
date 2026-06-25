import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  FaArrowLeft,
  FaPlay,
  FaCheckCircle,
  FaPlus,
  FaLayerGroup,
  FaClipboardList,
} from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import API from "../../services/api";
import SuiteSprintModal from "./Suitesprintmodal";

const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const COLUMNS = ["To Do", "In Progress", "Done"] as const;
type ColumnKey = (typeof COLUMNS)[number];

const COLUMN_STYLES: Record<ColumnKey, string> = {
  "To Do": "border-t-gray-400",
  "In Progress": "border-t-blue-500",
  Done: "border-t-green-500",
};

interface Sprint {
  id: number;
  sprint_name: string;
  goal?: string;
  project_id: number;
  project_name?: string;
  status: "Planned" | "Active" | "Completed";
  start_date?: string;
  end_date?: string;
}

interface BoardSuite {
  sprint_suite_id: number;
  suite_id: number;
  suite_name: string;
  description?: string;
  is_active: boolean;
  project_name?: string;
  board_status: ColumnKey;
  case_count: number;
  ready_count: number;
  draft_count: number;
}

interface SelectableSuite {
  id: number;
  suite_name: string;
  project_id: number;
}

// ─── Add Suite To Board Modal ──────────────────────────────────────────────
function AddSuiteModal({
  sprintId,
  projectId,
  alreadyOnBoard,
  onClose,
  onAdded,
}: {
  sprintId: number;
  projectId: number;
  alreadyOnBoard: number[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [allSuites, setAllSuites] = useState<SelectableSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get(`/api/test-suites?project_id=${projectId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.data.success) setAllSuites(res.data.data);
      } catch {
        setAlert({ type: "error", message: "Failed to load suites for this project." });
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const available = allSuites.filter((s) => !alreadyOnBoard.includes(s.id));

  const handleAdd = async (suiteId: number) => {
    setAddingId(suiteId);
    try {
      await API.post(
        `/api/sprints/${sprintId}/suites`,
        { suite_id: suiteId },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      onAdded();
    } catch (err: any) {
      setAlert({ type: "error", message: err.response?.data?.message || "Failed to add suite." });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Suite to Sprint</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">&times;</button>
        </div>
        {alert && <div className="mb-3"><Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} /></div>}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Loading…</p>
          ) : available.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">All suites in this project are already on the board.</p>
          ) : (
            <div className="space-y-2">
              {available.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.suite_name}</span>
                  <button
                    onClick={() => handleAdd(s.id)}
                    disabled={addingId === s.id}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
                  >
                    {addingId === s.id ? "Adding…" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Board ─────────────────────────────────────────────────────────────
export default function SprintBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const sprintId = Number(id);

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [board, setBoard] = useState<BoardSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuite, setSelectedSuite] = useState<BoardSuite | null>(null);
  const [showAddSuite, setShowAddSuite] = useState(false);
  const [dragSuiteId, setDragSuiteId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const loadSprint = useCallback(async () => {
    try {
      const res = await API.get(`/api/sprints/${sprintId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.data.success) setSprint(res.data.data);
    } catch {
      setError("Failed to load sprint.");
    }
  }, [sprintId]);

  const loadBoard = useCallback(async () => {
    try {
      const res = await API.get(`/api/sprints/${sprintId}/board`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.data.success) setBoard(res.data.data);
    } catch {
      setError("Failed to load sprint board.");
    }
  }, [sprintId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSprint(), loadBoard()]).finally(() => setLoading(false));
  }, [loadSprint, loadBoard]);

  const refreshBoard = () => { loadBoard(); loadSprint(); };

  const handleStatusChange = async (status: Sprint["status"]) => {
    if (!sprint) return;
    setStatusUpdating(true);
    try {
      await API.put(`/api/sprints/${sprintId}/status`, { status }, { headers: { Authorization: `Bearer ${getToken()}` } });
      setSprint({ ...sprint, status });
    } catch {
      setError("Failed to update sprint status.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDrop = async (col: ColumnKey) => {
    setDragOverCol(null);
    if (dragSuiteId == null) return;
    const suite = board.find((b) => b.suite_id === dragSuiteId);
    if (!suite || suite.board_status === col) { setDragSuiteId(null); return; }

    // optimistic update
    setBoard((prev) => prev.map((b) => (b.suite_id === dragSuiteId ? { ...b, board_status: col } : b)));
    try {
      await API.put(
        `/api/sprints/${sprintId}/suites/${dragSuiteId}/board-status`,
        { board_status: col },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
    } catch {
      loadBoard(); // revert on failure
      setError("Failed to move suite.");
    } finally {
      setDragSuiteId(null);
    }
  };

  if (loading) {
    return (
      <div>
        <PageMeta title="Sprint Board" description="Sprint board" />
        <PageBreadcrumb pageTitle="Sprint Board" />
        <div className="mt-6 text-center text-gray-500 dark:text-gray-400 py-12">Loading sprint board...</div>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div>
        <PageMeta title="Sprint Board" description="Sprint board" />
        <PageBreadcrumb pageTitle="Sprint Board" />
        <div className="mt-4">
          <Alert variant="error" title="Error" message={error || "Sprint not found."} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageMeta title={sprint.sprint_name} description="Sprint board" />
      <PageBreadcrumb pageTitle="Sprint Board" />

      <div className="mt-4 space-y-4">
        {error && <Alert variant="error" title="Error" message={error} />}

        {/* Header */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <button
                onClick={() => navigate("/sprints")}
                className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FaArrowLeft className="h-3 w-3" /> All Sprints
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500">{sprint.project_name}</p>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{sprint.sprint_name}</h1>
              {sprint.goal && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sprint.goal}</p>}
            </div>

            <div className="flex items-center gap-2">
              {sprint.status === "Planned" && (
                <button
                  onClick={() => handleStatusChange("Active")}
                  disabled={statusUpdating}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <FaPlay className="h-3 w-3" /> Start Sprint
                </button>
              )}
              {sprint.status === "Active" && (
                <button
                  onClick={() => handleStatusChange("Completed")}
                  disabled={statusUpdating}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <FaCheckCircle className="h-3 w-3" /> Complete Sprint
                </button>
              )}
              <button
                onClick={() => setShowAddSuite(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <FaPlus className="h-3 w-3" /> Add Suite
              </button>
            </div>
          </div>
        </div>

        {/* Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const items = board.filter((b) => b.board_status === col);
            return (
              <div
                key={col}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col); }}
                onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
                onDrop={(e) => { e.preventDefault(); handleDrop(col); }}
                className={`rounded-xl border-t-4 ${COLUMN_STYLES[col]} bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 p-3 min-h-[300px] transition-colors ${
                  dragOverCol === col ? "ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-900/10" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{col}</h3>
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{items.length}</span>
                </div>

                <div className="space-y-2">
                  {items.map((suite) => (
                    <div
                      key={suite.suite_id}
                      draggable
                      onDragStart={() => setDragSuiteId(suite.suite_id)}
                      onClick={() => setSelectedSuite(suite)}
                      className="cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <FaLayerGroup className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{suite.suite_name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <FaClipboardList className="w-3 h-3" /> {suite.case_count}
                        </span>
                        {suite.case_count > 0 && (
                          <span className="text-green-600 dark:text-green-400">{suite.ready_count} ready</span>
                        )}
                        {!suite.is_active && (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 text-[10px] font-semibold">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <div className="text-center text-xs text-gray-400 dark:text-gray-600 py-6 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                      Drop a suite here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {board.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No suites on this board yet.{" "}
            <button onClick={() => setShowAddSuite(true)} className="text-blue-500 hover:underline">
              Add a suite to get started
            </button>
          </div>
        )}
      </div>

      {selectedSuite && (
  <SuiteSprintModal
    sprintId={sprintId}
    sprintName={sprint.sprint_name}
    suite={selectedSuite}
    onClose={() => setSelectedSuite(null)}
    onBoardChanged={refreshBoard}
  />
)}

      {showAddSuite && sprint && (
        <AddSuiteModal
          sprintId={sprintId}
          projectId={sprint.project_id}
          alreadyOnBoard={board.map((b) => b.suite_id)}
          onClose={() => setShowAddSuite(false)}
          onAdded={() => { refreshBoard(); }}
        />
      )}
    </div>
  );
}