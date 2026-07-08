/**
 * Central icon map. UI code imports from here rather than reaching into
 * `lucide-react` directly, so the icon vocabulary stays consistent and swappable.
 *
 * Accessibility: Lucide icons render an SVG with `aria-hidden` by default when used
 * decoratively. For meaningful, icon-only controls, wrap with an accessible label
 * (e.g. the `IconButton`/`Button` `aria-label`), never rely on the glyph alone.
 */
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Blocks,
  Box,
  Boxes,
  Braces,
  CheckCircle2,
  Command,
  Database,
  FileCode2,
  Flame,
  Gem,
  GitBranch,
  GitCompare,
  GraduationCap,
  Network,
  Play,
  RotateCcw,
  Route,
  ScrollText,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  Trophy,
  XCircle,
} from "lucide-react";

export const icons = {
  terminal: Terminal,
  yaml: FileCode2,
  docs: BookOpen,
  playground: Blocks,
  problems: AlertTriangle,
  cluster: Network,
  node: Server,
  pod: Box,
  deployment: Boxes,
  service: Route,
  endpointSlice: GitBranch,
  events: Activity,
  logs: ScrollText,
  command: Command,
  search: Search,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  run: Play,
  reset: RotateCcw,
  diff: GitCompare,
  validate: ShieldCheck,
  trophy: Trophy,
  streak: Flame,
  xp: Gem,
  database: Database,
  config: Braces,
  docsInteractive: GraduationCap,
} as const;

export type IconName = keyof typeof icons;

export { ClusterMark } from "./cluster-mark";
