import { useState, useEffect, useRef } from "react";
import { FaChevronDown } from "react-icons/fa";
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
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
      >
        <span className={selected.length === 0 ? "text-gray-400" : ""}>
          {selected.length === 0 ? `Select ${label}` : selectedNames}
        </span>
        <FaChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {users.map((u) => (
            <label
              key={u.id}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
                className="rounded border-gray-300"
              />
              <div>
                <p className="text-sm text-gray-900 dark:text-white">{u.username}</p>
                {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}