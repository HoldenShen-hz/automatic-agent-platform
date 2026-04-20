import type { LearningSignal } from "../../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { FailurePattern } from "./failure-pattern-model.js";

const DENIAL_PATTERNS = [
  "permission denied",
  "permission_denied",
  "access denied",
  "forbidden",
  "not permitted",
  "requires approval",
  "sandbox",
  "operation not permitted",
  "EPERM",
  "eacces",
];

/**
 * Detects tool permission denials — tool calls that were blocked because
 * of sandbox policy or missing approval.
 *
 * §8 pattern: Tool permission denial
 */
export function detectToolPermissionDenial(signal: LearningSignal): FailurePattern | null {
  const { evidence, valueSummary, taskId, learningSignalId } = signal;
  const ev = evidence as Record<string, unknown>;

  const detail = String(valueSummary + " " + JSON.stringify(ev)).toLowerCase();

  for (const pattern of DENIAL_PATTERNS) {
    if (detail.includes(pattern.toLowerCase())) {
      const toolName = String(ev.toolName ?? ev.tool ?? "unknown");
      const operation = String(ev.operation ?? ev.action ?? "execute");
      return {
        patternType: "tool_permission_denial",
        taskId,
        stepId: String(ev.stepId ?? ""),
        title: `Tool permission denial — ${toolName}`,
        summary: `Tool "${toolName}" was blocked during ${operation}. ${valueSummary}`,
        evidenceRefs: [],
        sourceSignalIds: [learningSignalId],
        recommendation:
          "Approve the tool in sandbox settings, adjust the sandbox policy for this tool, or route this task through HITL approval.",
        detectedAt: signal.generatedAt,
      };
    }
  }

  return null;
}
