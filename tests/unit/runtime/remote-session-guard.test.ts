import assert from "node:assert/strict";
import test from "node:test";

import { resolveRemoteAuthorityBlockReason } from "../../../src/platform/five-plane-execution/worker-pool/remote-session-guard.js";

test("remote session guard allows local workers and healthy remote workers [remote-session-guard]", () => {
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "local",
      remoteSessionStatus: null,
      lastAcknowledgedStreamOffset: null,
      sessionConsistencyCheckStatus: null,
      workspaceSyncStatus: null,
    }),
    null,
  );
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:9",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
    }),
    null,
  );
});

test("remote session guard blocks viewer-only, consistency mismatch, and missing resume offset [remote-session-guard]", () => {
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:10",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
    }),
    "remote_session_viewer_only",
  );
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:11",
      sessionConsistencyCheckStatus: "mismatch",
      workspaceSyncStatus: "aligned",
    }),
    "remote_session_consistency_mismatch",
  );
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:12",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "conflict",
    }),
    "remote_workspace_sync_conflict",
  );
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "reconnecting",
      lastAcknowledgedStreamOffset: null,
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
    }),
    "remote_session_resume_offset_missing",
  );
});

test("remote session guard returns null for remote workers that are connecting [remote-session-guard]", () => {
  // connecting status should not trigger resume offset missing
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "connecting",
      lastAcknowledgedStreamOffset: null,
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
    }),
    null,
  );
});

test("remote session guard returns null for remote workers that have failed [remote-session-guard]", () => {
  // failed status should not trigger resume offset missing
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "failed",
      lastAcknowledgedStreamOffset: null,
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
    }),
    null,
  );
});

test("remote session guard handles empty string stream offset as missing [remote-session-guard]", () => {
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
    }),
    "remote_session_resume_offset_missing",
  );
});

test("remote session guard handles whitespace-only stream offset as missing [remote-session-guard]", () => {
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "   ",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
    }),
    "remote_session_resume_offset_missing",
  );
});

test("remote session guard allows remote worker with valid offset even if other fields are null [remote-session-guard]", () => {
  // Only placement is remote, session is connected, and has a valid offset
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:100",
      sessionConsistencyCheckStatus: null,
      workspaceSyncStatus: null,
    }),
    null,
  );
});

test("remote session guard handles undefined placement as allowed [remote-session-guard]", () => {
  // undefined placement defaults to local behavior (not remote)
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: undefined,
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: null,
      sessionConsistencyCheckStatus: null,
      workspaceSyncStatus: null,
    }),
    null,
  );
});

test("remote session guard handles null placement as allowed [remote-session-guard]", () => {
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: null,
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: null,
      sessionConsistencyCheckStatus: null,
      workspaceSyncStatus: null,
    }),
    null,
  );
});

test("remote session guard priority: viewer_only blocks even with valid offset [remote-session-guard]", () => {
  // viewer_only is checked before resume offset, so it should block even with valid offset
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:100",
      sessionConsistencyCheckStatus: "mismatch",
      workspaceSyncStatus: "conflict",
    }),
    "remote_session_viewer_only",
  );
});

test("remote session guard priority: consistency mismatch checked before workspace sync [remote-session-guard]", () => {
  // consistency mismatch is checked before workspace sync conflict
  assert.equal(
    resolveRemoteAuthorityBlockReason({
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:100",
      sessionConsistencyCheckStatus: "mismatch",
      workspaceSyncStatus: "conflict",
    }),
    "remote_session_consistency_mismatch",
  );
});
