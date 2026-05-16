import { Task } from "../types";
import { formatDate } from "../utils";
import { formatDateTime } from "../../../utils/dateUtils";

// ─── Section rail shared class ────────────────────────────────────────────────
const RAIL = "border-l-2 border-brand-200 dark:border-brand-800/50 pl-4";
const SECTION_TITLE =
  "text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2";

interface Props {
  detail: Task;
}

export default function AccordionDetail({ detail }: Props) {
  return (
    <div className="space-y-5">
      {/* Description */}
      {detail.description && (
        <div className={RAIL}>
          <p className={SECTION_TITLE}>Description</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {detail.description}
          </p>
        </div>
      )}

      {/* Latest Comments */}
      {detail.comments &&
        detail.comments.filter((c) => !c.is_system).length > 0 && (
          <div className={RAIL}>
            <p className={SECTION_TITLE}>Latest Comments</p>
            <div className="space-y-3">
              {detail.comments
                .filter((c) => !c.is_system)
                .slice(0, 3)
                .map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-400 flex-shrink-0">
                      {c.created_by_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                          {c.created_by_name}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDateTime(c.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {c.comment}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      {/* Participants / ETA History / Recent Progress */}
      <div className="flex flex-wrap gap-6">
        {detail.assignments && detail.assignments.length > 0 && (
          <div className={RAIL}>
            <p className={SECTION_TITLE}>Participants</p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {detail.assignments
                .filter((a) => a.role !== "Owner")
                .map((a) => (
                  <div key={a.id} className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-400 flex-shrink-0">
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
          <div className={RAIL}>
            <p className={SECTION_TITLE}>ETA History</p>
            <div className="space-y-1">
              {detail.eta_history.map((e) => (
                <div
                  key={e.id}
                  className="text-xs text-gray-600 dark:text-gray-400"
                >
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
          <div className={RAIL}>
            <p className={SECTION_TITLE}>Recent Progress</p>
            <div className="space-y-1.5">
              {detail.progress.slice(0, 3).map((p) => (
                <div key={p.id}>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    {p.comment}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDateTime(p.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Activity Log */}
      {detail.comments &&
        detail.comments.filter((c) => c.is_system).length > 0 && (
          <div>
            <p className={SECTION_TITLE}>Activity Log</p>
            <div className={`${RAIL} space-y-1.5`}>
              {detail.comments
                .filter((c) => c.is_system)
                .slice(0, 5)
                .map((c) => (
                  <div
                    key={c.id}
                    className="text-xs text-gray-500 dark:text-gray-400"
                  >
                    <span>{c.comment}</span>
                    <span className="ml-1.5 text-gray-400 dark:text-gray-600">
                      — {formatDateTime(c.created_at)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
    </div>
  );
}