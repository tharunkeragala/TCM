import { PRIORITY_CONFIG } from "../../constants";

interface Props {
  priority: string;
}

export default function PriorityBadge({ priority }: Props) {
  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded-full ${PRIORITY_CONFIG[priority] || ""}`}
    >
      {priority}
    </span>
  );
}