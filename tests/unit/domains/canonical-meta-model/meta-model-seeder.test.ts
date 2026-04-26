import assert from "node:assert/strict";
import test from "node:test";

import { seedDomainMetaModel, seedDomainMetaModels } from "../../../../src/domains/canonical-meta-model/meta-model-seeder.js";
import type { MetaModelSeedInput } from "../../../../src/domains/canonical-meta-model/meta-model-seeder.js";
import { META_MODEL_QUESTION_IDS } from "../../../../src/domains/canonical-meta-model/types.js";

test("seedDomainMetaModel creates model with correct domainId", () => {
  const input: MetaModelSeedInput = {
    domainId: "my-domain",
    displayName: "My Domain",
    ownerOrgNodeId: "org-node-1",
    taskTypes: ["task-type-a", "task-type-b"],
    tags: ["tag1", "tag2"],
    riskLevel: "medium",
  };

  const model = seedDomainMetaModel(input);

  assert.equal(model.domainId, "my-domain");
});

test("seedDomainMetaModel creates model with correct displayName", () => {
  const input: MetaModelSeedInput = {
    domainId: "my-domain",
    displayName: "My Special Domain",
    ownerOrgNodeId: "org-node-1",
    taskTypes: [],
    tags: [],
    riskLevel: "high",
  };

  const model = seedDomainMetaModel(input);

  assert.equal(model.displayName, "My Special Domain");
});

test("seedDomainMetaModel creates model with version v1", () => {
  const input: MetaModelSeedInput = {
    domainId: "my-domain",
    displayName: "My Domain",
    ownerOrgNodeId: "org-node-1",
    taskTypes: [],
    tags: [],
    riskLevel: "critical",
  };

  const model = seedDomainMetaModel(input);

  assert.equal(model.version, "v1");
});

test("seedDomainMetaModel generates all 12 question answers", () => {
  const input: MetaModelSeedInput = {
    domainId: "my-domain",
    displayName: "My Domain",
    ownerOrgNodeId: "org-node-1",
    taskTypes: ["type-a", "type-b"],
    tags: ["tag1"],
    riskLevel: "medium",
  };

  const model = seedDomainMetaModel(input);

  assert.equal(model.answers.length, META_MODEL_QUESTION_IDS.length);
  assert.equal(model.answers.length, 12);
});

test("seedDomainMetaModel generates answers for all question IDs", () => {
  const input: MetaModelSeedInput = {
    domainId: "my-domain",
    displayName: "My Domain",
    ownerOrgNodeId: "org-node-1",
    taskTypes: [],
    tags: [],
    riskLevel: "medium",
  };

  const model = seedDomainMetaModel(input);

  for (const questionId of META_MODEL_QUESTION_IDS) {
    const answer = model.answers.find((a) => a.questionId === questionId);
    assert.ok(answer !== undefined, `Missing answer for ${questionId}`);
  }
});

test("seedDomainMetaModel marks all answers as complete status", () => {
  const input: MetaModelSeedInput = {
    domainId: "my-domain",
    displayName: "My Domain",
    ownerOrgNodeId: "org-node-1",
    taskTypes: [],
    tags: [],
    riskLevel: "medium",
  };

  const model = seedDomainMetaModel(input);

  for (const answer of model.answers) {
    assert.equal(answer.status, "complete");
  }
});

test("seedDomainMetaModel generates non-empty answers", () => {
  const input: MetaModelSeedInput = {
    domainId: "my-domain",
    displayName: "My Domain",
    ownerOrgNodeId: "org-node-1",
    taskTypes: ["type-a", "type-b", "type-c"],
    tags: ["tag1", "tag2"],
    riskLevel: "high",
  };

  const model = seedDomainMetaModel(input);

  for (const answer of model.answers) {
    assert.ok(answer.answer.length > 0, `Empty answer for ${answer.questionId}`);
  }
});

test("seedDomainMetaModel includes task types in Q3 answer", () => {
  const input: MetaModelSeedInput = {
    domainId: "my-domain",
    displayName: "My Domain",
    ownerOrgNodeId: "org-node-1",
    taskTypes: ["task-type-a", "task-type-b"],
    tags: [],
    riskLevel: "medium",
  };

  const model = seedDomainMetaModel(input);
  const q3Answer = model.answers.find((a) => a.questionId === "Q3_core_inputs");

  assert.ok(q3Answer !== undefined);
  assert.ok(q3Answer!.answer.includes("task-type-a"));
  assert.ok(q3Answer!.answer.includes("task-type-b"));
});

test("seedDomainMetaModel reflects risk level in Q6 answer", () => {
  const input: MetaModelSeedInput = {
    domainId: "my-domain",
    displayName: "My Domain",
    ownerOrgNodeId: "org-node-1",
    taskTypes: [],
    tags: [],
    riskLevel: "critical",
  };

  const model = seedDomainMetaModel(input);
  const q6Answer = model.answers.find((a) => a.questionId === "Q6_risk_hotspots");

  assert.ok(q6Answer !== undefined);
  assert.ok(q6Answer!.answer.includes("critical"));
});

test("seedDomainMetaModel uses displayName in primary user answer", () => {
  const input: MetaModelSeedInput = {
    domainId: "my-domain",
    displayName: "Special Domain",
    ownerOrgNodeId: "org-node-1",
    taskTypes: [],
    tags: [],
    riskLevel: "medium",
  };

  const model = seedDomainMetaModel(input);
  const q1Answer = model.answers.find((a) => a.questionId === "Q1_primary_user");

  assert.ok(q1Answer !== undefined);
  assert.ok(q1Answer!.answer.includes("Special Domain"));
});

test("seedDomainMetaModels creates multiple models", () => {
  const inputs: readonly MetaModelSeedInput[] = [
    {
      domainId: "domain-a",
      displayName: "Domain A",
      ownerOrgNodeId: "org-1",
      taskTypes: [],
      tags: [],
      riskLevel: "medium",
    },
    {
      domainId: "domain-b",
      displayName: "Domain B",
      ownerOrgNodeId: "org-2",
      taskTypes: [],
      tags: [],
      riskLevel: "high",
    },
  ];

  const models = seedDomainMetaModels(inputs);

  assert.equal(models.length, 2);
  assert.equal(models[0]!.domainId, "domain-a");
  assert.equal(models[1]!.domainId, "domain-b");
});

test("seedDomainMetaModels preserves individual model properties", () => {
  const inputs: readonly MetaModelSeedInput[] = [
    {
      domainId: "domain-x",
      displayName: "Domain X",
      ownerOrgNodeId: "org-x",
      taskTypes: ["type-x"],
      tags: ["tag-x"],
      riskLevel: "critical",
    },
  ];

  const models = seedDomainMetaModels(inputs);
  const model = models[0]!;

  assert.equal(model.domainId, "domain-x");
  assert.equal(model.displayName, "Domain X");
  assert.equal(model.version, "v1");
  assert.equal(model.answers.length, 12);
});
