// Semantic-level type system — TRANSLATOR.md §5.1, LANGUAGE.md §4.1, §5.1.
//
// Deliberately separate from opl-shared's OplType: that enum mirrors the
// runtime STACK tag set (ENGINE.md §3.2) and has no LONG variant distinct
// from INT. This is the richer language-level type system (INT/LONG/FLOAT/
// STRING) semantic analysis needs for coercion rules. Reconciling the two
// (does the engine's runtime tag set need a LONG variant too?) is future
// work — see PLAN.md.

export enum SemanticType {
  INT = "INT",
  LONG = "LONG",
  FLOAT = "FLOAT",
  STRING = "STRING",
}

const PROMOTION_ORDER = [SemanticType.INT, SemanticType.LONG, SemanticType.FLOAT];

/** LANGUAGE.md §5.1: `%`=INT, `&`=LONG, `$`=STRING, no suffix=FLOAT. */
export function typeFromSuffix(name: string): SemanticType {
  const suffix = name.at(-1);
  if (suffix === "%") return SemanticType.INT;
  if (suffix === "&") return SemanticType.LONG;
  if (suffix === "$") return SemanticType.STRING;
  return SemanticType.FLOAT;
}

/**
 * INT -> LONG -> FLOAT promotion, matching the real translator's PromoteL
 * ("only cast to larger size"). STRING never promotes to/from a numeric
 * type — returns null for that combination, which callers should treat as a
 * type-mismatch condition already reported (or about to be).
 */
export function promote(a: SemanticType, b: SemanticType): SemanticType | null {
  const aIsString = a === SemanticType.STRING;
  const bIsString = b === SemanticType.STRING;
  if (aIsString || bIsString) {
    return aIsString && bIsString ? SemanticType.STRING : null;
  }
  const ai = PROMOTION_ORDER.indexOf(a);
  const bi = PROMOTION_ORDER.indexOf(b);
  return PROMOTION_ORDER[Math.max(ai, bi)]!;
}

/**
 * Binary operators a STRING operand is allowed with — comparisons and `+`
 * (concatenation). Directly mirrors the real translator's OutputOperatorL:
 * "Strings can only be compared and added" (checked there as `oper >
 * EPlus` being invalid, where the real operator enum orders comparisons
 * before EPlus).
 */
export const STRING_ALLOWED_OPERATORS = new Set(["=", "<>", "<", ">", "<=", ">=", "+"]);

export const COMPARISON_OPERATORS = new Set(["=", "<>", "<", ">", "<=", ">="]);

export const LOGICAL_OPERATORS = new Set(["AND", "OR"]);
