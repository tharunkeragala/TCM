import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaEdit,
  FaPlus,
  FaTrash,
  FaEye,
  FaLayerGroup,
  FaClipboardList,
  FaTasks,
  FaFileAlt,
  FaUsers,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
  FaDownload,
  FaBolt,
  FaPlay,
  FaCheckCircle,
  FaCalendarAlt,
  FaStickyNote,
} from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import API from "../../services/api";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import { usePermissions } from "../../hooks/usePermissions";
import DocumentUploader from "../../components/common/DocumentUploader";

// Reused as-is from Projects.tsx — same suite/test-case create/edit/delete
// UI the Projects page already uses.
import {
  DeleteModal as ConfirmDeleteModal,
  SuiteFormModal,
  TestCaseFormModal,
  TestCaseViewModal,
} from "./Projects";

// Reused as-is from the Tasks feature.
import CreateEditModal from "../Tasks/components/modals/CreateEditModal";
import TaskDeleteModal from "../Tasks/components/modals/DeleteModal";
import TaskViewModal from "../Tasks/components/modals/ViewModal";
import type {
  Task,
  TaskFormData,
  AlertState,
  User,
  Project as ProjectType,
  TestSuite,
} from "../Tasks/types";

// Reused as-is from the Sprints feature — requires `export` added to both
// in Sprints.tsx (see note).
import { SprintFormModal, DeleteSprintModal } from "../TestManagement/Sprints";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Project {
  id: number;
  project_name: string;
  description: string;
  is_active: boolean;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface Suite {
  id: number;
  project_id: number;
  suite_name: string;
  description: string;
  is_active: boolean;
  case_count: number;
}

interface TestCase {
  id: number;
  suite_id: number;
  title: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Draft" | "Ready" | "Deprecated";
  suite_name?: string;
  preconditions: string;
}

interface Sprint {
  id: number;
  project_id: number;
  sprint_name: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status: "Planned" | "Active" | "Completed";
  suite_count?: number;
  case_count?: number;
}

interface Assignee {
  id: number;
  username: string;
}

interface OverviewData {
  project: Project;
  suites: Suite[];
  tasks: Task[];
  sprints: Sprint[];
  assignees: Assignee[];
  stats: {
    suite_count: number;
    test_case_count: number;
    task_count: number;
    document_count: number;
    sprint_count: number;
  };
}

interface ProjectDoc {
  id: number;
  original_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by_name?: string;
  created_at: string;
}

interface ProjectNote {
  id: number;
  project_id: number;
  note_text: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
}

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  High: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

// Single semantic scheme reused across every status badge on this page —
// gray = not started / retired, blue = in progress, amber = paused / needs
// attention, green = done / good, red = cancelled / stopped. Keeps Suites,
// Test Cases, Sprints and Tasks reading the same way at a glance.
const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Ready: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Deprecated: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  Pending: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  "In Progress":
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Completed:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "On Hold":
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  Planned: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  Active: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

// Active/Inactive toggle badges (Suites, Project) — kept separate since
// these are binary on/off states, not workflow stages.
const ACTIVE_COLORS: Record<string, string> = {
  true: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  false: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

// Segment colors for the dashboard breakdown bars — flat bg classes that
// mirror STATUS_COLORS exactly so the legend dots match the badges below.
const CASE_SEGMENT_COLORS: Record<string, string> = {
  Draft: "bg-amber-400",
  Ready: "bg-green-500",
  Deprecated: "bg-gray-400",
};
const TASK_SEGMENT_COLORS: Record<string, string> = {
  Pending: "bg-gray-400",
  "In Progress": "bg-blue-500",
  Completed: "bg-green-500",
  "On Hold": "bg-amber-400",
  Cancelled: "bg-red-500",
};
const SPRINT_SEGMENT_COLORS: Record<string, string> = {
  Planned: "bg-gray-400",
  Active: "bg-blue-500",
  Completed: "bg-green-500",
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function fileIcon(mime: string) {
  if (mime?.includes("pdf")) return <FaFilePdf className="text-red-500" />;
  if (mime?.includes("word")) return <FaFileWord className="text-blue-500" />;
  if (mime?.includes("sheet") || mime?.includes("excel"))
    return <FaFileExcel className="text-green-600" />;
  if (mime?.startsWith("image/"))
    return <FaFileImage className="text-purple-500" />;
  if (mime?.includes("zip"))
    return <FaFileArchive className="text-amber-500" />;
  return <FaFileAlt className="text-gray-400" />;
}

const sprintStatusIcon = (status: string) =>
  status === "Active"
    ? FaPlay
    : status === "Completed"
      ? FaCheckCircle
      : FaCalendarAlt;

const emptyTaskForm = (projectId: string): TaskFormData =>
  ({
    title: "",
    description: "",
    priority: "Medium",
    start_date: "",
    due_date: "",
    project_id: projectId,
    suite_id: "",
    tags: "",
  }) as TaskFormData;

// ─── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
      <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-lg font-semibold text-gray-900 dark:text-white leading-none">
          {value}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

// ─── Status breakdown card (segmented bar + legend) ────────────────────────
function StatusBreakdownCard({
  title,
  icon,
  segments,
  colors,
}: {
  title: string;
  icon: React.ReactNode;
  segments: { label: string; count: number }[];
  colors: Record<string, string>;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {title}
        </span>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {total} total
        </span>
      </div>
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        {total === 0 ? (
          <div className="w-full h-full" />
        ) : (
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.label}
                style={{ width: `${(s.count / total) * 100}%` }}
                className={colors[s.label] || "bg-gray-300"}
              />
            ))
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {segments.map((s) => (
          <span
            key={s.label}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
          >
            <span
              className={`w-2 h-2 rounded-full ${colors[s.label] || "bg-gray-300"}`}
            />
            {s.label}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {s.count}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Section shell (used for every list block in the main column) ─────────
function Section({
  title,
  icon,
  action,
  emptyText,
  isEmpty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  emptyText: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          {icon} {title}
        </h2>
        {action}
      </div>
      {isEmpty ? (
        <p className="text-sm text-gray-400 italic py-6 text-center">
          {emptyText}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

// ─── Scroll fade wrapper ────────────────────────────────────────────────────
// Uses the application-wide scrollbar rules from global CSS. The wrapper
// only controls scrolling and edge fades; it does not override scrollbar
// colors, widths, tracks, or hover styles locally.
function ScrollFade({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    setCanScrollUp(el.scrollTop > 2);
    setCanScrollDown(remaining > 2);
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return;

    updateFade();

    const resizeObserver = new ResizeObserver(updateFade);
    resizeObserver.observe(scrollEl);
    resizeObserver.observe(contentEl);

    const mutationObserver = new MutationObserver(updateFade);
    mutationObserver.observe(contentEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("resize", updateFade);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateFade);
    };
  }, [updateFade]);

  return (
    <div className="relative isolate min-w-0">
      <div
        ref={scrollRef}
        onScroll={updateFade}
        style={{ scrollbarGutter: "stable" }}
        className={`overscroll-contain rounded-none ${className}`}
      >
        <div ref={contentRef} className="min-w-0">
          {children}
        </div>
      </div>

      {canScrollUp && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-[7px] top-0 z-10 h-4 rounded-none bg-gradient-to-b from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80"
        />
      )}

      {canScrollDown && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 right-[7px] z-10 h-4 rounded-none bg-gradient-to-t from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80"
        />
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function ProjectOverview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const canProjects = (
    a: "can_view" | "can_create" | "can_edit" | "can_delete",
  ) => can("/projects", a);
  const canSuites = (
    a: "can_view" | "can_create" | "can_edit" | "can_delete",
  ) => can("/test-suites", a);
  const canCases = (a: "can_view" | "can_create" | "can_edit" | "can_delete") =>
    can("/test-cases", a);
  const canTasks = (a: "can_view" | "can_create" | "can_edit" | "can_delete") =>
    can("/tasks", a);
  const canSprints = (
    a: "can_view" | "can_create" | "can_edit" | "can_delete",
  ) => can("/sprints", a);

  // Only the four list sections are tabbed now — stats, breakdown bars,
  // assignees, documents, and notes stay always-visible as they were.
  const [mainTab, setMainTab] = useState<
    "suites" | "cases" | "sprints" | "tasks"
  >("tasks");

  // ── Overview data ──────────────────────────────────────────────────────────
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get(`/api/projects/${id}/overview`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) setOverview(res.data.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to load project overview.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // ── Test cases (global fetch, filtered to this project's suites) ───────────
  const { data: allTestCases, refetch: refetchCases } =
    useFetchWithAuth<TestCase[]>("/api/test-cases");
  const projectSuiteIds = useMemo(
    () => new Set((overview?.suites ?? []).map((s) => s.id)),
    [overview],
  );
  const projectTestCases = useMemo(
    () => (allTestCases ?? []).filter((tc) => projectSuiteIds.has(tc.suite_id)),
    [allTestCases, projectSuiteIds],
  );

  // ── Users (for task assignees) ─────────────────────────────────────────────
  const { data: users } = useFetchWithAuth<User[]>("/api/users");

  // ── Documents (loaded eagerly now — right-rail panel, not a tab) ───────────
  const [docs, setDocs] = useState<ProjectDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await API.get(`/api/projects/${id}/documents`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) setDocs(res.data.data);
    } finally {
      setLoadingDocs(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleDownloadDoc = async (doc: ProjectDoc) => {
    const res = await API.get(`/api/projects/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.original_name;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDeleteDoc = async (doc: ProjectDoc) => {
    setDeletingDocId(doc.id);
    try {
      await API.delete(`/api/projects/documents/${doc.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      fetchOverview();
    } finally {
      setDeletingDocId(null);
    }
  };

  // ── Notes (loaded eagerly — right-rail panel, same pattern as Documents) ───
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const res = await API.get(`/api/projects/${id}/notes`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) setNotes(res.data.data);
    } finally {
      setLoadingNotes(false);
    }
  }, [id]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAddNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    setAddingNote(true);
    try {
      const res = await API.post(
        `/api/projects/${id}/notes`,
        { note_text: text },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (res.data.success) {
        setNotes((prev) => [res.data.data, ...prev]);
        setNewNote("");
      }
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (note: ProjectNote) => {
    setDeletingNoteId(note.id);
    try {
      await API.delete(`/api/projects/notes/${note.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
    } finally {
      setDeletingNoteId(null);
    }
  };

  // ── Suite modals ────────────────────────────────────────────────────────────
  const [addSuiteModal, setAddSuiteModal] = useState(false);
  const [editSuite, setEditSuite] = useState<Suite | null>(null);
  const [deleteSuite, setDeleteSuite] = useState<Suite | null>(null);
  const [deleteSuiteAlert, setDeleteSuiteAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deletingSuiteInProgress, setDeletingSuiteInProgress] = useState(false);
  const [suiteCaseCount, setSuiteCaseCount] = useState(0);

  const openDeleteSuite = async (suite: Suite) => {
    setDeleteSuiteAlert(null);
    try {
      const res = await API.get(`/api/test-suites/${suite.id}/case-count`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setSuiteCaseCount(res.data.success ? (res.data.count ?? 0) : 0);
    } catch {
      setSuiteCaseCount(0);
    }
    setDeleteSuite(suite);
  };

  const confirmDeleteSuite = async () => {
    if (!deleteSuite) return;
    setDeletingSuiteInProgress(true);
    setDeleteSuiteAlert(null);
    try {
      await API.delete(`/api/test-suites/delete/${deleteSuite.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteSuiteAlert({ type: "success", message: "Suite deleted." });
      setTimeout(() => {
        setDeleteSuite(null);
        fetchOverview();
      }, 900);
    } catch (err: any) {
      setDeleteSuiteAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete suite.",
      });
    } finally {
      setDeletingSuiteInProgress(false);
    }
  };

  // ── Test case modals ────────────────────────────────────────────────────────
  const [addCaseSuiteId, setAddCaseSuiteId] = useState<number | null>(null);
  const [addCaseModal, setAddCaseModal] = useState(false); // top-level "Add Test Case" (no suite preselected)
  const [editCase, setEditCase] = useState<TestCase | null>(null);
  const [deleteCase, setDeleteCase] = useState<TestCase | null>(null);
  const [deleteCaseAlert, setDeleteCaseAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deletingCaseInProgress, setDeletingCaseInProgress] = useState(false);
  const [viewingCase, setViewingCase] = useState<TestCase | null>(null);

  const openViewCase = async (tc: TestCase) => {
    try {
      const res = await API.get(`/api/test-cases/${tc.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setViewingCase(res.data.success ? res.data.data : tc);
    } catch {
      setViewingCase(tc);
    }
  };

  const openEditCase = async (tc: TestCase) => {
    try {
      const res = await API.get(`/api/test-cases/${tc.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setEditCase(res.data.success ? res.data.data : tc);
    } catch {
      setEditCase(tc);
    }
  };

  const confirmDeleteCase = async () => {
    if (!deleteCase) return;
    setDeletingCaseInProgress(true);
    setDeleteCaseAlert(null);
    try {
      await API.delete(`/api/test-cases/delete/${deleteCase.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteCaseAlert({ type: "success", message: "Test case deleted." });
      setTimeout(() => {
        setDeleteCase(null);
        refetchCases?.();
        fetchOverview();
      }, 900);
    } catch (err: any) {
      setDeleteCaseAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete test case.",
      });
    } finally {
      setDeletingCaseInProgress(false);
    }
  };

  // ── Sprint modals ───────────────────────────────────────────────────────────
  const [addSprintModal, setAddSprintModal] = useState(false);
  const [editSprint, setEditSprint] = useState<Sprint | null>(null);
  const [deleteSprint, setDeleteSprint] = useState<Sprint | null>(null);

  // ── Task modals (reusing the existing Tasks CreateEditModal/DeleteModal/ViewModal) ─
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFormData, setTaskFormData] = useState<TaskFormData>(
    emptyTaskForm(id!),
  );
  const [taskAssignees, setTaskAssignees] = useState<number[]>([]);
  const [taskFormAlert, setTaskFormAlert] = useState<AlertState | null>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [deleteTaskAlert, setDeleteTaskAlert] = useState<AlertState | null>(
    null,
  );
  const [deletingTaskInProgress, setDeletingTaskInProgress] = useState(false);

  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const currentUserId = (() => {
    try {
      const stored =
        localStorage.getItem("user") || sessionStorage.getItem("user");
      return stored ? JSON.parse(stored).id : 0;
    } catch {
      return 0;
    }
  })();

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskFormData(emptyTaskForm(id!));
    setTaskAssignees([]);
    setTaskFormAlert(null);
    setShowTaskModal(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskFormData({
      title: task.title,
      description: (task as any).description || "",
      priority: task.priority,
      start_date: (task as any).start_date || "",
      due_date: (task as any).due_date || "",
      project_id: String((task as any).project_id ?? id),
      suite_id: String((task as any).suite_id ?? ""),
      tags: (task as any).tags || "",
    } as TaskFormData);
    setTaskAssignees([]); // populated below once full detail loads
    setTaskFormAlert(null);
    (async () => {
      try {
        const res = await API.get(`/api/tasks/${task.id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.data.success) {
          const assigneeIds = (res.data.data.assignments || [])
            .filter((a: any) => a.role === "Assignee")
            .map((a: any) => a.user_id);
          setTaskAssignees(assigneeIds);
        }
      } catch {
        /* non-fatal — modal still usable without prefilled assignees */
      }
    })();
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskFormData.title?.trim()) {
      setTaskFormAlert({ type: "error", message: "Title is required." });
      return;
    }
    setTaskSubmitting(true);
    setTaskFormAlert(null);
    try {
      const payload = { ...taskFormData, assignees: taskAssignees };
      const res = editingTask
        ? await API.put(`/api/tasks/update/${editingTask.id}`, payload, {
            headers: { Authorization: `Bearer ${getToken()}` },
          })
        : await API.post("/api/tasks/create", payload, {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
      if (res.data.success) {
        setTaskFormAlert({
          type: "success",
          message: editingTask ? "Task updated!" : "Task created!",
        });
        setTimeout(() => {
          setShowTaskModal(false);
          fetchOverview();
        }, 800);
      }
    } catch (err: any) {
      setTaskFormAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to save task.",
      });
    } finally {
      setTaskSubmitting(false);
    }
  };

  const confirmDeleteTask = async () => {
    if (!deletingTask) return;
    setDeletingTaskInProgress(true);
    setDeleteTaskAlert(null);
    try {
      await API.delete(`/api/tasks/delete/${deletingTask.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteTaskAlert({ type: "success", message: "Task deleted." });
      setTimeout(() => {
        setDeletingTask(null);
        fetchOverview();
      }, 800);
    } catch (err: any) {
      setDeleteTaskAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete task.",
      });
    } finally {
      setDeletingTaskInProgress(false);
    }
  };

  const openViewTask = async (task: Task) => {
    setShowViewModal(true);
    setViewLoading(true);
    try {
      const res = await API.get(`/api/tasks/${task.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setViewingTask(res.data.success ? res.data.data : task);
    } catch {
      setViewingTask(task);
    } finally {
      setViewLoading(false);
    }
  };

  // ── Loading / error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="py-16 text-center text-gray-500 dark:text-gray-400">
        Loading project overview...
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="mt-4">
        <Alert
          variant="error"
          title="Error"
          message={error || "Project not found."}
        />
      </div>
    );
  }

  const { project, suites, tasks, sprints, assignees, stats } = overview;

  // ── Status breakdown datasets ───────────────────────────────────────────────
  const caseStatusSegments = ["Draft", "Ready", "Deprecated"].map((label) => ({
    label,
    count: projectTestCases.filter((tc) => tc.status === label).length,
  }));

  const taskStatusLabels = [
    "Pending",
    "In Progress",
    "Completed",
    "On Hold",
    "Cancelled",
  ];
  const taskStatusSegments = taskStatusLabels.map((label) => ({
    label,
    count: (tasks as any[]).filter((t) => t.status === label).length,
  }));

  const sprintStatusSegments = ["Planned", "Active", "Completed"].map(
    (label) => ({
      label,
      count: sprints.filter((s) => s.status === label).length,
    }),
  );

  return (
    <div>
      <PageMeta title={project.project_name} description="Project overview" />
      <PageBreadcrumb pageTitle="Project Overview" />

      {/* Header */}
      <div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mb-3"
        >
          <FaArrowLeft className="w-3 h-3" /> Back to Projects
        </button>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)] gap-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-900/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                    {project.project_name}
                  </h1>
                  <span
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full ${ACTIVE_COLORS[String(project.is_active)]}`}
                  >
                    {project.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Project Description
                  </p>

                  <ScrollFade className="mt-1 max-h-24 overflow-y-auto pr-2 py-1">
                    <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {project.description ||
                        "No description has been added for this project."}
                    </p>
                  </ScrollFade>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-gray-400 dark:text-gray-500">
                  <span>
                    Created by {project.created_by_name || "—"}
                    {project.created_at
                      ? ` · ${new Date(project.created_at).toLocaleDateString()}`
                      : ""}
                  </span>
                  {project.updated_at && (
                    <span>
                      Updated by {project.updated_by_name || "—"} ·{" "}
                      {new Date(project.updated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {canProjects("can_edit") && (
                <button
                  onClick={() => navigate("/projects")}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-xl transition-colors flex-shrink-0"
                  title="Edit from the Projects list"
                >
                  <FaEdit className="w-3.5 h-3.5" /> Edit
                </button>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
                <FaUsers className="w-3.5 h-3.5" /> Project Assignees (
                {assignees.length})
              </p>
              {assignees.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No assignees are linked to project tasks yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignees.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold">
                        {a.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                        {a.username}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <FaStickyNote className="w-3.5 h-3.5" /> Notes
              </p>

              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {notes.length}
              </span>
            </div>

            {/* Add Note */}
            <div className="flex gap-2">
              <div className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 overflow-hidden">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                  placeholder="Add a project note…"
                  rows={1}
                  className="w-full min-h-[42px] max-h-48 resize-y overflow-y-auto border-0 bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-0"
                />
              </div>

              <button
                onClick={handleAddNote}
                disabled={addingNote || !newNote.trim()}
                className="h-[42px] px-4 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl flex items-center justify-center"
              >
                {addingNote ? "Adding…" : "Add"}
              </button>
            </div>

            {/* Scrollable Notes */}
            <ScrollFade className="mt-4 max-h-60 overflow-y-auto pr-1 py-1">
              {loadingNotes ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Loading notes…
                </p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 italic">
                  No notes yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 px-3 py-2"
                    >
                      <FaStickyNote className="text-amber-400 mt-1 flex-shrink-0" />

                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                          {note.note_text}
                        </p>

                        <p className="text-[11px] text-gray-400 mt-1">
                          {note.created_by_name || "Unknown"} ·{" "}
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteNote(note)}
                        disabled={deletingNoteId === note.id}
                        className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 disabled:opacity-50 flex-shrink-0"
                        title="Delete"
                      >
                        <FaTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollFade>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mt-5">
          <StatTile
            label="Tasks"
            value={stats.task_count}
            icon={<FaTasks className="w-4 h-4" />}
          />

          <StatTile
            label="Suites"
            value={stats.suite_count}
            icon={<FaLayerGroup className="w-4 h-4" />}
          />

          <StatTile
            label="Test Cases"
            value={stats.test_case_count}
            icon={<FaClipboardList className="w-4 h-4" />}
          />

          <StatTile
            label="Sprints"
            value={stats.sprint_count}
            icon={<FaBolt className="w-4 h-4" />}
          />

          <StatTile
            label="Documents"
            value={stats.document_count}
            icon={<FaFileAlt className="w-4 h-4" />}
          />
        </div>

        {/* Status breakdown row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <StatusBreakdownCard
            title="Test Case Status"
            icon={<FaClipboardList className="w-3.5 h-3.5" />}
            segments={caseStatusSegments}
            colors={CASE_SEGMENT_COLORS}
          />
          <StatusBreakdownCard
            title="Sprint Status"
            icon={<FaBolt className="w-3.5 h-3.5" />}
            segments={sprintStatusSegments}
            colors={SPRINT_SEGMENT_COLORS}
          />
          <StatusBreakdownCard
            title="Task Status"
            icon={<FaTasks className="w-3.5 h-3.5" />}
            segments={taskStatusSegments}
            colors={TASK_SEGMENT_COLORS}
          />
        </div>
      </div>

      {/* Body — two column, everything on one page */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab bar for the four list sections */}
          <div className="flex gap-1 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 pt-2 overflow-x-auto">
            {[
              {
                key: "tasks" as const,
                label: `Tasks (${stats.task_count})`,
                icon: <FaTasks className="w-3.5 h-3.5" />,
              },
              {
                key: "suites" as const,
                label: `Suites (${stats.suite_count})`,
                icon: <FaLayerGroup className="w-3.5 h-3.5" />,
              },
              {
                key: "cases" as const,
                label: `Test Cases (${stats.test_case_count})`,
                icon: <FaClipboardList className="w-3.5 h-3.5" />,
              },
              {
                key: "sprints" as const,
                label: `Sprints (${stats.sprint_count})`,
                icon: <FaBolt className="w-3.5 h-3.5" />,
              },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setMainTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  mainTab === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Suites */}
          {mainTab === "suites" && (
            <Section
              title={`Test Suites (${stats.suite_count})`}
              icon={<FaLayerGroup className="w-3.5 h-3.5 text-purple-500" />}
              isEmpty={suites.length === 0}
              emptyText="No suites yet."
              action={
                canSuites("can_create") && (
                  <button
                    onClick={() => setAddSuiteModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    <FaPlus className="w-3 h-3" /> Add Suite
                  </button>
                )
              }
            >
              <ScrollFade className="max-h-[325px] overflow-y-auto pr-1 py-1">
                <div className="space-y-2">
                  {suites.map((suite) => (
                    <div
                      key={suite.id}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FaLayerGroup className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {suite.suite_name}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {suite.case_count}{" "}
                          {suite.case_count === 1 ? "case" : "cases"}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${ACTIVE_COLORS[String(suite.is_active)]}`}
                        >
                          {suite.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {canCases("can_create") && (
                          <button
                            onClick={() => setAddCaseSuiteId(suite.id)}
                            className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600"
                            title="Add Test Case"
                          >
                            <FaPlus className="w-3 h-3" />
                          </button>
                        )}
                        {canSuites("can_edit") && (
                          <button
                            onClick={() => setEditSuite(suite)}
                            className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600"
                            title="Edit Suite"
                          >
                            <FaEdit className="w-3 h-3" />
                          </button>
                        )}
                        {canSuites("can_delete") && (
                          <button
                            onClick={() => openDeleteSuite(suite)}
                            className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                            title="Delete Suite"
                          >
                            <FaTrash className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollFade>
            </Section>
          )}

          {/* Test Cases */}
          {mainTab === "cases" && (
            <Section
              title={`Test Cases (${stats.test_case_count})`}
              icon={<FaClipboardList className="w-3.5 h-3.5 text-indigo-500" />}
              isEmpty={projectTestCases.length === 0}
              emptyText="No test cases yet."
              action={
                canCases("can_create") &&
                suites.length > 0 && (
                  <button
                    onClick={() => setAddCaseModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    <FaPlus className="w-3 h-3" /> Add Test Case
                  </button>
                )
              }
            >
              <ScrollFade className="max-h-[325px] overflow-y-auto pr-1 py-1">
                <div className="space-y-2">
                  {projectTestCases.map((tc) => (
                    <div
                      key={tc.id}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FaClipboardList className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {tc.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${PRIORITY_COLORS[tc.priority]}`}
                        >
                          {tc.priority}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${STATUS_COLORS[tc.status]}`}
                        >
                          {tc.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => openViewCase(tc)}
                          className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                          title="View"
                        >
                          <FaEye className="w-3 h-3" />
                        </button>
                        {canCases("can_edit") && (
                          <button
                            onClick={() => openEditCase(tc)}
                            className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600"
                            title="Edit"
                          >
                            <FaEdit className="w-3 h-3" />
                          </button>
                        )}
                        {canCases("can_delete") && (
                          <button
                            onClick={() => setDeleteCase(tc)}
                            className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                            title="Delete"
                          >
                            <FaTrash className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollFade>
            </Section>
          )}

          {/* Sprints */}
          {mainTab === "sprints" && (
            <Section
              title={`Sprints (${stats.sprint_count})`}
              icon={<FaBolt className="w-3.5 h-3.5 text-blue-500" />}
              isEmpty={sprints.length === 0}
              emptyText="No sprints for this project yet."
              action={
                canSprints("can_create") && (
                  <button
                    onClick={() => setAddSprintModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    <FaPlus className="w-3 h-3" /> Add Sprint
                  </button>
                )
              }
            >
              <ScrollFade className="max-h-[325px] overflow-y-auto pr-1 py-1">
                <div className="space-y-2">
                  {sprints.map((sprint) => {
                    const StatusIcon = sprintStatusIcon(sprint.status);
                    return (
                      <div
                        key={sprint.id}
                        onClick={() => navigate(`/sprints/${sprint.id}`)}
                        className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <StatusIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {sprint.sprint_name}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {sprint.suite_count ?? 0} suites ·{" "}
                            {sprint.case_count ?? 0} cases
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${STATUS_COLORS[sprint.status]}`}
                          >
                            {sprint.status}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-2 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canSprints("can_edit") && (
                            <button
                              onClick={() => setEditSprint(sprint)}
                              className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600"
                              title="Edit Sprint"
                            >
                              <FaEdit className="w-3 h-3" />
                            </button>
                          )}
                          {canSprints("can_delete") && (
                            <button
                              onClick={() => setDeleteSprint(sprint)}
                              className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                              title="Delete Sprint"
                            >
                              <FaTrash className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollFade>
            </Section>
          )}

          {/* Tasks */}
          {mainTab === "tasks" && (
            <Section
              title={`Tasks (${stats.task_count})`}
              icon={<FaTasks className="w-3.5 h-3.5 text-emerald-500" />}
              isEmpty={tasks.length === 0}
              emptyText="No tasks linked to this project yet."
              action={
                canTasks("can_create") && (
                  <button
                    onClick={openCreateTask}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    <FaPlus className="w-3 h-3" /> Add Task
                  </button>
                )
              }
            >
              <ScrollFade className="max-h-[325px] overflow-y-auto pr-1 py-1">
                <div className="space-y-2">
                  {(tasks as any[]).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-mono text-[10px] flex-shrink-0">
                          {task.task_code}
                        </span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {task.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${PRIORITY_COLORS[task.priority]}`}
                        >
                          {task.priority}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${STATUS_COLORS[task.status] || ""}`}
                        >
                          {task.status}
                        </span>
                        {task.assignees && (
                          <span className="text-xs text-gray-400 flex-shrink-0 truncate max-w-[160px]">
                            {task.assignees}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => openViewTask(task)}
                          className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                          title="View"
                        >
                          <FaEye className="w-3 h-3" />
                        </button>
                        {canTasks("can_edit") && (
                          <button
                            onClick={() => openEditTask(task)}
                            className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600"
                            title="Edit"
                          >
                            <FaEdit className="w-3 h-3" />
                          </button>
                        )}
                        {canTasks("can_delete") && (
                          <button
                            onClick={() => setDeletingTask(task)}
                            className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                            title="Delete"
                          >
                            <FaTrash className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollFade>
            </Section>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* Documents */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
              <FaFileAlt className="w-3.5 h-3.5" /> Documents (
              {stats.document_count})
            </p>

            {/* Scrollable document list */}
            <ScrollFade className="mt-4 max-h-60 overflow-y-auto pr-1 py-1">
              {loadingDocs ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Loading documents…
                </p>
              ) : docs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 italic">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                    >
                      <span className="text-lg flex-shrink-0">
                        {fileIcon(doc.mime_type)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                          {doc.original_name}
                        </p>

                        <p className="text-[11px] text-gray-400">
                          {formatBytes(doc.file_size)} ·{" "}
                          {doc.uploaded_by_name || "Unknown"} ·{" "}
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDownloadDoc(doc)}
                        className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 flex-shrink-0"
                        title="Download"
                      >
                        <FaDownload className="w-3.5 h-3.5" />
                      </button>

                      {canProjects("can_delete") && (
                        <button
                          onClick={() => handleDeleteDoc(doc)}
                          disabled={deletingDocId === doc.id}
                          className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 disabled:opacity-50 flex-shrink-0"
                          title="Archive"
                        >
                          <FaTrash className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollFade>

            {/* Upload stays outside scroll */}
            {canProjects("can_edit") && (
              <div className="mt-3">
                <DocumentUploader
                  projectId={project.id}
                  onUploaded={() => {
                    fetchDocs();
                    fetchOverview();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Suite modals ── */}
      {(addSuiteModal || editSuite) && (
        <SuiteFormModal
          editing={editSuite}
          projects={[project as any]}
          defaultProjectId={project.id}
          onClose={() => {
            setAddSuiteModal(false);
            setEditSuite(null);
          }}
          onSaved={fetchOverview}
        />
      )}

      {deleteSuite && (
        <ConfirmDeleteModal
          title="Delete Suite"
          name={deleteSuite.suite_name}
          warning={
            suiteCaseCount > 0
              ? `${suiteCaseCount} test case(s) linked. Remove them first.`
              : undefined
          }
          alert={deleteSuiteAlert}
          inProgress={deletingSuiteInProgress}
          disabled={suiteCaseCount > 0}
          onConfirm={confirmDeleteSuite}
          onClose={() => setDeleteSuite(null)}
        />
      )}

      {/* ── Test case modals ── */}
      {(addCaseSuiteId !== null || addCaseModal || editCase) && (
        <TestCaseFormModal
          editing={editCase}
          suites={suites as any}
          defaultSuiteId={addCaseSuiteId ?? undefined}
          onClose={() => {
            setAddCaseSuiteId(null);
            setAddCaseModal(false);
            setEditCase(null);
          }}
          onSaved={() => {
            refetchCases?.();
            fetchOverview();
          }}
        />
      )}

      {deleteCase && (
        <ConfirmDeleteModal
          title="Delete Test Case"
          name={deleteCase.title}
          warning="All steps will also be permanently removed."
          alert={deleteCaseAlert}
          inProgress={deletingCaseInProgress}
          onConfirm={confirmDeleteCase}
          onClose={() => {
            setDeleteCase(null);
            setDeleteCaseAlert(null);
          }}
        />
      )}

      {viewingCase && (
        <TestCaseViewModal
          tc={viewingCase as any}
          onClose={() => setViewingCase(null)}
        />
      )}

      {/* ── Sprint modals (reused from the Sprints feature) ── */}
      {(addSprintModal || editSprint) && (
        <SprintFormModal
          editing={editSprint}
          projects={[project as any]}
          defaultProjectId={project.id}
          onClose={() => {
            setAddSprintModal(false);
            setEditSprint(null);
          }}
          onSaved={fetchOverview}
        />
      )}

      {deleteSprint && (
        <DeleteSprintModal
          sprint={deleteSprint as any}
          onClose={() => setDeleteSprint(null)}
          onDeleted={fetchOverview}
        />
      )}

      {/* ── Task modals (reused from the Tasks feature) ── */}
      <CreateEditModal
        showModal={showTaskModal}
        editingTask={editingTask}
        formData={taskFormData}
        setFormData={setTaskFormData}
        assignees={taskAssignees}
        setAssignees={setTaskAssignees}
        selectedProjectFilter={String(project.id)}
        setSelectedProjectFilter={() => {
          /* locked to this project on the overview page */
        }}
        formAlert={taskFormAlert}
        submitting={taskSubmitting}
        projects={[project as unknown as ProjectType]}
        allSuites={suites as unknown as TestSuite[]}
        users={users}
        onClose={() => setShowTaskModal(false)}
        onSave={handleSaveTask}
        lockProject
      />

      <TaskDeleteModal
        showDeleteModal={!!deletingTask}
        deletingTask={deletingTask}
        deleteAlert={deleteTaskAlert}
        deletingInProgress={deletingTaskInProgress}
        currentUserId={currentUserId}
        onClose={() => {
          setDeletingTask(null);
          setDeleteTaskAlert(null);
        }}
        onConfirm={confirmDeleteTask}
      />

      <TaskViewModal
        showViewModal={showViewModal}
        viewingTask={viewingTask}
        viewLoading={viewLoading}
        users={users || []}
        onClose={() => setShowViewModal(false)}
        onProgressAdded={() => openViewTask(viewingTask!)}
        onCommentAdded={() => openViewTask(viewingTask!)}
        onReminderSaved={() => {}}
        onStatusChanged={() => {
          openViewTask(viewingTask!);
          fetchOverview();
        }}
        onETAChanged={() => openViewTask(viewingTask!)}
        onOpenFullPage={() => navigate(`/tasks/${viewingTask?.id}`)}
      />
    </div>
  );
}
