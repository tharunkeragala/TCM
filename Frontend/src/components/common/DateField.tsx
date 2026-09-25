import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  if (!value) {
    return null;
  }

  const [y, m, d] = value.split("-").map(Number);

  if (!y || !m || !d) {
    return null;
  }

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

/* -------------------------------------------------------------------------- */
/* Calendar month grid                                                        */
/* -------------------------------------------------------------------------- */

const buildMonthGrid = (year: number, month: number): Date[] => {
  const first = new Date(year, month, 1);

  const offset = (first.getDay() + 6) % 7;

  const start = new Date(year, month, 1 - offset);

  return Array.from(
    {
      length: 42,
    },
    (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
};

/* -------------------------------------------------------------------------- */
/* Portal position                                                            */
/* -------------------------------------------------------------------------- */

interface CalendarPosition {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  placement: "top" | "bottom";
}

const calculatePosition = (trigger: HTMLElement): CalendarPosition => {
  const rect = trigger.getBoundingClientRect();

  const calendarWidth = 288; // w-72

  const calendarHeight = 365;

  const gap = 8;

  const viewportWidth = window.innerWidth;

  const viewportHeight = window.innerHeight;

  const spaceBelow = viewportHeight - rect.bottom - gap;

  const spaceAbove = rect.top - gap;

  /*
   * Open upward when there isn't enough
   * room below and more space exists above.
   */
  const openAbove = spaceBelow < calendarHeight && spaceAbove > spaceBelow;

  /*
   * Keep popup inside viewport horizontally.
   */
  let left = rect.right - calendarWidth;

  if (left < 16) {
    left = 16;
  }

  if (left + calendarWidth > viewportWidth - 16) {
    left = viewportWidth - calendarWidth - 16;
  }

  /*
   * On very small screens use trigger width
   * if it is wider than the normal calendar.
   */
  const width = Math.min(calendarWidth, viewportWidth - 32);

  if (openAbove) {
    return {
      left,
      bottom: viewportHeight - rect.top + gap,
      width,
      placement: "top",
    };
  }

  return {
    left,
    top: rect.bottom + gap,
    width,
    placement: "bottom",
  };
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

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

  const triggerRef = useRef<HTMLButtonElement>(null);

  const calendarRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState<CalendarPosition | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Reset month when opened                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (open) {
      setView(selected ?? today);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ---------------------------------------------------------------------- */
  /* Update portal position                                                 */
  /* ---------------------------------------------------------------------- */

  const updatePosition = () => {
    if (!triggerRef.current) {
      return;
    }

    setPosition(calculatePosition(triggerRef.current));
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    const handlePosition = () => {
      updatePosition();
    };

    window.addEventListener("resize", handlePosition);

    /*
     * true = catch scroll events from modal
     * containers as well.
     */
    window.addEventListener("scroll", handlePosition, true);

    return () => {
      window.removeEventListener("resize", handlePosition);

      window.removeEventListener("scroll", handlePosition, true);
    };
  }, [open]);

  /* ---------------------------------------------------------------------- */
  /* Outside click + ESC                                                    */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      const clickedTrigger = triggerRef.current?.contains(target);

      const clickedCalendar = calendarRef.current?.contains(target);

      if (!clickedTrigger && !clickedCalendar) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);

      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  /* ---------------------------------------------------------------------- */
  /* Date validation                                                        */
  /* ---------------------------------------------------------------------- */

  const isDisabledDay = (d: Date) => {
    const v = toValue(d);

    if (min && v < min) {
      return true;
    }

    if (max && v > max) {
      return true;
    }

    return false;
  };

  /* ---------------------------------------------------------------------- */
  /* Select date                                                            */
  /* ---------------------------------------------------------------------- */

  const selectDay = (d: Date) => {
    if (isDisabledDay(d)) {
      return;
    }

    onChange(toValue(d));

    setOpen(false);
  };

  const grid = buildMonthGrid(view.getFullYear(), view.getMonth());

  return (
    <div className={className}>
      {/* Label */}
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }

          setOpen((current) => !current);
        }}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-white ${
          open || selected
            ? "border-blue-400 dark:border-blue-500"
            : "border-gray-300 dark:border-gray-600"
        }`}
      >
        <span
          className={`truncate ${
            selected ? "" : "italic text-gray-400 dark:text-gray-500"
          }`}
        >
          {selected ? formatDisplay(selected) : placeholder}
        </span>

        <FaCalendarAlt className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500" />
      </button>

      {/* ================================================================ */}
      {/* Portal Calendar                                                  */}
      {/* ================================================================ */}

      {open &&
        position &&
        createPortal(
          <div
            ref={calendarRef}
            style={{
              position: "fixed",

              left: position.left,

              width: position.width,

              ...(position.placement === "top"
                ? {
                    bottom: position.bottom,
                  }
                : {
                    top: position.top,
                  }),
            }}
            className="
              z-[1000002]
              rounded-xl
              border
              border-gray-300
              bg-white
              p-3
              shadow-2xl
              dark:border-gray-600
              dark:bg-gray-800
            "
          >
            {/* ========================================================== */}
            {/* Month Navigation                                           */}
            {/* ========================================================== */}

            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
                }
                className="
                  rounded-md
                  p-1.5
                  text-gray-500
                  transition
                  hover:bg-gray-100
                  dark:text-gray-400
                  dark:hover:bg-gray-700
                "
                aria-label="Previous month"
              >
                <FaChevronLeft className="text-xs" />
              </button>

              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </span>

              <button
                type="button"
                onClick={() =>
                  setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
                }
                className="
                  rounded-md
                  p-1.5
                  text-gray-500
                  transition
                  hover:bg-gray-100
                  dark:text-gray-400
                  dark:hover:bg-gray-700
                "
                aria-label="Next month"
              >
                <FaChevronRight className="text-xs" />
              </button>
            </div>

            {/* ========================================================== */}
            {/* Weekdays                                                   */}
            {/* ========================================================== */}

            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((weekday) => (
                <span
                  key={weekday}
                  className="
                      text-center
                      text-[10px]
                      font-medium
                      uppercase
                      text-gray-400
                      dark:text-gray-500
                    "
                >
                  {weekday}
                </span>
              ))}
            </div>

            {/* ========================================================== */}
            {/* Calendar Grid                                              */}
            {/* ========================================================== */}

            <div className="grid grid-cols-7 gap-1">
              {grid.map((d, index) => {
                const inMonth = d.getMonth() === view.getMonth();

                const isSelected = selected ? isSameDay(d, selected) : false;

                const isToday = isSameDay(d, today);

                const dayDisabled = isDisabledDay(d);

                return (
                  <button
                    key={index}
                    type="button"
                    disabled={dayDisabled}
                    onClick={() => selectDay(d)}
                    className={`h-8 w-full rounded-md text-xs transition ${
                      isSelected
                        ? "bg-blue-600 font-semibold text-white hover:bg-blue-700"
                        : inMonth
                          ? "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                          : "text-gray-300 dark:text-gray-600"
                    } ${
                      isToday && !isSelected
                        ? "font-semibold ring-1 ring-blue-400 dark:ring-blue-500"
                        : ""
                    } ${
                      dayDisabled
                        ? "cursor-not-allowed opacity-30 hover:bg-transparent dark:hover:bg-transparent"
                        : ""
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* ========================================================== */}
            {/* Footer                                                     */}
            {/* ========================================================== */}

            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  if (isDisabledDay(today)) {
                    return;
                  }

                  onChange(toValue(today));

                  setOpen(false);
                }}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
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
                  className="text-xs text-gray-500 hover:underline dark:text-gray-400"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,

          document.body,
        )}
    </div>
  );
}
