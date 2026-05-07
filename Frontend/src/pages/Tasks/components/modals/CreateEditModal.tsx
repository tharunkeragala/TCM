import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Alert from "../../../../components/ui/alert/Alert";
import { Task, TaskFormData, AlertState, User, Project, TestSuite } from "../../types";
import { toLocalDateString } from "../../utils";
import { ALL_PRIORITIES } from "../../constants";
import UserMultiSelect from "../UserMultiSelect";
import TagList from "../TagList";

interface Props {
  showModal: boolean;
  editingTask: Task | null;
  formData: TaskFormData;
  setFormData: (data: TaskFormData) => void;
  assignees: number[];
  setAssignees: (ids: number[]) => void;
  selectedProjectFilter: string;
  setSelectedProjectFilter: (val: string) => void;
  formAlert: AlertState | null;
  submitting: boolean;
  projects: Project[] | null;
  allSuites: TestSuite[] | null;
  users: User[] | null;
  onClose: () => void;
  onSave: () => void;
}

export default function CreateEditModal({
  showModal,
  editingTask,
  formData,
  setFormData,
  assignees,
  setAssignees,
  selectedProjectFilter,
  setSelectedProjectFilter,
  formAlert,
  submitting,
  projects,
  allSuites,
  users,
  onClose,
  onSave,
}: Props) {
  if (!showModal) return null;

  const filteredSuites = allSuites?.filter((s) =>
    selectedProjectFilter ? String(s.project_id) === selectedProjectFilter : true,
  );

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingTask ? "Edit Task" : "Create Task"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        {formAlert && (
          <div className="mb-4">
            <Alert
              variant={formAlert.type}
              title={formAlert.type === "success" ? "Success" : "Error"}
              message={formAlert.message}
            />
          </div>
        )}

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Fix login bug on mobile"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Task details..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Priority / Start Date / Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: e.target.value as Task["priority"] })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ALL_PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <DatePicker
              selected={
                formData.start_date
                  ? (() => {
                      const [y, m, d] = formData.start_date.split("-").map(Number);
                      return new Date(y, m - 1, d);
                    })()
                  : null
              }
              onChange={(date: Date | null) =>
                setFormData({ ...formData, start_date: toLocalDateString(date) })
              }
              minDate={new Date()}
              dateFormat="dd/MM/yyyy"
              placeholderText="Select start date"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ETA / Due Date
            </label>
            <DatePicker
              selected={
                formData.due_date
                  ? (() => {
                      const [y, m, d] = formData.due_date.split("-").map(Number);
                      return new Date(y, m - 1, d);
                    })()
                  : null
              }
              onChange={(date: Date | null) =>
                setFormData({ ...formData, due_date: toLocalDateString(date) })
              }
              minDate={new Date()}
              dateFormat="dd/MM/yyyy"
              placeholderText="Select a date"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Project / Suite */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link to Project
            </label>
            <select
              value={selectedProjectFilter}
              onChange={(e) => {
                setSelectedProjectFilter(e.target.value);
                setFormData({ ...formData, project_id: e.target.value, suite_id: "" });
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- None --</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>{p.project_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link to Suite
            </label>
            <select
              value={formData.suite_id}
              onChange={(e) => setFormData({ ...formData, suite_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- None --</option>
              {filteredSuites?.map((s) => (
                <option key={s.id} value={s.id}>{s.suite_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Assignees */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <UserMultiSelect
            label="Assignees"
            users={users || []}
            selected={assignees}
            onChange={setAssignees}
          />
        </div>

        {/* Tags */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tags{" "}
            <span className="text-xs text-gray-400 font-normal">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="e.g. regression, smoke, auth"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {formData.tags && <TagList tags={formData.tags} />}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition duration-150"
          >
            {submitting
              ? editingTask ? "Updating..." : "Creating..."
              : editingTask ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}