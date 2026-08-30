import { addCollection } from "@iconify/react";
import streamline from "@iconify-json/streamline/icons.json";

const USED = [
  "home-4",
  "layers-1",
  "blank-calendar",
  "task-list",
  "inbox-tray-1",
  "magnifying-glass",
  "cog",
  "help-question-1",
  "star-badge",
  "ringing-bell-notification",
  "align-left",
  "delete-1",
  "arrow-down-2",
  "arrow-round-left",
  "arrow-round-right",
  "add-1",
  "layout-window-11",
  "bullet-list",
  "bookmark",
  "bookmark-solid",
  "star-1",
  "tag",
  "circle-clock",
  "arrow-up-1",
  "open-book",
  "clipboard-check",
  "graduation-cap",
  "graph-arrow-increase",
  "user-single-neutral-male",
  "user-check-validate",
  "user-circle-single",
  "eye-optic",
  "filter-2",
  "check",
  "layout-window-2",
  "expand",
  "one-finger-drag-vertical",
  "sort-descending",
  "book-reading",
  "search-visual",
  "check-square",
  "incognito-mode",
  "horizontal-menu-circle",
  "pencil",
  "copy-paste",
  "recycle-bin-2",
  "archive-box",
  "arrow-reload-vertical-1",
  "upload-box-1",
  "download-box-1",
  "announcement-megaphone",
  "lightbulb",
  "graph-bar-increase",
  "paperclip-1",
  "printer",
  "location-pin-3",
  "volume-mute",
  "user-multiple-group",
  "interface-link-create-hyperlink-link-make-unlink",
  "travel-map-earth-1-planet-earth-globe-world",
  "interface-folder-empty-folder",
  "camera-video",
  "interface-file-text-text-common-file",
  "interface-content-book-2-library-content-books-book-shelf-stack",
  "chat-bubble-oval",
  "interface-calendar-check-approve-calendar-check-date-day-month-success",
  "shopping-bag-suitcase-1-product-business-briefcase",
] as const;

let registered = false;

export function registerStreamlineIcons() {
  if (registered) return;
  registered = true;

  const source = streamline as {
    width?: number;
    height?: number;
    icons: Record<string, { body: string }>;
  };

  const icons: Record<string, { body: string }> = {};
  for (const name of USED) {
    const icon = source.icons[name];
    if (icon) icons[name] = icon;
  }

  addCollection({
    prefix: "streamline",
    width: source.width ?? 14,
    height: source.height ?? 14,
    icons,
  });
}
