import { realpathSync } from "node:fs";
import { resolve } from "node:path";

export type SandboxMode =
  | "workspace_write"
  | "read_only"
  | "restricted_exec"
  | "scoped_external_access"
  | "config_read";

export type SymlinkPolicy = "deny" | "allow" | "allow_explicit";
export type ProcessRuleMode = "allow" | "deny";

export interface SandboxPolicy {
  policyId: string;
  mode: SandboxMode;
  allowedRoots: readonly string[];
  deniedRoots: readonly string[];
  realpathEnforced: boolean;
  symlinkPolicy: SymlinkPolicy;
  processRuleMode: ProcessRuleMode;
  timeLimitMs: number;
  memoryLimitBytes: number;
  cpuLimitFraction: number;
}

export interface SandboxPathCheckResult {
  readonly allowed: boolean;
  readonly normalizedPath: string;
  readonly reasonCode: string | null;
}

const DEFAULT_SANDBOX_DENIED_ROOTS = ["/dev", "/proc", "/sys", "/etc/ssh", "/root"] as const;

function normalizeRoot(root: string, realpath: boolean): string {
  const resolved = resolve(root);
  if (!realpath) {
    return resolved;
  }
  try {
    return realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function isWithinRoot(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}

export function checkSandboxPath(policy: SandboxPolicy, inputPath: string): SandboxPathCheckResult {
  const normalizedInput = resolve(inputPath);
  const rawAllowedRoots = policy.allowedRoots.map((root) => normalizeRoot(root, false));
  const rawDeniedRoots = policy.deniedRoots.map((root) => normalizeRoot(root, false));
  if (rawDeniedRoots.some((root) => isWithinRoot(normalizedInput, root))) {
    return {
      allowed: false,
      normalizedPath: normalizedInput,
      reasonCode: "sandbox.path_in_denied_root",
    };
  }

  let normalizedPath = normalizedInput;
  if (policy.realpathEnforced) {
    try {
      normalizedPath = realpathSync.native(normalizedInput);
    } catch {
      normalizedPath = normalizedInput;
    }
  }

  const effectiveAllowedRoots = policy.realpathEnforced
    ? policy.allowedRoots.map((root) => normalizeRoot(root, true))
    : rawAllowedRoots;
  const effectiveDeniedRoots = policy.realpathEnforced
    ? policy.deniedRoots.map((root) => normalizeRoot(root, true))
    : rawDeniedRoots;

  if (effectiveDeniedRoots.some((root) => isWithinRoot(normalizedPath, root))) {
    return {
      allowed: false,
      normalizedPath,
      reasonCode: "sandbox.path_in_denied_root",
    };
  }
  if (!effectiveAllowedRoots.some((root) => isWithinRoot(normalizedPath, root))) {
    return {
      allowed: false,
      normalizedPath,
      reasonCode: "sandbox.path_outside_allowed_roots",
    };
  }
  return {
    allowed: true,
    normalizedPath,
    reasonCode: null,
  };
}

export function createWorkspaceWritePolicy(workspaceRoot: string): SandboxPolicy {
  return {
    policyId: "workspace_write",
    mode: "workspace_write",
    allowedRoots: [workspaceRoot],
    deniedRoots: [...DEFAULT_SANDBOX_DENIED_ROOTS],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,
    memoryLimitBytes: 512 * 1024 * 1024,
    cpuLimitFraction: 0.5,
  };
}
