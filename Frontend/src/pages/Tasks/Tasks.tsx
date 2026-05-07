import { useState, useEffect } from "react";
import { FaPlus, FaSearch, FaUser, FaBell } from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import API from "../../services/api";

import {
  Task,
  TaskFormData,
  AlertState,
  User,
  Project,
  TestSuite,
} from "./types";
import { ALL_STATUSES, ALL_PRIORITIES } from "./constants";
import TaskAccordionRow from "./components/TaskAccordionRow";
import CreateEditModal from "./components/modals/CreateEditModal";
import ViewModal from "./components/modals/ViewModal";
import DeleteModal from "./components/modals/DeleteModal";

const DEFAULT_FORM: TaskFormData = {
  title: "",
  description: "",
  priority: "Medium",
  start_date: "",
  due_date: "",
  project_id: "",
  suite_id: "",
  tags: "",
};

export default function Tasks() {
  const {
    data: tasks,
    loading,
    error,
  } = useFetchWithAuth<Task[]>("/api/tasks");
  const { data: projects } = useFetchWithAuth<Project[]>("/api/projects");
  const { data: allSuites } = useFetchWithAuth<TestSuite[]>("/api/test-suites");
  const { data: users } = useFetchWithAuth<User[]>("/api/dropdown/users");

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState(
    () => new URLSearchParams(window.location.search).get("status") ?? "",
  );
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignedMe, setFilterAssignedMe] = useState(false);
  const [search, setSearch] = useState("");

  // ── Create / Edit modal ───────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<AlertState | null>(null);
  const [formData, setFormData] = useState<TaskFormData>(DEFAULT_FORM);
  const [assignees, setAssignees] = useState<number[]>([]);
  const [watchers, setWatchers] = useState<number[]>([]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("");

  // ── Delete modal ──────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<AlertState | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // ── View modal ────────────────────────────────────────────────────────────
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  // ── Derived data ──────────────────────────────────────────────────────────
  const displayedTasks = (tasks || []).filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (
      search &&
      !t.title.toLowerCase().includes(search.toLowerCase()) &&
      !(t.description || "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  // ── ESC closes view modal ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showViewModal) {
        setShowViewModal(false);
        setViewingTask(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showViewModal]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showReminderToast = (msg: string) => {
    setReminderToast(msg);
    setTimeout(() => setReminderToast(null), 4000);
  };

  const getToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setAssignees([]);
    setWatchers([]);
    setSelectedProjectFilter("");
    setFormAlert(null);
  };

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.title.trim()) {
      setFormAlert({ type: "error", message: "Title is required." });
      return;
    }
    setSubmitting(true);
    setFormAlert(null);
    try {
      const payload = {
        ...formData,
        project_id: formData.project_id || null,
        suite_id: formData.suite_id || null,
        start_date: formData.start_date || null,
        due_date: formData.due_date || null,
        assignees,
        watchers,
      };
      const url = editingTask
        ? `/api/tasks/update/${editingTask.id}`
        : "/api/tasks/create";
      const method = editingTask ? API.put : API.post;
      const res = await method(url, payload, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) {
        setFormAlert({
          type: "success",
          message: editingTask ? "Task updated!" : "Task created!",
        });
        setTimeout(() => {
          setShowModal(false);
          resetForm();
          setEditingTask(null);
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      setFormAlert({
        type: "error",
        message: err.response?.data?.message || "Operation failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (task: Task) => {
    try {
      const res = await API.get(`/api/tasks/${task.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) {
        const full: Task = res.data.data;
        setEditingTask(full);
        const suite = allSuites?.find((s) => s.id === full.suite_id);
        setSelectedProjectFilter(
          suite
            ? String(suite.project_id)
            : full.project_id
              ? String(full.project_id)
              : "",
        );
        setFormData({
          title: full.title,
          description: full.description || "",
          priority: full.priority,
          start_date: full.start_date ? full.start_date.substring(0, 10) : "",
          due_date: full.due_date ? full.due_date.substring(0, 10) : "",
          project_id: full.project_id ? String(full.project_id) : "",
          suite_id: full.suite_id ? String(full.suite_id) : "",
          tags: full.tags || "",
        });
        setAssignees(
          (full.assignments || [])
            .filter((a) => a.role === "Assignee")
            .map((a) => a.user_id),
        );
        setShowModal(true);
      }
    } catch {
      setEditingTask(task);
      setShowModal(true);
    }
  };

  const handleView = async (task: Task) => {
    setViewLoading(true);
    setShowViewModal(true);
    try {
      const res = await API.get(`/api/tasks/${task.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) setViewingTask(res.data.data);
    } catch {
      setViewingTask(task);
    } finally {
      setViewLoading(false);
    }
  };

  const refreshViewingTask = async () => {
    if (!viewingTask) return;
    try {
      const res = await API.get(`/api/tasks/${viewingTask.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) setViewingTask(res.data.data);
    } catch {}
  };

  const handleDeleteClick = (task: Task) => {
    setDeletingTask(task);
    setDeleteAlert(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    setDeletingInProgress(true);
    setDeleteAlert(null);
    try {
      await API.delete(`/api/tasks/delete/${deletingTask.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteAlert({
        type: "success",
        message: "Task deleted successfully.",
      });
      setTimeout(() => {
        setShowDeleteModal(false);
        setDeletingTask(null);
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setDeleteAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete task.",
      });
    } finally {
      setDeletingInProgress(false);
    }
  };

  const closeCreateEdit = () => {
    setShowModal(false);
    resetForm();
    setEditingTask(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageMeta title="Tasks" description="Task & Activity Management" />
      <PageBreadcrumb pageTitle="Tasks" />

      {/* Toast */}
      {reminderToast && (
        <div className="fixed top-5 right-5 z-[9999999] flex items-center gap-3 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 shadow-xl rounded-xl px-4 py-3 min-w-[280px] animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
            <FaBell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
              Notice
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {reminderToast}
            </p>
          </div>
          <button
            onClick={() => setReminderToast(null)}
            className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 text-lg leading-none flex-shrink-0"
          >
            &times;
          </button>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Priorities</option>
              {ALL_PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={() => setFilterAssignedMe(!filterAssignedMe)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                filterAssignedMe
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
              }`}
            >
              <FaUser className="w-3 h-3" />
              Assigned to me
            </button>
          </div>
          <button
            onClick={() => {
              setEditingTask(null);
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-150 flex items-center gap-2 flex-shrink-0"
          >
            <FaPlus className="w-3 h-3" /> Create Task
          </button>
        </div>

        {error && <Alert variant="error" title="Error" message={error} />}
        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            Loading tasks...
          </div>
        )}
        {!loading && !error && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Showing {displayedTasks.length} of {(tasks || []).length} tasks
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-2">
            {displayedTasks.length > 0 ? (
              displayedTasks.map((task) => (
                <TaskAccordionRow
                  key={task.id}
                  task={task}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onView={handleView}
                />
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                No tasks found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateEditModal
        showModal={showModal}
        editingTask={editingTask}
        formData={formData}
        setFormData={setFormData}
        assignees={assignees}
        setAssignees={setAssignees}
        selectedProjectFilter={selectedProjectFilter}
        setSelectedProjectFilter={setSelectedProjectFilter}
        formAlert={formAlert}
        submitting={submitting}
        projects={projects}
        allSuites={allSuites}
        users={users}
        onClose={closeCreateEdit}
        onSave={handleSave}
      />

      <ViewModal
        showViewModal={showViewModal}
        viewingTask={viewingTask}
        viewLoading={viewLoading}
        users={users || []}
        onClose={() => {
          setShowViewModal(false);
          setViewingTask(null);
        }}
        onProgressAdded={() => viewingTask && handleView(viewingTask)}
        onCommentAdded={() => viewingTask && handleView(viewingTask)}
        onReminderSaved={showReminderToast}
        onStatusChanged={refreshViewingTask}
        onETAChanged={refreshViewingTask}
      />

      <DeleteModal
        showDeleteModal={showDeleteModal}
        deletingTask={deletingTask}
        deleteAlert={deleteAlert}
        deletingInProgress={deletingInProgress}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingTask(null);
          setDeleteAlert(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
