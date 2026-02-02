import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

marked.setOptions({
  gfm: true,
  breaks: false,
});

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderMarkdown(source: string): string {
  let frontmatterHtml = "";
  let body = source;

  const m = FRONTMATTER_RE.exec(source);
  if (m) {
    frontmatterHtml = `<pre class="frontmatter"><code>${escapeHtml(m[1])}</code></pre>`;
    body = source.slice(m[0].length);
  }

  return frontmatterHtml + (marked.parse(body) as string);
}
