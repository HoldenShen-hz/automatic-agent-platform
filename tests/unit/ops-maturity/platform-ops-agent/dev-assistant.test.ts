import assert from "node:assert/strict";
import test from "node:test";

import { summarizeDeveloperAssistSuggestion } from "../../../../../src/ops-maturity/platform-ops-agent/dev-assistant/index.js";

test("summarizeDeveloperAssistSuggestion formats single finding", () => {
  const suggestion = summarizeDeveloperAssistSuggestion("Database", ["Connection pool exhausted"]);

  assert.ok(suggestion.includes("Database"));
  assert.ok(suggestion.includes("Connection pool exhausted"));
});

test("summarizeDeveloperAssistSuggestion joins multiple findings", () => {
  const suggestion = summarizeDeveloperAssistSuggestion("API Gateway", [
    "High latency detected",
    "Rate limit approaching",
    "Timeout configuration suboptimal",
  ]);

  assert.ok(suggestion.includes("API Gateway"));
  assert.ok(suggestion.includes("High latency detected"));
  assert.ok(suggestion.includes(";"));
});

test("summarizeDeveloperAssistSuggestion handles empty findings", () => {
  const suggestion = summarizeDeveloperAssistSuggestion("Service", []);

  assert.equal(suggestion, "Service: ");
});

test("summarizeDeveloperAssistSuggestion handles subject with special chars", () => {
  const suggestion = summarizeDeveloperAssistSuggestion("my-service:v2", ["issue 1"]);

  assert.ok(suggestion.includes("my-service:v2"));
});

test("summarizeDeveloperAssistSuggestion produces non-empty output", () => {
  const suggestion = summarizeDeveloperAssistSuggestion("Test", ["Problem"]);

  assert.ok(suggestion.length > 0);
});