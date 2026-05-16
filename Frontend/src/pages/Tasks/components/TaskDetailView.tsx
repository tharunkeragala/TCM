import { useState, useRef } from "react";
import { FaCalendarAlt } from "react-icons/fa";
import API from "../../../services/api";
import { Task, User } from "../types";
import { formatDate, isOverdue } from "../utils";
import { formatDateTime } from "../../../utils/dateUtils";
import Alert from "../../../components/ui/alert/Alert";
import StatusBadge from "./badges/StatusBadge";
import PriorityBadge from "./badges/PriorityBadge";

// ─── Shared class helpers ─────────────────────────────────────────────────────
const INPUT_CLS =
  "flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg " +
  "bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 " +
  "focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 " +
  "transition-colors duration-150";

const SECTION_TITLE =
  "text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2";

interface Props {
  task: Task;
  users: User[];
  onProgressAdded: () => void;
  onCommentAdded: () => void;
  onReminderSaved: (msg: string) => void;
}

export default function TaskDetailView({
  task,
  users,
  onProgressAdded,
  onCommentAdded,
}: Props) {
  const [progressText, setProgressText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [mentions, setMentions] = useState<number[]>([]);
  const [submittingP, setSubmittingP] = useState(false);
  const [submittingC, setSubmittingC] = useState(false);
  const [progressAlert, setProgressAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [commentAlert, setCommentAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overdue = isOverdue(task.due_date, task.status);

  const getToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const handleMentionClick = (userId: number, username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const mention = `@${username.split(" ")[0]} `;
    const newText =
      commentText.substring(0, start) + mention + commentText.substring(end);
    setCommentText(newText);
    setMentions((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId],
    );
    setTimeout(() => {
      textarea.focus();
      const cursor = start + mention.length;
      textarea.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const handleAddProgress = async () => {
    if (!progressText.trim()) return;
    setSubmittingP(true);
    setProgressAlert(null);
    try {
      await API.post(
        `/api/tasks/${task.id}/progress`,
        { comment: progressText },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      setProgressText("");
      setProgressAlert({ type: "success", message: "Progress added." });
      onProgressAdded();
    } catch (err: any) {
      setProgressAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to add progress.",
      });
    } finally {
      setSubmittingP(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingC(true);
    setCommentAlert(null);
    try {
      await API.post(
        `/api/tasks/${task.id}/comments`,
        { comment: commentText, mentions },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      setCommentText("");
      setMentions([]);
      setCommentAlert({ type: "success", message: "Comment added." });
      onCommentAdded();
    } catch (err: any) {
      setCommentAlert({
        type: "error",
        message: err.response?.data?.message || "Failed to add comment.",
      });
    } finally {
      setSubmittingC(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Meta grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-gray-100 dark:border-gray-800">
        <div>
          <p className={SECTION_TITLE}>Status</p>
          <StatusBadge status={task.status} />
        </div>
        <div>
          <p className={SECTION_TITLE}>Priority</p>
          <PriorityBadge priority={task.priority} />
        </div>
        <div>
          <p className={SECTION_TITLE}>Due Date</p>
          <p
            className={`text-sm font-medium ${
              overdue
                ? "text-red-500 dark:text-red-400"
                : "text-gray-800 dark:text-gray-200"
            }`}
          >
            {task.due_date ? formatDate(task.due_date) : "Not set"}
            {overdue && " ⚠️"}
          </p>
        </div>
        <div>
          <p className={SECTION_TITLE}>Start Date</p>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {task.start_date ? formatDate(task.start_date) : "Not set"}
          </p>
        </div>
      </div>

      {/* ── Description ────────────────────────────────────────────────────── */}
      {task.description && (
        <div>
          <p className={SECTION_TITLE}>Description</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-4 py-3 rounded-lg leading-relaxed">
            {task.description}
          </p>
        </div>
      )}

      {/* ── Project / Suite / Assignees ────────────────────────────────────── */}
      {(task.project_name || task.suite_name || task.assignments?.length) && (
        <div className="flex flex-wrap gap-6">
          {(task.project_name || task.suite_name) && (
            <div>
              <p className={SECTION_TITLE}>Projects & Suites</p>
              <div className="flex flex-wrap gap-2">
                {task.project_name && (
                  <span className="text-xs bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 px-3 py-1 rounded-full">
                    📁 {task.project_name}
                  </span>
                )}
                {task.suite_name && (
                  <span className="text-xs bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 px-3 py-1 rounded-full">
                    🧪 {task.suite_name}
                  </span>
                )}
              </div>
            </div>
          )}

          {task.assignments && task.assignments.length > 0 && (
            <div>
              <p className={SECTION_TITLE}>Assignees</p>
              <div className="flex flex-wrap gap-2">
                {task.assignments
                  .filter((a) => a.role !== "Owner")
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg"
                    >
                      <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-400 flex-shrink-0">
                        {a.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                          {a.username}
                        </p>
                        <p className="text-xs text-gray-400">{a.role}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ETA History ────────────────────────────────────────────────────── */}
      {task.eta_history && task.eta_history.length > 0 && (
        <div>
          <p className={SECTION_TITLE}>ETA History</p>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {task.eta_history.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-700/30 rounded-lg px-3 py-2"
              >
                <FaCalendarAlt className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    <span className="line-through text-gray-400">
                      {e.old_eta ? formatDate(e.old_eta) : "—"}
                    </span>
                    {" → "}
                    <span className="font-medium">{formatDate(e.new_eta)}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {e.reason} — by {e.updated_by_name},{" "}
                    {formatDateTime(e.updated_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Progress Log ────────────────────────────────────────────────────── */}
      <div>
        <p className={SECTION_TITLE}>Progress Log</p>

        {progressAlert && (
          <div className="mb-2">
            <Alert
              variant={progressAlert.type}
              title=""
              message={progressAlert.message}
            />
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={progressText}
            onChange={(e) => setProgressText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddProgress()}
            placeholder="Add a progress update…"
            className={INPUT_CLS}
          />
          <button
            onClick={handleAddProgress}
            disabled={submittingP || !progressText.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors duration-150 flex-shrink-0"
          >
            {submittingP ? "…" : "Add"}
          </button>
        </div>

        {task.progress && task.progress.length > 0 ? (
          <div className="max-h-40 overflow-y-auto space-y-2.5 border-l-2 border-brand-200 dark:border-brand-800/50 pl-4">
            {task.progress.map((p) => (
              <div key={p.id}>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {p.comment}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {p.created_by_name} — {formatDateTime(p.created_at)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            No progress logs yet.
          </p>
        )}
      </div>

      {/* ── Comments ────────────────────────────────────────────────────────── */}
      <div>
        <p className={SECTION_TITLE}>Comments & Activity</p>

        {commentAlert && (
          <div className="mb-2">
            <Alert
              variant={commentAlert.type}
              title=""
              message={commentAlert.message}
            />
          </div>
        )}

        <div className="space-y-2 mb-3">
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment… (use @name to mention)"
            rows={2}
            className={`${INPUT_CLS} w-full resize-none`}
          />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Mention chips */}
            <div className="flex flex-wrap gap-1">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleMentionClick(u.id, u.username)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors duration-150 ${
                    mentions.includes(u.id)
                      ? "bg-brand-600 text-white border-brand-600"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-300 dark:hover:border-brand-700"
                  }`}
                >
                  @{u.username.split(" ")[0]}
                </button>
              ))}
            </div>

            <button
              onClick={handleAddComment}
              disabled={submittingC || !commentText.trim()}
              className="px-4 py-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors duration-150 flex-shrink-0"
            >
              {submittingC ? "…" : "Comment"}
            </button>
          </div>
        </div>

        {task.comments && task.comments.length > 0 ? (
          <div className="max-h-48 overflow-y-auto space-y-3">
            {task.comments.map((c) =>
              c.is_system ? (
                /* System / activity entry */
                <div
                  key={c.id}
                  className="flex gap-3 text-xs text-gray-400 dark:text-gray-500 relative pl-4"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:border-gray-700" />
                  <span className="whitespace-pre-line leading-tight w-20 flex-shrink-0">
                    {formatDateTime(c.created_at)}
                  </span>
                  <span>— {c.comment}</span>
                </div>
              ) : (
                /* User comment */
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-400 flex-shrink-0">
                    {c.created_by_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {c.created_by_name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDateTime(c.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {c.comment}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            No comments yet.
          </p>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
        <div>
          <p>
            Created by{" "}
            <span className="font-medium text-gray-600 dark:text-gray-400">
              {task.created_by_name || "—"}
            </span>
          </p>
          {task.created_at && <p className="mt-0.5">{formatDateTime(task.created_at)}</p>}
        </div>
        <div>
          <p>
            Last updated by{" "}
            <span className="font-medium text-gray-600 dark:text-gray-400">
              {task.updated_by_name || "—"}
            </span>
          </p>
          {task.updated_at && <p className="mt-0.5">{formatDateTime(task.updated_at)}</p>}
        </div>
      </div>
    </div>
  );
}