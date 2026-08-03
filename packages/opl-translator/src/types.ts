// Shapes exposed to the IDE — TRANSLATOR.md §8 (Diagnostics), §10 (IDE Integration).

export interface Diagnostic {
  line: number;
  column: number;
  token: string;
  code: string;
  message: string;
}

export interface ProcedureTableEntry {
  name: string;
  paramCount: number;
  returnType: "INT" | "LONG" | "FLOAT" | "STRING";
  qcodeOffset: number;
}

export interface TranslateResult {
  tokens: unknown[];
  ast: unknown;
  symbolTable: unknown;
  procedureTable: ProcedureTableEntry[];
  literalPool: unknown[];
  qcode: Uint8Array;
  diagnostics: Diagnostic[];
  /** Assembled .OPO binary — OPO-FORMAT.md. */
  opo: Uint8Array;
}
