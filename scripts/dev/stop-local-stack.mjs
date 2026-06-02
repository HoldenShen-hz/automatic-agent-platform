import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  classifyPortListeners,
  readLocalStackPort,
  resolveRequiredBinaryPath,
} from "./local-stack-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(__dirname));
const pidDir = join(repoRoot, "data", "dev-runtime", "pids");
const apiPidFile = join(pidDir, "api-server.pid");
const uiPidFile = join(pidDir, "ui-web.pid");
const psCommand = resolveRequiredBinaryPath("ps", ["/bin/ps", "/usr/bin/ps"]);
const lsofCommand = resolveRequiredBinaryPath("lsof", ["/usr/sbin/lsof", "/usr/bin/lsof", "/bin/lsof"]);

function readPid(pidFile) {
  try {
    const value = readFileSync(pidFile, "utf8").trim();
    if (value.length === 0) {
      return null;
    }
    const pid = Number.parseInt(value, 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isPidAlive(pid) {
  if (pid == null) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function listenerPids(port) {
  const result = spawnSync(lsofCommand, ["-ti", `tcp:${port}`], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0 || result.stdout.trim().length === 0) {
    return [];
  }
  return result.stdout
    .trim()
    .split("\n")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry));
}

function commandForPid(pid) {
  const result = spawnSync(psCommand, ["-p", String(pid), "-o", "command="], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function matchesManagedCommand(command, label) {
  if (label === "api" || label === "metrics") {
    return command.includes("dist/src/sdk/cli/api-server.js");
  }
  if (label === "ui") {
    return command.includes("--workspace @aa/web run dev") || command.includes("node_modules/.bin/vite");
  }
  return false;
}

function stopPid(pid, label) {
  if (!isPidAlive(pid)) {
    return;
  }
  process.kill(pid, "SIGTERM");
  console.log(`[stop] ${label} pid ${pid}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopPidAndWait(pid, label) {
  if (!isPidAlive(pid)) {
    return;
  }
  const originalCommand = commandForPid(pid);
  stopPid(pid, label);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isPidAlive(pid)) {
      return;
    }
    await sleep(250);
  }
  if (isPidAlive(pid)) {
    const currentCommand = commandForPid(pid);
    if (currentCommand !== originalCommand || !matchesManagedCommand(currentCommand, label.split("/")[0] ?? label)) {
      console.log(`[stop] ${label} pid ${pid} changed identity before SIGKILL; skipping force kill`);
      return;
    }
    process.kill(pid, "SIGKILL");
    console.log(`[stop] ${label} pid ${pid} force-killed`);
  }
}

async function main() {
  const portMatrix = [
    [readLocalStackPort(process.env, "AA_LOCAL_API_PORT", 4000), "api"],
    [readLocalStackPort(process.env, "AA_LOCAL_METRICS_PORT", 4001), "metrics"],
    [readLocalStackPort(process.env, "AA_LOCAL_UI_PORT", 5173), "ui"],
  ];
  const tracked = [
    { pid: readPid(apiPidFile), label: "api" },
    { pid: readPid(uiPidFile), label: "ui" },
  ];
  const trackedApiPid = tracked.find((entry) => entry.label === "api")?.pid ?? null;
  const trackedUiPid = tracked.find((entry) => entry.label === "ui")?.pid ?? null;

  for (const entry of tracked) {
    await stopPidAndWait(entry.pid, entry.label);
  }

  for (const [port, label] of portMatrix) {
    const trackedPids = label === "ui" ? [trackedUiPid] : [trackedApiPid];
    const { managedPids, unmanagedPids } = classifyPortListeners(listenerPids(port), trackedPids);
    if (unmanagedPids.length > 0) {
      console.log(
        `[stop] ${label} port ${port} still occupied by unmanaged pid(s): ${unmanagedPids.join(", ")}; skipping force termination`,
      );
    }
    for (const pid of managedPids) {
      const command = commandForPid(pid);
      if (!matchesManagedCommand(command, label)) {
        console.log(`[stop] ${label}/port pid ${pid} no longer matches managed command identity; skipping`);
        continue;
      }
      await stopPidAndWait(pid, `${label}/port`);
    }
  }
}

await main();
