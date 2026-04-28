import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { KnowledgeBoundaryService, type KnowledgeAccessDecision } from "../../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import { canAccessKnowledgeBoundary, type KnowledgeBoundary } from "../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";
import { evaluateKnowledgeShare, type KnowledgeShareGrant } from "../../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";
import { evaluateChineseWallPolicy, type ChineseWallPolicy } from "../../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";
import { redactKnowledgeAccessLog } from "../../../../src/org-governance/knowledge-boundary/access-log/index.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("Knowledge Boundary: evaluateAccess grants access to public boundary only with explicit allowlist", () => {
  const workspace = createTempWorkspace("aa-kb-access-public-");
  const dbPath = join(workspace, "kb-access-public.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const kbService = new KnowledgeBoundaryService();

    seedTaskAndExecution(db, store, {
      taskId: "task-kb-public",
      executionId: "exec-kb-public",
      traceId: "trace-kb-public",
    });

    const boundary: KnowledgeBoundary = {
      boundaryId: "kb-public",
      ownerOrgNodeId: "org-finance",
      namespaceIds: ["finance-docs"],
      defaultVisibility: "public",
      allowedOrgNodeIds: ["org-engineering"],
    };

    const decision = kbService.evaluateAccess(
      boundary,
      "user-123",
      "org-engineering",
      "research",
      [],
      undefined,
      "2026-04-20T10:00:00.000Z",
    );

    assert.equal(decision.allowed, true);
    assert.equal(decision.boundaryId, "kb-public");
    assert.ok(decision.accessLog.recordId.includes("kb-public"));
    assert.ok(decision.reasonCodes.includes("knowledge_boundary.no_chinese_wall"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("Knowledge Boundary: evaluateAccess denies access to private boundary without grants", () => {
  const workspace = createTempWorkspace("aa-kb-access-private-");
  const dbPath = join(workspace, "kb-access-private.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const kbService = new KnowledgeBoundaryService();

    seedTaskAndExecution(db, store, {
      taskId: "task-kb-private",
      executionId: "exec-kb-private",
      traceId: "trace-kb-private",
    });

    const boundary: KnowledgeBoundary = {
      boundaryId: "kb-private",
      ownerOrgNodeId: "org-finance",
      namespaceIds: ["confidential-docs"],
      defaultVisibility: "private",
      allowedOrgNodeIds: [],
    };

    const decision = kbService.evaluateAccess(
      boundary,
      "user-456",
      "org-engineering",
      "research",
      [],
      undefined,
      "2026-04-20T10:00:00.000Z",
    );

    assert.equal(decision.allowed, false);
    assert.ok(decision.reasonCodes.includes("knowledge_boundary.access_denied"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("Knowledge Boundary: evaluateAccess allows owner access to private boundary", () => {
  const workspace = createTempWorkspace("aa-kb-access-owner-");
  const dbPath = join(workspace, "kb-access-owner.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const kbService = new KnowledgeBoundaryService();

    seedTaskAndExecution(db, store, {
      taskId: "task-kb-owner",
      executionId: "exec-kb-owner",
      traceId: "trace-kb-owner",
    });

    const boundary: KnowledgeBoundary = {
      boundaryId: "kb-owner-test",
      ownerOrgNodeId: "org-finance",
      namespaceIds: ["finance-docs"],
      defaultVisibility: "private",
      allowedOrgNodeIds: [],
    };

    const decision = kbService.evaluateAccess(
      boundary,
      "user-owner",
      "org-finance",
      "finance work",
      [],
      undefined,
      "2026-04-20T10:00:00.000Z",
    );

    assert.equal(decision.allowed, true);
    assert.equal(decision.boundaryId, "kb-owner-test");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("Knowledge Boundary: evaluateAccess allows access via valid share grant", () => {
  const workspace = createTempWorkspace("aa-kb-access-grant-");
  const dbPath = join(workspace, "kb-access-grant.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const kbService = new KnowledgeBoundaryService();

    seedTaskAndExecution(db, store, {
      taskId: "task-kb-grant",
      executionId: "exec-kb-grant",
      traceId: "trace-kb-grant",
    });

    const boundary: KnowledgeBoundary = {
      boundaryId: "kb-grant-test",
      ownerOrgNodeId: "org-finance",
      namespaceIds: ["restricted-docs"],
      defaultVisibility: "private",
      allowedOrgNodeIds: [],
    };

    const grants: KnowledgeShareGrant[] = [
      {
        grantId: newId("grant"),
        boundaryId: "kb-grant-test",
        requesterOrgNodeId: "org-engineering",
        purpose: "cross-team collaboration",
        expiresAt: "2026-04-30T00:00:00.000Z",
      },
    ];

    const decision = kbService.evaluateAccess(
      boundary,
      "user-engineer",
      "org-engineering",
      "collaboration",
      grants,
      undefined,
      "2026-04-20T10:00:00.000Z",
    );

    assert.equal(decision.allowed, true);
    assert.equal(decision.boundaryId, "kb-grant-test");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("Knowledge Boundary: evaluateAccess denies access when grant is expired", () => {
  const workspace = createTempWorkspace("aa-kb-access-expired-");
  const dbPath = join(workspace, "kb-access-expired.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const kbService = new KnowledgeBoundaryService();

    seedTaskAndExecution(db, store, {
      taskId: "task-kb-expired",
      executionId: "exec-kb-expired",
      traceId: "trace-kb-expired",
    });

    const boundary: KnowledgeBoundary = {
      boundaryId: "kb-expired-test",
      ownerOrgNodeId: "org-finance",
      namespaceIds: ["restricted-docs"],
      defaultVisibility: "private",
      allowedOrgNodeIds: [],
    };

    const grants: KnowledgeShareGrant[] = [
      {
        grantId: newId("grant"),
        boundaryId: "kb-expired-test",
        requesterOrgNodeId: "org-engineering",
        purpose: "collaboration",
        expiresAt: "2026-04-01T00:00:00.000Z", // Expired
      },
    ];

    const decision = kbService.evaluateAccess(
      boundary,
      "user-engineer",
      "org-engineering",
      "collaboration",
      grants,
      undefined,
      "2026-04-20T10:00:00.000Z",
    );

    assert.equal(decision.allowed, false);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("Knowledge Boundary: evaluateAccess blocks access via Chinese Wall policy", () => {
  const workspace = createTempWorkspace("aa-kb-chinese-wall-");
  const dbPath = join(workspace, "kb-chinese-wall.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const kbService = new KnowledgeBoundaryService();

    seedTaskAndExecution(db, store, {
      taskId: "task-kb-wall",
      executionId: "exec-kb-wall",
      traceId: "trace-kb-wall",
    });

    const boundary: KnowledgeBoundary = {
      boundaryId: "kb-wall-test",
      ownerOrgNodeId: "org-legal",
      namespaceIds: ["legal-docs"],
      defaultVisibility: "private",
      allowedOrgNodeIds: [],
    };

    const chineseWallPolicy: ChineseWallPolicy = {
      policyId: "cw-legal-conflicts",
      conflictGroups: {
        legal_conflict: ["org-legal", "org-compliance"],
      },
    };

    const decision = kbService.evaluateAccess(
      boundary,
      "user-compliance",
      "org-compliance",
      "legal review",
      [],
      chineseWallPolicy,
      "2026-04-20T10:00:00.000Z",
    );

    assert.equal(decision.allowed, false);
    assert.ok(decision.reasonCodes.some((code) => code.includes("chinese_wall_blocked")));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("Knowledge Boundary: listRedactedLogs returns redacted access records", () => {
  const workspace = createTempWorkspace("aa-kb-redact-");
  const dbPath = join(workspace, "kb-redact.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const kbService = new KnowledgeBoundaryService();

    seedTaskAndExecution(db, store, {
      taskId: "task-kb-redact",
      executionId: "exec-kb-redact",
      traceId: "trace-kb-redact",
    });

    const boundary: KnowledgeBoundary = {
      boundaryId: "kb-redact-test",
      ownerOrgNodeId: "org-finance",
      namespaceIds: ["finance-docs"],
      defaultVisibility: "public",
      allowedOrgNodeIds: [],
    };

    // Make two access requests
    kbService.evaluateAccess(boundary, "user-a", "org-engineering", "research-a", [], undefined, "2026-04-20T10:00:00.000Z");
    kbService.evaluateAccess(boundary, "user-b", "org-engineering", "research-b", [], undefined, "2026-04-20T11:00:00.000Z");

    const redactedLogs = kbService.listRedactedLogs("kb-redact-test");

    assert.equal(redactedLogs.length, 2);
    assert.ok(redactedLogs[0]!.requesterId.startsWith("redacted:"));
    assert.ok(redactedLogs[1]!.requesterId.startsWith("redacted:"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("Knowledge Boundary: canAccessKnowledgeBoundary requires explicit allowlist even for public boundary", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb-test",
    ownerOrgNodeId: "org-owner",
    namespaceIds: [],
    defaultVisibility: "public",
    allowedOrgNodeIds: [],
  };

  assert.equal(canAccessKnowledgeBoundary(boundary, "any-org-node"), false);
});

test("Knowledge Boundary: canAccessKnowledgeBoundary returns true for owner", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb-test",
    ownerOrgNodeId: "org-owner",
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };

  assert.equal(canAccessKnowledgeBoundary(boundary, "org-owner"), true);
});

test("Knowledge Boundary: canAccessKnowledgeBoundary returns true for allowed org node", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb-test",
    ownerOrgNodeId: "org-owner",
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds: ["org-allowed-1", "org-allowed-2"],
  };

  assert.equal(canAccessKnowledgeBoundary(boundary, "org-allowed-1"), true);
  assert.equal(canAccessKnowledgeBoundary(boundary, "org-allowed-2"), true);
});

test("Knowledge Boundary: canAccessKnowledgeBoundary returns false for non-owner on private boundary", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb-test",
    ownerOrgNodeId: "org-owner",
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };

  assert.equal(canAccessKnowledgeBoundary(boundary, "org-stranger"), false);
});

test("Knowledge Boundary: evaluateKnowledgeShare returns true for boundary owner", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb-share-test",
    ownerOrgNodeId: "org-owner",
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };

  const grants: KnowledgeShareGrant[] = [];

  assert.equal(evaluateKnowledgeShare(boundary, "org-owner", grants, "2026-04-20T10:00:00.000Z"), true);
});

test("Knowledge Boundary: evaluateKnowledgeShare returns true for valid non-expired grant", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb-share-valid",
    ownerOrgNodeId: "org-owner",
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };

  const grants: KnowledgeShareGrant[] = [
    {
      grantId: newId("grant"),
      boundaryId: "kb-share-valid",
      requesterOrgNodeId: "org-requester",
      purpose: "collaboration",
      expiresAt: "2026-04-30T00:00:00.000Z",
    },
  ];

  assert.equal(evaluateKnowledgeShare(boundary, "org-requester", grants, "2026-04-20T10:00:00.000Z"), true);
});

test("Knowledge Boundary: evaluateKnowledgeShare returns false for expired grant", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb-share-expired",
    ownerOrgNodeId: "org-owner",
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };

  const grants: KnowledgeShareGrant[] = [
    {
      grantId: newId("grant"),
      boundaryId: "kb-share-expired",
      requesterOrgNodeId: "org-requester",
      purpose: "collaboration",
      expiresAt: "2026-04-01T00:00:00.000Z", // Expired
    },
  ];

  assert.equal(evaluateKnowledgeShare(boundary, "org-requester", grants, "2026-04-20T10:00:00.000Z"), false);
});

test("Knowledge Boundary: evaluateChineseWallPolicy blocks access in same conflict group", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cw-test",
    conflictGroups: {
      group_a: ["org-1", "org-2", "org-3"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "org-1", "org-2");

  assert.equal(decision.allowed, false);
  assert.equal(decision.blockedGroupId, "group_a");
  assert.ok(decision.reasonCodes.some((code) => code.includes("chinese_wall_blocked")));
});

test("Knowledge Boundary: evaluateChineseWallPolicy allows access across different conflict groups", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cw-test",
    conflictGroups: {
      group_a: ["org-1", "org-2"],
      group_b: ["org-3", "org-4"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "org-1", "org-3");

  assert.equal(decision.allowed, true);
  assert.equal(decision.blockedGroupId, null);
});

test("Knowledge Boundary: evaluateChineseWallPolicy allows access to same org node", () => {
  const policy: ChineseWallPolicy = {
    policyId: "cw-test",
    conflictGroups: {
      group_a: ["org-1", "org-2"],
    },
  };

  const decision = evaluateChineseWallPolicy(policy, "org-1", "org-1");

  assert.equal(decision.allowed, true);
  assert.equal(decision.blockedGroupId, null);
});

test("Knowledge Boundary: redactKnowledgeAccessLog redacts requesterId", () => {
  const log = {
    recordId: "log-123",
    requesterId: "user-full-id",
    boundaryId: "kb-test",
    purpose: "testing",
    allowed: true,
    occurredAt: "2026-04-20T10:00:00.000Z",
  };

  const redacted = redactKnowledgeAccessLog(log);

  assert.ok(redacted.requesterId.startsWith("redacted:"));
  assert.ok(redacted.requesterId.includes("user"));
  assert.equal(redacted.recordId, "log-123");
  assert.equal(redacted.boundaryId, "kb-test");
});

test("Knowledge Boundary: access logs are accumulated per boundary", () => {
  const workspace = createTempWorkspace("aa-kb-logs-");
  const dbPath = join(workspace, "kb-logs.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const kbService = new KnowledgeBoundaryService();

    seedTaskAndExecution(db, store, {
      taskId: "task-kb-logs",
      executionId: "exec-kb-logs",
      traceId: "trace-kb-logs",
    });

    const boundary: KnowledgeBoundary = {
      boundaryId: "kb-logs-test",
      ownerOrgNodeId: "org-finance",
      namespaceIds: ["docs"],
      defaultVisibility: "public",
      allowedOrgNodeIds: [],
    };

    // Multiple accesses
    kbService.evaluateAccess(boundary, "user-1", "org-a", "purpose-1", [], undefined, "2026-04-20T10:00:00.000Z");
    kbService.evaluateAccess(boundary, "user-2", "org-b", "purpose-2", [], undefined, "2026-04-20T11:00:00.000Z");
    kbService.evaluateAccess(boundary, "user-3", "org-c", "purpose-3", [], undefined, "2026-04-20T12:00:00.000Z");

    const logs = kbService.listRedactedLogs("kb-logs-test");

    assert.equal(logs.length, 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("Knowledge Boundary: evaluateAccess records correct access log entries", () => {
  const workspace = createTempWorkspace("aa-kb-log-record-");
  const dbPath = join(workspace, "kb-log-record.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const kbService = new KnowledgeBoundaryService();

    seedTaskAndExecution(db, store, {
      taskId: "task-kb-log-record",
      executionId: "exec-kb-log-record",
      traceId: "trace-kb-log-record",
    });

    const boundary: KnowledgeBoundary = {
      boundaryId: "kb-log-record-test",
      ownerOrgNodeId: "org-finance",
      namespaceIds: ["docs"],
      defaultVisibility: "public",
      allowedOrgNodeIds: ["org-requester"],
    };

    const decision = kbService.evaluateAccess(
      boundary,
      "requester-xyz",
      "org-requester",
      "test-purpose",
      [],
      undefined,
      "2026-04-20T15:30:00.000Z",
    );

    const logs = kbService.listRedactedLogs("kb-log-record-test");

    assert.equal(logs.length, 1);
    assert.equal(logs[0]!.boundaryId, "kb-log-record-test");
    assert.equal(logs[0]!.purpose, "test-purpose");
    assert.equal(logs[0]!.allowed, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
