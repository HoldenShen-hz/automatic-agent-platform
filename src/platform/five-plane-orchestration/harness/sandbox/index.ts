/**
 * Harness Sandbox Layer - per-tool sandbox binding per §45.4 step 5.
 *
 * Provides sandbox isolation for individual tool executions within the harness.
 * Each tool can be bound to its own sandbox layer for security isolation.
 */

export type SandboxLayer = "none" | "ephemeral" | "persistent" | "network_isolated";

export interface ToolSandboxBinding {
  readonly toolName: string;
  readonly layer: SandboxLayer;
  readonly isolationId: string;
  readonly timeoutMs: number;
  readonly allowedHosts?: readonly string[];
}

export interface HarnessSandboxLayer {
  readonly bindings: readonly ToolSandboxBinding[];
  readonly defaultLayer: SandboxLayer;
  readonly createdAt: string;
}

/**
 * Creates sandbox layer bindings for tools in the harness.
 * Per §45.4 step 5, each tool may have its own sandbox-layer binding.
 */
/**
 * Creates sandbox layer bindings for tools in the harness.
 * Per §45.4 step 5, each tool may have its own sandbox-layer binding.
 *
 * R12-1 fix: Default to "ephemeral" instead of "none" since "none" is rejected
 * by normalizeSandboxMode() in sandbox-policy.ts as a security violation.
 */
export function createSandboxLayer(
  requestedTools: readonly string[],
  constraintPack: {
    readonly sandboxRequirement?: {
      readonly sandboxMode?: SandboxLayer;
      readonly timeoutMs?: number;
      readonly allowedHosts?: readonly string[];
    };
  },
): HarnessSandboxLayer {
  // R12-1 fix: "none" is not a valid sandbox tier - must be explicitly rejected
  // per §171/R21-15. Use "ephemeral" as the minimal-isolation default.
  const defaultLayer = constraintPack.sandboxRequirement?.sandboxMode ?? "ephemeral";
  const timeoutMs = constraintPack.sandboxRequirement?.timeoutMs ?? 30000;
  const allowedHosts = constraintPack.sandboxRequirement?.allowedHosts;

  const bindings: ToolSandboxBinding[] = requestedTools.map((toolName) => ({
    toolName,
    layer: defaultLayer,
    isolationId: `sandbox_${toolName}_${Date.now()}`,
    timeoutMs,
    ...(allowedHosts ? { allowedHosts } : {}),
  }));

  return {
    bindings,
    defaultLayer,
    createdAt: new Date().toISOString(),
  };
}