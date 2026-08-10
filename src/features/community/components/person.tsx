import { cn } from "@/lib/utils/cn";

import { displayName } from "../format";

/**
 * Avatar + display name for community lists. Anonymous accounts render as "Guest"
 * with a neutral avatar; named accounts show their OAuth image or initials.
 */
export function Person({
  name,
  image,
  isAnonymous,
  className,
}: {
  name: string;
  image: string | null;
  isAnonymous: boolean;
  className?: string;
}) {
  const label = displayName(name, isAnonymous);
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <PersonAvatar name={name} image={image} isAnonymous={isAnonymous} />
      <span
        className={cn(
          "truncate text-sm font-medium",
          isAnonymous ? "text-muted" : "text-foreground",
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function PersonAvatar({
  name,
  image,
  isAnonymous,
  className,
}: {
  name: string;
  image: string | null;
  isAnonymous: boolean;
  className?: string;
}) {
  if (!isAnonymous && image) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar is a remote OAuth URL, not a local asset
    return <img src={image} alt="" className={cn("size-6 shrink-0 rounded", className)} />;
  }
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold",
        isAnonymous ? "bg-panel-elevated text-subtle" : "bg-blue/15 text-blue",
        className,
      )}
      aria-hidden
    >
      {toInitials(displayName(name, isAnonymous))}
    </span>
  );
}

function toInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}
