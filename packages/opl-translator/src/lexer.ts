// Stage 1 of the translator pipeline — TRANSLATOR.md §3 (Lexical Analysis).

import { isKeyword, OPERATORS, TokenType, TYPE_SUFFIXES, type Token } from "@psion-opl/opl-language";
import { OplErrorCode } from "@psion-opl/opl-shared";
import type { Diagnostic } from "./types.js";

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

/** Word-form operators (AND/OR/NOT), derived from the single OPERATORS list so the
 * set can't drift from it — TRANSLATOR.md §3.2, LANGUAGE.md §8.1. */
const WORD_OPERATORS: ReadonlySet<string> = new Set(OPERATORS.filter((op) => /^[A-Z]+$/.test(op)));

const isLetter = (ch: string | undefined): ch is string => !!ch && /[A-Za-z]/.test(ch);
const isDigit = (ch: string | undefined): ch is string => !!ch && /[0-9]/.test(ch);
const isIdentChar = (ch: string | undefined): ch is string => !!ch && /[A-Za-z0-9_]/.test(ch);
const isSuffixChar = (ch: string | undefined): ch is keyof typeof TYPE_SUFFIXES =>
  !!ch && ch in TYPE_SUFFIXES;

/**
 * TRANSLATOR.md §3.1 Input Normalisation: CRLF -> LF, trailing whitespace stripped
 * per line. Case is preserved (handled token-by-token below, not here) and tabs are
 * NOT rewritten to spaces — they're expanded only for column-tracking purposes while
 * scanning, so no source bytes are altered ahead of lexing.
 */
function normalize(source: string): string {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");
}

export function lex(source: string): LexResult {
  const text = normalize(source);
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];

  let i = 0;
  let line = 1;
  let col = 1;

  const peek = (offset = 0): string | undefined => text[i + offset];

  function advance(): string {
    const ch = text[i];
    i++;
    if (ch === "\n") {
      line++;
      col = 1;
    } else if (ch === "\t") {
      // Tab stops every 8 columns (TRANSLATOR.md §3.1: "tab width = 8").
      col += 8 - ((col - 1) % 8);
    } else {
      col++;
    }
    return ch;
  }

  function error(startLine: number, startCol: number, token: string, message: string): void {
    diagnostics.push({
      line: startLine,
      column: startCol,
      token,
      code: String(OplErrorCode.SYNTAX_ERROR),
      message,
    });
  }

  function scanString(): Token {
    const startLine = line;
    const startCol = col;
    advance(); // opening quote
    let value = "";
    for (;;) {
      const ch = peek();
      if (ch === undefined || ch === "\n") {
        error(startLine, startCol, '"', "Unterminated string literal");
        break;
      }
      if (ch === '"') {
        advance();
        if (peek() === '"') {
          // Doubled quote = one literal quote character inside the string.
          value += '"';
          advance();
          continue;
        }
        break;
      }
      value += advance();
    }
    return { type: TokenType.STRING_LITERAL, value, line: startLine, column: startCol };
  }

  function scanNumber(): Token {
    const startLine = line;
    const startCol = col;
    let text_ = "";
    while (isDigit(peek())) text_ += advance();
    let isFloat = false;
    if (peek() === "." && isDigit(peek(1))) {
      isFloat = true;
      text_ += advance(); // '.'
      while (isDigit(peek())) text_ += advance();
    }
    return {
      type: isFloat ? TokenType.FLOAT_LITERAL : TokenType.INT_LITERAL,
      value: text_,
      line: startLine,
      column: startCol,
    };
  }

  /** Identifiers, structural keywords, word-operators, and REM comments — all start
   * with a letter (LANGUAGE.md §5.1), so they share one scan routine. */
  function scanWord(): Token | null {
    const startLine = line;
    const startCol = col;
    let word = "";
    while (isIdentChar(peek())) word += advance();
    const upper = word.toUpperCase();

    if (upper === "REM") {
      while (peek() !== undefined && peek() !== "\n") advance();
      return null;
    }
    if (WORD_OPERATORS.has(upper)) {
      return { type: TokenType.OPERATOR, value: upper, line: startLine, column: startCol };
    }
    if (isKeyword(upper)) {
      return { type: TokenType.KEYWORD, value: upper, line: startLine, column: startCol };
    }
    // Only plain identifiers may carry a type suffix (LANGUAGE.md §5.1) — keywords
    // and word-operators are matched above before a suffix would be consumed, so a
    // stray suffix character right after one of them is reported as unexpected
    // rather than silently swallowed.
    let suffix = "";
    if (isSuffixChar(peek())) suffix = advance();
    return { type: TokenType.IDENTIFIER, value: word + suffix, line: startLine, column: startCol };
  }

  function scanSymbol(): Token | null {
    const startLine = line;
    const startCol = col;
    const ch = advance();

    if (ch === "<") {
      if (peek() === "=") {
        advance();
        return { type: TokenType.OPERATOR, value: "<=", line: startLine, column: startCol };
      }
      if (peek() === ">") {
        advance();
        return { type: TokenType.OPERATOR, value: "<>", line: startLine, column: startCol };
      }
      return { type: TokenType.OPERATOR, value: "<", line: startLine, column: startCol };
    }
    if (ch === ">") {
      if (peek() === "=") {
        advance();
        return { type: TokenType.OPERATOR, value: ">=", line: startLine, column: startCol };
      }
      return { type: TokenType.OPERATOR, value: ">", line: startLine, column: startCol };
    }
    if (ch === "*" && peek() === "*") {
      advance();
      return { type: TokenType.OPERATOR, value: "**", line: startLine, column: startCol };
    }
    if ("+-*/=".includes(ch)) {
      return { type: TokenType.OPERATOR, value: ch, line: startLine, column: startCol };
    }
    if (":;,()".includes(ch)) {
      return { type: TokenType.PUNCTUATION, value: ch, line: startLine, column: startCol };
    }

    error(startLine, startCol, ch, `Unexpected character '${ch}'`);
    return null;
  }

  while (i < text.length) {
    const ch = peek()!;

    if (ch === " " || ch === "\t" || ch === "\n") {
      advance();
      continue;
    }

    let token: Token | null;
    if (ch === '"') {
      token = scanString();
    } else if (isDigit(ch)) {
      token = scanNumber();
    } else if (isLetter(ch)) {
      token = scanWord();
    } else {
      token = scanSymbol();
    }

    if (token) tokens.push(token);
  }

  tokens.push({ type: TokenType.EOF, value: "", line, column: col });

  return { tokens, diagnostics };
}
