// Stage 2 of the translator pipeline — TRANSLATOR.md §4 (Grammar).
//
// This grammar was revised after cross-checking an earlier draft against the
// real Symbian OPL translator source and the official Psion Series 5 OPL
// manual (see CLAUDE.md for the full findings). The earlier draft included
// several fabricated constructs that don't exist in real OPL — FOR/TO/NEXT,
// REPEAT/UNTIL, SELECT/CASE/ENDSEL, a DIM statement, MOD, `&` as string
// concatenation — all replaced here by what's actually there (DO/UNTIL,
// VECTOR/ENDV, ELSEIF, array declarations folded into GLOBAL/LOCAL, `+` for
// concatenation, GOTO, and double-colon labels).
//
// TRANSLATOR.md §4's formal grammar is still incomplete on its own terms in a
// few places (e.g. "primary" omits procedure calls entirely even though
// LANGUAGE.md §6.4 shows `add:(2,3)` as an expression). Those gaps are filled
// here only where LANGUAGE.md's prose, the real translator source, or the
// official manual directly evidence the construct — each fill is commented at
// the point it's used. The real language's `%`-as-percentage-operator and
// `%`-as-character-literal duality (LANGUAGE.md §8.1) is confirmed to exist
// but deliberately NOT implemented yet — not enough has been verified about it
// to commit to a grammar.

import { TokenType, type Token } from "@psion-opl/opl-language";
import { OplErrorCode } from "@psion-opl/opl-shared";
import type {
  AssignStmt,
  CommandStmt,
  DoStmt,
  Expr,
  GlobalDecl,
  GotoStmt,
  IfStmt,
  LabelDecl,
  LocalStmt,
  OnErrStmt,
  ProcCallExpr,
  ProcCallStmt,
  ProcDecl,
  Program,
  ReturnStmt,
  Stmt,
  UnaryExpr,
  VarDecl,
  VectorStmt,
  WhileStmt,
} from "./ast.js";
import type { Diagnostic } from "./types.js";

export interface ParseResult {
  program: Program;
  diagnostics: Diagnostic[];
}

/** Keywords that end an enclosing block — used both to terminate stmt_list loops
 * and as synchronization points after a parse error. */
const BLOCK_TERMINATORS = new Set(["ENDP", "ENDIF", "ELSEIF", "ELSE", "ENDWH", "UNTIL", "ENDV"]);

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

  /** `ident ( "(" expr ("," expr)? ")" )?` — LANGUAGE.md §4.2. Whether the
   * parenthesised size(s) mean an array element count, a scalar string's max
   * length, or a string array's (count, length) depends on the name's suffix
   * and is left to semantic analysis. */
  private parseVarDecl(): VarDecl {
    const name = this.expect(TokenType.IDENTIFIER, undefined, "Expected a variable name").value;
    const dimensions: Expr[] = [];
    if (this.match(TokenType.PUNCTUATION, "(")) {
      dimensions.push(this.parseExpr());
      if (this.match(TokenType.PUNCTUATION, ",")) {
        dimensions.push(this.parseExpr());
      }
      this.expect(TokenType.PUNCTUATION, ")", "Expected ')' after variable size");
    }
    return { name, dimensions };
  }

  private parseGlobalDecl(): GlobalDecl {
    const line = this.peek().line;
    this.advance(); // GLOBAL
    const vars = [this.parseVarDecl()];
    while (this.match(TokenType.PUNCTUATION, ",")) {
      vars.push(this.parseVarDecl());
    }
    return { kind: "GlobalDecl", vars, line };
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
        case "ONERR":
          return this.parseOnErrStmt();
        case "GOTO":
          return this.parseGotoStmt();
        case "IF":
          return this.parseIfStmt();
        case "WHILE":
          return this.parseWhileStmt();
        case "DO":
          return this.parseDoStmt();
        case "VECTOR":
          return this.parseVectorStmt();
        case "RETURN":
          return this.parseReturnStmt();
      }
    }

    if (tok.type === TokenType.IDENTIFIER) {
      return this.parseIdentLedStmt();
    }

    throw this.error(tok, `Unexpected token '${tok.value}'`);
  }

  private parseLocalStmt(): LocalStmt {
    const line = this.peek().line;
    this.advance(); // LOCAL
    const vars = [this.parseVarDecl()];
    while (this.match(TokenType.PUNCTUATION, ",")) {
      vars.push(this.parseVarDecl());
    }
    return { kind: "LocalStmt", vars, line };
  }

  /** `label_ref ::= ident "::" | ident` — LANGUAGE.md §7.5. Greedily consumes
   * up to two colons if present (handles both the bare and "::" forms; a
   * lone stray single colon is tolerated rather than treated as an error,
   * since it can't be anything else in this position). */
  private parseLabelRef(): string {
    const name = this.expect(TokenType.IDENTIFIER, undefined, "Expected a label").value;
    this.match(TokenType.PUNCTUATION, ":");
    this.match(TokenType.PUNCTUATION, ":");
    return name;
  }

  /** `ONERR (OFF | label_ref)` — LANGUAGE.md §11.2. "OFF" isn't one of our
   * structural keywords (matches real OPL: it's an EKeyword-class command
   * word like PRINT, not an EReserved one), so it arrives as a plain
   * IDENTIFIER and is matched by its text. */
  private parseOnErrStmt(): OnErrStmt {
    const line = this.peek().line;
    this.advance(); // ONERR
    if (this.check(TokenType.IDENTIFIER) && this.peek().value.toUpperCase() === "OFF") {
      this.advance();
      return { kind: "OnErrStmt", label: null, line };
    }
    const label = this.parseLabelRef();
    return { kind: "OnErrStmt", label, line };
  }

  private parseGotoStmt(): GotoStmt {
    const line = this.peek().line;
    this.advance(); // GOTO
    const label = this.parseLabelRef();
    return { kind: "GotoStmt", label, line };
  }

  private parseIfStmt(): IfStmt {
    const line = this.peek().line;
    this.advance(); // IF
    const condition = this.parseExpr();
    const thenBranch = this.parseStmtList();

    const elseIfs: IfStmt["elseIfs"] = [];
    while (this.match(TokenType.KEYWORD, "ELSEIF")) {
      const elseIfCondition = this.parseExpr();
      const body = this.parseStmtList();
      elseIfs.push({ condition: elseIfCondition, body });
    }

    let elseBranch: Stmt[] | null = null;
    if (this.match(TokenType.KEYWORD, "ELSE")) {
      elseBranch = this.parseStmtList();
    }
    this.expect(TokenType.KEYWORD, "ENDIF", "Expected ENDIF");
    return { kind: "IfStmt", condition, thenBranch, elseIfs, elseBranch, line };
  }

  private parseWhileStmt(): WhileStmt {
    const line = this.peek().line;
    this.advance(); // WHILE
    const condition = this.parseExpr();
    const body = this.parseStmtList();
    this.expect(TokenType.KEYWORD, "ENDWH", "Expected ENDWH");
    return { kind: "WhileStmt", condition, body, line };
  }

  private parseDoStmt(): DoStmt {
    const line = this.peek().line;
    this.advance(); // DO
    const body = this.parseStmtList();
    this.expect(TokenType.KEYWORD, "UNTIL", "Expected UNTIL");
    const condition = this.parseExpr();
    return { kind: "DoStmt", body, condition, line };
  }

  /** `VECTOR expr label_ref ("," label_ref)* ENDV` — LANGUAGE.md §7.4. Real
   * OPL's label list can span multiple lines with no comma between the last
   * label of one line and the first of the next (only within a line are they
   * comma-separated) — so rather than requiring a comma, this just consumes
   * one if present and keeps collecting labels until ENDV. */
  private parseVectorStmt(): VectorStmt {
    const line = this.peek().line;
    this.advance(); // VECTOR
    const selector = this.parseExpr();
    const labels: string[] = [];
    while (!this.check(TokenType.KEYWORD, "ENDV") && !this.isAtEnd()) {
      labels.push(this.parseLabelRef());
      this.match(TokenType.PUNCTUATION, ",");
    }
    this.expect(TokenType.KEYWORD, "ENDV", "Expected ENDV");
    return { kind: "VectorStmt", selector, labels, line };
  }

  private parseReturnStmt(): ReturnStmt {
    const line = this.peek().line;
    this.advance(); // RETURN
    const value = this.looksLikeExprStart() ? this.parseExpr() : null;
    return { kind: "ReturnStmt", value, line };
  }

  /**
   * Dispatches on what follows a leading IDENTIFIER — the point where OPL's
   * call/label conventions collide lexically:
   *   ident "=" expr                    -> assignment
   *   ident "::"                        -> label declaration (LabelDecl)
   *   ident ":" ("(" args ")")?         -> user PROC call (LANGUAGE.md §6.4;
   *                                        real device source's bare `hi:`)
   *   ident args?                       -> bare built-in command (real device
   *                                        source's `GET` and `PRINT "..."`)
   * The double-colon check happens before the single-colon one, so this is
   * unambiguous — no semantic-analysis deferral needed here.
   */
  private parseIdentLedStmt(): Stmt {
    const line = this.peek().line;
    const name = this.advance().value;

    if (this.match(TokenType.OPERATOR, "=")) {
      const value = this.parseExpr();
      return { kind: "AssignStmt", target: name, value, line } satisfies AssignStmt;
    }

    if (this.match(TokenType.PUNCTUATION, ":")) {
      if (this.match(TokenType.PUNCTUATION, ":")) {
        return { kind: "LabelDecl", name, line } satisfies LabelDecl;
      }
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

  // --- expressions (TRANSLATOR.md §4.6) --------------------------------------

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

  /** `+` is type-overloaded onto string concatenation as well as numeric
   * addition (LANGUAGE.md §8.1) — that's a semantic-analysis concern, not a
   * grammar one, so it's just a normal additive operator here. There is no
   * `&`/`MOD`. */
  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.check(TokenType.OPERATOR, "+") || this.check(TokenType.OPERATOR, "-")) {
      const op = this.advance();
      left = { kind: "BinaryExpr", operator: op.value, left, right: this.parseMultiplicative(), line: op.line };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.check(TokenType.OPERATOR, "*") || this.check(TokenType.OPERATOR, "/")) {
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
    return this.parsePower();
  }

  /** `**` (exponentiation, LANGUAGE.md §8.1 — confirmed real, e.g.
   * `440*2**(n%/12.0)` in the official manual) is right-associative and binds
   * tighter than unary minus, so `-2**2` is `-(2**2)` = -4, matching common
   * convention (Python, etc.) — `parseUnary` calls this, not the other way
   * around. */
  private parsePower(): Expr {
    const base = this.parsePrimary();
    if (this.check(TokenType.OPERATOR, "**")) {
      const op = this.advance();
      const exponent = this.parsePower();
      return { kind: "BinaryExpr", operator: "**", left: base, right: exponent, line: op.line };
    }
    return base;
  }

  /**
   * `primary ::= literal | ident | proc_call | "(" expr ")"` — TRANSLATOR.md
   * §4.6's `primary` doesn't include a call form at all, yet LANGUAGE.md §6.4
   * shows `add:(2,3)` used as an expression's value — added here as
   * `proc_call`, the single-colon call. A double colon here would be a label,
   * which isn't valid in expression position; this doesn't special-case that
   * (it's not a construct that appears in valid programs).
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
