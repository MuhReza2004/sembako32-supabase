const HTML_ESCAPE_REGEX = /[&<>"'`=\/]/g;

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
  "=": "&#61;",
  "/": "&#47;",
};

export const escapeHtml = (value: string): string =>
  value.replace(HTML_ESCAPE_REGEX, (char) => ESCAPE_MAP[char] || char);
