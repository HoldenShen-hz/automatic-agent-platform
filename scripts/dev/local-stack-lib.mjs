import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const LOCAL_STACK_SECRET_ENV_PATTERNS = Object.freeze([
  /^AWS_/u,
  /^AZURE_/u,
  /^GCP_/u,
  /^GOOGLE_/u,
  /^KUBE/u,
  /^SSH_AUTH_SOCK$/u,
  /^AA_API_KEYS_JSON$/u,
  /(^|_)(TOKEN|SECRET|PASSWORD|PASS|PRIVATE_KEY|API_KEY|AUTH|AUTHORIZATION|ACCESS_KEY|SESSION_KEY|CREDENTIAL|CREDENTIALS|CERT)(_|$)/iu,
  /(^|_)(FILE|KEY|KEYS)(_|$)/iu,
]);

export function readLocalStackPort(env, name, fallback) {
  const raw = env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  if (!/^[0-9]{1,5}$/u.test(raw)) {
    throw new Error(`Invalid port in ${name}: ${raw}`);
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid port in ${name}: ${raw}`);
  }
  return parsed;
}

export function buildLocalStackChildEnv(sourceEnv, overrides = {}) {
  const env = {};
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (value == null) {
      continue;
    }
    if (LOCAL_STACK_SECRET_ENV_PATTERNS.some((pattern) => pattern.test(key))) {
      continue;
    }
    env[key] = value;
  }
  return {
    ...env,
    ...overrides,
  };
}

export function resolveRequiredBinaryPath(toolName, candidates) {
  const resolved = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!resolved) {
    throw new Error(`Required executable for ${toolName} not found. Checked: ${candidates.join(", ")}`);
  }
  return resolved;
}

export function resolveRequiredNpmCliPath(nodeExecPath, env) {
  const nodeBinDir = dirname(nodeExecPath);
  const candidates = [
    env.npm_execpath,
    resolve(nodeBinDir, "../lib/node_modules/npm/bin/npm-cli.js"),
    resolve(nodeBinDir, "../../lib/node_modules/npm/bin/npm-cli.js"),
    resolve(nodeBinDir, "../node_modules/npm/bin/npm-cli.js"),
    resolve(nodeBinDir, "../../node_modules/npm/bin/npm-cli.js"),
  ].filter((candidate) => typeof candidate === "string" && candidate.length > 0);
  return resolveRequiredBinaryPath("npm-cli.js", candidates);
}

export function classifyPortListeners(listenerPidList, trackedPidList) {
  const trackedPids = new Set(
    trackedPidList.filter((pid) => Number.isFinite(pid) && pid > 0),
  );
  const managedPids = [];
  const unmanagedPids = [];
  for (const pid of listenerPidList) {
    if (trackedPids.has(pid)) {
      managedPids.push(pid);
      continue;
    }
    unmanagedPids.push(pid);
  }
  return { managedPids, unmanagedPids };
}
