import React, { useEffect, useState } from "react";
import API from "../../services/api";

type SuiteProgress = {
  suiteId: number;
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  pending: number;
  percent: number;
};

function barColor(pct: number): string {
  if (pct >= 70) return "rgb(22,163,74)";
  if (pct >= 40) return "rgb(217,119,6)";
  return "rgb(220,38,38)";
}

type Props = {
  sprintId?: number;
};

const DashboardSuiteCoverage: React.FC<Props> = ({ sprintId }) => {
  const [rows, setRows] = useState<SuiteProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sprintId) {
      setLoading(false);
      return;
    }

    API.get(`/api/sprints/${sprintId}/board`)
      .then(async (boardRes) => {
        const suites = boardRes.data.data || [];

        const results = await Promise.all(
          suites.map(async (s: any) => {
            try {
              const prog = await API.get(
                `/api/sprints/${sprintId}/suites/${s.suite_id}/progress`
              );

              return {
                suiteId: s.suite_id,
                suiteName: s.suite_name,
                total: prog.data.total || 0,
                passed: prog.data.passed || 0,
                failed: prog.data.failed || 0,
                pending: prog.data.pending || 0,
                percent: prog.data.percent || 0,
              };
            } catch {
              return {
                suiteId: s.suite_id,
                suiteName: s.suite_name,
                total: s.case_count || 0,
                passed: 0,
                failed: 0,
                pending: s.case_count || 0,
                percent: 0,
              };
            }
          })
        );

        setRows(results.filter((r) => r.total > 0));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sprintId]);

  const totalCases = rows.reduce((a, r) => a + r.total, 0);
  const totalPassed = rows.reduce((a, r) => a + r.passed, 0);
  const overall =
    totalCases > 0 ? Math.round((totalPassed / totalCases) * 100) : 0;

  return (
    <div className="dsc-card">
      <style>{`
        .dsc-card {
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 14px;
          padding: 18px;
        }

        .dark .dsc-card {
          background: #0b1220;
          border-color: rgba(148,163,184,0.14);
        }

        /* HEADER */
        .dsc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .dsc-title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #64748b;
        }

        .dark .dsc-title {
          color: #94a3b8;
        }

        .dsc-overall {
          font-size: 12px;
          font-weight: 600;
          color: rgb(22,163,74);
        }

        .dsc-hr {
          border: none;
          height: 1px;
          background: rgba(15, 23, 42, 0.06);
          margin: 10px 0 14px;
        }

        .dark .dsc-hr {
          background: rgba(148,163,184,0.12);
        }

        /* ROWS */
        .dsc-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(15, 23, 42, 0.05);
        }

        .dark .dsc-row {
          border-bottom-color: rgba(148,163,184,0.08);
        }

        .dsc-row:last-child {
          border-bottom: none;
        }

        .dsc-name {
          width: 120px;
          font-size: 12.5px;
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dark .dsc-name {
          color: #94a3b8;
        }

        .dsc-track {
          flex: 1;
          height: 7px;
          border-radius: 4px;
          background: rgba(15, 23, 42, 0.06);
          overflow: hidden;
        }

        .dark .dsc-track {
          background: rgba(255,255,255,0.07);
        }

        .dsc-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.4s ease;
        }

        .dsc-pct {
          width: 45px;
          text-align: right;
          font-size: 12px;
          font-weight: 600;
        }

        .dsc-counts {
          width: 60px;
          text-align: right;
          font-size: 11px;
          color: #94a3b8;
        }

        /* SKELETON */
        .dsc-skeleton {
          height: 34px;
          border-radius: 8px;
          background: rgba(0,0,0,0.05);
          animation: shimmer 1.4s infinite ease-in-out;
          margin-bottom: 8px;
        }

        .dark .dsc-skeleton {
          background: rgba(255,255,255,0.05);
        }

        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        /* EMPTY */
        .dsc-empty {
          text-align: center;
          padding: 26px 0;
          font-size: 13px;
          color: #94a3b8;
        }

        /* OVERALL ROW */
        .dsc-overall-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          padding-top: 10px;
        }

        .dsc-label {
          width: 120px;
          font-size: 12px;
          color: #64748b;
        }
      `}</style>

      {/* HEADER */}
      <div className="dsc-header">
        <span className="dsc-title">Suite coverage</span>
        {!loading && rows.length > 0 && (
          <span className="dsc-overall">{overall}% overall</span>
        )}
      </div>

      <hr className="dsc-hr" />

      {/* BODY */}
      {loading ? (
        [1, 2, 3, 4].map((i) => <div key={i} className="dsc-skeleton" />)
      ) : rows.length === 0 ? (
        <div className="dsc-empty">
          {sprintId
            ? "No test cases in this sprint"
            : "Select a sprint to see coverage"}
        </div>
      ) : (
        <>
          {rows.map((r) => {
            const color = barColor(r.percent);

            return (
              <div className="dsc-row" key={r.suiteId}>
                <span className="dsc-name" title={r.suiteName}>
                  {r.suiteName}
                </span>

                <div className="dsc-track">
                  <div
                    className="dsc-fill"
                    style={{ width: `${r.percent}%`, background: color }}
                  />
                </div>

                <span className="dsc-pct" style={{ color }}>
                  {r.percent}%
                </span>

                <span className="dsc-counts">
                  {r.passed}/{r.total}
                </span>
              </div>
            );
          })}

          {/* OVERALL */}
          {rows.length > 1 && (
            <>
              <hr className="dsc-hr" />

              <div className="dsc-overall-row">
                <span className="dsc-label">Overall</span>

                <div className="dsc-track">
                  <div
                    className="dsc-fill"
                    style={{
                      width: `${overall}%`,
                      background: barColor(overall),
                    }}
                  />
                </div>

                <span
                  className="dsc-pct"
                  style={{ color: barColor(overall) }}
                >
                  {overall}%
                </span>

                <span className="dsc-counts">
                  {totalPassed}/{totalCases}
                </span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardSuiteCoverage;