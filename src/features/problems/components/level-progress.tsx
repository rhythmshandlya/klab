"use client";

import { icons } from "@/components/icons";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";

import { useLevelStore } from "../level-store";

export function LevelProgress() {
  const level = useLevelStore((s) => s.level);
  const revealed = useLevelStore((s) => s.revealedHintIds);
  const solved = useLevelStore((s) => s.solved);
  if (!level) return null;

  const penalty = level.hints
    .filter((h) => revealed.includes(h.id))
    .reduce((sum, h) => sum + h.xpPenalty, 0);
  const net = Math.max(0, level.xp - penalty);
  const Xp = icons.xp;
  const Trophy = icons.trophy;

  return (
    <Panel>
      <PanelHeader title="Level Progress" />
      <PanelBody className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-subtle text-[11px] tracking-wide uppercase">XP on solve</p>
            <p className="text-foreground flex items-center gap-1.5 text-2xl font-semibold">
              <Xp className="text-purple size-5" aria-hidden />
              <span className="tabnums">{net}</span>
            </p>
          </div>
          {solved ? (
            <Badge tone="success">
              <Trophy aria-hidden />
              Solved
            </Badge>
          ) : (
            <Badge tone="neutral">In progress</Badge>
          )}
        </div>

        {penalty > 0 ? (
          <p className="text-amber text-xs">
            −{penalty} XP from revealed hints (of {level.xp} base)
          </p>
        ) : (
          <p className="text-subtle text-xs">Solve without hints to earn the full {level.xp} XP.</p>
        )}
      </PanelBody>
    </Panel>
  );
}
