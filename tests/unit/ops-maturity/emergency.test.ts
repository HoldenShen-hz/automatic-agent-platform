import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlatformPanicService, type PanicActivationRequest } from '../../../../src/ops-maturity/emergency/platform-panic-service.js';
import { shouldEnterPanicMode } from '../../../../src/ops-maturity/emergency/panic-controller/index.js';
import { canResumeFromPanic, type ResumePlan } from '../../../../src/ops-maturity/emergency/resume-protocol/index.js';
import { buildForensicSnapshot } from '../../../../src/ops-maturity/emergency/forensic-snapshot/index.js';

test('shouldEnterPanicMode returns true when activeIncidents > 0', () => {
  const result = shouldEnterPanicMode({
    scope: 'platform:prod',
    reasonCode: 'system_overload',
    activeIncidents: 1,
  });
  assert.equal(result, true);
});

test('shouldEnterPanicMode returns true when reasonCode starts with security', () => {
  const result = shouldEnterPanicMode({
    scope: 'platform:prod',
    reasonCode: 'security.breach.detected',
    activeIncidents: 0,
  });
  assert.equal(result, true);
});

test('shouldEnterPanicMode returns false for normal operations', () => {
  const result = shouldEnterPanicMode({
    scope: 'platform:prod',
    reasonCode: 'scheduled_maintenance',
    activeIncidents: 0,
  });
  assert.equal(result, false);
});

test('canResumeFromPanic requires minimum 2 approvers', () => {
  const plan: ResumePlan = {
    scope: 'platform:prod',
    approvedBy: ['admin1'],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  assert.equal(canResumeFromPanic(plan), false);
});

test('canResumeFromPanic requires platform_admin role', () => {
  const plan: ResumePlan = {
    scope: 'platform:prod',
    approvedBy: ['user1', 'user2'],
    approvedRoles: ['viewer', 'editor'], // no platform_admin
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  assert.equal(canResumeFromPanic(plan), false);
});

test('canResumeFromPanic accepts with platform_admin and security_team', () => {
  const plan: ResumePlan = {
    scope: 'platform:prod',
    approvedBy: ['admin1', 'security1'],
    approvedRoles: ['platform_admin', 'security_team'],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  assert.equal(canResumeFromPanic(plan), true);
});

test('canResumeFromPanic accepts with 2 platform_admins', () => {
  const plan: ResumePlan = {
    scope: 'platform:prod',
    approvedBy: ['admin1', 'admin2'],
    approvedRoles: ['platform_admin', 'platform_admin'],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  assert.equal(canResumeFromPanic(plan), true);
});

test('canResumeFromPanic rejects if checkpoints not verified', () => {
  const plan: ResumePlan = {
    scope: 'platform:prod',
    approvedBy: ['admin1', 'admin2'],
    approvedRoles: ['platform_admin', 'platform_admin'],
    checkpointsVerified: false,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  assert.equal(canResumeFromPanic(plan), false);
});

test('canResumeFromPanic trims and deduplicates approvers', () => {
  const plan: ResumePlan = {
    scope: 'platform:prod',
    approvedBy: ['  admin1  ', 'admin1', '  security1 '],
    approvedRoles: ['platform_admin', 'security_team'],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  // Should work: 1 unique platform_admin + security_team = valid
  assert.equal(canResumeFromPanic(plan), true);
});

test('PlatformPanicService activates panic directive', () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: 'platform:prod',
    reasonCode: 'security.breach',
    activeIncidents: 3,
    issuedBy: 'admin1',
    freezeModes: ['deploy', 'automation'],
  };

  const activation = service.activate(request);

  assert.ok(activation.directive.directiveId.startsWith('panic-'));
  assert.equal(activation.directive.scope, 'platform:prod');
  assert.equal(activation.directive.reasonCode, 'security.breach');
  assert.equal(activation.directive.severity, 'full');
  assert.equal(activation.acknowledgments.length, 5); // P1-P5
  assert.ok(activation.forensicSnapshot.snapshotId.startsWith('panic_snapshot-'));
});

test('PlatformPanicService requires minimum 2 approvers', () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: 'platform:prod',
    reasonCode: 'system_overload',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1'], // only one
  };

  assert.throws(() => service.activate(request), /panic.required_approvers_minimum_not_met/);
});

test('PlatformPanicService rejects invalid scope level', () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: 'invalid:scope:level',
    reasonCode: 'test',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
  };

  assert.throws(() => service.activate(request), /panic.invalid_scope_level/);
});

test('PlatformPanicService evaluates execution blocked by freeze mode', () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: 'platform:prod',
    reasonCode: 'security.breach',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
  };
  service.activate(request);

  const decision = service.evaluateExecution({
    scope: 'platform:prod',
    mode: 'deploy',
  });

  assert.equal(decision.blocked, true);
  assert.ok(decision.directiveId != null);
  assert.ok(decision.reasonCodes.includes('panic.execution_blocked'));
});

test('PlatformPanicService evaluates execution not blocked when mode not frozen', () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: 'platform:prod',
    reasonCode: 'security.breach',
    activeIncidents: 1,
    issuedBy: 'admin1',
    freezeModes: ['deploy', 'automation'],
    requiredApprovers: ['admin1', 'admin2'],
  };
  service.activate(request);

  const decision = service.evaluateExecution({
    scope: 'platform:prod',
    mode: 'write', // 'write' is not in freeze modes
  });

  assert.equal(decision.blocked, false);
  assert.ok(decision.reasonCodes.includes('panic.mode_not_frozen'));
});

test('PlatformPanicService allows actor in allowList', () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: 'platform:prod',
    reasonCode: 'security.breach',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
    allowList: ['bypass-actor-id'],
  };
  service.activate(request);

  const decision = service.evaluateExecution({
    scope: 'platform:prod',
    mode: 'deploy',
    actorId: 'bypass-actor-id',
  });

  assert.equal(decision.blocked, false);
  assert.ok(decision.reasonCodes.includes('panic.allow_list_bypass'));
});

test('PlatformPanicService resumes from panic with valid plan', () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: 'platform:prod',
    reasonCode: 'security.breach',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
  };
  service.activate(request);

  const plan: ResumePlan = {
    scope: 'platform:prod',
    approvedBy: ['admin1', 'admin2'],
    approvedRoles: ['platform_admin', 'platform_admin'],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const receipt = service.resume('platform:prod', plan);

  assert.equal(receipt.resumed, true);
  assert.ok(receipt.resumedAt != null);
  assert.ok(receipt.directiveId != null);
});

test('PlatformPanicService cannot resume without valid plan', () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: 'platform:prod',
    reasonCode: 'security.breach',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
  };
  service.activate(request);

  const plan: ResumePlan = {
    scope: 'platform:prod',
    approvedBy: ['user1'], // insufficient
    checkpointsVerified: false, // not verified
  };

  const receipt = service.resume('platform:prod', plan);

  assert.equal(receipt.resumed, false);
  assert.ok(receipt.reasonCodes.includes('panic.resume_checkpoints_incomplete'));
});

test('PlatformPanicService lists active directives sorted by scope', () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: 'platform:zone-b',
    reasonCode: 'security.breach',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
  });
  service.activate({
    scope: 'platform:zone-a',
    reasonCode: 'security.breach',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
  });

  const active = service.listActive();

  assert.equal(active.length, 2);
  assert.ok(active[0].directive.scope < active[1].directive.scope); // sorted alphabetically
});

test('PlatformPanicService propagates to target scopes', () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: 'platform:prod',
    reasonCode: 'security.breach',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
    targetScopes: ['platform:prod', 'platform:prod:us-east'],
  };
  service.activate(request);

  // Direct scope
  const direct = service.getActive('platform:prod');
  assert.ok(direct != null);

  // Inherited scope
  const inherited = service.getActive('platform:prod:us-east');
  assert.ok(inherited != null);

  // Unrelated scope
  const unrelated = service.getActive('platform:staging');
  assert.equal(unrelated, null);
});

test('PlatformPanicService resolves most specific scope match', () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: 'platform',
    reasonCode: 'security.breach',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
  });
  service.activate({
    scope: 'platform:prod',
    reasonCode: 'system_failure',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
    freezeModes: ['deploy', 'write'],
  });

  const match = service.getActive('platform:prod:us-east-1');

  // Should match the more specific 'platform:prod' directive
  assert.ok(match != null);
  assert.equal(match!.directive.scopeLevel, 'platform');
  assert.equal(match!.directive.reasonCode, 'system_failure');
});

test('PlatformPanicService stores and retrieves resume receipt', () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: 'platform:prod',
    reasonCode: 'security.breach',
    activeIncidents: 1,
    issuedBy: 'admin1',
    requiredApprovers: ['admin1', 'admin2'],
  };
  service.activate(request);

  const plan: ResumePlan = {
    scope: 'platform:prod',
    approvedBy: ['admin1', 'admin2'],
    approvedRoles: ['platform_admin', 'platform_admin'],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  service.resume('platform:prod', plan);
  const receipt = service.getResumeReceipt('platform:prod');

  assert.ok(receipt != null);
  assert.equal(receipt!.resumed, true);
});

test('buildForensicSnapshot creates snapshot with all fields', () => {
  const snapshot = buildForensicSnapshot({
    snapshotId: 'snap-001',
    scope: 'platform:prod',
    collectedAt: '2026-04-29T00:00:00Z',
    artifactIds: ['art1', 'art2'],
    runtimeState: { severity: 'high' },
    planeAcknowledgments: [
      { plane: 'P1', localStopState: 'ack', evidenceRef: 'p1-ev' },
    ],
  });

  assert.equal(snapshot.snapshotId, 'snap-001');
  assert.equal(snapshot.scope, 'platform:prod');
  assert.equal(snapshot.artifactIds.length, 2);
  assert.deepEqual(snapshot.runtimeState, { severity: 'high' });
  assert.equal(snapshot.planeAcknowledgments.length, 1);
});

test('buildForensicSnapshot handles missing optional fields', () => {
  const snapshot = buildForensicSnapshot({
    snapshotId: 'snap-002',
    scope: 'platform:staging',
    collectedAt: '2026-04-29T00:00:00Z',
    artifactIds: [],
  });

  assert.deepEqual(snapshot.runtimeState, {});
  assert.equal(snapshot.configurationRefs.length, 0);
  assert.equal(snapshot.logRefs.length, 0);
  assert.equal(snapshot.planeAcknowledgments.length, 0);
});