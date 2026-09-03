import { Icon as IconifyIcon } from "@iconify/react";
import { registerStreamlineIcons } from "./registerStreamline";

registerStreamlineIcons();

const STREAMLINE = {
  home: "home-4",
  courses: "layers-1",
  calendar: "blank-calendar",
  planner: "task-list",
  inbox: "inbox-tray-1",
  search: "magnifying-glass",
  settings: "cog",
  help: "help-question-1",
  portfolio: "star-badge",
  bell: "ringing-bell-notification",
  menu: "align-left",
  close: "delete-1",
  chevronDown: "arrow-down-2",
  chevronUp: "arrow-down-2",
  chevronLeft: "arrow-down-2",
  chevronRight: "arrow-down-2",
  collapse: "arrow-round-left",
  expandNav: "arrow-round-right",
  plus: "add-1",
  grid: "layout-window-11",
  list: "bullet-list",
  pin: "bookmark",
  unpin: "bookmark-solid",
  star: "star-1",
  tag: "tag",
  clock: "circle-clock",
  arrowUpRight: "arrow-up-1",
  book: "open-book",
  clipboard: "clipboard-check",
  cap: "graduation-cap",
  trend: "graph-arrow-increase",
  student: "user-single-neutral-male",
  ta: "user-check-validate",
  instructor: "user-circle-single",
  eye: "eye-optic",
  eyeOff: "incognito-mode",
  filter: "filter-2",
  check: "check",
  panels: "layout-window-2",
  customize: "expand",
  expand: "expand",
  grip: "one-finger-drag-vertical",
  sort: "sort-descending",
  reading: "book-reading",
  emptySearch: "search-visual",
  emptyBook: "open-book",
  checkSquare: "check-square",
  more: "horizontal-menu-circle",
  pencil: "pencil",
  copy: "copy-paste",
  trash: "recycle-bin-2",
  archive: "archive-box",
  restore: "arrow-reload-vertical-1",
  upload: "upload-box-1",
  download: "download-box-1",
  megaphone: "announcement-megaphone",
  lightbulb: "lightbulb",
  graph: "graph-bar-increase",
  paperclip: "paperclip-1",
  printer: "printer",
  mapPin: "location-pin-3",
  mute: "volume-mute",
  compose: "pencil",
  users: "user-multiple-group",
  link: "interface-link-create-hyperlink-link-make-unlink",
  globe: "travel-map-earth-1-planet-earth-globe-world",
  folder: "interface-folder-empty-folder",
  video: "camera-video",
  file: "interface-file-text-text-common-file",
  library: "interface-content-book-2-library-content-books-book-shelf-stack",
  chat: "chat-bubble-oval",
  calendarCheck: "interface-calendar-check-approve-calendar-check-date-day-month-success",
  briefcase: "shopping-bag-suitcase-1-product-business-briefcase",
  table: "layout-window-11",
  lock: "padlock-square-1",
  unlock: "interface-unlock-combination-combo-key-keyhole-lock-secure-security-square-unlock-unlocked",
  warning: "interface-alert-warning-triangle-frame-alert-warning-triangle-exclamation-caution",
  checkCircle: "interface-validation-check-circle-checkmark-addition-circle-success-check-validation-add-form",
  circle: "circle",
  zoomIn: "interface-edit-zoom-in-enhance-glass-in-magnify-magnifying-zoom",
  zoomOut: "interface-edit-zoom-out-glass-magnifying-out-reduce-zoom",
  rotate: "arrow-reload-horizontal-1",
  play: "button-play",
} as const;

export type IconName = keyof typeof STREAMLINE;

const ROTATE: Partial<Record<IconName, string>> = {
  chevronUp: "-rotate-180",
  chevronLeft: "rotate-90",
  chevronRight: "-rotate-90",
  arrowUpRight: "rotate-45",
};

type Props = {
  name: IconName;
  className?: string;
  size?: number;
  title?: string;
};

export default function Icon({ name, className = "", size = 18, title }: Props) {
  const rotate = ROTATE[name] ?? "";
  return (
    <IconifyIcon
      icon={`streamline:${STREAMLINE[name]}`}
      width={size}
      height={size}
      className={`inline-block shrink-0 ${rotate} ${className}`.trim()}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    />
  );
}
