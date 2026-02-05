import { describe, it, expect } from "vitest";
import { findMatches, escapeRegex } from "./search";

describe("findMatches", () => {
  it("finds all occurrences of a string", () => {
    const matches = findMatches("hello world hello", "hello");
    expect(matches).toHaveLength(2);
    expect(matches[0]).toEqual({ start: 0, end: 5, line: 1 });
    expect(matches[1]).toEqual({ start: 12, end: 17, line: 1 });
  });

  it("is case-insensitive by default", () => {
    const matches = findMatches("Hello HELLO hello", "hello");
    expect(matches).toHaveLength(3);
  });

  it("respects caseSensitive option", () => {
    const matches = findMatches("Hello HELLO hello", "hello", {
      caseSensitive: true,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].start).toBe(12);
  });

  it("tracks line numbers correctly", () => {
    const text = "line one\nline two\nline three";
    const matches = findMatches(text, "line");
    expect(matches).toHaveLength(3);
    expect(matches[0].line).toBe(1);
    expect(matches[1].line).toBe(2);
    expect(matches[2].line).toBe(3);
  });

  it("returns empty array for empty query", () => {
    expect(findMatches("some text", "")).toEqual([]);
  });

  it("returns empty array for no matches", () => {
    expect(findMatches("hello world", "xyz")).toEqual([]);
  });

  it("handles regex mode", () => {
    const matches = findMatches("cat bat rat", "\\w+at", { regex: true });
    expect(matches).toHaveLength(3);
  });

  it("returns empty for invalid regex", () => {
    const matches = findMatches("test", "[invalid", { regex: true });
    expect(matches).toEqual([]);
  });

  it("handles special characters in literal mode", () => {
    const matches = findMatches("price is $100.00", "$100.00");
    expect(matches).toHaveLength(1);
    expect(matches[0].start).toBe(9);
  });

  it("handles overlapping potential matches", () => {
    const matches = findMatches("aaa", "aa");
    expect(matches).toHaveLength(1); // regex doesn't overlap by default
  });
});

describe("escapeRegex", () => {
  it("escapes special regex characters", () => {
    expect(escapeRegex("$100.00")).toBe("\\$100\\.00");
    expect(escapeRegex("a+b*c?")).toBe("a\\+b\\*c\\?");
    expect(escapeRegex("[test]")).toBe("\\[test\\]");
    expect(escapeRegex("(a|b)")).toBe("\\(a\\|b\\)");
  });

  it("leaves normal characters unchanged", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
  });
});

