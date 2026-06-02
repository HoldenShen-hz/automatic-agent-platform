import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..", "..");

const commands = [
  ["npm", ["run", "assurance:review-import:check"]],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: "pass",
      executed: commands.map(([command, args]) => [command, ...args].join(" ")),
    },
    null,
    2,
  )}\n`,
);
