import assert from "node:assert/strict";
import test from "node:test";

import {
  createRecoveryCadence,
  nextPhase,
  type RecoveryCadence,
  type RecoveryCadencePhase,
  type RecoveryCadencePhaseConfig,
} from "../../../../../src/platform/five-plane-execution/recovery/recovery-cadence.js";

test("RecoveryCadencePhase type accepts all valid phases [recovery-cadence]", () => {
  const phases: RecoveryCadencePhase[] = [
    "immediate_retry",
    "backoff_retry",
    "reassign_retry",
    "dead_letter",
    "escalate",
  ];
  assert.equal(phases.length, 5);
});

test("RecoveryCadencePhaseConfig interface structure [recovery-cadence]", () => {
  const config: RecoveryCadencePhaseConfig = {
    phase: "immediate_retry",
    maxAttempts: 2,
    intervalMs: 0,
    action: "resume_same_worker",
  };

  assert.equal(config.phase, "immediate_retry");
  assert.equal(config.maxAttempts, 2);
  assert.equal(config.intervalMs, 0);
  assert.equal(config.action, "resume_same_worker");
});

test("RecoveryCadence interface structure [recovery-cadence]", () => {
  const phases: RecoveryCadencePhaseConfig[] = [
    {
      phase: "immediate_retry",
      maxAttempts: 2,
      intervalMs: 0,
      action: "resume_same_worker",
    },
  ];
  const cadence: RecoveryCadence = {
    phases,
    totalMaxAttempts: 5,
    escalateAfterAttempts: 3,
  };

  assert.equal(cadence.phases.length, 1);
  assert.equal(cadence.totalMaxAttempts, 5);
  assert.equal(cadence.escalateAfterAttempts, 3);
});

test("createRecoveryCadence with default configuration [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  assert.equal(cadence.phases.length, 4);
  assert.equal(cadence.totalMaxAttempts, 10);
  assert.equal(cadence.escalateAfterAttempts, 8);
});

test("createRecoveryCadence first phase is immediate_retry [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const firstPhase = cadence.phases[0];
  assert.equal(firstPhase.phase, "immediate_retry");
  assert.equal(firstPhase.maxAttempts, 2);
  assert.equal(firstPhase.intervalMs, 0);
  assert.equal(firstPhase.action, "resume_same_worker");
});

test("createRecoveryCadence second phase is backoff_retry [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const secondPhase = cadence.phases[1];
  assert.equal(secondPhase.phase, "backoff_retry");
  assert.equal(secondPhase.maxAttempts, 3); // 5 - 2
  assert.equal(secondPhase.intervalMs, 1000); // MS_PER_SECOND
  assert.equal(secondPhase.action, "retry_new_ticket");
});

test("createRecoveryCadence third phase is dead_letter [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const thirdPhase = cadence.phases[2];
  assert.equal(thirdPhase.phase, "dead_letter");
  assert.equal(thirdPhase.maxAttempts, 3); // 8 - 5
  assert.equal(thirdPhase.intervalMs, 5000); // FIVE_SECONDS_MS
  assert.equal(thirdPhase.action, "move_dead_letter");
});

test("createRecoveryCadence fourth phase is escalate [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const fourthPhase = cadence.phases[3];
  assert.equal(fourthPhase.phase, "escalate");
  assert.equal(fourthPhase.maxAttempts, Number.MAX_SAFE_INTEGER);
  assert.equal(fourthPhase.intervalMs, 0);
  assert.equal(fourthPhase.action, "escalate_takeover");
});

test("createRecoveryCadence with zero retryNewTicketMaxAttempts [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 0,
    escalateTakeoverMinAttempts: 5,
    moveToDeadLetterMinAttempts: 3,
  });

  // backoff_retry maxAttempts should be Math.max(0, 0 - 2) = 0
  const secondPhase = cadence.phases[1];
  assert.equal(secondPhase.maxAttempts, 0);
});

test("createRecoveryCadence when retryNewTicketMaxAttempts less than resumeSameWorkerMaxAttempts [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 5,
    retryNewTicketMaxAttempts: 3,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  // backoff_retry maxAttempts should be Math.max(0, 3 - 5) = 0
  const secondPhase = cadence.phases[1];
  assert.equal(secondPhase.maxAttempts, 0);
});

test("createRecoveryCadence with same values for all thresholds [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 3,
    retryNewTicketMaxAttempts: 3,
    escalateTakeoverMinAttempts: 3,
    moveToDeadLetterMinAttempts: 3,
  });

  // dead_letter maxAttempts should be 3 - 3 = 0
  const thirdPhase = cadence.phases[2];
  assert.equal(thirdPhase.maxAttempts, 0);
});

test("nextPhase returns next phase when not at end [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const next = nextPhase(cadence, 0);

  assert.notEqual(next, null);
  assert.equal(next!.phase, "backoff_retry");
  assert.equal(next!.action, "retry_new_ticket");
});

test("nextPhase returns second next phase from index 1 [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const next = nextPhase(cadence, 1);

  assert.notEqual(next, null);
  assert.equal(next!.phase, "dead_letter");
  assert.equal(next!.action, "move_dead_letter");
});

test("nextPhase returns third next phase from index 2 [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const next = nextPhase(cadence, 2);

  assert.notEqual(next, null);
  assert.equal(next!.phase, "escalate");
  assert.equal(next!.action, "escalate_takeover");
});

test("nextPhase returns null when at last phase [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const next = nextPhase(cadence, 3);

  assert.equal(next, null);
});

test("nextPhase returns null when index exceeds phases [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const next = nextPhase(cadence, 10);

  assert.equal(next, null);
});

test("nextPhase returns null when index equals phases length minus one [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const next = nextPhase(cadence, cadence.phases.length - 1);

  assert.equal(next, null);
});

test("createRecoveryCadence totalMaxAttempts matches escalateTakeoverMinAttempts [recovery-cadence]", () => {
  const escalateTakeover = 10;
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: escalateTakeover,
    moveToDeadLetterMinAttempts: 8,
  });

  assert.equal(cadence.totalMaxAttempts, escalateTakeover);
});

test("createRecoveryCadence escalateAfterAttempts matches moveToDeadLetterMinAttempts [recovery-cadence]", () => {
  const moveToDeadLetter = 8;
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: moveToDeadLetter,
  });

  assert.equal(cadence.escalateAfterAttempts, moveToDeadLetter);
});

test("all phases have valid actions [recovery-cadence]", () => {
  const cadence = createRecoveryCadence({
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 5,
    escalateTakeoverMinAttempts: 10,
    moveToDeadLetterMinAttempts: 8,
  });

  const validActions = [
    "resume_same_worker",
    "retry_new_ticket",
    "move_dead_letter",
    "escalate_takeover",
    "cancel",
    "none",
  ];

  for (const phase of cadence.phases) {
    assert.ok(
      validActions.includes(phase.action),
      `Phase ${phase.phase} has invalid action: ${phase.action}`,
    );
  }
});
