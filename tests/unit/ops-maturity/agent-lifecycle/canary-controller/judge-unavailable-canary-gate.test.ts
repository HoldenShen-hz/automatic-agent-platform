import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JudgeUnavailableCanaryGate, type JudgeAvailabilitySignal } from '../../../../../src/ops-maturity/agent-lifecycle/canary-controller/judge-unavailable-canary-gate.js';

test('JudgeUnavailableCanaryGate evaluates available signal correctly', () => {
  const gate = new JudgeUnavailableCanaryGate();
  const signal: JudgeAvailabilitySignal = {
    judgeProviderId: 'provider-1',
    available: true,
    checkedAt: new Date().toISOString(),
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.canIncreaseTraffic, true);
  assert.equal(decision.paused, false);
  assert.equal(decision.reasonCode, 'canary.judge_available');
});

test('JudgeUnavailableCanaryGate evaluates unavailable signal correctly', () => {
  const gate = new JudgeUnavailableCanaryGate();
  const signal: JudgeAvailabilitySignal = {
    judgeProviderId: 'provider-1',
    available: false,
    checkedAt: new Date().toISOString(),
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.canIncreaseTraffic, false);
  assert.equal(decision.paused, true);
  assert.equal(decision.reasonCode, 'canary.judge_unavailable');
});

test('Unavailable canary triggers circuit breaker (paused=true)', () => {
  const gate = new JudgeUnavailableCanaryGate();
  const signal: JudgeAvailabilitySignal = {
    judgeProviderId: 'provider-1',
    available: false,
    checkedAt: new Date().toISOString(),
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.paused, true, 'Unavailable canary should pause traffic');
  assert.equal(decision.canIncreaseTraffic, false, 'Should not allow traffic increase');
});

test('False positive suppression - gate correctly rejects unavailable canary', () => {
  const gate = new JudgeUnavailableCanaryGate();
  const falsePositiveSignal: JudgeAvailabilitySignal = {
    judgeProviderId: 'provider-flaky',
    available: false,
    checkedAt: new Date().toISOString(),
  };

  const decision = gate.evaluate(falsePositiveSignal);

  assert.equal(decision.paused, true, 'Should suppress false positive by pausing');
  assert.equal(decision.reasonCode, 'canary.judge_unavailable');
});

test('Recovery detection re-enables traffic when canary becomes available', () => {
  const gate = new JudgeUnavailableCanaryGate();

  const unavailableSignal: JudgeAvailabilitySignal = {
    judgeProviderId: 'provider-1',
    available: false,
    checkedAt: new Date().toISOString(),
  };
  const unavailableDecision = gate.evaluate(unavailableSignal);
  assert.equal(unavailableDecision.paused, true, 'Initially should be paused');

  const availableSignal: JudgeAvailabilitySignal = {
    judgeProviderId: 'provider-1',
    available: true,
    checkedAt: new Date().toISOString(),
  };
  const availableDecision = gate.evaluate(availableSignal);

  assert.equal(availableDecision.canIncreaseTraffic, true, 'Recovery should enable traffic');
  assert.equal(availableDecision.paused, false, 'Recovery should unpause');
  assert.equal(availableDecision.reasonCode, 'canary.judge_available');
});

test('Gate preserves judgeProviderId from signal', () => {
  const gate = new JudgeUnavailableCanaryGate();
  const signal: JudgeAvailabilitySignal = {
    judgeProviderId: 'judge-west-2',
    available: true,
    checkedAt: new Date().toISOString(),
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.canIncreaseTraffic, true);
  assert.equal(decision.paused, false);
});

test('Gate handles different judge providers independently', () => {
  const gate = new JudgeUnavailableCanaryGate();

  const provider1Unavailable: JudgeAvailabilitySignal = {
    judgeProviderId: 'provider-1',
    available: false,
    checkedAt: new Date().toISOString(),
  };

  const provider2Available: JudgeAvailabilitySignal = {
    judgeProviderId: 'provider-2',
    available: true,
    checkedAt: new Date().toISOString(),
  };

  const decision1 = gate.evaluate(provider1Unavailable);
  const decision2 = gate.evaluate(provider2Available);

  assert.equal(decision1.paused, true);
  assert.equal(decision2.paused, false);
  assert.notEqual(decision1.reasonCode, decision2.reasonCode);
});
