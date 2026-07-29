import React from "react";
import { Link } from "react-router-dom";

type QuickItem = {
  label: string;
  to: string;
  accentColor: string;
  icon: React.ReactNode;
};

const ITEMS: QuickItem[] = [
  {
    label: "Sprint board",
    to: "/sprints",
    accentColor: "rgb(99,102,241)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/>
      </svg>
    ),
  },
  {
    label: "Test cases",
    to: "/test-cases",
    accentColor: "rgb(59,130,246)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    label: "Record test",
    to: "/playwright/recorder",
    accentColor: "rgb(220,38,38)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    label: "Run tests",
    to: "/playwright",
    accentColor: "rgb(22,163,74)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    ),
  },
  {
    label: "Tasks",
    to: "/tasks",
    accentColor: "rgb(124,58,237)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    label: "Projects",
    to: "/projects",
    accentColor: "rgb(217,119,6)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    label: "Test suites",
    to: "/test-suites",
    accentColor: "rgb(14,165,233)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: "Audit log",
    to: "/audit",
    accentColor: "rgb(100,116,139)",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
];

const DashboardQuickAccess: React.FC = () => (
  <>
    <style>{`
      .dqa-bar {
        display: flex;
        align-items: center;
        gap: 4px;
        background: var(--dqa-bg, #fff);
        border: 0.5px solid rgba(0,0,0,0.08);
        border-radius: 14px;
        padding: 10px 16px;
        flex-wrap: wrap;
      }
      .dark .dqa-bar {
        background: rgba(255,255,255,0.04);
        border-color: rgba(255,255,255,0.07);
      }
      .dqa-label-head {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--text-muted, #94a3b8);
        margin-right: 8px;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .dqa-sep {
        width: 0.5px;
        height: 20px;
        background: rgba(0,0,0,0.1);
        margin: 0 6px;
        flex-shrink: 0;
      }
      .dark .dqa-sep { background: rgba(255,255,255,0.1); }
      .dqa-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 8px;
        text-decoration: none;
        font-size: 12.5px;
        font-weight: 500;
        color: var(--text-secondary, #475569);
        transition: background 0.14s, color 0.14s;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .dark .dqa-item { color: #94a3b8; }
      .dqa-item:hover {
        background: var(--dqa-hover, rgba(0,0,0,0.05));
        color: var(--dqa-hover-color);
      }
      .dark .dqa-item:hover { background: rgba(255,255,255,0.07); }
      .dqa-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        opacity: 0.7;
        transition: opacity 0.14s;
      }
      .dqa-item:hover .dqa-icon { opacity: 1; }
    `}</style>

    <div className="dqa-bar">
      <span className="dqa-label-head">Quick access</span>
      <div className="dqa-sep" />
      {ITEMS.map((item) => (
        <Link
          key={item.to + item.label}
          to={item.to}
          className="dqa-item"
          style={{
            "--dqa-hover": `${item.accentColor}14`,
            "--dqa-hover-color": item.accentColor,
          } as React.CSSProperties}
        >
          <span className="dqa-icon" style={{ color: item.accentColor }}>
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </div>
  </>
);

export default DashboardQuickAccess;
