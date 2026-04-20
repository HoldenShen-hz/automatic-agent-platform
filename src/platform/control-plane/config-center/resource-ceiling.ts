/**
 * @fileoverview Resource Ceiling Guard interface.
 *
 * Defines the contract for resource ceiling guards that evaluate execution
 * resource usage against configured limits. This interface allows the tools
 * layer to depend on an abstraction rather than the concrete runtime implementation.
 */

import { ExecutionResourceCeilingGuard } from "../../execution/dispatcher/execution-resource-ceiling-guard.js";
import type { ExecutionResourceCeilingFinding } from "../../execution/dispatcher/execution-resource-ceiling-guard.js";
import type { ExecutionResourceUsageSample } from "../../execution/dispatcher/execution-resource-ceiling-guard.js";

/**
 * Interface for resource ceiling guards.
 *
 * Implementations evaluate execution resource usage samples against
 * configured ceilings and return findings when limits are exceeded.
 */
export interface ResourceCeilingGuard {
  /**
   * Evaluates a usage sample against all configured ceilings.
   *
   * @param sample - Resource usage sample to evaluate
   * @returns Array of findings, one per dimension that exceeded its limit
   */
  evaluate(sample: ExecutionResourceUsageSample): ExecutionResourceCeilingFinding[];

  /**
   * Returns the first finding, or null if no ceiling was exceeded.
   *
   * @param sample - Resource usage sample to evaluate
   * @returns First finding or null
   */
  firstFinding(sample: ExecutionResourceUsageSample): ExecutionResourceCeilingFinding | null;
}

export function createDefaultResourceCeilingGuard(): ResourceCeilingGuard {
  return new ExecutionResourceCeilingGuard();
}
