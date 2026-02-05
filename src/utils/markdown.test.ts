import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders paragraph with line number", () => {
    const html = renderMarkdown("Hello world");
    expect(html).toContain('<p data-source-line="1">Hello world</p>');
  });

  it("renders heading with correct depth and line", () => {
    const html = renderMarkdown("# Title\n\nParagraph");
    expect(html).toContain('<h1 data-source-line="1">Title</h1>');
    expect(html).toContain('<p data-source-line="3">Paragraph</p>');
  });

  it("strips frontmatter and adjusts line numbers", () => {
    const source = "---\ntitle: Test\n---\n# Heading";
    const html = renderMarkdown(source);
    expect(html).toContain("frontmatter");
    expect(html).toContain('<h1 data-source-line="4">Heading</h1>');
  });

  it("escapes frontmatter content", () => {
    const source = "---\nhtml: <script>\n---\nText";
    const html = renderMarkdown(source);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders code blocks with language class", () => {
    const html = renderMarkdown("```js\nconst x = 1;\n```");
    expect(html).toContain('class="hljs language-js"');
    expect(html).toContain("const x = 1");
  });

  it("renders unordered list with line number", () => {
    const html = renderMarkdown("- item 1\n- item 2");
    expect(html).toContain('<ul data-source-line="1">');
  });

  it("renders ordered list with line number", () => {
    const html = renderMarkdown("1. first\n2. second");
    expect(html).toContain('<ol data-source-line="1">');
  });

  it("renders blockquote with line number", () => {
    const html = renderMarkdown("> quoted text");
    expect(html).toContain('<blockquote data-source-line="1">');
  });

  it("renders table with line number", () => {
    const html = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain('<table data-source-line="1">');
  });

  it("renders horizontal rule with line number", () => {
    const html = renderMarkdown("text\n\n---\n\nmore");
    expect(html).toContain('<hr data-source-line="3">');
  });

  it("handles empty input", () => {
    const html = renderMarkdown("");
    expect(html).toBe("");
  });

  it("handles frontmatter-only input", () => {
    const html = renderMarkdown("---\nkey: val\n---\n");
    expect(html).toContain("frontmatter");
    expect(html).toContain("key: val");
  });
});
