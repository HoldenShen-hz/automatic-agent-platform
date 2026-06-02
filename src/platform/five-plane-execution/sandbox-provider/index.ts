import { newId, nowIso } from "../../contracts/types/ids.js";

export type SandboxLayer = "ephemeral" | "persistent" | "network_isolated";

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

export type SandboxProviderKind = "local" | "container" | "browser" | "microvm" | "remote";

export interface SandboxProviderRequirement {
  sandboxMode: SandboxLayer;
  timeoutMs?: number;
  allowedHosts?: readonly string[];
  providerHint?: SandboxProviderKind;
}

export interface SandboxProviderSession {
  providerSessionId: string;
  providerKind: SandboxProviderKind;
  sandboxLayer: HarnessSandboxLayer;
  toolNames: readonly string[];
  createdAt: string;
}

export interface SandboxProvider {
  readonly providerKind: SandboxProviderKind;
  createSession(toolNames: readonly string[], requirement: SandboxProviderRequirement): SandboxProviderSession;
}

export class DefaultSandboxProvider implements SandboxProvider {
  public readonly providerKind: SandboxProviderKind;

  public constructor(providerKind: SandboxProviderKind = "local") {
    this.providerKind = providerKind;
  }

  public createSession(
    toolNames: readonly string[],
    requirement: SandboxProviderRequirement,
  ): SandboxProviderSession {
    const sandboxLayer = createExecutionSandboxLayer(toolNames, requirement);
    return {
      providerSessionId: newId("sandbox_session"),
      providerKind: requirement.providerHint ?? this.providerKind,
      sandboxLayer,
      toolNames: [...toolNames],
      createdAt: nowIso(),
    };
  }
}

export function resolveSandboxProviderKind(
  requirement: SandboxProviderRequirement,
): SandboxProviderKind {
  if (requirement.providerHint != null) {
    return requirement.providerHint;
  }
  switch (requirement.sandboxMode) {
    case "network_isolated":
      return "microvm";
    case "persistent":
      return "container";
    case "ephemeral":
    default:
      return "local";
  }
}

export function createDefaultSandboxProvider(
  requirement?: SandboxProviderRequirement,
): SandboxProvider {
  return new DefaultSandboxProvider(requirement == null ? "local" : resolveSandboxProviderKind(requirement));
}

function createExecutionSandboxLayer(
  requestedTools: readonly string[],
  requirement: SandboxProviderRequirement,
): HarnessSandboxLayer {
  const defaultLayer = requirement.sandboxMode;
  const timeoutMs = requirement.timeoutMs ?? 30_000;
  const bindings: ToolSandboxBinding[] = requestedTools.map((toolName) => ({
    toolName,
    layer: defaultLayer,
    isolationId: newId("sandbox_binding"),
    timeoutMs,
    ...(requirement.allowedHosts != null ? { allowedHosts: requirement.allowedHosts } : {}),
  }));
  return {
    bindings,
    defaultLayer,
    createdAt: nowIso(),
  };
}
