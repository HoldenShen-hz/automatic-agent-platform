import assert from "node:assert/strict";
import test from "node:test";

test("domain barrel exports primitive aliases", () => {
  const timestamp: import("../../../../../../src/platform/contracts/types/domain/index.js").Timestamp = "2024-01-15T10:00:00Z";
  const priority: import("../../../../../../src/platform/contracts/types/domain/index.js").TaskPriority = "high";
  const workerStatus: import("../../../../../../src/platform/contracts/types/domain/index.js").WorkerStatus = "idle";
  const leaseStatus: import("../../../../../../src/platform/contracts/types/domain/index.js").LeaseStatus = "active";

  assert.equal(timestamp, "2024-01-15T10:00:00Z");
  assert.equal(priority, "high");
  assert.equal(workerStatus, "idle");
  assert.equal(leaseStatus, "active");
});

test("domain barrel exports record types", () => {
  type _ExecutionRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").ExecutionRecord;
  type _TaskRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").TaskRecord;
  type _WorkflowStateRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").WorkflowStateRecord;
  type _SessionRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").SessionRecord;
  type _WorkspaceRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").WorkspaceRecord;
  type _TenantRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").TenantRecord;
  type _OrganizationRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").OrganizationRecord;
  type _ReleaseBundleRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").ReleaseBundleRecord;
  type _BillingAccountRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").BillingAccountRecord;
  type _SecretRegistryRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").SecretRegistryRecord;
  type _EventRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").EventRecord;
  type _DispatchTarget = import("../../../../../../src/platform/contracts/types/domain/index.js").DispatchTarget;
  type _EvolutionProposalRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").EvolutionProposalRecord;
  type _EnvironmentReadinessRecord = import("../../../../../../src/platform/contracts/types/domain/index.js").EnvironmentReadinessRecord;

  assert.ok(true);
});
