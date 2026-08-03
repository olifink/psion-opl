import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";
import { SemanticType } from "./semantic-types.js";
import type { SemanticResult } from "./semantic.js";

function analyzeSource(source: string): SemanticResult {
  const { tokens } = lex(source);
  const { program } = parse(tokens);
  return analyze(program);
}

describe("analyze — LANGUAGE.md §12 example program", () => {
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

  test("no diagnostics", () => {
    expect(analyzeSource(source).diagnostics).toEqual([]);
  });

  test("symbol tables", () => {
    const { globals, procedures } = analyzeSource(source);
    expect(globals.resolve("g%")).toMatchObject({ type: SemanticType.INT, arrayLength: null });

    const main = procedures.get("MAIN")!;
    expect(main).toMatchObject({ name: "main", returnType: SemanticType.FLOAT, params: [] }); // no suffix = FLOAT

    const add = procedures.get("ADD")!;
    expect(add).toMatchObject({
      name: "add",
      returnType: SemanticType.FLOAT, // "add" has no suffix either
      params: [
        { name: "a%", type: SemanticType.INT },
        { name: "b%", type: SemanticType.INT },
      ],
    });
  });
});

describe("analyze — real device golden file", () => {
  test("examples/hello-new.opl has no diagnostics", () => {
    // hi:'s zero-arg call resolves against the real "hi" PROC; GET/PRINT
    // aren't validated (no built-in signature table yet, PLAN.md) but don't
    // produce false-positive diagnostics either.
    const path = fileURLToPath(new URL("../../../examples/hello-new.opl", import.meta.url));
    const source = readFileSync(path, "utf8");
    expect(analyzeSource(source).diagnostics).toEqual([]);
  });
});

describe("analyze — duplicate names", () => {
  test("duplicate global", () => {
    const { diagnostics } = analyzeSource("GLOBAL x%\nGLOBAL x%\nPROC p:\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "x%" });
  });

  test("duplicate procedure", () => {
    const { diagnostics } = analyzeSource("PROC p:\nENDP\nPROC p:\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "p" });
  });

  test("duplicate parameter", () => {
    const { diagnostics } = analyzeSource("PROC p:(a%,a%)\nENDP");
    expect(diagnostics).toHaveLength(1);
  });

  test("duplicate label", () => {
    const { diagnostics } = analyzeSource("PROC p:\nfoo::\nfoo::\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "foo" });
  });
});

describe("analyze — LOCAL ordering (LANGUAGE.md §6.5)", () => {
  test("LOCAL after a non-LOCAL statement is flagged", () => {
    const { diagnostics } = analyzeSource("PROC p:\nx%=1\nLOCAL y%\nENDP");
    expect(diagnostics.some((d) => (d as { message: string }).message.includes("LOCAL must appear"))).toBe(true);
  });

  test("multiple LOCAL statements at the top are fine", () => {
    const { diagnostics } = analyzeSource("PROC p:\nLOCAL x%\nLOCAL y%\nx%=1\nENDP");
    expect(diagnostics).toEqual([]);
  });
});

describe("analyze — scope resolution", () => {
  test("undeclared variable in an assignment target", () => {
    const { diagnostics } = analyzeSource("PROC p:\nx%=1\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "x%" });
  });

  test("undeclared variable in an expression", () => {
    const { diagnostics } = analyzeSource("PROC p:\nLOCAL x%\nx%=y%\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "y%" });
  });

  test("a global is visible inside a procedure", () => {
    const { diagnostics } = analyzeSource("GLOBAL g%\nPROC p:\ng%=1\nENDP");
    expect(diagnostics).toEqual([]);
  });

  test("a local in one procedure isn't visible in another", () => {
    const { diagnostics } = analyzeSource("PROC p:\nLOCAL x%\nENDP\nPROC q:\nx%=1\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "x%" });
  });
});

describe("analyze — procedure calls", () => {
  test("wrong argument count", () => {
    const { diagnostics } = analyzeSource("PROC p:\nq:(1)\nENDP\nPROC q:(a%,b%)\nRETURN a%+b%\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "q" });
  });

  test("undefined procedure", () => {
    const { diagnostics } = analyzeSource("PROC p:\nnope:(1)\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "nope" });
  });

  test("forward reference to a procedure declared later is fine", () => {
    const { diagnostics } = analyzeSource("PROC p:\nq:\nENDP\nPROC q:\nENDP");
    expect(diagnostics).toEqual([]);
  });
});

describe("analyze — labels (GOTO/ONERR/VECTOR)", () => {
  test("forward reference to a label declared later is fine", () => {
    const { diagnostics } = analyzeSource("PROC p:\nGOTO there::\nPRINT 1\nthere::\nENDP");
    expect(diagnostics).toEqual([]);
  });

  test("undefined label in GOTO", () => {
    const { diagnostics } = analyzeSource("PROC p:\nGOTO nowhere::\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "nowhere" });
  });

  test("ONERR OFF needs no label", () => {
    const { diagnostics } = analyzeSource("PROC p:\nONERR OFF\nENDP");
    expect(diagnostics).toEqual([]);
  });

  test("a label declared inside a nested IF is still procedure-scoped", () => {
    const { diagnostics } = analyzeSource("PROC p:\nGOTO there::\nIF 1\nthere::\nENDIF\nENDP");
    expect(diagnostics).toEqual([]);
  });

  test("VECTOR's labels are resolved", () => {
    const { diagnostics } = analyzeSource("PROC p:\nVECTOR 1\none,missing\nENDV\none::\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "missing" });
  });
});

describe("analyze — arrays and string lengths (LANGUAGE.md §4.2)", () => {
  test("array and string-array sizes are recorded", () => {
    const { globals } = analyzeSource("GLOBAL a%(10), s$(5), names$(5,8)\nPROC p:\nENDP");
    expect(globals.resolve("a%")).toMatchObject({ arrayLength: 10, stringMaxLength: null });
    expect(globals.resolve("s$")).toMatchObject({ arrayLength: null, stringMaxLength: 5 });
    expect(globals.resolve("names$")).toMatchObject({ arrayLength: 5, stringMaxLength: 8 });
  });

  test("a scalar STRING with no length is flagged", () => {
    const { diagnostics } = analyzeSource("GLOBAL s$\nPROC p:\nENDP");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ token: "s$" });
  });

  test("a non-literal array size is flagged (TRANSLATOR.md §5.4)", () => {
    const { diagnostics } = analyzeSource("GLOBAL n%\nGLOBAL a%(n%)\nPROC p:\nENDP");
    expect(diagnostics).toHaveLength(1);
  });
});

describe("analyze — type checking (real translator's OutputOperatorL rules)", () => {
  test("string concatenation with + is fine", () => {
    const { diagnostics } = analyzeSource('PROC p:\nLOCAL a$(5), b$(5), s$(20)\ns$=a$+b$\nENDP');
    expect(diagnostics).toEqual([]);
  });

  test("string comparison is fine", () => {
    const { diagnostics } = analyzeSource('PROC p:\nLOCAL a$(5), b$(5)\nIF a$=b$\nENDIF\nENDP');
    expect(diagnostics).toEqual([]);
  });

  test("subtracting strings is a type mismatch", () => {
    const { diagnostics } = analyzeSource("PROC p:\nLOCAL a$(5), b$(5), x%\nx%=a$-b$\nENDP");
    expect(diagnostics.some((d) => (d as { code: string }).code === "-2")).toBe(true);
  });

  test("unary minus on a string is a type mismatch", () => {
    const { diagnostics } = analyzeSource("PROC p:\nLOCAL a$(5), x%\nx%=-a$\nENDP");
    expect(diagnostics.some((d) => (d as { code: string }).code === "-2")).toBe(true);
  });

  test("a STRING condition is a type mismatch", () => {
    const { diagnostics } = analyzeSource('PROC p:\nLOCAL a$(5)\nIF a$\nENDIF\nENDP');
    expect(diagnostics.some((d) => (d as { code: string }).code === "-2")).toBe(true);
  });

  test("assigning a string literal to a numeric variable is a type mismatch", () => {
    const { diagnostics } = analyzeSource('PROC p:\nLOCAL x%\nx%="hi"\nENDP');
    expect(diagnostics.some((d) => (d as { code: string }).code === "-2")).toBe(true);
  });

  test("INT/LONG/FLOAT mix freely (promotion, not a mismatch)", () => {
    const { diagnostics } = analyzeSource("PROC p:\nLOCAL i%, l&, f\nf=i%+l&\nENDP");
    expect(diagnostics).toEqual([]);
  });
});
