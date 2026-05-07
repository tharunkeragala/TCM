import { FaBell, FaExclamationCircle } from "react-icons/fa";
import { Task, User } from "../../types";
import { isOverdue } from "../../utils";
import TagList from "../TagList";
import ReminderBadge from "../badges/ReminderBadge";
import StatusChangeBadge from "../badges/StatusChangeBadge";
import ExtendETABadge from "../badges/ExtendETABadge";
import TaskDetailView from "../TaskDetailView";

interface Props {
  showViewModal: boolean;
  viewingTask: Task | null;
  viewLoading: boolean;
  users: User[];
  onClose: () => void;
  onProgressAdded: () => void;
  onCommentAdded: () => void;
  onReminderSaved: (msg: string) => void;
  onStatusChanged: () => void;
  onETAChanged: () => void;
}

export default function ViewModal({
  showViewModal,
  viewingTask,
  viewLoading,
  users,
  onClose,
  onProgressAdded,
  onCommentAdded,
  onReminderSaved,
  onStatusChanged,
  onETAChanged,
}: Props) {
  if (!showViewModal) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]">
        {/* Sticky header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {viewingTask && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="
      px-2 py-0.5
      text-xs font-bold
      rounded-md
      bg-blue-100 text-blue-700
      dark:bg-blue-900/40 dark:text-blue-300
      whitespace-nowrap
    "
                    >
                      {viewingTask.task_code}
                    </span>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {viewingTask.title}
                    </h2>

                    {isOverdue(viewingTask.due_date, viewingTask.status) && (
                      <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                        <FaExclamationCircle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                  </div>
                  {viewingTask.tags && <TagList tags={viewingTask.tags} />}
                </>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              {viewingTask && (
                <>
                  <ReminderBadge
                    taskId={viewingTask.id}
                    onToast={onReminderSaved}
                  />
                  <StatusChangeBadge
                    task={viewingTask}
                    onToast={onReminderSaved}
                    onStatusChanged={onStatusChanged}
                  />
                  <ExtendETABadge
                    task={viewingTask}
                    onToast={onReminderSaved}
                    onETAChanged={onETAChanged}
                  />
                </>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold leading-none ml-1"
                title="Close (Esc)"
              >
                &times;
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {viewLoading && (
            <div className="text-sm text-gray-400 py-4">Loading...</div>
          )}
          {!viewLoading && viewingTask && (
            <TaskDetailView
              task={viewingTask}
              users={users}
              onProgressAdded={onProgressAdded}
              onCommentAdded={onCommentAdded}
              onReminderSaved={onReminderSaved}
            />
          )}
        </div>
      </div>
    </div>
  );
}
