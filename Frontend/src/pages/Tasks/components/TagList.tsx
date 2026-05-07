import { FaTag } from "react-icons/fa";

interface Props {
  tags: string | null;
}

export default function TagList({ tags }: Props) {
  if (!tags) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.split(",").map((t, i) => (
        <span
          key={i}
          className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 flex items-center gap-1"
        >
          <FaTag className="w-2.5 h-2.5" />
          {t.trim()}
        </span>
      ))}
    </div>
  );
}