// Canonical QCode opcode table — transcribed from docs/opo-table.csv (see OPO-TABLE.md).
//
// This file must be kept byte-for-byte consistent with docs/opo-table.csv, which is the
// single source of truth per CLAUDE.md's "QCode fidelity" invariant. If the CSV changes,
// update this file to match. A future improvement would be a codegen script that generates
// this file directly from the CSV instead of hand-transcription.

export type OpcodeCategory =
  | "meta"
  | "arithmetic"
  | "comparison"
  | "logical"
  | "control"
  | "procedure"
  | "literal"
  | "load"
  | "store"
  | "system"
  | "string";

export type OperandFormat = "none" | "uint16" | "int16";

export interface OpcodeDef {
  opcodeHex: string;
  opcode: number;
  name: string;
  category: OpcodeCategory;
  stackEffect: string;
  operandFormat: OperandFormat;
  description: string;
}

export const OPCODE_TABLE: readonly OpcodeDef[] = [
  { opcodeHex: "0x00", opcode: 0, name: "NOP", category: "meta", stackEffect: "0", operandFormat: "none", description: "No operation" },
  { opcodeHex: "0x01", opcode: 1, name: "END", category: "meta", stackEffect: "0", operandFormat: "none", description: "End of code block" },

  { opcodeHex: "0x10", opcode: 16, name: "ADD", category: "arithmetic", stackEffect: "-1", operandFormat: "none", description: "Pop two numeric values and push sum" },
  { opcodeHex: "0x11", opcode: 17, name: "SUB", category: "arithmetic", stackEffect: "-1", operandFormat: "none", description: "Pop two numeric values and push difference" },
  { opcodeHex: "0x12", opcode: 18, name: "MUL", category: "arithmetic", stackEffect: "-1", operandFormat: "none", description: "Pop two numeric values and push product" },
  { opcodeHex: "0x13", opcode: 19, name: "DIV", category: "arithmetic", stackEffect: "-1", operandFormat: "none", description: "Pop two numeric values and push quotient" },
  { opcodeHex: "0x14", opcode: 20, name: "MOD", category: "arithmetic", stackEffect: "-1", operandFormat: "none", description: "Pop two INT values and push modulo" },

  { opcodeHex: "0x20", opcode: 32, name: "EQ", category: "comparison", stackEffect: "-1", operandFormat: "none", description: "Pop two values and push 1 if equal else 0" },
  { opcodeHex: "0x21", opcode: 33, name: "NE", category: "comparison", stackEffect: "-1", operandFormat: "none", description: "Pop two values and push 1 if not equal" },
  { opcodeHex: "0x22", opcode: 34, name: "LT", category: "comparison", stackEffect: "-1", operandFormat: "none", description: "Pop two values and push 1 if <" },
  { opcodeHex: "0x23", opcode: 35, name: "GT", category: "comparison", stackEffect: "-1", operandFormat: "none", description: "Pop two values and push 1 if >" },
  { opcodeHex: "0x24", opcode: 36, name: "LE", category: "comparison", stackEffect: "-1", operandFormat: "none", description: "Pop two values and push 1 if <=" },
  { opcodeHex: "0x25", opcode: 37, name: "GE", category: "comparison", stackEffect: "-1", operandFormat: "none", description: "Pop two values and push 1 if >=" },

  { opcodeHex: "0x30", opcode: 48, name: "AND", category: "logical", stackEffect: "-1", operandFormat: "none", description: "Pop two INT values and push logical AND" },
  { opcodeHex: "0x31", opcode: 49, name: "OR", category: "logical", stackEffect: "-1", operandFormat: "none", description: "Pop two INT values and push logical OR" },
  { opcodeHex: "0x32", opcode: 50, name: "NOT", category: "logical", stackEffect: "0", operandFormat: "none", description: "Pop INT and push logical NOT" },

  { opcodeHex: "0x40", opcode: 64, name: "IF", category: "control", stackEffect: "-1", operandFormat: "int16", description: "Conditional jump if false" },
  { opcodeHex: "0x41", opcode: 65, name: "ELSE", category: "control", stackEffect: "0", operandFormat: "int16", description: "Unconditional jump" },
  { opcodeHex: "0x42", opcode: 66, name: "ENDIF", category: "control", stackEffect: "0", operandFormat: "none", description: "End of IF block" },
  { opcodeHex: "0x43", opcode: 67, name: "WHILE", category: "control", stackEffect: "0", operandFormat: "int16", description: "Conditional loop start" },
  { opcodeHex: "0x44", opcode: 68, name: "ENDWH", category: "control", stackEffect: "0", operandFormat: "int16", description: "Loop end jump" },
  { opcodeHex: "0x45", opcode: 69, name: "REPEAT", category: "control", stackEffect: "0", operandFormat: "none", description: "Repeat loop start" },
  { opcodeHex: "0x46", opcode: 70, name: "UNTIL", category: "control", stackEffect: "-1", operandFormat: "int16", description: "Repeat loop end" },
  { opcodeHex: "0x47", opcode: 71, name: "FOR", category: "control", stackEffect: "0", operandFormat: "int16", description: "FOR loop setup" },
  { opcodeHex: "0x48", opcode: 72, name: "NEXT", category: "control", stackEffect: "0", operandFormat: "int16", description: "FOR loop increment" },
  { opcodeHex: "0x49", opcode: 73, name: "SELECT", category: "control", stackEffect: "-1", operandFormat: "int16", description: "Start SELECT block" },
  { opcodeHex: "0x4A", opcode: 74, name: "CASE", category: "control", stackEffect: "-1", operandFormat: "int16", description: "Case match jump" },
  { opcodeHex: "0x4B", opcode: 75, name: "ENDSEL", category: "control", stackEffect: "0", operandFormat: "none", description: "End SELECT block" },

  { opcodeHex: "0x50", opcode: 80, name: "CALL", category: "procedure", stackEffect: "-N", operandFormat: "uint16", description: "Call procedure by index" },
  { opcodeHex: "0x51", opcode: 81, name: "RETURN", category: "procedure", stackEffect: "-N", operandFormat: "none", description: "Return from procedure" },

  { opcodeHex: "0x60", opcode: 96, name: "PUSH_INT_LITERAL", category: "literal", stackEffect: "+1", operandFormat: "uint16", description: "Push INT literal from pool" },
  { opcodeHex: "0x61", opcode: 97, name: "PUSH_LONG_LITERAL", category: "literal", stackEffect: "+1", operandFormat: "uint16", description: "Push LONG literal" },
  { opcodeHex: "0x62", opcode: 98, name: "PUSH_FLOAT_LITERAL", category: "literal", stackEffect: "+1", operandFormat: "uint16", description: "Push FLOAT literal" },
  { opcodeHex: "0x63", opcode: 99, name: "PUSH_STRING_LITERAL", category: "literal", stackEffect: "+1", operandFormat: "uint16", description: "Push STRING literal" },

  { opcodeHex: "0x70", opcode: 112, name: "PUSH_INT_FP", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push INT local/global at FP+offset" },
  { opcodeHex: "0x71", opcode: 113, name: "PUSH_LONG_FP", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push LONG FP+offset" },
  { opcodeHex: "0x72", opcode: 114, name: "PUSH_FLOAT_FP", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push FLOAT FP+offset" },
  { opcodeHex: "0x73", opcode: 115, name: "PUSH_STRING_FP", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push STRING FP+offset" },

  { opcodeHex: "0x74", opcode: 116, name: "STORE_INT_FP", category: "store", stackEffect: "-1", operandFormat: "uint16", description: "Pop INT and store at FP+offset" },
  { opcodeHex: "0x75", opcode: 117, name: "STORE_LONG_FP", category: "store", stackEffect: "-1", operandFormat: "uint16", description: "Pop LONG and store at FP+offset" },
  { opcodeHex: "0x76", opcode: 118, name: "STORE_FLOAT_FP", category: "store", stackEffect: "-1", operandFormat: "uint16", description: "Pop FLOAT and store at FP+offset" },
  { opcodeHex: "0x77", opcode: 119, name: "STORE_STRING_FP", category: "store", stackEffect: "-1", operandFormat: "uint16", description: "Pop STRING and store at FP+offset" },

  { opcodeHex: "0x80", opcode: 128, name: "PUSH_INT_IND", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push INT via indirect FP reference" },
  { opcodeHex: "0x81", opcode: 129, name: "PUSH_LONG_IND", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push LONG via indirect FP reference" },
  { opcodeHex: "0x82", opcode: 130, name: "PUSH_FLOAT_IND", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push FLOAT via indirect FP reference" },
  { opcodeHex: "0x83", opcode: 131, name: "PUSH_STRING_IND", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push STRING via indirect FP reference" },

  { opcodeHex: "0x84", opcode: 132, name: "STORE_INT_IND", category: "store", stackEffect: "-1", operandFormat: "uint16", description: "Store INT via indirect FP reference" },
  { opcodeHex: "0x85", opcode: 133, name: "STORE_LONG_IND", category: "store", stackEffect: "-1", operandFormat: "uint16", description: "Store LONG via indirect FP reference" },
  { opcodeHex: "0x86", opcode: 134, name: "STORE_FLOAT_IND", category: "store", stackEffect: "-1", operandFormat: "uint16", description: "Store FLOAT via indirect FP reference" },
  { opcodeHex: "0x87", opcode: 135, name: "STORE_STRING_IND", category: "store", stackEffect: "-1", operandFormat: "uint16", description: "Store STRING via indirect FP reference" },

  { opcodeHex: "0x90", opcode: 144, name: "PUSH_INT_ARRAY", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push INT array element (index from stack)" },
  { opcodeHex: "0x91", opcode: 145, name: "PUSH_LONG_ARRAY", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push LONG array element" },
  { opcodeHex: "0x92", opcode: 146, name: "PUSH_FLOAT_ARRAY", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push FLOAT array element" },
  { opcodeHex: "0x93", opcode: 147, name: "PUSH_STRING_ARRAY", category: "load", stackEffect: "+1", operandFormat: "uint16", description: "Push STRING array element" },

  { opcodeHex: "0x94", opcode: 148, name: "STORE_INT_ARRAY", category: "store", stackEffect: "-2", operandFormat: "uint16", description: "Store INT array element" },
  { opcodeHex: "0x95", opcode: 149, name: "STORE_LONG_ARRAY", category: "store", stackEffect: "-2", operandFormat: "uint16", description: "Store LONG array element" },
  { opcodeHex: "0x96", opcode: 150, name: "STORE_FLOAT_ARRAY", category: "store", stackEffect: "-2", operandFormat: "uint16", description: "Store FLOAT array element" },
  { opcodeHex: "0x97", opcode: 151, name: "STORE_STRING_ARRAY", category: "store", stackEffect: "-2", operandFormat: "uint16", description: "Store STRING array element" },

  { opcodeHex: "0xA0", opcode: 160, name: "PRINT", category: "system", stackEffect: "-1", operandFormat: "none", description: "Pop STRING and print" },
  { opcodeHex: "0xA1", opcode: 161, name: "CLS", category: "system", stackEffect: "0", operandFormat: "none", description: "Clear screen" },
  { opcodeHex: "0xA2", opcode: 162, name: "PAUSE", category: "system", stackEffect: "-1", operandFormat: "none", description: "Pause for milliseconds" },
  { opcodeHex: "0xA3", opcode: 163, name: "OPEN", category: "system", stackEffect: "-1", operandFormat: "none", description: "Open file" },
  { opcodeHex: "0xA4", opcode: 164, name: "CLOSE", category: "system", stackEffect: "-1", operandFormat: "none", description: "Close file" },
  { opcodeHex: "0xA5", opcode: 165, name: "READ", category: "system", stackEffect: "-1", operandFormat: "none", description: "Read from file" },
  { opcodeHex: "0xA6", opcode: 166, name: "WRITE", category: "system", stackEffect: "-1", operandFormat: "none", description: "Write to file" },
  { opcodeHex: "0xA7", opcode: 167, name: "DELETE", category: "system", stackEffect: "-1", operandFormat: "none", description: "Delete file" },
  { opcodeHex: "0xA8", opcode: 168, name: "MENU", category: "system", stackEffect: "-1", operandFormat: "none", description: "Display menu" },
  { opcodeHex: "0xA9", opcode: 169, name: "DIALOG", category: "system", stackEffect: "-1", operandFormat: "none", description: "Display dialog" },
  { opcodeHex: "0xAA", opcode: 170, name: "ERR", category: "system", stackEffect: "+1", operandFormat: "none", description: "Push last error code" },
  { opcodeHex: "0xAB", opcode: 171, name: "ONERR", category: "system", stackEffect: "0", operandFormat: "uint16", description: "Set error handler jump" },

  { opcodeHex: "0xB0", opcode: 176, name: "DATE", category: "system", stackEffect: "+1", operandFormat: "none", description: "Push current DATE" },
  { opcodeHex: "0xB1", opcode: 177, name: "TIME", category: "system", stackEffect: "+1", operandFormat: "none", description: "Push current TIME" },
  { opcodeHex: "0xB2", opcode: 178, name: "DAY", category: "system", stackEffect: "+1", operandFormat: "none", description: "Push day of week" },
  { opcodeHex: "0xB3", opcode: 179, name: "RND", category: "system", stackEffect: "+1", operandFormat: "none", description: "Push random number" },

  { opcodeHex: "0xC0", opcode: 192, name: "CONCAT", category: "string", stackEffect: "-1", operandFormat: "none", description: "Concatenate two strings" },
  { opcodeHex: "0xC1", opcode: 193, name: "LEN", category: "string", stackEffect: "+1", operandFormat: "none", description: "Push string length" },
  { opcodeHex: "0xC2", opcode: 194, name: "LEFT", category: "string", stackEffect: "-1", operandFormat: "none", description: "Left substring" },
  { opcodeHex: "0xC3", opcode: 195, name: "RIGHT", category: "string", stackEffect: "-1", operandFormat: "none", description: "Right substring" },
  { opcodeHex: "0xC4", opcode: 196, name: "MID", category: "string", stackEffect: "-2", operandFormat: "none", description: "Mid substring" },

  { opcodeHex: "0xD0", opcode: 208, name: "NEG", category: "arithmetic", stackEffect: "0", operandFormat: "none", description: "Unary numeric negation" },
  { opcodeHex: "0xD1", opcode: 209, name: "ABS", category: "arithmetic", stackEffect: "0", operandFormat: "none", description: "Absolute value" },
  { opcodeHex: "0xD2", opcode: 210, name: "SIN", category: "arithmetic", stackEffect: "0", operandFormat: "none", description: "Sine" },
  { opcodeHex: "0xD3", opcode: 211, name: "COS", category: "arithmetic", stackEffect: "0", operandFormat: "none", description: "Cosine" },
  { opcodeHex: "0xD4", opcode: 212, name: "TAN", category: "arithmetic", stackEffect: "0", operandFormat: "none", description: "Tangent" },
  { opcodeHex: "0xD5", opcode: 213, name: "ATN", category: "arithmetic", stackEffect: "0", operandFormat: "none", description: "Arctangent" },
  { opcodeHex: "0xD6", opcode: 214, name: "SQR", category: "arithmetic", stackEffect: "0", operandFormat: "none", description: "Square root" },
  { opcodeHex: "0xD7", opcode: 215, name: "EXP", category: "arithmetic", stackEffect: "0", operandFormat: "none", description: "Exponential" },
  { opcodeHex: "0xD8", opcode: 216, name: "LOG", category: "arithmetic", stackEffect: "0", operandFormat: "none", description: "Natural log" },

  { opcodeHex: "0xE0", opcode: 224, name: "ENDPROC", category: "meta", stackEffect: "0", operandFormat: "none", description: "End procedure (alias for RETURN)" },
  { opcodeHex: "0xE1", opcode: 225, name: "ENDSELECT", category: "control", stackEffect: "0", operandFormat: "none", description: "Alias for ENDSEL" },
  { opcodeHex: "0xE2", opcode: 226, name: "ENDWHILE", category: "control", stackEffect: "0", operandFormat: "none", description: "Alias for ENDWH" },
];

export const OPCODES_BY_NAME: ReadonlyMap<string, OpcodeDef> = new Map(
  OPCODE_TABLE.map((op) => [op.name, op]),
);

export const OPCODES_BY_VALUE: ReadonlyMap<number, OpcodeDef> = new Map(
  OPCODE_TABLE.map((op) => [op.opcode, op]),
);
