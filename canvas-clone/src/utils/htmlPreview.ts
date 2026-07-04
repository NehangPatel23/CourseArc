export type HtmlPreview = {
  text: string;
  truncated: boolean;
  containsCode: boolean;
};

export function htmlPreview(html: string | undefined, maxLen = 220): HtmlPreview {
  if (!html) return { text: "", truncated: false, containsCode: false };

  if (typeof document === "undefined") {
    const containsCode = /<(pre|code)\b/i.test(html);
    const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (plain.length <= maxLen) return { text: plain, truncated: false, containsCode };
    return { text: plain.slice(0, maxLen).trimEnd() + "…", truncated: true, containsCode };
  }

  let text = "";
  let containsCode = false;
  try {
    const div = document.createElement("div");
    div.innerHTML = html;
    containsCode = !!div.querySelector("pre, code");
    text = (div.textContent || "").replace(/\s+/g, " ").trim();
  } catch {
    text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  if (text.length <= maxLen) return { text, truncated: false, containsCode };
  return { text: text.slice(0, maxLen).trimEnd() + "…", truncated: true, containsCode };
}
