import { STATUS_CONFIG } from "../../constants";

interface Props {
  status: string;
}

export default function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Pending"];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${cfg.color}`}
    >
      {cfg.icon}
      {status}
    </span>
  );
}