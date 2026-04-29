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
   */
  public observe(params: {
    taskId: string;
    taskGoal: string;
    taskInputs: Record<string, unknown>;
    environmentState?: Record<string, unknown>;
    relevantHistory?: readonly string[];
    knowledgeRefs?: readonly string[];
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
  }): ContextSnapshot {
    return {
      snapshotId: newId("ctx_snap"),
      taskGoal: params.taskGoal,
      taskInputs: params.taskInputs,
      environmentState: params.environmentState ?? {},
      relevantHistory: params.relevantHistory ?? [],
      knowledgeRefs: params.knowledgeRefs ?? [],
      capturedAt: Date.now(),
    };
  }

  public getVersion(): string {
    return this.version;
  }
}
