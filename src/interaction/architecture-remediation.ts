import {
  classifyPromptInjectionRisk,
  type PromptInjectionClassification,
} from "../platform/shared/stability/prompt-injection-guard.js";

export type NlConversationState = "idle" | "intent_parsing" | "clarifying" | "building" | "confirming" | "executing" | "reporting";
export type TriggerType = "schedule" | "event" | "condition" | "webhook";

export interface ClarificationState {
  readonly state: NlConversationState;
  readonly missingSlots: readonly string[];
  readonly intentConfidenceThreshold: 0.8;
  readonly slotConfidenceThreshold: 0.85;
}

export interface UserConfirmationReceipt {
  readonly receiptId: string;
  readonly confirmedBy: string;
  readonly confirmedAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface ContextEnrichmentResult {
  readonly contextRefs: readonly string[];
  readonly redactionPolicy: string;
}

export interface ResponseFormatterResult {
  readonly message: string;
  readonly evidenceRefs: readonly string[];
  readonly freshness: string;
  readonly confidence: number;
  readonly redactionPolicy: string;
  readonly sourceProjectionVersion: string;
}

export interface GoalGraphDraft {
  readonly goalGraphDraftId: string;
  readonly budgetRefs: readonly string[];
  readonly riskRefs: readonly string[];
  readonly permissionRefs: readonly string[];
  readonly capabilityRefs: readonly string[];
}

export interface ProactiveTriggerDefinition {
  readonly triggerId: string;
  readonly type: TriggerType;
  readonly maxFireCount: number;
  readonly boundAgentId: string;
}

export interface MetricRegistryEntry {
  readonly metricId: string;
  readonly metricOwner: string;
  readonly freshnessSloMs: number;
  readonly staleBehavior: "hide" | "mark_stale" | "block_action";
  readonly redaction: "none" | "tenant" | "sensitive";
}

export function createClarificationState(missingSlots: readonly string[]): ClarificationState {
  return {
    state: missingSlots.length > 0 ? "clarifying" : "confirming",
    missingSlots,
    intentConfidenceThreshold: 0.8,
    slotConfidenceThreshold: 0.85,
  };
}

export async function inspectNlPrompt(input: string): Promise<PromptInjectionClassification> {
  return classifyPromptInjectionRisk(input);
}

export function detectTriggerFeedbackLoop(edges: readonly [string, string][]): boolean {
  const graph = new Map<string, string[]>();
  for (const [from, to] of edges) {
    graph.set(from, [...(graph.get(from) ?? []), to]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return [...graph.keys()].some(visit);
}

export function deriveUrgency(input: string): "low" | "medium" | "high" | "critical" {
  return /\b(critical|p0|sev1|emergency)\b/i.test(input) ? "critical" : /\b(high|urgent|p1)\b/i.test(input) ? "high" : "medium";
}

export function buildInteractionRemediationEvidence(): readonly string[] {
  return Array.from({ length: 20 }, (_value, index) => `I-${index + 1}`);
}
