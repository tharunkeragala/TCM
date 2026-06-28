import { useEffect, useState } from "react";
import {
  FaComment,
  FaEdit,
  FaHistory,
  FaLayerGroup,
  FaLink,
  FaPlay,
  FaSpinner,
  FaUser,
} from "react-icons/fa";
import API from "../../../services/api";
import { getToken, timeAgo } from "./utils.ts";
import type { ActivityEvent } from "./types.ts";

// ─── Icon config per event type ───────────────────────────────────────────────

function iconForType(type: string): { bg: string; icon: React.ReactNode } {
  switch (type) {
    case "EXECUTION":
      return {
        bg: "bg-green-100 dark:bg-green-900/30",
        icon: (
          <FaPlay className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
        ),
      };
    case "BOARD_MOVE":
      return {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        icon: (
          <FaLayerGroup className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
        ),
      };
    case "CASE_LINKED":
    case "CASE_UNLINKED":
      return {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        icon: (
          <FaLink className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
        ),
      };
    case "ASSIGNED":
    case "UNASSIGNED":
      return {
        bg: "bg-indigo-100 dark:bg-indigo-900/30",
        icon: (
          <FaUser className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
        ),
      };
    case "COMMENT":
      return {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        icon: (
          <FaComment className="w-2.5 h-2.5 text-yellow-600 dark:text-yellow-400" />
        ),
      };
    case "SPRINT_STATUS":
    case "SPRINT_EDITED":
      return {
        bg: "bg-orange-100 dark:bg-orange-900/30",
        icon: (
          <FaEdit className="w-2.5 h-2.5 text-orange-600 dark:text-orange-400" />
        ),
      };
    default:
      return {
        bg: "bg-gray-100 dark:bg-gray-800",
        icon: <FaHistory className="w-2.5 h-2.5 text-gray-500" />,
      };
  }
}

function detailColor(detail: string): string {
  if (detail.includes("passed")) return "text-green-600 dark:text-green-400";
  if (detail.includes("failed")) return "text-red-600 dark:text-red-400";
  return "text-gray-500 dark:text-gray-400";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  sprintId: number;
}

export function ActivityFeed({ sprintId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get(`/api/sprints/${sprintId}/activity`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!cancelled) {
          const data = res.data?.data ?? [];
          setEvents(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sprintId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400">
        <FaSpinner className="animate-spin w-4 h-4 mr-2" /> Loading activity…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic text-center py-8">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
        Recent Activity
      </p>
      <div className="relative">
        {/* Timeline spine */}
        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-4">
          {events.map((ev) => {
            const { bg, icon } = iconForType(ev.type);
            return (
              <div key={ev.id} className="flex gap-3 relative">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-white dark:border-gray-900 ${bg}`}
                >
                  {icon}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {ev.title}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 leading-relaxed ${detailColor(ev.detail)}`}
                      >
                        {ev.detail}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap">
                      {timeAgo(ev.timestamp)}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <FaUser className="w-2 h-2" />
                    {ev.actor}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
