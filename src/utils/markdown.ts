import { Marked, Token, Tokens, TokensList } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import { convertFileSrc } from "@tauri-apps/api/core";

type TokenWithLine = Tokens.Generic & { _line?: number };

/** Current base directory for resolving relative image paths */
let currentBaseDir: string | null = null;

function isRemoteUrl(src: string): boolean {
  return /^https?:\/\/|^data:/i.test(src);
}

function resolveImageSrc(src: string): string {
  if (isRemoteUrl(src) || !currentBaseDir) return src;
  // Resolve relative path against the markdown file's directory
  const abs = currentBaseDir + "/" + src.replace(/^\.\//, "");
  return convertFileSrc(abs);
}

// Custom renderer that adds data-source-line attributes to block elements
const renderer = {
  heading(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Heading): string {
    const line = (token as TokenWithLine)._line;
    const attr = line != null ? ` data-source-line="${line}"` : "";
    const id = slugify(token.text);
    return `<h${token.depth}${attr} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
  },
  paragraph(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Paragraph): string {
    const line = (token as TokenWithLine)._line;
    const attr = line != null ? ` data-source-line="${line}"` : "";
    return `<p${attr}>${this.parser.parseInline(token.tokens)}</p>\n`;
  },
  list(this: { listitem(item: Tokens.ListItem): string }, token: Tokens.List): string {
    const line = (token as TokenWithLine)._line;
    const attr = line != null ? ` data-source-line="${line}"` : "";
    const tag = token.ordered ? "ol" : "ul";
    const body = token.items.map((item) => this.listitem(item)).join("");
    return `<${tag}${attr}>\n${body}</${tag}>\n`;
  },
  code(token: Tokens.Code): string {
    const line = (token as TokenWithLine)._line;
    const attr = line != null ? ` data-source-line="${line}"` : "";
    const lang = token.lang || "";
    let code = token.text;
    if (lang && hljs.getLanguage(lang)) {
      code = hljs.highlight(token.text, { language: lang }).value;
    } else {
      code = hljs.highlightAuto(token.text).value;
    }
    const langClass = lang ? ` class="hljs language-${lang}"` : ' class="hljs"';
    return `<pre${attr}><code${langClass}>${code}</code></pre>\n`;
  },
  blockquote(this: { parser: { parse(tokens: Token[]): string } }, token: Tokens.Blockquote): string {
    const line = (token as TokenWithLine)._line;
    const attr = line != null ? ` data-source-line="${line}"` : "";
    return `<blockquote${attr}>\n${this.parser.parse(token.tokens)}</blockquote>\n`;
  },
  table(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Table): string {
    const line = (token as TokenWithLine)._line;
    const attr = line != null ? ` data-source-line="${line}"` : "";
    let header = "<tr>\n";
    for (let i = 0; i < token.header.length; i++) {
      const align = token.align[i] ? ` align="${token.align[i]}"` : "";
      header += `<th${align}>${this.parser.parseInline(token.header[i].tokens)}</th>\n`;
    }
    header += "</tr>\n";
    let body = "";
    for (const row of token.rows) {
      body += "<tr>\n";
      for (let i = 0; i < row.length; i++) {
        const align = token.align[i] ? ` align="${token.align[i]}"` : "";
        body += `<td${align}>${this.parser.parseInline(row[i].tokens)}</td>\n`;
      }
      body += "</tr>\n";
    }
    return `<table${attr}>\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>\n`;
  },
  hr(token: Tokens.Hr): string {
    const line = (token as TokenWithLine)._line;
    const attr = line != null ? ` data-source-line="${line}"` : "";
    return `<hr${attr}>\n`;
  },
  image(token: Tokens.Image): string {
    const src = resolveImageSrc(token.href);
    const alt = token.text ? ` alt="${escapeHtml(token.text)}"` : "";
    const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
    return `<img src="${src}"${alt}${title}>`;
  },
};

const marked = new Marked(
  { renderer },
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

/** Assign _line to each token based on its position in source */
function assignLineNumbers(tokens: TokensList, source: string, startLine: number): void {
  let pos = 0;
  let line = startLine;

  for (const token of tokens) {
    // Find where this token's raw content starts
    const raw = token.raw;
    const idx = source.indexOf(raw, pos);
    if (idx !== -1) {
      // Count newlines between pos and idx
      for (let i = pos; i < idx; i++) {
        if (source[i] === "\n") line++;
      }
      pos = idx;
    }
    (token as TokenWithLine)._line = line;

    // Count newlines within this token's raw content
    for (const ch of raw) {
      if (ch === "\n") line++;
    }
    pos += raw.length;
  }
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Generate a GFM-compatible heading slug */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/[^\w\s-]/g, "") // remove non-word chars (except spaces and hyphens)
    .trim()
    .replace(/\s+/g, "-"); // spaces → hyphens
}

/** Rewrite src attributes in raw HTML <img> tags */
function rewriteHtmlImages(html: string): string {
  if (!currentBaseDir) return html;
  return html.replace(
    /(<img\s[^>]*?\bsrc=["'])([^"']+)(["'])/gi,
    (match, pre, src, post) => {
      if (isRemoteUrl(src)) return match;
      // Skip already-resolved asset:// URLs
      if (src.startsWith("asset:") || src.startsWith("http://asset.localhost")) return match;
      const resolved = resolveImageSrc(src);
      return pre + resolved + post;
    },
  );
}

export function renderMarkdown(source: string, baseDir?: string | null): string {
  currentBaseDir = baseDir ?? null;

  let frontmatterHtml = "";
  let body = source;
  let startLine = 1;

  const m = FRONTMATTER_RE.exec(source);
  if (m) {
    // Count lines in frontmatter (including delimiters)
    const frontmatterLines = m[0].split("\n").length;
    startLine = frontmatterLines;
    frontmatterHtml = `<pre class="frontmatter" data-source-line="1"><code>${escapeHtml(m[1])}</code></pre>`;
    body = source.slice(m[0].length);
  }

  // Lex and assign line numbers
  const tokens = marked.lexer(body);
  assignLineNumbers(tokens, body, startLine);

  let html = frontmatterHtml + marked.parser(tokens);

  // Post-process raw HTML <img> tags that marked passes through as-is
  html = rewriteHtmlImages(html);

  currentBaseDir = null;
  return html;
}
