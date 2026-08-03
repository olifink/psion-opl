// Host capability interfaces — INTEGRATIONS.md §4-11.
// The engine calls through these interfaces only; it must never contain
// platform-specific logic directly (INTEGRATIONS.md §1, §2).

/** §4 File System Capability. */
export interface OplFileSystem {
  open(path: string, mode: "r" | "w" | "rw"): Promise<number>;
  close(handle: number): Promise<void>;
  read(handle: number, length: number): Promise<Uint8Array>;
  write(handle: number, data: Uint8Array): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

/** §5 UI Capability. */
export interface OplUI {
  print(text: string): void;
  clear(): void;
  prompt(message: string): Promise<string>;
  menu(options: string[]): Promise<number>;
  notify(message: string): void;
}

/** §6 Time & Date Capability. DATE = days since 1 Jan 1900, TIME = seconds since midnight. */
export interface OplTime {
  nowDate(): number;
  nowTime(): number;
  formatDate(date: number): string;
  formatTime(time: number): string;
}

/** §7 System Capability. */
export interface OplSystem {
  pause(ms: number): Promise<void>;
  batteryLevel(): number;
  getErr(): number;
  setErr(code: number): void;
}

/** §8.2 Calendar event — fields implied by OplCalendar's usage, not spelled out in INTEGRATIONS.md. */
export interface OplEvent {
  id: string;
  title: string;
  start: number;
  end: number;
}

export interface OplCalendar {
  listEvents(range: { start: number; end: number }): Promise<OplEvent[]>;
  createEvent(event: OplEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}

/** §8.3 Contact — fields implied by OplContacts's usage, not spelled out in INTEGRATIONS.md. */
export interface OplContact {
  id: string;
  name: string;
}

export interface OplContacts {
  list(): Promise<OplContact[]>;
  findByName(name: string): Promise<OplContact | null>;
}

/** §8 Organizer Capability (optional). */
export interface OplOrganizer {
  calendar?: OplCalendar;
  contacts?: OplContacts;
}

/** §9 Networking Capability (optional). */
export interface OplNetwork {
  get(url: string): Promise<string>;
  post(url: string, body: string): Promise<string>;
}

/** §10 Storage Capability (optional). */
export interface OplStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** §11 Debug Capability (optional). */
export interface OplDebug {
  trace(opcode: number, ip: number): void;
  breakpoint(ip: number): void;
  inspectStack(): unknown[];
  inspectFrame(): unknown;
}

/** §3 Host Interface (canonical). */
export interface OplHost {
  fs: OplFileSystem;
  ui: OplUI;
  sys: OplSystem;
  time: OplTime;
  org?: OplOrganizer;
  net?: OplNetwork;
  store?: OplStorage;
  debug?: OplDebug;
}
