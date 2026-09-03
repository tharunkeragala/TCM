import { FaTrash } from "react-icons/fa";

interface DeleteModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export default function DeleteModal({
  title,
  message,
  onConfirm,
  onCancel,
  isDangerous = true,
}: DeleteModalProps) {
  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-xl font-bold text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="mb-5 flex items-start gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${isDangerous ? "bg-red-100 dark:bg-red-900/40" : "bg-gray-100 dark:bg-gray-800"}`}>
            <FaTrash className={isDangerous ? "h-4 w-4 text-red-600 dark:text-red-400" : "h-4 w-4 text-gray-500"} />
          </div>
          <p className="pt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">{message}</p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${isDangerous ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
