# **OPO-FORMAT.md — Psion OPL Object File Format (Canonical)**

## **1. Purpose**

This document defines the **binary structure** of Psion OPL `.OPO` files:

- Produced by the **translator** (`.OPL` → `.OPO`)
- Consumed by the **engine** (QCode VM)
- Must be **byte‑for‑byte compatible** with original Psion `.OPO` files

This specification is **complete enough** for a coding agent to implement a loader/writer without ambiguity.

---

# **2. High-Level Structure**

An `.OPO` file consists of **four major sections**:

```
[Header]
[Procedure Table]
[Literal Pool]
[QCode Stream]
```

All offsets in the header refer to **absolute byte positions** within the file.

---

# **3. Header**

The header is a fixed‑size structure at the beginning of the file.

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| 0x00 | 2 | uint16 | Magic number (`0xF7 0x00` for Series 3, `0xF7 0x01` for Series 5/EPOC32) |
| 0x02 | 2 | uint16 | Version (varies by platform; typically `0x0100` or `0x0200`) |
| 0x04 | 2 | uint16 | Flags (bitfield; rarely used) |
| 0x06 | 2 | uint16 | Number of procedures |
| 0x08 | 4 | uint32 | Offset to procedure table |
| 0x0C | 4 | uint32 | Offset to literal pool |
| 0x10 | 4 | uint32 | Offset to QCode stream |
| 0x14 | 4 | uint32 | Total file size |
| 0x18 | 2 | uint16 | Reserved (0) |
| 0x1A | 2 | uint16 | Reserved (0) |

Total header size: **0x1C bytes**.

### **3.1 Magic Number**

Magic numbers identify the OPO variant:

- `0xF700` — Psion Series 3 / SIBO  
- `0xF701` — Psion Series 5 / EPOC32  

Your translator should generate `0xF701` unless targeting Series 3 compatibility.

---

# **4. Procedure Table**

Immediately after the header (or at offset specified in header).

Each procedure entry has the following structure:

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| +0x00 | 1 | uint8 | Name length (N) |
| +0x01 | N | char[] | Procedure name (ASCII) |
| +0x01+N | 1 | uint8 | Parameter count |
| +0x02+N | 1 | uint8 | Return type (INT=1, LONG=2, FLOAT=3, STRING=4) |
| +0x03+N | 2 | uint16 | Local variable count |
| +0x05+N | 4 | uint32 | Offset to procedure’s QCode start |
| +0x09+N | 4 | uint32 | Size of procedure’s QCode block |
| +0x0D+N | 2 | uint16 | Reserved (0) |

Procedures are stored **sequentially**.

### **4.1 Procedure Name Encoding**

- ASCII only  
- Case preserved  
- No null terminator  
- Length prefix is mandatory  

### **4.2 Return Type Encoding**

| Type | Code |
|------|------|
| INT | 1 |
| LONG | 2 |
| FLOAT | 3 |
| STRING | 4 |

---

# **5. Literal Pool**

The literal pool stores:

- String literals  
- Numeric literals (INT, LONG, FLOAT)  

It begins at the offset specified in the header.

### **5.1 Literal Pool Structure**

```
[Literal Count: uint16]
[Literal Entries...]
```

### **5.2 Literal Entry Format**

Each literal entry is:

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| +0x00 | 1 | uint8 | Literal type |
| +0x01 | V | bytes | Literal value |

### **5.3 Literal Types**

| Type | Code | Format |
|------|------|--------|
| INT | 1 | 2 bytes (signed) |
| LONG | 2 | 4 bytes (signed) |
| FLOAT | 3 | Psion 8‑byte float format |
| STRING | 4 | 2‑byte length + ASCII bytes |

### **5.4 Psion Float Format**

Psion uses an 8‑byte float:

- 1 byte: sign/exponent  
- 7 bytes: mantissa  

Your translator must encode floats exactly in this format.

---

# **6. QCode Stream**

The QCode stream contains **all procedures’ bytecode**, concatenated in the order listed in the procedure table.

The offset and size of each procedure’s QCode block are stored in the procedure table.

### **6.1 QCode Instruction Format**

Each instruction is:

```
[opcode: uint8]
[operand bytes: optional]
```

Operand formats vary by opcode:

- Literal references: `uint16` index into literal pool  
- Variable references: `uint16` frame offset  
- Jump offsets: `int16` relative offset  
- Array indices: popped from stack at runtime  

### **6.2 QCode Categories**

| Category | Description |
|----------|-------------|
| Load | Push variable or literal onto stack |
| Store | Pop value into variable |
| Arithmetic | ADD, SUB, MUL, DIV, MOD |
| Logical | AND, OR, NOT |
| Comparison | EQ, NE, LT, GT, LE, GE |
| Control Flow | IF, ELSE, ENDIF, WHILE, ENDWH, FOR, NEXT |
| Procedure | CALL, RETURN |
| System | PRINT, CLS, OPEN, READ, WRITE, etc. |

The full opcode table is defined in `opcode-table.csv`.

---

# **7. Alignment & Padding**

Psion `.OPO` files do **not** require alignment.  
All sections follow immediately after the previous one.

Padding is only used if:

- A section ends at an odd offset (rare)  
- The original compiler inserted reserved bytes (0x00)  

Your translator should **not** add padding unless required for compatibility.

---

# **8. Endianness**

All multi-byte values are **little-endian**.

---

# **9. Validation Rules**

A valid `.OPO` must satisfy:

- Magic number matches known Psion variants  
- Header offsets point to valid sections  
- Procedure table count matches header  
- Literal pool count matches entries  
- QCode offsets fall within file bounds  
- No opcode references out-of-range literals  
- No jumps outside procedure block  

Your loader must validate these conditions.

---

# **10. Minimal Example (Annotated)**

```
00 F7 01        ; magic (Series 5)
02 01 00        ; version 1.0
04 00 00        ; flags
06 01 00        ; 1 procedure
08 1C 00 00 00  ; procedure table offset
0C 40 00 00 00  ; literal pool offset
10 50 00 00 00  ; QCode offset
14 80 00 00 00  ; total file size
...
1C 04 'main'    ; name length + name
20 00           ; params
21 01           ; return type INT
22 00 00        ; locals
24 50 00 00 00  ; QCode offset
28 10 00 00 00  ; QCode size
...
40 02 00        ; literal count = 2
42 01 0A 00     ; INT literal 10
45 04 05 00 'hello' ; STRING literal
...
50 ... QCode ...
```

---

# **11. Differences Between Psion Generations**

### **11.1 Series 3 (SIBO)**

- Magic = `0xF700`  
- 16‑bit offsets  
- Smaller header  
- Different float format (4‑byte)  

### **11.2 Series 5 / EPOC32**

- Magic = `0xF701`  
- 32‑bit offsets  
- 8‑byte float format  
- Extended opcode set  

Your implementation targets **Series 5/EPOC32** unless explicitly configured otherwise.

---

# **12. Implementation Notes**

### **12.1 Translator Responsibilities**

- Build literal pool  
- Build procedure table  
- Generate QCode blocks  
- Compute offsets  
- Write header  
- Assemble final `.OPO`

### **12.2 Engine Responsibilities**

- Load header  
- Load procedure table  
- Load literal pool  
- Execute QCode blocks  

---

# **13. Non-Goals**

This spec does **not** include:

- Psion ROM formats  
- OPX extension modules  
- Symbian Unicode OPO variants  
- Debug symbol formats (optional extension)

---

# **14. Document Dependencies**

- **LANGUAGE.md** — semantics  
- **TRANSLATOR.md** — QCode generation  
- **ENGINE.md** — opcode execution  

