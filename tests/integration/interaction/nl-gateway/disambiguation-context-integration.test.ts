import assert from "node:assert/strict";
import test from "node:test";

import { DisambiguationHandler } from "../../../src/interaction/nl-gateway/disambiguation-handler/index.js";
import { ContextEnricher } from "../../../src/interaction/nl-gateway/index.js";
import type { DetectedIntent } from "../../../src/interaction/nl-gateway/index.js";

function makeIntent(intentType: DetectedIntent["intentType"] = "task_create", confidence = 0.75): DetectedIntent {
  return {
    intentType,
    domainHint: "devops",
    entities: [],
    urgency: "normal",
    confidence,
  };
}

test("integration: DisambiguationHandler and ContextEnricher work together", () => {
  const disambiguator = new DisambiguationHandler();
  const enricher = new ContextEnricher();

  const intent = makeIntent("task_create", 0.6);
  const disambigResult = disambiguator.generateClarification("部署服务", 0.6, intent, []);

  const context = enricher.enrich("部署服务到生产环境", "devops", []);

  assert.ok(disambigResult.questions.length > 0);
  assert.equal(context.domainHint, "devops");
});

test("integration: disambiguation generates context-appropriate questions", () => {
  const disambiguator = new DisambiguationHandler();
  const intent = makeIntent("task_modify", 0.5);

  const result = disambigutor.generateClarification("更新配置", 0.5, intent, []);

  // Should ask about scope when task_modify intent is unclear
  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.length > 0);
});

test("integration: disambiguation confidence level affects question type", () => {
  const disambiguator = new DisambiguationHandler();

  const veryLowResult = disambiguator.generateClarification("do something", 0.3, makeIntent(), []);
  const lowResult = disambiguator.generateClarification("do something", 0.6, makeIntent(), []);

  assert.equal(veryLowResult.confidenceLevel, "very_low");
  assert.equal(lowResult.confidenceLevel, "low");
  assert.ok(veryLowResult.questions.length >= lowResult.questions.length);
});

test("integration: disambiguation with multiple intents", () => {
  const disambiguator = new DisambiguationHandler();
  const intent1 = makeIntent("task_create", 0.85);
  const intent2 = makeIntent("task_query", 0.82);
  const allIntents: DetectedIntent[] = [intent1, intent2];

  const result = disambiguator.disambiguate("帮我处理", 0.83, intent1, allIntents);

  // Similar confidence intents should trigger disambiguation
  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions[0]?.options);
});

test("integration: ContextEnricher enriches disambiguation context", () => {
  const enricher = new ContextEnricher();
  const context = enricher.enrich("发布到生产环境并同步状态", "engineering", []);

  assert.ok(context.extractedConstraints.includes("production_scope"));
});

test("integration: disambiguation and enrichment handle deploy intent", () => {
  const disambiguator = new DisambiguationHandler();
  const enricher = new ContextEnricher();

  const result = disambiguator.generateClarification(
    "deploy to production",
    0.6,
    makeIntent("task_create"),
    [],
  );

  const context = enricher.enrich("deploy to production", "devops", []);

  assert.equal(result.confidenceLevel, "low");
  assert.ok(result.questions.some((q) => q.entityType === "environment"));
  assert.ok(context.extractedConstraints.includes("production_scope"));
});
