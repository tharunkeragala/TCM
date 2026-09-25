import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  FaCheck,
  FaChevronDown,
  FaSearch,
  FaTimes,
  FaUser,
} from "react-icons/fa";

import Alert from "../../../../components/ui/alert/Alert";
import DateField from "../../../../components/common/DateField";
import RichTextEditor from "../../../../components/common/RichTextEditor";

import {
  Task,
  TaskFormData,
  AlertState,
  User,
  Project,
  TestSuite,
} from "../../types";

import { ALL_PRIORITIES } from "../../constants";
import TagList from "../TagList";

/* ==========================================================================
   SHARED STYLES
   ========================================================================== */

const INPUT_CLS =
  "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg " +
  "bg-white dark:bg-gray-800 text-gray-900 dark:text-white " +
  "placeholder:text-gray-400 dark:placeholder:text-gray-500 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 " +
  "transition-colors duration-150";

const LABEL_CLS =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

const DROPDOWN_TRIGGER_CLS =
  "w-full flex items-center justify-between gap-2 px-3 py-2 " +
  "text-sm border border-gray-300 dark:border-gray-600 rounded-lg " +
  "bg-white dark:bg-gray-800 text-gray-900 dark:text-white " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 " +
  "transition min-w-0";

/* ==========================================================================
   DROPDOWN TYPES
   ========================================================================== */

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

/* ==========================================================================
   PORTAL POSITION HELPER
   ========================================================================== */

const calculateDropdownPosition = (
  trigger: HTMLElement,
  preferredHeight = 260,
): DropdownPosition => {
  const rect = trigger.getBoundingClientRect();

  const viewportHeight = window.innerHeight;

  const gap = 6;

  const spaceBelow = viewportHeight - rect.bottom - gap;

  const spaceAbove = rect.top - gap;

  /*
   * Prefer downward opening.
   * If there is not enough room below and there is more room above,
   * open upward instead.
   */
  const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;

  const availableHeight = openAbove
    ? Math.max(120, spaceAbove - 12)
    : Math.max(120, spaceBelow - 12);

  const maxHeight = Math.min(preferredHeight, availableHeight);

  return {
    top: openAbove ? rect.top - gap : rect.bottom + gap,

    left: rect.left,

    width: rect.width,

    maxHeight,

    placement: openAbove ? "top" : "bottom",
  };
};

/* ==========================================================================
   GENERIC PORTAL DROPDOWN
   ========================================================================== */

interface StyledDropdownProps {
  value: string;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function StyledDropdown({
  value,
  options,
  placeholder = "Select option",
  disabled = false,
  onChange,
}: StyledDropdownProps) {
  const [open, setOpen] = useState(false);

  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  const updatePosition = () => {
    if (!triggerRef.current) {
      return;
    }

    setPosition(calculateDropdownPosition(triggerRef.current, 260));
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    const handleReposition = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleReposition);

    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);

      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      const clickedTrigger = triggerRef.current?.contains(target);

      const clickedPanel = panelRef.current?.contains(target);

      if (!clickedTrigger && !clickedPanel) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);

      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }

          setOpen((previous) => !previous);
        }}
        className={`${DROPDOWN_TRIGGER_CLS} ${
          open ? "border-blue-400 dark:border-blue-500" : ""
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span
          className={`truncate ${
            selectedOption ? "" : "italic text-gray-400 dark:text-gray-500"
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <FaChevronDown
          className={`flex-shrink-0 text-xs text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",

              left: position.left,

              width: position.width,

              maxHeight: position.maxHeight,

              ...(position.placement === "top"
                ? {
                    bottom: window.innerHeight - position.top,
                  }
                : {
                    top: position.top,
                  }),
            }}
            className="
              z-[1000001]
              overflow-y-auto
              rounded-lg
              border
              border-gray-300
              bg-white
              shadow-2xl
              dark:border-gray-600
              dark:bg-gray-800
            "
          >
            {options.length > 0 ? (
              options.map((option) => {
                const selected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);

                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition ${
                      selected
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>

                    {selected && (
                      <FaCheck className="flex-shrink-0 text-xs text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-6 text-center text-xs text-gray-400">
                No options available
              </div>
            )}
          </div>,

          document.body,
        )}
    </>
  );
}

/* ==========================================================================
   SEARCHABLE ASSIGNEE DROPDOWN
   ========================================================================== */

interface SearchableAssigneeSelectProps {
  users: User[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

function SearchableAssigneeSelect({
  users,
  selected,
  onChange,
}: SearchableAssigneeSelectProps) {
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");

  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const selectedUsers = useMemo(
    () => users.filter((user) => selected.includes(user.id)),
    [users, selected],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const username = user.username || "";

      const email = "email" in user ? String(user.email || "") : "";

      return (
        username.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query)
      );
    });
  }, [users, search]);

  const updatePosition = () => {
    if (!triggerRef.current) {
      return;
    }

    setPosition(calculateDropdownPosition(triggerRef.current, 340));
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    const handleReposition = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleReposition);

    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.clearTimeout(timer);

      window.removeEventListener("resize", handleReposition);

      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      const clickedTrigger = triggerRef.current?.contains(target);

      const clickedPanel = panelRef.current?.contains(target);

      if (!clickedTrigger && !clickedPanel) {
        setOpen(false);
        setSearch("");
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleMouseDown);

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);

      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const toggleUser = (userId: number) => {
    if (selected.includes(userId)) {
      onChange(selected.filter((id) => id !== userId));
    } else {
      onChange([...selected, userId]);
    }
  };

  const removeUser = (userId: number) => {
    onChange(selected.filter((id) => id !== userId));
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={`${DROPDOWN_TRIGGER_CLS} ${
          open ? "border-blue-400 dark:border-blue-500" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FaUser className="flex-shrink-0 text-xs text-gray-400" />

          <span
            className={`truncate ${
              selectedUsers.length
                ? "text-gray-900 dark:text-white"
                : "italic text-gray-400 dark:text-gray-500"
            }`}
          >
            {selectedUsers.length === 0
              ? "Select assignees"
              : selectedUsers.length === 1
                ? selectedUsers[0].username
                : `${selectedUsers.length} assignees selected`}
          </span>
        </div>

        <FaChevronDown
          className={`flex-shrink-0 text-xs text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Selected assignee chips */}
      {selectedUsers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedUsers.map((user) => (
            <span
              key={user.id}
              className="
                  inline-flex
                  max-w-full
                  items-center
                  gap-1.5
                  rounded-full
                  bg-blue-50
                  px-2.5 py-1
                  text-xs
                  font-medium
                  text-blue-700
                  dark:bg-blue-500/10
                  dark:text-blue-300
                "
            >
              <span className="max-w-[130px] truncate">{user.username}</span>

              <button
                type="button"
                onClick={() => removeUser(user.id)}
                className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-200"
                aria-label={`Remove ${user.username}`}
              >
                <FaTimes className="text-[9px]" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",

              left: position.left,

              width: position.width,

              maxHeight: position.maxHeight,

              ...(position.placement === "top"
                ? {
                    bottom: window.innerHeight - position.top,
                  }
                : {
                    top: position.top,
                  }),
            }}
            className="
              z-[1000001]
              flex
              flex-col
              overflow-hidden
              rounded-lg
              border
              border-gray-300
              bg-white
              shadow-2xl
              dark:border-gray-600
              dark:bg-gray-800
            "
          >
            {/* Search */}
            <div className="flex-shrink-0 border-b border-gray-200 p-2 dark:border-gray-700">
              <div className="relative">
                <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />

                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search assignee..."
                  className="
                    w-full
                    rounded-lg
                    border
                    border-gray-300
                    bg-white
                    py-2
                    pl-8
                    pr-8
                    text-sm
                    text-gray-900
                    placeholder:text-gray-400
                    focus:outline-none
                    focus:ring-2
                    focus:ring-blue-500
                    dark:border-gray-600
                    dark:bg-gray-800
                    dark:text-white
                  "
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                )}
              </div>
            </div>

            {/* Users */}
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const isSelected = selected.includes(user.id);

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleUser(user.id)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-500/10"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div
                        className="
                            flex h-7 w-7
                            flex-shrink-0
                            items-center
                            justify-center
                            rounded-full
                            bg-blue-100
                            text-xs
                            font-bold
                            text-blue-700
                            dark:bg-blue-500/20
                            dark:text-blue-300
                          "
                      >
                        {user.username?.[0]?.toUpperCase() || "?"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                          {user.username}
                        </p>

                        {"email" in user && user.email && (
                          <p className="truncate text-[11px] text-gray-400">
                            {user.email}
                          </p>
                        )}
                      </div>

                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {isSelected && <FaCheck className="text-[8px]" />}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-7 text-center text-xs text-gray-400">
                  No users found
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 items-center justify-between border-t border-gray-200 px-3 py-2 dark:border-gray-700">
              <span className="text-xs text-gray-400">
                {selected.length} selected
              </span>

              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>,

          document.body,
        )}
    </>
  );
}

/* ==========================================================================
   PROPS
   ========================================================================== */

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

  lockProject?: boolean;
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

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
  /*
   * allSuites remains in Props so this component stays compatible
   * with your existing parent calls.
   */
  void allSuites;

  if (!showModal) {
    return null;
  }

  const priorityOptions: DropdownOption[] = ALL_PRIORITIES.map((priority) => ({
    value: priority,
    label: priority,
  }));

  const projectOptions: DropdownOption[] = [
    {
      value: "",
      label: "— None —",
    },

    ...(projects || []).map((project) => ({
      value: String(project.id),

      label: project.project_name,
    })),
  ];

  const today = new Date();

  const todayValue = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div
        className="
          flex
          max-h-[90vh]
          w-full
          max-w-2xl
          flex-col
          rounded-2xl
          bg-white
          shadow-2xl
          dark:bg-gray-900
        "
      >
        {/* ================================================================ */}
        {/* Header                                                          */}
        {/* ================================================================ */}

        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {editingTask ? "Edit Task" : "Create Task"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="
              flex
              h-7 w-7
              items-center
              justify-center
              rounded-md
              text-lg
              leading-none
              text-gray-400
              transition-colors
              hover:bg-gray-100
              hover:text-gray-600
              dark:hover:bg-gray-800
              dark:hover:text-gray-200
            "
          >
            &times;
          </button>
        </div>

        {/* ================================================================ */}
        {/* Body                                                            */}
        {/* ================================================================ */}

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {formAlert && (
            <Alert
              variant={formAlert.type}
              title={formAlert.type === "success" ? "Success" : "Error"}
              message={formAlert.message}
            />
          )}

          {/* ============================================================ */}
          {/* Title                                                        */}
          {/* ============================================================ */}

          <div>
            <label className={LABEL_CLS}>
              Title <span className="text-red-500">*</span>
            </label>

            <input
              type="text"
              value={formData.title}
              onChange={(event) =>
                setFormData({
                  ...formData,

                  title: event.target.value,
                })
              }
              placeholder="e.g. Fix login bug on mobile"
              className={INPUT_CLS}
            />
          </div>

          {/* ============================================================ */}
          {/* Description                                                  */}
          {/* ============================================================ */}

          <div>
            <label className={LABEL_CLS}>Description</label>

            <RichTextEditor
              value={formData.description || ""}
              onChange={(description) =>
                setFormData({
                  ...formData,
                  description,
                })
              }
              placeholder="Add task details, notes, steps, links..."
            />
          </div>

          {/* ============================================================ */}
          {/* Priority / Start Date / Due Date                            */}
          {/* ============================================================ */}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Priority */}
            <div>
              <label className={LABEL_CLS}>Priority</label>

              <StyledDropdown
                value={formData.priority}
                options={priorityOptions}
                placeholder="Select priority"
                onChange={(value) =>
                  setFormData({
                    ...formData,

                    priority: value as Task["priority"],
                  })
                }
              />
            </div>

            {/* Start Date */}
            <DateField
              label="Start Date"
              value={formData.start_date || ""}
              onChange={(value) =>
                setFormData({
                  ...formData,

                  start_date: value,

                  /*
                   * Clear due date if it becomes earlier
                   * than the new start date.
                   */
                  due_date:
                    formData.due_date && value && formData.due_date < value
                      ? ""
                      : formData.due_date,
                })
              }
              min={todayValue}
              placeholder="Select date"
            />

            {/* Due Date */}
            <DateField
              label="ETA / Due Date"
              value={formData.due_date || ""}
              onChange={(value) =>
                setFormData({
                  ...formData,

                  due_date: value,
                })
              }
              min={formData.start_date || todayValue}
              placeholder="Select date"
            />
          </div>

          {/* ============================================================ */}
          {/* Project / Assignees                                         */}
          {/* ORIGINAL STRUCTURE PRESERVED                                 */}
          {/* ============================================================ */}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Project */}
            <div>
              <label className={LABEL_CLS}>Link to Project</label>

              {lockProject ? (
                <div
                  className={`${INPUT_CLS} flex cursor-not-allowed items-center bg-gray-50 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400`}
                  title="This task is scoped to the current project"
                >
                  {projects?.find(
                    (project) => String(project.id) === selectedProjectFilter,
                  )?.project_name || "— None —"}
                </div>
              ) : (
                <StyledDropdown
                  value={selectedProjectFilter}
                  options={projectOptions}
                  placeholder="Select project"
                  onChange={(value) => {
                    setSelectedProjectFilter(value);

                    setFormData({
                      ...formData,

                      project_id: value,

                      suite_id: "",
                    });
                  }}
                />
              )}
            </div>

            {/* Assignees */}
            <div>
              <label className={LABEL_CLS}>Assignees</label>

              <SearchableAssigneeSelect
                users={users || []}
                selected={assignees}
                onChange={setAssignees}
              />
            </div>
          </div>

          {/* ============================================================ */}
          {/* Tags                                                         */}
          {/* ============================================================ */}

          <div>
            <label className={LABEL_CLS}>
              Tags{" "}
              <span className="text-xs font-normal text-gray-400">
                (comma-separated)
              </span>
            </label>

            <input
              type="text"
              value={formData.tags}
              onChange={(event) =>
                setFormData({
                  ...formData,

                  tags: event.target.value,
                })
              }
              placeholder="e.g. regression, smoke, auth"
              className={INPUT_CLS}
            />

            {formData.tags && (
              <div className="mt-2">
                <TagList tags={formData.tags} />
              </div>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* Footer                                                          */}
        {/* ================================================================ */}

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="
              rounded-lg
              bg-gray-100
              px-4 py-2
              text-sm
              font-medium
              text-gray-700
              transition-colors
              hover:bg-gray-200
              dark:bg-gray-800
              dark:text-gray-300
              dark:hover:bg-gray-700
            "
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={submitting}
            className="
              rounded-lg
              bg-blue-600
              px-4 py-2
              text-sm
              font-medium
              text-white
              transition-colors
              hover:bg-blue-700
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
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
