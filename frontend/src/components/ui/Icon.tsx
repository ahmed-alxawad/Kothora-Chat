import type { JSX } from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Brain,
  ChartColumn,
  Check,
  ChevronDown,
  CircleHelp,
  Clock,
  Copy,
  CreditCard,
  Download,
  Ellipsis,
  Folder,
  Globe,
  KeyRound,
  LayoutGrid,
  LibraryBig,
  Link,
  List,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Monitor,
  Moon,
  PanelLeft,
  Paperclip,
  Pencil,
  PenLine,
  Pin,
  Plug,
  Plus,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquarePen,
  SquareTerminal,
  Star,
  Sun,
  Trash2,
  TriangleAlert,
  User,
  VenetianMask,
  X,
} from "lucide-solid"

/** App icon names mapped to Lucide, the open-source set many chat apps use. */
const ICONS = {
  plus: Plus,
  send: ArrowUp,
  stop: Square,
  sidebar: PanelLeft,
  menu: Menu,
  search: Search,
  globe: Globe,
  book: BookOpen,
  pen: PenLine,
  copy: Copy,
  check: Check,
  more: Ellipsis,
  trash: Trash2,
  edit: SquarePen,
  rename: Pencil,
  chevronDown: ChevronDown,
  arrowDown: ArrowDown,
  x: X,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  logout: LogOut,
  sparkle: Sparkles,
  card: CreditCard,
  lock: Lock,
  download: Download,
  alert: TriangleAlert,
  chat: MessageSquare,
  folder: Folder,
  library: LibraryBig,
  clock: Clock,
  plug: Plug,
  sliders: SlidersHorizontal,
  settings: Settings,
  star: Star,
  pin: Pin,
  mic: Mic,
  paperclip: Paperclip,
  ghost: VenetianMask,
  terminal: SquareTerminal,
  help: CircleHelp,
  user: User,
  shield: Shield,
  brain: Brain,
  key: KeyRound,
  chart: ChartColumn,
  grid: LayoutGrid,
  list: List,
  link: Link,
} as const

export type IconName = keyof typeof ICONS

export function Icon(
  props: { name: IconName; size?: number; class?: string } & Pick<
    JSX.SvgSVGAttributes<SVGSVGElement>,
    "style"
  >,
) {
  return (
    <Dynamic
      component={ICONS[props.name]}
      size={props.size ?? 18}
      stroke-width={1.75}
      class={props.class}
      aria-hidden="true"
    />
  )
}

/**
 * The Kothora wordmark. Text for now; replace the contents with the real logo
 * (an <img> or inline SVG) when it is ready. Every screen uses this component.
 */
export function Wordmark(props: { size?: "small" | "large" }) {
  return (
    <span class={`wordmark ${props.size ?? "small"}`} aria-label="Kothora">
      Kothora
    </span>
  )
}
