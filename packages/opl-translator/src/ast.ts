// Stage 2 output — TRANSLATOR.md §4 (Grammar). See parser.ts for the (documented)
// places this AST goes beyond §4's literal grammar text to cover constructs
// LANGUAGE.md describes in prose but the formal grammar omits.

export interface Program {
  kind: "Program";
  globals: GlobalDecl[];
  procedures: ProcDecl[];
}

export interface GlobalDecl {
  kind: "GlobalDecl";
  names: string[];
  line: number;
}

export interface ProcDecl {
  kind: "ProcDecl";
  name: string;
  params: string[];
  body: Stmt[];
  line: number;
}

export type Stmt =
  | LocalStmt
  | DimStmt
  | OnErrStmt
  | AssignStmt
  | IfStmt
  | WhileStmt
  | ForStmt
  | RepeatStmt
  | SelectStmt
  | ReturnStmt
  | ProcCallStmt
  | CommandStmt;

export interface LocalStmt {
  kind: "LocalStmt";
  names: string[];
  line: number;
}

export interface DimStmt {
  kind: "DimStmt";
  arrays: { name: string; size: Expr }[];
  line: number;
}

export interface OnErrStmt {
  kind: "OnErrStmt";
  label: string;
  line: number;
}

export interface AssignStmt {
  kind: "AssignStmt";
  target: string;
  value: Expr;
  line: number;
}

export interface IfStmt {
  kind: "IfStmt";
  condition: Expr;
  thenBranch: Stmt[];
  elseBranch: Stmt[] | null;
  line: number;
}

export interface WhileStmt {
  kind: "WhileStmt";
  condition: Expr;
  body: Stmt[];
  line: number;
}

export interface ForStmt {
  kind: "ForStmt";
  variable: string;
  from: Expr;
  to: Expr;
  body: Stmt[];
  line: number;
}

export interface RepeatStmt {
  kind: "RepeatStmt";
  body: Stmt[];
  condition: Expr;
  line: number;
}

export interface SelectStmt {
  kind: "SelectStmt";
  selector: Expr;
  cases: { value: Expr; body: Stmt[] }[];
  line: number;
}

export interface ReturnStmt {
  kind: "ReturnStmt";
  value: Expr | null;
  line: number;
}

/**
 * Colon-form call in statement position, e.g. `hi:` or `add:(5,3)` used only for
 * its side effect. Lexically identical to a label declaration — see the LABEL
 * comment in opl-language's tokens.ts. Disambiguating "is this actually a label"
 * needs the full symbol table (which labels does ONERR reference in this
 * procedure?) and is deferred to semantic analysis, not decided here.
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
