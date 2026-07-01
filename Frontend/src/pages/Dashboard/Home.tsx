import { useEffect, useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import TaskDashboardStats from "../../components/taskstats/TaskDashboardStats";
import DashboardKPIRow from "../../components/dashboard/DashboardKPIRow";
import DashboardSprintPanel from "../../components/dashboard/DashboardSprintPanel";
import DashboardActivityFeed from "../../components/dashboard/DashboardActivityFeed";
import DashboardSuiteCoverage from "../../components/dashboard/DashboardSuiteCoverage";
import DashboardQuickAccess from "../../components/dashboard/DashboardQuickAccess";
import API from "../../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type PWStats = {
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  aborted_runs: number;
  avg_duration_ms: number | null;
};

type ActiveSprintId = number | undefined;

export default function Home() {
  const [pwStats,        setPwStats]        = useState<PWStats | null>(null);
  const [pwLoading,      setPwLoading]      = useState(true);
  const [activeSprintId, setActiveSprintId] = useState<ActiveSprintId>(undefined);

  useEffect(() => {
    // Playwright global stats
    API.get("/api/playwright/stats")
      .then(res => setPwStats(res.data.data))
      .catch(() => {})
      .finally(() => setPwLoading(false));

    // Grab the first active sprint id for coverage + activity panels
    API.get("/api/sprints")
      .then(res => {
        const sprints = res.data.data || [];
        const active = sprints.find((s: any) => s.status === "Active");
        if (active) setActiveSprintId(active.id);
        else if (sprints.length > 0) setActiveSprintId(sprints[0].id);
      })
      .catch(() => {});
  }, []);

  const passRate =
    pwStats && pwStats.total_runs > 0
      ? Math.round((pwStats.passed_runs / pwStats.total_runs) * 100)
      : 0;

  const avgSec =
    pwStats?.avg_duration_ms != null
      ? (pwStats.avg_duration_ms / 1000).toFixed(1)
      : "—";

  const kpiItems = [
    {
      label: "Total runs",
      value: (pwStats?.total_runs ?? 0).toLocaleString(),
      sub: "All time",
      accentColor: "rgb(59,130,246)",
      sparkData: [22, 38, 31, 52, 47, 68, 74],
    },
    {
      label: "Pass rate",
      value: `${passRate}%`,
      trend: { value: 4, direction: "up" as const },
      accentColor: "rgb(22,163,74)",
      sparkData: [60, 65, 58, 70, 72, 75, passRate],
    },
    {
      label: "Failed runs",
      value: (pwStats?.failed_runs ?? 0).toLocaleString(),
      trend: { value: -2, direction: "down" as const },
      accentColor: "rgb(220,38,38)",
      sparkData: [18, 14, 20, 12, 15, 11, pwStats?.failed_runs ?? 0],
    },
    {
      label: "Avg run time",
      value: `${avgSec}s`,
      sub: "Per test",
      accentColor: "rgb(217,119,6)",
      sparkData: [3.1, 4.2, 3.8, 5.0, 4.5, 4.8, Number(avgSec) || 0],
    },
  ];

  return (
    <div>
      <PageMeta title="TCM — Dashboard" description="Test Case Manager" />
      <PageBreadcrumb pageTitle="Dashboard" />

      <style>{`
        .home-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        /* Section card — consistent container */
        .home-section {
          background: var(--hs-bg, #ffffff);
          border: 0.5px solid var(--hs-border, rgba(0,0,0,0.08));
          border-radius: 16px;
          padding: 24px;
        }
        .dark .home-section {
          --hs-bg: rgba(255,255,255,0.025);
          --hs-border: rgba(255,255,255,0.07);
        }
        .home-row-2 {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 20px;
        }
        .home-row-3 {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 1100px) {
          .home-row-3 { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 900px) {
          .home-row-2, .home-row-3 { grid-template-columns: 1fr; }
        }
        /* Section header inside a plain section */
        .home-sec-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted, #94a3b8);
          margin-bottom: 18px;
        }
        .home-divider {
          border: none;
          border-top: 0.5px solid rgba(0,0,0,0.06);
          margin: 0;
        }
        .dark .home-divider { border-top-color: rgba(255,255,255,0.06); }
      `}</style>

      <div className="home-layout">
        {/* ── Row 4: Quick access ───────────────────────── */}
        {/* <DashboardQuickAccess />   */}

        {/* ── Row 1: Playwright KPIs ─────────────────────── */}
        <DashboardKPIRow items={kpiItems} loading={pwLoading} />

        {/* ── Row 2: Task stats ──────────────────────────── */}
        <div>
          <TaskDashboardStats />
        </div>

        {/* ── Row 3: Sprints + Coverage + Activity ─────── */}
        <div className="home-row-3">
          <DashboardSprintPanel />
          <DashboardSuiteCoverage sprintId={activeSprintId} />
          <DashboardActivityFeed sprintId={activeSprintId} maxItems={6} />
        </div>

        
        

      </div>
    </div>
  );
}