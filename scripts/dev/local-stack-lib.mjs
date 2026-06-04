import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

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

const LOCAL_STACK_PROVIDER_CONFIG_RELATIVE_PATH = Object.freeze(["config", "providers", "local-dev.json"]);
const LOCAL_STACK_PROVIDER_ENV_KEYS = Object.freeze([
  "MINIMAX_API_KEY",
  "AA_MINIMAX_API_KEY",
  "MINIMAX_API_BASE",
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

function normalizeOptionalEnvValue(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveLocalStackProviderConfigPath(repoRoot, sourceEnv) {
  const configuredPath = normalizeOptionalEnvValue(sourceEnv.AA_LOCAL_PROVIDER_CONFIG_PATH);
  if (configuredPath == null) {
    return join(repoRoot, ...LOCAL_STACK_PROVIDER_CONFIG_RELATIVE_PATH);
  }
  return isAbsolute(configuredPath) ? configuredPath : resolve(repoRoot, configuredPath);
}

function readLocalStackProviderConfigEnv(configPath) {
  if (!existsSync(configPath)) {
    return {};
  }
  const parsed = JSON.parse(readFileSync(configPath, "utf8"));
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Local provider config must be a JSON object: ${configPath}`);
  }

  const minimax = parsed.minimax;
  if (minimax == null) {
    return {};
  }
  if (typeof minimax !== "object" || Array.isArray(minimax)) {
    throw new Error(`Local provider config minimax block must be a JSON object: ${configPath}`);
  }

  const env = {};
  const apiKey = normalizeOptionalEnvValue(minimax.apiKey);
  const baseUrl = normalizeOptionalEnvValue(minimax.baseUrl);
  if (apiKey != null) {
    env.MINIMAX_API_KEY = apiKey;
  }
  if (baseUrl != null) {
    env.MINIMAX_API_BASE = baseUrl;
  }
  return env;
}

export function loadLocalStackProviderEnv(repoRoot, sourceEnv = process.env) {
  const configPath = resolveLocalStackProviderConfigPath(repoRoot, sourceEnv);
  const fileEnv = readLocalStackProviderConfigEnv(configPath);
  const env = {
    ...fileEnv,
  };
  for (const key of LOCAL_STACK_PROVIDER_ENV_KEYS) {
    const value = normalizeOptionalEnvValue(sourceEnv[key]);
    if (value != null) {
      env[key] = value;
    }
  }
  return {
    env,
    sourcePath: existsSync(configPath) ? configPath : null,
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
