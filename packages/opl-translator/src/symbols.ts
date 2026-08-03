// Symbol tables — TRANSLATOR.md §5.3 (Procedure Table), §5.2 (Scope Rules).

import type { SemanticType } from "./semantic-types.js";

export interface VariableSymbol {
  name: string;
  type: SemanticType;
  /** Element count, if this is an array (numeric or string) — LANGUAGE.md §4.2. */
  arrayLength: number | null;
  /** Max string length; only meaningful when type is STRING. */
  stringMaxLength: number | null;
}

export interface ProcedureSymbol {
  name: string;
  returnType: SemanticType;
  params: VariableSymbol[];
  line: number;
}

/**
 * A variable scope with an optional parent — locals resolve against their
 * procedure's scope, which falls back to the global scope (LANGUAGE.md
 * §5.2). Names are matched case-insensitively (OPL is case-insensitive).
 */
export class Scope {
  private readonly vars = new Map<string, VariableSymbol>();

  constructor(private readonly parent?: Scope) {}

  /** Declares a symbol in THIS scope. Returns false if the name is already
   * declared here (not in a parent scope — shadowing a global with a local
   * of the same name is not itself a duplicate-declaration error). */
  declare(sym: VariableSymbol): boolean {
    const key = sym.name.toUpperCase();
    if (this.vars.has(key)) return false;
    this.vars.set(key, sym);
    return true;
  }

  resolve(name: string): VariableSymbol | undefined {
    return this.vars.get(name.toUpperCase()) ?? this.parent?.resolve(name);
  }
}
