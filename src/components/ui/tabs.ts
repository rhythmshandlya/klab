import type { KeyboardEvent } from "react";

/**
 * WAI-ARIA automatic tab activation: arrow/Home/End moves focus and selects the
 * destination tab. Tab remains the one-key entry/exit point for the whole tablist.
 */
export function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
  const tabList = event.currentTarget.closest<HTMLElement>('[role="tablist"]');
  if (!tabList) return;
  const tabs = Array.from(tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]')).filter(
    (tab) => !tab.disabled,
  );
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0 || tabs.length === 0) return;

  let nextIndex: number | undefined;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  }
  if (nextIndex === undefined) return;

  event.preventDefault();
  tabs[nextIndex]!.focus();
  tabs[nextIndex]!.click();
}
