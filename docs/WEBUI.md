# WEBUI.md — Web IDE & UI Specification (Angular 22+ PWA)

## 1. Purpose

This document defines the **web IDE** for the OPL project:

- Framework: **Angular 22+**
- Mode: **PWA**, fully offline‑capable
- Design: **Material 3 Expressive**
- Editor: **CodeMirror 2** (custom OPL mode)
- Storage: **OPFS** (one‑level project hierarchy)
- Capabilities: **edit, translate, run, debug, inspect, step, navigate, trace, visualize**

The IDE is the primary UI for developing and running OPL programs in the browser.

---

## 2. Architecture Overview

### 2.1 App Structure

- **Shell**: Angular app with Material 3 layout
- **Core Services**:
  - ProjectService (OPFS)
  - TranslatorService (OPL → OPO)
  - EngineService (QCode VM)
  - DebugService (breakpoints, stepping, tracing)
- **Feature Modules**:
  - EditorModule (CodeMirror)
  - ExplorerModule (projects/files)
  - ConsoleModule (output/logs)
  - DebuggerModule (stack/variables/breakpoints)
  - VisualizerModule (flow/traces)

### 2.2 PWA

- Service Worker for offline caching
- Manifest for installable app
- OPFS for persistent project storage

---

## 3. UI Layout

### 3.1 Main Regions

- **Top App Bar**: project name, run/stop, translate, debug controls
- **Left Sidebar**: project explorer (files, one‑level hierarchy)
- **Center**: CodeMirror editor
- **Bottom Panel**: console output, diagnostics
- **Right Panel**: debugger (variables, stack, breakpoints, call tree)

### 3.2 Material 3 Expressive

- Use M3 expressive typography and color system
- Responsive layout for desktop/tablet/phone
- Dark/light theme toggle

---

## 4. Editor (CodeMirror 2)

### 4.1 OPL Mode

- Custom syntax highlighting:
  - Keywords (`PROC`, `ENDP`, `IF`, `WHILE`, etc.)
  - Types (`%`, `&`, `#`, `$` suffixes)
  - Literals (numbers, strings)
  - Comments (`REM`)
- Indentation rules based on block structure
- Matching `PROC`/`ENDP`, `IF`/`ENDIF`, `WHILE`/`ENDWH`, `SELECT`/`ENDSEL`

### 4.2 Suggestions & Completion

- Keyword completion
- Procedure name completion
- Variable name completion (from symbol table)
- Context‑aware suggestions (e.g. `ENDP` after `PROC`)

### 4.3 Diagnostics Integration

- Inline error markers from TranslatorService
- Hover tooltips for errors
- Gutter icons for breakpoints

---

## 5. Projects & Files (OPFS)

### 5.1 Structure

- One‑level hierarchy:
  - Project
    - `.OPL` source files
    - Generated `.OPO` binaries
    - Metadata (JSON)

No nested subfolders.

### 5.2 Operations

- Create project
- Rename project
- Create/delete `.OPL` file
- Save/load via OPFS
- Export/import project (ZIP or JSON bundle)

---

## 6. Translate, Run & Debug

### 6.1 Translate

- Button: **Translate**
- Action:
  - Call TranslatorService on current file
  - Produce `.OPO`
  - Show diagnostics in bottom panel
  - Store `.OPO` in project

### 6.2 Run

- Button: **Run**
- Action:
  - Load `.OPO` into EngineService
  - Run `main` or selected entry procedure
  - Stream output to console panel

### 6.3 Debug

- Controls:
  - Run
  - Pause
  - Step Into
  - Step Over
  - Step Out
  - Stop

- Breakpoints:
  - Set/clear in editor gutter
  - EngineService stops at QCode offsets mapped to source lines

---

## 7. Inspectors & Navigation

### 7.1 Variable Inspector

- Shows locals, globals, parameters for current frame
- Updates on each step
- Supports basic editing (change value during debug)

### 7.2 Stack & Call Tree

- Stack view: frames with procedure names and IP
- Call tree: hierarchical view of current call chain

### 7.3 Code Navigation

- Go to definition (procedures, labels)
- Find references (procedure calls)
- Outline view (procedures, globals)

---

## 8. Tracing & Flow Visualization

### 8.1 Trace

- DebugService records:
  - Executed opcodes
  - IP positions
  - Stack changes
- UI:
  - Timeline view of execution
  - Filter by procedure or opcode

### 8.2 Flow Visualization

- Graph view:
  - Nodes: procedures, blocks (`IF`, `WHILE`, `SELECT`)
  - Edges: control flow (jumps, calls)
- Live overlay:
  - Highlight current node during debug
  - Option to replay trace over graph

---

## 9. Integration Points

- **TranslatorService**: uses `TRANSLATOR.md` spec
- **EngineService**: uses `ENGINE.md` + `opcode-table.csv`
- **Host integration**: uses `INTEGRATIONS.md` (Web profile)
- **OPFS**: browser file system API
- **psion-link** (optional):
  - Import/export `.OPL`/`.OPO` via PLP
  - Sync with real Psion devices

---

## 10. Non‑Goals

- No multi‑user collaboration
- No complex VCS integration (Git optional later)
- No deep subfolder hierarchies
- No non‑OPL languages
