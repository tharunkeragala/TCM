import { FaCalendarAlt } from "react-icons/fa";
import { Task } from "../types";
import { formatDate } from "../utils";
import { formatDateTime } from "../../../utils/dateUtils";

interface Props {
  detail: Task;
}

export default function AccordionDetail({ detail }: Props) {
  return (
    <div className="space-y-4">
      {detail.description && (
        <div className="border-l-2 border-blue-400 dark:border-gray-700 pl-3">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
            Description
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{detail.description}</p>
        </div>
      )}

      {detail.comments && detail.comments.filter((c) => !c.is_system).length > 0 && (
        <div className="border-l-2 border-blue-400 dark:border-gray-700 pl-3">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
            Latest Comments
          </p>
          <div className="space-y-2">
            {detail.comments
              .filter((c) => !c.is_system)
              .slice(0, 3)
              .map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400 flex-shrink-0">
                    {c.created_by_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {c.created_by_name}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                      {formatDateTime(c.created_at)}
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {c.comment}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 pt-4">
        {detail.assignments && detail.assignments.length > 0 && (
          <div className="border-l-2 border-blue-400 dark:border-gray-700 pl-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Participants
            </p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {detail.assignments
                .filter((a) => a.role !== "Owner")
                .map((a) => (
                  <div key={a.id} className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                      {a.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      {a.username}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                      ({a.role})
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {detail.eta_history && detail.eta_history.length > 0 && (
          <div className="border-l-2 border-blue-400 dark:border-gray-700 pl-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              ETA History
            </p>
            <div className="space-y-1">
              {detail.eta_history.map((e) => (
                <div key={e.id} className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="line-through text-gray-400">
                    {e.old_eta ? formatDate(e.old_eta) : "—"}
                  </span>
                  {" → "}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {formatDate(e.new_eta)}
                  </span>
                  <span className="text-gray-400 ml-1">({e.reason})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detail.progress && detail.progress.length > 0 && (
          <div className="border-l-2 border-blue-400 dark:border-gray-700 pl-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Recent Progress
            </p>
            <div className="space-y-1">
              {detail.progress.slice(0, 3).map((p) => (
                <div key={p.id} className="text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex flex-col">
                    <span>{p.comment}</span>
                    <span className="text-gray-400 dark:text-gray-500">
                      {formatDateTime(p.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {detail.comments && detail.comments.filter((c) => c.is_system).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
            Activity Log
          </p>
          <div className="space-y-1 border-l-2 border-blue-400 dark:border-gray-700 pl-3">
            {detail.comments
              .filter((c) => c.is_system)
              .slice(0, 5)
              .map((c) => (
                <div key={c.id} className="text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col">
                    <span>{c.comment}</span>
                    <span className="text-gray-400 dark:text-gray-600">
                      {formatDateTime(c.created_at)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}