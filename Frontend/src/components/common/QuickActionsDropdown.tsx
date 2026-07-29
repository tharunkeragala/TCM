import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Grid2x2,
  LayoutDashboard,
  KanbanSquare,
  FileCheck2,
  CircleDot,
  Play,
  FolderKanban,
  ListTodo,
 LayoutGrid,
  History,
  X,
} from "lucide-react";
import { Dropdown } from "../ui/dropdown/Dropdown";

const ITEMS = [
  {
    label: "Dashboard",
    to: "/home",
    color: "#2563EB",
    icon: <LayoutDashboard size={18} strokeWidth={2} />,
  },
  {
    label: "Sprints",
    to: "/sprints",
    color: "#6366F1",
    icon: <KanbanSquare size={18} strokeWidth={2} />,
  },
  {
    label: "Cases",
    to: "/test-cases",
    color: "#3B82F6",
    icon: <FileCheck2 size={18} strokeWidth={2} />,
  },
  {
    label: "Record",
    to: "/playwright/recorder",
    color: "#EF4444",
    icon: <CircleDot size={18} strokeWidth={2} />,
  },
  {
    label: "Run",
    to: "/playwright",
    color: "#22C55E",
    icon: <Play size={18} strokeWidth={2} />,
  },
  {
    label: "Projects",
    to: "/projects",
    color: "#F59E0B",
    icon: <FolderKanban size={18} strokeWidth={2} />,
  },
  {
    label: "Tasks",
    to: "/tasks",
    color: "#8B5CF6",
    icon: <ListTodo size={18} strokeWidth={2} />,
  },
  {
    label: "Suites",
    to: "/test-suites",
    color: "#06B6D4",
    icon: <LayoutGrid size={18} strokeWidth={2} />,
  },
  {
    label: "Audit",
    to: "/audit",
    color: "#94A3B8",
    icon: <History size={18} strokeWidth={2} />,
  },
];

export default function QuickActionsDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  const closeDropdown = () => setIsOpen(false);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        aria-label="Quick Actions"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.09)",
          color: "rgba(148,172,215,0.65)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.09)";
          e.currentTarget.style.color = "rgba(190,215,255,0.85)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          e.currentTarget.style.color = "rgba(148,172,215,0.65)";
        }}
      >
        <Grid2x2 size={19} strokeWidth={2} />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] w-[290px] rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-700">
          <div>
            <h5 className="text-sm font-semibold text-gray-800 dark:text-white">
              Quick Actions
            </h5>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              Jump to a page
            </p>
          </div>

          <button
            onClick={closeDropdown}
            className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-2">
          {ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={closeDropdown}
              className="group rounded-xl p-2 transition-all duration-150 hover:bg-gray-100 dark:hover:bg-white/5"
            >
              <div className="flex flex-col items-center">
                <div
                  className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-105"
                  style={{
                    background: `${item.color}18`,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </div>

                <span className="text-[11px] font-medium leading-tight text-center text-gray-700 dark:text-gray-300">
                  {item.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Dropdown>
    </div>
  );
}
