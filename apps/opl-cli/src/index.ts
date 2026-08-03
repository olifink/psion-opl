#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { translate } from "@psion-opl/opl-translator";
import { QCodeEngine } from "@psion-opl/opl-engine";
import { createNodeHost } from "@psion-opl/opl-host";

const [command, file] = process.argv.slice(2);

async function build(oplPath: string): Promise<void> {
  const source = await readFile(oplPath, "utf8");
  const result = translate(source);
  const opoPath = oplPath.replace(/\.opl$/i, ".opo");
  await writeFile(opoPath, result.opo);
  console.log(`Wrote ${opoPath}`);
}

async function run(opoPath: string): Promise<void> {
  const binary = await readFile(opoPath);
  const host = createNodeHost();
  const engine = new QCodeEngine(host);
  engine.loadOpo(new Uint8Array(binary));
  await engine.run();
}

async function main(): Promise<void> {
  switch (command) {
    case "build":
      if (!file) throw new Error("Usage: opl build <file.opl>");
      await build(file);
      break;
    case "run":
      if (!file) throw new Error("Usage: opl run <file.opo>");
      await run(file);
      break;
    default:
      console.log("Usage: opl <build|run> <file>");
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
