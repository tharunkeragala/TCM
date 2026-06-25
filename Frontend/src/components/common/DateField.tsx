import { useEffect, useRef, useState } from "react";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";

export interface DateFieldProps {
  label?: string;
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  min?: string; // "YYYY-MM-DD"
  max?: string; // "YYYY-MM-DD"
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

const toValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseValue = (value: string): Date | null => {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDisplay = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// 6 weeks x 7 days, Monday-start, padded with adjacent-month days
const buildMonthGrid = (year: number, month: number): Date[] => {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from(
    { length: 42 },
    (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
};

export default function DateField({
  label,
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = "Select date",
  className = "",
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);
  const today = new Date();
  const [view, setView] = useState<Date>(selected ?? today);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Reset the visible month to the selected/current date whenever the popover opens
  useEffect(() => {
    if (open) setView(selected ?? today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const isDisabledDay = (d: Date) => {
    const v = toValue(d);
    if (min && v < min) return true;
    if (max && v > max) return true;
    return false;
  };

  const selectDay = (d: Date) => {
    if (isDisabledDay(d)) return;
    onChange(toValue(d));
    setOpen(false);
  };

  const grid = buildMonthGrid(view.getFullYear(), view.getMonth());

  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
          {label}
        </label>
      )}

      <div className="relative" ref={wrapperRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-w-0 disabled:opacity-50 disabled:cursor-not-allowed ${
            selected
              ? "border-blue-400 dark:border-blue-500"
              : "border-gray-300 dark:border-gray-600"
          }`}
        >
          <span
            className={`truncate ${selected ? "" : "text-gray-400 dark:text-gray-500 italic"}`}
          >
            {selected ? formatDisplay(selected) : placeholder}
          </span>
          <FaCalendarAlt className="text-gray-400 dark:text-gray-500 text-xs flex-shrink-0" />
        </button>

        {open && (
          <div
            className="
      absolute z-30 mt-2
      left-0 sm:left-auto sm:right-0
      w-full sm:w-72
      max-w-[calc(100vw-2rem)]
      rounded-lg border border-gray-300 dark:border-gray-600
      bg-white dark:bg-gray-800 shadow-lg p-3
    "
          >
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() =>
                  setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
                }
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Previous month"
              >
                <FaChevronLeft className="text-xs" />
              </button>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() =>
                  setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
                }
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Next month"
              >
                <FaChevronRight className="text-xs" />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="text-[10px] font-medium uppercase text-gray-400 dark:text-gray-500 text-center"
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d, i) => {
                const inMonth = d.getMonth() === view.getMonth();
                const isSelected = selected ? isSameDay(d, selected) : false;
                const isToday = isSameDay(d, today);
                const dayDisabled = isDisabledDay(d);

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={dayDisabled}
                    onClick={() => selectDay(d)}
                    className={`h-8 w-full rounded-md text-xs transition ${
                      isSelected
                        ? "bg-blue-600 text-white font-semibold hover:bg-blue-700"
                        : inMonth
                          ? "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          : "text-gray-300 dark:text-gray-600"
                    } ${isToday && !isSelected ? "ring-1 ring-blue-400 dark:ring-blue-500 font-semibold" : ""} ${
                      dayDisabled
                        ? "opacity-30 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent"
                        : ""
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  if (isDisabledDay(today)) return;
                  onChange(toValue(today));
                  setOpen(false);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
