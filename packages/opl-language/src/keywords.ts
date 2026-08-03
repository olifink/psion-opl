// Reserved words — LANGUAGE.md §3.2, §5–8, TRANSLATOR.md §3.2.
// OPL is case-insensitive; keywords are listed here in canonical upper case.
//
// AND/OR/NOT/MOD are deliberately excluded: TRANSLATOR.md §3.2 and LANGUAGE.md §8.1
// classify them as operators (see tokens.ts OPERATORS), not structural keywords.
// REM is excluded too: it introduces a comment (TRANSLATOR.md §3.3) and is stripped
// during lexing rather than surfaced as a token at all.

export const KEYWORDS = [
  "PROC",
  "ENDP",
  "LOCAL",
  "GLOBAL",
  "DIM",
  "RETURN",
  "IF",
  "ELSE",
  "ENDIF",
  "WHILE",
  "ENDWH",
  "FOR",
  "TO",
  "NEXT",
  "REPEAT",
  "UNTIL",
  "SELECT",
  "CASE",
  "ENDSEL",
  "ONERR",
] as const;

export type Keyword = (typeof KEYWORDS)[number];

export function isKeyword(word: string): word is Keyword {
  return (KEYWORDS as readonly string[]).includes(word.toUpperCase());
}

/** Identifier type suffixes — LANGUAGE.md §5.1. */
export const TYPE_SUFFIXES = {
  "%": "INT",
  "&": "LONG",
  "#": "FLOAT",
  $: "STRING",
} as const;

export type TypeSuffix = keyof typeof TYPE_SUFFIXES;
