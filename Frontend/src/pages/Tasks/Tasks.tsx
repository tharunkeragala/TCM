import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { FaPlus, FaSearch, FaUser, FaBell, FaTimes } from "react-icons/fa";

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
import TablePagination from "../../components/common/TablePagination";

// ─── Default form state ───────────────────────────────────────────────────────
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
  const navigate = useNavigate();

  // ── Data fetches ──────────────────────────────────────────────────────────
  const { data: projects } = useFetchWithAuth<Project[]>("/api/projects");
  const { data: allSuites } = useFetchWithAuth<TestSuite[]>("/api/test-suites");
  const { data: users } = useFetchWithAuth<User[]>("/api/dropdown/users");
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState(
    () => new URLSearchParams(window.location.search).get("status") ?? "",
  );
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignedMe, setFilterAssignedMe] = useState(false);
  const [search, setSearch] = useState("");

  const hasFilters = !!(filterStatus || filterPriority || filterAssignedMe || search);

  const clearFilters = () => {
    setFilterStatus("");
    setFilterPriority("");
    setFilterAssignedMe(false);
    setSearch("");
  };

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // ── Task data ─────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    page: 1,
    limit: 10,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Result range (e.g. "1 - 5 of 13") ───────────────────────────────────────
  const startItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

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

  // ── Fetch tasks ───────────────────────────────────────────────────────────
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (filterStatus) params.append("status", filterStatus);
      if (filterPriority) params.append("priority", filterPriority);
      if (search) params.append("search", search);
      if (filterAssignedMe) params.append("assigned_to_me", "true");

      const res = await API.get(`/api/tasks?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      setTasks(res.data.data || []);
      setPagination(
        res.data.pagination || { total: 0, totalPages: 1, page: 1, limit: 10 },
      );
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [page, limit, filterStatus, filterPriority, filterAssignedMe, search]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterPriority, filterAssignedMe, search, limit]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setAssignees([]);
    setWatchers([]);
    setSelectedProjectFilter("");
    setFormAlert(null);
  };

  const closeCreateEdit = () => {
    setShowModal(false);
    resetForm();
    setEditingTask(null);
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
        setTimeout(async () => {
          closeCreateEdit();
          await fetchTasks();
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
      await fetchTasks();
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
      setTimeout(async () => {
        setShowDeleteModal(false);
        setDeletingTask(null);
        await fetchTasks();
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <PageMeta title="Tasks" description="Task & Activity Management" />
      <PageBreadcrumb pageTitle="Tasks" />

      {/* ── Toast notification ─────────────────────────────────────────────── */}
      {reminderToast && (
        <div className="fixed top-5 right-5 z-[9999] flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-xl px-4 py-3 min-w-[280px] max-w-sm animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <FaBell className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
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
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          >
            <FaTimes className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          {/* Priority */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">All Priorities</option>
            {ALL_PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>

          {/* Assigned to me toggle */}
          <button
            onClick={() => setFilterAssignedMe(!filterAssignedMe)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              filterAssignedMe
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <FaUser className="h-3.5 w-3.5" />
            Assigned to me
          </button>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
            >
              <FaTimes className="h-3 w-3" /> Clear
            </button>
          )}

          {/* Create button */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                setEditingTask(null);
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <FaPlus className="h-3.5 w-3.5" />
              Create Task
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && <Alert variant="error" title="Error" message={error} />}

      {/* ── Loading skeleton ────────────────────────────────────────────────── */}
      {loading && !error && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ── Task list ──────────────────────────────────────────────────────── */}
      {!loading && !error && (
        <>
          {/* Result range */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {startItem}
            </span>
            {" - "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {endItem}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {pagination.total}
            </span>{" "}
            tasks
          </p>

          <div className="space-y-2">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskAccordionRow
                  key={task.id}
                  task={task}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onView={handleView}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                <svg
                  className="w-10 h-10 mb-3 opacity-40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-sm">No tasks found</p>
                <p className="text-xs mt-1">Try adjusting your filters</p>
              </div>
            )}
          </div>

          <TablePagination
            totalItems={pagination.total}
            currentPage={page}
            totalPages={pagination.totalPages}
            pageSize={limit}
            pageSizeOptions={[5, 10, 25, 50]}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setLimit(size);
              setPage(1);
            }}
          />
        </>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
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
        onOpenFullPage={() => viewingTask && navigate(`/tasks/${viewingTask.id}`)}
      />

      <DeleteModal
        showDeleteModal={showDeleteModal}
        deletingTask={deletingTask}
        deleteAlert={deleteAlert}
        deletingInProgress={deletingInProgress}
        currentUserId={currentUser.id}
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