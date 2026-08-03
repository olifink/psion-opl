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

- **Keywords**: `PROC`, `ENDP`, `IF`, `WHILE`, `FOR`, `SELECT`, `CASE`, `LOCAL`, `GLOBAL`, `RETURN`, `REM`, etc.  
- **Identifiers**: must include type suffix (`%`, `&`, `#`, `$`)  
- **Literals**:  
  - Integer (`123`)  
  - Float (`1.23`)  
  - String (`"hello"`)  
- **Operators**: `+ - * / MOD = <> < > <= >= AND OR NOT &`  
- **Punctuation**: `: ; , ( )`  
- **Labels**: `label:` (identifier followed by colon)

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
param_list ::= "(" param ("," param)* ")"
param ::= ident
```

### **4.4 Statements**

```
stmt_list ::= stmt*
stmt ::= assign_stmt
       | if_stmt
       | while_stmt
       | for_stmt
       | repeat_stmt
       | select_stmt
       | return_stmt
       | call_stmt
       | label_stmt
       | empty_stmt
```

### **4.5 Expressions**

```
expr ::= logical_or
logical_or ::= logical_and ("OR" logical_and)*
logical_and ::= equality ("AND" equality)*
equality ::= relational (("=" | "<>" ) relational)*
relational ::= additive (("<" | ">" | "<=" | ">=") additive)*
additive ::= multiplicative (("+" | "-") multiplicative)*
multiplicative ::= unary (("*" | "/" | "MOD") unary)*
unary ::= ("NOT" | "-") unary | primary
primary ::= literal | ident | "(" expr ")"
```

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
- `docs/opcode-table.csv` (to be generated later)

Examples:

| Construct | QCode |
|----------|-------|
| `+` | `0x10` |
| `-` | `0x11` |
| `*` | `0x12` |
| `/` | `0x13` |
| `MOD` | `0x14` |
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

- IF → conditional jump  
- ELSE → unconditional jump  
- ENDIF → jump target resolution  
- WHILE / ENDWH → loop backpatching  
- FOR / NEXT → counter setup + jump  
- SELECT / CASE → jump table generation

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

