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
  const defaultLayer = constraintPack.sandboxRequirement?.sandboxMode ?? "none";
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