import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import {
  buildLocalStackChildEnv,
  classifyPortListeners,
  loadLocalStackProviderEnv,
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
const localProviderEnv = loadLocalStackProviderEnv(repoRoot, process.env);
const LOCAL_DEV_API_KEY = "local-dev-platform-operator";
const LOCAL_DEV_JWT_SECRET = "AA-local-dev-jwt-2026-06-04-4n7Qp9Lc2Vx8MzK5Rt1Hy6Ws3Ef0Ud";
const LOCAL_DEV_AUDIT_INTEGRITY_HMAC_KEY =
  process.env.AA_AUDIT_INTEGRITY_HMAC_KEY
  ?? "AA-local-dev-audit-integrity-key-2026-06-05-7Lm2Qp4Nx8Rt1Hy6Ks9Uv3Wd";

mkdirSync(pidDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAcceptableApiHealthResponse(response) {
  if (response.statusCode !== 200 && response.statusCode !== 503) {
    return false;
  }
  return /"status"\s*:\s*"(ok|degraded|overloaded|unhealthy)"/u.test(response.body);
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
  const result = spawnSync(lsofCommand, ["-tiTCP:" + String(port), "-sTCP:LISTEN"], {
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

async function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const payload = options.body == null ? null : JSON.stringify(options.body);
    const req = http.request(url, {
      method: options.method ?? (payload == null ? "GET" : "POST"),
      headers: {
        ...(payload == null ? {} : {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload, "utf8"),
        }),
        ...(options.headers ?? {}),
      },
      timeout: options.timeoutMs ?? 5000,
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(`HTTP ${response.statusCode ?? 500}: ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    if (payload != null) {
      req.write(payload);
    }
    req.end();
  });
}

async function issueLocalDevAuthToken() {
  const response = await requestJson(`http://127.0.0.1:${apiPort}/v1/auth/token`, {
    method: "POST",
    body: { apiKey: LOCAL_DEV_API_KEY },
  });
  const token = response?.data?.accessToken;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Failed to issue local dev auth token.");
  }
  return token;
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
    if (health != null && isAcceptableApiHealthResponse(health)) {
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
    AA_API_ENABLE_WEBSOCKET: "true",
    AA_API_ALLOWED_ORIGINS: `http://localhost:${uiPort},http://127.0.0.1:${uiPort}`,
    AA_API_TOKEN_TTL_MS: String(24 * 60 * 60 * 1000),
    AA_API_KEYS_JSON: JSON.stringify([
      {
        apiKey: LOCAL_DEV_API_KEY,
        actorId: "local-dev-operator",
        roles: ["admin"],
      },
    ]),
    AA_API_JWT_SECRET: LOCAL_DEV_JWT_SECRET,
    AA_AUDIT_INTEGRITY_HMAC_KEY: LOCAL_DEV_AUDIT_INTEGRITY_HMAC_KEY,
    AA_METRICS_HOST: "127.0.0.1",
    AA_METRICS_PORT: String(metricsPort),
    AA_LOG_STDOUT: "0",
    AA_LOG_FILE_PATH: apiLogFile,
    ...localProviderEnv.env,
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
    (response) => isAcceptableApiHealthResponse(response),
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

  const authToken = await issueLocalDevAuthToken();
  const env = {
    AA_UI_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
    VITE_API_BASE_URL: "/api",
    VITE_API_FALLBACK_TO_MOCK: "false",
    VITE_AUTH_TOKEN: authToken,
    VITE_WS_URL: `ws://localhost:${uiPort}/ws/v1/stream`,
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
  if (localProviderEnv.sourcePath != null) {
    console.log(`[config] loaded local provider config from ${localProviderEnv.sourcePath}`);
  }
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
