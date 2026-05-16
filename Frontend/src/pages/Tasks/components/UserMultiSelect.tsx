import { useState, useEffect, useRef } from "react";
import { FaChevronDown, FaCheck } from "react-icons/fa";
import { User } from "../types";

interface Props {
  label: string;
  users: User[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

export default function UserMultiSelect({ label, users, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: number) => {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };

  const selectedNames = users
    .filter((u) => selected.includes(u.id))
    .map((u) => u.username)
    .join(", ");

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label}
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2
                   border border-gray-200 dark:border-gray-700 rounded-lg
                   bg-white dark:bg-gray-800
                   text-sm text-left
                   focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20
                   transition-colors duration-150"
      >
        <span className={`truncate ${selected.length === 0 ? "text-gray-400" : "text-gray-900 dark:text-white"}`}>
          {selected.length === 0 ? `Select ${label}` : selectedNames}
        </span>
        <FaChevronDown
          className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1
                        bg-white dark:bg-gray-800
                        border border-gray-200 dark:border-gray-700
                        rounded-lg shadow-lg
                        max-h-48 overflow-y-auto">
          {users.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">No users available.</p>
          ) : (
            users.map((u) => {
              const isSelected = selected.includes(u.id);
              return (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer
                             hover:bg-gray-50 dark:hover:bg-gray-700/60
                             transition-colors duration-100"
                >
                  {/* Custom checkbox */}
                  <span
                    className={`w-4 h-4 flex-shrink-0 flex items-center justify-center rounded
                                border transition-colors duration-150
                                ${isSelected
                                  ? "bg-brand-600 border-brand-600"
                                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                                }`}
                  >
                    {isSelected && <FaCheck className="w-2.5 h-2.5 text-white" />}
                  </span>

                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(u.id)}
                    className="sr-only"
                  />

                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">
                      {u.username}
                    </p>
                    {u.email && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {u.email}
                      </p>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}