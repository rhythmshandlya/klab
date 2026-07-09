import { icons } from "@/components/icons";
import type { DocsBlock, DocsLesson } from "@/lib/domain/types";
import { assertNever } from "@/lib/utils/exhaustive";
import { cn } from "@/lib/utils/cn";

import { InteractiveLab } from "./interactive-lab";

const CALLOUT: Record<"info" | "warning" | "key", { border: string; icon: keyof typeof icons }> = {
  info: { border: "border-blue/30 bg-blue/5", icon: "docs" },
  warning: { border: "border-amber/30 bg-amber/5", icon: "warning" },
  key: { border: "border-purple/30 bg-purple/5", icon: "xp" },
};

export function DocsContent({ lesson }: { lesson: DocsLesson }) {
  return (
    <div className="space-y-5">
      {lesson.content.map((block, i) => (
        <Block key={i} block={block} lesson={lesson} />
      ))}
    </div>
  );
}

function Block({ block, lesson }: { block: DocsBlock; lesson: DocsLesson }) {
  switch (block.type) {
    case "heading":
      return (
        <h2
          id={block.id}
          className="text-foreground scroll-mt-20 pt-2 text-lg font-semibold tracking-tight"
        >
          {block.text}
        </h2>
      );
    case "paragraph":
      return <p className="text-muted text-[15px] leading-relaxed">{block.text}</p>;
    case "callout": {
      const style = CALLOUT[block.tone];
      const Icon = icons[style.icon];
      return (
        <div className={cn("flex gap-3 rounded-lg border p-4", style.border)}>
          <Icon className="text-foreground mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            {block.title ? (
              <p className="text-foreground text-sm font-semibold">{block.title}</p>
            ) : null}
            <p className="text-muted text-sm leading-relaxed">{block.text}</p>
          </div>
        </div>
      );
    }
    case "concept":
      return (
        <div className="border-border bg-panel rounded-lg border p-4">
          <p className="text-foreground text-sm font-semibold">{block.term}</p>
          <p className="text-muted mt-1 text-sm leading-relaxed">{block.definition}</p>
        </div>
      );
    case "code":
      return (
        <pre className="border-border bg-code text-muted overflow-x-auto rounded-lg border p-3 font-mono text-xs leading-relaxed">
          {block.code}
        </pre>
      );
    case "compare":
      return (
        <div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[block.left, block.right].map((side, i) => (
              <div key={i} className="border-border bg-panel rounded-lg border">
                <p className="border-border text-subtle border-b px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase">
                  {side.title}
                </p>
                <pre className="text-muted overflow-x-auto p-3 font-mono text-xs leading-relaxed">
                  {side.code}
                </pre>
              </div>
            ))}
          </div>
          {block.caption ? (
            <p className="text-subtle mt-2 text-center text-xs">{block.caption}</p>
          ) : null}
        </div>
      );
    case "lab": {
      const lab = lesson.labs.find((l) => l.id === block.labId);
      if (!lab) return null;
      return <InteractiveLab lab={lab} />;
    }
    default:
      return assertNever(block);
  }
}
