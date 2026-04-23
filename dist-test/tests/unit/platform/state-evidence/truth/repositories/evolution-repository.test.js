import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { EvolutionRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/evolution-repository.js";
import { TaskRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
const now = "2026-04-15T10:00:00.000Z";
function createTestObjects(db) {
    const repo = new EvolutionRepository(db);
    const taskRepo = new TaskRepository(db.connection);
    return { repo, taskRepo };
}
test("EvolutionRepository insertEvolutionProposal and getEvolutionProposal", () => {
    const workspace = createTempWorkspace("aa-evolution-proposal-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo, taskRepo } = createTestObjects(db);
        // Insert prerequisite task
        taskRepo.insertTask({
            id: "task-1",
            parentId: null,
            rootId: "task-1",
            divisionId: "general_ops",
            tenantId: null,
            title: "Evolution task",
            status: "queued",
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
        repo.insertEvolutionProposal({
            id: "proposal-1",
            taskId: "task-1",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "pending_approval",
            approvalId: null,
            summary: "Increase budget",
            proposalJson: '{"delta":0.2}',
            evidenceJson: '{"confidence":0.9}',
            createdAt: now,
            updatedAt: now,
            approvedAt: null,
            appliedAt: null,
            rolledBackAt: null,
        });
        const result = repo.getEvolutionProposal("proposal-1");
        assert.ok(result);
        assert.equal(result.id, "proposal-1");
        assert.equal(result.taskId, "task-1");
        assert.equal(result.kind, "budget_adjustment");
        assert.equal(result.status, "pending_approval");
        assert.equal(result.summary, "Increase budget");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository insertEvolutionProposal and updateEvolutionProposal", () => {
    const workspace = createTempWorkspace("aa-evolution-proposal-upd-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo, taskRepo } = createTestObjects(db);
        taskRepo.insertTask({
            id: "task-1",
            parentId: null,
            rootId: "task-1",
            divisionId: "general_ops",
            tenantId: null,
            title: "Evolution task",
            status: "queued",
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
        repo.insertEvolutionProposal({
            id: "proposal-1",
            taskId: "task-1",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "pending_approval",
            approvalId: null,
            summary: "Increase budget",
            proposalJson: '{"delta":0.2}',
            evidenceJson: '{"confidence":0.9}',
            createdAt: now,
            updatedAt: now,
            approvedAt: null,
            appliedAt: null,
            rolledBackAt: null,
        });
        repo.updateEvolutionProposal({
            id: "proposal-1",
            taskId: "task-1",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "approved",
            approvalId: null,
            summary: "Increase budget - approved",
            proposalJson: '{"delta":0.2}',
            evidenceJson: '{"confidence":0.95}',
            createdAt: now,
            updatedAt: "2026-04-15T10:05:00.000Z",
            approvedAt: "2026-04-15T10:05:00.000Z",
            appliedAt: null,
            rolledBackAt: null,
        });
        const result = repo.getEvolutionProposal("proposal-1");
        assert.ok(result);
        assert.equal(result.status, "approved");
        assert.equal(result.approvalId, null);
        assert.equal(result.summary, "Increase budget - approved");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository getEvolutionProposal returns null for non-existent", () => {
    const workspace = createTempWorkspace("aa-evolution-proposal-null-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo } = createTestObjects(db);
        const result = repo.getEvolutionProposal("nonexistent");
        assert.equal(result, null);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository listEvolutionProposals returns all proposals", () => {
    const workspace = createTempWorkspace("aa-evolution-proposal-list-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo, taskRepo } = createTestObjects(db);
        taskRepo.insertTask({
            id: "task-1",
            parentId: null,
            rootId: "task-1",
            divisionId: "general_ops",
            tenantId: null,
            title: "Task 1",
            status: "queued",
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
        taskRepo.insertTask({
            id: "task-2",
            parentId: null,
            rootId: "task-2",
            divisionId: "general_ops",
            tenantId: null,
            title: "Task 2",
            status: "queued",
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
        repo.insertEvolutionProposal({
            id: "proposal-1",
            taskId: "task-1",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "pending_approval",
            approvalId: null,
            summary: "Proposal 1",
            proposalJson: "{}",
            evidenceJson: "{}",
            createdAt: now,
            updatedAt: now,
            approvedAt: null,
            appliedAt: null,
            rolledBackAt: null,
        });
        repo.insertEvolutionProposal({
            id: "proposal-2",
            taskId: "task-2",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "experience_promotion",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "approved",
            approvalId: null,
            summary: "Proposal 2",
            proposalJson: "{}",
            evidenceJson: "{}",
            createdAt: now,
            updatedAt: now,
            approvedAt: now,
            appliedAt: null,
            rolledBackAt: null,
        });
        const results = repo.listEvolutionProposals();
        assert.equal(results.length, 2);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository listEvolutionProposals filters by status", () => {
    const workspace = createTempWorkspace("aa-evolution-proposal-filter-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo, taskRepo } = createTestObjects(db);
        taskRepo.insertTask({
            id: "task-1",
            parentId: null,
            rootId: "task-1",
            divisionId: "general_ops",
            tenantId: null,
            title: "Task 1",
            status: "queued",
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
        taskRepo.insertTask({
            id: "task-2",
            parentId: null,
            rootId: "task-2",
            divisionId: "general_ops",
            tenantId: null,
            title: "Task 2",
            status: "queued",
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
        repo.insertEvolutionProposal({
            id: "proposal-1",
            taskId: "task-1",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "pending_approval",
            approvalId: null,
            summary: "Proposal 1",
            proposalJson: "{}",
            evidenceJson: "{}",
            createdAt: now,
            updatedAt: now,
            approvedAt: null,
            appliedAt: null,
            rolledBackAt: null,
        });
        repo.insertEvolutionProposal({
            id: "proposal-2",
            taskId: "task-2",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "experience_promotion",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "approved",
            approvalId: null,
            summary: "Proposal 2",
            proposalJson: "{}",
            evidenceJson: "{}",
            createdAt: now,
            updatedAt: now,
            approvedAt: now,
            appliedAt: null,
            rolledBackAt: null,
        });
        const pending = repo.listEvolutionProposals("pending_approval");
        assert.equal(pending.length, 1);
        assert.equal(pending[0]?.id, "proposal-1");
        const approved = repo.listEvolutionProposals("approved");
        assert.equal(approved.length, 1);
        assert.equal(approved[0]?.id, "proposal-2");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository insertEvolutionPolicy and getEvolutionPolicyByProposal", () => {
    const workspace = createTempWorkspace("aa-evolution-policy-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo, taskRepo } = createTestObjects(db);
        taskRepo.insertTask({
            id: "task-1",
            parentId: null,
            rootId: "task-1",
            divisionId: "general_ops",
            tenantId: null,
            title: "Task 1",
            status: "queued",
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
        repo.insertEvolutionProposal({
            id: "proposal-1",
            taskId: "task-1",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "approved",
            approvalId: null,
            summary: "Proposal 1",
            proposalJson: "{}",
            evidenceJson: "{}",
            createdAt: now,
            updatedAt: now,
            approvedAt: now,
            appliedAt: null,
            rolledBackAt: null,
        });
        repo.insertEvolutionPolicy({
            id: "policy-1",
            proposalId: "proposal-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "active",
            valueJson: '{"limit":2}',
            createdAt: now,
            updatedAt: now,
            rolledBackAt: null,
        });
        const result = repo.getEvolutionPolicyByProposal("proposal-1");
        assert.ok(result);
        assert.equal(result.id, "policy-1");
        assert.equal(result.proposalId, "proposal-1");
        assert.equal(result.status, "active");
        assert.equal(result.kind, "budget_adjustment");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository updateEvolutionPolicy changes status", () => {
    const workspace = createTempWorkspace("aa-evolution-policy-upd-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo, taskRepo } = createTestObjects(db);
        taskRepo.insertTask({
            id: "task-1",
            parentId: null,
            rootId: "task-1",
            divisionId: "general_ops",
            tenantId: null,
            title: "Task 1",
            status: "queued",
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
        repo.insertEvolutionProposal({
            id: "proposal-1",
            taskId: "task-1",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "approved",
            approvalId: null,
            summary: "Proposal 1",
            proposalJson: "{}",
            evidenceJson: "{}",
            createdAt: now,
            updatedAt: now,
            approvedAt: now,
            appliedAt: null,
            rolledBackAt: null,
        });
        repo.insertEvolutionPolicy({
            id: "policy-1",
            proposalId: "proposal-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "active",
            valueJson: '{"limit":2}',
            createdAt: now,
            updatedAt: now,
            rolledBackAt: null,
        });
        repo.updateEvolutionPolicy({
            id: "policy-1",
            proposalId: "proposal-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "rolled_back",
            valueJson: '{"limit":1}',
            createdAt: now,
            updatedAt: "2026-04-15T10:10:00.000Z",
            rolledBackAt: "2026-04-15T10:10:00.000Z",
        });
        const result = repo.getEvolutionPolicyByProposal("proposal-1");
        assert.ok(result);
        assert.equal(result.status, "rolled_back");
        assert.equal(result.valueJson, '{"limit":1}');
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository listEvolutionPolicies filters by status", () => {
    const workspace = createTempWorkspace("aa-evolution-policy-list-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo, taskRepo } = createTestObjects(db);
        taskRepo.insertTask({
            id: "task-1",
            parentId: null,
            rootId: "task-1",
            divisionId: "general_ops",
            tenantId: null,
            title: "Task 1",
            status: "queued",
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
        repo.insertEvolutionProposal({
            id: "proposal-1",
            taskId: "task-1",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "approved",
            approvalId: null,
            summary: "Proposal 1",
            proposalJson: "{}",
            evidenceJson: "{}",
            createdAt: now,
            updatedAt: now,
            approvedAt: now,
            appliedAt: null,
            rolledBackAt: null,
        });
        repo.insertEvolutionPolicy({
            id: "policy-1",
            proposalId: "proposal-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "active",
            valueJson: '{"limit":2}',
            createdAt: now,
            updatedAt: now,
            rolledBackAt: null,
        });
        const active = repo.listEvolutionPolicies({ status: "active" });
        assert.equal(active.length, 1);
        assert.equal(active[0]?.id, "policy-1");
        const rolledBack = repo.listEvolutionPolicies({ status: "rolled_back" });
        assert.equal(rolledBack.length, 0);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository insertEvolutionLog and listEvolutionLogsByProposal", () => {
    const workspace = createTempWorkspace("aa-evolution-log-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo, taskRepo } = createTestObjects(db);
        taskRepo.insertTask({
            id: "task-1",
            parentId: null,
            rootId: "task-1",
            divisionId: "general_ops",
            tenantId: null,
            title: "Task 1",
            status: "queued",
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
        repo.insertEvolutionProposal({
            id: "proposal-1",
            taskId: "task-1",
            executionId: null,
            sourceAgentId: "agent-1",
            kind: "budget_adjustment",
            scopeType: "division",
            scopeRef: "general_ops",
            status: "pending_approval",
            approvalId: null,
            summary: "Proposal 1",
            proposalJson: "{}",
            evidenceJson: "{}",
            createdAt: now,
            updatedAt: now,
            approvedAt: null,
            appliedAt: null,
            rolledBackAt: null,
        });
        repo.insertEvolutionLog({
            id: "log-1",
            proposalId: "proposal-1",
            taskId: "task-1",
            executionId: null,
            eventType: "proposal_created",
            reasonCode: "detected_gain",
            beforeStateJson: null,
            afterStateJson: '{"status":"proposed"}',
            metadataJson: null,
            createdAt: now,
        });
        repo.insertEvolutionLog({
            id: "log-2",
            proposalId: "proposal-1",
            taskId: "task-1",
            executionId: null,
            eventType: "approval_synced",
            reasonCode: "manual_approval",
            beforeStateJson: '{"status":"pending_approval"}',
            afterStateJson: '{"status":"approved"}',
            metadataJson: null,
            createdAt: "2026-04-15T10:01:00.000Z",
        });
        const logs = repo.listEvolutionLogsByProposal("proposal-1");
        assert.equal(logs.length, 2);
        assert.equal(logs[0]?.eventType, "proposal_created");
        assert.equal(logs[1]?.eventType, "approval_synced");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository insertPmfValidationReport and listPmfValidationReports", () => {
    const workspace = createTempWorkspace("aa-evolution-pmf-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo } = createTestObjects(db);
        repo.insertPmfValidationReport({
            id: "pmf-1",
            profileName: "default",
            windowStart: "2026-04-14T10:00:00.000Z",
            windowEnd: now,
            divisionId: "general_ops",
            verdict: "pass",
            summaryJson: '{"status":"ok"}',
            reportJson: '{"metrics":[]}',
            generatedAt: now,
        });
        const results = repo.listPmfValidationReports(10);
        assert.equal(results.length, 1);
        assert.equal(results[0]?.id, "pmf-1");
        assert.equal(results[0]?.verdict, "pass");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository getLatestPmfValidationReport returns most recent", () => {
    const workspace = createTempWorkspace("aa-evolution-pmf-latest-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo } = createTestObjects(db);
        repo.insertPmfValidationReport({
            id: "pmf-1",
            profileName: "default",
            windowStart: "2026-04-13T10:00:00.000Z",
            windowEnd: "2026-04-14T10:00:00.000Z",
            divisionId: "general_ops",
            verdict: "pass",
            summaryJson: '{"status":"ok"}',
            reportJson: '{"metrics":[]}',
            generatedAt: "2026-04-14T10:00:00.000Z",
        });
        repo.insertPmfValidationReport({
            id: "pmf-2",
            profileName: "default",
            windowStart: "2026-04-14T10:00:00.000Z",
            windowEnd: now,
            divisionId: "general_ops",
            verdict: "fail",
            summaryJson: '{"status":"issues"}',
            reportJson: '{"metrics":[]}',
            generatedAt: now,
        });
        const latest = repo.getLatestPmfValidationReport("default");
        assert.ok(latest);
        assert.equal(latest.id, "pmf-2");
        assert.equal(latest.verdict, "fail");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("EvolutionRepository getLatestPmfValidationReport returns null for non-existent profile", () => {
    const workspace = createTempWorkspace("aa-evolution-pmf-null-");
    const dbPath = join(workspace, "evolution.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const { repo } = createTestObjects(db);
        const result = repo.getLatestPmfValidationReport("nonexistent");
        assert.equal(result, null);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=evolution-repository.test.js.map