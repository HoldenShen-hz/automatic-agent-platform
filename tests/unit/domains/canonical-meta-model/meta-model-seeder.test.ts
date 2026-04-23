import assert from "node:assert/strict";
import test from "node:test";

import { seedDomainMetaModel, seedDomainMetaModels } from "../../../../src/domains/canonical-meta-model/meta-model-seeder.js";
import { META_MODEL_QUESTION_IDS } from "../../../../src/domains/canonical-meta-model/types.js";

test("seedDomainMetaModel creates a model with all 12 questions answered", () => {
  const model = seedDomainMetaModel({
    domainId: "test_domain",
    displayName: "Test Domain",
    ownerOrgNodeId: "org.test",
    taskTypes: ["task_a", "task_b"],
    tags: ["testing", "qa"],
    riskLevel: "high",
  });

  assert.equal(model.domainId, "test_domain");
  assert.equal(model.displayName, "Test Domain");
  assert.equal(model.version, "v1");
  assert.equal(model.answers.length, META_MODEL_QUESTION_IDS.length);
});

test("seedDomainMetaModel answers contain correct question IDs", () => {
  const model = seedDomainMetaModel({
    domainId: "coding",
    displayName: "Coding",
    ownerOrgNodeId: "org.coding",
    taskTypes: ["code_gen"],
    tags: ["dev"],
    riskLevel: "medium",
  });

  const questionIds = model.answers.map((a) => a.questionId);
  assert.deepEqual(questionIds, [...META_MODEL_QUESTION_IDS]);
});

test("seedDomainMetaModel answers have complete status", () => {
  const model = seedDomainMetaModel({
    domainId: "legal",
    displayName: "Legal",
    ownerOrgNodeId: "org.legal",
    taskTypes: ["review"],
    tags: ["legal"],
    riskLevel: "critical",
  });

  for (const answer of model.answers) {
    assert.equal(answer.status, "complete", `Answer for ${answer.questionId} should be complete`);
  }
});

test("seedDomainMetaModel answers include evidence refs with domain context", () => {
  const model = seedDomainMetaModel({
    domainId: "finance",
    displayName: "Finance",
    ownerOrgNodeId: "org.finance",
    taskTypes: ["payment"],
    tags: ["money"],
    riskLevel: "critical",
  });

  for (const answer of model.answers) {
    assert.ok(answer.evidenceRefs.some((ref) => ref.startsWith("domain:")), "Each answer should reference the domain");
    assert.ok(answer.evidenceRefs.some((ref) => ref.startsWith("owner:")), "Each answer should reference the owner");
  }
});

test("seedDomainMetaModel includes task types in core inputs answer", () => {
  const model = seedDomainMetaModel({
    domainId: "marketing",
    displayName: "Marketing",
    ownerOrgNodeId: "org.marketing",
    taskTypes: ["campaign", "analytics", "content"],
    tags: ["marketing"],
    riskLevel: "high",
  });

  const coreInputsAnswer = model.answers.find((a) => a.questionId === "Q3_core_inputs");
  assert.ok(coreInputsAnswer);
  assert.ok(coreInputsAnswer.answer.includes("campaign"));
  assert.ok(coreInputsAnswer.answer.includes("analytics"));
});

test("seedDomainMetaModel includes risk level in risk hotspots answer", () => {
  const model = seedDomainMetaModel({
    domainId: "security",
    displayName: "Security",
    ownerOrgNodeId: "org.security",
    taskTypes: ["scan"],
    tags: ["infosec"],
    riskLevel: "critical",
  });

  const riskAnswer = model.answers.find((a) => a.questionId === "Q6_risk_hotspots");
  assert.ok(riskAnswer);
  assert.ok(riskAnswer.answer.includes("critical"));
});

test("seedDomainMetaModel creates valid model for all risk levels", () => {
  const riskLevels: Array<"medium" | "high" | "critical"> = ["medium", "high", "critical"];
  for (const riskLevel of riskLevels) {
    const model = seedDomainMetaModel({
      domainId: `domain_${riskLevel}`,
      displayName: `Domain ${riskLevel}`,
      ownerOrgNodeId: "org.test",
      taskTypes: ["task"],
      tags: ["test"],
      riskLevel,
    });
    assert.equal(model.domainId, `domain_${riskLevel}`);
    assert.equal(model.answers.length, META_MODEL_QUESTION_IDS.length);
  }
});

test("seedDomainMetaModels creates multiple models", () => {
  const inputs = [
    { domainId: "domain_a", displayName: "Domain A", ownerOrgNodeId: "org.a", taskTypes: ["task_a"], tags: ["a"], riskLevel: "medium" as const },
    { domainId: "domain_b", displayName: "Domain B", ownerOrgNodeId: "org.b", taskTypes: ["task_b"], tags: ["b"], riskLevel: "high" as const },
    { domainId: "domain_c", displayName: "Domain C", ownerOrgNodeId: "org.c", taskTypes: ["task_c"], tags: ["c"], riskLevel: "critical" as const },
  ];

  const models = seedDomainMetaModels(inputs);

  assert.equal(models.length, 3);
  assert.equal(models[0]!.domainId, "domain_a");
  assert.equal(models[1]!.domainId, "domain_b");
  assert.equal(models[2]!.domainId, "domain_c");
});

test("seedDomainMetaModels returns empty array for empty input", () => {
  const models = seedDomainMetaModels([]);
  assert.equal(models.length, 0);
});
