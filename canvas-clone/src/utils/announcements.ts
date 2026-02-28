// src/utils/announcements.ts
export type AnnouncementStatus = "draft" | "published";

export type Announcement = {
  id: string;
  title: string;
  body?: string;
  postedAt: number;
  publishedAt?: number;
  status: AnnouncementStatus;
  pinned?: boolean;
};

export type AnnouncementPreview = {
  text: string;
  truncated: boolean;
  containsCode: boolean;
};

export function announcementPreview(
  html: string | undefined,
  maxLen = 220,
): AnnouncementPreview {
  if (!html) return { text: "", truncated: false, containsCode: false };

  let text = "";
  let containsCode = false;

  try {
    const div = document.createElement("div");
    div.innerHTML = html;

    containsCode = !!div.querySelector("pre, code");

    div.querySelectorAll("br").forEach((el) => {
      el.insertAdjacentText("afterend", "\n");
    });

    div.querySelectorAll("p, div, li").forEach((el) => {
      el.insertAdjacentText("afterend", "\n");
    });

    div.querySelectorAll("pre").forEach((el) => {
      el.insertAdjacentText("beforebegin", "\n");
      el.insertAdjacentText("afterend", "\n");
    });

    text = (div.textContent || div.innerText || "").replace(/\u00a0/g, " ");
  } catch {
    text = html;
  }

  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/^\n+/, "");

  if (text.length <= maxLen) {
    return { text, truncated: false, containsCode };
  }

  let truncatedText = text.slice(0, maxLen).trimEnd();
  truncatedText = truncatedText.replace(/\n+$/, "");

  return { text: truncatedText + "…", truncated: true, containsCode };
}
