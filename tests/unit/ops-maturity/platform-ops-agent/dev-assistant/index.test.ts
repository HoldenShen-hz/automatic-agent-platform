/**
 * Unit tests for dev-assistant utilities
 *
 * @see src/ops-maturity/platform-ops-agent/dev-assistant/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeDeveloperAssistSuggestion,
  buildDeveloperAssistChecklist,
  DeveloperAssistantService,
  type DeveloperAssistRecommendation,
} from "../../../../../src/ops-maturity/platform-ops-agent/dev-assistant/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// summarizeDeveloperAssistSuggestion
// ─────────────────────────────────────────────────────────────────────────────

test("summarizeDeveloperAssistSuggestion formats subject and findings", () => {
  const result = summarizeDeveloperAssistSuggestion("Database", ["slow query", "missing index"]);
  assert.equal(result, "Database: slow query; missing index");
});

test("summarizeDeveloperAssistSuggestion handles empty findings", () => {
  const result = summarizeDeveloperAssistSuggestion("API", []);
  assert.equal(result, "API: ");
});

test("summarizeDeveloperAssistSuggestion handles single finding", () => {
  const result = summarizeDeveloperAssistSuggestion("Cache", ["expired keys"]);
  assert.equal(result, "Cache: expired keys");
});

test("summarizeDeveloperAssistSuggestion handles many findings", () => {
  const findings = ["issue1", "issue2", "issue3", "issue4", "issue5"];
  const result = summarizeDeveloperAssistSuggestion("System", findings);
  assert.ok(result.includes("issue1"));
  assert.ok(result.includes("issue5"));
});

// ─────────────────────────────────────────────────────────────────────────────
// buildDeveloperAssistChecklist
// ─────────────────────────────────────────────────────────────────────────────

test("buildDeveloperAssistChecklist numbers items starting at 1", () => {
  const result = buildDeveloperAssistChecklist(["fix A", "fix B"]);
  assert.equal(result[0], "1. fix A");
  assert.equal(result[1], "2. fix B");
});

test("buildDeveloperAssistChecklist handles empty array", () => {
  const result = buildDeveloperAssistChecklist([]);
  assert.deepEqual(result, []);
});

test("buildDeveloperAssistChecklist handles single item", () => {
  const result = buildDeveloperAssistChecklist(["update config"]);
  assert.deepEqual(result, ["1. update config"]);
});

test("buildDeveloperAssistChecklist preserves finding order", () => {
  const findings = ["first", "second", "third"];
  const result = buildDeveloperAssistChecklist(findings);
  assert.equal(result[0], "1. first");
  assert.equal(result[1], "2. second");
  assert.equal(result[2], "3. third");
});

// ─────────────────────────────────────────────────────────────────────────────
// DeveloperAssistantService
// ─────────────────────────────────────────────────────────────────────────────

test("DeveloperAssistantService.recommend returns correct structure", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("API", ["fix timeout", "add retry"]);

  assert.equal(typeof result.summary, "string");
  assert.ok(Array.isArray(result.checklist));
  assert.ok(["info", "warning", "critical"].includes(result.severity));
  assert.equal(typeof result.findingCount, "number");
});

test("DeveloperAssistantService.recommend returns info severity for < 3 findings", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("API", ["fix A"]);

  assert.equal(result.severity, "info");
  assert.equal(result.findingCount, 1);
});

test("DeveloperAssistantService.recommend returns warning severity for 3-4 findings", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("API", ["fix A", "fix B", "fix C"]);

  assert.equal(result.severity, "warning");
  assert.equal(result.findingCount, 3);
});

test("DeveloperAssistantService.recommend returns critical severity for >= 5 findings", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("API", ["fix A", "fix B", "fix C", "fix D", "fix E"]);

  assert.equal(result.severity, "critical");
  assert.equal(result.findingCount, 5);
});

test("DeveloperAssistantService.recommend severity boundary at exactly 3", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("API", ["A", "B", "C"]);

  assert.equal(result.severity, "warning"); // 3 is >= 3
});

test("DeveloperAssistantService.recommend severity boundary at exactly 5", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("API", ["A", "B", "C", "D", "E"]);

  assert.equal(result.severity, "critical"); // 5 is >= 5
});

test("DeveloperAssistantService.recommend severity boundary at 4 findings", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("API", ["A", "B", "C", "D"]);

  assert.equal(result.severity, "warning"); // 4 is >= 3 but < 5
});

test("DeveloperAssistantService.recommend uses summarizeDeveloperAssistSuggestion", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("Database", ["slow query", "missing index"]);

  assert.equal(result.summary, "Database: slow query; missing index");
});

test("DeveloperAssistantService.recommend uses buildDeveloperAssistChecklist", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("Cache", ["expired keys", "size limit"]);

  assert.deepEqual(result.checklist, ["1. expired keys", "2. size limit"]);
});

test("DeveloperAssistantService.recommend handles empty findings", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("Empty", []);

  assert.equal(result.summary, "Empty: ");
  assert.deepEqual(result.checklist, []);
  assert.equal(result.severity, "info"); // 0 < 3
  assert.equal(result.findingCount, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// DeveloperAssistRecommendation interface
// ─────────────────────────────────────────────────────────────────────────────

test("DeveloperAssistRecommendation accepts valid structure", () => {
  const recommendation: DeveloperAssistRecommendation = {
    summary: "Test summary",
    checklist: ["1. fix A", "2. fix B"],
    severity: "warning",
    findingCount: 2,
  };
  assert.equal(recommendation.severity, "warning");
});

test("DeveloperAssistRecommendation accepts info severity", () => {
  const recommendation: DeveloperAssistRecommendation = {
    summary: "Info recommendation",
    checklist: [],
    severity: "info",
    findingCount: 0,
  };
  assert.equal(recommendation.severity, "info");
});

test("DeveloperAssistRecommendation accepts critical severity", () => {
  const recommendation: DeveloperAssistRecommendation = {
    summary: "Critical recommendation",
    checklist: ["1. A", "2. B", "3. C", "4. D", "5. E"],
    severity: "critical",
    findingCount: 5,
  };
  assert.equal(recommendation.severity, "critical");
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("summarizeDeveloperAssistSuggestion handles special characters in subject", () => {
  const result = summarizeDeveloperAssistSuggestion("API-Gateway", ["timeout"]);
  assert.ok(result.includes("API-Gateway"));
});

test("buildDeveloperAssistChecklist handles findings with special characters", () => {
  const result = buildDeveloperAssistChecklist(["fix: memory", "update: config"]);
  assert.equal(result[0], "1. fix: memory");
  assert.equal(result[1], "2. update: config");
});

test("DeveloperAssistantService.recommend with exactly 2 findings returns info", () => {
  const service = new DeveloperAssistantService();
  const result = service.recommend("API", ["A", "B"]);
  assert.equal(result.severity, "info");
});

test("DeveloperAssistantService.recommend checklist length matches findings", () => {
  const service = new DeveloperAssistantService();
  const findings = ["A", "B", "C", "D"];
  const result = service.recommend("Test", findings);
  assert.equal(result.checklist.length, 4);
});
