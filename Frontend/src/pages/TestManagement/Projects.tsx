import { useState, useCallback, useMemo } from "react";
import { Link } from "react-router";
import {
  FaEdit,
  FaTrash,
  FaChevronRight,
  FaChevronDown,
  FaFolder,
  FaFolderOpen,
  FaLayerGroup,
  FaClipboardList,
  FaEye,
  FaPlus,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";
import useFetchWithAuth from "../../hooks/useFetchWithAuth";
import API from "../../services/api";
import ProjectDetailModal from "./ProjectDetailModal";

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface TestSuite {
  id: number;
  project_id: number;
  suite_name: string;
  description: string;
  is_active: boolean;
  project_name?: string;
  created_by_name?: string;
  updated_by_name?: string;
}

interface TestStep {
  step_number: number;
  action: string;
  expected_result: string;
}

interface TestCase {
  id: number;
  suite_id: number;
  title: string;
  preconditions: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Draft" | "Ready" | "Deprecated";
  suite_name?: string;
  project_name?: string;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
  steps?: TestStep[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  Critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const STATUS_COLORS: Record<string, string> = {
  Draft:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  Ready: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Deprecated: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const emptyStep = (): TestStep => ({
  step_number: 1,
  action: "",
  expected_result: "",
});

const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

// ─── Reusable Toggle Switch ───────────────────────────────────────────────────
export function Toggle({
  value,
  onChange,
  size = "sm",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
}) {
  const h = size === "md" ? "h-6 w-11" : "h-5 w-9";
  const dot = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const on = size === "md" ? "translate-x-6" : "translate-x-5";
  const off = size === "md" ? "translate-x-1" : "translate-x-0.5";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!value);
      }}
      className={`relative inline-flex ${h} items-center rounded-full transition-colors duration-200 focus:outline-none ${
        value ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
      }`}
      title={
        value ? "Active — click to deactivate" : "Inactive — click to activate"
      }
    >
      <span
        className={`inline-block ${dot} transform rounded-full bg-white shadow transition-transform duration-200 ${
          value ? on : off
        }`}
      />
    </button>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
export function DeleteModal({
  title,
  name,
  warning,
  alert,
  inProgress,
  disabled,
  onConfirm,
  onClose,
}: {
  title: string;
  name: string;
  warning?: string;
  alert: { type: "success" | "error"; message: string } | null;
  inProgress: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
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
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                "{name}"
              </span>
              ? This cannot be undone.
            </p>
            {warning && (
              <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700">
                <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                  ⚠️ {warning}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={inProgress}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={inProgress || disabled}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition duration-150"
          >
            {inProgress ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── View Test Case Modal ─────────────────────────────────────────────────────
export function TestCaseViewModal({
  tc,
  onClose,
}: {
  tc: TestCase;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            View Test Case
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
          >
            &times;
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Title", value: tc.title },
              { label: "Suite", value: tc.suite_name || "—" },
              { label: "Project", value: tc.project_name || "—" },
              { label: "Created By", value: tc.created_by_name || "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  {label}
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {value}
                </p>
              </div>
            ))}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Priority
              </p>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${PRIORITY_COLORS[tc.priority]}`}
              >
                {tc.priority}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Status
              </p>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[tc.status]}`}
              >
                {tc.status}
              </span>
            </div>
          </div>
          {tc.preconditions && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Preconditions
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                {tc.preconditions}
              </p>
            </div>
          )}
          {tc.steps && tc.steps.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Test Steps
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left w-12">#</th>
                      <th className="px-4 py-2 text-left">Action</th>
                      <th className="px-4 py-2 text-left">Expected Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {tc.steps.map((step) => (
                      <tr key={step.step_number}>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                          {step.step_number}
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {step.action}
                        </td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                          {step.expected_result || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Last Updated By
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {tc.updated_by_name || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Last Updated At
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {tc.updated_at ? new Date(tc.updated_at).toLocaleString() : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Test Case Form Modal ─────────────────────────────────────────────────────
export function TestCaseFormModal({
  editing,
  suites,
  defaultSuiteId,
  onClose,
  onSaved,
}: {
  editing: TestCase | null;
  suites: TestSuite[];
  defaultSuiteId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    suite_id: String(editing?.suite_id ?? defaultSuiteId ?? ""),
    title: editing?.title ?? "",
    preconditions: editing?.preconditions ?? "",
    priority: (editing?.priority ?? "Medium") as TestCase["priority"],
    status: (editing?.status ?? "Draft") as TestCase["status"],
  });
  const [steps, setSteps] = useState<TestStep[]>(
    editing?.steps && editing.steps.length > 0 ? editing.steps : [emptyStep()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleAddStep = () =>
    setSteps((prev) => [
      ...prev,
      { step_number: prev.length + 1, action: "", expected_result: "" },
    ]);
  const handleRemoveStep = (i: number) =>
    setSteps((prev) =>
      prev
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, step_number: idx + 1 })),
    );
  const handleStepChange = (i: number, field: keyof TestStep, val: string) =>
    setSteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)),
    );

  const handleSave = async () => {
    if (!formData.title.trim())
      return setAlert({ type: "error", message: "Title is required." });
    if (!formData.suite_id)
      return setAlert({ type: "error", message: "Please select a suite." });
    if (steps.some((s) => !s.action.trim()))
      return setAlert({
        type: "error",
        message: "All steps must have an action.",
      });
    setSubmitting(true);
    setAlert(null);
    try {
      const url = editing
        ? `/api/test-cases/update/${editing.id}`
        : "/api/test-cases/create";
      const method = editing ? API.put : API.post;
      const res = await method(
        url,
        { ...formData, steps },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (res.data.success) {
        setAlert({
          type: "success",
          message: editing ? "Test case updated!" : "Test case created!",
        });
        setTimeout(() => {
          onClose();
          onSaved();
        }, 1000);
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Operation failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? "Edit Test Case" : "Create Test Case"}
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
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}

        {/* Suite selector — only show if no defaultSuiteId or editing */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Suite <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.suite_id}
            onChange={(e) =>
              setFormData({ ...formData, suite_id: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select Suite --</option>
            {suites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.project_name ? `[${s.project_name}] ` : ""}
                {s.suite_name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            placeholder="e.g. Verify login with valid credentials"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Preconditions
          </label>
          <textarea
            value={formData.preconditions}
            onChange={(e) =>
              setFormData({ ...formData, preconditions: e.target.value })
            }
            placeholder="e.g. User must be registered"
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  priority: e.target.value as TestCase["priority"],
                })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {["Low", "Medium", "High", "Critical"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as TestCase["status"],
                })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {["Draft", "Ready", "Deprecated"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Steps */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Test Steps
            </label>
            <button
              onClick={handleAddStep}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <FaPlus className="w-3 h-3" /> Add Step
            </button>
          </div>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Step {index + 1}
                  </span>
                  {steps.length > 1 && (
                    <button
                      onClick={() => handleRemoveStep(index)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={step.action}
                  onChange={(e) =>
                    handleStepChange(index, "action", e.target.value)
                  }
                  placeholder="Action *"
                  className="w-full mb-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={step.expected_result}
                  onChange={(e) =>
                    handleStepChange(index, "expected_result", e.target.value)
                  }
                  placeholder="Expected Result"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
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
            {submitting
              ? editing
                ? "Updating..."
                : "Creating..."
              : editing
                ? "Update"
                : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Suite Form Modal ─────────────────────────────────────────────────────────
export function SuiteFormModal({
  editing,
  projects,
  defaultProjectId,
  onClose,
  onSaved,
}: {
  editing: TestSuite | null;
  projects: Project[];
  defaultProjectId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    project_id: String(editing?.project_id ?? defaultProjectId ?? ""),
    suite_name: editing?.suite_name ?? "",
    description: editing?.description ?? "",
    is_active: editing?.is_active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSave = async () => {
    if (!formData.suite_name.trim())
      return setAlert({ type: "error", message: "Suite name is required." });
    if (!formData.project_id)
      return setAlert({ type: "error", message: "Please select a project." });
    setSubmitting(true);
    setAlert(null);
    try {
      const url = editing
        ? `/api/test-suites/update/${editing.id}`
        : "/api/test-suites/create";
      const method = editing ? API.put : API.post;
      const res = await method(url, formData, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) {
        setAlert({
          type: "success",
          message: editing ? "Suite updated!" : "Suite created!",
        });
        setTimeout(() => {
          onClose();
          onSaved();
        }, 1000);
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Operation failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? "Edit Suite" : "Create Suite"}
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
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.project_id}
            onChange={(e) =>
              setFormData({ ...formData, project_id: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select Project --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Suite Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.suite_name}
            onChange={(e) =>
              setFormData({ ...formData, suite_name: e.target.value })
            }
            placeholder="e.g. Authentication Tests"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Optional description..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Active
          </span>
          <Toggle
            value={formData.is_active}
            onChange={(v) => setFormData({ ...formData, is_active: v })}
            size="md"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formData.is_active ? "Active" : "Inactive"}
          </span>
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
            {submitting
              ? editing
                ? "Updating..."
                : "Creating..."
              : editing
                ? "Update"
                : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Test Case Row ────────────────────────────────────────────────────────────
function TestCaseRow({
  tc,
  allSuites,
  onEdit,
  onDelete,
  onRefresh,
}: {
  tc: TestCase;
  allSuites: TestSuite[];
  onEdit: (tc: TestCase) => void;
  onDelete: (tc: TestCase) => void;
  onRefresh: () => void;
}) {
  const [viewing, setViewing] = useState<TestCase | null>(null);

  const handleView = async () => {
    try {
      const res = await API.get(`/api/test-cases/${tc.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) setViewing(res.data.data);
    } catch {
      setViewing(tc);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg group transition-colors duration-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
            <FaClipboardList className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-medium">
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
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-4">
          <button
            onClick={handleView}
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 transition-colors"
            title="View"
          >
            <FaEye className="w-3 h-3" />
          </button>
          <button
            onClick={() => onEdit(tc)}
            className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 transition-colors"
            title="Edit"
          >
            <FaEdit className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(tc)}
            className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
            title="Delete"
          >
            <FaTrash className="w-3 h-3" />
          </button>
        </div>
      </div>
      {viewing && (
        <TestCaseViewModal tc={viewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

// ─── Suite Accordion ──────────────────────────────────────────────────────────
function SuiteAccordion({
  suite,
  testCases,
  allSuites,
  projects,
  onRefresh,
}: {
  suite: TestSuite;
  testCases: TestCase[];
  allSuites: TestSuite[];
  projects: Project[];
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);

  // Suite modal state
  const [editSuiteModal, setEditSuiteModal] = useState(false);
  const [deleteSuiteModal, setDeleteSuiteModal] = useState(false);
  const [linkedCaseCount, setLinkedCaseCount] = useState(0);
  const [deleteSuiteAlert, setDeleteSuiteAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deletingSuiteInProgress, setDeletingSuiteInProgress] = useState(false);

  // Test case modal state
  const [addCaseModal, setAddCaseModal] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [deletingCase, setDeletingCase] = useState<TestCase | null>(null);
  const [deleteCaseAlert, setDeleteCaseAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deletingCaseInProgress, setDeletingCaseInProgress] = useState(false);

  const cases = testCases.filter((tc) => tc.suite_id === suite.id);

  const handleToggleSuite = async () => {
    try {
      await API.put(
        `/api/test-suites/toggle/${suite.id}`,
        { is_active: !suite.is_active },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      onRefresh();
    } catch {}
  };

  const handleDeleteSuiteClick = async () => {
    setDeleteSuiteAlert(null);
    setLinkedCaseCount(0);
    try {
      const res = await API.get(`/api/test-suites/${suite.id}/case-count`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) setLinkedCaseCount(res.data.count ?? 0);
    } catch {}
    setDeleteSuiteModal(true);
  };

  const handleConfirmDeleteSuite = async () => {
    setDeletingSuiteInProgress(true);
    setDeleteSuiteAlert(null);
    try {
      await API.delete(`/api/test-suites/delete/${suite.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteSuiteAlert({
        type: "success",
        message: "Suite deleted successfully.",
      });
      setTimeout(() => {
        setDeleteSuiteModal(false);
        onRefresh();
      }, 1000);
    } catch (err: any) {
      setDeleteSuiteAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete suite.",
      });
    } finally {
      setDeletingSuiteInProgress(false);
    }
  };

  const handleEditCase = async (tc: TestCase) => {
    try {
      const res = await API.get(`/api/test-cases/${tc.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) setEditingCase(res.data.data);
    } catch {
      setEditingCase(tc);
    }
  };

  const handleDeleteCaseClick = (tc: TestCase) => {
    setDeletingCase(tc);
    setDeleteCaseAlert(null);
  };

  const handleConfirmDeleteCase = async () => {
    if (!deletingCase) return;
    setDeletingCaseInProgress(true);
    setDeleteCaseAlert(null);
    try {
      await API.delete(`/api/test-cases/delete/${deletingCase.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteCaseAlert({ type: "success", message: "Test case deleted." });
      setTimeout(() => {
        setDeletingCase(null);
        onRefresh();
      }, 1000);
    } catch (err: any) {
      setDeleteCaseAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete.",
      });
    } finally {
      setDeletingCaseInProgress(false);
    }
  };

  return (
    <>
      <div className="ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-4 mt-1">
        {/* Suite header */}
        <div
          className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer group transition-colors duration-150
    ${
      open
        ? "bg-blue-50 dark:bg-gray-800"
        : "hover:bg-gray-100 dark:hover:bg-gray-800"
    }`}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">
              {open ? (
                <FaChevronDown className="w-3 h-3" />
              ) : (
                <FaChevronRight className="w-3 h-3" />
              )}
            </span>
            <FaLayerGroup className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {suite.suite_name}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              ({cases.length} {cases.length === 1 ? "case" : "cases"})
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${
                suite.is_active
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              }`}
            >
              {suite.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div
            className="flex items-center gap-2 flex-shrink-0 ml-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toggle */}
            <Toggle value={suite.is_active} onChange={handleToggleSuite} />
            {/* Add Test Case */}
            <button
              onClick={() => setAddCaseModal(true)}
              className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Add Test Case"
            >
              <FaPlus className="w-3 h-3" />
            </button>
            <button
              onClick={() => setEditSuiteModal(true)}
              className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit Suite"
            >
              <FaEdit className="w-3 h-3" />
            </button>
            <button
              onClick={handleDeleteSuiteClick}
              className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete Suite"
            >
              <FaTrash className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Test Cases */}
        {open && (
          <div className="ml-6 border-l-2 border-gray-100 dark:border-gray-700/50 pl-3 mt-1 pb-1">
            {cases.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2 px-3 italic">
                No test cases in this suite.{" "}
                <button
                  onClick={() => setAddCaseModal(true)}
                  className="text-blue-500 hover:underline not-italic"
                >
                  Add one
                </button>
              </p>
            ) : (
              cases.map((tc) => (
                <TestCaseRow
                  key={tc.id}
                  tc={tc}
                  allSuites={allSuites}
                  onEdit={handleEditCase}
                  onDelete={handleDeleteCaseClick}
                  onRefresh={onRefresh}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Suite Edit Modal */}
      {editSuiteModal && (
        <SuiteFormModal
          editing={suite}
          projects={projects}
          onClose={() => setEditSuiteModal(false)}
          onSaved={onRefresh}
        />
      )}

      {/* Suite Delete Modal */}
      {deleteSuiteModal && (
        <DeleteModal
          title="Delete Suite"
          name={suite.suite_name}
          warning={
            linkedCaseCount > 0
              ? `${linkedCaseCount} test case${linkedCaseCount > 1 ? "s are" : " is"} linked. Remove them first.`
              : undefined
          }
          alert={deleteSuiteAlert}
          inProgress={deletingSuiteInProgress}
          disabled={linkedCaseCount > 0}
          onConfirm={handleConfirmDeleteSuite}
          onClose={() => setDeleteSuiteModal(false)}
        />
      )}

      {/* Add/Edit Test Case Modal */}
      {(addCaseModal || editingCase) && (
        <TestCaseFormModal
          editing={editingCase}
          suites={allSuites}
          defaultSuiteId={suite.id}
          onClose={() => {
            setAddCaseModal(false);
            setEditingCase(null);
          }}
          onSaved={onRefresh}
        />
      )}

      {/* Delete Test Case Modal */}
      {deletingCase && (
        <DeleteModal
          title="Delete Test Case"
          name={deletingCase.title}
          warning="All steps will also be permanently removed."
          alert={deleteCaseAlert}
          inProgress={deletingCaseInProgress}
          onConfirm={handleConfirmDeleteCase}
          onClose={() => {
            setDeletingCase(null);
            setDeleteCaseAlert(null);
          }}
        />
      )}
    </>
  );
}

// ─── Project Accordion ────────────────────────────────────────────────────────
function ProjectAccordion({
  project,
  suites,
  testCases,
  projects,
  onRefresh,
}: {
  project: Project;
  suites: TestSuite[];
  testCases: TestCase[];
  projects: Project[];
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [addSuiteModal, setAddSuiteModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [linkedSuiteCount, setLinkedSuiteCount] = useState(0);
  const [deleteAlert, setDeleteAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const projectSuites = suites.filter((s) => s.project_id === project.id);
  const projectCaseCount = testCases.filter((tc) =>
    projectSuites.some((s) => s.id === tc.suite_id),
  ).length;

  const handleToggle = async () => {
    try {
      await API.put(
        `/api/projects/toggle/${project.id}`,
        { is_active: !project.is_active },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      onRefresh();
    } catch {}
  };

  const handleDeleteClick = async () => {
    setDeleteAlert(null);
    setLinkedSuiteCount(0);
    try {
      const res = await API.get(`/api/projects/${project.id}/suite-count`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) setLinkedSuiteCount(res.data.count ?? 0);
    } catch {}
    setDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    setDeletingInProgress(true);
    setDeleteAlert(null);
    try {
      await API.delete(`/api/projects/delete/${project.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteAlert({
        type: "success",
        message: "Project deleted successfully.",
      });
      setTimeout(() => {
        setDeleteModal(false);
        onRefresh();
      }, 1000);
    } catch (err: any) {
      setDeleteAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to delete project.",
      });
    } finally {
      setDeletingInProgress(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden mb-2">
        {/* Project Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 cursor-pointer 
  transition-colors duration-150 group
  ${
    open
      ? "bg-blue-100 dark:bg-gray-800"
      : "hover:bg-gray-100 dark:hover:bg-gray-800/60"
  }`}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-3 min-w-0 ">
            <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">
              {open ? (
                <FaChevronDown className="w-3.5 h-3.5" />
              ) : (
                <FaChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
            {open ? (
              <FaFolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
            ) : (
              <FaFolder className="w-4 h-4 text-amber-500 flex-shrink-0" />
            )}
            <Link
              to={`/projects/${project.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold text-gray-900 dark:text-white hover:underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Open project overview"
            >
              {project.project_name}
            </Link>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              {projectSuites.length}{" "}
              {projectSuites.length === 1 ? "suite" : "suites"} ·{" "}
              {projectCaseCount} {projectCaseCount === 1 ? "case" : "cases"}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${
                project.is_active
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              }`}
            >
              {project.is_active ? "Active" : "Inactive"}
            </span>
            {project.description && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate hidden sm:block max-w-xs">
                {project.description}
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-2 flex-shrink-0 ml-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toggle — cascades to suites */}
            <Toggle value={project.is_active} onChange={handleToggle} />
            {/* Add Suite */}
            <button
              onClick={() => setAddSuiteModal(true)}
              className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Add Suite"
            >
              <FaPlus className="w-3.5 h-3.5" />
            </button>
            {/* View Details */}
            <button
              onClick={() => setViewModal(true)}
              className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="View Details"
            >
              <FaEye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setEditModal(true)}
              className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit Project"
            >
              <FaEdit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDeleteClick}
              className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete Project"
            >
              <FaTrash className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Suites */}
        {open && (
          <div className="px-4 pb-3 pt-1 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-700/50">
            {projectSuites.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-3 px-2 italic">
                No suites in this project.{" "}
                <button
                  onClick={() => setAddSuiteModal(true)}
                  className="text-blue-500 hover:underline not-italic"
                >
                  Add one
                </button>
              </p>
            ) : (
              projectSuites.map((suite) => (
                <SuiteAccordion
                  key={suite.id}
                  suite={suite}
                  testCases={testCases}
                  allSuites={suites}
                  projects={projects}
                  onRefresh={onRefresh}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Project Edit Modal */}
      {editModal && (
        <ProjectFormModal
          editing={project}
          onClose={() => setEditModal(false)}
          onSaved={onRefresh}
        />
      )}

      {/* Project Detail Modal */}
      {viewModal && (
        <ProjectDetailModal
          project={project}
          onClose={() => setViewModal(false)}
          onEdit={() => {
            setViewModal(false);
            setEditModal(true);
          }}
        />
      )}

      {/* Add Suite Modal */}
      {addSuiteModal && (
        <SuiteFormModal
          editing={null}
          projects={projects}
          defaultProjectId={project.id}
          onClose={() => setAddSuiteModal(false)}
          onSaved={onRefresh}
        />
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <DeleteModal
          title="Delete Project"
          name={project.project_name}
          warning={
            linkedSuiteCount > 0
              ? `${linkedSuiteCount} test suite${linkedSuiteCount > 1 ? "s are" : " is"} linked. Remove them first.`
              : undefined
          }
          alert={deleteAlert}
          inProgress={deletingInProgress}
          disabled={linkedSuiteCount > 0}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteModal(false)}
        />
      )}
    </>
  );
}

// ─── Project Form Modal ───────────────────────────────────────────────────────
function ProjectFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Project | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    project_name: editing?.project_name ?? "",
    description: editing?.description ?? "",
    is_active: editing?.is_active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSave = async () => {
    if (!formData.project_name.trim())
      return setAlert({ type: "error", message: "Project name is required." });
    setSubmitting(true);
    setAlert(null);
    try {
      const url = editing
        ? `/api/projects/update/${editing.id}`
        : "/api/projects/create";
      const method = editing ? API.put : API.post;
      const res = await method(url, formData, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) {
        setAlert({
          type: "success",
          message: editing ? "Project updated!" : "Project created!",
        });
        setTimeout(() => {
          onClose();
          onSaved();
        }, 1000);
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.response?.data?.message || "Operation failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? "Edit Project" : "Create Project"}
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
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.project_name}
            onChange={(e) =>
              setFormData({ ...formData, project_name: e.target.value })
            }
            placeholder="e.g. E-Commerce Platform"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Optional description..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Active
          </span>
          <Toggle
            value={formData.is_active}
            onChange={(v) => setFormData({ ...formData, is_active: v })}
            size="md"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formData.is_active ? "Active" : "Inactive"}
          </span>
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
            {submitting
              ? editing
                ? "Updating..."
                : "Creating..."
              : editing
                ? "Update"
                : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Projects() {
  const {
    data: projects,
    loading,
    error,
    refetch: refetchProjects,
  } = useFetchWithAuth<Project[]>("/api/projects");
  const { data: allSuites, refetch: refetchSuites } =
    useFetchWithAuth<TestSuite[]>("/api/test-suites");
  const { data: allTestCases, refetch: refetchCases } =
    useFetchWithAuth<TestCase[]>("/api/test-cases");

  const [showCreateProject, setShowCreateProject] = useState(false);

  // ─── SEARCH & FILTER STATE ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "inactive">(
    "",
  );

  // ─── PAGINATION STATE ───────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleRefresh = useCallback(() => {
    refetchProjects?.();
    refetchSuites?.();
    refetchCases?.();
  }, [refetchProjects, refetchSuites, refetchCases]);

  // Fallback: if refetch not available from hook, reload page
  const onRefresh = useCallback(() => {
    if (typeof refetchProjects === "function") {
      handleRefresh();
    } else {
      window.location.reload();
    }
  }, [handleRefresh, refetchProjects]);

  // ─── SEARCH + FILTER LOGIC ───────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (!projects) return [];

    return projects.filter((project) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        project.project_name.toLowerCase().includes(q) ||
        (project.description ?? "").toLowerCase().includes(q);

      const matchesStatus =
        !filterStatus ||
        (filterStatus === "active" ? project.is_active : !project.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, filterStatus]);

  // ─── PAGINATION LOGIC ────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProjects = filteredProjects.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Reset to page 1 whenever filters change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleFilterStatusChange = (val: "" | "active" | "inactive") => {
    setFilterStatus(val);
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(searchQuery || filterStatus);

  const handleClearFilters = () => {
    setSearchQuery("");
    setFilterStatus("");
    setCurrentPage(1);
  };

  // ─── PAGINATION RANGE ────────────────────────────────────────────────────
  const getPaginationRange = () => {
    const delta = 2;
    const range: (number | "...")[] = [];
    const left = Math.max(2, safePage - delta);
    const right = Math.min(totalPages - 1, safePage + delta);

    range.push(1);
    if (left > 2) range.push("...");
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push("...");
    if (totalPages > 1) range.push(totalPages);

    return range;
  };

  return (
    <div>
      <PageMeta title="Projects" description="Projects page" />
      <PageBreadcrumb pageTitle="Projects" />

      <div className="mt-4">
        {/* Summary */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {filteredProjects.length} project
            {filteredProjects.length !== 1 ? "s" : ""} ·{" "}
            {allSuites?.length ?? 0} suite{allSuites?.length !== 1 ? "s" : ""} ·{" "}
            {allTestCases?.length ?? 0} test case
            {allTestCases?.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* ── Search & Filters ── */}
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search projects…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Filters */}
            <select
              value={filterStatus}
              onChange={(e) =>
                handleFilterStatusChange(
                  e.target.value as "" | "active" | "inactive",
                )
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              >
                <FaTimes className="h-3 w-3" /> Clear
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowCreateProject(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <FaPlus className="h-3.5 w-3.5" /> Create
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Error" message={error} />
          </div>
        )}

        {loading && !error && (
          <div className="text-gray-500 dark:text-gray-400 py-8 text-center">
            Loading projects...
          </div>
        )}

        {!loading && !error && (
          <div>
            {paginatedProjects.length > 0 ? (
              paginatedProjects.map((project) => (
                <ProjectAccordion
                  key={project.id}
                  project={project}
                  suites={allSuites || []}
                  testCases={allTestCases || []}
                  projects={projects || []}
                  onRefresh={onRefresh}
                />
              ))
            ) : projects && projects.length > 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No projects match your search or filters.{" "}
                <button
                  onClick={handleClearFilters}
                  className="text-blue-500 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No projects found.{" "}
                <button
                  onClick={() => setShowCreateProject(true)}
                  className="text-blue-500 hover:underline"
                >
                  Create your first project
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && !error && filteredProjects.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {/* Left: page size + info */}
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span>
                {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredProjects.length)} of{" "}
                {filteredProjects.length}
              </span>
            </div>

            {/* Right: page controls */}
            <div className="flex items-center gap-1">
              {/* First */}
              <button
                onClick={() => handlePageChange(1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="First page"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 19l-7-7 7-7M18 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Prev */}
              <button
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Previous page"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Page numbers */}
              {getPaginationRange().map((item, i) =>
                item === "..." ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-2 py-1 text-gray-400 dark:text-gray-500 text-sm select-none"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => handlePageChange(item as number)}
                    className={`min-w-[32px] px-2 py-1 rounded-md text-sm font-medium transition ${
                      safePage === item
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}

              {/* Next */}
              <button
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Next page"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              {/* Last */}
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Last page"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 5l7 7-7 7M6 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateProject && (
        <ProjectFormModal
          editing={null}
          onClose={() => setShowCreateProject(false)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}