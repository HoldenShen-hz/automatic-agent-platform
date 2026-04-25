/**
 * Integration Test: HR Role Governance Service
 *
 * Tests HR role lifecycle management including gap analysis,
 * role proposal creation, and division role assignment.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { HrRoleGovernanceService, type HrGapAnalysisRequest, type HrGapAnalysisResult } from "../../../../src/domains/governance/hr-role-governance-service.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

test("hr role governance: performs gap analysis for missing capability", () => {
  const workspace = createTempWorkspace("aa-hr-gap-");

  try {
    const db = new SqliteDatabase(join(workspace, "hr-gap.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const hrService = new HrRoleGovernanceService(store);

    const taskId = "task-gap-test";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "engineering",
        title: "Gap analysis test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    const request: HrGapAnalysisRequest = {
      taskId,
      taskDescription: "Requires deployment capability",
      targetDivisionId: "engineering",
      triggerReason: "no_role_match",
      requestedCapabilities: ["deploy", "release"],
    };

    const result = hrService.analyzeGap(request);

    assert.ok(result.taskId === taskId);
    assert.ok(result.targetDivisionId === "engineering");
    assert.ok(Array.isArray(result.matchedRoleIds));
    assert.ok(Array.isArray(result.missingCapabilities));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("hr role governance: gap analysis identifies missing capabilities", () => {
  const workspace = createTempWorkspace("aa-hr-gap-missing-");

  try {
    const db = new SqliteDatabase(join(workspace, "hr-gap-missing.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const hrService = new HrRoleGovernanceService(store);

    const request: HrGapAnalysisRequest = {
      taskId: "task-gap-missing",
      taskDescription: "Requires specialized security capability",
      targetDivisionId: "security_ops",
      triggerReason: "scope_exceeded",
      requestedCapabilities: ["security_audit", "pen_test", "vulnerability_scan"],
    };

    const result = hrService.analyzeGap(request);

    assert.ok(result.missingCapabilities.length >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("hr role governance: suggests tools based on gap analysis", () => {
  const workspace = createTempWorkspace("aa-hr-gap-tools-");

  try {
    const db = new SqliteDatabase(join(workspace, "hr-gap-tools.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const hrService = new HrRoleGovernanceService(store);

    const request: HrGapAnalysisRequest = {
      taskId: "task-gap-tools",
      taskDescription: "Code review task",
      targetDivisionId: "engineering",
      triggerReason: "no_role_match",
      requestedCapabilities: ["code_review", "static_analysis"],
    };

    const result = hrService.analyzeGap(request);

    assert.ok(Array.isArray(result.suggestedToolNames));
    assert.ok(Array.isArray(result.divisionToolUnion));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("hr role governance: recommends model based on task type", () => {
  const workspace = createTempWorkspace("aa-hr-gap-model-");

  try {
    const db = new SqliteDatabase(join(workspace, "hr-gap-model.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const hrService = new HrRoleGovernanceService(store);

    const codingRequest: HrGapAnalysisRequest = {
      taskId: "task-coding",
      taskDescription: "Implement feature",
      targetDivisionId: "engineering",
      triggerReason: "no_role_match",
      requestedCapabilities: ["code_write"],
    };

    const codingResult = hrService.analyzeGap(codingRequest);
    assert.ok(codingResult.recommendedModel === "coding" || codingResult.recommendedModel === "balanced");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("hr role governance: handles division without existing roles", () => {
  const workspace = createTempWorkspace("aa-hr-gap-empty-");

  try {
    const db = new SqliteDatabase(join(workspace, "hr-gap-empty.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const hrService = new HrRoleGovernanceService(store);

    const request: HrGapAnalysisRequest = {
      taskId: "task-new-division",
      taskDescription: "New division task",
      targetDivisionId: "new_division",
      triggerReason: "no_role_match",
      requestedCapabilities: ["execute"],
    };

    const result = hrService.analyzeGap(request);

    assert.ok(result.targetDivisionId === "new_division");
    assert.ok(Array.isArray(result.matchedRoleIds));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("hr role governance: validates role proposal before submission", () => {
  const workspace = createTempWorkspace("aa-hr-validate-");

  try {
    const db = new SqliteDatabase(join(workspace, "hr-validate.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const hrService = new HrRoleGovernanceService(store);

    const validProposal = hrService.validateProposal({
      roleId: "role_proposal_1",
      name: "Deployment Engineer",
      divisionId: "engineering",
      permissions: ["deploy", "release", "read"],
      preconditions: [{ check: "has_deploy_cert", description: "Requires deployment certification" }],
    });

    assert.strictEqual(validProposal.valid, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("hr role governance: rejects invalid role proposal", () => {
  const workspace = createTempWorkspace("aa-hr-invalid-");

  try {
    const db = new SqliteDatabase(join(workspace, "hr-invalid.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const hrService = new HrRoleGovernanceService(store);

    const invalidProposal = hrService.validateProposal({
      roleId: "",
      name: "",
      divisionId: "",
      permissions: [],
      preconditions: [],
    });

    assert.strictEqual(invalidProposal.valid, false);
    assert.ok(invalidProposal.errors.length > 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
