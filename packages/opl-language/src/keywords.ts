// Reserved words — LANGUAGE.md §3.2, §5–8, TRANSLATOR.md §3.2.
// OPL is case-insensitive; keywords are listed here in canonical upper case.
//
// This list was corrected after cross-checking against the real Symbian OPL
// translator source and the official Psion Series 5 manual (see CLAUDE.md).
// FOR/TO/NEXT(-as-loop)/REPEAT/SELECT/CASE/ENDSEL/DIM do not exist in real
// OPL and were removed; DO/ELSEIF/VECTOR/ENDV/GOTO were added.
//
// AND/OR/NOT are deliberately excluded: TRANSLATOR.md §3.2 and LANGUAGE.md §8.1
// classify them as operators (see tokens.ts OPERATORS), not structural keywords.
// REM is excluded too: it introduces a comment (TRANSLATOR.md §3.3) and is stripped
// during lexing rather than surfaced as a token at all.

export const KEYWORDS = [
  "PROC",
  "ENDP",
  "LOCAL",
  "GLOBAL",
  "RETURN",
  "IF",
  "ELSEIF",
  "ELSE",
  "ENDIF",
  "WHILE",
  "ENDWH",
  "DO",
  "UNTIL",
  "VECTOR",
  "ENDV",
  "GOTO",
  "ONERR",
] as const;

export type Keyword = (typeof KEYWORDS)[number];

export function isKeyword(word: string): word is Keyword {
  return (KEYWORDS as readonly string[]).includes(word.toUpperCase());
}

/**
 * Identifier type suffixes — LANGUAGE.md §5.1. A suffix is optional; an
 * identifier with none of these is FLOAT (there is no `#` suffix — confirmed
 * against the real translator's suffix table, see CLAUDE.md).
 */
export const TYPE_SUFFIXES = {
  "%": "INT",
  "&": "LONG",
  $: "STRING",
} as const;

export type TypeSuffix = keyof typeof TYPE_SUFFIXES;

/** The type of an identifier with no suffix at all — LANGUAGE.md §5.1. */
export const DEFAULT_TYPE = "FLOAT";
