import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClaimEvidenceGraph,
  verifyCitations,
} from "../../../../src/domains/knowledge-base/citation-verifier.js";

test("verifyCitations computes coverage, correctness, and stale sources", () => {
  const report = verifyCitations([
    {
      claimId: "claim-1",
      text: "supported claim",
      citationId: "citation-1",
      sourceId: "source-1",
      supported: true,
      sourceDate: "2026-01-01T00:00:00.000Z",
    },
    {
      claimId: "claim-2",
      text: "unsupported claim",
      citationId: "citation-2",
      sourceId: "source-2",
      supported: false,
      sourceDate: "2024-01-01T00:00:00.000Z",
    },
  ], new Date("2026-06-01T00:00:00.000Z"));

  assert.equal(report.citationCoverage, 1);
  assert.equal(report.citationCorrectness, 0.5);
  assert.equal(report.staleSourceCount, 1);
  assert.deepEqual(report.unsupportedClaimIds, ["claim-2"]);
});

test("buildClaimEvidenceGraph links claims, citations, and sources", () => {
  const graph = buildClaimEvidenceGraph([
    {
      claimId: "claim-1",
      text: "supported claim",
      citationId: "citation-1",
      sourceId: "source-1",
      supported: true,
    },
  ]);

  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
});
