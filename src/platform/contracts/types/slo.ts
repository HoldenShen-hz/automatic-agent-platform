/**
 * Service Level Objective (SLO) definition.
 *
 * An SLO defines a target threshold for a specific metric within a time window,
 * used for monitoring and breach detection.
 */
export interface Slo {
  /** Unique identifier for the SLO */
  readonly sloId: string;
  /** Human-readable name for the SLO */
  readonly name: string;
  /** Target threshold value */
  readonly target: number;
  /** Time window for the SLO measurement (duration in ms) */
  readonly window: number;
  /** The metric being measured (e.g., "latencyMs", "successRate", "errorRate") */
  readonly metric: string;
  /** Comparison operator for evaluating the SLO */
  readonly operator: ">" | "<" | ">=" | "<=";
}