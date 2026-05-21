/**
 * Comprehensive unit tests for EdgeRiskGate
 *
 * @see src/ops-maturity/edge-runtime/edge-risk-gate.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { EdgeRiskGate } from "../../../../src/ops-maturity/edge-runtime/edge-risk-gate.js";

describe("EdgeRiskGate", () => {
  const baseRequest = {
    edgeNodeId: "edge_1",
    taskId: "task_1",
    modality: "text",
    createdAt: "2026-05-20T00:00:00.000Z",
    riskScore: 0.3,
    taskType: "read",
  };

  describe("riskScore validation", () => {
    test("fail-closes when riskScore is missing", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: undefined,
      } as any);

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /risk_score_required/);
    });

    test("fail-closes when riskScore is null", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: null,
      } as any);

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /risk_score_required/);
    });

    test("fail-closes when riskScore is NaN", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: NaN,
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /risk_score_required/);
    });

    test("fail-closes when riskScore is Infinity", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: Infinity,
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /risk_score_required/);
    });

    test("fail-closes when riskScore is negative Infinity", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: -Infinity,
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /risk_score_required/);
    });

    test("fail-closes when riskScore exceeds threshold (0.5)", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.51,
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /risk_score_exceeds_limit/);
    });

    test("fail-closes when riskScore is 0.6", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.6,
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /risk_score_exceeds_limit/);
    });

    test("fail-closes when riskScore is 1.0", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 1.0,
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /risk_score_exceeds_limit/);
    });

    test("allows riskScore exactly at threshold (0.5)", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.5,
      });

      assert.equal(result.allowed, true);
      assert.equal(result.riskScore, 0.5);
    });

    test("allows riskScore below threshold (0.49)", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.49,
      });

      assert.equal(result.allowed, true);
    });

    test("allows riskScore of 0.0", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.0,
      });

      assert.equal(result.allowed, true);
      assert.equal(result.riskScore, 0.0);
    });
  });

  describe("taskType validation", () => {
    test("fail-closes when taskType is missing", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        taskType: undefined,
      } as any);

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /task_type_required/);
    });

    test("fail-closes when taskType is null", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        taskType: null,
      } as any);

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /task_type_required/);
    });

    test("fail-closes when taskType is empty string", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        taskType: "",
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /task_type_required/);
    });

    test("fail-closes when taskType is only whitespace", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        taskType: "   ",
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /task_type_required/);
    });
  });

  describe("high-risk taskType blocking", () => {
    test("blocks delete taskType", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.1,
        taskType: "delete",
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /high_risk_task_type_blocked/);
      assert.match(result.reason ?? "", /delete/);
    });

    test("blocks destroy taskType", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.1,
        taskType: "destroy",
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /destroy/);
    });

    test("blocks terminate taskType", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.1,
        taskType: "terminate",
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /terminate/);
    });

    test("blocks force_push taskType", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.1,
        taskType: "force_push",
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /force_push/);
    });

    test("blocks sudo taskType", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.1,
        taskType: "sudo",
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /sudo/);
    });

    test("allows non-high-risk taskTypes with low riskScore", () => {
      const safeTaskTypes = ["read", "write", "summarize", "analyze", "query"];

      for (const taskType of safeTaskTypes) {
        const result = new EdgeRiskGate().check({
          ...baseRequest,
          riskScore: 0.3,
          taskType,
        });

        assert.equal(result.allowed, true, `Expected ${taskType} to be allowed`);
      }
    });
  });

  describe("allowed requests", () => {
    test("allows low-risk task with low riskScore", () => {
      const result = new EdgeRiskGate().check({
        edgeNodeId: "edge_1",
        taskId: "task_1",
        modality: "text",
        riskScore: 0.1,
        taskType: "read",
      });

      assert.equal(result.allowed, true);
      assert.equal(result.riskScore, 0.1);
      assert.equal(result.reason, undefined);
    });

    test("allows analyze taskType with 0.4 riskScore", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.4,
        taskType: "analyze",
      });

      assert.equal(result.allowed, true);
    });

    test("result includes riskScore for allowed request", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.25,
        taskType: "query",
      });

      assert.equal(result.riskScore, 0.25);
    });
  });

  describe("error priority", () => {
    test("returns riskScore error before taskType error", () => {
      // Neither riskScore nor taskType - riskScore validation should take precedence (fail-fast)
      const result = new EdgeRiskGate().check({
        edgeNodeId: "edge_1",
        taskId: "task_1",
        modality: "text",
      } as any);

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /risk_score_required/);
    });

    test("returns taskType error when riskScore is valid but taskType is not", () => {
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.3,
        taskType: "",
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /task_type_required/);
    });

    test("returns riskScore threshold error before high-risk taskType error", () => {
      // High riskScore with high-risk taskType - threshold check happens first
      const result = new EdgeRiskGate().check({
        ...baseRequest,
        riskScore: 0.8,
        taskType: "delete",
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason ?? "", /risk_score_exceeds_limit/);
    });
  });
});