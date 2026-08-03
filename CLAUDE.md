# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

The `/packages` and `/apps` scaffold now exists (bun workspace + a separately-tooled Angular app). `opl-translator`'s lexer (`lex()`, `src/lexer.ts`) and parser (`parse()`, `src/parser.ts`, producing the AST in `src/ast.ts`) are implemented and tested, and now match real OPL (see "Ground truth" below — an earlier draft of both the docs and this parser had fabricated several constructs). Semantic analysis, codegen, and the engine's opcode dispatch are still stubs that throw `"not yet implemented"`. `/integrations/psion-link` from BRIEF.md has not been scaffolded.

### Ground truth: `/references` and `/examples`

Early in this project, `docs/*.md` were written speculatively (by an earlier session, without access to real OPL source or documentation) rather than derived from anything verifiable. Two ground-truth sources are now available and take priority over any doc text they conflict with:

- **`/examples`** — real Psion-device `.opl`/`.opo` pairs (currently `hello-new.*`). Extend this set with more real-device pairs as they become available; use them for golden-file tests as each translator stage comes online (TRANSLATOR.md §11.1).
- **`/references`** — `opl-dev` (a git **submodule**, the actual Symbian-released OPL translator (`oplt`) and runtime (`oplr`) source, C++, copyright Symbian Ltd 1997–2001) and two official Psion documents: `Psion5mx_Eng.pdf` and `opl-overview-and-commands.pdf` (Psion Computers PLC 1997, explicitly Series 5/3/Siena/EPOC32 — this is the primary source for confirming a finding is genuinely Series-5-era and not a later Symbian-only addition). The PDFs need `pdftotext -layout` (poppler-utils) to search — image rendering via the `Read` tool's PDF support needs `pdftoppm`, also from poppler-utils; both were installed via `apt-get install poppler-utils` in this environment. `opl-dev`'s `.gitmodules`-registered remote is `https://github.com/opl-dev/opl-dev.git`.

**A full grammar cross-check against these sources has been done and applied** (2026-08-03) — `docs/LANGUAGE.md` and `docs/TRANSLATOR.md`, and `opl-language`/`opl-translator`'s lexer, AST, and parser were all corrected. Confirmed findings, doubly-sourced from both `opl-dev` and the official manual:

- **No `FOR`/`TO`/`NEXT` loop, no `REPEAT`/`UNTIL`, no `SELECT`/`CASE`/`ENDSEL`.** These were fabricated. Real constructs: `DO...UNTIL` (test-last loop) and `VECTOR...ENDV` (computed jump to the Nth label in a list). `NEXT` is a real keyword, but for record-navigation (`FIRST`/`LAST`/`NEXT`/`BACK`), unrelated to loops.
- **`IF` supports `ELSEIF`** (`IF...ELSEIF...ELSEIF...ELSE...ENDIF`) — wasn't implemented before.
- **No `DIM` statement.** Arrays and string max-lengths are declared inline in `GLOBAL`/`LOCAL`'s own variable list (`GLOBAL a%(10), names$(5,8)`), not a separate statement.
- **No `#` suffix; no type suffix means `FLOAT`**, not INT — this also applies to a `PROC` name's inferred return type when no `RETURN` suffix is given.
- **No `MOD` operator** (a `KMOD` *function* exists, but it reads keyboard-modifier state, not arithmetic modulo). **No `&`/`|` operator at all** — `&` is exclusively the LONG type suffix. **String concatenation is `+`** (type-overloaded with numeric addition), not `&`. There **is** a real `**` (exponentiation) operator, previously undocumented.
- **Labels use a double colon** (`mylabel::`), which is what makes them lexically unambiguous from a single-colon procedure call (`hi:`) — the parser no longer needs to defer that disambiguation to a later stage. `GOTO`/`ONERR` reference a label either as `name::` or bare `name`.
- `AND`/`OR`/`NOT` (word-only, no symbol form), `PROC`/`ENDP`, `WHILE`/`ENDWH`, `LOCAL`/`GLOBAL`, `REM`, and the three call conventions (colon-form PROC calls, bare command-form built-ins) were all already correct.
- **Confirmed real but NOT yet implemented**: `%` has a dual role inside expressions beyond the INT suffix — following another operator it produces a forced-real "percentage" variant (`%+`,`%-`,`%*`,`%/`,`%<`,`%>`); where an operand is expected it introduces a character-code literal (`%A` = 65). Not enough is verified about this yet to commit to a grammar for it.

**Still open**: the `.OPO` binary format. `hello-new.opo`'s actual bytes don't start with the `0xF700`/`0xF701` magic `docs/OPO-FORMAT.md` describes at all, and `docs/opo-table.csv`'s opcode values haven't been cross-checked against the real runtime (`references/opl-dev/oplr`) or translator codegen (`oplt/stran/OT_PCODE.CPP` and related) yet. Do this cross-check — the same way the grammar one was just done — before implementing the codegen or engine opcode-dispatch stages. Don't build against `OPO-FORMAT.md`/`opo-table.csv` as if they were verified; they're the same kind of speculative-first-draft as the grammar was.

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

- **`docs/LANGUAGE.md`** — canonical OPL syntax, types (`INT`/`LONG`/`FLOAT`/`STRING`/`DATE`/`TIME`), type-suffix identifier rules (`%` `&` `$`, no suffix = FLOAT), procedures, control flow (`IF`/`ELSEIF`/`ELSE`, `WHILE`, `DO...UNTIL`, `VECTOR`, labels/`GOTO`), error model (`ONERR`, `ERR`, numeric error codes). Grammar sections were corrected against real sources — see "Ground truth" above.
- **`docs/TRANSLATOR.md`** — translator's 4 stages (lex → recursive-descent parse → semantic analysis → QCode generation/`.OPO` assembly), formal grammar, determinism requirements, golden-file/round-trip testing requirements. Formal grammar corrected against real sources — see "Ground truth" above.
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

/examples                # real Psion-device .opl/.opo pairs — golden-file ground truth
/references              # real OPL translator/runtime source (opl-dev submodule) + official Psion PDFs
```

Translator/Engine/CLI target **TypeScript on bun**. The IDE targets **Angular 22+** with Angular Material (M3 theming) — CodeMirror 2 integration and OPFS project storage are not yet implemented, only the PWA/build baseline.

## Key Architectural Invariants

- **Platform neutrality**: the engine and translator core must contain zero platform-specific code. All I/O, UI, and organiser functions go through the `OplHost` interface (INTEGRATIONS.md) so the same VM/translator runs under Web, Node/bun, and Android hosts.
- **Determinism**: given the same `.OPL` input, the translator must always produce byte-identical `.OPO` output — stable across platforms, bun/Node versions, and incidental whitespace/casing differences.
- **QCode fidelity**: opcode values, stack effects, and operand formats in `docs/opo-table.csv` are canonical *within this codebase* — translator emission and engine dispatch must both key off this single table rather than maintaining separate opcode lists that could drift. That table itself has **not yet** been cross-checked against the real `.OPO` binary format or runtime opcodes (see "Ground truth" above) — treat it as consistent-with-itself, not yet confirmed-correct.
- **Version targeting**: implementations target Series 5/EPOC32 (`.OPO` magic `0xF701`, 32-bit offsets, 8-byte float) unless a task explicitly calls for Series 3/SIBO (`0xF700`, 16-bit offsets, 4-byte float) compatibility.
