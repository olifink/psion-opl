// Stage 3 of the translator pipeline — TRANSLATOR.md §5 (Semantic Analysis).
//
// Scope: symbol tables (globals, per-procedure locals/params, procedures),
// scope resolution ("undeclared variable"), duplicate-name detection
// (globals, locals/params, procedures, labels), procedure-call argument-count
// checking, label resolution (GOTO/ONERR/VECTOR against declared labels,
// forward references allowed), and type checking/coercion for expressions
// and conditions, all directly per the real translator's rules (see
// semantic-types.ts for citations).
//
// Explicitly NOT in scope yet (see PLAN.md): built-in function/command
// signatures (CommandStmt's target name and argument count/types aren't
// validated — there's no table of the ~300 real built-ins yet, only their
// argument *expressions* are still resolved/type-checked), and the `%`
// percentage-operator/character-literal duality (LANGUAGE.md §8.1).
//
// AST nodes only carry `line`, not `column` (see ast.ts) — diagnostics below
// use `column: 1` as a placeholder rather than inventing a fake precise
// column.

import type {
  AssignStmt,
  BinaryExpr,
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
import { OplErrorCode } from "@psion-opl/opl-shared";
import { COMPARISON_OPERATORS, LOGICAL_OPERATORS, promote, SemanticType, STRING_ALLOWED_OPERATORS, typeFromSuffix } from "./semantic-types.js";
import { Scope, type ProcedureSymbol, type VariableSymbol } from "./symbols.js";
import type { Diagnostic } from "./types.js";

export interface SemanticResult {
  globals: Scope;
  procedures: Map<string, ProcedureSymbol>;
  diagnostics: Diagnostic[];
}

interface Ctx {
  scope: Scope;
  procedures: ReadonlyMap<string, ProcedureSymbol>;
  labels: ReadonlySet<string>;
  diagnostics: Diagnostic[];
}

function diag(line: number, token: string, message: string, code: OplErrorCode = OplErrorCode.SYNTAX_ERROR): Diagnostic {
  return { line, column: 1, token, code: String(code), message };
}

export function analyze(program: Program): SemanticResult {
  const diagnostics: Diagnostic[] = [];
  const globalScope = new Scope();

  for (const decl of program.globals) {
    declareVars(decl.vars, globalScope, diagnostics, decl.line);
  }

  // Procedure signatures are collected before any body is analyzed, so
  // procedures can call each other regardless of declaration order.
  const procedures = new Map<string, ProcedureSymbol>();
  for (const proc of program.procedures) {
    const key = proc.name.toUpperCase();
    if (procedures.has(key)) {
      diagnostics.push(diag(proc.line, proc.name, `Duplicate procedure "${proc.name}"`));
      continue;
    }
    procedures.set(key, {
      name: proc.name,
      returnType: typeFromSuffix(proc.name),
      params: proc.params.map((p) => ({ name: p, type: typeFromSuffix(p), arrayLength: null, stringMaxLength: null })),
      line: proc.line,
    });
  }

  for (const proc of program.procedures) {
    analyzeProc(proc, globalScope, procedures, diagnostics);
  }

  return { globals: globalScope, procedures, diagnostics };
}

/** `ident ( "(" expr ("," expr)? ")" )?` — validates and declares one
 * variable, computing array-length/string-max-length from the dimension
 * expressions (LANGUAGE.md §4.2). */
function declareVar(v: VarDecl, scope: Scope, diagnostics: Diagnostic[], line: number): void {
  const type = typeFromSuffix(v.name);
  const dims = v.dimensions;

  if (type === SemanticType.STRING && dims.length === 0) {
    diagnostics.push(diag(line, v.name, `STRING variable "${v.name}" must have a max length, e.g. ${v.name}(20)`));
  }
  if (type !== SemanticType.STRING && dims.length > 1) {
    diagnostics.push(diag(line, v.name, `"${v.name}" is not a STRING but has ${dims.length} sizes (only an array element count is allowed)`));
  }
  if (type === SemanticType.STRING && dims.length > 2) {
    diagnostics.push(diag(line, v.name, `"${v.name}" has too many sizes (a STRING takes at most element-count, max-length)`));
  }

  const literalDims = dims.map((d) => {
    if (d.kind !== "IntLiteral") {
      diagnostics.push(diag(d.line, v.name, `Array/string size must be a literal integer (TRANSLATOR.md §5.4)`));
      return null;
    }
    return d.value;
  });

  let arrayLength: number | null = null;
  let stringMaxLength: number | null = null;
  if (type === SemanticType.STRING) {
    if (dims.length === 1) stringMaxLength = literalDims[0] ?? null;
    else if (dims.length === 2) {
      arrayLength = literalDims[0] ?? null;
      stringMaxLength = literalDims[1] ?? null;
    }
  } else if (dims.length === 1) {
    arrayLength = literalDims[0] ?? null;
  }

  const sym: VariableSymbol = { name: v.name, type, arrayLength, stringMaxLength };
  if (!scope.declare(sym)) {
    diagnostics.push(diag(line, v.name, `"${v.name}" is already declared in this scope`));
  }
}

function declareVars(vars: VarDecl[], scope: Scope, diagnostics: Diagnostic[], line: number): void {
  for (const v of vars) declareVar(v, scope, diagnostics, line);
}

/** Collects every LabelDecl name reachable in a procedure body, including
 * inside nested IF/WHILE/DO blocks — labels are procedure-scoped, not
 * block-scoped (LANGUAGE.md §7.5), and may be referenced before their
 * declaration (matching the real translator's forward-reference handling in
 * LabelSymbolL), so this is a separate pass done before resolving GOTO/
 * ONERR/VECTOR targets. */
function collectLabels(stmts: Stmt[], labels: Set<string>, diagnostics: Diagnostic[]): void {
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case "LabelDecl": {
        const key = stmt.name.toUpperCase();
        if (labels.has(key)) {
          diagnostics.push(diag(stmt.line, stmt.name, `Duplicate label "${stmt.name}"`));
        } else {
          labels.add(key);
        }
        break;
      }
      case "IfStmt":
        collectLabels(stmt.thenBranch, labels, diagnostics);
        for (const elseIf of stmt.elseIfs) collectLabels(elseIf.body, labels, diagnostics);
        if (stmt.elseBranch) collectLabels(stmt.elseBranch, labels, diagnostics);
        break;
      case "WhileStmt":
      case "DoStmt":
        collectLabels(stmt.body, labels, diagnostics);
        break;
    }
  }
}

function analyzeProc(proc: ProcDecl, globalScope: Scope, procedures: ReadonlyMap<string, ProcedureSymbol>, diagnostics: Diagnostic[]): void {
  const scope = new Scope(globalScope);

  for (const p of proc.params) {
    const sym: VariableSymbol = { name: p, type: typeFromSuffix(p), arrayLength: null, stringMaxLength: null };
    if (!scope.declare(sym)) {
      diagnostics.push(diag(proc.line, p, `Parameter "${p}" is already declared`));
    }
  }

  // LANGUAGE.md §6.5: LOCAL statements must be the first statements in a
  // procedure body, immediately after the parameter list.
  let seenNonLocal = false;
  for (const stmt of proc.body) {
    if (stmt.kind === "LocalStmt") {
      if (seenNonLocal) {
        diagnostics.push(diag(stmt.line, "LOCAL", "LOCAL must appear before any other statement in a procedure (LANGUAGE.md §6.5)"));
      }
      declareVars(stmt.vars, scope, diagnostics, stmt.line);
    } else {
      seenNonLocal = true;
    }
  }

  const labels = new Set<string>();
  collectLabels(proc.body, labels, diagnostics);

  const ctx: Ctx = { scope, procedures, labels, diagnostics };
  for (const stmt of proc.body) analyzeStmt(stmt, ctx, procedures.get(proc.name.toUpperCase())!);
}

function resolveLabel(name: string, line: number, ctx: Ctx): void {
  if (!ctx.labels.has(name.toUpperCase())) {
    ctx.diagnostics.push(diag(line, name, `Undefined label "${name}"`));
  }
}

function analyzeStmt(stmt: Stmt, ctx: Ctx, proc: ProcedureSymbol): void {
  switch (stmt.kind) {
    case "LocalStmt":
      // Declared in a pre-pass (analyzeProc) so forward-order doesn't matter.
      break;
    case "AssignStmt":
      analyzeAssign(stmt, ctx);
      break;
    case "IfStmt":
      analyzeIf(stmt, ctx, proc);
      break;
    case "WhileStmt":
      analyzeWhile(stmt, ctx, proc);
      break;
    case "DoStmt":
      analyzeDo(stmt, ctx, proc);
      break;
    case "VectorStmt":
      analyzeVector(stmt, ctx);
      break;
    case "ReturnStmt":
      analyzeReturn(stmt, ctx, proc);
      break;
    case "ProcCallStmt":
      analyzeProcCall(stmt, ctx);
      break;
    case "CommandStmt":
      analyzeCommand(stmt, ctx);
      break;
    case "OnErrStmt":
      analyzeOnErr(stmt, ctx);
      break;
    case "GotoStmt":
      analyzeGoto(stmt, ctx);
      break;
    case "LabelDecl":
      // Already collected; nothing further to check.
      break;
  }
}

function analyzeAssign(stmt: AssignStmt, ctx: Ctx): void {
  const targetSym = ctx.scope.resolve(stmt.target);
  if (!targetSym) {
    ctx.diagnostics.push(diag(stmt.line, stmt.target, `Undeclared variable "${stmt.target}"`));
  }
  const valueType = inferExprType(stmt.value, ctx);
  if (targetSym && (targetSym.type === SemanticType.STRING) !== (valueType === SemanticType.STRING)) {
    ctx.diagnostics.push(diag(stmt.line, stmt.target, `Type mismatch assigning to "${stmt.target}"`, OplErrorCode.TYPE_MISMATCH));
  }
}

/** IF/WHILE/DO conditions must not be STRING-typed — real translator's
 * ConditionalExpressionL: `if (type==EString) TypeMismatchL();`. */
function checkConditionType(expr: Expr, ctx: Ctx): void {
  if (inferExprType(expr, ctx) === SemanticType.STRING) {
    ctx.diagnostics.push(diag(expr.line, "", "A condition cannot be a STRING expression", OplErrorCode.TYPE_MISMATCH));
  }
}

function analyzeIf(stmt: IfStmt, ctx: Ctx, proc: ProcedureSymbol): void {
  checkConditionType(stmt.condition, ctx);
  for (const s of stmt.thenBranch) analyzeStmt(s, ctx, proc);
  for (const elseIf of stmt.elseIfs) {
    checkConditionType(elseIf.condition, ctx);
    for (const s of elseIf.body) analyzeStmt(s, ctx, proc);
  }
  if (stmt.elseBranch) for (const s of stmt.elseBranch) analyzeStmt(s, ctx, proc);
}

function analyzeWhile(stmt: WhileStmt, ctx: Ctx, proc: ProcedureSymbol): void {
  checkConditionType(stmt.condition, ctx);
  for (const s of stmt.body) analyzeStmt(s, ctx, proc);
}

function analyzeDo(stmt: DoStmt, ctx: Ctx, proc: ProcedureSymbol): void {
  for (const s of stmt.body) analyzeStmt(s, ctx, proc);
  checkConditionType(stmt.condition, ctx);
}

function analyzeVector(stmt: VectorStmt, ctx: Ctx): void {
  // Assumed numeric-only, consistent with the condition rule above and the
  // manual's "VECTOR i%" convention — not independently re-verified for
  // VECTOR specifically.
  checkConditionType(stmt.selector, ctx);
  for (const label of stmt.labels) resolveLabel(label, stmt.line, ctx);
}

function analyzeReturn(stmt: ReturnStmt, ctx: Ctx, proc: ProcedureSymbol): void {
  if (!stmt.value) return;
  const valueType = inferExprType(stmt.value, ctx);
  if ((valueType === SemanticType.STRING) !== (proc.returnType === SemanticType.STRING)) {
    ctx.diagnostics.push(diag(stmt.line, proc.name, `RETURN type doesn't match "${proc.name}"'s declared return type`, OplErrorCode.TYPE_MISMATCH));
  }
}

/** Colon-form calls resolve against the procedure table and their argument
 * count is checked; there is no per-argument type table yet (LANGUAGE.md
 * doesn't document by-value coercion rules for proc arguments beyond
 * "passed by value", §6.2), so only the count is validated. */
function analyzeProcCall(stmt: ProcCallStmt, ctx: Ctx): void {
  const sym = ctx.procedures.get(stmt.name.toUpperCase());
  if (!sym) {
    ctx.diagnostics.push(diag(stmt.line, stmt.name, `Undefined procedure "${stmt.name}"`));
  } else if (stmt.args.length !== sym.params.length) {
    ctx.diagnostics.push(
      diag(stmt.line, stmt.name, `"${stmt.name}" expects ${sym.params.length} argument(s), got ${stmt.args.length}`),
    );
  }
  for (const arg of stmt.args) inferExprType(arg, ctx);
}

/** Bare built-in commands (PRINT, GET, ...) aren't validated against a
 * signature yet — there's no table of the ~300 real built-ins (PLAN.md).
 * Their argument expressions are still resolved/type-checked, since that's
 * independent of knowing the command's own signature. */
function analyzeCommand(stmt: CommandStmt, ctx: Ctx): void {
  for (const arg of stmt.args) inferExprType(arg, ctx);
}

function analyzeOnErr(stmt: OnErrStmt, ctx: Ctx): void {
  if (stmt.label !== null) resolveLabel(stmt.label, stmt.line, ctx);
}

function analyzeGoto(stmt: GotoStmt, ctx: Ctx): void {
  resolveLabel(stmt.label, stmt.line, ctx);
}

function inferExprType(expr: Expr, ctx: Ctx): SemanticType {
  switch (expr.kind) {
    case "IntLiteral":
      return SemanticType.INT;
    case "FloatLiteral":
      return SemanticType.FLOAT;
    case "StringLiteral":
      return SemanticType.STRING;
    case "Identifier": {
      const sym = ctx.scope.resolve(expr.name);
      if (!sym) {
        ctx.diagnostics.push(diag(expr.line, expr.name, `Undeclared variable "${expr.name}"`));
        return SemanticType.FLOAT;
      }
      return sym.type;
    }
    case "ProcCallExpr":
      return inferProcCallExprType(expr, ctx);
    case "UnaryExpr":
      return inferUnaryType(expr, ctx);
    case "BinaryExpr":
      return inferBinaryType(expr, ctx);
  }
}

function inferProcCallExprType(expr: ProcCallExpr, ctx: Ctx): SemanticType {
  const sym = ctx.procedures.get(expr.name.toUpperCase());
  for (const arg of expr.args) inferExprType(arg, ctx);
  if (!sym) {
    ctx.diagnostics.push(diag(expr.line, expr.name, `Undefined procedure "${expr.name}"`));
    return SemanticType.FLOAT;
  }
  if (expr.args.length !== sym.params.length) {
    ctx.diagnostics.push(diag(expr.line, expr.name, `"${expr.name}" expects ${sym.params.length} argument(s), got ${expr.args.length}`));
  }
  return sym.returnType;
}

/** Real translator's OutputOperatorL: unary `-`/`NOT` reject STRING operands;
 * `NOT` on a FLOAT operand yields INT, not FLOAT (everything else keeps the
 * operand's type). */
function inferUnaryType(expr: UnaryExpr, ctx: Ctx): SemanticType {
  const operandType = inferExprType(expr.operand, ctx);
  if (operandType === SemanticType.STRING) {
    ctx.diagnostics.push(diag(expr.line, expr.operator, `"${expr.operator}" cannot be applied to a STRING`, OplErrorCode.TYPE_MISMATCH));
    return SemanticType.FLOAT;
  }
  if (expr.operator === "NOT" && operandType === SemanticType.FLOAT) return SemanticType.INT;
  return operandType;
}

/** Real translator's OutputOperatorL: comparisons and AND/OR always yield
 * INT (Word), regardless of operand types; a STRING operand is only valid
 * with a comparison or `+` (semantic-types.ts's STRING_ALLOWED_OPERATORS);
 * otherwise the promoted operand type (INT -> LONG -> FLOAT) is the result. */
function inferBinaryType(expr: BinaryExpr, ctx: Ctx): SemanticType {
  const leftType = inferExprType(expr.left, ctx);
  const rightType = inferExprType(expr.right, ctx);

  if ((leftType === SemanticType.STRING || rightType === SemanticType.STRING) && !STRING_ALLOWED_OPERATORS.has(expr.operator)) {
    ctx.diagnostics.push(diag(expr.line, expr.operator, `"${expr.operator}" cannot be applied to a STRING`, OplErrorCode.TYPE_MISMATCH));
    return leftType === SemanticType.STRING ? rightType : leftType;
  }

  if (COMPARISON_OPERATORS.has(expr.operator) || LOGICAL_OPERATORS.has(expr.operator)) {
    return SemanticType.INT;
  }

  const promoted = promote(leftType, rightType);
  if (promoted === null) {
    // Only reachable if both sides are STRING-incompatible in a way
    // STRING_ALLOWED_OPERATORS didn't already catch (shouldn't happen given
    // the check above runs first), but fall back safely regardless.
    ctx.diagnostics.push(diag(expr.line, expr.operator, `Type mismatch in "${expr.operator}" expression`, OplErrorCode.TYPE_MISMATCH));
    return SemanticType.FLOAT;
  }
  return promoted;
}
