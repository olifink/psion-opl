import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TokenType } from "@psion-opl/opl-language";
import { lex } from "./lexer.js";

/** Strips line/column so tests can assert on shape without hardcoding positions. */
function shape(tokens: ReturnType<typeof lex>["tokens"]) {
  return tokens.map(({ type, value }) => [type, value]);
}

describe("lex — keywords, identifiers, suffixes", () => {
  test("PROC declaration line", () => {
    const { tokens, diagnostics } = lex("PROC hello:");
    expect(diagnostics).toEqual([]);
    expect(shape(tokens)).toEqual([
      [TokenType.KEYWORD, "PROC"],
      [TokenType.IDENTIFIER, "hello"],
      [TokenType.PUNCTUATION, ":"],
      [TokenType.EOF, ""],
    ]);
  });

  test("case-insensitive keyword matching preserves identifier case", () => {
    const { tokens } = lex("proc Hello:");
    expect(shape(tokens)).toEqual([
      [TokenType.KEYWORD, "PROC"],
      [TokenType.IDENTIFIER, "Hello"],
      [TokenType.PUNCTUATION, ":"],
      [TokenType.EOF, ""],
    ]);
  });

  test("type suffixes attach directly to identifiers", () => {
    const { tokens } = lex("LOCAL x%, y$, z#, w&");
    expect(shape(tokens)).toEqual([
      [TokenType.KEYWORD, "LOCAL"],
      [TokenType.IDENTIFIER, "x%"],
      [TokenType.PUNCTUATION, ","],
      [TokenType.IDENTIFIER, "y$"],
      [TokenType.PUNCTUATION, ","],
      [TokenType.IDENTIFIER, "z#"],
      [TokenType.PUNCTUATION, ","],
      [TokenType.IDENTIFIER, "w&"],
      [TokenType.EOF, ""],
    ]);
  });

  test("a bare identifier with no suffix (built-in call or zero-arg PROC call)", () => {
    const { tokens } = lex("hi:");
    expect(shape(tokens)).toEqual([
      [TokenType.IDENTIFIER, "hi"],
      [TokenType.PUNCTUATION, ":"],
      [TokenType.EOF, ""],
    ]);
  });

  test("string concatenation operator is not swallowed as a LONG suffix", () => {
    const { tokens } = lex("a$&b$");
    expect(shape(tokens)).toEqual([
      [TokenType.IDENTIFIER, "a$"],
      [TokenType.OPERATOR, "&"],
      [TokenType.IDENTIFIER, "b$"],
      [TokenType.EOF, ""],
    ]);
  });
});

describe("lex — literals", () => {
  test("integer literal", () => {
    expect(shape(lex("42").tokens)).toEqual([
      [TokenType.INT_LITERAL, "42"],
      [TokenType.EOF, ""],
    ]);
  });

  test("float literal", () => {
    expect(shape(lex("1.25").tokens)).toEqual([
      [TokenType.FLOAT_LITERAL, "1.25"],
      [TokenType.EOF, ""],
    ]);
  });

  test("a trailing dot with no following digit is not consumed into the number", () => {
    const { tokens } = lex("3.");
    expect(tokens[0]).toMatchObject({ type: TokenType.INT_LITERAL, value: "3" });
  });

  test("string literal", () => {
    expect(shape(lex('"Hello World"').tokens)).toEqual([
      [TokenType.STRING_LITERAL, "Hello World"],
      [TokenType.EOF, ""],
    ]);
  });

  test("doubled quotes inside a string literal are a literal quote character", () => {
    expect(shape(lex('"say ""hi"""').tokens)).toEqual([
      [TokenType.STRING_LITERAL, 'say "hi"'],
      [TokenType.EOF, ""],
    ]);
  });

  test("unterminated string literal is a diagnostic, not a thrown error", () => {
    const { tokens, diagnostics } = lex('"never closed');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ line: 1, column: 1 });
    expect(tokens.at(-1)).toMatchObject({ type: TokenType.EOF });
  });
});

describe("lex — operators, comments, unknown characters", () => {
  test("word operators are OPERATOR tokens, not KEYWORD", () => {
    const { tokens } = lex("a% AND b% OR NOT c% MOD 2");
    expect(shape(tokens)).toEqual([
      [TokenType.IDENTIFIER, "a%"],
      [TokenType.OPERATOR, "AND"],
      [TokenType.IDENTIFIER, "b%"],
      [TokenType.OPERATOR, "OR"],
      [TokenType.OPERATOR, "NOT"],
      [TokenType.IDENTIFIER, "c%"],
      [TokenType.OPERATOR, "MOD"],
      [TokenType.INT_LITERAL, "2"],
      [TokenType.EOF, ""],
    ]);
  });

  test("multi-character comparison operators use longest match", () => {
    expect(shape(lex("<> <= >= < >").tokens)).toEqual([
      [TokenType.OPERATOR, "<>"],
      [TokenType.OPERATOR, "<="],
      [TokenType.OPERATOR, ">="],
      [TokenType.OPERATOR, "<"],
      [TokenType.OPERATOR, ">"],
      [TokenType.EOF, ""],
    ]);
  });

  test("REM comments are stripped and extend to end of line", () => {
    const { tokens } = lex('x%=1 REM ignored : still ignored\ny%=2');
    expect(shape(tokens)).toEqual([
      [TokenType.IDENTIFIER, "x%"],
      [TokenType.OPERATOR, "="],
      [TokenType.INT_LITERAL, "1"],
      [TokenType.IDENTIFIER, "y%"],
      [TokenType.OPERATOR, "="],
      [TokenType.INT_LITERAL, "2"],
      [TokenType.EOF, ""],
    ]);
  });

  test("a word that merely starts with REM is a normal identifier", () => {
    const { tokens } = lex("REMOTE$ = 1");
    expect(tokens[0]).toMatchObject({ type: TokenType.IDENTIFIER, value: "REMOTE$" });
  });

  test("unknown character produces a diagnostic and is skipped", () => {
    const { tokens, diagnostics } = lex("x% = @ 1");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "@", line: 1, column: 6 });
    expect(shape(tokens)).toEqual([
      [TokenType.IDENTIFIER, "x%"],
      [TokenType.OPERATOR, "="],
      [TokenType.INT_LITERAL, "1"],
      [TokenType.EOF, ""],
    ]);
  });
});

describe("lex — real device golden file", () => {
  test("examples/hello-new.opl tokenizes as expected", () => {
    const path = fileURLToPath(new URL("../../../examples/hello-new.opl", import.meta.url));
    const source = readFileSync(path, "utf8");
    const { tokens, diagnostics } = lex(source);

    expect(diagnostics).toEqual([]);
    expect(shape(tokens)).toEqual([
      [TokenType.KEYWORD, "PROC"],
      [TokenType.IDENTIFIER, "hello"],
      [TokenType.PUNCTUATION, ":"],
      // REM line produces no tokens
      [TokenType.IDENTIFIER, "hi"],
      [TokenType.PUNCTUATION, ":"],
      [TokenType.IDENTIFIER, "GET"],
      [TokenType.KEYWORD, "ENDP"],
      [TokenType.KEYWORD, "PROC"],
      [TokenType.IDENTIFIER, "hi"],
      [TokenType.PUNCTUATION, ":"],
      [TokenType.IDENTIFIER, "PRINT"],
      [TokenType.STRING_LITERAL, "Hello World"],
      [TokenType.KEYWORD, "ENDP"],
      [TokenType.EOF, ""],
    ]);
  });
});
