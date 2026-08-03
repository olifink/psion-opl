import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OPCODE_TABLE, type OpcodeDef } from "./opcodes.js";

// Guards against OPCODE_TABLE drifting from the canonical docs/opo-table.csv
// (see the "QCode fidelity" invariant in CLAUDE.md).
const csvPath = fileURLToPath(new URL("../../../docs/opo-table.csv", import.meta.url));
const csvRows: OpcodeDef[] = readFileSync(csvPath, "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [opcodeHex, opcodeDec, name, category, stackEffect, operandFormat, ...descParts] =
      line.split(",");
    return {
      opcodeHex,
      opcode: Number(opcodeDec),
      name,
      category,
      stackEffect,
      operandFormat,
      description: descParts.join(","),
    } as OpcodeDef;
  });

describe("OPCODE_TABLE matches docs/opo-table.csv", () => {
  test("same number of entries", () => {
    expect(OPCODE_TABLE.length).toBe(csvRows.length);
  });

  test("every row matches by opcode", () => {
    for (const row of csvRows) {
      const entry = OPCODE_TABLE.find((op) => op.opcode === row.opcode);
      expect(entry).toEqual(row);
    }
  });
});
