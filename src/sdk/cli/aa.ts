import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, isCliEntryPoint, runCliMain } from "./cli-exit.js";
import { CLI_ENTRYPOINTS } from "./index.js";

const COMMAND_ALIASES: Record<string, string> = {
  operator: "platform-operator",
};
const CLI_ENTRYPOINT_PATTERN = /^[a-z0-9-]+$/;

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

async function main(): Promise<number> {
  const [, , maybeCommand, ...args] = process.argv;
  if (maybeCommand == null || maybeCommand === "help" || maybeCommand === "--help" || maybeCommand === "-h") {
    printUsage();
    return CLI_EXIT_SUCCESS;
  }

  const command = COMMAND_ALIASES[maybeCommand] ?? maybeCommand;
  if (!CLI_ENTRYPOINT_PATTERN.test(command) || !CLI_ENTRYPOINTS.includes(command as never)) {
    process.stderr.write(`Unknown aa command: ${maybeCommand}\n`);
    printUsage();
    return CLI_EXIT_FAILURE;
  }

  if (process.env.AA_RUNNING_TESTS === "1") {
    process.stderr.write(
      "aa:dev is disabled while AA_RUNNING_TESTS=1 to avoid writing real runtime state during tests.\n",
    );
    return CLI_EXIT_FAILURE;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const sourceChildEntrypoint = join(moduleDir, `${command}.ts`);
  const compiledChildEntrypoint = join(moduleDir, `${command}.js`);
  const useSourceEntrypoint = existsSync(sourceChildEntrypoint);
  const childEntrypoint = useSourceEntrypoint ? sourceChildEntrypoint : compiledChildEntrypoint;
  if (!existsSync(childEntrypoint)) {
    process.stderr.write(`Invalid aa command target: ${command}\n`);
    return CLI_EXIT_FAILURE;
  }
  const childArgs = useSourceEntrypoint
    ? ["--import", "tsx", childEntrypoint, ...args]
    : [childEntrypoint, ...args];
  const child = spawn(process.execPath, childArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      AA_DEV_CLI_ENTRYPOINT: "1",
    },
  });

  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal != null) {
        process.kill(process.pid, signal);
        return;
      }
      process.exitCode = code ?? CLI_EXIT_FAILURE;
      resolve();
    });
  });

  return typeof process.exitCode === "number" ? process.exitCode : CLI_EXIT_FAILURE;
}

if (isCliEntryPoint(import.meta.url)) {
  void runCliMain(main);
}
