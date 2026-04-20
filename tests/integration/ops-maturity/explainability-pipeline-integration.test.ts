import assert from "node:assert/strict";
import test from "node:test";

import { ExplanationPipelineService } from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";

test("integration: runtime evidence is turned into a redacted audit explanation bundle", () => {
  const service = new ExplanationPipelineService();
  const bundle = service.generate({
    taskId: "task_rollback_1",
    stage: "rollback",
    summary: "rollback executed after health degradation",
    decisionFactors: ["latency exceeded SLA", "error rate increasing"],
    evidence: [
      { evidenceId: "trace_public_1", category: "trace" },
      { evidenceId: "secret_ticket_1", category: "secret" },
      { evidenceId: "artifact_public_2", category: "artifact" },
    ],
    riskNotes: ["customer impact ongoing"],
    causalLinks: [
      { source: "observe", target: "rollback", rationale: "latency breached 3 consecutive windows" },
      { source: "rollback", target: "stabilize", rationale: "traffic returned to previous version" },
    ],
    allowedEvidenceCategories: ["trace", "artifact"],
    generatedAt: "2026-04-20T00:00:00.000Z",
  }, "audit");

  assert.equal(bundle.rationale.summary, "rollback executed after health degradation");
  assert.deepEqual(bundle.rationale.evidenceRefs, ["trace_public_1", "artifact_public_2"]);
  assert.deepEqual(bundle.redactedEvidenceRefs, ["secret_ticket_1"]);
  assert.equal(bundle.causalSummary.length, 2);
  assert.match(bundle.rendered, /causal=observe -> rollback/);
});
