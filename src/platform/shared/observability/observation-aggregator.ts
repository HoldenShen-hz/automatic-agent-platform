import { z } from "zod";
import type { TaskSituation } from "../../orchestration/oapeflir/types/task-situation.js";
import type { SystemSituation } from "./system-situation-model.js";
import { SystemSituationSchema } from "./system-situation-model.js";

/**
 * UnifiedObservation — the single output surface of the Observe stage.
 * Combines task-level (TaskSituation) and system-level (SystemSituation) observations
 * into one DTO consumed by the Assess stage.
 *
 * §3 defines ObservationAggregator as the sole exit point from Observe.
 */
export interface UnifiedObservation {
  task: TaskSituation;
  system: SystemSituation;
  observedAt: number;
}

/**
 * Zod schema for UnifiedObservation — validates the aggregated output.
 */
export const UnifiedObservationSchema = z.object({
  task: z.unknown(), // TaskSituation validated separately by caller
  system: SystemSituationSchema,
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
 * ObservationAggregator — merges TaskSituation and SystemSituation into
 * a UnifiedObservation that serves as the canonical Observe stage output.
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
   * Aggregate task-level and system-level observations into a UnifiedObservation.
   * Enforces R2 whitelist/blacklist by stripping any blacklisted fields found in the input.
   */
  public aggregate(taskSituation: TaskSituation, systemSituation: SystemSituation): UnifiedObservation {
    const cleanedTask = this.stripBlacklistedFields(taskSituation);
    return {
      task: cleanedTask,
      system: systemSituation,
      observedAt: Date.now(),
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
        console.warn(`[Observe:R2:blacklist] stripped blacklisted field "${key}" from Observe output`);
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
