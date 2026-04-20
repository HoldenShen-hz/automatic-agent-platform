/**
 * UnifiedObservation — the canonical output surface of the Observe stage.
 *
 * §3.5: Combines task-level (TaskSituation) and system-level (SystemSituation)
 * observations into one DTO consumed by the Assess stage.
 *
 * Defined primarily in observability/observation-aggregator.ts; this file provides
 * the canonical re-export for agent-loop consumers.
 */

export { UnifiedObservationSchema, type UnifiedObservation } from "../../../shared/observability/observation-aggregator.js";
