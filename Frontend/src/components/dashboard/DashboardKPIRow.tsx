import React from "react";

export type KPIItem = {
  label: string;
  value: string | number;
  sub?: string;
  sparkData?: number[];
  accentColor: string;
};

type Props = {
  title?: string;
  items: KPIItem[];
  loading?: boolean;
};

const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "22px" }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            width: "5px",
            borderRadius: "2px",
            height: `${Math.round((v / max) * 100)}%`,
            background: color,
            opacity: i === data.length - 1 ? 1 : 0.18,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
};

const DashboardKPIRow: React.FC<Props> = ({ title = "Overview", items, loading = false }) => (
  <div className="dash-card">
    <style>{`
      .dash-card {
        background: #ffffff;
        border: 1px solid rgba(15,23,42,0.08);
        border-radius: 14px;
        padding: 18px;
      }
      .dark .dash-card {
        background: #0b1220;
        border-color: rgba(148,163,184,0.14);
      }
      .dash-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .dash-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #64748b;
      }
      .dark .dash-title { color: #94a3b8; }
      .dash-hr {
        border: none;
        height: 1px;
        background: rgba(15,23,42,0.06);
        margin: 10px 0 14px;
      }
      .dark .dash-hr { background: rgba(148,163,184,0.12); }

      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }
      @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 480px) { .kpi-grid { grid-template-columns: 1fr; } }

      .kpi-tile {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(15,23,42,0.07);
        border-radius: 12px;
        padding: 14px 16px 12px;
        display: flex;
        flex-direction: column;
        background: rgba(15,23,42,0.015);
      }
      .dark .kpi-tile {
        background: rgba(255,255,255,0.03);
        border-color: rgba(148,163,184,0.1);
      }
      .kpi-tile-accent {
        position: absolute;
        top: 0; left: 0;
        right: 0;
        height: 2px;
        border-radius: 14px 14px 0 0;
      }
      .kpi-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #94a3b8;
        margin-bottom: 6px;
      }
      .kpi-value {
        font-size: 28px;
        font-weight: 600;
        line-height: 1;
        color: #0f172a;
        margin-bottom: 10px;
        letter-spacing: -0.5px;
      }
      .dark .kpi-value { color: #f1f5f9; }
      .kpi-skeleton {
        width: 70px;
        height: 28px;
        border-radius: 6px;
        background: rgba(148,163,184,0.15);
        animation: dash-pulse 1.4s infinite;
        margin-bottom: 10px;
      }
      .kpi-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: auto;
        padding-top: 8px;
        border-top: 1px solid rgba(15,23,42,0.05);
      }
      .dark .kpi-footer { border-top-color: rgba(148,163,184,0.08); }
      .kpi-sub {
        font-size: 11px;
        color: #94a3b8;
      }
      @keyframes dash-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
    `}</style>

    <div className="dash-header">
      <span className="dash-title">{title}</span>
    </div>
    <hr className="dash-hr" />

    <div className="kpi-grid">
      {items.map((item, i) => (
        <div className="kpi-tile" key={i}>
          <div className="kpi-tile-accent" style={{ background: item.accentColor }} />
          <div className="kpi-label">{item.label}</div>
          {loading
            ? <div className="kpi-skeleton" />
            : <div className="kpi-value">{item.value}</div>
          }
          <div className="kpi-footer">
            <span className="kpi-sub">{item.sub ?? ""}</span>
            {item.sparkData && <Sparkline data={item.sparkData} color={item.accentColor} />}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default DashboardKPIRow;