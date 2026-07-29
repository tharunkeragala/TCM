import React from "react";
import { Link } from "react-router-dom";

export type TaskStatCardProps = {
  label: string;
  count: number;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  filterStatus?: string;
  loading?: boolean;
  trend?: { value: number; label: string };
};

const TaskStatCard: React.FC<TaskStatCardProps> = ({
  label, count, icon,
  accentColor, accentBg, accentBorder,
  filterStatus, loading = false, trend,
}) => {
  const href = filterStatus
    ? `/tasks?status=${encodeURIComponent(filterStatus)}`
    : "/tasks";

  return (
    <Link
      to={href}
      className="tsc-card"
      style={{ "--accent": accentColor, "--accent-bg": accentBg, "--accent-border": accentBorder } as React.CSSProperties}
    >
      <style>{`
        .tsc-card {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 14px 16px 12px;
          border: 1px solid rgba(15,23,42,0.07);
          border-radius: 12px;
          background: rgba(15,23,42,0.015);
          text-decoration: none;
          overflow: hidden;
          transition: border-color 0.15s, transform 0.15s;
        }
        .dark .tsc-card {
          background: rgba(255,255,255,0.03);
          border-color: rgba(148,163,184,0.1);
        }
        .tsc-card:hover {
          border-color: var(--accent-border);
          transform: translateY(-1px);
        }
        .tsc-accent-strip {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: var(--accent);
          opacity: 0.7;
          border-radius: 12px 12px 0 0;
        }
        .tsc-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .tsc-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-bg);
          border: 1px solid var(--accent-border);
          color: var(--accent);
        }
        .tsc-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #94a3b8;
        }
        .tsc-count {
          font-size: 30px;
          font-weight: 600;
          line-height: 1;
          letter-spacing: -1px;
          color: #0f172a;
          margin-bottom: 10px;
          font-variant-numeric: tabular-nums;
        }
        .dark .tsc-count { color: #f1f5f9; }
        .tsc-skeleton {
          width: 52px;
          height: 30px;
          border-radius: 6px;
          background: rgba(148,163,184,0.15);
          animation: tsc-pulse 1.4s infinite;
          margin-bottom: 10px;
        }
        @keyframes tsc-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .tsc-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 8px;
          border-top: 1px solid rgba(15,23,42,0.05);
        }
        .dark .tsc-footer { border-top-color: rgba(148,163,184,0.08); }
        .tsc-trend {
          font-size: 11px;
          color: #94a3b8;
        }
        .tsc-arrow {
          color: var(--accent);
          opacity: 0.45;
          transition: opacity 0.12s, transform 0.12s;
        }
        .tsc-card:hover .tsc-arrow {
          opacity: 1;
          transform: translateX(2px);
        }
      `}</style>

      <div className="tsc-accent-strip" />
      <div className="tsc-top">
        <div className="tsc-icon-wrap">{icon}</div>
        <span className="tsc-label">{label}</span>
      </div>

      {loading
        ? <div className="tsc-skeleton" />
        : <div className="tsc-count">{count.toLocaleString()}</div>
      }

      <div className="tsc-footer">
        <span className="tsc-trend">{trend?.label ?? "View all tasks"}</span>
        <svg className="tsc-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </Link>
  );
};

export default TaskStatCard;
