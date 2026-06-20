import { FaExclamationCircle, FaExternalLinkAlt } from "react-icons/fa";
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
  onOpenFullPage: () => void;
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
  onOpenFullPage,
}: Props) {
  if (!showViewModal) return null;

  const overdue =
    viewingTask && isOverdue(viewingTask.due_date, viewingTask.status);

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className={`flex-shrink-0 px-6 pt-5 pb-4 border-b transition-colors ${
            overdue
              ? "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-800/50"
              : "bg-brand-50 dark:bg-brand-500/5 border-brand-200 dark:border-brand-800/50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            {/* Title block */}
            <div className="flex-1 min-w-0">
              {viewingTask && (
                <>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 whitespace-nowrap">
                      {viewingTask.task_code}
                    </span>

                    {viewingTask.tags && <TagList tags={viewingTask.tags} />}

                    {overdue && (
                      <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                        <FaExclamationCircle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                    {viewingTask.title}
                  </h2>
                </>
              )}
            </div>

            {/* Action badges + close */}
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
              {viewingTask && (
                <>
                  <ReminderBadge taskId={viewingTask.id} onToast={onReminderSaved} />
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

                  {/* ── Open full page ── */}
                  <button
                    onClick={onOpenFullPage}
                    title="Open full page"
                    className="w-7 h-7 flex items-center justify-center rounded-md
                               text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
                               hover:bg-white/60 dark:hover:bg-gray-800
                               transition-colors duration-150"
                  >
                    <FaExternalLinkAlt className="w-3 h-3" />
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                title="Close (Esc)"
                className="w-7 h-7 flex items-center justify-center rounded-md ml-1
                           text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
                           hover:bg-white/60 dark:hover:bg-gray-800
                           transition-colors duration-150 text-xl leading-none"
              >
                &times;
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {viewLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Loading task details…
            </div>
          ) : (
            viewingTask && (
              <TaskDetailView
                task={viewingTask}
                users={users}
                onProgressAdded={onProgressAdded}
                onCommentAdded={onCommentAdded}
                onReminderSaved={onReminderSaved}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}