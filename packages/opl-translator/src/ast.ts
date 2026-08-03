// Stage 2 output — TRANSLATOR.md §4 (Grammar). See parser.ts for the (documented)
// places this AST goes beyond §4's literal grammar text to cover constructs
// LANGUAGE.md describes in prose but the formal grammar omits.
//
// Revised after cross-checking an earlier draft against the real Symbian OPL
// translator source and the official Psion Series 5 manual (CLAUDE.md).
// ForStmt/RepeatStmt/SelectStmt/DimStmt are gone — those constructs don't
// exist in real OPL. DoStmt, VectorStmt, GotoStmt, and LabelDecl were added.

export interface Program {
  kind: "Program";
  globals: GlobalDecl[];
  procedures: ProcDecl[];
}

export interface GlobalDecl {
  kind: "GlobalDecl";
  vars: VarDecl[];
  line: number;
}

export interface ProcDecl {
  kind: "ProcDecl";
  name: string;
  params: string[];
  body: Stmt[];
  line: number;
}

/**
 * A declared variable, possibly with array/string-length dimensions —
 * LANGUAGE.md §4.2. `dimensions` is empty for a plain scalar (INT/LONG/FLOAT),
 * has one entry for a scalar STRING's max length or a non-string array's
 * element count, and two entries for a string array's (count, max length).
 * Telling these apart depends on the name's suffix and is a semantic-analysis
 * concern, not a parse-time one.
 */
export interface VarDecl {
  name: string;
  dimensions: Expr[];
}

export type Stmt =
  | LocalStmt
  | OnErrStmt
  | GotoStmt
  | LabelDecl
  | AssignStmt
  | IfStmt
  | WhileStmt
  | DoStmt
  | VectorStmt
  | ReturnStmt
  | ProcCallStmt
  | CommandStmt;

export interface LocalStmt {
  kind: "LocalStmt";
  vars: VarDecl[];
  line: number;
}

/** `ONERR label` / `ONERR label::` / `ONERR OFF` — LANGUAGE.md §11.2. `label: null` means OFF. */
export interface OnErrStmt {
  kind: "OnErrStmt";
  label: string | null;
  line: number;
}

/** `GOTO label` / `GOTO label::` — LANGUAGE.md §7.5. */
export interface GotoStmt {
  kind: "GotoStmt";
  label: string;
  line: number;
}

/** `name::` — a label declaration, LANGUAGE.md §7.5. Always a double colon;
 * a single colon is a procedure call (ProcCallStmt/ProcCallExpr) instead, so
 * this is unambiguous at parse time. */
export interface LabelDecl {
  kind: "LabelDecl";
  name: string;
  line: number;
}

export interface AssignStmt {
  kind: "AssignStmt";
  target: string;
  value: Expr;
  line: number;
}

/** `IF cond ... (ELSEIF cond ...)* (ELSE ...)? ENDIF` — LANGUAGE.md §7.2. */
export interface IfStmt {
  kind: "IfStmt";
  condition: Expr;
  thenBranch: Stmt[];
  elseIfs: { condition: Expr; body: Stmt[] }[];
  elseBranch: Stmt[] | null;
  line: number;
}

export interface WhileStmt {
  kind: "WhileStmt";
  condition: Expr;
  body: Stmt[];
  line: number;
}

/** `DO ... UNTIL cond` — test-last loop, LANGUAGE.md §7.3. */
export interface DoStmt {
  kind: "DoStmt";
  body: Stmt[];
  condition: Expr;
  line: number;
}

/** `VECTOR expr label[,label]* ENDV` — computed jump, LANGUAGE.md §7.4. */
export interface VectorStmt {
  kind: "VectorStmt";
  selector: Expr;
  labels: string[];
  line: number;
}

export interface ReturnStmt {
  kind: "ReturnStmt";
  value: Expr | null;
  line: number;
}

/**
 * Colon-form call in statement position, e.g. `hi:` or `add:(5,3)` used only
 * for its side effect — LANGUAGE.md §6.4. Always a *single* colon; a label
 * declaration/reference always uses a double colon (LabelDecl), so this is
 * unambiguous at parse time.
 */
export interface ProcCallStmt {
  kind: "ProcCallStmt";
  name: string;
  args: Expr[];
  line: number;
}

/**
 * Bare built-in command form with no colon and no enclosing parens, e.g.
 * `PRINT "Hello World"` or zero-arg `GET` — evidenced directly by
 * examples/hello-new.opl. Only ever a statement, never an expression.
 */
export interface CommandStmt {
  kind: "CommandStmt";
  name: string;
  args: Expr[];
  line: number;
}

export type Expr =
  | IntLiteral
  | FloatLiteral
  | StringLiteral
  | Identifier
  | ProcCallExpr
  | UnaryExpr
  | BinaryExpr;

export interface IntLiteral {
  kind: "IntLiteral";
  value: number;
  line: number;
}

export interface FloatLiteral {
  kind: "FloatLiteral";
  value: number;
  line: number;
}

export interface StringLiteral {
  kind: "StringLiteral";
  value: string;
  line: number;
}

export interface Identifier {
  kind: "Identifier";
  name: string;
  line: number;
}

/** Colon-form call used as a value, e.g. `add:(5,3)` in `x%=add:(5,3)` — LANGUAGE.md §6.4. */
export interface ProcCallExpr {
  kind: "ProcCallExpr";
  name: string;
  args: Expr[];
  line: number;
}

export interface UnaryExpr {
  kind: "UnaryExpr";
  operator: "-" | "NOT";
  operand: Expr;
  line: number;
}

export interface BinaryExpr {
  kind: "BinaryExpr";
  operator: string;
  left: Expr;
  right: Expr;
  line: number;
}
