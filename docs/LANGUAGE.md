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
| **FLOAT** | 32‑bit IEEE float |
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
Declared with `DIM`:

```
DIM a%(10)
DIM s$(5)
```

Array bounds are fixed at runtime.

---

# **5. Identifiers**

### **5.1 Naming Rules**
- Start with a letter  
- Followed by letters, digits, or `_`  
- Case-insensitive  
- Type suffix required:

| Suffix | Type |
|--------|------|
| `%` | INT |
| `&` | LONG |
| `#` | FLOAT |
| `$` | STRING |

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

If omitted, return type defaults to INT (classic behaviour).

### **6.4 Calling**
```
result% = add:(2,3)
```

### **6.5 Local Variables**
Declared with `LOCAL`:

```
LOCAL x%, y$
```

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
ELSE
  PRINT "small"
ENDIF
```

### **7.3 Loops**

#### **WHILE**
```
WHILE x%<10
  x%=x%+1
ENDWH
```

#### **FOR**
```
FOR i%=1 TO 10
  PRINT i%
NEXT
```

#### **REPEAT**
```
REPEAT
  x%=x%-1
UNTIL x%=0
```

### **7.4 SELECT**
```
SELECT x%
CASE 1
  PRINT "one"
CASE 2
  PRINT "two"
ENDSEL
```

---

# **8. Expressions**

### **8.1 Operators**

| Category | Operators |
|----------|-----------|
| Arithmetic | `+ - * / MOD` |
| Comparison | `= <> < > <= >=` |
| Logical | `AND OR NOT` |
| String | `&` (concatenation) |

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
ONERR label:
```

Transfers control to `label:` on error.

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

