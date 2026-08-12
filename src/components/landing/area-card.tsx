import { icons, type IconName } from "@/components/icons";

export interface AreaCardProps {
  icon: IconName;
  title: string;
  description: string;
  accent: "blue" | "green" | "purple";
}

const accentRing: Record<AreaCardProps["accent"], string> = {
  blue: "border-blue/20",
  green: "border-green/20",
  purple: "border-purple/20",
};

const accentText: Record<AreaCardProps["accent"], string> = {
  blue: "text-blue",
  green: "text-green",
  purple: "text-purple",
};

export function AreaCard({ icon, title, description, accent }: AreaCardProps) {
  const Icon = icons[icon];
  return (
    <article
      className={`bg-panel relative flex flex-col rounded-xl border p-5 ${accentRing[accent]}`}
    >
      <span className="border-border bg-panel-elevated flex size-10 items-center justify-center rounded-lg border">
        <Icon className={`size-5 ${accentText[accent]}`} aria-hidden />
      </span>
      <h2 className="text-foreground mt-4 text-base font-semibold tracking-tight">{title}</h2>
      <p className="text-muted mt-1.5 text-sm leading-relaxed">{description}</p>
    </article>
  );
}
