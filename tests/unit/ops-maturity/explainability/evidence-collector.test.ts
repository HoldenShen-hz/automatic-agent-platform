/**
 * Unit tests for EvidenceCollector
 *
 * @see src/ops-maturity/explainability/evidence-collector/index.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  collectExplanationEvidence,
  collectExplanationEvidenceIds,
  type ExplanationEvidence,
} from "../../../../src/ops-maturity/explainability/index.js";

describe("EvidenceCollector", () => {
  describe("collectExplanationEvidenceIds", () => {
    test("extracts evidence IDs from a list of evidence items", () => {
      const evidence: readonly ExplanationEvidence[] = [
        { evidenceId: "ev-1", category: "log", excerpt: "Step 1 completed" },
        { evidenceId: "ev-2", category: "log", excerpt: "Step 2 completed" },
        { evidenceId: "ev-3", category: "metric", excerpt: "Latency: 50ms" },
      ];

      const ids = collectExplanationEvidenceIds(evidence);

      assert.deepEqual(ids, ["ev-1", "ev-2", "ev-3"]);
    });

    test("returns empty array for empty input", () => {
      const ids = collectExplanationEvidenceIds([]);
      assert.deepEqual(ids, []);
    });

    test("handles evidence with only required fields", () => {
      const evidence: readonly ExplanationEvidence[] = [
        { evidenceId: "ev-only-required", category: "default" },
      ];

      const ids = collectExplanationEvidenceIds(evidence);

      assert.deepEqual(ids, ["ev-only-required"]);
    });

    test("handles single evidence item", () => {
      const evidence: readonly ExplanationEvidence[] = [
        { evidenceId: "single-ev", category: "audit" },
      ];

      const ids = collectExplanationEvidenceIds(evidence);

      assert.deepEqual(ids, ["single-ev"]);
    });
  });

  describe("collectExplanationEvidence", () => {
    test("collects evidence IDs and groups by category", () => {
      const evidence: readonly ExplanationEvidence[] = [
        { evidenceId: "ev-1", category: "log" },
        { evidenceId: "ev-2", category: "log" },
        { evidenceId: "ev-3", category: "metric" },
      ];

      const bundle = collectExplanationEvidence(evidence);

      assert.deepEqual(bundle.evidenceIds, ["ev-1", "ev-2", "ev-3"]);
      assert.deepEqual(bundle.groupedByCategory["log"], [
        { evidenceId: "ev-1", category: "log" },
        { evidenceId: "ev-2", category: "log" },
      ]);
      assert.deepEqual(bundle.groupedByCategory["metric"], [
        { evidenceId: "ev-3", category: "metric" },
      ]);
    });

    test("returns empty bundle for empty input", () => {
      const bundle = collectExplanationEvidence([]);

      assert.deepEqual(bundle.evidenceIds, []);
      assert.deepEqual(bundle.groupedByCategory, {});
    });

    test("groups multiple categories correctly", () => {
      const evidence: readonly ExplanationEvidence[] = [
        { evidenceId: "a", category: "security" },
        { evidenceId: "b", category: "performance" },
        { evidenceId: "c", category: "security" },
        { evidenceId: "d", category: "audit" },
      ];

      const bundle = collectExplanationEvidence(evidence);

      assert.equal(bundle.evidenceIds.length, 4);
      assert.equal(bundle.groupedByCategory["security"]?.length, 2);
      assert.equal(bundle.groupedByCategory["performance"]?.length, 1);
      assert.equal(bundle.groupedByCategory["audit"]?.length, 1);
    });

    test("preserves sourceRef and excerpt in grouped evidence", () => {
      const evidence: readonly ExplanationEvidence[] = [
        { evidenceId: "e1", category: "log", sourceRef: "service-a", excerpt: "Started" },
        { evidenceId: "e2", category: "log", sourceRef: "service-b", excerpt: "Completed" },
      ];

      const bundle = collectExplanationEvidence(evidence);

      assert.equal(bundle.groupedByCategory["log"]?.[0]?.sourceRef, "service-a");
      assert.equal(bundle.groupedByCategory["log"]?.[0]?.excerpt, "Started");
      assert.equal(bundle.groupedByCategory["log"]?.[1]?.sourceRef, "service-b");
      assert.equal(bundle.groupedByCategory["log"]?.[1]?.excerpt, "Completed");
    });

    test("returned bundle contains expected structure", () => {
      const bundle = collectExplanationEvidence([
        { evidenceId: "x", category: "test" },
      ]);

      assert.ok("evidenceIds" in bundle);
      assert.ok("groupedByCategory" in bundle);
      assert.equal(bundle.groupedByCategory["test"]?.[0]?.evidenceId, "x");
    });
  });
});
