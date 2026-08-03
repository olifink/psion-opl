# **TRANSLATOR.md — OPL Translator Specification (Canonical)**

## **1. Purpose**

This document defines the **complete specification** for the OPL translator:

- Input: `.OPL` source text  
- Output: `.OPO` binary object file  
- Behaviour: **faithful reproduction of Psion QCode tokenisation**  
- Implementation target: **TypeScript (bun)**  
- Consumers:  
  - **Engine** (QCode VM)  
  - IDE (syntax highlighting, diagnostics)  
  - `psion-link` (file transfer, conversion)

The translator must be **deterministic**, **spec-driven**, and **compatible with original Psion `.OPO` files**.

---

# **2. Translator Architecture**

The translator consists of four major stages:

1. **Lexical Analysis**  
2. **Parsing (Recursive Descent)**  
3. **Semantic Analysis**  
4. **QCode Generation + `.OPO` Assembly**

Each stage is strictly defined below.

---

# **3. Lexical Analysis**

## **3.1 Input Normalisation**

- Convert CRLF → LF  
- Preserve case (OPL is case-insensitive but original casing is retained for debug metadata)  
- Strip trailing whitespace  
- Expand tabs to spaces (tab width = 8, original Psion behaviour)

## **3.2 Tokens**

Token categories:

- **Keywords**: `PROC`, `ENDP`, `IF`, `ELSEIF`, `ELSE`, `ENDIF`, `WHILE`, `ENDWH`, `DO`, `UNTIL`, `VECTOR`, `ENDV`, `GOTO`, `LOCAL`, `GLOBAL`, `RETURN`, `ONERR`, `REM`, etc. There is **no** `FOR`/`TO`/`NEXT`(-as-loop)/`REPEAT`/`SELECT`/`CASE`/`ENDSEL`/`DIM` — see LANGUAGE.md §7.3–7.5 and `CLAUDE.md` for what replaces them and why.
- **Identifiers**: type suffix is *optional* (`%`, `&`, `$`); no suffix means FLOAT — there is no `#` suffix (LANGUAGE.md §5.1)
- **Literals**:  
  - Integer (`123`)  
  - Float (`1.23`)  
  - String (`"hello"`)  
- **Operators**: `+ - * / ** = <> < > <= >= AND OR NOT`. There is no `MOD` and no `&`/`|` — string concatenation is `+`, type-overloaded with numeric addition (LANGUAGE.md §8.1).
- **Punctuation**: `: ; , ( )`  
- **Labels**: `label::` — a **double** colon, immediately after the name with no type suffix. A **single** colon after a name (`hi:`) is a procedure call, not a label (LANGUAGE.md §6.4, §7.5) — this is how the two are disambiguated lexically.

## **3.3 Comments**

```
REM comment text
```

Comments are removed during lexing.

## **3.4 Statement Separators**

- Newline  
- Colon (`:`)  

Multiple statements per line must be preserved in order.

---

# **4. Grammar (Formal)**

The translator uses a **recursive-descent parser** based on the original Psion grammar.

This grammar was substantially revised after cross-checking an earlier draft
against the real Symbian OPL translator source and the official Psion Series 5
OPL manual (see `CLAUDE.md` for the full findings). The earlier draft included
several constructs — `FOR`/`TO`/`NEXT`, `REPEAT`/`UNTIL`, `SELECT`/`CASE`/`ENDSEL`,
a `DIM` statement, `MOD`, `&` as string concatenation — that **do not exist**
in real OPL; those are removed below in favor of what's actually there
(`DO`/`UNTIL`, `VECTOR`/`ENDV`, `ELSEIF`, array declarations folded into
`GLOBAL`/`LOCAL`, `+` for concatenation).

### **4.1 Program**

```
program ::= (global_decl | proc_decl)*
```

### **4.2 Procedure Declaration**

```
proc_decl ::= "PROC" ident ":" param_list? stmt_list "ENDP"
```

### **4.3 Parameters**

```
param_list ::= "(" (param ("," param)*)? ")"
param ::= ident
```

### **4.4 Declarations**

`GLOBAL`/`LOCAL` fold array and string-length declarations into the variable
list itself (LANGUAGE.md §4.2) — there is no separate `DIM`. `LOCAL`/`GLOBAL`
statements must be the first statements in a procedure body (LANGUAGE.md
§6.5); the translator's parser stage does not need to enforce this ordering
itself — it's a semantic-analysis concern.

```
global_decl ::= "GLOBAL" var_decl ("," var_decl)*
local_stmt  ::= "LOCAL" var_decl ("," var_decl)*
var_decl    ::= ident ( "(" expr ("," expr)? ")" )?
```

`var_decl`'s parenthesised size(s) mean different things depending on the
identifier's suffix and count — one size on a non-`$` name is an array
element count; one size on a `$` name is a scalar string's max length; two
sizes on a `$` name is a string array's (count, max length). Distinguishing
these is a semantic-analysis concern, not a parse-time one.

### **4.5 Statements**

```
stmt_list  ::= stmt*
stmt       ::= local_stmt
             | onerr_stmt
             | goto_stmt
             | label_decl
             | if_stmt
             | while_stmt
             | do_stmt
             | vector_stmt
             | return_stmt
             | assign_stmt
             | proc_call_stmt
             | command_stmt
             | empty_stmt

onerr_stmt      ::= "ONERR" ("OFF" | label_ref)
goto_stmt       ::= "GOTO" label_ref
label_decl      ::= ident "::"
label_ref       ::= ident "::" | ident            // LANGUAGE.md §7.5
if_stmt         ::= "IF" expr stmt_list ("ELSEIF" expr stmt_list)* ("ELSE" stmt_list)? "ENDIF"
while_stmt      ::= "WHILE" expr stmt_list "ENDWH"
do_stmt         ::= "DO" stmt_list "UNTIL" expr
vector_stmt     ::= "VECTOR" expr label_ref ("," label_ref)* "ENDV"
return_stmt     ::= "RETURN" expr?
assign_stmt     ::= ident "=" expr

// A colon-form call — usable as a statement (return value discarded) or,
// with an argument list, as an expression (LANGUAGE.md §6.4). Lexically this
// is unambiguous now that labels require a *double* colon (§4.6's label_decl).
proc_call_stmt  ::= ident ":" ( "(" arg_list? ")" )?

// A bare built-in command with no colon and no enclosing parens, e.g.
// `PRINT "Hello World"` or zero-arg `GET` — evidenced by examples/hello-new.opl.
// Only ever a statement, never an expression.
command_stmt    ::= ident arg_list?

arg_list        ::= expr ("," expr)*
```

### **4.6 Expressions**

```
expr ::= logical_or
logical_or ::= logical_and ("OR" logical_and)*
logical_and ::= equality ("AND" equality)*
equality ::= relational (("=" | "<>" ) relational)*
relational ::= additive (("<" | ">" | "<=" | ">=") additive)*
additive ::= multiplicative (("+" | "-") multiplicative)*
multiplicative ::= unary (("*" | "/") unary)*
unary ::= ("NOT" | "-") unary | power
power ::= primary ("**" power)?              // right-associative
primary ::= literal | ident | proc_call_expr | "(" expr ")"
proc_call_expr ::= ident ":" ( "(" arg_list? ")" )?
```

`+` is used for both numeric addition and string concatenation
(type-overloaded, checked in semantic analysis, not by the grammar). There is
no `MOD` and no `&`/`|` operator. `%` also has a real dual role inside
expressions (forced-real "percentage" operator variants, and a character-code
literal prefix — LANGUAGE.md §8.1) that is not yet reflected in this grammar;
it's confirmed to exist but not yet assessed for implementation priority.

This grammar must match original OPL behaviour exactly.

---

# **5. Semantic Analysis**

Semantic analysis enforces:

### **5.1 Type Checking**

- Variables must match declared type suffix  
- Expressions must follow OPL coercion rules  
- Procedure return types inferred from suffix of procedure name (classic behaviour)

### **5.2 Scope Rules**

- Globals available to all procedures  
- Locals only inside procedure  
- Parameters treated as locals  
- Labels local to procedure

### **5.3 Procedure Table**

Build a table containing:

- Name  
- Parameter list  
- Return type  
- QCode offset (filled during assembly)

### **5.4 Error Detection**

Errors must match original Psion error codes:

- Syntax error  
- Type mismatch  
- Undeclared variable  
- Duplicate label  
- Wrong number of parameters  
- Array bounds (compile-time only for literal bounds)

---

# **6. QCode Generation**

This is the core of the translator.

## **6.1 QCode Overview**

QCode is a **tokenised bytecode format** used by Psion OPL.  
Each token is:

- 1 byte opcode  
- Optional operand bytes  
- Optional literal pool references  

The translator must generate **authentic QCode**, not reinterpretations.

## **6.2 Opcode Table**

The full opcode table is defined in:

- **ENGINE.md** (execution semantics)  
- `docs/opo-table.csv` (canonical — see `CLAUDE.md`'s "QCode fidelity" invariant)

The hex values below are old illustrative placeholders, not cross-checked
against `docs/opo-table.csv` (which disagrees with them, e.g. `IF` is `0x40`
there, not `0x30`) or against the real QCode/`.OPO` binary format — that
binary-level cross-check is still open work (`CLAUDE.md`). Treat
`docs/opo-table.csv` as authoritative wherever the two conflict:

Examples:

| Construct | QCode |
|----------|-------|
| `+` | `0x10` |
| `-` | `0x11` |
| `*` | `0x12` |
| `/` | `0x13` |
| `=` | `0x20` |
| `<>` | `0x21` |
| `IF` | `0x30` |
| `ENDIF` | `0x31` |
| `PROC` | `0x40` |
| `ENDP` | `0x41` |

(Exact values will be filled from Psion documentation.)

## **6.3 Literal Pool**

Strings and numeric constants are stored in a **literal pool**:

- Strings stored as length-prefixed bytes  
- Numbers stored in native Psion format (INT, LONG, FLOAT)  
- QCode references literal pool by index

## **6.4 Variable References**

Variables are encoded as:

- Local variable index  
- Global variable index  
- Parameter index  

The translator must reproduce original indexing rules.

## **6.5 Control Flow**

Control flow uses **relative jumps**:

- IF / ELSEIF / ELSE → conditional jumps  
- ENDIF → jump target resolution  
- WHILE / ENDWH → loop backpatching (test-first)  
- DO / UNTIL → loop backpatching (test-last)  
- VECTOR / ENDV → jump table generation (computed jump to the Nth label)

All jumps must match original Psion behaviour.

---

# **7. `.OPO` File Format**

The translator must produce a binary `.OPO` file with the following structure:

```
[Header]
  magic number
  version
  flags
  procedure count
  literal pool size
  code size

[Procedure Table]
  entries with:
    name
    parameter count
    return type
    code offset

[Literal Pool]
  raw literal bytes

[QCode Stream]
  bytecode for all procedures
```

Exact binary layout will be documented in:

- `docs/OPO-FORMAT.md` (to be written later)

---

# **8. Diagnostics**

The translator must emit:

- Syntax errors  
- Type errors  
- Unknown identifiers  
- Unknown opcodes  
- Mismatched parameters  
- Unreachable code (optional)  
- Warnings for unused variables (optional)

Diagnostics must include:

- Line number  
- Column  
- Token  
- Error code  
- Human-readable message  

---

# **9. Determinism Requirements**

The translator must be:

- Deterministic  
- Stable across platforms  
- Stable across bun/Node versions  
- Stable across whitespace differences  
- Stable across casing differences  

This ensures reproducible `.OPO` binaries.

---

# **10. IDE Integration**

The translator must expose:

- Token stream  
- AST  
- Symbol table  
- Procedure table  
- Literal pool  
- QCode stream  
- Diagnostics  

These are consumed by the Angular IDE.

---

# **11. Testing Requirements**

### **11.1 Golden Files**

The project must include:

- Original Psion `.OPL` → `.OPO` pairs  
- Translator output must match byte-for-byte

### **11.2 Round-Trip Tests**

- `.OPL` → `.OPO` → disassembly → AST → `.OPO`  
- Must be stable

### **11.3 Error Tests**

- Invalid syntax  
- Invalid types  
- Invalid labels  
- Invalid parameters  

---

# **12. Non-Goals**

The translator must **not**:

- Extend OPL syntax  
- Modify QCode semantics  
- Introduce new opcodes  
- Support non-Psion dialects  
- Support Symbian-only Unicode extensions (unless isolated)

---

# **13. Document Dependencies**

This specification depends on:

- **LANGUAGE.md** — grammar + semantics  
- **ENGINE.md** — opcode semantics  
- **INTEGRATIONS.md** — host API mapping  

