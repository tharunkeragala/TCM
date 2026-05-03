export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";

  const pad = (n: number) => String(n).padStart(2, "0");

  const dd = pad(d.getUTCDate());
  const mm = pad(d.getUTCMonth() + 1);
  const yyyy = d.getUTCFullYear();

  let hours = d.getUTCHours();
  const minutes = pad(d.getUTCMinutes());
  const seconds = pad(d.getUTCSeconds());

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return `${dd}/${mm}/${yyyy} ${pad(hours)}:${minutes}:${seconds} ${ampm}`;
}