import assert from "node:assert/strict";
import test from "node:test";
import { parseApprovalRequestSummary, parseApprovalDecisionSummary, normalizeLimit, } from "../../../../../src/platform/shared/observability/inspect-service-support.js";
test("parseApprovalRequestSummary parses valid JSON", () => {
    const result = parseApprovalRequestSummary('{"sourceAgentId": "agent_123", "riskLevel": "high"}');
    assert.equal(result.sourceAgentId, "agent_123");
    assert.equal(result.riskLevel, "high");
});
test("parseApprovalRequestSummary handles partial data", () => {
    const result = parseApprovalRequestSummary('{"sourceAgentId": "agent_456"}');
    assert.equal(result.sourceAgentId, "agent_456");
    assert.equal(result.riskLevel, null);
});
test("parseApprovalRequestSummary handles missing fields", () => {
    const result = parseApprovalRequestSummary("{}");
    assert.equal(result.sourceAgentId, null);
    assert.equal(result.riskLevel, null);
});
test("parseApprovalRequestSummary handles invalid JSON", () => {
    const result = parseApprovalRequestSummary("not json");
    assert.equal(result.sourceAgentId, null);
    assert.equal(result.riskLevel, null);
});
test("parseApprovalRequestSummary handles null-like values", () => {
    const result = parseApprovalRequestSummary('{"sourceAgentId": null, "riskLevel": 123}');
    assert.equal(result.sourceAgentId, null);
    assert.equal(result.riskLevel, null); // number not string
});
test("parseApprovalDecisionSummary parses valid JSON", () => {
    const result = parseApprovalDecisionSummary('{"decisionType": "approve", "respondedBy": "user_123", "cascadeDeny": true}');
    assert.equal(result.decisionType, "approve");
    assert.equal(result.respondedBy, "user_123");
    assert.equal(result.cascadeDeny, true);
});
test("parseApprovalDecisionSummary handles null input", () => {
    const result = parseApprovalDecisionSummary(null);
    assert.equal(result.decisionType, null);
    assert.equal(result.respondedBy, null);
    assert.equal(result.cascadeDeny, false);
});
test("parseApprovalDecisionSummary handles partial data", () => {
    const result = parseApprovalDecisionSummary('{"decisionType": "deny"}');
    assert.equal(result.decisionType, "deny");
    assert.equal(result.respondedBy, null);
    assert.equal(result.cascadeDeny, false);
});
test("parseApprovalDecisionSummary handles cascadeDeny false explicitly", () => {
    const result = parseApprovalDecisionSummary('{"cascadeDeny": false}');
    assert.equal(result.cascadeDeny, false);
});
test("parseApprovalDecisionSummary handles invalid JSON", () => {
    const result = parseApprovalDecisionSummary("invalid json");
    assert.equal(result.decisionType, null);
    assert.equal(result.respondedBy, null);
    assert.equal(result.cascadeDeny, false);
});
test("normalizeLimit returns fallback for undefined", () => {
    assert.equal(normalizeLimit(undefined, 50), 50);
});
test("normalizeLimit returns fallback for null", () => {
    assert.equal(normalizeLimit(null, 50), 50);
});
test("normalizeLimit returns fallback for NaN", () => {
    assert.equal(normalizeLimit(NaN, 50), 50);
});
test("normalizeLimit returns fallback for Infinity", () => {
    assert.equal(normalizeLimit(Infinity, 50), 50);
    assert.equal(normalizeLimit(-Infinity, 50), 50);
});
test("normalizeLimit clamps to minimum of 1", () => {
    assert.equal(normalizeLimit(0, 50), 1);
    assert.equal(normalizeLimit(-5, 50), 1);
});
test("normalizeLimit clamps to maximum of 200", () => {
    assert.equal(normalizeLimit(500, 50), 200);
    assert.equal(normalizeLimit(201, 50), 200);
});
test("normalizeLimit keeps values within range", () => {
    assert.equal(normalizeLimit(100, 50), 100);
    assert.equal(normalizeLimit(1, 50), 1);
    assert.equal(normalizeLimit(200, 50), 200);
});
test("normalizeLimit truncates floats", () => {
    assert.equal(normalizeLimit(50.9, 50), 50);
    assert.equal(normalizeLimit(50.1, 50), 50);
});
//# sourceMappingURL=inspect-service-support.test.js.map