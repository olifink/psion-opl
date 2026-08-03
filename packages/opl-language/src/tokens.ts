// Token model — TRANSLATOR.md §3.2 (Tokens).

export enum TokenType {
  KEYWORD = "KEYWORD",
  IDENTIFIER = "IDENTIFIER",
  INT_LITERAL = "INT_LITERAL",
  FLOAT_LITERAL = "FLOAT_LITERAL",
  STRING_LITERAL = "STRING_LITERAL",
  OPERATOR = "OPERATOR",
  PUNCTUATION = "PUNCTUATION",
  LABEL = "LABEL",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/** Operators — LANGUAGE.md §8.1. */
export const OPERATORS = [
  "+",
  "-",
  "*",
  "/",
  "MOD",
  "=",
  "<>",
  "<",
  ">",
  "<=",
  ">=",
  "AND",
  "OR",
  "NOT",
  "&",
] as const;

/** Punctuation — TRANSLATOR.md §3.2. */
export const PUNCTUATION = [":", ";", ",", "(", ")"] as const;
