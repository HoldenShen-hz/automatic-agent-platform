import { nowIso, newId } from "../../contracts/types/ids.js";
import { DEFAULT_MAX_DEPTH } from "./topology-validator.js";
import type {
  AgentContext,
  DelegationChain,
  DelegationChainNode,
  DelegationOptions,
  DelegationResult,
  DelegationSpec,
  DelegationStatus,
  PermissionSet,
} from "./delegation-types.js";
import type { DelegationRepository } from "../../five-plane-state-evidence/truth/sqlite/repositories/delegation-repository.js";

export interface DelegationManagerOptions extends DelegationOptions {
  governanceService?: import("./delegation-governance-service.js").DelegationGovernanceService;
  auditService?: import("./delegation-audit-service.js").DelegationAuditService;
  tracker?: import("./delegation-tracker.js").DelegationTracker;
}

export interface DelegationExpirationConfig {
  checkIntervalMs?: number;
  batchSize?: number;
}

export interface ExpirationScanResult {
  scanned: number;
  expired: number;
  errors: readonly string[];
}

export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<DelegationStatus, readonly DelegationStatus[]>> = {
  pending: ["active", "completed", "failed", "cancelled", "expired", "timed_out"],
  pending_approval: ["active", "cancelled", "expired", "timed_out"],
  discovery: ["bid", "awarded", "cancelled"],
  bid: ["awarded", "cancelled"],
  awarded: ["active", "cancelled"],
  active: ["completed", "failed", "cancelled", "expired", "timed_out"],
  completed: [],
  failed: [],
  cancelled: [],
  expired: [],
  timed_out: [],
};
const HYDRATED_NO_EXPIRY_FALLBACK = "9999-12-31T23:59:59.999Z";

export function evictExpiredDelegationEntries(input: {
  readonly useRepositoryAsPrimaryStore: boolean;
  readonly nowMs: number;
  readonly lastEvictionTime: number;
  readonly evictionIntervalMs: number;
  readonly entryTtlMs: number;
  readonly maxEntries: number;
  readonly delegationStore: Map<string, DelegationResult>;
}): number {
  if (input.useRepositoryAsPrimaryStore) {
    return input.lastEvictionTime;
  }
  if (input.nowMs - input.lastEvictionTime < input.evictionIntervalMs) {
    return input.lastEvictionTime;
  }

  const expiryThreshold = input.nowMs - input.entryTtlMs;
  const entriesToDelete: string[] = [];
  for (const [key, delegation] of input.delegationStore) {
    const createdAt = new Date(delegation.createdAt).getTime();
    if (createdAt < expiryThreshold && isTerminalDelegationStatus(delegation.status)) {
      entriesToDelete.push(key);
    }
  }

  for (const key of entriesToDelete) {
    input.delegationStore.delete(key);
  }

  if (input.delegationStore.size > input.maxEntries) {
    const sortedEntries = [...input.delegationStore.entries()].sort((a, b) => {
      const aTime = new Date(a[1].createdAt).getTime();
      const bTime = new Date(b[1].createdAt).getTime();
      return aTime - bTime;
    });

    const toRemove = input.delegationStore.size - input.maxEntries;
    for (let i = 0; i < toRemove; i++) {
      const key = sortedEntries[i]![0];
      input.delegationStore.delete(key);
    }
  }
  return input.nowMs;
}

export async function hydrateDelegationStoresFromRepository(input: {
  readonly delegationRepository: DelegationRepository | null | undefined;
  readonly delegationStore: Map<string, DelegationResult>;
  readonly chainStore: Map<string, DelegationChain>;
  readonly delegationRootStore: Map<string, string>;
}): Promise<void> {
  if (!input.delegationRepository) {
    return;
  }

  const delegationRepository = input.delegationRepository;
  const activeStatuses: DelegationStatus[] = ["pending", "pending_approval", "active", "discovery", "bid", "awarded"];
  const delegationGroups = await Promise.allSettled(
    activeStatuses.map(async (status) => await delegationRepository.findByStatus(status)),
  );
  for (const result of delegationGroups) {
    if (result.status !== "fulfilled") {
      continue;
    }
    const delegations = result.value;
    for (const record of delegations) {
      const delegationResult: DelegationResult = {
        delegationId: record.delegationId,
        parentAgentId: record.parentAgentId,
        childAgentId: record.childAgentId,
        depth: record.depth,
        status: record.status,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt ?? HYDRATED_NO_EXPIRY_FALLBACK,
        permissions: { resources: [], actions: [], constraints: {} },
        grantedPermissions: { resources: [], actions: [], constraints: {} },
        correlationId: record.delegationId,
        artifact_refs: [],
        trust_level: 0,
        taint_labels: [],
        evidence_refs: [],
        policy_outcome: "delegation.hydrated_from_repository",
        data_class: "delegation",
        summary: `Hydrated delegation from repository: ${record.delegationId}`,
      };

      input.delegationStore.set(record.delegationId, delegationResult);
      const rootAgentId = record.delegationChain[0] ?? record.parentAgentId;
      input.delegationRootStore.set(record.delegationId, rootAgentId);

      let chain = input.chainStore.get(rootAgentId);
      if (!chain) {
        chain = { rootAgentId, nodes: [], maxDepthReached: 0, totalDelegations: 0 };
        input.chainStore.set(rootAgentId, chain);
      }

      const existingNode = chain.nodes.find((node) => node.delegationId === record.delegationId);
      if (!existingNode) {
        const node: DelegationChainNode = {
          delegationId: record.delegationId,
          agentId: record.childAgentId,
          packId: record.childAgentId,
          agentType: "worker",
          depth: record.depth,
          createdAt: record.createdAt,
          parentDelegationId: null,
          status: "active",
        };
        chain.nodes = [...chain.nodes, node];
        chain.maxDepthReached = Math.max(chain.maxDepthReached, record.depth);
        chain.totalDelegations++;
      }
    }
  }
}

export async function createDelegationResultRecord(input: {
  readonly parent: AgentContext;
  readonly parentRootAgentId: string;
  readonly childContext: AgentContext;
  readonly spec: DelegationSpec;
  readonly permissions: PermissionSet;
  readonly defaultTimeout: number;
  readonly delegationRepository: DelegationRepository | null | undefined;
  readonly delegationStore: Map<string, DelegationResult>;
}): Promise<DelegationResult> {
  const delegationId = newId("dlg");
  const now = nowIso();
  const maxDelegationTimeoutMs = 30 * 24 * 60 * 60 * 1000;
  const requestedTimeout = input.spec.timeout > 0 ? input.spec.timeout : input.defaultTimeout;
  const timeout = Math.min(requestedTimeout, maxDelegationTimeoutMs);
  const expiresAt = new Date(Date.now() + timeout).toISOString();
  const delegation: DelegationResult = {
    delegationId,
    parentAgentId: input.parent.agentId,
    childAgentId: input.childContext.agentId,
    depth: input.parent.delegationDepth + 1,
    permissions: input.permissions,
    grantedPermissions: input.permissions,
    createdAt: now,
    expiresAt,
    correlationId: input.childContext.correlationId,
    ...(input.spec.requiresApproval ? { requiresApproval: true } : {}),
    status: input.spec.requiresApproval ? "pending_approval" : "pending",
    summary: `Delegated ${input.childContext.agentType} work from ${input.parent.agentId} to ${input.childContext.agentId}`,
    artifact_refs: [],
    trust_level: Math.max(
      0,
      Math.round((1 - Math.min(input.parent.delegationDepth + 1, DEFAULT_MAX_DEPTH) / (DEFAULT_MAX_DEPTH + 1)) * 100) / 100,
    ),
    taint_labels: input.permissions.constraints.allowedDomains ?? [],
    evidence_refs: [],
    policy_outcome: "delegation.permissions_narrowed",
    data_class: input.spec.dataClass ?? "delegation",
  };

  let delegationChain: readonly string[] = [input.parentRootAgentId, delegation.parentAgentId, delegation.childAgentId];
  if (input.delegationRepository && input.parent.activeDelegations.length > 0) {
    const parentDelegationId = input.parent.activeDelegations.at(-1);
    if (parentDelegationId) {
      const parentDelegation = await input.delegationRepository.findById(parentDelegationId);
      if (parentDelegation && parentDelegation.delegationChain.length > 0) {
        delegationChain = [...parentDelegation.delegationChain, delegation.childAgentId];
      }
    }
  }
  delegationChain = delegationChain.filter((agentId, index, chain) => agentId.length > 0 && (index === 0 || agentId !== chain[index - 1]));

  if (input.delegationRepository) {
    await input.delegationRepository.create({
      delegationId: delegation.delegationId,
      parentAgentId: delegation.parentAgentId,
      childAgentId: delegation.childAgentId,
      delegationChain,
      depth: delegation.depth,
      expiresAt: delegation.expiresAt,
      status: delegation.status,
    });
  }

  input.delegationStore.set(delegationId, delegation);
  return delegation;
}

function isTerminalDelegationStatus(status: DelegationStatus): boolean {
  return status === "completed" || status === "failed" || status === "expired" || status === "cancelled";
}
