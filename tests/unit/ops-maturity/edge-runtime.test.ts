import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EdgeRuntimeSyncService, type EdgeRuntimeProfile, type OfflineExecutionRequest } from '../../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js';
import { buildOfflineExecutionRecord } from '../../../../src/ops-maturity/edge-runtime/edge-executor/index.js';
import { buildEdgeExecutionPlan } from '../../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js';
import { selectEdgeLocalModel, type LocalModelProfile } from '../../../../src/ops-maturity/edge-runtime/local-model/index.js';
import { orderEdgeSyncQueue, dedupeEdgeSyncQueue, type EdgeSyncEnvelope } from '../../../../src/ops-maturity/edge-runtime/sync-queue/index.js';
import { createHash } from 'node:crypto';

function makeProfile(overrides: Partial<EdgeRuntimeProfile> = {}): EdgeRuntimeProfile {
  return {
    edgeNodeId: 'edge-node-1',
    deviceId: 'device-001',
    capabilities: ['offline_execution', 'sync'],
    connectivityMode: 'offline',
    maxLocalRetentionHours: 72,
    offlineMaxDuration: 3600,
    keyLease: 'lease-key-123',
    allowedModels: ['model-a', 'model-b'],
    syncPolicy: {
      allowRestrictedDataUpload: false,
      requireOrdering: true,
    },
    riskLevel: 'low',
    ...overrides,
  };
}

function makeModel(id: string, modalities: string[], priority = 0): LocalModelProfile {
  return { modelId: id, modalities, priority };
}

test('EdgeRuntimeSyncService.executeOffline requires low or medium risk', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile({ riskLevel: 'high' });
  const models: LocalModelProfile[] = [makeModel('model-a', ['text'])];

  assert.throws(
    () => service.executeOffline(profile, models, { edgeNodeId: 'edge-1', taskId: 'task-1', modality: 'text' }),
    /edge_runtime.risk_level_not_allowed/,
  );
});

test('EdgeRuntimeSyncService.executeOffline requires profile fields', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile({ deviceId: undefined });
  const models: LocalModelProfile[] = [];

  assert.throws(
    () => service.executeOffline(profile, models, { edgeNodeId: 'edge-1', taskId: 'task-1', modality: 'text' }),
    /edge_runtime.missing_required_profile_fields/,
  );
});

test('EdgeRuntimeSyncService.executeOffline selects model by modality', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile();
  const models: LocalModelProfile[] = [
    makeModel('model-text', ['text'], 1),
    makeModel('model-image', ['image'], 2),
  ];

  const result = service.executeOffline(profile, models, {
    edgeNodeId: 'edge-1',
    taskId: 'task-1',
    modality: 'text',
  });

  assert.equal(result.selectedModelId, 'model-text');
  assert.ok(result.record.taskId === 'task-1');
});

test('EdgeRuntimeSyncService.executeOffline returns null model when no match', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile();
  const models: LocalModelProfile[] = [makeModel('model-image', ['image'])];

  const result = service.executeOffline(profile, models, {
    edgeNodeId: 'edge-1',
    taskId: 'task-1',
    modality: 'audio', // not available
  });

  assert.equal(result.selectedModelId, null);
});

test('EdgeRuntimeSyncService.executeOffline respects allowedModels', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile({ allowedModels: ['allowed-model'] });
  const models: LocalModelProfile[] = [
    makeModel('allowed-model', ['text'], 1),
    makeModel('disallowed-model', ['text'], 2),
  ];

  const result = service.executeOffline(profile, models, {
    edgeNodeId: 'edge-1',
    taskId: 'task-1',
    modality: 'text',
  });

  assert.equal(result.selectedModelId, 'allowed-model');
});

test('EdgeRuntimeSyncService.buildSyncEnvelope creates valid envelope', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile();
  const record = buildOfflineExecutionRecord('edge-node-1', 'task-1', '2026-04-29T00:00:00Z');
  const payloadDigest = createHash('sha256').update('payload').digest('hex');

  const envelope = service.buildSyncEnvelope(profile, record, payloadDigest, 5, 'restricted');

  assert.ok(envelope.envelopeId.startsWith('sync-'));
  assert.equal(envelope.priority, 5);
  assert.equal(envelope.dataClassification, 'restricted');
  assert.equal(envelope.prevHash, null);
  assert.ok(envelope.signature.length > 0);
});

test('EdgeRuntimeSyncService.buildSyncEnvelope uses provided prevHash', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile();
  const record = buildOfflineExecutionRecord('edge-node-1', 'task-1', '2026-04-29T00:00:00Z');

  const envelope = service.buildSyncEnvelope(
    profile,
    record,
    'digest',
    1,
    'internal',
    '2026-04-29T00:00:00Z',
    'previous-hash-123',
  );

  assert.equal(envelope.prevHash, 'previous-hash-123');
});

test('EdgeRuntimeSyncService.sync accepts valid envelopes', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile({ syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false } });
  const record = buildOfflineExecutionRecord('edge-node-1', 'task-1', '2026-04-29T00:00:00Z');
  const payloadDigest = createHash('sha256').update('payload').digest('hex');
  const envelope = service.buildSyncEnvelope(profile, record, payloadDigest);

  const receipt = service.sync(profile, [envelope], {});

  assert.ok(receipt.acceptedEnvelopeIds.includes(envelope.envelopeId));
  assert.equal(receipt.rejectedEnvelopeIds.length, 0);
});

test('EdgeRuntimeSyncService.sync rejects restricted data when not allowed', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile({ syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false } });
  const record = buildOfflineExecutionRecord('edge-node-1', 'task-1', '2026-04-29T00:00:00Z');
  const envelope = service.buildSyncEnvelope(profile, record, 'digest', 1, 'restricted');

  const receipt = service.sync(profile, [envelope], {});

  assert.equal(receipt.acceptedEnvelopeIds.length, 0);
  assert.ok(receipt.rejectedEnvelopeIds.includes(envelope.envelopeId));
  assert.ok(receipt.decisions[0].rationale.includes('restricted_data_denied'));
});

test('EdgeRuntimeSyncService.sync rejects invalid signatures', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile({ syncPolicy: { allowRestrictedDataUpload: true, requireOrdering: false } });
  const record = buildOfflineExecutionRecord('edge-node-1', 'task-1', '2026-04-29T00:00:00Z');
  const envelope = service.buildSyncEnvelope(profile, record, 'digest');
  // Tamper with signature
  const tamperedEnvelope = { ...envelope, signature: 'invalid-signature' };

  const receipt = service.sync(profile, [tamperedEnvelope], {});

  assert.ok(receipt.rejectedEnvelopeIds.includes(envelope.envelopeId));
  assert.ok(receipt.decisions[0].rationale.includes('signature_invalid'));
});

test('EdgeRuntimeSyncService.sync handles central wins policy', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile({ syncPolicy: { allowRestrictedDataUpload: true, requireOrdering: false } });
  const record = buildOfflineExecutionRecord('edge-node-1', 'task-1', '2026-04-29T00:00:00Z');
  const envelope = service.buildSyncEnvelope(profile, record, 'edge-digest');

  // Cloud has different digest
  const receipt = service.sync(profile, [envelope], { [envelope.recordId]: 'cloud-digest' });

  assert.ok(receipt.rejectedEnvelopeIds.includes(envelope.envelopeId));
  const decision = receipt.decisions[0];
  assert.equal(decision.resolution, 'accept_central');
  assert.ok(decision.incidentId != null);
});

test('EdgeRuntimeSyncService.sync respects ordering when required', () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeProfile({ syncPolicy: { allowRestrictedDataUpload: true, requireOrdering: true } });

  const record1 = buildOfflineExecutionRecord('edge-node-1', 'task-1', '2026-04-29T00:00:00Z');
  const record2 = buildOfflineExecutionRecord('edge-node-1', 'task-2', '2026-04-29T00:00:01Z');
  const record3 = buildOfflineExecutionRecord('edge-node-1', 'task-3', '2026-04-29T00:00:02Z');

  const envelopes = [
    service.buildSyncEnvelope(profile, record1, 'd1', 1),
    service.buildSyncEnvelope(profile, record2, 'd2', 10), // higher priority
    service.buildSyncEnvelope(profile, record3, 'd3', 5),
  ];

  const receipt = service.sync(profile, envelopes, {});

  // Should process in priority order (highest first)
  assert.equal(receipt.acceptedEnvelopeIds.length, 3);
});

test('buildOfflineExecutionRecord creates correct structure', () => {
  const record = buildOfflineExecutionRecord('edge-1', 'task-1', '2026-04-29T00:00:00Z');

  assert.equal(record.edgeNodeId, 'edge-1');
  assert.equal(record.taskId, 'task-1');
  assert.equal(record.createdAt, '2026-04-29T00:00:00Z');
  assert.equal(record.syncRequired, true);
  assert.equal(record.status, 'queued');
});

test('buildEdgeExecutionPlan creates ordered plan', () => {
  const plan = buildEdgeExecutionPlan(['task-3', 'task-1', 'task-2'], 'high');

  assert.deepEqual(plan.orderedTaskIds, ['task-3', 'task-1', 'task-2']);
  assert.equal(plan.priority, 'high');
  assert.equal(plan.syncRequired, true);
});

test('selectEdgeLocalModel filters by modality and sorts by priority', () => {
  const models: LocalModelProfile[] = [
    makeModel('model-low', ['text'], 1),
    makeModel('model-high', ['text'], 10),
    makeModel('model-image', ['image'], 5),
  ];

  const selected = selectEdgeLocalModel(models, 'text');

  assert.equal(selected!.modelId, 'model-high');
});

test('selectEdgeLocalModel returns null when no match', () => {
  const models: LocalModelProfile[] = [makeModel('model-text', ['text'])];

  const selected = selectEdgeLocalModel(models, 'audio');

  assert.equal(selected, null);
});

test('selectEdgeLocalModel handles empty array', () => {
  const selected = selectEdgeLocalModel([], 'text');

  assert.equal(selected, null);
});

test('orderEdgeSyncQueue sorts by priority then time', () => {
  const envelopes: EdgeSyncEnvelope[] = [
    { envelopeId: 'e1', priority: 1, createdAt: '2026-04-29T00:00:02Z' },
    { envelopeId: 'e2', priority: 10, createdAt: '2026-04-29T00:00:00Z' },
    { envelopeId: 'e3', priority: 5, createdAt: '2026-04-29T00:00:01Z' },
  ];

  const ordered = orderEdgeSyncQueue(envelopes);

  assert.equal(ordered[0].envelopeId, 'e2'); // highest priority
  assert.equal(ordered[1].envelopeId, 'e3'); // middle priority
  assert.equal(ordered[2].envelopeId, 'e1'); // lowest priority
});

test('orderEdgeSyncQueue handles missing createdAt', () => {
  const envelopes: EdgeSyncEnvelope[] = [
    { envelopeId: 'e1', priority: 1 },
    { envelopeId: 'e2', priority: 2 },
  ];

  const ordered = orderEdgeSyncQueue(envelopes);

  assert.equal(ordered[0].envelopeId, 'e2'); // higher priority
  assert.equal(ordered[1].envelopeId, 'e1');
});

test('dedupeEdgeSyncQueue keeps latest by envelopeId', () => {
  const envelopes: EdgeSyncEnvelope[] = [
    { envelopeId: 'e1', priority: 1, createdAt: '2026-04-29T00:00:01Z' },
    { envelopeId: 'e1', priority: 2, createdAt: '2026-04-29T00:00:02Z' }, // duplicate
    { envelopeId: 'e2', priority: 1, createdAt: '2026-04-29T00:00:00Z' },
  ];

  const deduped = dedupeEdgeSyncQueue(envelopes);

  assert.equal(deduped.length, 2);
  // e1 should be the one with higher priority
  const e1 = deduped.find((e) => e.envelopeId === 'e1');
  assert.equal(e1!.priority, 2);
});