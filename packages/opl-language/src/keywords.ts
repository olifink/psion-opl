// Reserved words — LANGUAGE.md §3.2, §5–8, TRANSLATOR.md §3.2.
// OPL is case-insensitive; keywords are listed here in canonical upper case.

export const KEYWORDS = [
  "PROC",
  "ENDP",
  "LOCAL",
  "GLOBAL",
  "DIM",
  "RETURN",
  "REM",
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
  "AND",
  "OR",
  "NOT",
  "MOD",
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
