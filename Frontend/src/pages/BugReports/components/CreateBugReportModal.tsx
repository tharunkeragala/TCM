import { useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { bugReportAPI, BugReport, projectFunctionsAPI } from "../../../services/bugReportAPI";

interface CreateBugReportModalProps {
  bug?: BugReport | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  projects?: any[];
  sprints?: any[];
}

interface BugFormState {
  title: string;
  description: string;
  severity: string;
  priority: number;
  project_id: string;
  function_id: string;
  sprint_id: string;
  environment: string;
  affected_version: string;
}

const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white";

export default function CreateBugReportModal({
  bug,
  onClose,
  onSuccess,
  projects = [],
  sprints = [],
}: CreateBugReportModalProps) {
  const [formData, setFormData] = useState<BugFormState>({
    title: bug?.title || "",
    description: bug?.description || "",
    severity: bug?.severity || "Medium",
    priority: bug?.priority || 3,
    project_id: bug?.project_id?.toString() || "",
    function_id: bug?.project_function_id?.toString() || "",
    sprint_id: bug?.sprint_id?.toString() || "",
    environment: bug?.environment || "",
    affected_version: bug?.affected_version || "",
  });

  const [functions, setFunctions] = useState<any[]>([]);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAddFunctionForm, setShowAddFunctionForm] = useState(false);
  const [newFunctionName, setNewFunctionName] = useState("");
  const [newFunctionCategory, setNewFunctionCategory] = useState("");

  useEffect(() => {
    if (formData.project_id) loadFunctions(formData.project_id);
    else setFunctions([]);
  }, [formData.project_id]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [loading, onClose]);

  const loadFunctions = async (projectId: string) => {
    try {
      const response = await projectFunctionsAPI.getProjectFunctions(parseInt(projectId));
      setFunctions(response.data || []);
    } catch (error) {
      console.error("Error loading functions:", error);
    }
  };

  const handleScreenshotsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setScreenshots(Array.from(e.target.files).slice(0, 10));
  };

  const handleAddFunction = async () => {
    if (!newFunctionName.trim() || !formData.project_id) return;
    try {
      setLoading(true);
      setError("");
      await projectFunctionsAPI.addFunctionToProject({
        project_id: parseInt(formData.project_id),
        function_name: newFunctionName.trim(),
        function_category: newFunctionCategory.trim(),
      });
      await loadFunctions(formData.project_id);
      setNewFunctionName("");
      setNewFunctionCategory("");
      setShowAddFunctionForm(false);
    } catch (error) {
      console.error("Error adding function:", error);
      setError("Failed to add function.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");

    if (!formData.title.trim() || !formData.description.trim() || !formData.project_id || !formData.function_id) {
      setError("Title, description, project, and function are required.");
      return;
    }

    try {
      setLoading(true);
      if (bug) {
        await bugReportAPI.updateBugReport(bug.id, {
          title: formData.title.trim(),
          description: formData.description.trim(),
          severity: formData.severity,
          priority: formData.priority,
          environment: formData.environment,
          affected_version: formData.affected_version,
        });
      } else {
        const payload = new FormData();
        payload.append("title", formData.title.trim());
        payload.append("description", formData.description.trim());
        payload.append("severity", formData.severity);
        payload.append("priority", formData.priority.toString());
        payload.append("project_id", formData.project_id);
        payload.append("function_id", formData.function_id);
        if (formData.sprint_id) payload.append("sprint_id", formData.sprint_id);
        if (formData.environment) payload.append("environment", formData.environment);
        if (formData.affected_version) payload.append("affected_version", formData.affected_version);
        screenshots.forEach((file) => payload.append("screenshots", file));
        await bugReportAPI.createBugReport(payload);
      }

      onSuccess(bug ? "Bug report updated successfully" : "Bug report created successfully");
    } catch (error) {
      console.error("Error submitting form:", error);
      setError("Failed to submit bug report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{bug ? "Edit Bug Report" : "Report New Bug"}</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{bug ? bug.report_id : "Create a new issue for a project function or module."}</p>
            </div>
            <button type="button" onClick={onClose} disabled={loading} className="text-xl font-bold text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-200" aria-label="Close">&times;</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Project <span className="text-red-500">*</span></label>
                <select className={inputClass} value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value, function_id: "" })} disabled={!!bug || loading} required>
                  <option value="">Select Project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.project_name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Sprint</label>
                <select className={inputClass} value={formData.sprint_id} onChange={(e) => setFormData({ ...formData, sprint_id: e.target.value })} disabled={loading || !!bug}>
                  <option value="">Select Sprint (Optional)</option>
                  {sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.sprint_name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Function / Module <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <select className={`${inputClass} flex-1`} value={formData.function_id} onChange={(e) => setFormData({ ...formData, function_id: e.target.value })} disabled={!formData.project_id || loading || !!bug} required>
                    <option value="">Select Function</option>
                    {functions.map((fn) => <option key={fn.id} value={fn.id}>{fn.function_name}{fn.function_category ? ` (${fn.function_category})` : ""}</option>)}
                  </select>
                  {!bug && (
                    <button type="button" onClick={() => setShowAddFunctionForm((value) => !value)} disabled={!formData.project_id || loading} className="rounded-lg bg-blue-50 px-3 py-2 text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/20 dark:hover:bg-blue-900/40" title="Add New Function"><FaPlus className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Severity <span className="text-red-500">*</span></label>
                <select className={inputClass} value={formData.severity} onChange={(e) => setFormData({ ...formData, severity: e.target.value })} disabled={loading}>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {showAddFunctionForm && !bug && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-900/10">
                <p className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Add New Function</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input className={inputClass} placeholder="Function name" value={newFunctionName} onChange={(e) => setNewFunctionName(e.target.value)} disabled={loading} />
                  <input className={inputClass} placeholder="Category (UI, API, Database…)" value={newFunctionCategory} onChange={(e) => setNewFunctionCategory(e.target.value)} disabled={loading} />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddFunctionForm(false)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300">Cancel</button>
                  <button type="button" onClick={handleAddFunction} disabled={loading || !newFunctionName.trim()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Add Function</button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Title <span className="text-red-500">*</span></label>
              <input className={inputClass} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} disabled={loading} placeholder="Brief title of the bug" required />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description / Scenario <span className="text-red-500">*</span></label>
              <textarea className={`${inputClass} resize-y`} rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={loading} placeholder="Describe the bug scenario, steps to reproduce, and expected vs actual result" required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Environment</label>
                <select className={inputClass} value={formData.environment} onChange={(e) => setFormData({ ...formData, environment: e.target.value })} disabled={loading}>
                  <option value="">Select Environment</option>
                  <option value="Dev">Development</option>
                  <option value="QA">QA</option>
                  <option value="Staging">Staging</option>
                  <option value="Production">Production</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Affected Version</label>
                <input className={inputClass} value={formData.affected_version} onChange={(e) => setFormData({ ...formData, affected_version: e.target.value })} disabled={loading} placeholder="e.g. v1.0.0" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                <select className={inputClass} value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })} disabled={loading}>
                  <option value={1}>1 - Highest</option>
                  <option value={2}>2 - High</option>
                  <option value={3}>3 - Medium</option>
                  <option value={4}>4 - Low</option>
                  <option value={5}>5 - Lowest</option>
                </select>
              </div>
            </div>

            {!bug && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Screenshots <span className="text-xs font-normal text-gray-400">(up to 10)</span></label>
                <input type="file" className={inputClass} multiple accept="image/*" onChange={handleScreenshotsChange} disabled={loading} />
                {screenshots.length > 0 && <p className="mt-2 text-xs text-green-600 dark:text-green-400">{screenshots.length} screenshot{screenshots.length !== 1 ? "s" : ""} selected</p>}
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
            <button type="button" onClick={onClose} disabled={loading} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">{loading ? "Saving…" : bug ? "Update Bug Report" : "Create Bug Report"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
