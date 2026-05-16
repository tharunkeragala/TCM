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
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
                     bg-violet-50 text-violet-700
                     dark:bg-violet-500/10 dark:text-violet-400"
        >
          <FaTag className="w-2.5 h-2.5 flex-shrink-0" />
          {t.trim()}
        </span>
      ))}
    </div>
  );
}