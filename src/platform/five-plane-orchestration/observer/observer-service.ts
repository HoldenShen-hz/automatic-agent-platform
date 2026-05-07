/**
 * Observer Service — OAPEFLIR Observe Stage
 *
 * §13.2: Observe is the first OAPEFLIR stage, producing ObservationBundle
 * (signal collection / context assembly).
 *
 * This service observes inputs, events, context, and goals to produce
 * an ObservationBundle consumed by the Assess stage.
 */

import { newId } from "../../contracts/types/ids.js";

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
}

export interface ObserverServiceOptions {
  readonly version?: string;
}

export class ObserverService {
  private readonly version: string;

  public constructor(options: ObserverServiceOptions = {}) {
    this.version = options.version ?? "v1";
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
    const signals = this.collectSignals(params);
    const contextSnapshot = this.assembleContextSnapshot(params);

    return {
      bundleId: newId("obs_bundle"),
      taskId: params.taskId,
      signals,
      contextSnapshot,
      assembledAt: Date.now(),
      version: this.version,
    };
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
  }): readonly ObservationSignal[] {
    const signals: ObservationSignal[] = [];

    // Task-level signals
    signals.push({
      signalId: newId("obs_sig"),
      source: "task",
      type: "goal_definition",
      data: { goal: params.taskGoal, inputs: params.taskInputs },
      timestamp: Date.now(),
    });

    // R11-02 FIX: Workflow-aware observation - include parent/child relationships
    // to enable hierarchical tracking in nested subgraph execution scenarios
    if (params.parentNodeRunId) {
      signals.push({
        signalId: newId("obs_sig"),
        source: "context",
        type: "parent_workflow_context",
        data: { parentNodeRunId: params.parentNodeRunId },
        timestamp: Date.now(),
      });
    }

    if (params.subgraphNodeIds?.length) {
      signals.push({
        signalId: newId("obs_sig"),
        source: "context",
        type: "subgraph_nodes",
        data: { subgraphNodeIds: params.subgraphNodeIds },
        timestamp: Date.now(),
      });
    }

    // Context signals
    if (params.environmentState) {
      signals.push({
        signalId: newId("obs_sig"),
        source: "environment",
        type: "environment_state",
        data: params.environmentState,
        timestamp: Date.now(),
      });
    }

    // History signals
    if (params.relevantHistory?.length) {
      signals.push({
        signalId: newId("obs_sig"),
        source: "history",
        type: "relevant_execution_history",
        data: { historyRefs: params.relevantHistory },
        timestamp: Date.now(),
      });
    }

    // Knowledge signals
    if (params.knowledgeRefs?.length) {
      signals.push({
        signalId: newId("obs_sig"),
        source: "knowledge",
        type: "relevant_knowledge",
        data: { knowledgeRefs: params.knowledgeRefs },
        timestamp: Date.now(),
      });
    }

    return signals;
  }

  private assembleContextSnapshot(params: {
    taskGoal: string;
    taskInputs: Record<string, unknown>;
    environmentState?: Record<string, unknown>;
    relevantHistory?: readonly string[];
    knowledgeRefs?: readonly string[];
    parentNodeRunId?: string;
    subgraphNodeIds?: readonly string[];
  }): ContextSnapshot {
    // R11-02 FIX: Include workflow hierarchy info in context snapshot
    const workflowContext: Record<string, unknown> = {};
    if (params.parentNodeRunId) {
      workflowContext.parentNodeRunId = params.parentNodeRunId;
    }
    if (params.subgraphNodeIds?.length) {
      workflowContext.subgraphNodeIds = params.subgraphNodeIds;
    }

    return {
      snapshotId: newId("ctx_snap"),
      taskGoal: params.taskGoal,
      taskInputs: params.taskInputs,
      environmentState: params.environmentState ?? {},
      relevantHistory: params.relevantHistory ?? [],
      knowledgeRefs: params.knowledgeRefs ?? [],
      capturedAt: Date.now(),
      // R11-02 FIX: Include workflow hierarchy in snapshot data
      ...(Object.keys(workflowContext).length > 0 && { workflowContext }),
    };
  }

  public getVersion(): string {
    return this.version;
  }
}
