import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  FaPlus,
  FaCalendarAlt,
  FaLayerGroup,
  FaClipboardList,
  FaPlay,
  FaCheckCircle,
  FaTrash,
  FaEdit,
} from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import DateField from "../../components/common/DateField";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import API from "../../services/api";

interface Project {
  id: number;
  project_name: string;
}

interface Sprint {
  id: number;
  project_id: number;
  project_name?: string;
  sprint_name: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status: "Planned" | "Active" | "Completed";
  suite_count?: number;
  case_count?: number;
  created_by_name?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Planned: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Active: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

// ─── Create / Edit Sprint Modal ────────────────────────────────────────────
function SprintFormModal({
  editing,
  projects,
  defaultProjectId,
  onClose,
  onSaved,
}: {
  editing: Sprint | null;
  projects: Project[];
  defaultProjectId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    project_id: String(editing?.project_id ?? defaultProjectId ?? ""),
    sprint_name: editing?.sprint_name ?? "",
    goal: editing?.goal ?? "",
    start_date: editing?.start_date ? editing.start_date.slice(0, 10) : "",
    end_date: editing?.end_date ? editing.end_date.slice(0, 10) : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSave = async () => {
    if (!formData.sprint_name.trim())
      return setAlert({ type: "error", message: "Sprint name is required." });
    if (!formData.project_id)
      return setAlert({ type: "error", message: "Please select a project." });

    setSubmitting(true);
    setAlert(null);
    try {
      const url = editing ? `/api/sprints/update/${editing.id}` : "/api/sprints/create";
      const method = editing ? API.put : API.post;
      const res = await method(url, formData, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) {
        setAlert({ type: "success", message: editing ? "Sprint updated!" : "Sprint created!" });
        setTimeout(() => {
          onClose();
          onSaved();
        }, 800);
      }
    } catch (err: any) {
      setAlert({ type: "error", message: err.response?.data?.message || "Operation failed." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? "Edit Sprint" : "Create Sprint"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        {alert && (
          <div className="mb-4">
            <Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.project_id}
            onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
            disabled={!!editing}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            <option value="">-- Select Project --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Sprint Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.sprint_name}
            onChange={(e) => setFormData({ ...formData, sprint_name: e.target.value })}
            placeholder="e.g. CFP Sprint 1"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal</label>
          <textarea
            value={formData.goal}
            onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
            placeholder="Optional sprint goal..."
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <DateField
            label="Start Date"
            value={formData.start_date}
            onChange={(val) => setFormData({ ...formData, start_date: val })}
            max={formData.end_date || undefined}
            placeholder="Select start date"
          />
          <DateField
            label="End Date"
            value={formData.end_date}
            onChange={(val) => setFormData({ ...formData, end_date: val })}
            min={formData.start_date || undefined}
            placeholder="Select end date"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition duration-150"
          >
            {submitting ? (editing ? "Updating..." : "Creating...") : editing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ─────────────────────────────────────────────────────────
function DeleteSprintModal({
  sprint,
  onClose,
  onDeleted,
}: {
  sprint: Sprint;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [inProgress, setInProgress] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleConfirm = async () => {
    setInProgress(true);
    setAlert(null);
    try {
      await API.delete(`/api/sprints/delete/${sprint.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setAlert({ type: "success", message: "Sprint deleted." });
      setTimeout(() => { onClose(); onDeleted(); }, 800);
    } catch (err: any) {
      setAlert({ type: "error", message: err.response?.data?.message || "Failed to delete." });
    } finally {
      setInProgress(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Sprint</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">&times;</button>
        </div>
        {alert && (
          <div className="mb-4">
            <Alert variant={alert.type} title={alert.type === "success" ? "Success" : "Error"} message={alert.message} />
          </div>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-5">
          Delete <span className="font-semibold text-gray-900 dark:text-white">"{sprint.sprint_name}"</span>? This removes the board and all suite/test-case links from this sprint — the suites and test cases themselves are kept.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={inProgress} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg">Cancel</button>
          <button onClick={handleConfirm} disabled={inProgress} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg">
            {inProgress ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function Sprints() {
  const navigate = useNavigate();
  const { data: projects } = useFetchWithAuth<Project[]>("/api/projects");
  const [projectFilter, setProjectFilter] = useState("");

  const { data: sprints, loading, error, refetch } = useFetchWithAuth<Sprint[]>(
    projectFilter ? `/api/sprints?project_id=${projectFilter}` : "/api/sprints",
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [deletingSprint, setDeletingSprint] = useState<Sprint | null>(null);

  const onRefresh = () => { if (typeof refetch === "function") refetch(); else window.location.reload(); };

  const grouped = useMemo(() => {
    const order: Sprint["status"][] = ["Active", "Planned", "Completed"];
    return order.map((status) => ({
      status,
      items: (sprints || []).filter((s) => s.status === status),
    }));
  }, [sprints]);

  return (
    <div>
      <PageMeta title="Sprints" description="Sprint planning" />
      <PageBreadcrumb pageTitle="Sprints" />

      <div className="mt-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">All Projects</option>
            {projects?.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-150 flex items-center gap-2"
          >
            <FaPlus className="w-3 h-3" /> Create Sprint
          </button>
        </div>

        {error && <div className="mb-4"><Alert variant="error" title="Error" message={error} /></div>}
        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400 py-8 text-center">Loading sprints...</div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {grouped.map(({ status, items }) =>
              items.length === 0 ? null : (
                <div key={status}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                    {status} ({items.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {items.map((sprint) => (
                      <div
                        key={sprint.id}
                        onClick={() => navigate(`/sprints/${sprint.id}`)}
                        className="cursor-pointer rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            {sprint.status === "Active" ? (
                              <FaPlay className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            ) : sprint.status === "Completed" ? (
                              <FaCheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            ) : (
                              <FaCalendarAlt className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            )}
                            <span className="font-semibold text-gray-900 dark:text-white truncate">{sprint.sprint_name}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${STATUS_COLORS[sprint.status]}`}>
                            {sprint.status}
                          </span>
                        </div>

                        {sprint.project_name && (
                          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sprint.project_name}</p>
                        )}

                        {sprint.goal && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{sprint.goal}</p>
                        )}

                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><FaLayerGroup className="w-3 h-3" /> {sprint.suite_count ?? 0} suites</span>
                          <span className="flex items-center gap-1"><FaClipboardList className="w-3 h-3" /> {sprint.case_count ?? 0} cases</span>
                        </div>

                        {(sprint.start_date || sprint.end_date) && (
                          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                            {sprint.start_date ? new Date(sprint.start_date).toLocaleDateString() : "—"}
                            {" → "}
                            {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : "—"}
                          </p>
                        )}

                        <div
                          className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setEditingSprint(sprint)}
                            className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <FaEdit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setDeletingSprint(sprint)}
                            className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                            title="Delete"
                          >
                            <FaTrash className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}

            {(sprints || []).length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No sprints found.{" "}
                <button onClick={() => setShowCreateModal(true)} className="text-blue-500 hover:underline">
                  Create your first sprint
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <SprintFormModal
          editing={null}
          projects={projects || []}
          defaultProjectId={projectFilter ? Number(projectFilter) : undefined}
          onClose={() => setShowCreateModal(false)}
          onSaved={onRefresh}
        />
      )}
      {editingSprint && (
        <SprintFormModal
          editing={editingSprint}
          projects={projects || []}
          onClose={() => setEditingSprint(null)}
          onSaved={onRefresh}
        />
      )}
      {deletingSprint && (
        <DeleteSprintModal
          sprint={deletingSprint}
          onClose={() => setDeletingSprint(null)}
          onDeleted={onRefresh}
        />
      )}
    </div>
  );
}