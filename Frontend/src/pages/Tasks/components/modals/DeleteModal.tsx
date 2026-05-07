import Alert from "../../../../components/ui/alert/Alert";
import { Task, AlertState } from "../../types";

interface Props {
  showDeleteModal: boolean;
  deletingTask: Task | null;
  deleteAlert: AlertState | null;
  deletingInProgress: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteModal({
  showDeleteModal,
  deletingTask,
  deleteAlert,
  deletingInProgress,
  onClose,
  onConfirm,
}: Props) {
  if (!showDeleteModal || !deletingTask) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Delete Task
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        {deleteAlert && (
          <div className="mb-4">
            <Alert
              variant={deleteAlert.type}
              title={deleteAlert.type === "success" ? "Success" : "Error"}
              message={deleteAlert.message}
            />
          </div>
        )}

        <div className="flex items-start gap-3 mb-6">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Are you sure you want to delete task{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              "{deletingTask.title}"
            </span>
            ? All comments, progress logs, assignments and attachments will be permanently removed.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={deletingInProgress}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition duration-150"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deletingInProgress}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition duration-150"
          >
            {deletingInProgress ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}