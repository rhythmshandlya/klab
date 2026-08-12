import Link from "next/link";

import { icons, type IconName } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

export interface SectionPlaceholderProps {
  icon: IconName;
  eyebrow: string;
  title: string;
  description: string;
  /** Which build phase delivers the full experience: shown as an honest status badge. */
  phase: string;
  planned: string[];
  cta?: { href: string; label: string };
}

/**
 * A consistent, deliberately honest placeholder for sections whose full workspace
 * ships in a later phase. It previews the intended capabilities instead of faking a
 * finished screen. Replaced in-place by the real workspace when each phase lands.
 */
export function SectionPlaceholder({
  icon,
  eyebrow,
  title,
  description,
  phase,
  planned,
  cta,
}: SectionPlaceholderProps) {
  const Icon = icons[icon];
  const Check = icons.success;
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="flex items-center gap-3">
        <span className="border-border bg-panel flex size-11 items-center justify-center rounded-lg border">
          <Icon className="text-muted size-5" aria-hidden />
        </span>
        <div>
          <p className="text-subtle text-[11px] font-semibold tracking-[0.12em] uppercase">
            {eyebrow}
          </p>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
      </div>

      <p className="text-muted mt-5 max-w-2xl text-[15px] leading-relaxed">{description}</p>

      <div className="mt-6">
        <Badge tone="info">
          <Icon aria-hidden />
          Ships in {phase}
        </Badge>
      </div>

      <div className="border-border bg-panel mt-8 rounded-lg border p-5">
        <p className="text-subtle text-[11px] font-semibold tracking-[0.08em] uppercase">
          Planned in this workspace
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {planned.map((item) => (
            <li key={item} className="text-muted flex items-start gap-2 text-sm">
              <Check className="text-green/70 mt-0.5 size-4 shrink-0" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {cta ? (
        <Link
          href={cta.href}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-app mt-6 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
