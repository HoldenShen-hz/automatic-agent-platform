import assert from "node:assert/strict";
import test from "node:test";
import { summarizeImprovementTracking, ImprovementTrackingRecordSchema } from "../../../../../src/scale-ecosystem/feedback-loop/improvement-tracker/index.js";
import type { ImprovementTrackingRecord } from "../../../../../src/scale-ecosystem/feedback-loop/improvement-tracker/index.js";

test("summarizeImprovementTracking counts by status", () => {
  const records: ImprovementTrackingRecord[] = [
    { candidateId: "c1", sourceSignalIds: ["s1"], status: "proposed", owner: "system" },
    { candidateId: "c2", sourceSignalIds: ["s2"], status: "proposed", owner: "system" },
    { candidateId: "c3", sourceSignalIds: ["s3"], status: "approved", owner: "admin" },
  ];

  const summary = summarizeImprovementTracking(records);

  assert.equal(summary["proposed"], 2);
  assert.equal(summary["approved"], 1);
});

test("summarizeImprovementTracking handles empty array", () => {
  const summary = summarizeImprovementTracking([]);

  assert.deepEqual(summary, {});
});

test("summarizeImprovementTracking handles all statuses", () => {
  const records: ImprovementTrackingRecord[] = [
    { candidateId: "c1", sourceSignalIds: [], status: "proposed", owner: "a" },
    { candidateId: "c2", sourceSignalIds: [], status: "reviewing", owner: "b" },
    { candidateId: "c3", sourceSignalIds: [], status: "approved", owner: "c" },
    { candidateId: "c4", sourceSignalIds: [], status: "rejected", owner: "d" },
    { candidateId: "c5", sourceSignalIds: [], status: "released", owner: "e" },
  ];

  const summary = summarizeImprovementTracking(records);

  assert.equal(summary["proposed"], 1);
  assert.equal(summary["reviewing"], 1);
  assert.equal(summary["approved"], 1);
  assert.equal(summary["rejected"], 1);
  assert.equal(summary["released"], 1);
});

test("ImprovementTrackingRecordSchema applies defaults", () => {
  const result = ImprovementTrackingRecordSchema.safeParse({
    candidateId: "c1",
    status: "proposed",
    owner: "system",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.sourceSignalIds, []);
  }
});