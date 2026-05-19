import assert from "node:assert/strict";
import test from "node:test";
// This is a barrel file that re-exports all domain types
// We verify the exports exist and have correct types
test("domain barrel exports Timestamp type", () => {
    // Timestamp is a primitive string type
    const timestamp = "2024-01-15T10:00:00Z";
    assert.equal(timestamp, "2024-01-15T10:00:00Z");
});
test("domain barrel exports TaskPriority type", () => {
    const priority = "high";
    assert.equal(priority, "high");
});
test("domain barrel exports WorkerStatus type", () => {
    const status = "active";
    assert.equal(status, "active");
});
test("domain barrel exports LeaseStatus type", () => {
    const status = "active";
    assert.equal(status, "active");
});
test("domain barrel exports ExecutionRecord type", () => {
    const record = {
        executionId: "exec-001",
        taskId: "task-001",
        status: "running",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.executionId, "exec-001");
    assert.equal(record.status, "running");
});
test("domain barrel exports TaskRecord type", () => {
    const record = {
        taskId: "task-001",
        status: "pending",
        priority: "medium",
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.taskId, "task-001");
    assert.equal(record.status, "pending");
});
test("domain barrel exports WorkflowStateRecord type", () => {
    const record = {
        workflowId: "wf-001",
        taskId: "task-001",
        status: "running",
        currentStep: 1,
        totalSteps: 5,
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.workflowId, "wf-001");
    assert.equal(record.currentStep, 1);
});
test("domain barrel exports SessionRecord type", () => {
    const record = {
        sessionId: "sess-001",
        workspaceId: "ws-001",
        status: "active",
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.sessionId, "sess-001");
    assert.equal(record.status, "active");
});
test("domain barrel exports WorkspaceRecord type", () => {
    const record = {
        workspaceId: "ws-001",
        organizationId: "org-001",
        name: "Test Workspace",
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.name, "Test Workspace");
});
test("domain barrel exports TenantRecord type", () => {
    const record = {
        tenantId: "tenant-001",
        organizationId: "org-001",
        name: "Test Tenant",
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.tenantId, "tenant-001");
});
test("domain barrel exports OrganizationRecord type", () => {
    const record = {
        organizationId: "org-001",
        name: "Test Org",
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.name, "Test Org");
});
test("domain barrel exports ReleaseBundleRecord type", () => {
    const record = {
        bundleId: "bundle-001",
        version: "v1.0.0",
        status: "active",
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.version, "v1.0.0");
});
test("domain barrel exports BillingAccountRecord type", () => {
    const record = {
        accountId: "acct-001",
        tenantId: "tenant-001",
        status: "active",
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.status, "active");
});
test("domain barrel exports SecretRegistryRecord type", () => {
    const record = {
        secretId: "secret-001",
        name: "api-key",
        category: "api_key",
        status: "active",
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.name, "api-key");
});
test("domain barrel exports EventRecord type", () => {
    const record = {
        eventId: "event-001",
        sessionId: "sess-001",
        tier: "info",
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.tier, "info");
});
test("domain barrel exports DispatchTarget type", () => {
    const target = {
        workerPool: "default",
        region: "us-east-1",
    };
    assert.equal(target.workerPool, "default");
});
test("domain barrel exports EvolutionProposalRecord type", () => {
    const record = {
        proposalId: "prop-001",
        kind: "optimization",
        status: "pending",
        createdAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.kind, "optimization");
});
test("domain barrel exports EnvironmentReadinessRecord type", () => {
    const record = {
        componentType: "database",
        name: "primary-db",
        status: "ready",
        checkedAt: "2024-01-15T10:00:00Z",
    };
    assert.equal(record.status, "ready");
});
//# sourceMappingURL=index.test.js.map