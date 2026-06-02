import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import {
  buildLocalStackChildEnv,
  classifyPortListeners,
  readLocalStackPort,
  resolveRequiredBinaryPath,
  resolveRequiredNpmCliPath,
} from "./local-stack-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(__dirname));
const runtimeDir = join(repoRoot, "data", "dev-runtime");
const pidDir = join(runtimeDir, "pids");
const logDir = join(runtimeDir, "logs");

const apiPidFile = join(pidDir, "api-server.pid");
const uiPidFile = join(pidDir, "ui-web.pid");
const apiLogFile = join(logDir, "api-server.log");
const uiLogFile = join(logDir, "ui-web.log");
const psCommand = resolveRequiredBinaryPath("ps", ["/bin/ps", "/usr/bin/ps"]);
const lsofCommand = resolveRequiredBinaryPath("lsof", ["/usr/sbin/lsof", "/usr/bin/lsof", "/bin/lsof"]);
const npmCliPath = resolveRequiredNpmCliPath(process.execPath, process.env);
const apiPort = readLocalStackPort(process.env, "AA_LOCAL_API_PORT", 4000);
const metricsPort = readLocalStackPort(process.env, "AA_LOCAL_METRICS_PORT", 4001);
const uiPort = readLocalStackPort(process.env, "AA_LOCAL_UI_PORT", 5173);

mkdirSync(pidDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function commandForPid(pid) {
  const result = spawnSync(psCommand, ["-p", String(pid), "-o", "command="], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
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

async function terminatePid(pid) {
  if (!isPidAlive(pid)) {
    return;
  }
  process.kill(pid, "SIGTERM");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isPidAlive(pid)) {
      return;
    }
    await sleep(250);
  }
  if (isPidAlive(pid)) {
    process.kill(pid, "SIGKILL");
  }
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

async function cleanupPort(port, label) {
  const trackedPids =
    label === "ui"
      ? [readPid(uiPidFile)]
      : [readPid(apiPidFile)];
  const { managedPids, unmanagedPids } = classifyPortListeners(listenerPids(port), trackedPids);
  if (unmanagedPids.length > 0) {
    throw new Error(
      `Port ${port} for ${label} is occupied by unmanaged pid(s): ${unmanagedPids.join(", ")}. Refusing automatic termination.`,
    );
  }
  for (const pid of managedPids) {
    const command = commandForPid(pid);
    if (!matchesManagedCommand(command, label)) {
      throw new Error(`Tracked ${label} pid ${pid} no longer matches managed command identity.`);
    }
    console.log(`[cleanup] closing ${label} process ${pid}`);
    await terminatePid(pid);
  }
}

function spawnDetached(command, args, options) {
  const stdio =
    options.stdioMode === "ignore"
      ? "ignore"
      : ["ignore", "ignore", "ignore"];
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: buildLocalStackChildEnv(process.env, options.env),
    detached: true,
    stdio,
  });
  child.unref();
  return child.pid;
}

function request(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body,
        });
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timed out waiting for ${url}`));
    });
    req.on("error", reject);
  });
}

async function waitForHttp(url, matcher, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await request(url);
      if (matcher(response)) {
        return response;
      }
    } catch {
      // Keep polling until timeout.
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function runBuild() {
  console.log("[build] building backend");
  const result = spawnSync(process.execPath, [npmCliPath, "run", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("Backend build failed.");
  }
}

async function ensureApi() {
  const existingPid = readPid(apiPidFile);
  if (existingPid != null && isPidAlive(existingPid)) {
    const health = await request(`http://127.0.0.1:${apiPort}/healthz`).catch(() => null);
    if (health?.statusCode === 200) {
      console.log(`[api] already running on http://127.0.0.1:${apiPort}`);
      return;
    }
  }

  await cleanupPort(apiPort, "api");
  await cleanupPort(metricsPort, "metrics");

  const env = {
    AA_DB_PATH: join(repoRoot, "data", "sqlite", "automatic-agent-dev.db"),
    AA_API_HOST: "127.0.0.1",
    AA_API_PORT: String(apiPort),
    AA_METRICS_HOST: "127.0.0.1",
    AA_METRICS_PORT: String(metricsPort),
    AA_LOG_STDOUT: "0",
    AA_LOG_FILE_PATH: apiLogFile,
  };

  const pid = spawnDetached(
    "node",
    ["--enable-source-maps", "dist/src/sdk/cli/api-server.js"],
    {
      cwd: repoRoot,
      env,
      stdioMode: "ignore",
    },
  );
  writeFileSync(apiPidFile, `${pid}\n`, "utf8");
  await waitForHttp(
    `http://127.0.0.1:${apiPort}/healthz`,
    (response) => response.statusCode === 200 && /"status"\s*:\s*"ok"/u.test(response.body),
    30_000,
  );
  await waitForHttp(
    `http://127.0.0.1:${metricsPort}/metrics`,
    (response) => response.statusCode === 200 && response.body.includes("process_cpu_seconds_total"),
    15_000,
  );
  console.log(`[api] ready on http://127.0.0.1:${apiPort}`);
}

async function ensureUi() {
  const existingPid = readPid(uiPidFile);
  if (existingPid != null && isPidAlive(existingPid)) {
    const response = await request(`http://localhost:${uiPort}/`).catch(() => null);
    if (response?.statusCode === 200 && response.body.includes("Automatic Agent Platform UI")) {
      console.log(`[ui] already running on http://localhost:${uiPort}`);
      return;
    }
  }

  await cleanupPort(uiPort, "ui");

  const env = {
    VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}/api`,
    VITE_WS_URL: `ws://127.0.0.1:${apiPort}/ws/v1/stream`,
  };
  appendFileSync(
    uiLogFile,
    "[local-stack] UI process launched without raw stdout/stderr capture to avoid unredacted log sinks.\n",
    "utf8",
  );

  const pid = spawnDetached(
    process.execPath,
    [npmCliPath, "--prefix", "ui", "--workspace", "@aa/web", "run", "dev", "--", "--host", "localhost", "--port", String(uiPort)],
    {
      cwd: repoRoot,
      env,
      stdioMode: "ignore",
    },
  );
  writeFileSync(uiPidFile, `${pid}\n`, "utf8");
  await waitForHttp(
    `http://localhost:${uiPort}/`,
    (response) => response.statusCode === 200 && response.body.includes("Automatic Agent Platform UI"),
    30_000,
  );
  console.log(`[ui] ready on http://localhost:${uiPort}`);
}

async function main() {
  runBuild();
  await ensureApi();
  await ensureUi();
  console.log("");
  console.log("Local stack is ready:");
  console.log(`- UI: http://localhost:${uiPort}`);
  console.log(`- API health: http://127.0.0.1:${apiPort}/healthz`);
  console.log(`- API contract: http://127.0.0.1:${apiPort}/api/v1/meta/contract-version`);
  console.log(`- Metrics: http://127.0.0.1:${metricsPort}/metrics`);
  console.log(`- API log: ${apiLogFile}`);
  console.log(`- UI log: ${uiLogFile}`);
}

await main();
