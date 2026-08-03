// Common types shared by opl-language, opl-translator, opl-engine, and opl-host.
// See docs/ENGINE.md §3 (Data Representation) and §6 (Error Handling).

/** Stack value type tags — ENGINE.md §3.2. */
export enum OplType {
  INT = 0,
  FLOAT = 1,
  STRING = 2,
  INT_ARRAY = 3,
  FLOAT_ARRAY = 4,
  STRING_ARRAY = 5,
}

export type OplValue =
  | { type: OplType.INT; value: number }
  | { type: OplType.FLOAT; value: number }
  | { type: OplType.STRING; value: string }
  | { type: OplType.INT_ARRAY; value: number[] }
  | { type: OplType.FLOAT_ARRAY; value: number[] }
  | { type: OplType.STRING_ARRAY; value: string[] };

/**
 * Documented numeric error codes — LANGUAGE.md §11.4, INTEGRATIONS.md §14.
 *
 * NOTE: the two spec documents disagree at -4 (LANGUAGE.md: "Out of memory",
 * INTEGRATIONS.md: "Permission denied"). Left as OUT_OF_MEMORY pending
 * reconciliation against original Psion error tables — do not rely on -4
 * meaning "permission denied" until this is resolved.
 */
export enum OplErrorCode {
  SYNTAX_ERROR = -1,
  TYPE_MISMATCH = -2,
  FILE_NOT_FOUND = -3,
  OUT_OF_MEMORY = -4,
  ARRAY_BOUNDS = -5,
  NETWORK_FAILURE = -50,
  CAPABILITY_MISSING = -100,
}

export class OplError extends Error {
  constructor(
    public readonly code: OplErrorCode | number,
    message?: string,
  ) {
    super(message ?? `OPL error ${code}`);
    this.name = "OplError";
  }
}
