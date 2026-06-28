// ─── Auth ─────────────────────────────────────────────────────────────────────

export const getToken = (): string | null =>
  localStorage.getItem("token") ?? sessionStorage.getItem("token");

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatDuration(ms?: number | null): string | null {
  if (!ms) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Color maps ───────────────────────────────────────────────────────────────

export const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  Critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export const PRIORITY_DOT: Record<string, string> = {
  Low: "bg-gray-400",
  Medium: "bg-blue-500",
  High: "bg-orange-500",
  Critical: "bg-red-500",
};

export const STATUS_COLORS: Record<string, string> = {
  Draft:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  Ready: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Deprecated: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

export const RUN_STATUS: Record<
  string,
  { bg: string; icon: string; label: string }
> = {
  passed: {
    bg: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    icon: "check",
    label: "PASSED",
  },
  failed: {
    bg: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    icon: "times",
    label: "FAILED",
  },
  running: {
    bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: "spinner",
    label: "RUNNING",
  },
  pending: {
    bg: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    icon: "list",
    label: "PENDING",
  },
};

export const BOARD_STATUS_DISPLAY: Record<
  string,
  { pill: string; dot: string; label: string }
> = {
  "To Do": {
    pill: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600",
    dot: "bg-gray-400",
    label: "To Do",
  },
  "In Progress": {
    pill: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-300 dark:border-blue-700",
    dot: "bg-blue-500 animate-pulse",
    label: "In Progress",
  },
  Done: {
    pill: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border border-green-300 dark:border-green-700",
    dot: "bg-green-500",
    label: "Done",
  },
};

export const BOARD_STATUSES = ["To Do", "In Progress", "Done"] as const;

// ─── Misc ─────────────────────────────────────────────────────────────────────

export const emptyStep = () => ({
  step_number: 1,
  action: "",
  expected_result: "",
});
