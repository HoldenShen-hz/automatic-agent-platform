import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  createSandboxLayer,
  type HarnessSandboxLayer,
  type SandboxLayer,
} from "../../five-plane-orchestration/harness/sandbox/index.js";

export type SandboxProviderKind = "local" | "container" | "browser" | "microvm" | "remote";

export interface SandboxProviderRequirement {
  sandboxMode: Exclude<SandboxLayer, "none">;
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
    const sandboxLayer = createSandboxLayer(toolNames, {
      sandboxRequirement: {
        sandboxMode: requirement.sandboxMode,
        ...(requirement.timeoutMs != null ? { timeoutMs: requirement.timeoutMs } : {}),
        ...(requirement.allowedHosts != null ? { allowedHosts: requirement.allowedHosts } : {}),
      },
    });
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
