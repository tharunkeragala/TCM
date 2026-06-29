import React, { useEffect, useState } from "react";
import API from "../../services/api";

type ActivityEvent = {
  id: string;
  type: string;
  actor: string;
  title: string;
  detail: string;
  timestamp: string;
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  EXECUTION: {
    color: "rgb(59,130,246)",
    bg: "rgba(59,130,246,0.1)",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  BOARD_MOVE: {
    color: "rgb(99,102,241)",
    bg: "rgba(99,102,241,0.1)",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <polyline points="5 12 19 12" /><polyline points="12 5 19 12 12 19" />
      </svg>
    ),
  },
  CASE_LINKED: {
    color: "rgb(22,163,74)",
    bg: "rgba(22,163,74,0.1)",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  DEFAULT: {
    color: "rgb(100,116,139)",
    bg: "rgba(100,116,139,0.1)",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
};

function getCfg(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.DEFAULT;
}

type Props = { sprintId?: number; maxItems?: number };

const DashboardActivityFeed: React.FC<Props> = ({ sprintId, maxItems = 6 }) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = sprintId ? `/api/sprints/${sprintId}/activity` : "/api/sprints/1/activity";
    API.get(url)
      .then((res) => setEvents((res.data.data || []).slice(0, maxItems)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sprintId, maxItems]);

  return (
    <div className="daf-card">
      <style>{`
        .daf-card {
          background: #ffffff;
          border: 1px solid rgba(15,23,42,0.08);
          border-radius: 14px;
          padding: 18px;
        }
        .dark .daf-card {
          background: #0b1220;
          border-color: rgba(148,163,184,0.14);
        }
        .daf-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .daf-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #64748b;
        }
        .dark .daf-title { color: #94a3b8; }
        .daf-hr {
          border: none;
          height: 1px;
          background: rgba(15,23,42,0.06);
          margin: 10px 0 14px;
        }
        .dark .daf-hr { background: rgba(148,163,184,0.12); }

        .daf-item {
          display: flex;
          gap: 10px;
          padding: 9px 0;
          border-bottom: 1px solid rgba(15,23,42,0.05);
        }
        .dark .daf-item { border-bottom-color: rgba(148,163,184,0.08); }
        .daf-item:last-child { border-bottom: none; }

        .daf-icon {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .daf-body { flex: 1; min-width: 0; }
        .daf-title-text {
          font-size: 12.5px;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dark .daf-title-text { color: #e2e8f0; }
        .daf-detail {
          font-size: 11.5px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }
        .daf-time {
          font-size: 11px;
          color: #94a3b8;
          flex-shrink: 0;
          margin-top: 3px;
        }
        .daf-avatar {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: rgba(99,102,241,0.12);
          color: rgb(99,102,241);
          font-size: 8px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Skeleton */
        .daf-skeleton { display: flex; gap: 10px; padding: 9px 0; }
        .daf-sk-icon {
          width: 26px; height: 26px; border-radius: 8px;
          background: rgba(148,163,184,0.12);
          animation: daf-pulse 1.4s infinite;
          flex-shrink: 0;
        }
        .daf-sk-line {
          height: 9px;
          background: rgba(148,163,184,0.12);
          border-radius: 5px;
          margin-bottom: 5px;
          animation: daf-pulse 1.4s infinite;
        }
        @keyframes daf-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .daf-empty {
          text-align: center;
          padding: 22px 0;
          font-size: 12.5px;
          color: #94a3b8;
        }
      `}</style>

      <div className="daf-header">
        <span className="daf-title">Recent Activity</span>
      </div>
      <hr className="daf-hr" />

      {loading ? (
        [1, 2, 3, 4].map((i) => (
          <div key={i} className="daf-skeleton">
            <div className="daf-sk-icon" />
            <div style={{ flex: 1 }}>
              <div className="daf-sk-line" style={{ width: "55%" }} />
              <div className="daf-sk-line" style={{ width: "75%" }} />
            </div>
          </div>
        ))
      ) : events.length === 0 ? (
        <div className="daf-empty">No recent activity</div>
      ) : (
        events.map((ev) => {
          const cfg = getCfg(ev.type);
          const initials = ev.actor.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
          return (
            <div className="daf-item" key={ev.id}>
              <div className="daf-icon" style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.icon}
              </div>
              <div className="daf-body">
                <div className="daf-title-text">
                  <span className="daf-avatar">{initials}</span>
                  {ev.title}
                </div>
                <div className="daf-detail">{ev.detail}</div>
              </div>
              <div className="daf-time">{timeAgo(ev.timestamp)}</div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default DashboardActivityFeed;