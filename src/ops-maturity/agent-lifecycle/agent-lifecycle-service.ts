import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { listActiveAgents, type AgentDefinition } from "./agent-registry/index.js";
import { shouldPromoteCanary, type CanaryProgress } from "./canary-controller/index.js";
import { canRetireAgent, type AgentRetirementPlan } from "./retirement/index.js";
import { resolveLatestAgentVersion, type AgentVersion } from "./version-manager/index.js";

export interface ManagedAgentDefinition extends AgentDefinition {
  readonly displayName: string;
  readonly capabilities: readonly string[];
  readonly owner: string;
}

export interface ManagedAgentVersion extends AgentVersion {
  readonly promptRefs: readonly string[];
  readonly toolBundleRefs: readonly string[];
  readonly policyRefs: readonly string[];
  readonly modelProfileRefs: readonly string[];
}

export interface AgentRolloutBinding {
  readonly bindingId: string;
  readonly agentId: string;
  readonly taskId: string;
  readonly versionId: string;
  readonly boundAt: string;
}

export interface AgentRolloutReceipt {
  readonly agentId: string;
  readonly fromState: ManagedAgentDefinition["lifecycleState"];
  readonly toState: ManagedAgentDefinition["lifecycleState"];
  readonly versionId: string;
  readonly changedAt: string;
  readonly reasonCodes: readonly string[];
}

export interface AgentRollbackReceipt {
  readonly agentId: string;
  readonly fromVersionId: string;
  readonly toVersionId: string;
  readonly rolledBackAt: string;
}

export class AgentLifecycleService {
  private readonly agents = new Map<string, ManagedAgentDefinition>();
  private readonly versions = new Map<string, ManagedAgentVersion[]>();

  public registerAgent(definition: ManagedAgentDefinition): ManagedAgentDefinition {
    this.agents.set(definition.agentId, definition);
    return definition;
  }

  public addVersion(version: ManagedAgentVersion): ManagedAgentVersion {
    this.requireAgent(version.agentId);
    this.versions.set(version.agentId, [...(this.versions.get(version.agentId) ?? []), version]);
    return version;
  }

  public listActive(): ManagedAgentDefinition[] {
    const activeIds = new Set(listActiveAgents([...this.agents.values()]).map((item) => item.agentId));
    return [...this.agents.values()].filter((item) => activeIds.has(item.agentId));
  }

  public promoteCanary(agentId: string, progress: CanaryProgress, changedAt = nowIso()): AgentRolloutReceipt {
    const agent = this.requireAgent(agentId);
    if (agent.lifecycleState !== "canary") {
      throw new Error(`agent_lifecycle.invalid_state:${agentId}:${agent.lifecycleState}`);
    }
    if (!shouldPromoteCanary(progress)) {
      throw new Error(`agent_lifecycle.canary_not_ready:${agentId}`);
    }
    const updated: ManagedAgentDefinition = {
      ...agent,
      lifecycleState: "active",
    };
    this.agents.set(agentId, updated);
    return {
      agentId,
      fromState: "canary",
      toState: "active",
      versionId: updated.currentVersionId,
      changedAt,
      reasonCodes: ["agent_lifecycle.canary_promoted"],
    };
  }

  public rollback(agentId: string, rolledBackAt = nowIso()): AgentRollbackReceipt {
    const agent = this.requireAgent(agentId);
    const versions = this.requireVersions(agentId);
    const currentVersionId = agent.currentVersionId;
    const sorted = [...versions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const fallback = sorted.find((item) => item.versionId !== currentVersionId && item.stable)
      ?? sorted.find((item) => item.versionId !== currentVersionId);
    if (fallback == null) {
      throw new Error(`agent_lifecycle.rollback_target_not_found:${agentId}`);
    }
    this.agents.set(agentId, {
      ...agent,
      currentVersionId: fallback.versionId,
      lifecycleState: "validated",
    });
    return {
      agentId,
      fromVersionId: currentVersionId,
      toVersionId: fallback.versionId,
      rolledBackAt,
    };
  }

  public retire(plan: AgentRetirementPlan, now = nowIso()): AgentRolloutReceipt {
    const agent = this.requireAgent(plan.agentId);
    if (!canRetireAgent(plan, now)) {
      throw new Error(`agent_lifecycle.retirement_not_ready:${plan.agentId}`);
    }
    this.agents.set(plan.agentId, {
      ...agent,
      lifecycleState: "retired",
    });
    return {
      agentId: plan.agentId,
      fromState: agent.lifecycleState,
      toState: "retired",
      versionId: agent.currentVersionId,
      changedAt: now,
      reasonCodes: ["agent_lifecycle.retired"],
    };
  }

  public bindTask(agentId: string, taskId: string, boundAt = nowIso()): AgentRolloutBinding {
    const agent = this.requireAgent(agentId);
    if (agent.lifecycleState === "retired") {
      throw new Error(`agent_lifecycle.binding_forbidden_retired:${agentId}`);
    }
    const latestVersion = resolveLatestAgentVersion(this.requireVersions(agentId));
    if (latestVersion == null) {
      throw new Error(`agent_lifecycle.version_not_found:${agentId}`);
    }
    return {
      bindingId: newId("agent_binding"),
      agentId,
      taskId,
      versionId: agent.currentVersionId || latestVersion.versionId,
      boundAt,
    };
  }

  public getAgent(agentId: string): ManagedAgentDefinition | null {
    return this.agents.get(agentId) ?? null;
  }

  public getLatestVersion(agentId: string): ManagedAgentVersion | null {
    const latestVersionId = resolveLatestAgentVersion(this.versions.get(agentId) ?? [])?.versionId ?? null;
    return (this.versions.get(agentId) ?? []).find((item) => item.versionId === latestVersionId) ?? null;
  }

  private requireAgent(agentId: string): ManagedAgentDefinition {
    const agent = this.agents.get(agentId);
    if (agent == null) {
      throw new Error(`agent_lifecycle.agent_not_found:${agentId}`);
    }
    return agent;
  }

  private requireVersions(agentId: string): ManagedAgentVersion[] {
    const versions = this.versions.get(agentId) ?? [];
    if (versions.length === 0) {
      throw new Error(`agent_lifecycle.version_not_found:${agentId}`);
    }
    return versions;
  }
}
