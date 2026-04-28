import test from "node:test";
import assert from "node:assert/strict";

import {
  ContextEnricher,
  type ExtractedEntity,
} from "../../../../src/interaction/nl-gateway/index.js";

function makeEntity(type: string, value: string, normalized: unknown = value): ExtractedEntity {
  return {
    entityType: type,
    value,
    normalized,
    sourceSpan: [0, value.length] as const,
  };
}

test("ContextEnricher.enrich extracts budget constraint from money entity", () => {
  const enricher = new ContextEnricher();
  const entities = [makeEntity("money", "$5000", 5000)];

  const result = enricher.enrich("预算 ¥5000", "general_ops", entities);

  assert.ok(result.extractedConstraints.includes("budget_constraint"));
});

test("ContextEnricher.enrich extracts timeline constraint from date entity", () => {
  const enricher = new ContextEnricher();
  const entities = [makeEntity("date", "2026-04-20", "2026-04-20")];

  const result = enricher.enrich("完成时间 2026-04-20", "general_ops", entities);

  assert.ok(result.extractedConstraints.includes("timeline_constraint"));
});

test("ContextEnricher.enrich extracts production_scope from prod keyword", () => {
  const enricher = new ContextEnricher();
  const entities: ExtractedEntity[] = [];

  const result = enricher.enrich("部署到生产环境", "general_ops", entities);

  assert.ok(result.extractedConstraints.includes("production_scope"));
});

test("ContextEnricher.enrich extracts production_scope for 线上", () => {
  const enricher = new ContextEnricher();
  const entities: ExtractedEntity[] = [];

  const result = enricher.enrich("上线到线上系统", "general_ops", entities);

  assert.ok(result.extractedConstraints.includes("production_scope"));
});

test("ContextEnricher.enrich extracts target environments from entity", () => {
  const enricher = new ContextEnricher();
  const entities = [
    makeEntity("environment", "production", "production"),
    makeEntity("environment", "staging", "staging"),
  ];

  const result = enricher.enrich("部署到 production 和 staging", "general_ops", entities);

  assert.deepEqual(result.targetEnvironments, ["production", "staging"]);
});

test("ContextEnricher.enrich extracts requested channels from entity", () => {
  const enricher = new ContextEnricher();
  const entities = [
    makeEntity("channel", "slack", "slack"),
    makeEntity("channel", "email", "email"),
  ];

  const result = enricher.enrich("通知发送到 slack 和 email", "general_ops", entities);

  assert.deepEqual(result.requestedChannels, ["slack", "email"]);
});

test("ContextEnricher.enrich extracts timeline refs from date entities", () => {
  const enricher = new ContextEnricher();
  const entities = [
    makeEntity("date", "2026-04-20", "2026-04-20"),
    makeEntity("date", "2026-04-25", "2026-04-25"),
  ];

  const result = enricher.enrich("在 2026-04-20 到 2026-04-25 之间完成", "general_ops", entities);

  assert.deepEqual(result.timelineRefs, ["2026-04-20", "2026-04-25"]);
});

test("ContextEnricher.enrich sets domainHint from divisionId", () => {
  const enricher = new ContextEnricher();
  const entities: ExtractedEntity[] = [];

  const result = enricher.enrich("create a deployment", "devops", entities);

  assert.equal(result.domainHint, "devops");
});

test("ContextEnricher.enrich returns empty arrays when no entities", () => {
  const enricher = new ContextEnricher();
  const entities: ExtractedEntity[] = [];

  const result = enricher.enrich("simple task", "general_ops", entities);

  assert.deepEqual(result.targetEnvironments, []);
  assert.deepEqual(result.requestedChannels, []);
  assert.deepEqual(result.timelineRefs, []);
  assert.deepEqual(result.extractedConstraints, []);
});

test("ContextEnricher.enrich handles mixed entities correctly", () => {
  const enricher = new ContextEnricher();
  const entities = [
    makeEntity("money", "$1000", 1000),
    makeEntity("date", "2026-05-01", "2026-05-01"),
    makeEntity("environment", "prod", "prod"),
    makeEntity("channel", "slack", "slack"),
  ];

  const result = enricher.enrich("预算 $1000，在 2026-05-01 前部署到 prod 并通知 slack", "general_ops", entities);

  assert.ok(result.extractedConstraints.includes("budget_constraint"));
  assert.ok(result.extractedConstraints.includes("timeline_constraint"));
  assert.deepEqual(result.targetEnvironments, ["prod"]);
  assert.deepEqual(result.requestedChannels, ["slack"]);
  assert.deepEqual(result.timelineRefs, ["2026-05-01"]);
});
