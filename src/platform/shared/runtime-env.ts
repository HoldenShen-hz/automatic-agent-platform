import { dirname, join } from "node:path";

export interface RuntimeConfigEnvOptions {
  env?: NodeJS.ProcessEnv | undefined;
  environment?: string | undefined;
  configRoot?: string | undefined;
  cwd?: string | undefined;
}

export interface ExecutionResourceCeilingEnvConfig {
  maxToolCalls: number | null;
  maxMemoryMb: number | null;
  maxElapsedMs: number | null;
}

export function readTrimmedEnv(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name];
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveConfigEnvironment(options: RuntimeConfigEnvOptions = {}): string {
  const explicitEnvironment = options.environment?.trim();
  if (explicitEnvironment != null && explicitEnvironment.length > 0) {
    return explicitEnvironment;
  }
  return readTrimmedEnv(options.env ?? process.env, "AA_CONFIG_ENV") ?? "prod";
}

export function resolveConfigRoot(options: RuntimeConfigEnvOptions = {}): string {
  const explicitConfigRoot = options.configRoot?.trim();
  if (explicitConfigRoot != null && explicitConfigRoot.length > 0) {
    return explicitConfigRoot;
  }
  const env = options.env ?? process.env;
  return readTrimmedEnv(env, "AA_CONFIG_ROOT") ?? join(options.cwd ?? process.cwd(), "config");
}

export function resolveConfigWorkspaceRoot(options: RuntimeConfigEnvOptions = {}): string {
  return dirname(resolveConfigRoot(options));
}

export function resolveExpectedProtectedGovernanceVersion(env: NodeJS.ProcessEnv = process.env): string | null {
  return readTrimmedEnv(env, "AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION");
}

function parsePositiveIntegerEnvValue(value: string | null): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function loadExecutionResourceCeilingEnv(
  env: NodeJS.ProcessEnv = process.env,
): ExecutionResourceCeilingEnvConfig {
  return {
    maxToolCalls: parsePositiveIntegerEnvValue(readTrimmedEnv(env, "AA_MAX_AGENT_TOOL_CALLS")),
    maxMemoryMb: parsePositiveIntegerEnvValue(readTrimmedEnv(env, "AA_MAX_AGENT_MEMORY_MB")),
    maxElapsedMs: parsePositiveIntegerEnvValue(readTrimmedEnv(env, "AA_MAX_AGENT_ELAPSED_MS")),
  };
}
