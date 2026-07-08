/**
 * klab design tokens — single source of truth.
 *
 * These values are mirrored into CSS custom properties in `src/app/globals.css`
 * via Tailwind v4's `@theme`. Prefer the Tailwind utility classes (e.g. `bg-panel`,
 * `text-muted`) in components. Import these raw values only where a JS API needs a
 * literal color: the Monaco theme, the xterm theme, and React Flow node styling —
 * places that cannot read Tailwind classes.
 *
 * Do not hardcode hex values elsewhere. Add a token here instead.
 */

/** Vercel-inspired dark palette. */
export const palette = {
  background: "#000000",
  app: "#050505",
  panel: "#09090B",
  panelElevated: "#0F0F11",
  panelHover: "#141417",
  border: "#27272A",
  borderStrong: "#3F3F46",
  text: "#FAFAFA",
  textMuted: "#A1A1AA",
  textSubtle: "#71717A",

  blue: "#0070F3",
  blueSoft: "#1D4ED8",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
  purple: "#8B5CF6",

  codeBackground: "#05070A",
  terminalBackground: "#020403",
} as const;

/**
 * Semantic status colors. Status is never conveyed by color alone in the UI
 * (see accessibility rules) — these pair with icons and text labels.
 */
export const statusColor = {
  ready: palette.green,
  healthy: palette.green,
  pending: palette.amber,
  warning: palette.amber,
  failed: palette.red,
  unhealthy: palette.red,
  info: palette.blue,
  achievement: palette.purple,
} as const;

/** Corner radii, in pixels. Small controls / cards / large panels. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** Subtle, never-heavy elevation. */
export const shadow = {
  panel: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
  elevated: "0 4px 16px -4px rgb(0 0 0 / 0.5)",
  overlay: "0 16px 48px -12px rgb(0 0 0 / 0.7)",
} as const;

export type PaletteToken = keyof typeof palette;
export type StatusToken = keyof typeof statusColor;
