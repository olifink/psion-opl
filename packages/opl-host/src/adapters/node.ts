// Node/bun host adapter — INTEGRATIONS.md §13.3 (FS -> native FS, UI -> console,
// Organizer -> none, Storage -> JSON file).

import { open, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import * as readline from "node:readline/promises";
import type { OplFileSystem, OplHost, OplStorage, OplSystem, OplTime, OplUI } from "../capabilities.js";

class NodeFileSystem implements OplFileSystem {
  private handles = new Map<number, FileHandle>();
  private nextHandle = 1;

  async open(path: string, mode: "r" | "w" | "rw"): Promise<number> {
    const flags = mode === "r" ? "r" : mode === "w" ? "w" : "r+";
    const handle = await open(path, flags);
    const id = this.nextHandle++;
    this.handles.set(id, handle);
    return id;
  }

  async close(handle: number): Promise<void> {
    await this.handles.get(handle)?.close();
    this.handles.delete(handle);
  }

  async read(handle: number, length: number): Promise<Uint8Array> {
    const fh = this.handles.get(handle);
    if (!fh) throw new Error(`Unknown file handle ${handle}`);
    const buffer = new Uint8Array(length);
    const { bytesRead } = await fh.read(buffer, 0, length);
    return buffer.subarray(0, bytesRead);
  }

  async write(handle: number, data: Uint8Array): Promise<void> {
    const fh = this.handles.get(handle);
    if (!fh) throw new Error(`Unknown file handle ${handle}`);
    await fh.write(data);
  }

  async delete(path: string): Promise<void> {
    await rm(path, { force: true });
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(path);
  }
}

class ConsoleUI implements OplUI {
  private rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  print(text: string): void {
    process.stdout.write(text);
  }

  clear(): void {
    process.stdout.write("\x1Bc");
  }

  async prompt(message: string): Promise<string> {
    return this.rl.question(message);
  }

  async menu(options: string[]): Promise<number> {
    options.forEach((opt, i) => this.print(`${i + 1}. ${opt}\n`));
    const answer = await this.rl.question("> ");
    return Number.parseInt(answer, 10) - 1;
  }

  notify(message: string): void {
    this.print(`[notify] ${message}\n`);
  }
}

/** DATE = days since 1 Jan 1900, TIME = seconds since midnight — INTEGRATIONS.md §6.2. */
const PSION_EPOCH = Date.UTC(1900, 0, 1);

class NodeTime implements OplTime {
  nowDate(): number {
    return Math.floor((Date.now() - PSION_EPOCH) / 86_400_000);
  }

  nowTime(): number {
    const now = new Date();
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  }

  formatDate(date: number): string {
    return new Date(PSION_EPOCH + date * 86_400_000).toISOString().slice(0, 10);
  }

  formatTime(time: number): string {
    const h = Math.floor(time / 3600) % 24;
    const m = Math.floor(time / 60) % 60;
    const s = time % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }
}

class NodeSystem implements OplSystem {
  private errCode = 0;

  async pause(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  batteryLevel(): number {
    return 100;
  }

  getErr(): number {
    return this.errCode;
  }

  setErr(code: number): void {
    this.errCode = code;
  }
}

class JsonFileStorage implements OplStorage {
  constructor(private readonly path: string) {}

  private async load(): Promise<Record<string, string>> {
    if (!existsSync(this.path)) return {};
    return JSON.parse(await readFile(this.path, "utf8"));
  }

  private async save(data: Record<string, string>): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(data, null, 2));
  }

  async get(key: string): Promise<string | null> {
    const data = await this.load();
    return data[key] ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const data = await this.load();
    data[key] = value;
    await this.save(data);
  }

  async delete(key: string): Promise<void> {
    const data = await this.load();
    delete data[key];
    await this.save(data);
  }
}

export interface NodeHostOptions {
  /** Path to the JSON file backing the storage capability. */
  storagePath?: string;
}

export function createNodeHost(options: NodeHostOptions = {}): OplHost {
  return {
    fs: new NodeFileSystem(),
    ui: new ConsoleUI(),
    sys: new NodeSystem(),
    time: new NodeTime(),
    store: options.storagePath ? new JsonFileStorage(options.storagePath) : undefined,
  };
}
