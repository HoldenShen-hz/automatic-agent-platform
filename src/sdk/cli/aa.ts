import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { readCliProcessEnv } from "./cli-env.js";
import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, isCliEntryPoint, runCliMain } from "./cli-exit.js";
import { CLI_ENTRYPOINTS } from "./index.js";

const COMMAND_ALIASES: Record<string, string> = {
  operator: "platform-operator",
};
const CLI_ENTRYPOINT_PATTERN = /^[a-z0-9-]+$/;
const CLI_ENV_SECRET_PATTERN = /(TOKEN|SECRET|PASSWORD|PRIVATE_KEY|ENCRYPTION_KEY|API_KEY|AWS_|GCP_|GOOGLE_APPLICATION_CREDENTIALS|VAULT_)/u;
const SAFE_CHILD_ENV_KEYS = new Set([
  "HOME",
  "PATH",
  "PWD",
  "SHELL",
  "SHLVL",
  "TERM",
  "COLORTERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TMPDIR",
  "TMP",
  "TEMP",
  "CI",
  "FORCE_COLOR",
  "NO_COLOR",
  "npm_config_user_agent",
  "npm_execpath",
  "npm_node_execpath",
  "AA_RUNNING_TESTS",
]);

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

function resolveCommand(maybeCommand: string): string | null {
  const aliasTarget = COMMAND_ALIASES[maybeCommand];
  const command = aliasTarget ?? maybeCommand;
  if (typeof aliasTarget === "string" && (!CLI_ENTRYPOINT_PATTERN.test(aliasTarget) || !CLI_ENTRYPOINTS.includes(aliasTarget as never))) {
    return null;
  }
  if (!CLI_ENTRYPOINT_PATTERN.test(command) || !CLI_ENTRYPOINTS.includes(command as never)) {
    return null;
  }
  return command;
}

function buildChildEnv(env: ReturnType<typeof readCliProcessEnv>): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = {
    AA_DEV_CLI_ENTRYPOINT: "1",
  };
  for (const [key, value] of Object.entries(env)) {
    if (value == null) {
      continue;
    }
    if (SAFE_CHILD_ENV_KEYS.has(key)) {
      childEnv[key] = value;
      continue;
    }
    if (key.startsWith("AA_") && !CLI_ENV_SECRET_PATTERN.test(key)) {
      childEnv[key] = value;
    }
  }
  return childEnv;
}

function signalToExitCode(signal: NodeJS.Signals): number {
  const signalNumber = osConstants.signals[signal];
  return typeof signalNumber === "number" ? 128 + signalNumber : CLI_EXIT_FAILURE;
}

async function main(): Promise<number> {
  const env = readCliProcessEnv();
  const [, , maybeCommand, ...args] = process.argv;
  if (maybeCommand == null || maybeCommand === "help" || maybeCommand === "--help" || maybeCommand === "-h") {
    printUsage();
    return CLI_EXIT_SUCCESS;
  }

  const command = resolveCommand(maybeCommand);
  if (command == null) {
    process.stderr.write(`Unknown aa command: ${maybeCommand}\n`);
    printUsage();
    return CLI_EXIT_FAILURE;
  }

  if (env.AA_RUNNING_TESTS === "1") {
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
    env: buildChildEnv(env),
  });

  let exitCode: number = CLI_EXIT_FAILURE;
  await new Promise<void>((resolve, reject) => {
    child.on("error", (error) => {
      process.exitCode = CLI_EXIT_FAILURE;
      exitCode = CLI_EXIT_FAILURE;
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (signal != null) {
        exitCode = signalToExitCode(signal);
        process.exitCode = exitCode;
        resolve();
        return;
      }
      exitCode = code ?? CLI_EXIT_FAILURE;
      process.exitCode = exitCode;
      resolve();
    });
  });

  return typeof process.exitCode === "number" ? process.exitCode : exitCode;
}

if (isCliEntryPoint(import.meta.url)) {
  void runCliMain(main);
}
