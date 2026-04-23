/**
 * Unit tests for dev-assistant
 *
 * @see src/ops-maturity/platform-ops-agent/dev-assistant/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DeveloperAssistantService, summarizeDeveloperAssistSuggestion, buildDeveloperAssistChecklist, } from "../../../../src/ops-maturity/platform-ops-agent/dev-assistant/index.js";
// summarizeDeveloperAssistSuggestion tests
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
test("summarizeDeveloperAssistSuggestion joins findings with semicolon and space", () => {
    const suggestion = summarizeDeveloperAssistSuggestion("Test", ["item1", "item2", "item3"]);
    assert.ok(suggestion.includes("; "));
});
test("summarizeDeveloperAssistSuggestion formats subject correctly", () => {
    const suggestion = summarizeDeveloperAssistSuggestion("CacheService", ["Memory pressure"]);
    assert.equal(suggestion, "CacheService: Memory pressure");
});
test("summarizeDeveloperAssistSuggestion handles unicode in subject", () => {
    const suggestion = summarizeDeveloperAssistSuggestion("服务-节点", ["问题"]);
    assert.ok(suggestion.includes("服务-节点"));
});
test("summarizeDeveloperAssistSuggestion handles unicode in findings", () => {
    const suggestion = summarizeDeveloperAssistSuggestion("Service", ["延迟增加", "错误率上升"]);
    assert.ok(suggestion.includes("延迟增加"));
    assert.ok(suggestion.includes("错误率上升"));
});
test("summarizeDeveloperAssistSuggestion handles very long subject", () => {
    const longSubject = "a".repeat(1000);
    const suggestion = summarizeDeveloperAssistSuggestion(longSubject, ["issue"]);
    assert.ok(suggestion.startsWith(longSubject));
});
test("summarizeDeveloperAssistSuggestion handles very long finding", () => {
    const longFinding = "b".repeat(1000);
    const suggestion = summarizeDeveloperAssistSuggestion("Service", [longFinding]);
    assert.ok(suggestion.includes(longFinding));
});
test("summarizeDeveloperAssistSuggestion handles empty subject", () => {
    const suggestion = summarizeDeveloperAssistSuggestion("", ["issue"]);
    assert.ok(suggestion.includes("issue"));
});
test("summarizeDeveloperAssistSuggestion handles findings with empty string", () => {
    const suggestion = summarizeDeveloperAssistSuggestion("Service", [""]);
    assert.ok(suggestion.includes("Service"));
});
test("summarizeDeveloperAssistSuggestion handles findings with special characters", () => {
    const suggestion = summarizeDeveloperAssistSuggestion("Service", ["<script>alert('xss')</script>"]);
    assert.ok(suggestion.includes("<script>"));
});
// buildDeveloperAssistChecklist tests
test("buildDeveloperAssistChecklist creates single item checklist", () => {
    const checklist = buildDeveloperAssistChecklist(["Fix memory leak"]);
    assert.equal(checklist.length, 1);
    assert.equal(checklist[0], "1. Fix memory leak");
});
test("buildDeveloperAssistChecklist numbers items sequentially", () => {
    const checklist = buildDeveloperAssistChecklist(["item1", "item2", "item3"]);
    assert.equal(checklist.length, 3);
    assert.equal(checklist[0], "1. item1");
    assert.equal(checklist[1], "2. item2");
    assert.equal(checklist[2], "3. item3");
});
test("buildDeveloperAssistChecklist handles empty array", () => {
    const checklist = buildDeveloperAssistChecklist([]);
    assert.equal(checklist.length, 0);
    assert.deepEqual(checklist, []);
});
test("buildDeveloperAssistChecklist handles single item", () => {
    const checklist = buildDeveloperAssistChecklist(["Update config"]);
    assert.equal(checklist.length, 1);
    assert.equal(checklist[0], "1. Update config");
});
test("buildDeveloperAssistChecklist handles multiple items", () => {
    const checklist = buildDeveloperAssistChecklist([
        "Restart service",
        "Clear cache",
        "Update threshold",
    ]);
    assert.equal(checklist.length, 3);
    assert.equal(checklist[0], "1. Restart service");
    assert.equal(checklist[1], "2. Clear cache");
    assert.equal(checklist[2], "3. Update threshold");
});
test("buildDeveloperAssistChecklist handles unicode content", () => {
    const checklist = buildDeveloperAssistChecklist(["修复延迟问题", "优化查询性能"]);
    assert.equal(checklist.length, 2);
    assert.ok(checklist[0].includes("修复延迟问题"));
    assert.ok(checklist[1].includes("优化查询性能"));
});
test("buildDeveloperAssistChecklist handles special characters in items", () => {
    const checklist = buildDeveloperAssistChecklist(["Check <metadata>", "Verify \"config\""]);
    assert.equal(checklist.length, 2);
    assert.ok(checklist[0].includes("<metadata>"));
    assert.ok(checklist[1].includes("config"));
});
test("buildDeveloperAssistChecklist handles empty string items", () => {
    const checklist = buildDeveloperAssistChecklist([""]);
    assert.equal(checklist.length, 1);
    assert.equal(checklist[0], "1. ");
});
test("buildDeveloperAssistChecklist handles very long items", () => {
    const longItem = "x".repeat(1000);
    const checklist = buildDeveloperAssistChecklist([longItem]);
    assert.equal(checklist.length, 1);
    assert.ok(checklist[0].endsWith(longItem));
});
test("buildDeveloperAssistChecklist returns new array instance", () => {
    const original = [];
    const checklist = buildDeveloperAssistChecklist(original);
    assert.notStrictEqual(checklist, original);
});
test("buildDeveloperAssistChecklist creates new array each call", () => {
    const checklist1 = buildDeveloperAssistChecklist(["item1", "item2"]);
    const checklist2 = buildDeveloperAssistChecklist(["item1", "item2"]);
    // Each call creates a new array instance
    assert.notStrictEqual(checklist1, checklist2);
    // But contents are the same
    assert.equal(checklist1[0], checklist2[0]);
    assert.equal(checklist1[1], checklist2[1]);
});
test("buildDeveloperAssistChecklist preserves order", () => {
    const items = ["first", "second", "third"];
    const checklist = buildDeveloperAssistChecklist(items);
    assert.equal(checklist[0], "1. first");
    assert.equal(checklist[1], "2. second");
    assert.equal(checklist[2], "3. third");
});
test("buildDeveloperAssistChecklist handles large number of items", () => {
    const items = Array.from({ length: 100 }, (_, i) => `item${i}`);
    const checklist = buildDeveloperAssistChecklist(items);
    assert.equal(checklist.length, 100);
    assert.equal(checklist[0], "1. item0");
    assert.equal(checklist[99], "100. item99");
});
test("DeveloperAssistantService classifies recommendation severity", () => {
    const service = new DeveloperAssistantService();
    const recommendation = service.recommend("api-gateway", [
        "latency spike",
        "cache miss increase",
        "retry storm",
        "error budget burn",
    ]);
    assert.equal(recommendation.severity, "warning");
    assert.equal(recommendation.findingCount, 4);
    assert.equal(recommendation.checklist.length, 4);
    assert.ok(recommendation.summary.includes("api-gateway"));
});
test("DeveloperAssistantService returns info severity for short finding list", () => {
    const service = new DeveloperAssistantService();
    const recommendation = service.recommend("worker", ["latency spike"]);
    assert.equal(recommendation.severity, "info");
});
test("DeveloperAssistantService returns critical severity for large finding list", () => {
    const service = new DeveloperAssistantService();
    const recommendation = service.recommend("worker", [
        "issue-1",
        "issue-2",
        "issue-3",
        "issue-4",
        "issue-5",
    ]);
    assert.equal(recommendation.severity, "critical");
});
test("buildDeveloperAssistChecklist handles items with newlines", () => {
    const checklist = buildDeveloperAssistChecklist(["line1\nline2", "line3"]);
    assert.equal(checklist.length, 2);
    assert.ok(checklist[0].includes("\n"));
});
//# sourceMappingURL=dev-assistant.test.js.map