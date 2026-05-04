import { useEffect, useState } from "react";
import API from "../../services/api";
import TaskStatCard from "./TaskStatCard";

// ─── Icons ────────────────────────────────────────────────────────────────────
const TotalIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const PendingIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
  </svg>
);
const InProgressIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);
const CompletedIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const OnHoldIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
);
const CancelledIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────
type StatsData = {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  on_hold: number;
  cancelled: number;
};

// ─── Card config — colors tuned for BOTH light and dark backgrounds ───────────
const CARD_CONFIG = [
  {
    key:          "total" as keyof StatsData,
    label:        "Total",
    filterStatus: undefined,
    icon:         <TotalIcon />,
    accentColor:  "rgb(59, 130, 246)",     // blue-500 — vivid on white, visible on dark
    accentBg:     "rgba(59,130,246,0.09)",
    accentBorder: "rgba(59,130,246,0.22)",
  },
  {
    key:          "pending" as keyof StatsData,
    label:        "Pending",
    filterStatus: "Pending",
    icon:         <PendingIcon />,
    accentColor:  "rgb(217, 119, 6)",      // amber-600
    accentBg:     "rgba(217,119,6,0.09)",
    accentBorder: "rgba(217,119,6,0.22)",
  },
  {
    key:          "in_progress" as keyof StatsData,
    label:        "In Progress",
    filterStatus: "In Progress",
    icon:         <InProgressIcon />,
    accentColor:  "rgb(99, 102, 241)",     // indigo-500
    accentBg:     "rgba(99,102,241,0.09)",
    accentBorder: "rgba(99,102,241,0.22)",
  },
  {
    key:          "completed" as keyof StatsData,
    label:        "Completed",
    filterStatus: "Completed",
    icon:         <CompletedIcon />,
    accentColor:  "rgb(22, 163, 74)",      // green-600
    accentBg:     "rgba(22,163,74,0.09)",
    accentBorder: "rgba(22,163,74,0.22)",
  },
  {
    key:          "on_hold" as keyof StatsData,
    label:        "On Hold",
    filterStatus: "On Hold",
    icon:         <OnHoldIcon />,
    accentColor:  "rgb(124, 58, 237)",     // violet-600
    accentBg:     "rgba(124,58,237,0.09)",
    accentBorder: "rgba(124,58,237,0.22)",
  },
  {
    key:          "cancelled" as keyof StatsData,
    label:        "Cancelled",
    filterStatus: "Cancelled",
    icon:         <CancelledIcon />,
    accentColor:  "rgb(220, 38, 38)",      // red-600
    accentBg:     "rgba(220,38,38,0.09)",
    accentBorder: "rgba(220,38,38,0.22)",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
const TaskDashboardStats: React.FC = () => {
  const [stats,      setStats]      = useState<StatsData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [isDeptHead, setIsDeptHead] = useState(false);
  const [deptName,   setDeptName]   = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await API.get("/api/tasks/dashboard-stats");
        setStats(res.data.data);
        setIsDeptHead(res.data.is_dept_head);
        setDeptName(res.data.dept_name);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load stats");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <>
      {/* CSS variables scoped here — adapt automatically to light/dark */}
      <style>{`
        .tds-wrapper {
          /* Light mode */
          --card-bg: #ffffff;
          --card-bg-hover: #f8faff;
          --card-border: #e5eaf3;
          --card-border-hover: #c7d4ec;
          --card-shadow: rgba(60,80,140,0.12);
          --card-divider: #eef1f8;
          --text-primary: #1a2540;
          --text-secondary: #64748b;
          --text-muted: #94a3b8;
          --skeleton-bg: #e8edf5;
          --badge-bg: rgba(99,102,241,0.08);
          --badge-color: rgb(99,102,241);
          --badge-border: rgba(99,102,241,0.2);
          --error-bg: rgba(220,38,38,0.07);
          --error-border: rgba(220,38,38,0.2);
          --error-color: rgb(185,28,28);
        }

        /* Dark mode — triggered by Tailwind's dark class on <html> */
        .dark .tds-wrapper {
          --card-bg: rgba(255,255,255,0.04);
          --card-bg-hover: rgba(255,255,255,0.07);
          --card-border: rgba(255,255,255,0.08);
          --card-border-hover: rgba(255,255,255,0.15);
          --card-shadow: rgba(0,0,0,0.3);
          --card-divider: rgba(255,255,255,0.07);
          --text-primary: #e2eaf8;
          --text-secondary: #94a8c8;
          --text-muted: rgba(148,172,215,0.55);
          --skeleton-bg: rgba(255,255,255,0.08);
          --badge-bg: rgba(107,143,212,0.13);
          --badge-color: rgb(139,178,235);
          --badge-border: rgba(107,143,212,0.28);
          --error-bg: rgba(226,102,90,0.1);
          --error-border: rgba(226,102,90,0.25);
          --error-color: rgb(226,102,90);
        }

        .tds-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .tds-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }
        .tds-title {
          font-size: 17px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 4px;
          letter-spacing: -0.2px;
        }
        .tds-subtitle {
          font-size: 12.5px;
          color: var(--text-muted);
          margin: 0;
        }
        .tds-dept-badge {
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 20px;
          background: var(--badge-bg);
          color: var(--badge-color);
          border: 1px solid var(--badge-border);
          white-space: nowrap;
          letter-spacing: 0.02em;
        }
        .tds-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 10px;
          background: var(--error-bg);
          border: 1px solid var(--error-border);
          color: var(--error-color);
          font-size: 13px;
        }
        .tds-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
        }
        .tds-grid > * {
          flex: 1 1 160px;
          min-width: 0;
          max-width: 100%;
        }
      `}</style>

      <div className="tds-wrapper">
        {/* Header */}
        <div className="tds-header">
          <div>
            <h2 className="tds-title">Task Overview</h2>
            <p className="tds-subtitle">
              {isDeptHead && deptName
                ? `Showing all tasks across your department — ${deptName}`
                : "Showing tasks created by or assigned to you"}
            </p>
          </div>
          {isDeptHead && (
            <span className="tds-dept-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 5 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Department Head View
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="tds-error">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Cards */}
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
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default TaskDashboardStats;