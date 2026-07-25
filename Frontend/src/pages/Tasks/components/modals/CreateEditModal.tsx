import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Alert from "../../../../components/ui/alert/Alert";
import {
  Task,
  TaskFormData,
  AlertState,
  User,
  Project,
  TestSuite,
} from "../../types";
import { toLocalDateString } from "../../utils";
import { ALL_PRIORITIES } from "../../constants";
import UserMultiSelect from "../UserMultiSelect";
import TagList from "../TagList";

// ─── Shared input class ───────────────────────────────────────────────────────
const INPUT_CLS =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg " +
  "bg-white dark:bg-gray-800 text-gray-900 dark:text-white " +
  "placeholder:text-gray-400 " +
  "focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 " +
  "transition-colors duration-150";

const LABEL_CLS =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

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
  /**
   * When true, the "Link to Project" field is rendered as a fixed, read-only
   * label instead of a select. Use this when the modal is opened from a
   * context that is already scoped to a single project (e.g. the Project
   * Overview page), so the field can't visually appear editable while
   * silently doing nothing.
   */
  lockProject?: boolean;
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
  lockProject = false,
}: Props) {
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {editingTask ? "Edit Task" : "Create Task"}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400
                       hover:text-gray-600 dark:hover:text-gray-200
                       hover:bg-gray-100 dark:hover:bg-gray-800
                       transition-colors duration-150 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {formAlert && (
            <Alert
              variant={formAlert.type}
              title={formAlert.type === "success" ? "Success" : "Error"}
              message={formAlert.message}
            />
          )}

          {/* Title */}
          <div>
            <label className={LABEL_CLS}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g. Fix login bug on mobile"
              className={INPUT_CLS}
            />
          </div>

          {/* Description */}
          <div>
            <label className={LABEL_CLS}>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Task details…"
              rows={3}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {/* Priority / Start Date / Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={LABEL_CLS}>Priority</label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as Task["priority"],
                  })
                }
                className={INPUT_CLS}
              >
                {ALL_PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLS}>Start Date</label>
              <DatePicker
                selected={
                  formData.start_date
                    ? (() => {
                        const [y, m, d] = formData.start_date
                          .split("-")
                          .map(Number);
                        return new Date(y, m - 1, d);
                      })()
                    : null
                }
                onChange={(date: Date | null) =>
                  setFormData({
                    ...formData,
                    start_date: toLocalDateString(date),
                  })
                }
                minDate={new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="Select date"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>ETA / Due Date</label>
              <DatePicker
                selected={
                  formData.due_date
                    ? (() => {
                        const [y, m, d] = formData.due_date
                          .split("-")
                          .map(Number);
                        return new Date(y, m - 1, d);
                      })()
                    : null
                }
                onChange={(date: Date | null) =>
                  setFormData({
                    ...formData,
                    due_date: toLocalDateString(date),
                  })
                }
                minDate={new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="Select date"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Project / Suite */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Link to Project</label>
              {lockProject ? (
                <div
                  className={`${INPUT_CLS} flex items-center bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 cursor-not-allowed`}
                  title="This task is scoped to the current project"
                >
                  {projects?.find((p) => String(p.id) === selectedProjectFilter)
                    ?.project_name || "— None —"}
                </div>
              ) : (
                <select
                  value={selectedProjectFilter}
                  onChange={(e) => {
                    setSelectedProjectFilter(e.target.value);
                    setFormData({
                      ...formData,
                      project_id: e.target.value,
                      suite_id: "",
                    });
                  }}
                  className={INPUT_CLS}
                >
                  <option value="">— None —</option>
                  {projects?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <UserMultiSelect
                label="Assignees"
                users={users || []}
                selected={assignees}
                onChange={setAssignees}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={LABEL_CLS}>
              Tags{" "}
              <span className="text-xs text-gray-400 font-normal">
                (comma-separated)
              </span>
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) =>
                setFormData({ ...formData, tags: e.target.value })
              }
              placeholder="e.g. regression, smoke, auth"
              className={INPUT_CLS}
            />
            {formData.tags && <TagList tags={formData.tags} />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg
                       text-gray-700 dark:text-gray-300
                       bg-gray-100 dark:bg-gray-800
                       hover:bg-gray-200 dark:hover:bg-gray-700
                       transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-lg
                       text-white bg-brand-600 hover:bg-brand-700
                       disabled:opacity-50 transition-colors duration-150"
          >
            {submitting
              ? editingTask
                ? "Updating…"
                : "Creating…"
              : editingTask
                ? "Update Task"
                : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
