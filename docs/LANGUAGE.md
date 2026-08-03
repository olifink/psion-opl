# **LANGUAGE.md — Psion OPL Language Specification (Canonical)**

## **1. Purpose and Scope**

This document defines the **canonical specification** of Psion OPL (Organiser Programming Language) as used on Psion Series 3/5/7 and Symbian devices.  
It describes the **syntax**, **semantics**, **types**, **procedures**, **control flow**, **system functions**, and **error model** of the language.

This specification is used by:

- The **translator** (`.OPL` → `.OPO`)
- The **execution engine** (QCode VM)
- The **IDE** (syntax highlighting, validation)
- Host capability mappings in **INTEGRATIONS.md**

The goal is **full fidelity** to original OPL behaviour.

---

# **2. Language Overview**

OPL is a **structured, statically typed, interpreted language** with:

- Line‑oriented syntax  
- Procedure‑based modularity  
- Strong but simple type system  
- Implicit variable declarations  
- Deterministic tokenisation into **QCode**  
- Runtime execution via a stack‑based VM  
- System calls mapped to device capabilities  

OPL programs are stored as:

- `.OPL` — source text  
- `.OPO` — tokenised QCode object files  

---

# **3. Lexical Structure**

### **3.1 Character Set**
OPL source is ASCII-based with Psion extensions.  
Unicode support exists in later Symbian variants but is not required for classic compatibility.

### **3.2 Tokens**
Tokens include:

- Keywords (`PROC`, `ENDP`, `IF`, `WHILE`, …)
- Identifiers
- Literals (numeric, string)
- Operators
- Punctuation (`:`, `;`, `,`, `(`, `)`)

Tokenisation rules are defined in **TRANSLATOR.md**.

### **3.3 Comments**
```
REM This is a comment
```
Comments extend to end of line.

### **3.4 Line Structure**
OPL is line-oriented.  
Multiple statements may appear on one line separated by `:`.

---

# **4. Types**

OPL has a small, fixed set of primitive types:

| Type | Description |
|------|-------------|
| **INT** | 16‑bit signed integer |
| **LONG** | 32‑bit signed integer |
| **FLOAT** | 64‑bit float (`TReal64` in the real translator source) |
| **STRING** | Variable-length string |
| **DATE** | Psion date format (integer) |
| **TIME** | Psion time format (integer) |

### **4.1 Type Coercion**
OPL performs **implicit coercion** in arithmetic and comparisons.  
Rules follow original Psion behaviour:

- INT → LONG → FLOAT (promotion)
- STRING only allowed in string operations
- DATE/TIME behave as integers unless used with date/time functions

### **4.2 Arrays**

There is no `DIM` statement. Arrays are declared directly in a `GLOBAL` or `LOCAL`
variable list (§5.1, §6.5), by following the variable name with a size in
parentheses:

```
GLOBAL a%(10), f&(3), names$(5,8)
```

- Non‑string arrays take **one** size: the element count — `a%(10)` is 10 INTs.
- String arrays take **two** sizes: element count, then max string length —
  `names$(5,8)` is 5 strings, each up to 8 characters.
- A scalar (non‑array) `STRING` variable still requires a parenthesised size —
  it declares the variable's max length, not an array: `a$(3)` is a single
  string up to 3 characters, not a 3‑element array.

Array bounds are fixed at runtime.

*(Confirmed against the real Symbian OPL translator source and the official
Psion Series 5 OPL manual — see `CLAUDE.md`.)*

---

# **5. Identifiers**

### **5.1 Naming Rules**
- Start with a letter  
- Followed by letters, digits, or `_`  
- Case-insensitive  
- Type suffix is **optional**. A name with **no suffix is FLOAT**, not INT:

| Suffix | Type |
|--------|------|
| *(none)* | FLOAT |
| `%` | INT |
| `&` | LONG |
| `$` | STRING |

There is no `#` suffix — FLOAT is the no-suffix default, not a separate
suffixed type. *(Confirmed against the real translator source and the
official Series 5 manual; corrects an earlier, unverified assumption — see
`CLAUDE.md`.)*

### **5.2 Scope**
- **Local variables**: declared inside procedures  
- **Global variables**: declared outside any procedure  
- **Procedure parameters**: local to the procedure  

---

# **6. Procedures**

### **6.1 Definition**
```
PROC name:
  ...
ENDP
```

### **6.2 Parameters**
```
PROC add:(a%, b%)
  RETURN a%+b%
ENDP
```

Parameters are passed **by value**.

### **6.3 Return Values**
Procedures return values using:

```
RETURN expr
```

If omitted, return type defaults to **FLOAT** — the same no-suffix-means-FLOAT
rule as variables (§5.1) applies to procedure names. *(Corrects an earlier,
unverified "defaults to INT" claim — confirmed via the real translator's
identifier-suffix table, where a colon with no preceding type character maps
to `EReal`; see `CLAUDE.md`.)*

### **6.4 Calling**
```
result% = add:(2,3)
hi:
```

Calling a procedure always uses a single colon after its name — with a
parenthesised argument list (`add:(2,3)`) or, for zero arguments, with
nothing after the colon at all (`hi:`). This works both as a statement
(discarding the return value) and, with an argument list, as an expression.
A **double** colon (`name::`) is never a call — it's a label (§7.5).

### **6.5 Local Variables**
Declared with `LOCAL`, immediately after the procedure name (before any other
statement) — arrays and string lengths are declared inline, the same as for
`GLOBAL` (§4.2):

```
LOCAL x%, y$(20), a%(10)
```

More than one `LOCAL` (or `GLOBAL`) statement is allowed, but each must be on
its own line, and all of them must come immediately after the procedure name.

---

# **7. Statements**

### **7.1 Assignment**
```
x% = 10
s$ = "hello"
```

### **7.2 Conditional**
```
IF x%>10
  PRINT "big"
ELSEIF x%=10
  PRINT "exactly ten"
ELSE
  PRINT "small"
ENDIF
```

`ELSEIF` may repeat any number of times; `ELSE` is optional and, if present,
must be last. `IF`, `ELSEIF`, `ELSE`, and `ENDIF` must appear in that order.

### **7.3 Loops**

There is **no `FOR`/`TO`/`NEXT` loop and no `REPEAT`/`UNTIL`** — these do not
exist in real OPL and were incorrectly documented here previously. `NEXT` is a
real keyword, but it's a database-record-navigation command (alongside
`FIRST`/`LAST`/`BACK`), unrelated to loops. The only two loop forms are:

#### **WHILE** (test-first)
```
WHILE x%<10
  x%=x%+1
ENDWH
```

#### **DO...UNTIL** (test-last)
```
DO
  x%=x%-1
UNTIL x%=0
```

*(Confirmed against the real Symbian OPL translator source and the official
Psion Series 5 OPL manual — see `CLAUDE.md`.)*

### **7.4 VECTOR (computed jump)**

There is no `SELECT`/`CASE`/`ENDSEL` — this was fabricated in an earlier
version of this document. Multi-way branching is done with `VECTOR`, a
computed jump to the Nth label in a list:

```
VECTOR x%
one,two,three
ENDV
one::
  PRINT "one"
  GOTO done::
two::
  PRINT "two"
  GOTO done::
three::
  PRINT "three"
done::
```

`VECTOR x%` jumps to the label at position `x%` in the following
comma-separated list (1 = first label). The list may span multiple lines. If
`x%` is out of range, execution just continues after `ENDV` — this is not an
error. See §7.5 for label syntax.

### **7.5 Labels and GOTO**

A label is declared with a **double colon**, immediately after its name, with
no type suffix: `mylabel::`. This is deliberately different from a
zero-argument procedure call, which uses a **single** colon (`hi:` — §6.4);
the double colon is what makes a label declaration lexically unambiguous.

```
GOTO mylabel::
...
mylabel::
  PRINT "jumped here"
```

A label reference (in `GOTO`, `ONERR`, or a `VECTOR` list) may be written
either as `name::` or as a bare `name` with no suffix and no colon at all —
both refer to the same label.

---

# **8. Expressions**

### **8.1 Operators**

| Category | Operators |
|----------|-----------|
| Arithmetic | `+ - * / **` (`**` is exponentiation, e.g. `2**(n%/12.0)`) |
| Comparison | `= <> < > <= >=` |
| Logical | `AND OR NOT` (word-only; there is no symbolic `&`/`\|` form) |
| String | `+` (concatenation — the **same** operator as numeric addition, type-overloaded, e.g. `b$+MID$(a$)`) |

There is **no `MOD` operator** — this was fabricated in an earlier version of
this document (`KMOD` is a real function, but it reads keyboard-modifier
state, not arithmetic modulo). There is **no `&` operator at all** — `&` is
exclusively the `LONG` type suffix (§5.1); string concatenation uses `+`, not
`&`. *(All confirmed against the real Symbian OPL translator source and the
official Psion Series 5 manual — see `CLAUDE.md`.)*

`%` has a further, undocumented-elsewhere dual role inside expressions in the
real language: immediately after another operator it converts that operator
to a forced-real-arithmetic "percentage" variant (`%<`,`%>`,`%+`,`%-`,`%*`,`%/`);
where an operand is expected, it introduces a character-code literal (e.g.
`%A` = 65). Confirmed to exist in the real translator; not yet assessed for
whether it's in scope to implement.

### **8.2 Precedence**
Classic Psion precedence rules apply (documented in translator spec).

---

# **9. Built‑In Functions**

OPL includes a large set of built‑ins:

- Math (`ABS`, `SIN`, `COS`, `RND`, …)
- String (`LEN`, `LEFT$`, `MID$`, `RIGHT$`, …)
- Date/time (`DATE`, `TIME`, `DAY`, …)
- File I/O (`OPEN`, `CLOSE`, `READ`, `WRITE`, …)
- UI (`PRINT`, `CLS`, `MENU`, …)
- System (`ERR`, `ONERR`, `PAUSE`, …)

Full function tables are defined in **TRANSLATOR.md** and **ENGINE.md**.

---

# **10. System Calls**

System calls are invoked via keywords:

```
d%=DIALOG
c%=CALENDAR
```

These map to:

- Original Psion OS services  
- Optional modern host integrations (REST, PWA APIs)  

Mapping rules are defined in **INTEGRATIONS.md**.

---

# **11. Error Handling**

### **11.1 Error Model**
OPL uses numeric error codes.  
Errors may be trapped or untrapped.

### **11.2 ONERR**
```
ONERR label
ONERR OFF
```

Transfers control to the label declared as `label::` (§7.5) when an error
occurs within the procedure. `ONERR OFF` disables the handler. *(The
single-colon `ONERR label:` form in an earlier version of this document was
wrong — a single colon means a procedure call, not a label reference; see
§7.5 and `CLAUDE.md`.)*

### **11.3 ERR Function**
Returns the last error code.

### **11.4 Common Errors**
- `-1` Syntax error  
- `-2` Type mismatch  
- `-3` File not found  
- `-4` Out of memory  
- `-5` Array bounds  

Full table in **ENGINE.md**.

---

# **12. Program Structure**

A typical `.OPL` file:

```
REM Example program

GLOBAL g%

PROC main:
  LOCAL x%
  g%=10
  x%=add:(5,3)
  PRINT x%
ENDP

PROC add:(a%,b%)
  RETURN a%+b%
ENDP
```

---

# **13. Object File Format (.OPO)**

The `.OPO` format contains:

- Header  
- Procedure table  
- QCode token stream  
- Literal pool  
- Debug metadata (optional)  

Full binary structure is defined in **TRANSLATOR.md**.

---

# **14. Compatibility Notes**

### **14.1 Series 3 vs Series 5 vs Symbian**
Differences include:

- Unicode support  
- Additional system calls  
- Extended UI functions  
- Minor QCode opcode additions  

The core language remains consistent.

### **14.2 Unsupported Features**
This implementation does **not** include:

- Direct hardware access  
- Proprietary Psion ROM calls  
- Non-documented opcodes  

---

# **15. Future Extensions (Optional)**

Extensions must be isolated and never alter classic behaviour:

- Host capability modules  
- REST-backed organiser functions  
- Modern UI widgets  
- Async host operations (wrapped in synchronous OPL semantics)

---

# **16. Document Dependencies**

This specification is complemented by:

- **TRANSLATOR.md** — lexical rules, grammar, QCode generation  
- **ENGINE.md** — VM architecture, opcode semantics  
- **INTEGRATIONS.md** — host API mappings  

