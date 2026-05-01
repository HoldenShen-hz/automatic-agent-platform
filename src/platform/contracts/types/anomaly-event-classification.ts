import {
  anomalySeverityToUnifiedSeverity,
  type ObservabilitySeverity,
  type AlertingSeverity,
  type RunbookSeverity,
  type DiagnosticSeverity,
  type UnifiedSeverity,
} from "./unified-severity.js";

// Re-export severity types for convenience (tests expect them from this module)
export type { ObservabilitySeverity, AlertingSeverity, RunbookSeverity, DiagnosticSeverity };

export const ANOMALY_EVENT_CLASSES = [
  "E1_BUSINESS",
  "E2_EXECUTION",
  "E3_EXTERNAL_DEPENDENCY",
  "E4_SECURITY",
  "E5_DATA",
  "E6_GOVERNANCE",
] as const;

export type AnomalyEventClass = (typeof ANOMALY_EVENT_CLASSES)[number];

export interface ClassifiedAnomalyEvent {
  metricName: string;
  anomalyEventClass: AnomalyEventClass;
  unifiedSeverity: UnifiedSeverity;
  legacySeverity: ObservabilitySeverity;
  reason: string;
}

export interface ClassifyAnomalyEventInput {
  metricName: string;
  legacySeverity: ObservabilitySeverity;
  context?: Record<string, unknown> | null;
}

const CLASSIFIERS: Array<{
  anomalyEventClass: AnomalyEventClass;
  pattern: RegExp;
  reason: string;
}> = [
  {
    anomalyEventClass: "E4_SECURITY",
    pattern: /\b(auth|iam|credential|secret|sandbox|policy|attack|token|rbac|permission|spoof|tamper)\b/i,
    reason: "security_or_identity_signal",
  },
  {
    anomalyEventClass: "E3_EXTERNAL_DEPENDENCY",
    pattern: /\b(provider|third[_ -]?party|external|quota|rate[_ -]?limit|throttl|429|502|503|gateway)\b/i,
    reason: "external_dependency_signal",
  },
  {
    anomalyEventClass: "E6_GOVERNANCE",
    pattern: /\b(approval|governance|audit|compliance|review|policy_exception|rollout|change[_ -]?gate)\b/i,
    reason: "governance_signal",
  },
  {
    anomalyEventClass: "E5_DATA",
    pattern: /\b(data|dataset|db|database|sqlite|postgres|schema|projection|replica|knowledge|artifact|outbox)\b/i,
    reason: "data_signal",
  },
  {
    anomalyEventClass: "E2_EXECUTION",
    pattern: /\b(worker|execution|workflow|dispatch|lease|runtime|orchestration|task|queue|recovery)\b/i,
    reason: "execution_signal",
  },
];

function flattenContext(context?: Record<string, unknown> | null): string {
  if (context == null) {
    return "";
  }
  return Object.values(context)
    .flatMap((value) => {
      if (value == null) {
        return [];
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return [String(value)];
      }
      if (Array.isArray(value)) {
        return value.map((item) => String(item));
      }
      return [JSON.stringify(value)];
    })
    .join(" ");
}

function normalizeSearchText(value: string): string {
  return value.replace(/[_:.\\/-]+/g, " ");
}

export function classifyAnomalyEvent(input: ClassifyAnomalyEventInput): ClassifiedAnomalyEvent {
  const searchableText = normalizeSearchText(`${input.metricName} ${flattenContext(input.context)}`);
  const matched = CLASSIFIERS.find((classifier) => classifier.pattern.test(searchableText));

  return {
    metricName: input.metricName,
    anomalyEventClass: matched?.anomalyEventClass ?? "E1_BUSINESS",
    unifiedSeverity: anomalySeverityToUnifiedSeverity(input.legacySeverity),
    legacySeverity: input.legacySeverity,
    reason: matched?.reason ?? "business_signal_default",
  };
}
