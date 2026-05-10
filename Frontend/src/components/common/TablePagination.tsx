type PaginationItem = number | "...";

interface TablePaginationProps {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;

  pageSizeOptions?: number[];

  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export default function TablePagination({
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const safePage = Math.min(Math.max(currentPage, 1), totalPages || 1);

  const getPaginationRange = (): PaginationItem[] => {
    const delta = 1;

    const range: PaginationItem[] = [];

    for (
      let i = Math.max(2, safePage - delta);
      i <= Math.min(totalPages - 1, safePage + delta);
      i++
    ) {
      range.push(i);
    }

    if (safePage - delta > 2) {
      range.unshift("...");
    }

    if (safePage + delta < totalPages - 1) {
      range.push("...");
    }

    if (totalPages >= 1) {
      range.unshift(1);
    }

    if (totalPages > 1) {
      range.push(totalPages);
    }

    return [...new Set(range)];
  };

  if (totalItems <= 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {/* Left */}
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span>Rows per page:</span>

        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          disabled={!onPageSizeChange}
          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <span>
          {(safePage - 1) * pageSize + 1}–
          {Math.min(safePage * pageSize, totalItems)} of {totalItems}
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => onPageChange(1)}
          disabled={safePage === 1}
          className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="First page"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 19l-7-7 7-7M18 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Prev */}
        <button
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1}
          className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="Previous page"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Page numbers */}
        {getPaginationRange().map((item, i) =>
          item === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="px-2 py-1 text-gray-400 dark:text-gray-500 text-sm select-none"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item as number)}
              className={`min-w-[32px] px-2 py-1 rounded-md text-sm font-medium transition ${
                safePage === item
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {item}
            </button>
          ),
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage === totalPages}
          className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="Next page"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Last */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={safePage === totalPages}
          className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="Last page"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 5l7 7-7 7M6 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
