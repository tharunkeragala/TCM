type WorkflowStatus = "Draft" | "Review" | "Approved" | string | null | undefined;

export function getWorkflowStatusLabel(status: WorkflowStatus) {
  if (status === "Review") return "Pending Review";
  if (status === "Approved") return "Approved";
  return "Draft";
}

export default function WorkflowStatusBadge({
  status,
  showDot = true,
}: {
  status: WorkflowStatus;
  showDot?: boolean;
}) {
  const normalized =
    status === "Review"
      ? "Review"
      : status === "Approved"
        ? "Approved"
        : "Draft";

  const classes: Record<string, string> = {
    Draft:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
    Review:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
    Approved:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
  };

  const dotClasses: Record<string, string> = {
    Draft: "bg-amber-500",
    Review: "bg-blue-500",
    Approved: "bg-emerald-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[normalized]}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotClasses[normalized]}`}
        />
      )}
      {getWorkflowStatusLabel(normalized)}
    </span>
  );
}
