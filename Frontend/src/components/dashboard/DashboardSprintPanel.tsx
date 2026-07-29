import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../../services/api";

type Sprint = {
  id: number;
  sprint_name: string;
  status: "Planned" | "Active" | "Completed";
  project_name: string;
  suite_count: number;
  case_count: number;
  start_date: string | null;
  end_date: string | null;
};

const STATUS_CONFIG = {
  Active: {
    color: "rgb(22,163,74)",
    bg: "rgba(22,163,74,0.12)",
    border: "rgba(22,163,74,0.25)",
  },
  Planned: {
    color: "rgb(217,119,6)",
    bg: "rgba(217,119,6,0.12)",
    border: "rgba(217,119,6,0.25)",
  },
  Completed: {
    color: "rgb(59,130,246)",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.25)",
  },
};

function daysLeft(endDate: string | null): string {
  if (!endDate) return "—";
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Due today";
  return `${diff}d left`;
}

const DashboardSprintPanel: React.FC = () => {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/api/sprints")
      .then((res) => {
        const data: Sprint[] = res.data.data || [];
        setSprints(data.filter((s) => s.status !== "Completed").slice(0, 4));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ds-card">
      <style>{`
        .ds-card {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 14px;
          padding: 18px;
        }

        .dark .ds-card {
          background: #0b1220;
          border-color: rgba(148, 163, 184, 0.14);
        }

        /* HEADER */
        .ds-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ds-title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #64748b;
        }

        .dark .ds-title {
          color: #94a3b8;
        }

        .ds-link {
          font-size: 12px;
          color: #6366f1;
          font-weight: 500;
          text-decoration: none;
        }

        .ds-link:hover {
          text-decoration: underline;
        }

        .ds-hr {
          border: none;
          height: 1px;
          background: rgba(15, 23, 42, 0.06);
          margin: 10px 0 14px;
        }

        .dark .ds-hr {
          background: rgba(148,163,184,0.12);
        }

        /* ITEMS */
        .ds-item {
          display: flex;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }

        .dark .ds-item {
          border-bottom-color: rgba(148,163,184,0.10);
        }

        .ds-item:last-child {
          border-bottom: none;
        }

        .ds-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 6px;
          flex-shrink: 0;
        }

        .ds-body {
          flex: 1;
          min-width: 0;
        }

        .ds-name {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dark .ds-name {
          color: #f1f5f9;
        }

        .ds-meta {
          font-size: 11.5px;
          color: #64748b;
          margin-top: 2px;
        }

        /* PROGRESS */
        .ds-track {
          margin-top: 8px;
          height: 6px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.06);
          overflow: hidden;
        }

        .dark .ds-track {
          background: rgba(148,163,184,0.12);
        }

        .ds-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.4s ease;
        }

        /* RIGHT SIDE */
        .ds-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        .ds-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid;
        }

        .ds-days {
          font-size: 11px;
          color: #64748b;
        }

        /* STATES */
        .ds-empty {
          text-align: center;
          padding: 24px 0;
          font-size: 13px;
          color: #94a3b8;
        }

        .ds-skeleton {
          height: 52px;
          border-radius: 10px;
          background: rgba(148,163,184,0.12);
          margin-top: 10px;
          animation: pulse 1.4s ease-in-out infinite;
        }

        @keyframes pulse {
          0%,100% { opacity: .4; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* HEADER */}
      <div className="ds-header">
        <span className="ds-title">Active Sprints</span>
        <Link to="/sprints" className="ds-link">
          View all →
        </Link>
      </div>

      <hr className="ds-hr" />

      {/* BODY */}
      {loading ? (
        <>
          <div className="ds-skeleton" />
          <div className="ds-skeleton" />
          <div className="ds-skeleton" />
        </>
      ) : sprints.length === 0 ? (
        <div className="ds-empty">No active sprints</div>
      ) : (
        sprints.map((sprint) => {
          const cfg = STATUS_CONFIG[sprint.status];

          let pct =
            sprint.status === "Active"
              ? 55
              : sprint.status === "Planned"
              ? 10
              : 100;

          if (sprint.start_date && sprint.end_date) {
            const total =
              new Date(sprint.end_date).getTime() -
              new Date(sprint.start_date).getTime();

            const elapsed =
              Date.now() - new Date(sprint.start_date).getTime();

            pct = Math.min(
              100,
              Math.max(0, Math.round((elapsed / total) * 100))
            );
          }

          return (
            <div className="ds-item" key={sprint.id}>
              <span className="ds-dot" style={{ background: cfg.color }} />

              <div className="ds-body">
                <div className="ds-name">{sprint.sprint_name}</div>
                <div className="ds-meta">
                  {sprint.project_name} · {sprint.suite_count} suites ·{" "}
                  {sprint.case_count} cases
                </div>

                <div className="ds-track">
                  <div
                    className="ds-fill"
                    style={{
                      width: `${pct}%`,
                      background: cfg.color,
                    }}
                  />
                </div>
              </div>

              <div className="ds-right">
                <span
                  className="ds-badge"
                  style={{
                    color: cfg.color,
                    background: cfg.bg,
                    borderColor: cfg.border,
                  }}
                >
                  {sprint.status}
                </span>
                <span className="ds-days">{daysLeft(sprint.end_date)}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default DashboardSprintPanel;
