import { JSX } from "react";
import {
  FaClock,
  FaSpinner,
  FaPauseCircle,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

export const STATUS_CONFIG: Record<string, { color: string; icon: JSX.Element }> = {
  Pending: {
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    icon: <FaClock className="w-3 h-3" />,
  },
  "In Progress": {
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: <FaSpinner className="w-3 h-3" />,
  },
  "On Hold": {
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    icon: <FaPauseCircle className="w-3 h-3" />,
  },
  Completed: {
    color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    icon: <FaCheckCircle className="w-3 h-3" />,
  },
  Cancelled: {
    color: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
    icon: <FaTimesCircle className="w-3 h-3" />,
  },
};

export const PRIORITY_CONFIG: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  High: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export const ALL_STATUSES = [
  "Pending",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
] as const;

export const ALL_PRIORITIES = ["Low", "Medium", "High"] as const;