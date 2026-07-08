import Link from "next/link";

import { icons, type IconName } from "@/components/icons";

export interface AreaCardProps {
  href: string;
  icon: IconName;
  title: string;
  description: string;
  accent: "blue" | "green" | "purple";
}

const accentRing: Record<AreaCardProps["accent"], string> = {
  blue: "group-hover:border-blue/40",
  green: "group-hover:border-green/40",
  purple: "group-hover:border-purple/40",
};

const accentText: Record<AreaCardProps["accent"], string> = {
  blue: "text-blue",
  green: "text-green",
  purple: "text-purple",
};

export function AreaCard({ href, icon, title, description, accent }: AreaCardProps) {
  const Icon = icons[icon];
  const Arrow = icons.service; // Route icon doubles as a directional affordance
  return (
    <Link
      href={href}
      className={`group border-border bg-panel hover:bg-panel-hover relative flex flex-col rounded-xl border p-5 transition-colors ${accentRing[accent]} focus-visible:ring-ring focus-visible:ring-offset-app focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none`}
    >
      <span className="border-border bg-panel-elevated flex size-10 items-center justify-center rounded-lg border">
        <Icon className={`size-5 ${accentText[accent]}`} aria-hidden />
      </span>
      <h2 className="text-foreground mt-4 flex items-center gap-1.5 text-base font-semibold tracking-tight">
        {title}
        <Arrow
          className="text-subtle size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
          aria-hidden
        />
      </h2>
      <p className="text-muted mt-1.5 text-sm leading-relaxed">{description}</p>
    </Link>
  );
}
