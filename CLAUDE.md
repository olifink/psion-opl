# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

The `/packages` and `/apps` scaffold now exists (bun workspace + a separately-tooled Angular app). `opl-translator`'s lexer (`lex()`, `src/lexer.ts`) and parser (`parse()`, `src/parser.ts`, producing the AST in `src/ast.ts`) are implemented and tested. Semantic analysis, codegen, and the engine's opcode dispatch are still stubs that throw `"not yet implemented"`. `/integrations/psion-link` from BRIEF.md has not been scaffolded.

`/examples` contains real Psion-device `.opl`/`.opo` pairs (currently `hello-new.*`) — genuine ground truth, not synthetic test fixtures, and the project's working method going forward is: extend this set with more real-device pairs the user can manually verify, and treat those (not the prose docs) as the tiebreaker whenever a doc's claim is unverified. Use them for golden-file tests as each translator stage comes online (TRANSLATOR.md §11.1). **Important, still unresolved**: `hello-new.opo`'s header does not match `docs/OPO-FORMAT.md`'s assumed layout at all — it doesn't start with the `0xF700`/`0xF701` magic bytes the spec describes. That spec (and likely `docs/opo-table.csv`) appears to have been written speculatively rather than derived from a real Psion binary. Before implementing the codegen or engine opcode-dispatch stages, reverse-engineer the real `.opo` header/procedure-table/QCode layout from the example file(s) and correct `OPO-FORMAT.md` — don't build against the current spec text as if it were verified.

**The surface grammar has documented gaps too**, discovered while writing the parser (these are about `.OPL` syntax, not the `.opo` binary question above — lower-risk, but still worth knowing about): TRANSLATOR.md §4.5's formal `primary` production omits procedure calls entirely even though LANGUAGE.md §6.4 uses `add:(2,3)` as an expression; its `stmt` list has no production for `LOCAL`/`DIM`/`GLOBAL`'s body/`ONERR` even though LANGUAGE.md's own §12 example needs all of them; and the expr grammar has no precedence tier for the `&` string-concat operator LANGUAGE.md §8.1 lists. `parser.ts` fills each gap (commented at the point it's used) only where LANGUAGE.md's prose or the real example directly evidences the construct; anything neither evidences (FOR/STEP, a parenthesized no-colon built-in-function-call syntax) is left unimplemented rather than guessed. The real device source also revealed OPL has (at least) three distinct call conventions the docs never enumerate: colon-form user PROC calls (`hi:`, `add:(5,3)`, usable as statements or expressions), and bare command-form built-in calls with no colon and no parens (`GET`, `PRINT "Hello World"`, statement-only) — both implemented; a third, parenthesized no-colon expression-style built-in call (e.g. hypothetically `ABS(x%)`), is neither evidenced nor implemented yet.

### Commands

Run from the repo root unless noted:

- `bun install` — install all bun-workspace packages (`packages/*`, `apps/opl-cli`). The Angular app manages its own `node_modules` via npm (see below) and is intentionally excluded from the bun workspace.
- `bun test packages apps/opl-cli` (also `bun run test`) — run all bun:test suites. Don't use plain `bun test` at the root — it will also pick up `apps/opl-ide`'s Angular spec files, which need Angular's own test runner, not bun:test.
- `bun test packages/opl-language/src/opcodes.test.ts` — run a single test file the same way.
- `(cd packages/<pkg> && bunx tsc --noEmit)` — typecheck one package. There's no project-references build graph; each package is typechecked independently by resolving workspace deps straight from their `.ts` source (`package.json` `types`/`main` point at `src/index.ts`, not a built `dist/`).
- `bun apps/opl-cli/src/index.ts build <file.opl>` / `... run <file.opo>` — exercise the CLI directly against the (stub) translator/engine.
- `cd apps/opl-ide && ng serve` / `ng build` / `ng test` — Angular dev server / production build / Karma-Vitest tests, standard Angular CLI, npm-managed.

### Monorepo layout notes

- Package manager split is deliberate: `packages/*` and `apps/opl-cli` are bun-native (TypeScript run directly, no build step — `main`/`types` point at `src/index.ts`) and live in the root `bun.lock` workspace. `apps/opl-ide` is a standard `ng new` Angular project with its own `package-lock.json`; mixing its webpack/esbuild toolchain into the bun workspace was avoided to prevent dependency-hoisting conflicts.
- Internal packages depend on each other via `"workspace:*"` (e.g. `opl-engine` depends on `opl-language`, `opl-shared`, `opl-host`). When adding a new cross-package import, add the dependency to that package's `package.json` too — nothing is auto-hoisted-visible without it.
- `packages/opl-language/src/opcodes.ts` is a hand-transcribed copy of `docs/opo-table.csv`; `packages/opl-language/src/opcodes.test.ts` diffs it against the CSV on every test run so the two can't silently drift. If you edit one, edit the other and rerun that test.
- `packages/opl-host/src/adapters/node.ts` is the only host adapter implemented so far (console UI, native fs, JSON-file storage — INTEGRATIONS.md §13.3). Web/Android adapters don't exist yet.

## What This Project Is

A specification-driven re-implementation of Psion OPL (Organiser Programming Language), targeting byte-for-byte QCode/`.OPO` compatibility with original Psion Series 3/5/7 and EPOC32 devices. Three planned components share one contract:

- **Translator** (`.OPL` → `.OPO`, TypeScript/bun)
- **Engine** (QCode VM that executes `.OPO`, TypeScript/bun, portable to Wasm/Android)
- **IDE** (Angular 22+ offline PWA)

The prime directive is **faithfulness**: original opcode definitions, tokenisation rules, and runtime semantics only. Never invent "new OPL" syntax, new opcodes, or reinterpret QCode semantics — every behavior must trace back to a spec document or a documented Psion reference. See BRIEF.md's Non-Goals section.

## Spec Documents (source of truth)

Read the relevant spec fully before touching related code — these documents are the contract, not background reading:

- **`docs/LANGUAGE.md`** — canonical OPL syntax, types (`INT`/`LONG`/`FLOAT`/`STRING`/`DATE`/`TIME`), type-suffix identifier rules (`%` `&` `#` `$`), procedures, control flow, error model (`ONERR`, `ERR`, numeric error codes).
- **`docs/TRANSLATOR.md`** — translator's 4 stages (lex → recursive-descent parse → semantic analysis → QCode generation/`.OPO` assembly), formal grammar, determinism requirements, golden-file/round-trip testing requirements.
- **`docs/OPO-FORMAT.md`** — exact binary layout of `.OPO` files: header (0x1C bytes, magic `0xF700`/`0xF701`), procedure table, literal pool, QCode stream. All multi-byte values little-endian. This is the byte-level contract between translator and engine — treat offsets/sizes here as load-bearing, not illustrative.
- **`docs/ENGINE.md`** — VM architecture: stack-based execution, frame layout (FP-relative addressing), tagged stack values, opcode semantics, procedure call/return, `ONERR` handling, host capability dispatch.
- **`docs/OPO-TABLE.md`** / **`docs/opo-table.csv`** — canonical opcode table (opcode_hex, opcode_dec, name, category, stack_effect, operand_format, description). This is the dispatch table both translator emission and engine execution must agree with exactly.
- **`docs/INTEGRATIONS.md`** — the `OplHost` capability interface (`fs`, `ui`, `sys`, `time`, optional `org`/`net`/`store`/`debug`) that isolates the platform-neutral engine from platform-specific behavior. The engine must never contain platform-specific logic directly — it calls through this interface, and a missing optional capability must raise an OPL error rather than silently no-op.
- **`docs/WEBUI.md`** — Angular 22+ PWA IDE spec: CodeMirror 2 with custom OPL mode, OPFS-backed one-level project storage, translate/run/debug workflow, tracing/flow visualization.

Each spec's own "Document Dependencies" section lists which other specs it defers to — follow those chains when a change in one spec has implications for another (e.g. an opcode-table change affects both TRANSLATOR.md and ENGINE.md).

## Repository Structure

Per BRIEF.md, now scaffolded:

```
/packages
  /opl-language        # grammar, tokens, QCode definitions (keywords.ts, tokens.ts, opcodes.ts)
  /opl-translator       # .OPL → .OPO compiler (lex()+parse() implemented; semantic analysis/codegen still stubs)
  /opl-engine           # QCode VM (QCodeEngine stub)
  /opl-host             # host capability interfaces (capabilities.ts) + node adapter (adapters/node.ts)
  /opl-shared           # common types, errors, utilities (OplValue, OplErrorCode, OplError)

/apps
  /opl-ide              # Angular 22+ PWA IDE (ng new + @angular/pwa + @angular/material scaffolded; no editor/debugger features yet)
  /opl-cli              # bun-based CLI (build/run subcommands wired to the stub translator/engine)

/integrations
  /psion-link            # optional: local bridge to existing project — not yet scaffolded
```

Translator/Engine/CLI target **TypeScript on bun**. The IDE targets **Angular 22+** with Angular Material (M3 theming) — CodeMirror 2 integration and OPFS project storage are not yet implemented, only the PWA/build baseline.

## Key Architectural Invariants

- **Platform neutrality**: the engine and translator core must contain zero platform-specific code. All I/O, UI, and organiser functions go through the `OplHost` interface (INTEGRATIONS.md) so the same VM/translator runs under Web, Node/bun, and Android hosts.
- **Determinism**: given the same `.OPL` input, the translator must always produce byte-identical `.OPO` output — stable across platforms, bun/Node versions, and incidental whitespace/casing differences.
- **QCode fidelity**: opcode values, stack effects, and operand formats in `docs/opo-table.csv` are canonical. Translator emission and engine dispatch must both key off this single table rather than maintaining separate opcode lists that could drift.
- **Version targeting**: implementations target Series 5/EPOC32 (`.OPO` magic `0xF701`, 32-bit offsets, 8-byte float) unless a task explicitly calls for Series 3/SIBO (`0xF700`, 16-bit offsets, 4-byte float) compatibility.
