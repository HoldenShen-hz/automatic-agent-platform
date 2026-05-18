import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { GovernanceDelegationRevocationSaga } from "../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import { KnowledgeBoundaryService } from "../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import { ApiKeyService } from "../../../src/org-governance/sso-scim/api-key-service.js";
import { ScimProvisionService } from "../../../src/org-governance/sso-scim/scim-sync/scim-service.js";
import { resolveTriggerActionMode } from "../../../src/interaction/proactive-agent/trigger-engine/index.js";
import { ApprovalService } from "../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import {
  canCoordinatorPerformLeaderAction,
  type CoordinatorNode,
} from "../../../src/platform/five-plane-execution/ha/types.js";
import { canRemoteSessionMutate } from "../../../src/platform/remote-coordination/session/index.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";

function createHarness(prefix: string) {
  const tmpDir = join("/tmp", `${prefix}-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, "test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { tmpDir, db, store };
}

function cleanupHarness(harness: { tmpDir: string; db: SqliteDatabase }) {
  harness.db.close();
  rmSync(harness.tmpDir, { recursive: true, force: true });
}

function createTask(store: AuthoritativeTaskStore, taskId: string, now: string): void {
  store.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId: null,
    title: "Reaudit task",
    status: "in_progress",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

test("R27-47 approval requests derive a harness_run_id instead of reusing raw taskId", () => {
  const harness = createHarness("reaudit-r27-47");
  try {
    const now = "2026-05-11T00:00:00.000Z";
    createTask(harness.store, "task-r27-47", now);
    const service = new ApprovalService(harness.db, harness.store);
    const approval = service.createRequest({
      taskId: "task-r27-47",
      executionId: null,
      sourceAgentId: "agent-1",
      reason: "Need governance approval",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    assert.equal(approval.harnessRunId, "harness_run:task:task-r27-47");
    assert.notEqual(approval.harnessRunId, approval.taskId);
    assert.equal(approval.harness_run_id, "harness_run:task:task-r27-47");
  } finally {
    cleanupHarness(harness);
  }
});

test("R27-48 remote worker session states are implemented and viewer_only stays read-only", () => {
  assert.equal(canRemoteSessionMutate("connected"), true);
  assert.equal(canRemoteSessionMutate("reconnecting"), true);
  assert.equal(canRemoteSessionMutate("degraded"), true);
  assert.equal(canRemoteSessionMutate("viewer_only"), false);
  assert.equal(canRemoteSessionMutate("failed"), false);
});

test("R27-49 coordinator follower metadata blocks leader-only actions", () => {
  const follower: CoordinatorNode = {
    nodeId: "coord-2",
    region: "cn-sh",
    status: "active",
    isLeader: false,
    leadershipEpoch: 7,
    lastHeartbeatAt: "2026-05-11T00:00:00.000Z",
    metadata: {
      role: "follower",
      allowedActions: ["observe_cluster", "ack_replication"],
      authoritativeWritesEnabled: false,
    },
  };
  const leader: CoordinatorNode = {
    ...follower,
    nodeId: "coord-1",
    isLeader: true,
    metadata: {
      role: "leader",
      allowedActions: ["dispatch_execution", "observe_cluster"],
      authoritativeWritesEnabled: true,
    },
  };

  assert.equal(canCoordinatorPerformLeaderAction(follower, "dispatch_execution"), false);
  assert.equal(canCoordinatorPerformLeaderAction(leader, "dispatch_execution"), true);
});

test("R27-50 proactive trigger engine does not auto-execute high-risk actions", () => {
  assert.equal(resolveTriggerActionMode(false, "low"), "auto_execute");
  assert.equal(resolveTriggerActionMode(false, "medium"), "suggest");
  assert.equal(resolveTriggerActionMode(false, "high"), "suggest");
  assert.equal(resolveTriggerActionMode(false, "critical"), "silent_record");
});

test("R27-51/R27-54/R27-55 SCIM service enforces tenant-aware list operations, targeted member removal, and attribute-aware filters", () => {
  const service = new ScimProvisionService();
  const tenantA = "tenant-a";
  const tenantB = "tenant-b";

  const alice = service.createUser({
    userName: "alice",
    name: { formatted: "Alice", familyName: "A", givenName: "Alice" },
    displayName: "Alice A",
    emails: [{ value: "alice@example.com", primary: true }],
    active: true,
    groups: [],
  }, tenantA);
  const bob = service.createUser({
    userName: "bob",
    name: { formatted: "Bob", familyName: "B", givenName: "Bob" },
    displayName: "Bob B",
    emails: [{ value: "bob@example.com", primary: true }],
    active: true,
    groups: [],
  }, tenantB);

  const group = service.createGroup({
    displayName: "ops-team",
    members: [
      { value: alice.id, display: "Alice A" },
      { value: bob.id, display: "Bob B" },
    ],
  }, tenantA);

  const tenantAUsers = service.listUsers({ tenantId: tenantA });
  assert.equal(tenantAUsers.totalResults, 1);
  assert.equal(tenantAUsers.Resources[0]?.id, alice.id);

  const tenantAGroups = service.listGroups({ tenantId: tenantA, filter: "displayName eq \"ops-team\"" });
  assert.equal(tenantAGroups.totalResults, 1);
  assert.equal(tenantAGroups.Resources[0]?.id, group.id);

  const filteredByDisplayName = service.listUsers({ tenantId: tenantA, filter: "displayName eq \"Alice A\"" });
  assert.equal(filteredByDisplayName.totalResults, 1);
  assert.equal(filteredByDisplayName.Resources[0]?.userName, "alice");

  const updatedGroup = service.patchGroup(group.id, [{
    op: "remove",
    path: `members[value eq "${alice.id}"]`,
  }], tenantA);
  assert.equal(updatedGroup?.members.length, 1);
  assert.equal(updatedGroup?.members[0]?.value, bob.id);
});

test("R27-52 api-key validation marks expired keys as expired during validation", () => {
  const service = new ApiKeyService();
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  const { record, rawKey } = service.generateApiKey({
    name: "expired-key",
    ownerId: "owner-1",
    expiresAt: expiredAt,
    createdBy: "admin-1",
  });

  const result = service.validateApiKey(rawKey);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "key_expired");
  assert.equal(service.getApiKey(record.keyId)?.status, "expired");
});

test("R27-53 governance delegation cascadeWithinSlo is no longer dead code", () => {
  const saga = new GovernanceDelegationRevocationSaga();
  const fastReceipt = saga.revoke({
    delegationId: "delegation-1",
    requestedAtMs: 1_000,
    derivedResourceIds: ["resource-1"],
    derivedDelegationIds: ["child-1"],
    cascadeScope: 1,
  }, 30_000);
  const slowReceipt = saga.revoke({
    delegationId: "delegation-2",
    requestedAtMs: 1_000,
    derivedResourceIds: ["resource-2"],
    derivedDelegationIds: ["child-2"],
    cascadeScope: 1,
  }, 400_000);

  assert.equal(fastReceipt.cascadeWithinSlo, true);
  assert.equal(slowReceipt.cascadeWithinSlo, false);
});

test("R27-56 knowledge boundary requiredGrantBoundaryIds accepts cross-boundary grants for the same requester org", () => {
  const service = new KnowledgeBoundaryService();
  const decision = service.evaluateDynamicAccess({
    boundary: {
      boundaryId: "boundary-target",
      tenantId: "tenant-a",
      ownerOrgNodeId: "org-owner",
      namespaceIds: ["restricted"],
      accessPolicy: "strict",
      defaultVisibility: "private",
      auditOnAccess: true,
      allowedOrgNodeIds: [],
      fieldAllowlist: [],
      classificationRules: [],
      sharePolicy: {
        mode: "explicit_grant",
        allowCrossTenant: false,
        requireAudit: true,
        allowOrgNodeIds: [],
      },
    },
    requesterId: "user-1",
    requesterOrgNodeId: "org-requester",
    purpose: "cross-boundary-review",
    grants: [{
      grantId: "grant-1",
      boundaryId: "boundary-prereq",
      requesterOrgNodeId: "org-requester",
      purpose: "cross-boundary-review",
      expiresAt: "2099-01-01T00:00:00.000Z",
    }],
    dynamicPolicy: {
      policyId: "policy-1",
      requiredGrantBoundaryIds: ["boundary-prereq"],
    },
    occurredAt: "2026-05-11T00:00:00.000Z",
    tenantId: "tenant-a",
  });

  assert.equal(decision.dynamicPolicyApplied, true);
  assert.equal(decision.violationCodes?.includes("knowledge_boundary.required_grant_missing:policy-1"), false);
});
