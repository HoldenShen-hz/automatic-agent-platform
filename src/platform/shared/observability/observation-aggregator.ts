import { z } from "zod";
import type { TaskSituation } from "../../five-plane-orchestration/oapeflir/types/task-situation.js";
import type { SystemSituation } from "./system-situation-model.js";
import { SystemSituationSchema } from "./system-situation-model.js";
import { StructuredLogger } from "./structured-logger.js";
import type { Tier1EventType } from "../../five-plane-state-evidence/events/event-types.js";

// R5-11: Extended observation scope — Observer now also captures EventFlow, GoalDecomposition, and Memory situations

/**
 * EventFlowSituation — snapshot of recent event bus activity.
 *
 * Captures the event stream state to provide context about what events
 * have been emitted, pending, or failed in the recent execution flow.
 *
 * Architecture note: Event flow is derived from the durable-event-bus and
 * layered-event-inbox components in src/platform/five-plane-state-evidence/events/.
 */
export interface EventFlowSituation {
  /** Count of Tier-1 events emitted in the current observation window */
  tier1EventCount: number;
  /** Count of Tier-1 events pending acknowledgment */
  tier1PendingAcks: number;
  /** Count of events in the dead-letter queue */
  dlqSize: number;
  /** Recent Tier-1 event types emitted (last 10) */
  recentEventTypes: readonly Tier1EventType[];
  /** Whether the event bus is experiencing backlog degradation */
  backlogDegraded: boolean;
  /** Timestamp of the most recent event */
  lastEventAt: number | null;
}

/** Zod schema for EventFlowSituation */
export const EventFlowSituationSchema = z.object({
  tier1EventCount: z.number().int().nonnegative(),
  tier1PendingAcks: z.number().int().nonnegative(),
  dlqSize: z.number().int().nonnegative(),
  recentEventTypes: z.array(z.string()),
  backlogDegraded: z.boolean(),
  lastEventAt: z.number().int().nonnegative().nullable(),
});

/**
 * GoalDecompositionSituation — snapshot of the goal decomposition state.
 *
 * Captures the current state of goal decomposition including the decomposition
 * strategy, confidence level, and lifecycle state.
 *
 * Architecture note: Goal decomposition state is maintained by the
 * GoalDecompositionService in src/interaction/goal-decomposer/.
 */
export interface GoalDecompositionSituation {
  /** Goal ID being decomposed */
  goalId: string | null;
  /** Current lifecycle state of the decomposition */
  lifecycleState: "draft" | "decomposing" | "decomposed" | "partially_completed" | "executing" | "completed" | "failed" | "cancelled";
  /** Decomposition strategy used */
  strategy: "template" | "llm_plan" | "hybrid" | "human_assisted" | null;
  /** Number of tasks produced by decomposition */
  taskCount: number;
  /** Decomposition confidence score (0-1) */
  decompositionConfidence: number;
  /** Whether human review is required before proceeding */
  requiresHumanReview: boolean;
  /** Overall risk level of the decomposed plan */
  overallRisk: "low" | "medium" | "high" | "critical" | null;
}

/** Zod schema for GoalDecompositionSituation */
export const GoalDecompositionSituationSchema = z.object({
  goalId: z.string().nullable(),
  lifecycleState: z.enum(["draft", "decomposing", "decomposed", "partially_completed", "executing", "completed", "failed", "cancelled"]),
  strategy: z.enum(["template", "llm_plan", "hybrid", "human_assisted"]).nullable(),
  taskCount: z.number().int().nonnegative(),
  decompositionConfidence: z.number().min(0).max(1),
  requiresHumanReview: z.boolean(),
  overallRisk: z.enum(["low", "medium", "high", "critical"]).nullable(),
});

/**
 * MemorySituation — snapshot of the multi-layer memory system state.
 *
 * Captures the state of the hierarchical memory system per §29 architecture,
 * including layer distribution, promotion candidates, and staleness metrics.
 *
 * Architecture note: Memory state is derived from the memory-layer-model
 * and memory services in src/platform/five-plane-state-evidence/memory/.
 */
export interface MemorySituation {
  /** Count of memory records in working/runtime layer */
  workingLayerCount: number;
  /** Count of memory records in session layer */
  sessionLayerCount: number;
  /** Count of memory records in episodic/agent layer */
  episodicLayerCount: number;
  /** Count of memory records in semantic/project layer */
  semanticLayerCount: number;
  /** Count of memory records in procedural/user layer */
  proceduralLayerCount: number;
  /** Count of memory records in meta/evolution layer */
  metaLayerCount: number;
  /** Total count across all layers */
  totalMemoryCount: number;
  /** Count of memory records flagged for promotion to a higher layer */
  promotionCandidateCount: number;
  /** Count of stale (expired TTL) memory records */
  staleMemoryCount: number;
  /** Average quality score across accessible memory layers */
  averageQualityScore: number;
}

/** Zod schema for MemorySituation */
export const MemorySituationSchema = z.object({
  workingLayerCount: z.number().int().nonnegative(),
  sessionLayerCount: z.number().int().nonnegative(),
  episodicLayerCount: z.number().int().nonnegative(),
  semanticLayerCount: z.number().int().nonnegative(),
  proceduralLayerCount: z.number().int().nonnegative(),
  metaLayerCount: z.number().int().nonnegative(),
  totalMemoryCount: z.number().int().nonnegative(),
  promotionCandidateCount: z.number().int().nonnegative(),
  staleMemoryCount: z.number().int().nonnegative(),
  averageQualityScore: z.number().min(0).max(1),
});

let logger: StructuredLogger | null = null;

function getLogger(): StructuredLogger {
  logger ??= new StructuredLogger({ retentionLimit: 200 });
  return logger;
}

/**
 * UnifiedObservation — the single output surface of the Observe stage.
 * Combines task-level (TaskSituation), system-level (SystemSituation),
 * event flow (EventFlowSituation), goal decomposition (GoalDecompositionSituation),
 * and memory (MemorySituation) observations into one DTO consumed by the Assess stage.
 *
 * R5-11: Extended observation scope now includes:
 * - EventFlowSituation: event stream/flow context
 * - GoalDecompositionSituation: goal decomposition state
 * - MemorySituation: multi-layer memory system state
 *
 * §3 defines ObservationAggregator as the sole exit point from Observe.
 */
export interface UnifiedObservation {
  task: TaskSituation;
  system: SystemSituation;
  /** R5-11: Event flow situation - captures event bus activity */
  eventFlow: EventFlowSituation;
  /** R5-11: Goal decomposition situation - captures decomposition state */
  goalDecomposition: GoalDecompositionSituation;
  /** R5-11: Memory situation - captures multi-layer memory state */
  memory: MemorySituation;
  observedAt: number;
}

/**
 * Zod schema for UnifiedObservation — validates the aggregated output.
 */
export const UnifiedObservationSchema = z.object({
  task: z.unknown(), // TaskSituation validated separately by caller
  system: SystemSituationSchema,
  eventFlow: EventFlowSituationSchema.default({
    tier1EventCount: 0,
    tier1PendingAcks: 0,
    dlqSize: 0,
    recentEventTypes: [],
    backlogDegraded: false,
    lastEventAt: null,
  }),
  goalDecomposition: GoalDecompositionSituationSchema.default({
    goalId: null,
    lifecycleState: "draft",
    strategy: null,
    taskCount: 0,
    decompositionConfidence: 0,
    requiresHumanReview: false,
    overallRisk: null,
  }),
  memory: MemorySituationSchema.default({
    workingLayerCount: 0,
    sessionLayerCount: 0,
    episodicLayerCount: 0,
    semanticLayerCount: 0,
    proceduralLayerCount: 0,
    metaLayerCount: 0,
    totalMemoryCount: 0,
    promotionCandidateCount: 0,
    staleMemoryCount: 0,
    averageQualityScore: 0,
  }),
  observedAt: z.number().int().nonnegative(),
});

/**
 * R2 constraint: Observe output WHITELIST — only these top-level fields are allowed.
 * §L.5: "Observe 输出仅: raw_signals/normalized_snapshot/refs/metrics"
 */
const OBSERVE_OUTPUT_WHITELIST = new Set(["raw_signals", "normalized_snapshot", "refs", "metrics"]);

/**
 * R2 constraint: Observe output BLACKLIST — these fields must NOT appear in Observe output.
 * §L.5: "Observe 禁止输出: recommendedWorkflow/riskLevel/approvalRequired/modelClass/recommendedActions"
 *
 * These fields are the RESPONSIBILITY OF ASSESS, not Observe.
 * Enforcing this at the Observe→Assess boundary prevents polluted signals from bypassing the Assess stage.
 */
const OBSERVE_OUTPUT_BLACKLIST = new Set([
  "recommendedWorkflow",
  "riskLevel",
  "approvalRequired",
  "modelClass",
  "recommendedActions",
]);

/**
 * ObservationAggregator — merges TaskSituation, SystemSituation, EventFlowSituation,
 * GoalDecompositionSituation, and MemorySituation into a UnifiedObservation that serves
 * as the canonical Observe stage output.
 *
 * R5-11: Extended observation scope now includes event flow, goal decomposition, and memory
 * situations in addition to the original task and system situations.
 *
 * §3: "ObservationAggregator — 统一观测层 — 唯一出口"
 *
 * R2 §L.5 enforcement:
 * - Input objects are scanned for blacklisted fields; if any are found they are stripped
 *   and a warning is logged (fail-open to maintain availability).
 * - This guarantees the Assess stage cannot receive recommendation-type fields from Observe.
 */
export class ObservationAggregator {
  /**
   * Aggregate task-level, system-level, event flow, goal decomposition, and memory
   * observations into a UnifiedObservation.
   *
   * R5-11: This method now accepts three additional situation types:
   * - eventFlowSituation: Event flow state from the event bus
   * - goalDecompositionSituation: Goal decomposition state from the decomposer
   * - memorySituation: Memory layer state from the memory system
   *
   * Enforces R2 whitelist/blacklist by stripping any blacklisted fields found in the input.
   */
  public aggregate(
    taskSituation: TaskSituation,
    systemSituation: SystemSituation,
    eventFlowSituation: EventFlowSituation,
    goalDecompositionSituation: GoalDecompositionSituation,
    memorySituation: MemorySituation,
  ): UnifiedObservation {
    // Validate system situation using schema before aggregation
    const validatedSystem = SystemSituationSchema.parse(systemSituation);
    const validatedEventFlow = EventFlowSituationSchema.parse(eventFlowSituation) as EventFlowSituation;
    const validatedGoalDecomposition = GoalDecompositionSituationSchema.parse(goalDecompositionSituation);
    const validatedMemory = MemorySituationSchema.parse(memorySituation);
    const cleanedTask = this.stripBlacklistedFields(taskSituation);

    return {
      task: cleanedTask,
      system: validatedSystem,
      eventFlow: validatedEventFlow,
      goalDecomposition: validatedGoalDecomposition,
      memory: validatedMemory,
      observedAt: Date.now(),
    };
  }

  /**
   * Creates a default/empty EventFlowSituation for cases where event flow data is not available.
   * This ensures backward compatibility when event flow observation is not yet implemented.
   */
  public createEmptyEventFlowSituation(): EventFlowSituation {
    return {
      tier1EventCount: 0,
      tier1PendingAcks: 0,
      dlqSize: 0,
      recentEventTypes: [],
      backlogDegraded: false,
      lastEventAt: null,
    };
  }

  /**
   * Creates a default/empty GoalDecompositionSituation for cases where
   * goal decomposition data is not available.
   */
  public createEmptyGoalDecompositionSituation(): GoalDecompositionSituation {
    return {
      goalId: null,
      lifecycleState: "draft",
      strategy: null,
      taskCount: 0,
      decompositionConfidence: 0,
      requiresHumanReview: false,
      overallRisk: null,
    };
  }

  /**
   * Creates a default/empty MemorySituation for cases where memory data is not available.
   */
  public createEmptyMemorySituation(): MemorySituation {
    return {
      workingLayerCount: 0,
      sessionLayerCount: 0,
      episodicLayerCount: 0,
      semanticLayerCount: 0,
      proceduralLayerCount: 0,
      metaLayerCount: 0,
      totalMemoryCount: 0,
      promotionCandidateCount: 0,
      staleMemoryCount: 0,
      averageQualityScore: 0,
    };
  }

  /**
   * Recursively strip blacklisted fields from an object.
   * Blacklisted keys are removed; whitelisted keys are preserved.
   * Logs a warning for each blacklisted field found.
   */
  private stripBlacklistedFields(obj: unknown): TaskSituation {
    if (obj === null || obj === undefined || typeof obj !== "object") {
      return obj as TaskSituation;
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (OBSERVE_OUTPUT_BLACKLIST.has(key)) {
        getLogger().warn(`[Observe:R2:blacklist] stripped blacklisted field "${key}" from Observe output`);
        continue; // drop the field
      }

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        result[key] = this.stripBlacklistedFields(value);
      } else {
        result[key] = value;
      }
    }

    return result as TaskSituation;
  }
}
