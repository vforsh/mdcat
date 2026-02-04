import { Marked, Token, Tokens, TokensList } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

type TokenWithLine = Tokens.Generic & { _line?: number };

// Custom renderer that adds data-source-line attributes to block elements
const renderer = {
  heading(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Heading): string {
    const line = (token as TokenWithLine)._line;
    const attr = line != null ? ` data-source-line="${line}"` : "";
    return `<h${token.depth}${attr}>${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
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

export function renderMarkdown(source: string): string {
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

  return frontmatterHtml + marked.parser(tokens);
}
