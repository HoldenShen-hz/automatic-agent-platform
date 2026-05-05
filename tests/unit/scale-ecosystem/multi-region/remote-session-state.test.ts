/**
 * Remote Session State Unit Tests
 *
 * Tests for remote-session-state.ts - Issue #2203:
 * failed sessions must not jump directly back to connected
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  transitionRemoteSessionState,
  type RemoteSessionState,
} from "../../../../src/scale-ecosystem/multi-region/remote-session-state.js";

// ─────────────────────────────────────────────────────────────────────────────
// Remote Session State Transition Tests - Issue #2203
// ─────────────────────────────────────────────────────────────────────────────

// Issue #2203: a failed session must not silently jump back to connected.
// Recovery has to go through connecting first so the session performs a new handshake.

test("remote-session-state: connected signal returns connected from any state except failed", () => {
  // From connecting -> connected
  assert.equal(
    transitionRemoteSessionState("connecting", "connected"),
    "connected"
  );

  // From reconnecting -> connected
  assert.equal(
    transitionRemoteSessionState("reconnecting", "connected"),
    "connected"
  );

  // From degraded -> connected
  assert.equal(
    transitionRemoteSessionState("degraded", "connected"),
    "connected"
  );

  // From viewer_only -> connected
  assert.equal(
    transitionRemoteSessionState("viewer_only", "connected"),
    "connected"
  );
});

test("remote-session-state: failed + connected signal re-enters connecting instead of silently clearing failure", () => {
  const result = transitionRemoteSessionState("failed", "connected");

  assert.equal(
    result,
    "connecting",
    "failed sessions should re-enter connecting before they can become connected again",
  );
});

test("remote-session-state: connection_lost transitions correctly from non-failed states", () => {
  // From connecting -> reconnecting
  assert.equal(
    transitionRemoteSessionState("connecting", "connection_lost"),
    "reconnecting"
  );

  // From connected -> reconnecting
  assert.equal(
    transitionRemoteSessionState("connected", "connection_lost"),
    "reconnecting"
  );

  // From degraded -> reconnecting
  assert.equal(
    transitionRemoteSessionState("degraded", "connection_lost"),
    "reconnecting"
  );

  // From viewer_only -> reconnecting
  assert.equal(
    transitionRemoteSessionState("viewer_only", "connection_lost"),
    "reconnecting"
  );
});

test("remote-session-state: connection_lost from failed stays failed", () => {
  // From failed -> connection_lost should stay failed
  assert.equal(
    transitionRemoteSessionState("failed", "connection_lost"),
    "failed"
  );
});

test("remote-session-state: partial_sync transitions to degraded", () => {
  assert.equal(
    transitionRemoteSessionState("connecting", "partial_sync"),
    "degraded"
  );

  assert.equal(
    transitionRemoteSessionState("connected", "partial_sync"),
    "degraded"
  );

  assert.equal(
    transitionRemoteSessionState("reconnecting", "partial_sync"),
    "degraded"
  );

  assert.equal(
    transitionRemoteSessionState("viewer_only", "partial_sync"),
    "degraded"
  );
});

test("remote-session-state: hard_failure transitions to failed", () => {
  assert.equal(
    transitionRemoteSessionState("connecting", "hard_failure"),
    "failed"
  );

  assert.equal(
    transitionRemoteSessionState("connected", "hard_failure"),
    "failed"
  );

  assert.equal(
    transitionRemoteSessionState("reconnecting", "hard_failure"),
    "failed"
  );

  assert.equal(
    transitionRemoteSessionState("degraded", "hard_failure"),
    "failed"
  );

  assert.equal(
    transitionRemoteSessionState("viewer_only", "hard_failure"),
    "failed"
  );

  // Already failed stays failed
  assert.equal(
    transitionRemoteSessionState("failed", "hard_failure"),
    "failed"
  );
});

test("remote-session-state: viewer_mode transitions to viewer_only", () => {
  assert.equal(
    transitionRemoteSessionState("connecting", "viewer_mode"),
    "viewer_only"
  );

  assert.equal(
    transitionRemoteSessionState("connected", "viewer_mode"),
    "viewer_only"
  );

  assert.equal(
    transitionRemoteSessionState("reconnecting", "viewer_mode"),
    "viewer_only"
  );

  assert.equal(
    transitionRemoteSessionState("degraded", "viewer_mode"),
    "viewer_only"
  );

  assert.equal(
    transitionRemoteSessionState("failed", "viewer_mode"),
    "viewer_only"
  );
});

test("remote-session-state: unknown signal returns current state", () => {
  // Using undefined or any unknown signal should return current state
  const unknownSignal = "unknown_signal" as any;

  assert.equal(
    transitionRemoteSessionState("connecting", unknownSignal),
    "connecting"
  );

  assert.equal(
    transitionRemoteSessionState("connected", unknownSignal),
    "connected"
  );

  assert.equal(
    transitionRemoteSessionState("failed", unknownSignal),
    "failed"
  );
});

test("remote-session-state: all valid state values are covered", () => {
  const validStates: RemoteSessionState[] = [
    "connecting",
    "connected",
    "reconnecting",
    "degraded",
    "failed",
    "viewer_only",
  ];

  const validSignals = [
    "connected",
    "connection_lost",
    "partial_sync",
    "hard_failure",
    "viewer_mode",
  ] as const;

  // All combinations should be handled without throwing
  for (const state of validStates) {
    for (const signal of validSignals) {
      const result = transitionRemoteSessionState(state, signal);
      assert.ok(
        validStates.includes(result),
        `Transition from ${state} with ${signal} should return valid state, got ${result}`
      );
    }
  }
});

test("remote-session-state: recovery path from failed to connected", () => {
  // Recovery is a two-step handshake: failed -> connecting -> connected.
  let state: RemoteSessionState = "failed";
  state = transitionRemoteSessionState(state, "connected");
  assert.equal(state, "connecting");
  state = transitionRemoteSessionState(state, "connected");
  assert.equal(state, "connected");
});
