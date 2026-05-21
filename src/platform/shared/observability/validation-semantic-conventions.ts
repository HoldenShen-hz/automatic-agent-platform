export const VALIDATION_SPAN_NAMES = [
  "aa.mission.run",
  "aa.task.run",
  "aa.harness.run",
  "aa.oapeflir.stage",
  "aa.plangraph.validate",
  "aa.node.run",
  "aa.node.attempt",
  "aa.tool.invoke",
  "aa.model.request",
  "aa.budget.reserve",
  "aa.budget.settle",
  "aa.hitl.request",
  "aa.hitl.decision",
  "aa.knowledge.promote",
  "aa.event.publish",
  "aa.projection.rebuild",
  "aa.side_effect.commit",
] as const;

export const VALIDATION_REQUIRED_SPAN_ATTRIBUTES = [
  "trace_id",
  "span_id",
  "tenant_id",
  "mission_id",
  "task_id",
  "harness_run_id",
  "plan_graph_id",
  "node_run_id",
  "node_attempt_id",
  "principal_id",
  "runtime_mode",
  "risk_level",
  "budget_reservation_id",
  "tool_name",
  "model_provider",
  "model_name",
  "prompt_bundle_version",
  "evidence_ref_count",
  "artifact_ref_count",
] as const;

export type ValidationSpanAttribute =
  (typeof VALIDATION_REQUIRED_SPAN_ATTRIBUTES)[number];

export interface ValidationSpanSemanticCheck {
  readonly valid: boolean;
  readonly missingAttributes: readonly ValidationSpanAttribute[];
  readonly forbiddenMetricLabels: readonly string[];
}

const FORBIDDEN_HIGH_CARDINALITY_METRIC_LABELS = new Set([
  "mission_id",
  "task_id",
  "harness_run_id",
  "node_run_id",
  "node_attempt_id",
  "trace_id",
  "span_id",
  "principal_id",
]);

export function validateValidationSpanSemantics(input: {
  readonly attributes: Partial<Record<ValidationSpanAttribute, unknown>>;
  readonly metricLabels?: readonly string[];
}): ValidationSpanSemanticCheck {
  const missingAttributes = VALIDATION_REQUIRED_SPAN_ATTRIBUTES.filter(
    (attribute) => input.attributes[attribute] == null,
  );
  const forbiddenMetricLabels = (input.metricLabels ?? []).filter((label) =>
    FORBIDDEN_HIGH_CARDINALITY_METRIC_LABELS.has(label),
  );
  return {
    valid: missingAttributes.length === 0 && forbiddenMetricLabels.length === 0,
    missingAttributes,
    forbiddenMetricLabels,
  };
}
