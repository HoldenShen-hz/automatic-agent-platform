import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CLI_ENTRYPOINTS } from "./index.js";

const COMMAND_ALIASES: Record<string, string> = {
  operator: "platform-operator",
};

function printUsage(): void {
  process.stdout.write(
    [
      "Usage: aa <command> [args...]",
      "",
      "Available commands:",
      ...CLI_ENTRYPOINTS.map((command) => `- ${command}`),
      "",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const [, , maybeCommand, ...args] = process.argv;
  if (maybeCommand == null || maybeCommand === "help" || maybeCommand === "--help" || maybeCommand === "-h") {
    printUsage();
    return;
  }

  const command = COMMAND_ALIASES[maybeCommand] ?? maybeCommand;
  if (!CLI_ENTRYPOINTS.includes(command as never)) {
    process.stderr.write(`Unknown aa command: ${maybeCommand}\n`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const child = spawn(process.execPath, [join(moduleDir, `${command}.js`), ...args], {
    stdio: "inherit",
    env: process.env,
  });

  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal != null) {
        process.kill(process.pid, signal);
        return;
      }
      process.exitCode = code ?? 1;
      resolve();
    });
  });
}

await main();
