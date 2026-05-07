export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const datePart = value.trim().substring(0, 10);
  const [yyyy, mm, dd] = datePart.split("-");
  if (!yyyy || !mm || !dd) return "Not set";
  return `${dd}/${mm}/${yyyy}`;
}

export function toLocalDateString(date: Date | null): string {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isOverdue(due_date: string | null, status: string): boolean {
  if (!due_date || status === "Completed" || status === "Cancelled")
    return false;
  return new Date(due_date) < new Date();
}