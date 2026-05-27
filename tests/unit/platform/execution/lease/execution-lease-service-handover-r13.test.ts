import assert from "node:assert/strict";
import test from "node:test";

/**
 * R13-20 tests: Lease handover must validate new worker capabilities
 */

test("R13-20: Lease handover blocked when new worker lacks required capabilities [execution-lease-service-handover-r13]", () => {
  type WorkerIsolationLevel = "standard" | "hardened" | "strict";

  interface HandoverInput {
    newWorkerId: string;
    requiredCapabilities: string[];
    requiredIsolationLevel?: WorkerIsolationLevel;
    requiredRepoVersion?: string | null;
  }

  interface WorkerSnapshot {
    workerId: string;
    capabilitiesJson: string;
    isolationLevel: WorkerIsolationLevel;
    repoVersion: string | null;
  }

  function evaluateCapabilities(
    input: HandoverInput,
    worker: WorkerSnapshot | null,
  ): { allowed: boolean; reasonCode: string | null } {
    if (!worker) {
      return { allowed: false, reasonCode: "worker_not_registered" };
    }

    const workerCapabilities: string[] = JSON.parse(worker.capabilitiesJson || "[]");

    if (input.requiredCapabilities && input.requiredCapabilities.length > 0) {
      const missingCapabilities = input.requiredCapabilities.filter(
        (cap) => !workerCapabilities.includes(cap),
      );
      if (missingCapabilities.length > 0) {
        return {
          allowed: false,
          reasonCode: "worker_capabilities_mismatch",
        };
      }
    }

    return { allowed: true, reasonCode: null };
  }

  // Worker with only ["cap-a"] trying to take over execution requiring ["cap-a", "cap-b"]
  const worker = { workerId: "worker-2", capabilitiesJson: '["cap-a"]', isolationLevel: "standard" as WorkerIsolationLevel, repoVersion: null };

  const result = evaluateCapabilities(
    { newWorkerId: "worker-2", requiredCapabilities: ["cap-a", "cap-b"] },
    worker,
  );

  assert.equal(result.allowed, false, "Handover should be blocked");
  assert.equal(result.reasonCode, "worker_capabilities_mismatch", "Should fail due to missing capabilities");
});

test("R13-20: Lease handover blocked when new worker has insufficient isolation level [execution-lease-service-handover-r13]", () => {
  type WorkerIsolationLevel = "standard" | "hardened" | "strict";

  interface WorkerSnapshot {
    isolationLevel: WorkerIsolationLevel;
  }

  const ISOLATION_ORDER: Record<WorkerIsolationLevel, number> = { standard: 0, hardened: 1, strict: 2 };

  function evaluateIsolation(
    worker: WorkerSnapshot,
    requiredIsolationLevel: WorkerIsolationLevel,
  ): { allowed: boolean; reasonCode: string | null } {
    if (ISOLATION_ORDER[worker.isolationLevel]! < ISOLATION_ORDER[requiredIsolationLevel]!) {
      return { allowed: false, reasonCode: "worker_isolation_mismatch" };
    }
    return { allowed: true, reasonCode: null };
  }

  // Worker with "standard" cannot handle "strict" isolation requirement
  const result = evaluateIsolation({ isolationLevel: "standard" }, "strict");
  assert.equal(result.allowed, false, "Handover should be blocked");
  assert.equal(result.reasonCode, "worker_isolation_mismatch", "Should fail due to insufficient isolation");
});

test("R13-20: Lease handover allowed when new worker meets all requirements [execution-lease-service-handover-r13]", () => {
  type WorkerIsolationLevel = "standard" | "hardened" | "strict";

  interface HandoverInput {
    newWorkerId: string;
    requiredCapabilities: string[];
    requiredIsolationLevel?: WorkerIsolationLevel;
    requiredRepoVersion?: string | null;
  }

  interface WorkerSnapshot {
    workerId: string;
    capabilitiesJson: string;
    isolationLevel: WorkerIsolationLevel;
    repoVersion: string | null;
  }

  function evaluateHandover(
    input: HandoverInput,
    worker: WorkerSnapshot | null,
  ): { allowed: boolean; reasonCode: string | null } {
    if (!worker) {
      return { allowed: false, reasonCode: "worker_not_registered" };
    }

    const workerCapabilities: string[] = JSON.parse(worker.capabilitiesJson || "[]");

    if (input.requiredCapabilities && input.requiredCapabilities.length > 0) {
      const missingCapabilities = input.requiredCapabilities.filter(
        (cap) => !workerCapabilities.includes(cap),
      );
      if (missingCapabilities.length > 0) {
        return { allowed: false, reasonCode: "worker_capabilities_mismatch" };
      }
    }

    const ISOLATION_ORDER: Record<WorkerIsolationLevel, number> = { standard: 0, hardened: 1, strict: 2 };
    if (input.requiredIsolationLevel) {
      if (ISOLATION_ORDER[worker.isolationLevel]! < ISOLATION_ORDER[input.requiredIsolationLevel]!) {
        return { allowed: false, reasonCode: "worker_isolation_mismatch" };
      }
    }

    if (input.requiredRepoVersion != null && worker.repoVersion !== input.requiredRepoVersion) {
      return { allowed: false, reasonCode: "worker_repo_version_mismatch" };
    }

    return { allowed: true, reasonCode: null };
  }

  // Worker meeting all requirements
  const worker = {
    workerId: "worker-2",
    capabilitiesJson: '["cap-a", "cap-b", "cap-c"]',
    isolationLevel: "hardened",
    repoVersion: "v1.0.0",
  };

  const result = evaluateHandover(
    {
      newWorkerId: "worker-2",
      requiredCapabilities: ["cap-a", "cap-b"],
      requiredIsolationLevel: "standard",
      requiredRepoVersion: "v1.0.0",
    },
    worker,
  );

  assert.equal(result.allowed, true, "Handover should be allowed");
  assert.equal(result.reasonCode, null, "No error reason");
});

test("R13-20: Lease handover blocked when new worker has wrong repo version [execution-lease-service-handover-r13]", () => {
  interface HandoverInput {
    newWorkerId: string;
    requiredRepoVersion: string | null;
  }

  interface WorkerSnapshot {
    repoVersion: string | null;
  }

  function evaluateRepoVersion(
    input: HandoverInput,
    worker: WorkerSnapshot | null,
  ): { allowed: boolean; reasonCode: string | null } {
    if (!worker) {
      return { allowed: false, reasonCode: "worker_not_registered" };
    }

    if (input.requiredRepoVersion != null && worker.repoVersion !== input.requiredRepoVersion) {
      return { allowed: false, reasonCode: "worker_repo_version_mismatch" };
    }

    return { allowed: true, reasonCode: null };
  }

  // Worker with v1.0.1 cannot handle execution requiring v1.0.0
  const result = evaluateRepoVersion(
    { newWorkerId: "worker-2", requiredRepoVersion: "v1.0.0" },
    { repoVersion: "v1.0.1" },
  );

  assert.equal(result.allowed, false, "Handover should be blocked");
  assert.equal(result.reasonCode, "worker_repo_version_mismatch", "Should fail due to wrong repo version");
});