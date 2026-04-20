import assert from "node:assert/strict";
import test from "node:test";

import { GatewayStorageAdapter } from "../../../../../src/platform/interface/channel-gateway/storage-adapter.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { GatewayTargetRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { GatewaySessionTargetCandidate } from "../../../../../src/platform/state-evidence/truth/sqlite/authoritative-task-store-types.js";

test("GatewayStorageAdapter implements GatewayStoragePort interface", () => {
  // Create a mock store
  const mockStore = {
    dispatch: {
      getGatewayTarget: (targetId: string) => null,
      listGatewayTargets: (limit: number, channel?: string): GatewayTargetRecord[] => [],
    },
    session: {
      upsertGatewayTarget: (target: GatewayTargetRecord) => { /* noop */ },
      listGatewaySessionTargetCandidates:
        (limit: number, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[] => [],
    },
  } as unknown as AuthoritativeTaskStore;

  const adapter = new GatewayStorageAdapter(mockStore);

  // Verify the adapter has the required methods
  assert.equal(typeof adapter.getGatewayTarget, "function");
  assert.equal(typeof adapter.upsertGatewayTarget, "function");
  assert.equal(typeof adapter.listGatewayTargets, "function");
  assert.equal(typeof adapter.listGatewaySessionTargetCandidates, "function");
});

test("GatewayStorageAdapter.getGatewayTarget delegates to store", () => {
  let calledWith: string | undefined;
  const mockStore = {
    dispatch: {
      getGatewayTarget: (targetId: string) => {
        calledWith = targetId;
        return null;
      },
      listGatewayTargets: (limit: number, channel?: string): GatewayTargetRecord[] => [],
    },
    session: {
      upsertGatewayTarget: (target: GatewayTargetRecord) => { /* noop */ },
      listGatewaySessionTargetCandidates:
        (limit: number, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[] => [],
    },
  } as unknown as AuthoritativeTaskStore;

  const adapter = new GatewayStorageAdapter(mockStore);
  const result = adapter.getGatewayTarget("target_abc");

  assert.equal(calledWith, "target_abc");
  assert.equal(result, null);
});

test("GatewayStorageAdapter.listGatewayTargets delegates to store with default limit", () => {
  let capturedLimit: number | undefined;
  let capturedChannel: string | undefined;
  const mockStore = {
    dispatch: {
      getGatewayTarget: (targetId: string) => null,
      listGatewayTargets: (limit: number, channel?: string): GatewayTargetRecord[] => {
        capturedLimit = limit;
        capturedChannel = channel;
        return [];
      },
    },
    session: {
      upsertGatewayTarget: (target: GatewayTargetRecord) => { /* noop */ },
      listGatewaySessionTargetCandidates:
        (limit: number, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[] => [],
    },
  } as unknown as AuthoritativeTaskStore;

  const adapter = new GatewayStorageAdapter(mockStore);
  adapter.listGatewayTargets(100, "test-channel");

  assert.equal(capturedLimit, 100);
  assert.equal(capturedChannel, "test-channel");
});

test("GatewayStorageAdapter.listGatewayTargets uses default limit of 100", () => {
  let capturedLimit: number | undefined;
  const mockStore = {
    dispatch: {
      getGatewayTarget: (targetId: string) => null,
      listGatewayTargets: (limit: number, channel?: string): GatewayTargetRecord[] => {
        capturedLimit = limit;
        return [];
      },
    },
    session: {
      upsertGatewayTarget: (target: GatewayTargetRecord) => { /* noop */ },
      listGatewaySessionTargetCandidates:
        (limit: number, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[] => [],
    },
  } as unknown as AuthoritativeTaskStore;

  const adapter = new GatewayStorageAdapter(mockStore);
  adapter.listGatewayTargets();

  assert.equal(capturedLimit, 100);
});

test("GatewayStorageAdapter.listGatewaySessionTargetCandidates delegates to store", () => {
  let capturedLimit: number | undefined;
  let capturedChannel: string | undefined;
  let capturedTenantId: string | null | undefined;
  const mockStore = {
    dispatch: {
      getGatewayTarget: (targetId: string) => null,
      listGatewayTargets: (limit: number, channel?: string): GatewayTargetRecord[] => [],
    },
    session: {
      upsertGatewayTarget: (target: GatewayTargetRecord) => { /* noop */ },
      listGatewaySessionTargetCandidates:
        (limit: number, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[] => {
          capturedLimit = limit;
          capturedChannel = channel;
          capturedTenantId = tenantId;
          return [];
        },
    },
  } as unknown as AuthoritativeTaskStore;

  const adapter = new GatewayStorageAdapter(mockStore);
  adapter.listGatewaySessionTargetCandidates(50, "channel-1", "tenant_abc");

  assert.equal(capturedLimit, 50);
  assert.equal(capturedChannel, "channel-1");
  assert.equal(capturedTenantId, "tenant_abc");
});

test("GatewayStorageAdapter.listGatewaySessionTargetCandidates uses default limit", () => {
  let capturedLimit: number | undefined;
  const mockStore = {
    dispatch: {
      getGatewayTarget: (targetId: string) => null,
      listGatewayTargets: (limit: number, channel?: string): GatewayTargetRecord[] => [],
    },
    session: {
      upsertGatewayTarget: (target: GatewayTargetRecord) => { /* noop */ },
      listGatewaySessionTargetCandidates:
        (limit: number, channel?: string, tenantId?: string | null): GatewaySessionTargetCandidate[] => {
          capturedLimit = limit;
          return [];
        },
    },
  } as unknown as AuthoritativeTaskStore;

  const adapter = new GatewayStorageAdapter(mockStore);
  adapter.listGatewaySessionTargetCandidates();

  assert.equal(capturedLimit, 100);
});
