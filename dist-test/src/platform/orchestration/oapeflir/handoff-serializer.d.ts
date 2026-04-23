/**
 * Agent Handoff Serializer — GAP-V2-05
 *
 * Implements L1→L2→L3 layered serialization with token budget trimming.
 *
 * Layer semantics (per §12 Agent Handoff Protocol):
 * - L1 (Fact Layer): Immutable ground truth — artifact refs + tool call records.
 *                     Always preserved unless budget exhausted.
 * - L2 (State Layer): Mutable execution context — phase, blockers, remaining budget,
 *                     latest summary. Trimmed aggressively when over budget.
 * - L3 (Plan Delta):  Changes to the plan since handoff was initiated.
 *                     Most volatile, trimmed first.
 *
 * Budget trimming priority: L3 → L2.summary → L2.blockers → L1.toolCallRecords → L1.artifactRefs
 */
import type { AgentHandoff } from "./handoff-model.js";
export interface HandoffSerializerOptions {
    /** Hard token cap for the serialized handoff payload. */
    totalMaxTokens: number;
}
/**
 * Serializes an AgentHandoff with L1→L2→L3 priority and budget trimming.
 *
 * L1 (Fact Layer) is the most critical — preserved longest.
 * L2 (State Layer) provides execution context — trimmed after L3.
 * L3 (Plan Delta) is most volatile — trimmed first.
 *
 * @returns A budget-trimmed AgentHandoff suitable for passing to the next agent.
 */
export declare function serializeHandoff(handoff: AgentHandoff, options: HandoffSerializerOptions): AgentHandoff;
