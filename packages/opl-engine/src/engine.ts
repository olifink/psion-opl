import type { OplValue } from "@psion-opl/opl-shared";
import type { OplHost } from "@psion-opl/opl-host";

/** Engine API — ENGINE.md §9.1. */
export interface OplEngine {
  loadOpo(binary: Uint8Array): void;
  reset(): void;
  run(entryProcName?: string): Promise<void>;
  /** Optional single-step for debugging — ENGINE.md §9.2. */
  step(): void;
  getGlobal(name: string): OplValue;
  setGlobal(name: string, value: OplValue): void;
}

/**
 * QCode interpreter over `.OPO` binaries (ENGINE.md §2-7), dispatching host
 * calls through OplHost (ENGINE.md §8, INTEGRATIONS.md).
 *
 * Not yet implemented — stack/frame model, opcode dispatch, and ONERR handling
 * are future work tracked against ENGINE.md and docs/opo-table.csv.
 */
export class QCodeEngine implements OplEngine {
  constructor(private readonly host: OplHost) {}

  loadOpo(_binary: Uint8Array): void {
    throw new Error("opl-engine: loadOpo() is not yet implemented");
  }

  reset(): void {
    throw new Error("opl-engine: reset() is not yet implemented");
  }

  async run(_entryProcName?: string): Promise<void> {
    throw new Error("opl-engine: run() is not yet implemented");
  }

  step(): void {
    throw new Error("opl-engine: step() is not yet implemented");
  }

  getGlobal(_name: string): OplValue {
    throw new Error("opl-engine: getGlobal() is not yet implemented");
  }

  setGlobal(_name: string, _value: OplValue): void {
    throw new Error("opl-engine: setGlobal() is not yet implemented");
  }
}
