import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
  FaExclamationCircle,
  FaArrowLeft,
  FaBell,
  FaTimes,
  FaEdit,
  FaTrash,
} from "react-icons/fa";

import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";

import API from "../../services/api";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";

import { Task, TaskFormData, AlertState, User, Project, TestSuite } from "./types";
import { isOverdue } from "./utils";
import TagList from "./components/TagList";
import ReminderBadge from "./components/badges/ReminderBadge";
import StatusChangeBadge from "./components/badges/StatusChangeBadge";
import ExtendETABadge from "./components/badges/ExtendETABadge";
import TaskDetailView from "./components/TaskDetailView";
import CreateEditModal from "./components/modals/CreateEditModal";
import DeleteModal from "./components/modals/DeleteModal";

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

export default function TaskDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: users } = useFetchWithAuth<User[]>("/api/dropdown/users");
  const { data: projects } = useFetchWithAuth<Project[]>("/api/projects");
  const { data: allSuites } = useFetchWithAuth<TestSuite[]>("/api/test-suites");
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formAlert, setFormAlert] = useState<AlertState | null>(null);
  const [formData, setFormData] = useState<TaskFormData>(DEFAULT_FORM);
  const [assignees, setAssignees] = useState<number[]>([]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("");

  // ── Delete modal ───────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAlert, setDeleteAlert] = useState<AlertState | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const getToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTask = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError("");
      const res = await API.get(`/api/tasks/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) {
        setTask(res.data.data);
      } else {
        setError("Task not found.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load task.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const overdue = task && isOverdue(task.due_date, task.status);

  // ── Form helpers ─────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setAssignees([]);
    setSelectedProjectFilter("");
    setFormAlert(null);
  };

  const closeEditModal = () => {
    setShowModal(false);
    resetForm();
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleEditClick = () => {
    if (!task) return;

    const suite = allSuites?.find((s) => s.id === task.suite_id);
    setSelectedProjectFilter(
      suite
        ? String(suite.project_id)
        : task.project_id
          ? String(task.project_id)
          : "",
    );

    setFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      start_date: task.start_date ? task.start_date.substring(0, 10) : "",
      due_date: task.due_date ? task.due_date.substring(0, 10) : "",
      project_id: task.project_id ? String(task.project_id) : "",
      suite_id: task.suite_id ? String(task.suite_id) : "",
      tags: task.tags || "",
    });

    setAssignees(
      (task.assignments || [])
        .filter((a) => a.role === "Assignee")
        .map((a) => a.user_id),
    );

    setShowModal(true);
  };

  const handleSave = async () => {
    if (!task) return;

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
        watchers: (task.assignments || [])
          .filter((a) => a.role === "Watcher")
          .map((a) => a.user_id),
      };

      const res = await API.put(`/api/tasks/update/${task.id}`, payload, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (res.data.success) {
        setFormAlert({ type: "success", message: "Task updated!" });
        setTimeout(async () => {
          closeEditModal();
          await fetchTask();
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

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteClick = () => {
    setDeleteAlert(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!task) return;
    setDeletingInProgress(true);
    setDeleteAlert(null);
    try {
      await API.delete(`/api/tasks/delete/${task.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteAlert({ type: "success", message: "Task deleted successfully." });
      setTimeout(() => {
        navigate("/tasks");
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

  return (
    <div className="space-y-5">
      <PageMeta
        title={task ? `${task.task_code} · ${task.title}` : "Task Details"}
        description="Task Details"
      />
      <PageBreadcrumb pageTitle={task ? String(task.task_code) : "Task Details"} />

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-xl px-4 py-3 min-w-[280px] max-w-sm animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <FaBell className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
              Notice
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {toast}
            </p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          >
            <FaTimes className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Back ───────────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate("/tasks")}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors duration-150"
      >
        <FaArrowLeft className="w-3 h-3" />
        Back to Tasks
      </button>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && <Alert variant="error" title="Error" message={error} />}

      {/* ── Loading skeleton ──────────────────────────────────────────────── */}
      {loading && !error && (
        <div className="space-y-3">
          <div className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
      )}

      {/* ── Task content ──────────────────────────────────────────────────── */}
      {!loading && !error && task && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Header */}
          <div
            className={`px-6 pt-5 pb-4 border-b transition-colors ${
              overdue
                ? "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-800/50"
                : "bg-brand-50 dark:bg-brand-500/5 border-brand-200 dark:border-brand-800/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 whitespace-nowrap">
                    {task.task_code}
                  </span>

                  {task.tags && <TagList tags={task.tags} />}

                  {overdue && (
                    <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                      <FaExclamationCircle className="w-3 h-3" />
                      Overdue
                    </span>
                  )}
                </div>

                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {task.title}
                </h1>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                <ReminderBadge taskId={task.id} onToast={showToast} />
                <StatusChangeBadge
                  task={task}
                  onToast={showToast}
                  onStatusChanged={fetchTask}
                />
                <ExtendETABadge
                  task={task}
                  onToast={showToast}
                  onETAChanged={fetchTask}
                />

                {/* ── Edit ── */}
                <button
                  onClick={handleEditClick}
                  title="Edit task"
                  className="w-7 h-7 flex items-center justify-center rounded-md
                             text-brand-500 hover:text-brand-700 dark:hover:text-brand-400
                             hover:bg-white/60 dark:hover:bg-gray-800
                             transition-colors duration-150"
                >
                  <FaEdit className="w-3.5 h-3.5" />
                </button>

                {/* ── Delete ── */}
                <button
                  onClick={handleDeleteClick}
                  title="Delete task"
                  className="w-7 h-7 flex items-center justify-center rounded-md
                             text-red-400 hover:text-red-600 dark:hover:text-red-400
                             hover:bg-white/60 dark:hover:bg-gray-800
                             transition-colors duration-150"
                >
                  <FaTrash className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <TaskDetailView
              task={task}
              users={users || []}
              onProgressAdded={fetchTask}
              onCommentAdded={fetchTask}
              onReminderSaved={showToast}
            />
          </div>
        </div>
      )}

      {/* ── Not found ──────────────────────────────────────────────────────── */}
      {!loading && !error && !task && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-sm">Task not found.</p>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <CreateEditModal
        showModal={showModal}
        editingTask={task}
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
        onClose={closeEditModal}
        onSave={handleSave}
      />

      <DeleteModal
        showDeleteModal={showDeleteModal}
        deletingTask={task}
        deleteAlert={deleteAlert}
        deletingInProgress={deletingInProgress}
        currentUserId={currentUser.id}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteAlert(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}