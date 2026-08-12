import Link from "next/link";

import { DISCUSSION_CATEGORIES, type DiscussionCategory } from "@/lib/community/contracts";
import { cn } from "@/lib/utils/cn";

export function DiscussionCategoryNav({ active }: { active?: DiscussionCategory }) {
  return (
    <nav aria-label="Discussion categories" className="flex flex-wrap gap-2">
      <CategoryLink active={active === undefined} />
      {DISCUSSION_CATEGORIES.map((option) => (
        <CategoryLink
          key={option.value}
          category={option.value}
          label={option.label}
          active={active === option.value}
        />
      ))}
    </nav>
  );
}

function CategoryLink({
  category,
  label = "All",
  active,
}: {
  category?: DiscussionCategory;
  label?: string;
  active: boolean;
}) {
  return (
    <Link
      href={category ? `/community?category=${category}` : "/community"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "border-border rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-blue/40 bg-blue/10 text-blue"
          : "bg-panel text-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
