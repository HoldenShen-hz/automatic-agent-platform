/**
 * Unit tests for DataTaintPropagationService
 * Tests §11.6 DataTaintPropagation hard rules:
 * - output_data_class must not be lower than max_input_data_class
 * - taint_labels must propagate with output objects
 * - Downgrade requires explicit sanitization proof + redaction_report + reviewer evidence
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import type { DataTaintPropagationRecord, TaintPropagationResult, DataTaintLabel } from "../../../../../src/platform/state-evidence/truth/data-taint-propagation.js";
import {
  DataTaintPropagationService,
  getDataTaintPropagationService,
} from "../../../../../src/platform/state-evidence/truth/data-taint-propagation.js";

// Mock taint labels for testing
function createMockTaintLabel(overrides: Partial<DataTaintLabel> = {}): DataTaintLabel {
  return {
    sourcePluginId: "plugin.test",
    label: "test-taint",
    severity: "medium",
    propagatedAt: "2026-05-04T00:00:00.000Z",
    propagationChain: [],
    ...overrides,
  };
}

describe("DataTaintPropagationService", () => {
  let service: DataTaintPropagationService;

  beforeEach(() => {
    service = new DataTaintPropagationService();
  });

  describe("computePropagation", () => {
    it("should compute output_data_class equal to max_input_data_class when no downgrade", () => {
      const result = service.computePropagation({
        sourceObjectType: "ToolOutput",
        sourceObjectId: "tool_output_123",
        inputDataClasses: ["public", "internal"],
        sourcePluginId: "plugin.test",
      });

      assert.strictEqual(result.record.outputDataClass, "internal");
      assert.strictEqual(result.record.maxInputDataClass, "internal");
      assert.strictEqual(result.violations.length, 0);
    });

    it("should fail-closed when output would be lower than max input without approval", () => {
      // Input is confidential, but someone tries to output public without approval
      const result = service.computePropagation({
        sourceObjectType: "Summary",
        sourceObjectId: "summary_456",
        inputDataClasses: ["confidential"],
        sourcePluginId: "plugin.test",
      });

      // Should automatically elevate to max input (confidential) - fail-closed
      assert.strictEqual(result.record.outputDataClass, "confidential");
      assert.strictEqual(result.record.maxInputDataClass, "confidential");
      assert.ok(result.violations.some(v => v.code === "TAINT_PROPAGATION_HARD_RULE_VIOLATION"));
    });

    it("should allow downgrade when all three approval documents are provided", () => {
      // With redaction_report + desensitization_evidence + reviewer_decision, downgrade is allowed
      const result = service.computePropagation({
        sourceObjectType: "Summary",
        sourceObjectId: "summary_789",
        inputDataClasses: ["confidential"],
        sourcePluginId: "plugin.test",
        redactionReportRef: "redact_123",
        desensitizationEvidenceRef: "sanitize_456",
        reviewerDecisionRef: "review_789",
      });

      // Downgrade approved - confidential -> internal
      assert.strictEqual(result.record.outputDataClass, "internal");
      assert.strictEqual(result.downgradeApproved, true);
      assert.strictEqual(result.violations.length, 0);
    });

    it("should propagate taint_labels from inputs to output", () => {
      const inputLabels: DataTaintLabel[] = [
        createMockTaintLabel({ label: "pii", severity: "high" }),
        createMockTaintLabel({ label: "regulated", severity: "critical" }),
      ];

      const result = service.computePropagation({
        sourceObjectType: "ToolOutput",
        sourceObjectId: "tool_output_with_labels",
        inputDataClasses: ["confidential"],
        inputTaintLabels: inputLabels,
        sourcePluginId: "plugin.test",
      });

      assert.strictEqual(result.record.taintLabels.length, 2);
      assert.ok(result.record.taintLabels.some(l => l.label === "pii"));
      assert.ok(result.record.taintLabels.some(l => l.label === "regulated"));
      assert.ok(result.record.taintLabels[0].propagationChain.includes("tool_output_with_labels"));
    });

    it("should detect missing taint_labels when high-sensitivity input has none", () => {
      const result = service.computePropagation({
        sourceObjectType: "Summary",
        sourceObjectId: "summary_no_labels",
        inputDataClasses: ["confidential"],
        sourcePluginId: "plugin.test",
      });

      assert.ok(result.warnings.some(w => w.includes("taint labels")));
    });

    it("should handle empty inputDataClasses with default internal classification", () => {
      const result = service.computePropagation({
        sourceObjectType: "ToolOutput",
        sourceObjectId: "tool_output_empty",
        inputDataClasses: [],
        sourcePluginId: "plugin.test",
      });

      assert.strictEqual(result.record.outputDataClass, "internal");
    });

    it("should compute max correctly for restricted inputs", () => {
      const result = service.computePropagation({
        sourceObjectType: "ToolOutput",
        sourceObjectId: "tool_output_restricted",
        inputDataClasses: ["public", "internal", "confidential", "restricted"],
        sourcePluginId: "plugin.test",
      });

      assert.strictEqual(result.record.maxInputDataClass, "restricted");
      assert.strictEqual(result.record.outputDataClass, "restricted");
    });

    it("should warn when processing restricted data", () => {
      const result = service.computePropagation({
        sourceObjectType: "ToolOutput",
        sourceObjectId: "tool_output_restricted_warn",
        inputDataClasses: ["restricted"],
        sourcePluginId: "plugin.test",
      });

      assert.ok(result.warnings.some(w => w.includes("restricted")));
    });

    it("should preserve propagation chain in taint labels", () => {
      const inputLabels: DataTaintLabel[] = [
        createMockTaintLabel({
          label: "upstream-taint",
          propagationChain: ["obj1", "obj2"],
        }),
      ];

      const result = service.computePropagation({
        sourceObjectType: "ToolOutput",
        sourceObjectId: "tool_output_chain",
        inputDataClasses: ["confidential"],
        inputTaintLabels: inputLabels,
        sourcePluginId: "plugin.test",
      });

      const propagated = result.record.taintLabels[0];
      assert.deepStrictEqual(propagated.propagationChain, ["obj1", "obj2", "tool_output_chain"]);
    });
  });

  describe("recordPropagation and getRecord", () => {
    it("should store and retrieve propagation records", () => {
      const result = service.computePropagation({
        sourceObjectType: "ToolOutput",
        sourceObjectId: "tool_output_store",
        inputDataClasses: ["internal"],
        sourcePluginId: "plugin.test",
      });

      service.recordPropagation(result.record);
      const retrieved = service.getRecord(result.record.id);

      assert.strictEqual(retrieved?.id, result.record.id);
      assert.strictEqual(retrieved?.outputDataClass, "internal");
    });

    it("should return null for non-existent record", () => {
      const retrieved = service.getRecord("non_existent_id");
      assert.strictEqual(retrieved, null);
    });
  });

  describe("getRecordsBySourceObject", () => {
    it("should retrieve all records for a source object", () => {
      const result1 = service.computePropagation({
        sourceObjectType: "ToolOutput",
        sourceObjectId: "tool_output_multi",
        inputDataClasses: ["public"],
        sourcePluginId: "plugin.test",
      });

      const result2 = service.computePropagation({
        sourceObjectType: "Summary",
        sourceObjectId: "tool_output_multi",
        inputDataClasses: ["internal"],
        sourcePluginId: "plugin.test",
      });

      service.recordPropagation(result1.record);
      service.recordPropagation(result2.record);

      const records = service.getRecordsBySourceObject("tool_output_multi");
      assert.strictEqual(records.length, 2);
    });
  });

  describe("hasTaintLabel", () => {
    it("should detect presence of taint label", () => {
      const result = service.computePropagation({
        sourceObjectType: "ToolOutput",
        sourceObjectId: "tool_output_check",
        inputDataClasses: ["confidential"],
        inputTaintLabels: [createMockTaintLabel({ label: "secret" })],
        sourcePluginId: "plugin.test",
      });

      service.recordPropagation(result.record);

      assert.strictEqual(service.hasTaintLabel("tool_output_check", "secret"), true);
      assert.strictEqual(service.hasTaintLabel("tool_output_check", "other"), false);
    });
  });

  describe("getTaintLabels", () => {
    it("should retrieve all taint labels for an object", () => {
      const result = service.computePropagation({
        sourceObjectType: "ToolOutput",
        sourceObjectId: "tool_output_labels",
        inputDataClasses: ["confidential"],
        inputTaintLabels: [
          createMockTaintLabel({ label: "label1" }),
          createMockTaintLabel({ label: "label2" }),
          createMockTaintLabel({ label: "label3" }),
        ],
        sourcePluginId: "plugin.test",
      });

      service.recordPropagation(result.record);
      const labels = service.getTaintLabels("tool_output_labels");

      assert.strictEqual(labels.length, 3);
    });
  });

  describe("validateOutputClassification", () => {
    it("should return violation when output is lower than max input without approval", () => {
      const violations = service.validateOutputClassification(
        ["confidential"],
        "public",
        "some_object",
      );

      assert.ok(violations.length > 0);
      assert.ok(violations.some(v => v.code === "TAINT_PROPAGATION_HARD_RULE_VIOLATION"));
    });

    it("should return no violation when output equals max input", () => {
      const violations = service.validateOutputClassification(
        ["confidential"],
        "confidential",
        "some_object",
      );

      assert.strictEqual(violations.length, 0);
    });
  });

  describe("computeMaxLevel", () => {
    it("should return public for empty array", () => {
      const max = service.computeMaxLevel([]);
      assert.strictEqual(max, "public");
    });

    it("should return highest level from array", () => {
      assert.strictEqual(service.computeMaxLevel(["public", "internal"]), "internal");
      assert.strictEqual(service.computeMaxLevel(["public", "confidential"]), "confidential");
      assert.strictEqual(service.computeMaxLevel(["internal", "restricted", "public"]), "restricted");
    });
  });

  describe("getClassificationRank", () => {
    it("should return correct ranks for classification levels", () => {
      assert.strictEqual(service.getClassificationRank("public"), 0);
      assert.strictEqual(service.getClassificationRank("internal"), 1);
      assert.strictEqual(service.getClassificationRank("confidential"), 2);
      assert.strictEqual(service.getClassificationRank("restricted"), 3);
    });
  });

  describe("getDataTaintPropagationService singleton", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = getDataTaintPropagationService();
      const instance2 = getDataTaintPropagationService();

      assert.strictEqual(instance1, instance2);
    });
  });
});