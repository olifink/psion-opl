# PLAN.md

Living roadmap for the OPL re-implementation. Update this as work completes or
plans change — check items off, add new ones, move things between sections.
This is distinct from `CLAUDE.md` (operating instructions for working in this
repo) and `BRIEF.md` (the original project brief, static).

## Working method

Established over the last few sessions, keep doing this:

1. **Ground truth beats prose docs.** `docs/*.md` were originally written
   speculatively. Where a doc's claim is unverified, treat `/references`
   (real Symbian OPL translator/runtime source, official Psion manuals) and
   `/examples` (real device `.opl`/`.opo` pairs) as the tiebreaker, not the
   doc text. Confirm findings against **two independent sources** where
   possible (e.g. the real source *and* the manual) before changing code —
   see the grammar cross-check for the model to repeat.
2. **Cross-check before building on top of a spec section**, not after.
   Don't implement a stage against a doc that hasn't been verified yet if
   verifying it first is cheap.
3. Every correction gets recorded in `CLAUDE.md` (for future Claude sessions)
   and cited to its source, not asserted bare.
4. Extend `/examples` with more real device pairs as they become available;
   add a golden-file test for each new one at whatever translator stage can
   consume it.

## Status

### Translator (`packages/opl-translator`)
- [x] Lexer (`lex()`) — tokenizes `.OPL` source
- [x] Parser (`parse()`) — builds the AST; grammar cross-checked against real
      sources (see `CLAUDE.md` "Ground truth" for the full findings)
- [ ] Semantic analysis — symbol tables (globals/locals/params), scope
      resolution, type checking/coercion (INT→LONG→FLOAT promotion, string
      rules), procedure signature validation, label/GOTO/VECTOR resolution,
      array/string-length declaration validation (LANGUAGE.md §4.2)
- [ ] Codegen — QCode emission + `.OPO` assembly. **Blocked on** the OPO
      binary format cross-check below; don't start codegen against
      `OPO-FORMAT.md`/`opo-table.csv` until that's done.

### OPO binary format (blocks codegen + engine opcode dispatch)
- [ ] Reverse-engineer the real `.OPO` header/procedure-table/literal-pool/
      QCode layout from `references/opl-dev/oplr` (runtime — loads and
      executes `.opo`) and `oplt/stran/OT_PCODE.CPP` (codegen side),
      cross-checked against `examples/hello-new.opo`'s actual bytes.
      `hello-new.opo` does **not** start with the `0xF700`/`0xF701` magic
      `OPO-FORMAT.md` claims — that document is unverified, same as the
      grammar docs were.
  - Started at this point in prior work: the header at least does *not*
    match the current spec; no further byte-level analysis done yet.
  - This will also settle whether `docs/opo-table.csv`'s opcode
    values/names match reality.
- [ ] Correct `docs/OPO-FORMAT.md` and `docs/opo-table.csv` (and
      `packages/opl-language/src/opcodes.ts` + its CSV-diff test) once
      confirmed, the same way `LANGUAGE.md`/`TRANSLATOR.md` were corrected.

### Engine (`packages/opl-engine`)
- [ ] Stack/frame model (ENGINE.md §2)
- [ ] Opcode dispatch loop — **depends on** the OPO format cross-check above
- [ ] `ONERR` handling, procedure call/return
- [ ] Host capability dispatch (interfaces already exist in `opl-host`)

### Host (`packages/opl-host`)
- [x] Capability interfaces + Node/bun adapter
- [ ] Web adapter (IndexedDB/OPFS, DOM UI) — needed once the IDE runs the
      engine in-browser
- [ ] Android adapter — later, per BRIEF.md's portability goals

### IDE (`apps/opl-ide`)
- [x] Angular 22 + PWA + Material scaffold, builds clean
- [ ] CodeMirror 2 integration with custom OPL mode (WEBUI.md §4)
- [ ] Project explorer + OPFS storage (WEBUI.md §5)
- [ ] Translate/Run/Debug wiring to `opl-translator`/`opl-engine`/Web host
      adapter (WEBUI.md §6)
- [ ] Everything else in WEBUI.md (inspectors, tracing, flow visualization)
      is later still — no point building before translate/run work end-to-end

### Not started
- `apps/opl-cli` beyond its current stub wiring (works once translator/engine do)
- `/integrations/psion-link` (BRIEF.md marks this optional/future)

## Open questions

- **`%` percentage-operator / character-literal duality** (LANGUAGE.md §8.1):
  confirmed to exist in real OPL, not yet implemented anywhere (lexer,
  parser, or docs' grammar). Needs a decision on whether it's in scope before
  semantic analysis needs to type-check expressions using it.
- **Series 3/SIBO vs Series 5/EPOC32 scope**: BRIEF.md says target both;
  `references/opl-dev` covers both via a `TargetIsOpl1993` compatibility flag
  in the same codebase. Not yet decided how much Series 3 fidelity this
  project actually needs vs. focusing on Series 5/EPOC32 first.
- **Error code table completeness**: `OplErrorCode` in `opl-shared` only has
  the handful of codes LANGUAGE.md/INTEGRATIONS.md mention in prose (and
  those two docs already disagree with each other on what `-4` means — see
  the comment in `opl-shared/src/index.ts`). Needs a real, complete table,
  probably from the same `references/opl-dev` source once we're looking at
  the runtime for the OPO format work anyway.
