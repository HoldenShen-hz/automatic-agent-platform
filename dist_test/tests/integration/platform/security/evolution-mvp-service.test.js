import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { ApprovalService } from "../../../../src/platform/control-plane/approval-center/approval-service.js";
import { EvolutionMvpService } from "../../../../src/ops-maturity/drift-detection/evolution-mvp-service.js";
import { ExperienceCacheService } from "../../../../src/platform/state-evidence/memory/experience-cache-service.js";
import { MemoryService } from "../../../../src/platform/state-evidence/memory/memory-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";
test("EvolutionMvpService rejects apply when approval has not been granted", () => {
    const workspace = createTempWorkspace("aa-evolution-security-apply-");
    const dbPath = join(workspace, "evolution-security-apply.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const approvalService = new ApprovalService(db, store);
        const memoryService = new MemoryService(store);
        const evolution = new EvolutionMvpService(db, store, approvalService, memoryService);
        seedTaskAndExecution(db, store, {
            taskId: "task-evo-security",
            executionId: "exec-evo-security",
        });
        const proposed = evolution.proposeBudgetAdjustment({
            taskId: "task-evo-security",
            executionId: "exec-evo-security",
            sourceAgentId: "supervisor-1",
            scopeType: "division",
            scopeRef: "general_ops",
            currentPolicy: {
                maxTaskCostUsd: 4,
                maxDailyCostUsd: 40,
                maxMonthlyCostUsd: 400,
                warnAtRatio: 0.8,
                mode: "supervised",
            },
            observedAverageCostUsd: 4.2,
            sampleSize: 4,
            successRate: 0.75,
            proposalReason: "testing fail-close",
        });
        assert.throws(() => evolution.applyProposal({
            proposalId: proposed.proposal.id,
            appliedBy: "operator-1",
        }), /evolution\.approval_required/);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionMvpService rejects invalid scope refs and missing experience candidates", () => {
    const workspace = createTempWorkspace("aa-evolution-security-scope-");
    const dbPath = join(workspace, "evolution-security-scope.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const approvalService = new ApprovalService(db, store);
        const memoryService = new MemoryService(store);
        const evolution = new EvolutionMvpService(db, store, approvalService, memoryService);
        const experiences = new ExperienceCacheService(store);
        seedTaskAndExecution(db, store, {
            taskId: "task-evo-security-2",
            executionId: "exec-evo-security-2",
        });
        assert.throws(() => evolution.proposeBudgetAdjustment({
            taskId: "task-evo-security-2",
            executionId: "exec-evo-security-2",
            sourceAgentId: "supervisor-1",
            scopeType: "role",
            scopeRef: "../escape",
            currentPolicy: {
                maxTaskCostUsd: 4,
                maxDailyCostUsd: 40,
                maxMonthlyCostUsd: 400,
                warnAtRatio: 0.8,
                mode: "supervised",
            },
            observedAverageCostUsd: 4.2,
            sampleSize: 4,
            successRate: 0.75,
            proposalReason: "invalid scope",
        }), /evolution\.invalid_scope_ref:role/);
        experiences.recordExperience({
            taskId: "task-exp-mismatch",
            sessionId: "session-exp-mismatch",
            agentId: "agent-exp",
            executionId: "exec-exp-mismatch",
            taskContext: "unrelated task",
            taskIntent: "unrelated intent",
            toolsUsed: [{ toolName: "read", callId: "call-1", status: "succeeded", durationMs: 10 }],
            outcome: "succeeded",
            finalErrorCode: null,
            qualityScore: 0.91,
        });
        assert.throws(() => evolution.proposeExperiencePromotion({
            taskId: "task-evo-security-2",
            executionId: "exec-evo-security-2",
            sourceAgentId: "supervisor-1",
            scopeType: "division",
            scopeRef: "general_ops",
            targetScope: "project",
            taskContext: "completely different recovery pathway",
            taskIntent: "different intent and tools",
            queryTools: ["bash"],
            minQualityScore: 0.95,
        }), /evolution\.experience_candidate_not_found/);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=evolution-mvp-service.test.js.map