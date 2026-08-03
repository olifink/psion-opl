# **BRIEF.md**

## **OPL Re‑Implementation Project (Spec‑Driven, QCode‑Faithful)**

This project aims to create a **complete, specification‑driven re‑implementation of Psion OPL** (Organiser Programming Language) as used on Psion Series 3/5/7 and Symbian devices. The goal is to preserve the **original language semantics, token formats, QCode opcode definitions, and execution model**, while providing a modern, portable runtime and development environment.

The project consists of:

- A **TypeScript-based translator** (`.OPL` → `.OPO`) that produces **authentic QCode token streams**.
- A **TypeScript execution engine** that interprets original QCode faithfully.
- A **modern Angular 22+ PWA IDE**, offline-capable, mobile-responsive, integrating:
  - CodeMirror 2 with custom OPL grammar
  - Local project storage
  - Future integration with `psion-link` for file transfer and conversion
- Optional **host integrations** (REST-backed calendar, contacts, storage) that map legacy OPL system calls to modern APIs.

This repository is designed to be **fully spec-driven**, enabling automated implementation, verification, and future ports to other languages or platforms.

---

## **Project Principles**

### **1. Faithfulness to Original OPL**
The implementation must:

- Use **original QCode opcode definitions**  
- Preserve **original tokenisation rules**  
- Maintain **original runtime semantics** (types, scoping, error model, procedure model)  
- Support **original `.OPL` and `.OPO` formats**  
- Avoid “new OPL”, “extended OPL”, or reinterpretations unless explicitly isolated

All behaviour must be traceable to documented Psion/EPOC/Symbian OPL specifications.

### **2. Spec‑Driven Architecture**
All components defer to dedicated specification documents:

- **LANGUAGE.md** — syntax, semantics, types, procedures, system calls  
- **TRANSLATOR.md** — lexical rules, parser, QCode generation, `.OPO` structure  
- **ENGINE.md** — VM architecture, opcode execution, memory model, error handling  
- **INTEGRATIONS.md** — host APIs, REST mappings, platform abstractions

The codebase must follow these specs exactly.

### **3. Modern Tooling**
- **Translator + Engine:** TypeScript, bun runtime  
- **IDE:** Angular 22+, PWA, offline-first  
- **Editor:** CodeMirror 2 with custom OPL mode  
- **Companion:** Integration with `psion-link` for PLP protocol and file conversion

### **4. Portability**
The VM and translator must be portable to:

- WebAssembly  
- Node/bun  
- Native Android (via TypeScript → JS runtime or Rust port)  

All platform-specific behaviour must be isolated behind host capability interfaces.

---

## **Repository Structure**

```
BRIEF.md
/docs
  LANGUAGE.md
  TRANSLATOR.md
  ENGINE.md
  INTEGRATIONS.md

/packages
  /opl-language        # grammar, tokens, QCode definitions
  /opl-translator      # .OPL → .OPO compiler
  /opl-engine          # QCode VM
  /opl-host            # host capability interfaces + adapters
  /opl-shared          # common types, errors, utilities

/apps
  /opl-ide             # Angular 22+ PWA IDE
  /opl-cli             # bun-based CLI tools

/integrations
  /psion-link          # optional: local bridge to existing project
```

---

## **Core Components**

### **OPL Language**
Defines the canonical specification:

- Syntax and grammar  
- Types and coercion rules  
- Procedures, locals, globals  
- Control flow  
- Built-in functions  
- System calls (including organiser functions)  
- Error model (`ONERR`, error codes)  

This file is the authoritative reference for all other modules.

---

### **Translator**
Responsible for:

- Lexing and parsing `.OPL` source  
- Validating syntax and types  
- Generating **authentic QCode token streams**  
- Producing `.OPO` binaries matching original Psion structure  
- Emitting debug metadata for IDE integration  

The translator must be deterministic and spec-driven.

---

### **Engine**
Implements the execution environment:

- QCode interpreter  
- Stack model  
- Procedure calls  
- Variable storage  
- Error handling  
- Host capability dispatch  
- Execution tracing (optional)  

The engine must run original `.OPO` files without modification.

---

### **Integrations**
Defines how legacy OPL system calls map to modern capabilities:

- File storage (local, IndexedDB, cloud)  
- UI primitives (dialogs, menus, text input)  
- Optional organiser functions mapped to REST APIs:
  - Google Workspace  
  - Microsoft Graph  
- Device capabilities (clipboard, notifications, etc.)

All integrations must be optional and replaceable.

---

## **IDE (Angular 22+ PWA)**

The IDE provides:

- CodeMirror 2 editor with OPL grammar  
- Project explorer  
- `.OPL` → `.OPO` build pipeline  
- Execution sandbox using the engine  
- Offline storage (IndexedDB)  
- Integration with `psion-link` for PLP transfers  
- Mobile-responsive layout for tablets/phones  

The IDE must run fully offline.

---

## **Goals for v1.0**

- Parse and tokenise `.OPL` files  
- Generate valid `.OPO` binaries  
- Execute `.OPO` via QCode VM  
- Provide a functional offline IDE  
- Support basic host capabilities (file I/O, console UI)  
- Provide spec-complete documentation  

Organizer/REST integrations may be added in v1.1+.

---

## **Non‑Goals**

- No “new OPL” syntax  
- No reinterpretation of QCode  
- No partial or approximate VM  
- No dependency on Psion ROMs or proprietary binaries  
- No bundling of copyrighted Psion documentation  

---

## **Next Steps**

1. Finalize `LANGUAGE.md` with full grammar + semantics  
2. Define QCode opcode tables in `TRANSLATOR.md`  
3. Specify VM architecture in `ENGINE.md`  
4. Define host capability interfaces in `INTEGRATIONS.md`  
5. Scaffold packages and Angular IDE  
6. Begin implementing translator + engine in TypeScript  

