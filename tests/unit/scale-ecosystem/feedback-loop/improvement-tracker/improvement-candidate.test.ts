/**
 * Improvement Tracker Tests
 *
 * Tests for improvement tracking status transitions and related logic.
 * Covers: status transitions (proposed → approved → rejected), tracking record handling.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ImprovementTrackingRecordSchema,
  summarizeImprovementTracking,
  type ImprovementTrackingRecord,
} from "../../../../../src/scale-ecosystem/feedback-loop/improvement-tracker/index.js";

test("ImprovementTrackingRecordSchema parses valid record with proposed status [improvement-candidate]", () => {
  const input = {
    candidateId: "cand_1",
    sourceSignalIds: ["sig_1", "sig_2"],
    status: "proposed",
    owner: "user_1",
  };

  const result = ImprovementTrackingRecordSchema.parse(input);

  assert.equal(result.candidateId, "cand_1");
  assert.equal(result.status, "proposed");
  assert.equal(result.owner, "user_1");
  assert.deepEqual(result.sourceSignalIds, ["sig_1", "sig_2"]);
});

test("ImprovementTrackingRecordSchema parses valid record with approved status [improvement-candidate]", () => {
  const input = {
    candidateId: "cand_2",
    sourceSignalIds: [],
    status: "approved",
    owner: "admin_1",
  };

  const result = ImprovementTrackingRecordSchema.parse(input);

  assert.equal(result.status, "approved");
});

test("ImprovementTrackingRecordSchema parses valid record with rejected status [improvement-candidate]", () => {
  const input = {
    candidateId: "cand_3",
    sourceSignalIds: ["sig_3"],
    status: "rejected",
    owner: "user_2",
  };

  const result = ImprovementTrackingRecordSchema.parse(input);

  assert.equal(result.status, "rejected");
});

test("ImprovementTrackingRecordSchema parses valid record with reviewing status [improvement-candidate]", () => {
  const input = {
    candidateId: "cand_4",
    sourceSignalIds: [],
    status: "reviewing",
    owner: "reviewer_1",
  };

  const result = ImprovementTrackingRecordSchema.parse(input);

  assert.equal(result.status, "reviewing");
});

test("ImprovementTrackingRecordSchema parses valid record with released status [improvement-candidate]", () => {
  const input = {
    candidateId: "cand_5",
    sourceSignalIds: ["sig_5"],
    status: "released",
    owner: "owner_5",
  };

  const result = ImprovementTrackingRecordSchema.parse(input);

  assert.equal(result.status, "released");
});

test("ImprovementTrackingRecordSchema applies defaults for optional fields [improvement-candidate]", () => {
  const input = {
    candidateId: "cand_6",
    status: "proposed",
    owner: "user_6",
  };

  const result = ImprovementTrackingRecordSchema.parse(input);

  assert.deepEqual(result.sourceSignalIds, []);
});

test("ImprovementTrackingRecordSchema rejects invalid status [improvement-candidate]", () => {
  assert.throws(() => {
    ImprovementTrackingRecordSchema.parse({
      candidateId: "cand_invalid",
      sourceSignalIds: [],
      status: "invalid_status",
      owner: "user",
    });
  });
});

test("ImprovementTrackingRecordSchema rejects empty candidateId [improvement-candidate]", () => {
  assert.throws(() => {
    ImprovementTrackingRecordSchema.parse({
      candidateId: "",
      sourceSignalIds: [],
      status: "proposed",
      owner: "user",
    });
  });
});

test("ImprovementTrackingRecordSchema rejects empty owner [improvement-candidate]", () => {
  assert.throws(() => {
    ImprovementTrackingRecordSchema.parse({
      candidateId: "cand_valid",
      sourceSignalIds: [],
      status: "proposed",
      owner: "",
    });
  });
});

test("summarizeImprovementTracking counts proposed status [improvement-candidate]", () => {
  const records: readonly ImprovementTrackingRecord[] = [
    { candidateId: "c1", sourceSignalIds: [], status: "proposed", owner: "u1" },
    { candidateId: "c2", sourceSignalIds: [], status: "proposed", owner: "u2" },
  ];

  const result = summarizeImprovementTracking(records);

  assert.equal(result.proposed, 2);
});

test("summarizeImprovementTracking counts approved status [improvement-candidate]", () => {
  const records: readonly ImprovementTrackingRecord[] = [
    { candidateId: "c1", sourceSignalIds: [], status: "approved", owner: "u1" },
    { candidateId: "c2", sourceSignalIds: [], status: "proposed", owner: "u2" },
    { candidateId: "c3", sourceSignalIds: [], status: "approved", owner: "u3" },
  ];

  const result = summarizeImprovementTracking(records);

  assert.equal(result.approved, 2);
  assert.equal(result.proposed, 1);
});

test("summarizeImprovementTracking counts rejected status [improvement-candidate]", () => {
  const records: readonly ImprovementTrackingRecord[] = [
    { candidateId: "c1", sourceSignalIds: [], status: "rejected", owner: "u1" },
  ];

  const result = summarizeImprovementTracking(records);

  assert.equal(result.rejected, 1);
});

test("summarizeImprovementTracking handles mixed statuses [improvement-candidate]", () => {
  const records: readonly ImprovementTrackingRecord[] = [
    { candidateId: "c1", sourceSignalIds: [], status: "proposed", owner: "u1" },
    { candidateId: "c2", sourceSignalIds: [], status: "reviewing", owner: "u2" },
    { candidateId: "c3", sourceSignalIds: [], status: "approved", owner: "u3" },
    { candidateId: "c4", sourceSignalIds: [], status: "rejected", owner: "u4" },
    { candidateId: "c5", sourceSignalIds: [], status: "released", owner: "u5" },
  ];

  const result = summarizeImprovementTracking(records);

  assert.equal(result.proposed, 1);
  assert.equal(result.reviewing, 1);
  assert.equal(result.approved, 1);
  assert.equal(result.rejected, 1);
  assert.equal(result.released, 1);
});

test("summarizeImprovementTracking handles empty array [improvement-candidate]", () => {
  const result = summarizeImprovementTracking([]);

  assert.equal(Object.keys(result).length, 0);
});

test("summarizeImprovementTracking handles all same status [improvement-candidate]", () => {
  const records: readonly ImprovementTrackingRecord[] = [
    { candidateId: "c1", sourceSignalIds: [], status: "proposed", owner: "u1" },
    { candidateId: "c2", sourceSignalIds: [], status: "proposed", owner: "u2" },
    { candidateId: "c3", sourceSignalIds: [], status: "proposed", owner: "u3" },
    { candidateId: "c4", sourceSignalIds: [], status: "proposed", owner: "u4" },
  ];

  const result = summarizeImprovementTracking(records);

  assert.equal(result.proposed, 4);
  assert.equal(Object.keys(result).length, 1);
});
