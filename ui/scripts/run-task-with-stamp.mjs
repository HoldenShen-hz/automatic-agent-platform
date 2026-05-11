import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

const [taskName, ...command] = process.argv.slice(2);

if (taskName == null || taskName.length === 0 || command.length === 0) {
  console.error("Usage: node ./scripts/run-task-with-stamp.mjs <task-name> <command> [args...]");
  process.exit(1);
}

const startedAt = new Date().toISOString();
const child = spawn(command[0], command.slice(1), {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (code !== 0 || signal != null) {
    process.exit(code ?? 1);
  }

  const outputPath = join(process.cwd(), ".turbo", "tasks", `${taskName}.json`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify({
    task: taskName,
    command,
    startedAt,
    completedAt: new Date().toISOString(),
  }, null, 2));
  process.exit(0);
});
