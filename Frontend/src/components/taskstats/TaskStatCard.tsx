import React from "react";
import { Link } from "react-router";

export type TaskStatCardProps = {
  label: string;
  count: number;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  filterStatus?: string;
  loading?: boolean;
};

const TaskStatCard: React.FC<TaskStatCardProps> = ({
  label,
  count,
  icon,
  accentColor,
  accentBg,
  accentBorder,
  filterStatus,
  loading = false,
}) => {
  const href = filterStatus
    ? `/tasks?status=${encodeURIComponent(filterStatus)}`
    : "/tasks";

  return (
    <Link to={href} className="task-stat-card" data-accent={accentColor}>
      <style>{`
        .task-stat-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
          cursor: pointer;
          overflow: hidden;
        }
        .task-stat-card:hover {
          transform: translateY(-3px);
          background: var(--card-bg-hover);
          border-color: var(--card-border-hover);
          box-shadow: 0 12px 32px var(--card-shadow);
        }
        .task-stat-card .accent-line {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: 14px 14px 0 0;
          opacity: 0.75;
        }
        .task-stat-card .top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }
        .task-stat-card .icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid;
        }
        .task-stat-card .label-pill {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border: 1px solid;
        }
        .task-stat-card .count-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .task-stat-card .count {
          font-size: 36px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -1px;
          font-variant-numeric: tabular-nums;
        }
        .task-stat-card .skeleton {
          width: 56px;
          height: 36px;
          border-radius: 6px;
          background: var(--skeleton-bg);
          animation: shimmer 1.6s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .task-stat-card .bottom-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 2px;
          border-top: 1px solid var(--card-divider);
        }
        .task-stat-card .view-label {
          font-size: 11.5px;
          font-weight: 500;
          color: var(--text-muted);
          letter-spacing: 0.01em;
        }
        .task-stat-card .arrow-icon {
          color: var(--text-muted);
          transition: transform 0.18s ease, color 0.18s ease;
        }
        .task-stat-card:hover .arrow-icon {
          transform: translateX(3px);
        }
      `}</style>

      {/* Top accent line */}
      <div className="accent-line" style={{ background: accentColor }} />

      {/* Icon + label pill */}
      <div className="top-row">
        <div
          className="icon-wrap"
          style={{
            background: accentBg,
            borderColor: accentBorder,
            color: accentColor,
          }}
        >
          {icon}
        </div>
        <span
          className="label-pill"
          style={{
            background: accentBg,
            color: accentColor,
            borderColor: accentBorder,
          }}
        >
          {label}
        </span>
      </div>

      {/* Count */}
      <div className="count-row">
        {loading ? (
          <div className="skeleton" />
        ) : (
          <span className="count" style={{ color: accentColor }}>
            {count}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="bottom-row">
        <span className="view-label">View tasks</span>
        <svg
          className="arrow-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </Link>
  );
};

export default TaskStatCard;