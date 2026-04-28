import assert from "node:assert/strict";
import test from "node:test";

import { ExplanationPipelineService } from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";

test("ExplanationPipelineService preserves facts across depths and redacts unauthorized evidence", () => {
  const service = new ExplanationPipelineService();
  const request = {
    taskId: "task_release_1",
    stageId: "approval",
    summary: "release requires manual approval",
    decision: "accept" as const,
    decisionFactors: ["production change", "error budget tight"],
    evidence: [
      { evidenceId: "evt_public_1", category: "trace" },
      { evidenceId: "evt_secret_1", category: "secret" },
    ],
    riskNotes: ["deploy affects production"],
    causalLinks: [
      { source: "observe", target: "approval", rationale: "error budget below threshold" },
    ],
    allowedEvidenceCategories: ["trace"],
    generatedAt: "2026-04-20T00:00:00.000Z",
  };

  const brief = service.generate(request, "L1");
  const standard = service.generate(request, "L2");
  const audit = service.generate(request, "L3");

  assert.equal(brief.rationale.summary, standard.rationale.summary);
  assert.equal(standard.rationale.summary, audit.rationale.summary);
  assert.deepEqual(audit.rationale.evidenceRefs, ["evt_public_1"]);
  assert.deepEqual(audit.redactedEvidenceRefs, ["evt_secret_1"]);
  assert.match(standard.rendered, /factors=production change; error budget tight/);
  assert.match(audit.rendered, /redacted=evt_secret_1/);
  assert.equal(service.getCached(audit.cacheKey), null);
});
