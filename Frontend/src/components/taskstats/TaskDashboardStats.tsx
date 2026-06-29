import { useEffect, useState } from "react";
import API from "../../services/api";
import TaskStatCard from "./TaskStatCard";

const TotalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const PendingIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
  </svg>
);
const InProgressIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);
const CompletedIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const OnHoldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
);
const CancelledIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);
const DeptIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

type StatsData = {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  on_hold: number;
  cancelled: number;
};

const CARD_CONFIG = [
  { key: "total" as keyof StatsData, label: "Total", filterStatus: undefined, icon: <TotalIcon />, accentColor: "rgb(59,130,246)", accentBg: "rgba(59,130,246,0.08)", accentBorder: "rgba(59,130,246,0.2)", trend: { value: 0, label: "All tasks" } },
  { key: "pending" as keyof StatsData, label: "Pending", filterStatus: "Pending", icon: <PendingIcon />, accentColor: "rgb(217,119,6)", accentBg: "rgba(217,119,6,0.08)", accentBorder: "rgba(217,119,6,0.2)", trend: { value: 0, label: "Awaiting start" } },
  { key: "in_progress" as keyof StatsData, label: "In Progress", filterStatus: "In Progress", icon: <InProgressIcon />, accentColor: "rgb(99,102,241)", accentBg: "rgba(99,102,241,0.08)", accentBorder: "rgba(99,102,241,0.2)", trend: { value: 0, label: "Currently active" } },
  { key: "completed" as keyof StatsData, label: "Completed", filterStatus: "Completed", icon: <CompletedIcon />, accentColor: "rgb(22,163,74)", accentBg: "rgba(22,163,74,0.08)", accentBorder: "rgba(22,163,74,0.2)", trend: { value: 0, label: "Done" } },
  { key: "on_hold" as keyof StatsData, label: "On Hold", filterStatus: "On Hold", icon: <OnHoldIcon />, accentColor: "rgb(124,58,237)", accentBg: "rgba(124,58,237,0.08)", accentBorder: "rgba(124,58,237,0.2)", trend: { value: 0, label: "Paused" } },
  { key: "cancelled" as keyof StatsData, label: "Cancelled", filterStatus: "Cancelled", icon: <CancelledIcon />, accentColor: "rgb(220,38,38)", accentBg: "rgba(220,38,38,0.08)", accentBorder: "rgba(220,38,38,0.2)", trend: { value: 0, label: "Dropped" } },
];

const TaskDashboardStats: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeptHead, setIsDeptHead] = useState(false);
  const [deptName, setDeptName] = useState<string | null>(null);

  useEffect(() => {
    API.get("/api/tasks/dashboard-stats")
      .then((res) => {
        setStats(res.data.data);
        setIsDeptHead(res.data.is_dept_head);
        setDeptName(res.data.dept_name);
      })
      .catch((err: any) => setError(err?.response?.data?.message || "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  const completionRate =
    stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="tds-card">
      <style>{`
      .tds-card {
        background: #ffffff;
        border: 1px solid rgba(15,23,42,0.08);
        border-radius: 14px;
        padding: 18px;
      }
      .dark .tds-card {
        background: #0b1220;
        border-color: rgba(148,163,184,0.14);
      }
        .tds-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .tds-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #64748b;
        }
        .dark .tds-title { color: #94a3b8; }
        .tds-scope {
          font-size: 11.5px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .tds-dept-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 999px;
          background: rgba(99,102,241,0.08);
          color: rgb(99,102,241);
          border: 1px solid rgba(99,102,241,0.2);
        }
        .tds-hr {
          border: none;
          height: 1px;
          background: rgba(15,23,42,0.06);
          margin: 10px 0 14px;
        }
        .dark .tds-hr { background: rgba(148,163,184,0.12); }
        .tds-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 9px;
          background: rgba(220,38,38,0.06);
          border: 1px solid rgba(220,38,38,0.18);
          color: rgb(185,28,28);
          font-size: 12.5px;
          margin-bottom: 12px;
        }
        .dark .tds-error { color: rgb(252,165,165); }
        .tds-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
        }
        @media (max-width: 1280px) { .tds-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px)  { .tds-grid { grid-template-columns: repeat(2, 1fr); } }
        .tds-rate-bar {
          margin-top: 12px;
          padding: 11px 14px;
          background: rgba(15,23,42,0.02);
          border: 1px solid rgba(15,23,42,0.06);
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .dark .tds-rate-bar {
          background: rgba(255,255,255,0.02);
          border-color: rgba(148,163,184,0.1);
        }
        .tds-rate-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #94a3b8;
          white-space: nowrap;
          min-width: 100px;
        }
        .tds-rate-track {
          flex: 1;
          height: 5px;
          background: rgba(15,23,42,0.06);
          border-radius: 3px;
          overflow: hidden;
        }
        .dark .tds-rate-track { background: rgba(148,163,184,0.12); }
        .tds-rate-fill {
          height: 100%;
          border-radius: 3px;
          background: rgb(22,163,74);
          transition: width 0.5s ease;
        }
        .tds-rate-pct {
          font-size: 12.5px;
          font-weight: 600;
          color: rgb(22,163,74);
          min-width: 34px;
          text-align: right;
        }
      `}</style>

      <div className="tds-header">
        <div>
          <div className="tds-title">Task Overview</div>
          <div className="tds-scope">
            {isDeptHead && deptName ? `Department view — ${deptName}` : "Your tasks and assignments"}
          </div>
        </div>
        {isDeptHead && (
          <span className="tds-dept-badge">
            <DeptIcon />
            Department head
          </span>
        )}
      </div>

      <hr className="tds-hr" />

      {error && (
        <div className="tds-error">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <div className="tds-grid">
        {CARD_CONFIG.map((cfg) => (
          <TaskStatCard
            key={cfg.key}
            label={cfg.label}
            count={stats?.[cfg.key] ?? 0}
            icon={cfg.icon}
            accentColor={cfg.accentColor}
            accentBg={cfg.accentBg}
            accentBorder={cfg.accentBorder}
            filterStatus={cfg.filterStatus}
            loading={loading}
            trend={cfg.trend}
          />
        ))}
      </div>

      {!loading && stats && stats.total > 0 && (
        <div className="tds-rate-bar">
          <span className="tds-rate-label">Completion rate</span>
          <div className="tds-rate-track">
            <div className="tds-rate-fill" style={{ width: `${completionRate}%` }} />
          </div>
          <span className="tds-rate-pct">{completionRate}%</span>
        </div>
      )}
    </div>
  );
};

export default TaskDashboardStats;