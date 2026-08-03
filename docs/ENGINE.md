Here’s a focused, spec‑driven `ENGINE.md` that lines up with your “original QCode, original .OPO” requirement and is friendly to a coding agent implementing the VM in TypeScript.

---

# ENGINE.md — OPL QCode Engine Specification (Canonical)

## 1. Purpose

This document defines the **execution engine** for Psion OPL:

- Input: **authentic `.OPO` QCode object files**
- Behaviour: **faithful interpretation of original QCode**
- Target implementation: **TypeScript (bun)**, portable to Web/Android
- Scope: Psion Organiser II → Series 3/5/7/EPOC32 core semantics  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/proglang.htm)  [Archive](https://archive.org/details/psion-series-3-programming-manual)  

The engine must be able to run **original Psion‑generated `.OPO`** as well as translator‑generated `.OPO`.

---

## 2. Execution Model

### 2.1 Stack‑Based Architecture

OPL is fundamentally **stack‑based**:

- All intermediate values live on a **language stack**
- Procedures push a **frame header**, locals, and QCode onto the stack  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/proglang.htm)  
- On `RETURN`, the frame is popped and the return value remains

The engine must model:

- **Data stack** (values)
- **Call stack / frames** (procedures)
- **QCode instruction pointer** (per frame)

### 2.2 Frames

Each procedure call creates a frame containing:

- Pointer to caller frame
- Pointer to QCode start
- Space for locals and parameters
- Language pointers (e.g. frame base, stack top)  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/proglang.htm)  

Frame layout must match the addressing modes used by QCode operands (FP, IND, ARR, etc.).  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/qcode.htm)  [jaapsch.net](https://www.jaapsch.net/psion/qcodes.htm)  

---

## 3. Data Representation

### 3.1 Primitive Types

The engine must support the classic OPL variable formats:  [jaapsch.net](https://www.jaapsch.net/psion/qcodes.htm)  

- **Integer (INT)**: 16‑bit signed, 2 bytes
- **Float (NUM/FLOAT)**: 8‑byte mantissa/exponent/sign
- **String (STR)**: max length, actual length, contents
- **Integer Array**
- **Float Array**
- **String Array**

These formats are used both in variables and in literal pool entries.

### 3.2 Stack Values

On the stack, values are tagged by type:

- Type byte (0–5) indicating INT, FLOAT, STRING, INT‑ARRAY, FLOAT‑ARRAY, STRING‑ARRAY  [jaapsch.net](https://www.jaapsch.net/psion/qcodes.htm)  
- Followed by the value in the appropriate format

The engine must implement:

- Type‑aware arithmetic
- Type‑aware comparisons
- String operations (concatenation, slicing)

---

## 4. QCode Semantics

### 4.1 Operand Opcodes

Operand QCodes push values or variable references onto the stack. Examples (names from Organiser II tech ref):  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/qcode.htm)  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/proglang.htm)  

- `QI_INT_SIM_FP` — push INT simple variable at FP+offset
- `QI_NUM_SIM_FP` — push FLOAT simple variable at FP+offset
- `QI_STR_SIM_FP` — push STRING simple variable at FP+offset
- `QI_INT_ARR_FP` — push INT array element (index from stack)
- `QI_NUM_ARR_FP` — push FLOAT array element
- `QI_STR_ARR_FP` — push STRING array element
- `QI_INT_SIM_IND` / `QI_NUM_SIM_IND` / `QI_STR_SIM_IND` — indirect addressing via FP
- Literal opcodes — push constants from literal pool

The engine must:

- Interpret FP (frame pointer) correctly
- Validate array bounds
- Handle indirect addressing

### 4.2 Operator Opcodes

Operator QCodes consume stack operands and push results:

- Arithmetic: `ADD`, `SUB`, `MUL`, `DIV`, `MOD`
- Comparison: `EQ`, `NE`, `LT`, `GT`, `LE`, `GE`
- Logical: `AND`, `OR`, `NOT`
- String: concatenation, comparison

Each operator must:

- Enforce OPL type coercion rules
- Raise appropriate errors on mismatch

### 4.3 Control Flow Opcodes

Control flow is implemented via jump opcodes:

- `IF` / conditional jump
- `ELSE` / unconditional jump
- `ENDIF` / jump target
- `WHILE` / loop start
- `ENDWH` / loop end
- `FOR` / loop setup
- `NEXT` / loop increment/jump
- `SELECT` / jump table
- `CASE` / case entries

The engine must:

- Maintain an instruction pointer (IP)
- Apply relative offsets from QCode
- Respect structured control flow semantics

---

## 5. Procedure Calls

### 5.1 Call Opcodes

Procedure calls are encoded as:

- Opcode for “call procedure”
- Operand referencing procedure table entry
- Parameter count and types implied by QCode sequence

Engine behaviour:

1. Pop parameters from stack (reverse order)  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/proglang.htm)  
2. Create new frame
3. Copy parameters into frame locals
4. Set IP to procedure’s QCode offset
5. On `RETURN`, pop frame and push return value

### 5.2 Return Opcode

`RETURN`:

- Pops current frame
- Leaves return value on caller’s stack
- Restores caller IP

If no explicit `RETURN` is executed, default return value semantics follow original OPL (typically INT 0).

---

## 6. Error Handling

### 6.1 Error Codes

Engine must implement numeric error codes consistent with OPL:  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/proglang.htm)  

- Syntax errors (compile‑time only)
- Runtime errors:
  - Type mismatch
  - Array bounds
  - File errors
  - Out of memory
  - Illegal opcode

### 6.2 ONERR Semantics

When an error occurs:

- If `ONERR label:` is active in current procedure:
  - Set `ERR` value
  - Transfer IP to `label` within same procedure
- Otherwise:
  - Propagate error up call stack
  - If unhandled, terminate program

Engine must track:

- Current ONERR handler per frame
- Last error code (`ERR`)

---

## 7. Memory Model

### 7.1 Globals vs Locals

- **Globals**: allocated in a global area, referenced via absolute or FP‑relative addressing depending on platform
- **Locals**: allocated in frame, referenced via FP+offset

Engine must:

- Initialise globals on program load
- Zero locals on procedure entry  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/proglang.htm)  

### 7.2 Literal Pool

Literal pool is loaded from `.OPO`:

- Strings: length + contents
- Numbers: compact float/int formats  [jaapsch.net](https://www.jaapsch.net/psion/qcodes.htm)  

Engine must:

- Provide fast access by index
- Preserve original binary representation

---

## 8. Host Integration Layer

The engine must not hard‑code platform behaviour. Instead, it calls a **host interface** for:

- File I/O
- UI (PRINT, CLS, menus, dialogs)
- Organiser functions (Agenda, Contacts, etc.)
- System services (time, date, battery, etc.)  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/proglang.htm)  [ia800609.us.archive.org](https://ia800609.us.archive.org/21/items/Psion-OPL-Programming-Manual/335-APPEND.pdf)  

Host interface is defined in `INTEGRATIONS.md` and implemented per platform (Web, Android, Node/bun).

---

## 9. Execution Environment

### 9.1 Engine API (TypeScript)

At minimum:

```ts
interface OplEngine {
  loadOpo(binary: Uint8Array): void;
  reset(): void;
  run(entryProcName?: string): Promise<void>;
  step(): void; // optional single-step for debugging
  getGlobal(name: string): OplValue;
  setGlobal(name: string, value: OplValue): void;
}
```

Where `OplValue` is a tagged union for INT, FLOAT, STRING, arrays.

### 9.2 Debugging Hooks

Optional but recommended:

- Breakpoints (per QCode offset)
- Stack inspection
- Variable inspection
- Trace of executed opcodes

---

## 10. Compatibility Levels

Engine should support:

- **Organiser II / early OPL** QCode semantics  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/proglang.htm)  [jaapsch.net](https://www.jaapsch.net/psion/qcodes.htm)  
- **Series 3/3a/3c/Siena** additions
- **Series 5/EPOC32** 32‑bit addressing and extended keywords  [ia800609.us.archive.org](https://ia800609.us.archive.org/21/items/Psion-OPL-Programming-Manual/335-APPEND.pdf)  [Archive](https://archive.org/details/psion-series-3-programming-manual)  

Differences must be handled via:

- Version flags in `.OPO` header
- Conditional opcode handling
- Host capability checks

---

## 11. Non‑Goals

Engine must **not**:

- Invent new opcodes
- Change QCode semantics
- Extend OPL syntax
- Depend on Psion ROMs or proprietary binaries

---

## 12. Dependencies

This document relies on:

- `LANGUAGE.md` — language semantics
- `TRANSLATOR.md` — QCode generation rules
- `INTEGRATIONS.md` — host API mapping
- External technical references on QCode and OPL internals  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/qcode.htm)  [retroisle.com](https://www.retroisle.com/others/psion/organiser2/OriginalDocs/proglang.htm)  [jaapsch.net](https://www.jaapsch.net/psion/qcodes.htm)  [ia800609.us.archive.org](https://ia800609.us.archive.org/21/items/Psion-OPL-Programming-Manual/335-APPEND.pdf)  [Archive](https://archive.org/details/psion-series-3-programming-manual)  

