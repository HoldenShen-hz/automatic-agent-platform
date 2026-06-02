/**
 * Observer Service — OAPEFLIR Observe Stage
 *
 * §13.2: Observe is the first OAPEFLIR stage, producing ObservationBundle
 * (signal collection / context assembly).
 *
 * This service observes inputs, events, context, and goals to produce
 * an ObservationBundle consumed by the Assess stage.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { newId } from "../../contracts/types/ids.js";
import { stableStringify } from "../../shared/cache/utils/stable-stringify.js";

export interface ObservationSignal {
  readonly signalId: string;
  readonly source: "task" | "context" | "environment" | "history" | "knowledge";
  readonly type: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: number;
}

export interface ContextSnapshot {
  readonly snapshotId: string;
  readonly taskGoal: string;
  readonly taskInputs: Record<string, unknown>;
  readonly environmentState: Record<string, unknown>;
  readonly relevantHistory: readonly string[];
  readonly knowledgeRefs: readonly string[];
  readonly capturedAt: number;
  // R11-02 FIX: Optional workflow hierarchy context for nested subgraph tracking
  readonly workflowContext?: {
    readonly parentNodeRunId?: string;
    readonly subgraphNodeIds?: readonly string[];
  };
}

export interface ObservationBundle {
  readonly bundleId: string;
  readonly taskId: string;
  readonly signals: readonly ObservationSignal[];
  readonly contextSnapshot: ContextSnapshot;
  readonly assembledAt: number;
  readonly version: string;
  readonly integrity: ObservationBundleIntegrity;
}

export interface ObservationBundleIntegrity {
  readonly algorithm: "HMAC-SHA256";
  readonly payloadChecksum: string;
  readonly signature: string;
}

export interface ObservationBundleVerificationResult {
  readonly valid: boolean;
  readonly reasonCode: "integrity.valid" | "integrity.checksum_mismatch" | "integrity.signature_mismatch";
}

export interface ObserverServiceOptions {
  readonly version?: string;
  readonly hmacKey?: string;
  readonly now?: () => number;
}

export class ObserverService {
  private readonly version: string;
  private readonly hmacKey: string;
  private readonly now: () => number;

  public constructor(options: ObserverServiceOptions = {}) {
    this.version = options.version ?? "v1";
    this.hmacKey = options.hmacKey?.trim() || randomBytes(32).toString("hex");
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Observe and collect signals from task input, context, environment,
   * history, and knowledge sources to produce an ObservationBundle.
   *
   * §13.2: Observe stage responsibility - signal collection and context assembly
   *
   * @param params.taskId - The task ID to observe
   * @param params.taskGoal - The task goal/objective
   * @param params.taskInputs - Input parameters for the task
   * @param params.environmentState - Current environment state
   * @param params.relevantHistory - Prior execution history references
   * @param params.knowledgeRefs - Knowledge base references
   * @param params.parentNodeRunId - Optional: parent node/run context for workflow-aware observation.
   *                                  When provided, enables subgraph execution tracking and
   *                                  proper hierarchical correlation in nested workflow scenarios.
   * @param params.subgraphNodeIds - Optional: IDs of subgraph nodes within this observation scope.
   *                                  Used to establish parent-child relationships in nested workflows.
   */
  public observe(params: {
    taskId: string;
    taskGoal: string;
    taskInputs: Record<string, unknown>;
    environmentState?: Record<string, unknown>;
    relevantHistory?: readonly string[];
    knowledgeRefs?: readonly string[];
    parentNodeRunId?: string;
    subgraphNodeIds?: readonly string[];
  }): ObservationBundle {
    const issuedTimestamps = createTimestampSequence(this.now());
    const signals = this.collectSignals(params, issuedTimestamps);
    const contextSnapshot = this.assembleContextSnapshot(params, issuedTimestamps);
    const assembledAt = issuedTimestamps();
    const bundleId = newId("obs_bundle");
    const integrity = this.buildIntegrity({
      bundleId,
      taskId: params.taskId,
      signals,
      contextSnapshot,
      assembledAt,
      version: this.version,
    });

    return freezeBundle({
      bundleId,
      taskId: params.taskId,
      signals,
      contextSnapshot,
      assembledAt,
      version: this.version,
      integrity,
    });
  }

  private collectSignals(params: {
    taskId: string;
    taskGoal: string;
    taskInputs: Record<string, unknown>;
    environmentState?: Record<string, unknown>;
    relevantHistory?: readonly string[];
    knowledgeRefs?: readonly string[];
    parentNodeRunId?: string;
    subgraphNodeIds?: readonly string[];
  }, nextTimestamp: () => number): readonly ObservationSignal[] {
    const signals: ObservationSignal[] = [];

    // Task-level signals
    signals.push({
      signalId: newId("obs_sig"),
      source: "task",
      type: "goal_definition",
      data: freezeRecord({
        goal: params.taskGoal,
        inputs: cloneRecord(params.taskInputs),
      }),
      timestamp: nextTimestamp(),
    });

    // R11-02 FIX: Workflow-aware observation - include parent/child relationships
    // to enable hierarchical tracking in nested subgraph execution scenarios
    if (params.parentNodeRunId) {
      signals.push({
        signalId: newId("obs_sig"),
        source: "context",
        type: "parent_workflow_context",
        data: freezeRecord({ parentNodeRunId: params.parentNodeRunId }),
        timestamp: nextTimestamp(),
      });
    }

    if (params.subgraphNodeIds?.length) {
      signals.push({
        signalId: newId("obs_sig"),
        source: "context",
        type: "subgraph_nodes",
        data: freezeRecord({ subgraphNodeIds: [...params.subgraphNodeIds] }),
        timestamp: nextTimestamp(),
      });
    }

    // Context signals
    if (params.environmentState) {
      signals.push({
        signalId: newId("obs_sig"),
        source: "environment",
        type: "environment_state",
        data: cloneRecord(params.environmentState),
        timestamp: nextTimestamp(),
      });
    }

    // History signals
    if (params.relevantHistory?.length) {
      signals.push({
        signalId: newId("obs_sig"),
        source: "history",
        type: "relevant_execution_history",
        data: freezeRecord({ historyRefs: [...params.relevantHistory] }),
        timestamp: nextTimestamp(),
      });
    }

    // Knowledge signals
    if (params.knowledgeRefs?.length) {
      signals.push({
        signalId: newId("obs_sig"),
        source: "knowledge",
        type: "relevant_knowledge",
        data: freezeRecord({ knowledgeRefs: [...params.knowledgeRefs] }),
        timestamp: nextTimestamp(),
      });
    }

    return Object.freeze(signals.map((signal) => Object.freeze(signal)));
  }

  private assembleContextSnapshot(params: {
    taskGoal: string;
    taskInputs: Record<string, unknown>;
    environmentState?: Record<string, unknown>;
    relevantHistory?: readonly string[];
    knowledgeRefs?: readonly string[];
    parentNodeRunId?: string;
    subgraphNodeIds?: readonly string[];
  }, nextTimestamp: () => number): ContextSnapshot {
    // R11-02 FIX: Include workflow hierarchy info in context snapshot
    const workflowContext: Record<string, unknown> = {};
    if (params.parentNodeRunId) {
      workflowContext.parentNodeRunId = params.parentNodeRunId;
    }
    if (params.subgraphNodeIds?.length) {
      workflowContext.subgraphNodeIds = params.subgraphNodeIds;
    }

    return Object.freeze({
      snapshotId: newId("ctx_snap"),
      taskGoal: params.taskGoal,
      taskInputs: cloneRecord(params.taskInputs),
      environmentState: cloneRecord(params.environmentState ?? {}),
      relevantHistory: Object.freeze([...(params.relevantHistory ?? [])]),
      knowledgeRefs: Object.freeze([...(params.knowledgeRefs ?? [])]),
      capturedAt: nextTimestamp(),
      // R11-02 FIX: Include workflow hierarchy in snapshot data
      ...(Object.keys(workflowContext).length > 0 && { workflowContext: freezeRecord(workflowContext) }),
    });
  }

  public verifyBundle(bundle: ObservationBundle): ObservationBundleVerificationResult {
    const canonicalPayload = stableStringify(buildIntegrityPayload(bundle));
    const expectedChecksum = createHash("sha256").update(canonicalPayload, "utf8").digest("hex");
    if (bundle.integrity.payloadChecksum !== expectedChecksum) {
      return { valid: false, reasonCode: "integrity.checksum_mismatch" };
    }
    const expectedSignature = createHmac("sha256", this.hmacKey).update(canonicalPayload, "utf8").digest("hex");
    if (!safeHexEqual(bundle.integrity.signature, expectedSignature)) {
      return { valid: false, reasonCode: "integrity.signature_mismatch" };
    }
    return { valid: true, reasonCode: "integrity.valid" };
  }

  public getVersion(): string {
    return this.version;
  }

  private buildIntegrity(bundle: Omit<ObservationBundle, "integrity">): ObservationBundleIntegrity {
    const canonicalPayload = stableStringify(buildIntegrityPayload(bundle));
    return Object.freeze({
      algorithm: "HMAC-SHA256",
      payloadChecksum: createHash("sha256").update(canonicalPayload, "utf8").digest("hex"),
      signature: createHmac("sha256", this.hmacKey).update(canonicalPayload, "utf8").digest("hex"),
    });
  }
}

function buildIntegrityPayload(bundle: Omit<ObservationBundle, "integrity">): Record<string, unknown> {
  return {
    bundleId: bundle.bundleId,
    taskId: bundle.taskId,
    signals: bundle.signals,
    contextSnapshot: bundle.contextSnapshot,
    assembledAt: bundle.assembledAt,
    version: bundle.version,
  };
}

function createTimestampSequence(baseTimestamp: number): () => number {
  let offset = 0;
  return () => baseTimestamp + offset++;
}

function cloneRecord(record: Record<string, unknown>): Record<string, unknown> {
  return freezeRecord(structuredClone(record));
}

function freezeRecord<T extends Record<string, unknown>>(record: T): T {
  for (const value of Object.values(record)) {
    deepFreezeValue(value);
  }
  return Object.freeze(record);
}

function deepFreezeValue(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreezeValue(item);
    }
    Object.freeze(value);
    return;
  }
  if (value != null && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreezeValue(nested);
    }
    Object.freeze(value);
  }
}

function freezeBundle(bundle: ObservationBundle): ObservationBundle {
  return Object.freeze(bundle);
}

function safeHexEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
