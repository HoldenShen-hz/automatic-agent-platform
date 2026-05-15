import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveRemoteAuthorityBlockReason,
  type RemoteSessionAuthorityState,
  type RemoteAuthorityBlockReason,
} from "../../../../../src/platform/five-plane-execution/worker-pool/remote-session-guard.js";
import type { RemoteSessionStatus, SessionConsistencyCheckStatus, WorkspaceSyncStatus, WorkerPlacement } from "../../../../../src/platform/contracts/types/domain.js";

function makeState(overrides: Partial<RemoteSessionAuthorityState> = {}): RemoteSessionAuthorityState {
  return {
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset_123",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
    ...overrides,
  };
}

test("resolveRemoteAuthorityBlockReason returns null for local placement", () => {
  const state = makeState({ placement: "local" });
  assert.equal(resolveRemoteAuthorityBlockReason(state), null);
});

test("resolveRemoteAuthorityBlockReason returns null when placement is undefined", () => {
  const state = makeState({ placement: undefined });
  assert.equal(resolveRemoteAuthorityBlockReason(state), null);
});

test("resolveRemoteAuthorityBlockReason returns remote_session_viewer_only for viewer_only session", () => {
  const state = makeState({ remoteSessionStatus: "viewer_only" });
  assert.equal(resolveRemoteAuthorityBlockReason(state), "remote_session_viewer_only");
});

test("resolveRemoteAuthorityBlockReason returns remote_session_consistency_mismatch for mismatch status", () => {
  const state = makeState({ sessionConsistencyCheckStatus: "mismatch" });
  assert.equal(resolveRemoteAuthorityBlockReason(state), "remote_session_consistency_mismatch");
});

test("resolveRemoteAuthorityBlockReason returns remote_workspace_sync_conflict for conflict status", () => {
  const state = makeState({ workspaceSyncStatus: "conflict" });
  assert.equal(resolveRemoteAuthorityBlockReason(state), "remote_workspace_sync_conflict");
});

test("resolveRemoteAuthorityBlockReason returns remote_session_resume_offset_missing when offset is null", () => {
  const state = makeState({ lastAcknowledgedStreamOffset: null, remoteSessionStatus: "connected" });
  assert.equal(resolveRemoteAuthorityBlockReason(state), "remote_session_resume_offset_missing");
});

test("resolveRemoteAuthorityBlockReason returns remote_session_resume_offset_missing when offset is empty string", () => {
  const state = makeState({ lastAcknowledgedStreamOffset: "", remoteSessionStatus: "connected" });
  assert.equal(resolveRemoteAuthorityBlockReason(state), "remote_session_resume_offset_missing");
});

test("resolveRemoteAuthorityBlockReason returns remote_session_resume_offset_missing when offset is whitespace only", () => {
  const state = makeState({ lastAcknowledgedStreamOffset: "   ", remoteSessionStatus: "connected" });
  assert.equal(resolveRemoteAuthorityBlockReason(state), "remote_session_resume_offset_missing");
});

test("resolveRemoteAuthorityBlockReason returns null when offset is valid", () => {
  const state = makeState({ lastAcknowledgedStreamOffset: "valid_offset", remoteSessionStatus: "connected" });
  assert.equal(resolveRemoteAuthorityBlockReason(state), null);
});

test("resolveRemoteAuthorityBlockReason returns null for connecting status (transitional)", () => {
  const state = makeState({ remoteSessionStatus: "connecting", lastAcknowledgedStreamOffset: null });
  assert.equal(resolveRemoteAuthorityBlockReason(state), null);
});

test("resolveRemoteAuthorityBlockReason returns null for failed status (transitional)", () => {
  const state = makeState({ remoteSessionStatus: "failed", lastAcknowledgedStreamOffset: null });
  assert.equal(resolveRemoteAuthorityBlockReason(state), null);
});

test("resolveRemoteAuthorityBlockReason returns null when all conditions are satisfied", () => {
  const state = makeState({
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset_123",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
  });
  assert.equal(resolveRemoteAuthorityBlockReason(state), null);
});

test("resolveRemoteAuthorityBlockReason priority: viewer_only takes precedence over offset missing", () => {
  const state = makeState({ remoteSessionStatus: "viewer_only", lastAcknowledgedStreamOffset: null });
  assert.equal(resolveRemoteAuthorityBlockReason(state), "remote_session_viewer_only");
});

test("resolveRemoteAuthorityBlockReason priority: consistency mismatch takes precedence over offset missing", () => {
  const state = makeState({ sessionConsistencyCheckStatus: "mismatch", lastAcknowledgedStreamOffset: null });
  assert.equal(resolveRemoteAuthorityBlockReason(state), "remote_session_consistency_mismatch");
});

test("resolveRemoteAuthorityBlockReason priority: workspace conflict takes precedence over offset missing", () => {
  const state = makeState({ workspaceSyncStatus: "conflict", lastAcknowledgedStreamOffset: null });
  assert.equal(resolveRemoteAuthorityBlockReason(state), "remote_workspace_sync_conflict");
});
