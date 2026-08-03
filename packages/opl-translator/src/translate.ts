import type { TranslateResult } from "./types.js";

/**
 * Translates `.OPL` source into a `.OPO` object per TRANSLATOR.md's four stages:
 * lexical analysis, recursive-descent parsing, semantic analysis, QCode generation.
 *
 * Not yet implemented — lexer/parser/codegen are future work tracked against
 * TRANSLATOR.md, OPO-FORMAT.md, and docs/opo-table.csv.
 */
export function translate(_source: string): TranslateResult {
  throw new Error("opl-translator: translate() is not yet implemented");
}
