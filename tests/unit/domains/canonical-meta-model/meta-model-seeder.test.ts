import assert from "node:assert/strict";
import test from "node:test";

import {
  seedDomainMetaModel,
  seedDomainMetaModels,
} from "../../../../src/domains/canonical-meta-model/meta-model-seeder.js";
import { META_MODEL_QUESTION_IDS } from "../../../../src/domains/canonical-meta-model/types.js";

test("seedDomainMetaModel creates model with all question IDs", () => {
  const model = seedDomainMetaModel({
    domainId: "test-domain",
    displayName: "Test Domain",
    ownerOrgNodeId: "node-123",
    taskTypes: ["task1", "task2"],
    tags: ["tag1", "tag2"],
    riskLevel: "high",
  });

  assert.equal(model.domainId, "test-domain");
  assert.equal(model.displayName, "Test Domain");
  assert.equal(model.version, "v1");
  assert.equal(model.answers.length, META_MODEL_QUESTION_IDS.length);
});

test("seedDomainMetaModel marks all answers as complete", () => {
  const model = seedDomainMetaModel({
    domainId: "test-domain",
    displayName: "Test Domain",
    ownerOrgNodeId: "node-123",
    taskTypes: ["task1"],
    tags: [],
    riskLevel: "medium",
  });

  for (const answer of model.answers) {
    assert.equal(answer.status, "complete", `Answer ${answer.questionId} should be complete`);
  }
});

test("seedDomainMetaModel includes base evidence with domainId and owner", () => {
  const model = seedDomainMetaModel({
    domainId: "my-domain",
    displayName: "My Domain",
    ownerOrgNodeId: "owner-node",
    taskTypes: [],
    tags: [],
    riskLevel: "critical",
  });

  for (const answer of model.answers) {
    assert.ok(answer.evidenceRefs.includes("domain:my-domain"), `Answer should have domain evidence`);
    assert.ok(answer.evidenceRefs.includes("owner:owner-node"), `Answer should have owner evidence`);
  }
});

test("seedDomainMetaModel includes task types in Q3 answer", () => {
  const model = seedDomainMetaModel({
    domainId: "test-domain",
    displayName: "Test",
    ownerOrgNodeId: "node",
    taskTypes: ["type-a", "type-b", "type-c"],
    tags: [],
    riskLevel: "high",
  });

  const q3 = model.answers.find(a => a.questionId === "Q3_core_inputs");
  assert.ok(q3);
  assert.ok(q3.answer.includes("type-a"));
  assert.ok(q3.answer.includes("type-b"));
  assert.ok(q3.answer.includes("type-c"));
});

test("seedDomainMetaModel sets risk hotspot based on risk level", () => {
  const modelHigh = seedDomainMetaModel({
    domainId: "d1",
    displayName: "D1",
    ownerOrgNodeId: "n",
    taskTypes: [],
    tags: [],
    riskLevel: "high",
  });

  const q6High = modelHigh.answers.find(a => a.questionId === "Q6_risk_hotspots");
  assert.ok(q6High);
  assert.ok(q6High.answer.includes("high risk"));

  const modelCritical = seedDomainMetaModel({
    domainId: "d2",
    displayName: "D2",
    ownerOrgNodeId: "n",
    taskTypes: [],
    tags: [],
    riskLevel: "critical",
  });

  const q6Critical = modelCritical.answers.find(a => a.questionId === "Q6_risk_hotspots");
  assert.ok(q6Critical);
  assert.ok(q6Critical.answer.includes("critical risk"));
});

test("seedDomainMetaModels creates multiple models", () => {
  const inputs = [
    { domainId: "domain-a", displayName: "Domain A", ownerOrgNodeId: "node-a", taskTypes: ["t1"], tags: [], riskLevel: "medium" as const },
    { domainId: "domain-b", displayName: "Domain B", ownerOrgNodeId: "node-b", taskTypes: ["t2"], tags: [], riskLevel: "high" as const },
  ];

  const models = seedDomainMetaModels(inputs);

  const firstModel = models[0]!;
  const secondModel = models[1]!;
  assert.equal(firstModel.domainId, "domain-a");
  assert.equal(secondModel.domainId, "domain-b");
});

test("seedDomainMetaModels returns array of models", () => {
  const models = seedDomainMetaModels([
    { domainId: "d1", displayName: "D1", ownerOrgNodeId: "n", taskTypes: [], tags: [], riskLevel: "medium" as const },
  ]);

  assert.ok(models[0]);
  assert.equal(models[0].domainId, "d1");
});

test("seedDomainMetaModel Q10 includes human governance mention", () => {
  const model = seedDomainMetaModel({
    domainId: "test",
    displayName: "Test",
    ownerOrgNodeId: "n",
    taskTypes: [],
    tags: [],
    riskLevel: "medium",
  });

  const q10 = model.answers.find(a => a.questionId === "Q10_human_governance");
  assert.ok(q10);
  assert.ok(q10.answer.includes("Human") || q10.answer.includes("human") || q10.answer.includes("approval"));
});

test("seedDomainMetaModel Q11 includes latency mention", () => {
  const model = seedDomainMetaModel({
    domainId: "test",
    displayName: "Test",
    ownerOrgNodeId: "n",
    taskTypes: [],
    tags: [],
    riskLevel: "medium",
  });

  const q11 = model.answers.find(a => a.questionId === "Q11_latency_sla");
  assert.ok(q11);
  assert.ok(q11.answer.includes("Latency") || q11.answer.includes("latency"));
});
