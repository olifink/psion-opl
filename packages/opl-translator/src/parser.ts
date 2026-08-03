// Stage 2 of the translator pipeline — TRANSLATOR.md §4 (Grammar).
//
// TRANSLATOR.md's formal grammar is incomplete on its own terms: it can't parse
// LANGUAGE.md §12's own canonical example (no productions for LOCAL, DIM, GLOBAL's
// body, or ONERR; "primary" omits procedure calls entirely even though §6.4 shows
// `add:(2,3)` as an expression; the expr grammar has no tier for the `&` string
// operator LANGUAGE.md §8.1 lists). Rather than guess at the *binary* format the
// way OPO-FORMAT.md apparently did, these gaps are filled here only where
// LANGUAGE.md's prose or examples/hello-new.opl's real source directly evidence
// the construct — each fill is commented at the point it's used. Anything neither
// document nor the real example evidences (e.g. FOR/STEP, parenthesized no-colon
// built-in function calls) is left unimplemented rather than invented.

import { TokenType, type Token } from "@psion-opl/opl-language";
import { OplErrorCode } from "@psion-opl/opl-shared";
import type {
  AssignStmt,
  BinaryExpr,
  CommandStmt,
  DimStmt,
  Expr,
  ForStmt,
  GlobalDecl,
  IfStmt,
  LocalStmt,
  OnErrStmt,
  ProcCallExpr,
  ProcCallStmt,
  ProcDecl,
  Program,
  RepeatStmt,
  ReturnStmt,
  SelectStmt,
  Stmt,
  UnaryExpr,
  WhileStmt,
} from "./ast.js";
import type { Diagnostic } from "./types.js";

export interface ParseResult {
  program: Program;
  diagnostics: Diagnostic[];
}

/** Keywords that end an enclosing block — used both to terminate stmt_list loops
 * and as synchronization points after a parse error. */
const BLOCK_TERMINATORS = new Set(["ENDP", "ENDIF", "ELSE", "ENDWH", "NEXT", "UNTIL", "ENDSEL", "CASE"]);

class ParseError extends Error {}

class Parser {
  private pos = 0;
  readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly tokens: Token[]) {}

  // --- token cursor helpers ---------------------------------------------------

  private peek(offset = 0): Token {
    const tok = this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
    return tok!;
  }

  private previous(): Token {
    return this.tokens[this.pos - 1]!;
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private check(type: TokenType, value?: string): boolean {
    const tok = this.peek();
    if (tok.type !== type) return false;
    return value === undefined || tok.value === value;
  }

  private match(type: TokenType, value?: string): boolean {
    if (!this.check(type, value)) return false;
    this.advance();
    return true;
  }

  private expect(type: TokenType, value: string | undefined, message: string): Token {
    if (this.check(type, value)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private error(token: Token, message: string): ParseError {
    this.diagnostics.push({
      line: token.line,
      column: token.column,
      token: token.value || "<EOF>",
      code: String(OplErrorCode.SYNTAX_ERROR),
      message,
    });
    return new ParseError(message);
  }

  /** Statements never legitimately begin with a raw operator, so after an error
   * the safest resync point is the next statement separator, block terminator,
   * or top-level PROC/GLOBAL keyword. */
  private synchronize(): void {
    while (!this.isAtEnd()) {
      if (this.check(TokenType.PUNCTUATION, ":")) {
        this.advance();
        return;
      }
      const tok = this.peek();
      if (tok.type === TokenType.KEYWORD && (BLOCK_TERMINATORS.has(tok.value) || tok.value === "PROC" || tok.value === "GLOBAL")) {
        return;
      }
      this.advance();
    }
  }

  /** Same-line requirement for optional trailing expressions (RETURN's expr,
   * a bare command's args). OPL is line-oriented (LANGUAGE.md §2; TRANSLATOR.md
   * §3.4 treats newline as a statement separator on par with ":"), and our lexer
   * doesn't emit newline tokens, so a following IDENTIFIER on a NEW line must be
   * read as the next statement, not as this one's optional tail — otherwise
   * `GET` immediately followed by `PRINT x%` on the next line would wrongly
   * parse as `GET` taking `PRINT` as an argument. */
  private looksLikeExprStart(): boolean {
    const tok = this.peek();
    if (tok.line !== this.previous().line) return false;
    if (tok.type === TokenType.INT_LITERAL || tok.type === TokenType.FLOAT_LITERAL || tok.type === TokenType.STRING_LITERAL) return true;
    if (tok.type === TokenType.IDENTIFIER) return true;
    if (tok.type === TokenType.PUNCTUATION && tok.value === "(") return true;
    if (tok.type === TokenType.OPERATOR && (tok.value === "-" || tok.value === "NOT")) return true;
    return false;
  }

  // --- program ------------------------------------------------------------

  parseProgram(): Program {
    const globals: GlobalDecl[] = [];
    const procedures: ProcDecl[] = [];

    while (!this.isAtEnd()) {
      try {
        if (this.check(TokenType.KEYWORD, "GLOBAL")) {
          globals.push(this.parseGlobalDecl());
        } else if (this.check(TokenType.KEYWORD, "PROC")) {
          procedures.push(this.parseProcDecl());
        } else {
          throw this.error(this.peek(), "Expected GLOBAL or PROC declaration");
        }
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        this.synchronize();
      }
    }

    return { kind: "Program", globals, procedures };
  }

  /** GLOBAL's declaration-list body isn't in TRANSLATOR.md's formal grammar
   * (only LANGUAGE.md §5.2's prose: "declared outside any procedure"); mirrored
   * on LOCAL's documented shape (§6.5). */
  private parseGlobalDecl(): GlobalDecl {
    const line = this.peek().line;
    this.advance(); // GLOBAL
    const names = [this.expect(TokenType.IDENTIFIER, undefined, "Expected identifier after GLOBAL").value];
    while (this.match(TokenType.PUNCTUATION, ",")) {
      names.push(this.expect(TokenType.IDENTIFIER, undefined, "Expected identifier").value);
    }
    return { kind: "GlobalDecl", names, line };
  }

  private parseProcDecl(): ProcDecl {
    const line = this.peek().line;
    this.advance(); // PROC
    const name = this.expect(TokenType.IDENTIFIER, undefined, "Expected procedure name").value;
    this.expect(TokenType.PUNCTUATION, ":", "Expected ':' after procedure name");

    const params: string[] = [];
    if (this.match(TokenType.PUNCTUATION, "(")) {
      if (!this.check(TokenType.PUNCTUATION, ")")) {
        params.push(this.expect(TokenType.IDENTIFIER, undefined, "Expected parameter name").value);
        while (this.match(TokenType.PUNCTUATION, ",")) {
          params.push(this.expect(TokenType.IDENTIFIER, undefined, "Expected parameter name").value);
        }
      }
      this.expect(TokenType.PUNCTUATION, ")", "Expected ')' after parameter list");
    }

    const body = this.parseStmtList();
    this.expect(TokenType.KEYWORD, "ENDP", "Expected ENDP to close procedure");
    return { kind: "ProcDecl", name, params, body, line };
  }

  // --- statements -----------------------------------------------------------

  /**
   * Stops at ANY block-terminator keyword, not just the one the caller actually
   * expects next. The caller's own `expect(KEYWORD, "ENDIF", ...)` etc. right
   * after this returns is what validates/diagnoses the specific terminator. This
   * matters for malformed input like a missing ENDIF that jumps straight to
   * ENDP: if this loop only stopped for its "own" terminator set, it would keep
   * re-throwing on the same ENDP token forever (synchronize() can't advance past
   * a token that's a terminator for an *enclosing* frame). Stopping unconditionally
   * lets the mismatch surface as one clean "expected ENDIF" diagnostic instead,
   * and unwinds a level so the outer frame gets a turn at the terminator it does
   * recognize — which matters for an IDE parsing a program mid-edit.
   */
  private parseStmtList(): Stmt[] {
    const stmts: Stmt[] = [];
    while (!this.isAtEnd() && !(this.peek().type === TokenType.KEYWORD && BLOCK_TERMINATORS.has(this.peek().value))) {
      if (this.match(TokenType.PUNCTUATION, ":")) continue; // empty statement between separators
      try {
        stmts.push(this.parseStmt());
        this.match(TokenType.PUNCTUATION, ":"); // optional same-line statement separator
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        this.synchronize();
      }
    }
    return stmts;
  }

  private parseStmt(): Stmt {
    const tok = this.peek();

    if (tok.type === TokenType.KEYWORD) {
      switch (tok.value) {
        case "LOCAL":
          return this.parseLocalStmt();
        case "DIM":
          return this.parseDimStmt();
        case "ONERR":
          return this.parseOnErrStmt();
        case "IF":
          return this.parseIfStmt();
        case "WHILE":
          return this.parseWhileStmt();
        case "FOR":
          return this.parseForStmt();
        case "REPEAT":
          return this.parseRepeatStmt();
        case "SELECT":
          return this.parseSelectStmt();
        case "RETURN":
          return this.parseReturnStmt();
      }
    }

    if (tok.type === TokenType.IDENTIFIER) {
      return this.parseIdentLedStmt();
    }

    throw this.error(tok, `Unexpected token '${tok.value}'`);
  }

  /** LOCAL's list form is documented only in LANGUAGE.md §6.5 prose, not in
   * TRANSLATOR.md's formal grammar. */
  private parseLocalStmt(): LocalStmt {
    const line = this.peek().line;
    this.advance(); // LOCAL
    const names = [this.expect(TokenType.IDENTIFIER, undefined, "Expected identifier after LOCAL").value];
    while (this.match(TokenType.PUNCTUATION, ",")) {
      names.push(this.expect(TokenType.IDENTIFIER, undefined, "Expected identifier").value);
    }
    return { kind: "LocalStmt", names, line };
  }

  /** DIM's shape is documented only in LANGUAGE.md §4.2 prose ("DIM a%(10)"). */
  private parseDimStmt(): DimStmt {
    const line = this.peek().line;
    this.advance(); // DIM
    const arrays: DimStmt["arrays"] = [this.parseDimItem()];
    while (this.match(TokenType.PUNCTUATION, ",")) {
      arrays.push(this.parseDimItem());
    }
    return { kind: "DimStmt", arrays, line };
  }

  private parseDimItem(): { name: string; size: Expr } {
    const name = this.expect(TokenType.IDENTIFIER, undefined, "Expected array name").value;
    this.expect(TokenType.PUNCTUATION, "(", "Expected '(' after array name");
    const size = this.parseExpr();
    this.expect(TokenType.PUNCTUATION, ")", "Expected ')' after array size");
    return { name, size };
  }

  /** ONERR's target shape is documented only in LANGUAGE.md §11.2 prose ("ONERR label:"). */
  private parseOnErrStmt(): OnErrStmt {
    const line = this.peek().line;
    this.advance(); // ONERR
    const label = this.expect(TokenType.IDENTIFIER, undefined, "Expected label after ONERR").value;
    this.expect(TokenType.PUNCTUATION, ":", "Expected ':' after ONERR label");
    return { kind: "OnErrStmt", label, line };
  }

  private parseIfStmt(): IfStmt {
    const line = this.peek().line;
    this.advance(); // IF
    const condition = this.parseExpr();
    const thenBranch = this.parseStmtList();
    let elseBranch: Stmt[] | null = null;
    if (this.match(TokenType.KEYWORD, "ELSE")) {
      elseBranch = this.parseStmtList();
    }
    this.expect(TokenType.KEYWORD, "ENDIF", "Expected ENDIF");
    return { kind: "IfStmt", condition, thenBranch, elseBranch, line };
  }

  private parseWhileStmt(): WhileStmt {
    const line = this.peek().line;
    this.advance(); // WHILE
    const condition = this.parseExpr();
    const body = this.parseStmtList();
    this.expect(TokenType.KEYWORD, "ENDWH", "Expected ENDWH");
    return { kind: "WhileStmt", condition, body, line };
  }

  /** No STEP clause: neither LANGUAGE.md nor TRANSLATOR.md documents one, and
   * examples/hello-new.opl doesn't exercise FOR at all, so it's left unsupported
   * rather than guessed at. */
  private parseForStmt(): ForStmt {
    const line = this.peek().line;
    this.advance(); // FOR
    const variable = this.expect(TokenType.IDENTIFIER, undefined, "Expected loop variable").value;
    this.expect(TokenType.OPERATOR, "=", "Expected '=' after loop variable");
    const from = this.parseExpr();
    this.expect(TokenType.KEYWORD, "TO", "Expected TO");
    const to = this.parseExpr();
    const body = this.parseStmtList();
    this.expect(TokenType.KEYWORD, "NEXT", "Expected NEXT");
    return { kind: "ForStmt", variable, from, to, body, line };
  }

  private parseRepeatStmt(): RepeatStmt {
    const line = this.peek().line;
    this.advance(); // REPEAT
    const body = this.parseStmtList();
    this.expect(TokenType.KEYWORD, "UNTIL", "Expected UNTIL");
    const condition = this.parseExpr();
    return { kind: "RepeatStmt", body, condition, line };
  }

  private parseSelectStmt(): SelectStmt {
    const line = this.peek().line;
    this.advance(); // SELECT
    const selector = this.parseExpr();
    const cases: SelectStmt["cases"] = [];
    while (this.match(TokenType.KEYWORD, "CASE")) {
      const value = this.parseExpr();
      const body = this.parseStmtList();
      cases.push({ value, body });
    }
    this.expect(TokenType.KEYWORD, "ENDSEL", "Expected ENDSEL");
    return { kind: "SelectStmt", selector, cases, line };
  }

  private parseReturnStmt(): ReturnStmt {
    const line = this.peek().line;
    this.advance(); // RETURN
    const value = this.looksLikeExprStart() ? this.parseExpr() : null;
    return { kind: "ReturnStmt", value, line };
  }

  /**
   * Dispatches on what follows a leading IDENTIFIER — the only point where
   * OPL's three call conventions collide lexically:
   *   ident "=" expr                    -> assignment
   *   ident ":" ("(" args ")")?         -> user PROC call (LANGUAGE.md §6.4;
   *                                        real device source's bare `hi:`)
   *   ident args?                       -> bare built-in command (real device
   *                                        source's `GET` and `PRINT "..."`)
   */
  private parseIdentLedStmt(): Stmt {
    const line = this.peek().line;
    const name = this.advance().value;

    if (this.match(TokenType.OPERATOR, "=")) {
      const value = this.parseExpr();
      return { kind: "AssignStmt", target: name, value, line } satisfies AssignStmt;
    }

    if (this.match(TokenType.PUNCTUATION, ":")) {
      const args = this.match(TokenType.PUNCTUATION, "(") ? this.parseArgListUntilCloseParen() : [];
      return { kind: "ProcCallStmt", name, args, line } satisfies ProcCallStmt;
    }

    const args = this.looksLikeExprStart() ? this.parseArgList() : [];
    return { kind: "CommandStmt", name, args, line } satisfies CommandStmt;
  }

  private parseArgList(): Expr[] {
    const args = [this.parseExpr()];
    while (this.match(TokenType.PUNCTUATION, ",")) {
      args.push(this.parseExpr());
    }
    return args;
  }

  private parseArgListUntilCloseParen(): Expr[] {
    const args = this.check(TokenType.PUNCTUATION, ")") ? [] : this.parseArgList();
    this.expect(TokenType.PUNCTUATION, ")", "Expected ')' after argument list");
    return args;
  }

  // --- expressions (TRANSLATOR.md §4.5, with `&` and calls filled in) --------

  private parseExpr(): Expr {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.check(TokenType.OPERATOR, "OR")) {
      const line = this.advance().line;
      left = { kind: "BinaryExpr", operator: "OR", left, right: this.parseLogicalAnd(), line };
    }
    return left;
  }

  private parseLogicalAnd(): Expr {
    let left = this.parseEquality();
    while (this.check(TokenType.OPERATOR, "AND")) {
      const line = this.advance().line;
      left = { kind: "BinaryExpr", operator: "AND", left, right: this.parseEquality(), line };
    }
    return left;
  }

  private parseEquality(): Expr {
    let left = this.parseRelational();
    while (this.check(TokenType.OPERATOR, "=") || this.check(TokenType.OPERATOR, "<>")) {
      const op = this.advance();
      left = { kind: "BinaryExpr", operator: op.value, left, right: this.parseRelational(), line: op.line };
    }
    return left;
  }

  private parseRelational(): Expr {
    let left = this.parseAdditive();
    while (
      this.check(TokenType.OPERATOR, "<") ||
      this.check(TokenType.OPERATOR, ">") ||
      this.check(TokenType.OPERATOR, "<=") ||
      this.check(TokenType.OPERATOR, ">=")
    ) {
      const op = this.advance();
      left = { kind: "BinaryExpr", operator: op.value, left, right: this.parseAdditive(), line: op.line };
    }
    return left;
  }

  /**
   * `&` (string concatenation, LANGUAGE.md §8.1) has no tier in TRANSLATOR.md
   * §4.5's formal expr grammar at all. Placed at the additive tier as the most
   * common choice among BASIC-family languages with a dedicated concat operator;
   * flagged here rather than asserted as verified.
   */
  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.check(TokenType.OPERATOR, "+") || this.check(TokenType.OPERATOR, "-") || this.check(TokenType.OPERATOR, "&")) {
      const op = this.advance();
      left = { kind: "BinaryExpr", operator: op.value, left, right: this.parseMultiplicative(), line: op.line };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.check(TokenType.OPERATOR, "*") || this.check(TokenType.OPERATOR, "/") || this.check(TokenType.OPERATOR, "MOD")) {
      const op = this.advance();
      left = { kind: "BinaryExpr", operator: op.value, left, right: this.parseUnary(), line: op.line };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.check(TokenType.OPERATOR, "NOT") || this.check(TokenType.OPERATOR, "-")) {
      const op = this.advance();
      const operand = this.parseUnary();
      return { kind: "UnaryExpr", operator: op.value as "-" | "NOT", operand, line: op.line } satisfies UnaryExpr;
    }
    return this.parsePrimary();
  }

  /**
   * `primary ::= literal | ident | "(" expr ")"` per TRANSLATOR.md §4.5 doesn't
   * include a call form at all, yet LANGUAGE.md §6.4 shows `add:(2,3)` used as
   * an expression's value — added here as `proc_call`, the colon-form call.
   */
  private parsePrimary(): Expr {
    const tok = this.peek();

    if (tok.type === TokenType.INT_LITERAL) {
      this.advance();
      return { kind: "IntLiteral", value: Number(tok.value), line: tok.line };
    }
    if (tok.type === TokenType.FLOAT_LITERAL) {
      this.advance();
      return { kind: "FloatLiteral", value: Number(tok.value), line: tok.line };
    }
    if (tok.type === TokenType.STRING_LITERAL) {
      this.advance();
      return { kind: "StringLiteral", value: tok.value, line: tok.line };
    }
    if (tok.type === TokenType.IDENTIFIER) {
      this.advance();
      if (this.match(TokenType.PUNCTUATION, ":")) {
        const args = this.match(TokenType.PUNCTUATION, "(") ? this.parseArgListUntilCloseParen() : [];
        return { kind: "ProcCallExpr", name: tok.value, args, line: tok.line } satisfies ProcCallExpr;
      }
      return { kind: "Identifier", name: tok.value, line: tok.line };
    }
    if (this.match(TokenType.PUNCTUATION, "(")) {
      const inner = this.parseExpr();
      this.expect(TokenType.PUNCTUATION, ")", "Expected ')' after expression");
      return inner;
    }

    throw this.error(tok, `Expected an expression, found '${tok.value}'`);
  }
}

export function parse(tokens: Token[]): ParseResult {
  const parser = new Parser(tokens);
  const program = parser.parseProgram();
  return { program, diagnostics: parser.diagnostics };
}
