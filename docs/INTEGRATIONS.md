# **INTEGRATIONS.md — Host Capability & Platform Integration Specification**

## **1. Purpose**

This document defines the **host integration layer** for the OPL engine.  
The engine itself is platform‑neutral and must not contain any platform‑specific logic.

All external behaviour—UI, file I/O, organiser functions, REST APIs—is provided through a **Host Capability Interface**.

This allows:

- Web / Angular PWA runtime  
- Android runtime  
- Node/bun CLI runtime  
- Integration with **psion-link**  
- Optional REST-backed organiser functions  
- Optional modern UI widgets  

The VM calls host capabilities through a stable interface defined here.

---

# **2. Host Capability Architecture**

The host layer is composed of **capability modules**, each implementing a specific domain:

- **FileSystem**  
- **UI**  
- **Time/Date**  
- **System**  
- **Organizer** (Agenda, Contacts, etc.)  
- **Networking**  
- **Storage**  
- **Debug**  

Each capability is optional.  
If a capability is missing, the VM must raise the appropriate OPL error.

---

# **3. Host Interface (Canonical)**

The engine interacts with the host through a single interface:

```ts
export interface OplHost {
  fs: OplFileSystem;
  ui: OplUI;
  sys: OplSystem;
  time: OplTime;
  org?: OplOrganizer;   // optional
  net?: OplNetwork;     // optional
  store?: OplStorage;   // optional
  debug?: OplDebug;     // optional
}
```

Each module is defined below.

---

# **4. File System Capability**

OPL file operations (`OPEN`, `CLOSE`, `READ`, `WRITE`, `DELETE`) must map to:

### **4.1 Interface**

```ts
export interface OplFileSystem {
  open(path: string, mode: "r" | "w" | "rw"): Promise<number>;
  close(handle: number): Promise<void>;
  read(handle: number, length: number): Promise<Uint8Array>;
  write(handle: number, data: Uint8Array): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
```

### **4.2 Platform Mappings**

| Platform | Mapping |
|---------|---------|
| Web PWA | IndexedDB or OPFS |
| Angular | Same as Web PWA |
| Node/bun | Native FS |
| Android | Storage Access Framework |
| psion-link | PLP virtual FS |

---

# **5. UI Capability**

OPL UI commands (`PRINT`, `CLS`, `MENU`, `DIALOG`, etc.) must be mapped to host UI primitives.

### **5.1 Interface**

```ts
export interface OplUI {
  print(text: string): void;
  clear(): void;
  prompt(message: string): Promise<string>;
  menu(options: string[]): Promise<number>;
  notify(message: string): void;
}
```

### **5.2 Platform Mappings**

| Platform | Mapping |
|---------|---------|
| Web/Angular | DOM components, dialogs |
| Android | Activities, dialogs |
| Node/bun | Console output |
| psion-link | Terminal UI or remote UI |

---

# **6. Time & Date Capability**

OPL functions (`DATE`, `TIME`, `DAY`, etc.) must map to host time.

### **6.1 Interface**

```ts
export interface OplTime {
  nowDate(): number; // Psion DATE integer
  nowTime(): number; // Psion TIME integer
  formatDate(date: number): string;
  formatTime(time: number): string;
}
```

### **6.2 Psion Format Rules**

- DATE = days since 1 Jan 1900  
- TIME = seconds since midnight  

---

# **7. System Capability**

System-level functions (`ERR`, `BATTERY`, `PAUSE`, etc.)

### **7.1 Interface**

```ts
export interface OplSystem {
  pause(ms: number): Promise<void>;
  batteryLevel(): number; // 0–100
  getErr(): number;
  setErr(code: number): void;
}
```

---

# **8. Organizer Capability (Optional)**

This maps legacy OPL organiser functions to modern APIs.

### **8.1 Interface**

```ts
export interface OplOrganizer {
  calendar?: OplCalendar;
  contacts?: OplContacts;
}
```

### **8.2 Calendar**

```ts
export interface OplCalendar {
  listEvents(range: { start: number; end: number }): Promise<OplEvent[]>;
  createEvent(event: OplEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
```

### **8.3 Contacts**

```ts
export interface OplContacts {
  list(): Promise<OplContact[]>;
  findByName(name: string): Promise<OplContact | null>;
}
```

### **8.4 REST Mappings**

| Legacy OPL | Google Workspace | Microsoft Graph |
|------------|------------------|-----------------|
| `AGENDA` | Calendar API | `/me/events` |
| `CONTACTS` | People API | `/me/contacts` |

OAuth2 must be handled by the host, not the VM.

---

# **9. Networking Capability (Optional)**

Used for modern extensions (`HTTPGET`, `HTTPPOST`, etc.) if desired.

### **9.1 Interface**

```ts
export interface OplNetwork {
  get(url: string): Promise<string>;
  post(url: string, body: string): Promise<string>;
}
```

---

# **10. Storage Capability (Optional)**

For persistent key/value storage.

### **10.1 Interface**

```ts
export interface OplStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
```

### **10.2 Platform Mappings**

| Platform | Mapping |
|---------|---------|
| Web/Angular | IndexedDB |
| Android | SharedPreferences |
| Node/bun | JSON file |
| psion-link | PLP metadata |

---

# **11. Debug Capability (Optional)**

Used by IDE for breakpoints, tracing, inspection.

### **11.1 Interface**

```ts
export interface OplDebug {
  trace(opcode: number, ip: number): void;
  breakpoint(ip: number): void;
  inspectStack(): any[];
  inspectFrame(): any;
}
```

---

# **12. Capability Discovery**

The VM must detect capabilities at runtime:

```ts
if (!host.fs) throw new OplError(ERR_NO_FS);
if (!host.ui) throw new OplError(ERR_NO_UI);
```

This mirrors Psion’s “function not supported” behaviour.

---

# **13. Integration Profiles**

### **13.1 Web / Angular PWA**

- FS → IndexedDB/OPFS  
- UI → Angular components  
- Organizer → REST (optional)  
- Storage → IndexedDB  
- Debug → IDE panel  

### **13.2 Android**

- FS → SAF  
- UI → Activities/Dialogs  
- Organizer → Google Workspace / Graph  
- Storage → SharedPreferences  

### **13.3 Node/bun**

- FS → native FS  
- UI → console  
- Organizer → none  
- Storage → JSON file  

### **13.4 psion-link**

- FS → PLP virtual FS  
- UI → terminal or remote UI  
- Organizer → none  

---

# **14. Error Mapping**

Host errors must map to OPL error codes:

| Host Error | OPL Error |
|------------|-----------|
| File not found | `-3` |
| Permission denied | `-4` |
| Network failure | `-50` |
| Capability missing | `-100` |

---

# **15. Security Model**

- VM must never handle OAuth2 directly  
- Host must sandbox file access  
- Host must validate network requests  
- VM must treat all host failures as OPL errors  

---

# **16. Document Dependencies**

This specification depends on:

- **LANGUAGE.md** — system call semantics  
- **TRANSLATOR.md** — QCode generation  
- **ENGINE.md** — opcode execution  

