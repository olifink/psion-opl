// Token model — TRANSLATOR.md §3.2 (Tokens).

export enum TokenType {
  KEYWORD = "KEYWORD",
  IDENTIFIER = "IDENTIFIER",
  INT_LITERAL = "INT_LITERAL",
  FLOAT_LITERAL = "FLOAT_LITERAL",
  STRING_LITERAL = "STRING_LITERAL",
  OPERATOR = "OPERATOR",
  PUNCTUATION = "PUNCTUATION",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * Operators — LANGUAGE.md §8.1. There is no `MOD` and no `&`/`|` (`&` is
 * exclusively the LONG type suffix, see keywords.ts TYPE_SUFFIXES); string
 * concatenation is type-overloaded onto `+`. `**` is exponentiation.
 * Corrected after cross-checking the real translator source and the
 * official Series 5 manual — see CLAUDE.md.
 */
export const OPERATORS = [
  "+",
  "-",
  "*",
  "/",
  "**",
  "=",
  "<>",
  "<",
  ">",
  "<=",
  ">=",
  "AND",
  "OR",
  "NOT",
] as const;

/** Punctuation — TRANSLATOR.md §3.2. */
export const PUNCTUATION = [":", ";", ",", "(", ")"] as const;
