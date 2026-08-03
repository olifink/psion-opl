import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import type { Program } from "./ast.js";

function parseSource(source: string): { program: Program; diagnostics: unknown[] } {
  const lexed = lex(source);
  const parsed = parse(lexed.tokens);
  return { program: parsed.program, diagnostics: [...lexed.diagnostics, ...parsed.diagnostics] };
}

describe("parse — LANGUAGE.md §12 example program", () => {
  const source = `
GLOBAL g%

PROC main:
  LOCAL x%
  g%=10
  x%=add:(5,3)
  PRINT x%
ENDP

PROC add:(a%,b%)
  RETURN a%+b%
ENDP
`;

  test("parses with no diagnostics", () => {
    const { diagnostics } = parseSource(source);
    expect(diagnostics).toEqual([]);
  });

  test("produces the expected AST", () => {
    const { program } = parseSource(source);
    expect(program.globals).toEqual([{ kind: "GlobalDecl", names: ["g%"], line: 2 }]);
    expect(program.procedures).toHaveLength(2);

    const [main, add] = program.procedures;
    expect(main).toMatchObject({
      kind: "ProcDecl",
      name: "main",
      params: [],
      body: [
        { kind: "LocalStmt", names: ["x%"] },
        { kind: "AssignStmt", target: "g%", value: { kind: "IntLiteral", value: 10 } },
        {
          kind: "AssignStmt",
          target: "x%",
          value: {
            kind: "ProcCallExpr",
            name: "add",
            args: [
              { kind: "IntLiteral", value: 5 },
              { kind: "IntLiteral", value: 3 },
            ],
          },
        },
        { kind: "CommandStmt", name: "PRINT", args: [{ kind: "Identifier", name: "x%" }] },
      ],
    });

    expect(add).toMatchObject({
      kind: "ProcDecl",
      name: "add",
      params: ["a%", "b%"],
      body: [
        {
          kind: "ReturnStmt",
          value: {
            kind: "BinaryExpr",
            operator: "+",
            left: { kind: "Identifier", name: "a%" },
            right: { kind: "Identifier", name: "b%" },
          },
        },
      ],
    });
  });
});

describe("parse — real device golden file", () => {
  test("examples/hello-new.opl", () => {
    const path = fileURLToPath(new URL("../../../examples/hello-new.opl", import.meta.url));
    const source = readFileSync(path, "utf8");
    const { program, diagnostics } = parseSource(source);

    expect(diagnostics).toEqual([]);
    expect(program.procedures).toHaveLength(2);

    const [hello, hi] = program.procedures;
    // `hi:` is a zero-arg call to the second procedure, `GET` is a bare built-in
    // command with zero args — confirms same-line lookahead correctly stops
    // GET's arg_list before consuming ENDP.
    expect(hello).toMatchObject({
      name: "hello",
      params: [],
      body: [
        { kind: "ProcCallStmt", name: "hi", args: [] },
        { kind: "CommandStmt", name: "GET", args: [] },
      ],
    });
    expect(hi).toMatchObject({
      name: "hi",
      params: [],
      body: [{ kind: "CommandStmt", name: "PRINT", args: [{ kind: "StringLiteral", value: "Hello World" }] }],
    });
  });
});

describe("parse — same-line disambiguation", () => {
  test("a zero-arg command immediately followed by another command on the next line", () => {
    const { program, diagnostics } = parseSource("PROC p:\nGET\nPRINT x%\nENDP");
    expect(diagnostics).toEqual([]);
    expect(program.procedures[0]!.body).toMatchObject([
      { kind: "CommandStmt", name: "GET", args: [] },
      { kind: "CommandStmt", name: "PRINT", args: [{ kind: "Identifier", name: "x%" }] },
    ]);
  });

  test("RETURN with no value immediately followed by another statement", () => {
    const { program, diagnostics } = parseSource("PROC p:\nRETURN\nPRINT x%\nENDP");
    expect(diagnostics).toEqual([]);
    expect(program.procedures[0]!.body).toMatchObject([
      { kind: "ReturnStmt", value: null },
      { kind: "CommandStmt", name: "PRINT", args: [{ kind: "Identifier", name: "x%" }] },
    ]);
  });

  test("a command's args are on the same line as the command", () => {
    const { program } = parseSource("PROC p:\nPRINT x%\nENDP");
    expect(program.procedures[0]!.body).toMatchObject([
      { kind: "CommandStmt", name: "PRINT", args: [{ kind: "Identifier", name: "x%" }] },
    ]);
  });
});

describe("parse — control flow", () => {
  test("IF/ELSE/ENDIF", () => {
    const { program, diagnostics } = parseSource(
      'PROC p:\nIF x%>10\nPRINT "big"\nELSE\nPRINT "small"\nENDIF\nENDP',
    );
    expect(diagnostics).toEqual([]);
    expect(program.procedures[0]!.body).toMatchObject([
      {
        kind: "IfStmt",
        condition: { kind: "BinaryExpr", operator: ">" },
        thenBranch: [{ kind: "CommandStmt", name: "PRINT", args: [{ kind: "StringLiteral", value: "big" }] }],
        elseBranch: [{ kind: "CommandStmt", name: "PRINT", args: [{ kind: "StringLiteral", value: "small" }] }],
      },
    ]);
  });

  test("WHILE/ENDWH", () => {
    const { program } = parseSource("PROC p:\nWHILE x%<10\nx%=x%+1\nENDWH\nENDP");
    expect(program.procedures[0]!.body).toMatchObject([
      {
        kind: "WhileStmt",
        condition: { kind: "BinaryExpr", operator: "<" },
        body: [{ kind: "AssignStmt", target: "x%" }],
      },
    ]);
  });

  test("FOR/NEXT", () => {
    const { program } = parseSource("PROC p:\nFOR i%=1 TO 10\nPRINT i%\nNEXT\nENDP");
    expect(program.procedures[0]!.body).toMatchObject([
      {
        kind: "ForStmt",
        variable: "i%",
        from: { kind: "IntLiteral", value: 1 },
        to: { kind: "IntLiteral", value: 10 },
        body: [{ kind: "CommandStmt", name: "PRINT" }],
      },
    ]);
  });

  test("REPEAT/UNTIL", () => {
    const { program } = parseSource("PROC p:\nREPEAT\nx%=x%-1\nUNTIL x%=0\nENDP");
    expect(program.procedures[0]!.body).toMatchObject([
      {
        kind: "RepeatStmt",
        body: [{ kind: "AssignStmt", target: "x%" }],
        condition: { kind: "BinaryExpr", operator: "=" },
      },
    ]);
  });

  test("SELECT/CASE/ENDSEL", () => {
    const { program, diagnostics } = parseSource(
      'PROC p:\nSELECT x%\nCASE 1\nPRINT "one"\nCASE 2\nPRINT "two"\nENDSEL\nENDP',
    );
    expect(diagnostics).toEqual([]);
    expect(program.procedures[0]!.body).toMatchObject([
      {
        kind: "SelectStmt",
        selector: { kind: "Identifier", name: "x%" },
        cases: [
          { value: { kind: "IntLiteral", value: 1 }, body: [{ kind: "CommandStmt", name: "PRINT" }] },
          { value: { kind: "IntLiteral", value: 2 }, body: [{ kind: "CommandStmt", name: "PRINT" }] },
        ],
      },
    ]);
  });

  test("DIM and ONERR", () => {
    const { program, diagnostics } = parseSource("PROC p:\nDIM a%(10), s$(5)\nONERR oops:\nENDP");
    expect(diagnostics).toEqual([]);
    expect(program.procedures[0]!.body).toMatchObject([
      {
        kind: "DimStmt",
        arrays: [
          { name: "a%", size: { kind: "IntLiteral", value: 10 } },
          { name: "s$", size: { kind: "IntLiteral", value: 5 } },
        ],
      },
      { kind: "OnErrStmt", label: "oops" },
    ]);
  });
});

describe("parse — expressions", () => {
  test("* binds tighter than +", () => {
    const { program } = parseSource("PROC p:\nx%=1+2*3\nENDP");
    const stmt = program.procedures[0]!.body[0] as { value: unknown };
    expect(stmt.value).toMatchObject({
      kind: "BinaryExpr",
      operator: "+",
      left: { kind: "IntLiteral", value: 1 },
      right: { kind: "BinaryExpr", operator: "*", left: { kind: "IntLiteral", value: 2 }, right: { kind: "IntLiteral", value: 3 } },
    });
  });

  test("string concatenation with &", () => {
    const { program } = parseSource('PROC p:\ns$=a$&b$&"!"\nENDP');
    const stmt = program.procedures[0]!.body[0] as { value: unknown };
    expect(stmt.value).toMatchObject({
      kind: "BinaryExpr",
      operator: "&",
      left: { kind: "BinaryExpr", operator: "&", left: { kind: "Identifier", name: "a$" }, right: { kind: "Identifier", name: "b$" } },
      right: { kind: "StringLiteral", value: "!" },
    });
  });

  test("parenthesized expression and unary NOT/-", () => {
    const { program } = parseSource("PROC p:\nx%=NOT(a%=1)\ny%=-x%\nENDP");
    const [assign1, assign2] = program.procedures[0]!.body as { value: unknown }[];
    expect(assign1!.value).toMatchObject({
      kind: "UnaryExpr",
      operator: "NOT",
      operand: { kind: "BinaryExpr", operator: "=" },
    });
    expect(assign2!.value).toMatchObject({ kind: "UnaryExpr", operator: "-", operand: { kind: "Identifier", name: "x%" } });
  });
});

describe("parse — error recovery", () => {
  test("a missing IF condition produces a diagnostic but does not throw or hang", () => {
    // IF's condition is mandatory, and ENDP can't start an expression, so this
    // must fail to parse a condition at all — a real error, not a greedy misparse.
    const { program, diagnostics } = parseSource("PROC p:\nIF\nENDP");
    expect(diagnostics.length).toBeGreaterThan(0);
    // Best-effort: the well-formed PROC shell is still recovered even though its
    // malformed IF was skipped.
    expect(program.procedures).toHaveLength(1);
    expect(program.procedures[0]!.name).toBe("p");
  });

  test("a missing ENDIF (jumping straight to an enclosing ENDP) does not hang", () => {
    // Regression test: parseStmtList used to only stop at its OWN terminator
    // set, so a nested block missing its terminator (ENDIF here) would loop
    // forever re-throwing on the enclosing ENDP it could never consume.
    const { program, diagnostics } = parseSource("PROC p:\nIF x%=1\nPRINT x%\nENDP");
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(program.procedures).toHaveLength(1);
  });
});
