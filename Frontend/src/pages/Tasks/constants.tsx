import { JSX } from "react";
import {
  FaClock,
  FaSpinner,
  FaPauseCircle,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

// ─── Status ───────────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<string, { color: string; icon: JSX.Element }> = {
  Pending: {
    color:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    icon: <FaClock className="w-3 h-3" />,
  },
  "In Progress": {
    color:
      "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400",
    icon: <FaSpinner className="w-3 h-3 animate-spin" />,
  },
  "On Hold": {
    color:
      "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
    icon: <FaPauseCircle className="w-3 h-3" />,
  },
  Completed: {
    color:
      "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    icon: <FaCheckCircle className="w-3 h-3" />,
  },
  Cancelled: {
    color:
      "bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400",
    icon: <FaTimesCircle className="w-3 h-3" />,
  },
};

// ─── Priority ─────────────────────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<string, string> = {
  Low:    "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400",
  Medium: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400",
  High:   "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

// ─── Option arrays ────────────────────────────────────────────────────────────

export const ALL_STATUSES = [
  "Pending",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
] as const;

export const ALL_PRIORITIES = ["Low", "Medium", "High"] as const;