import { useEffect, useState } from "react";
import { FaPlus, FaSearch, FaTimes } from "react-icons/fa";
import Alert from "../../../components/ui/alert/Alert";
import API from "../../../services/api";
import { emptyStep, getToken } from "./utils.ts";
import type { TestStep } from "./types.ts";

// ─── LinkExistingModal ────────────────────────────────────────────────────────

interface LinkExistingModalProps {
  sprintId: number;
  suiteId: number;
  onClose: () => void;
  onLinked: () => void;
}

export function LinkExistingModal({
  sprintId,
  suiteId,
  onClose,
  onLinked,
}: LinkExistingModalProps) {
  const [options, setOptions] = useState<
    Array<{
      id: number;
      title: string;
      suite_name?: string;
      project_name?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get(
          `/api/sprints/${sprintId}/suites/${suiteId}/available-test-cases`,
          { headers: { Authorization: `Bearer ${getToken()}` } },
        );
        if (!cancelled && res.data.success) setOptions(res.data.data);
      } catch {
        if (!cancelled)
          setAlert({
            type: "error",
            message: "Failed to load available test cases.",
          });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sprintId, suiteId]);

  const filtered = options.filter(
    (o) =>
      !search ||
      `${o.title} ${o.suite_name ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  const handleLink = async (testCaseId: number) => {
    setLinkingId(testCaseId);
    setAlert(null);
    try {
      const res = await API.post(
        `/api/sprints/${sprintId}/suites/${suiteId}/test-cases/link`,
        { test_case_id: testCaseId },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (res.data.success) {
        setOptions((prev) => prev.filter((o) => o.id !== testCaseId));
        onLinked();
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to link test case.";
      setAlert({ type: "error", message: msg });
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Link Existing Test Case
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {alert && (
          <div className="mb-3">
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}

        <div className="relative mb-3">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test cases…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1.5">
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No test cases available to link.
            </p>
          ) : (
            filtered.map((tc) => (
              <div
                key={tc.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {tc.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {tc.suite_name}
                    {tc.project_name ? ` · ${tc.project_name}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleLink(tc.id)}
                  disabled={linkingId === tc.id}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {linkingId === tc.id ? "Linking…" : "Link"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CreateTestCaseModal ──────────────────────────────────────────────────────

interface CreateTestCaseModalProps {
  sprintId: number;
  suiteId: number;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTestCaseModal({
  sprintId,
  suiteId,
  onClose,
  onCreated,
}: CreateTestCaseModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    preconditions: "",
    priority: "Medium",
    status: "Draft",
  });
  const [steps, setSteps] = useState<TestStep[]>([emptyStep()]);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const addStep = () =>
    setSteps((prev) => [
      ...prev,
      { step_number: prev.length + 1, action: "", expected_result: "" },
    ]);

  const removeStep = (idx: number) =>
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, step_number: i + 1 })),
    );

  const updateStep = (
    idx: number,
    field: keyof TestStep,
    value: string | number,
  ) =>
    setSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );

  const handleSave = async () => {
    if (!formData.title.trim())
      return setAlert({ type: "error", message: "Title is required." });
    setSubmitting(true);
    setAlert(null);
    try {
      const res = await API.post(
        `/api/sprints/${sprintId}/suites/${suiteId}/test-cases`,
        { ...formData, steps },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (res.data.success) {
        setAlert({ type: "success", message: "Test case created!" });
        setTimeout(() => {
          onClose();
          onCreated();
        }, 700);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to create test case.";
      setAlert({ type: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create Test Case
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {alert && (
          <div className="mb-3">
            <Alert
              variant={alert.type}
              title={alert.type === "success" ? "Success" : "Error"}
              message={alert.message}
            />
          </div>
        )}

        {/* Title */}
        <div className="mb-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            placeholder="e.g. Verify login with valid credentials"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Preconditions */}
        <div className="mb-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
            Preconditions
          </label>
          <textarea
            value={formData.preconditions}
            onChange={(e) =>
              setFormData({ ...formData, preconditions: e.target.value })
            }
            placeholder="Environment, prerequisites…"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Priority + Status */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {(
            [
              {
                label: "Priority",
                key: "priority",
                options: ["Low", "Medium", "High", "Critical"],
              },
              {
                label: "Status",
                key: "status",
                options: ["Draft", "Ready", "Deprecated"],
              },
            ] as const
          ).map(({ label, key, options }) => (
            <div key={key}>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                {label}
              </label>
              <select
                value={formData[key]}
                onChange={(e) =>
                  setFormData({ ...formData, [key]: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Test Steps
            </label>
            <button
              onClick={addStep}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <FaPlus className="w-3 h-3" /> Add Step
            </button>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500">
                    Step {i + 1}
                  </span>
                  {steps.length > 1 && (
                    <button
                      onClick={() => removeStep(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={step.action}
                  placeholder="Action *"
                  onChange={(e) => updateStep(i, "action", e.target.value)}
                  className="w-full mb-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={step.expected_result}
                  placeholder="Expected Result"
                  onChange={(e) =>
                    updateStep(i, "expected_result", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
