import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import {
  listActiveAgents,
  isValidLifecycleTransition,
  normalizeAgentLifecycleState,
  type AgentDefinition,
  type AgentLifecycleState,
} from "./agent-registry/index.js";
import {
  shouldPromoteCanary,
  getNextCanaryStage,
  calculateTrafficSplit,
  type CanaryProgress,
  type CanaryStage,
  type TrafficSplitConfig,
} from "./canary-controller/index.js";
import {
  canRetireAgent,
  type AgentRetirementPlan,
} from "./retirement/index.js";
import {
  resolveLatestAgentVersion,
  compareSemver,
  type AgentVersion,
} from "./version-manager/index.js";

export interface ManagedAgentDefinition extends AgentDefinition {}

export interface ManagedAgentVersion extends AgentVersion {}

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

export interface LifecycleTransitionResult {
  readonly allowed: boolean;
  readonly fromState: AgentLifecycleState;
  readonly toState: AgentLifecycleState;
  readonly reason?: string;
}

export class AgentLifecycleService {
  private readonly agents = new Map<string, ManagedAgentDefinition>();
  private readonly versions = new Map<string, ManagedAgentVersion[]>();
  private readonly canaryProgress = new Map<string, CanaryProgress>();

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
    const agents = [...this.agents.values()];
    const activeIds = new Set(listActiveAgents(agents).map((item) => item.agentId));
    return agents.filter((item) => activeIds.has(item.agentId));
  }

  /**
   * Transitions agent to a new lifecycle state.
   * Validates transition per §61.3 state machine.
   */
  public transition(
    agentId: string,
    toState: AgentLifecycleState,
    changedAt = nowIso(),
  ): LifecycleTransitionResult {
    const agent = this.requireAgent(agentId);
    const fromState = agent.lifecycleState;

    if (!isValidLifecycleTransition(fromState, toState)) {
      return {
        allowed: false,
        fromState,
        toState,
        reason: `Invalid transition from ${fromState} to ${toState}`,
      };
    }

    const updated: ManagedAgentDefinition = {
      ...agent,
      lifecycleState: normalizeAgentLifecycleState(toState),
      updatedAt: changedAt,
    };
    this.agents.set(agentId, updated);

    return { allowed: true, fromState, toState };
  }

  /**
   * Advances canary to next stage or promotes to active.
   * Per §61.4 traffic splitting.
   */
  public advanceCanary(
    agentId: string,
    progress: CanaryProgress,
    changedAt = nowIso(),
  ): AgentRolloutReceipt {
    const agent = this.requireAgent(agentId);
    if (agent.lifecycleState !== "canary") {
      throw new Error(`agent_lifecycle.invalid_state:${agentId}:${agent.lifecycleState}`);
    }

    // Check if should promote to active
    if (shouldPromoteCanary(progress)) {
      const updated: ManagedAgentDefinition = {
        ...agent,
        lifecycleState: "active",
        updatedAt: changedAt,
      };
      this.agents.set(agentId, updated);
      this.canaryProgress.delete(agentId);
      return {
        agentId,
        fromState: "canary",
        toState: "active",
        versionId: agent.currentVersionId,
        changedAt,
        reasonCodes: ["agent_lifecycle.canary_promoted"],
      };
    }

    // Advance to next canary stage
    const nextStage = getNextCanaryStage(progress.rolloutPercent);
    if (nextStage !== null) {
      // Store progress for traffic splitting
      this.canaryProgress.set(agentId, progress);
    }

    return {
      agentId,
      fromState: "canary",
      toState: "canary",
      versionId: agent.currentVersionId,
      changedAt,
      reasonCodes: ["agent_lifecycle.canary_stage_advanced"],
    };
  }

  /**
   * Gets current traffic split for canary agent.
   */
  public getCanaryTrafficSplit(agentId: string): TrafficSplitConfig | null {
    const progress = this.canaryProgress.get(agentId);
    if (!progress) return null;
    return calculateTrafficSplit(progress.currentStage);
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
      updatedAt: changedAt,
    };
    this.agents.set(agentId, updated);
    this.canaryProgress.delete(agentId);
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
    const sorted = [...versions].sort((left, right) => compareSemver(right.semver, left.semver));
    const fallback = sorted.find((item) => item.versionId !== currentVersionId);
    if (fallback == null) {
      throw new Error(`agent_lifecycle.rollback_target_not_found:${agentId}`);
    }
    this.agents.set(agentId, {
      ...agent,
      currentVersionId: fallback.versionId,
      lifecycleState: "staging",
      updatedAt: rolledBackAt,
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
      lifecycleState: "deprecated",
      updatedAt: now,
    });
    return {
      agentId: plan.agentId,
      fromState: agent.lifecycleState,
      toState: "deprecated",
      versionId: agent.currentVersionId,
      changedAt: now,
      reasonCodes: ["agent_lifecycle.deprecated"],
    };
  }

  public archive(agentId: string, archivedAt = nowIso()): AgentRolloutReceipt {
    const agent = this.requireAgent(agentId);
    if (agent.lifecycleState !== "deprecated") {
      throw new Error(`agent_lifecycle.can_only_archive_from_deprecated:${agentId}`);
    }
    this.agents.set(agentId, {
      ...agent,
      lifecycleState: "archived",
      updatedAt: archivedAt,
    });
    return {
      agentId,
      fromState: "deprecated",
      toState: "archived",
      versionId: agent.currentVersionId,
      changedAt: archivedAt,
      reasonCodes: ["agent_lifecycle.archived"],
    };
  }

  public bindTask(agentId: string, taskId: string, boundAt = nowIso()): AgentRolloutBinding {
    const agent = this.requireAgent(agentId);
    if (agent.lifecycleState === "deprecated") {
      throw new Error(`agent_lifecycle.binding_forbidden_retired:${agentId}`);
    }
    if (agent.lifecycleState === "archived") {
      throw new Error(`agent_lifecycle.binding_forbidden_archived:${agentId}`);
    }
    const latestVersion = resolveLatestAgentVersion(this.requireVersions(agentId));
    if (latestVersion == null) {
      throw new Error(`agent_lifecycle.version_not_found:${agentId}`);
    }
    return {
      bindingId: newId("agent_binding:"),
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

  public getAllVersions(agentId: string): ManagedAgentVersion[] {
    return this.versions.get(agentId) ?? [];
  }

  public getCanaryProgress(agentId: string): CanaryProgress | null {
    return this.canaryProgress.get(agentId) ?? null;
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
