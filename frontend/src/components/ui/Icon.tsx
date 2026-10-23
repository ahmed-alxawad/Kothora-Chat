import type { JSX } from "solid-js"

/** Stroke icons on a 24px grid (Lucide-style paths), inlined so the app loads no icon font. */
const PATHS = {
  plus: "M12 5v14M5 12h14",
  send: "M12 19V5M5 12l7-7 7 7",
  stop: "M7 7h10v10H7z",
  sidebar: "M3 5h18v14H3zM9 5v14",
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4",
  globe:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  book: "M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h14",
  pen: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  check: "M5 12l5 5L20 7",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  edit: "M4 20h4L19 9l-4-4L4 16v4z",
  chevronDown: "M6 9l6 6 6-6",
  arrowDown: "M12 5v14M5 12l7 7 7-7",
  x: "M6 6l12 12M18 6L6 18",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  logout: "M9 21H5V3h4M16 17l5-5-5-5M21 12H9",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  card: "M3 6h18v12H3zM3 10h18",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  download: "M12 4v12M6 10l6 6 6-6M4 20h16",
  alert:
    "M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
} as const

export type IconName = keyof typeof PATHS

export function Icon(
  props: { name: IconName; size?: number } & JSX.SvgSVGAttributes<SVGSVGElement>,
) {
  const size = () => props.size ?? 18
  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class}
    >
      <path d={PATHS[props.name]} />
    </svg>
  )
}

/** The Kothora mark: a speech bubble holding ক, the first letter of কথা ("talk"). */
export function KothoraMark(props: { size?: number }) {
  const size = () => props.size ?? 28
  return (
    <svg width={size()} height={size()} viewBox="0 0 32 32" aria-hidden="true" class="mark">
      <path
        d="M6 4h20a4 4 0 0 1 4 4v13a4 4 0 0 1-4 4H14l-6 5v-5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
        fill="var(--brand)"
      />
      <text
        x="16"
        y="19.5"
        text-anchor="middle"
        font-family="'Hind Siliguri', 'Noto Sans Bengali', sans-serif"
        font-size="15"
        font-weight="700"
        fill="var(--on-brand)"
      >
        ক
      </text>
    </svg>
  )
}
