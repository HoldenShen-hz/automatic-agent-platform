import assert from "node:assert/strict";
import test from "node:test";

import {
  buildModuleOwnershipRecords,
  classify,
  deriveDocTags,
  detectContractNames,
  detectEventNames,
  detectMetricNames,
  detectRoutes,
  inferOwner,
  inferRiskTags,
} from "../../../scripts/assurance/collect-source-inventory.mjs";

test("collect-source-inventory classifies review docs as docs_zh artifacts", () => {
  assert.deepEqual(
    classify("docs_zh/reviews/platforme-full-review-e.md"),
    { kind: "doc", plane: "docs_zh", module: "reviews" },
  );
});

test("collect-source-inventory classifies platform and domain code with stable plane/module boundaries", () => {
  assert.deepEqual(
    classify("src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/protocol-service.ts"),
    {
      kind: "code",
      plane: "five-plane-orchestration",
      module: "agent-delegation/collaboration-protocol",
    },
  );

  assert.deepEqual(
    classify("src/platform/stability/stable-release-gate.ts"),
    {
      kind: "code",
      plane: "stability",
      module: "root",
    },
  );

  assert.deepEqual(
    classify("src/domains/registry/domain-registry-service.ts"),
    {
      kind: "code",
      plane: "domains",
      module: "registry",
    },
  );
});

test("collect-source-inventory derives review-specific document tags", () => {
  const tags = deriveDocTags(
    "docs_zh/reviews/platforme-full-review-e.md",
    "baseline verification\nproduction-ready\n问题清单\n需要重新验证\n",
  );

  assert.ok(tags.includes("review_source"));
  assert.ok(tags.includes("issue_source"));
  assert.ok(tags.includes("claim_source"));
  assert.ok(tags.includes("verification_source"));
  assert.ok(tags.includes("historical_snapshot"));
});

test("collect-source-inventory detects route, event, contract, and metric tokens", () => {
  assert.deepEqual(
    detectRoutes('router.get("/v1/tasks", handler);\napp.post("/v1/tasks", submitTask);'),
    [
      { method: "GET", path: "/v1/tasks" },
      { method: "POST", path: "/v1/tasks" },
    ],
  );

  assert.deepEqual(
    detectEventNames('const topic = "execution.status_changed";\nconst stream = "audit.receipt.appended";'),
    ["execution.status_changed", "audit.receipt.appended"],
  );

  assert.deepEqual(
    detectContractNames("export interface ReleaseGate {}\nclass StableEvidenceBundle {}\ntype GateReport = {};"),
    ["ReleaseGate", "StableEvidenceBundle", "GateReport"],
  );

  assert.deepEqual(
    detectMetricNames(
      'counter("release_gate_blocked_total");\n'
        + 'const metric = "stable.validation.duration_ms";\n'
        + 'const descriptor = { name: "tenant.isolation.audit_total", type: "counter" };',
    ),
    [
      "release_gate_blocked_total",
      "tenant.isolation.audit_total",
      "stable.validation.duration_ms",
    ],
  );
});

test("collect-source-inventory infers risk tags and owners for security-critical paths", () => {
  const riskTags = inferRiskTags(
    "src/org-governance/auth/tenant-access-service.ts",
    "tenantId approval secret token storage",
  );

  assert.ok(riskTags.includes("tenant"));
  assert.ok(riskTags.includes("secret"));
  assert.equal(
    inferOwner("src/org-governance/auth/tenant-access-service.ts", classify("src/org-governance/auth/tenant-access-service.ts"), riskTags),
    "security-reviewer",
  );
});

test("collect-source-inventory builds module ownership records with supporting tests, contracts, and ci gates", () => {
  const modules = buildModuleOwnershipRecords([
    {
      path: "src/platform/five-plane-execution/lease/execution-lease-service.ts",
      kind: "code",
      plane: "five-plane-execution",
      module: "lease",
      owner: "execution-reviewer",
      riskTags: ["execution", "tenant"],
    },
    {
      path: "tests/unit/platform/execution/lease/execution-lease-service.test.ts",
      kind: "test",
      plane: "tests",
      module: "unit",
      owner: "ui-reviewer",
      riskTags: [],
    },
    {
      path: "docs_zh/contracts/execution_lease_contract.md",
      kind: "contract",
      plane: "docs_zh",
      module: "execution_lease_contract.md",
      owner: "platform-architect",
      riskTags: [],
    },
  ]);

  assert.equal(modules.length, 1);
  const moduleRecord = modules[0]!;
  assert.equal(moduleRecord.moduleId, "code:five-plane-execution:lease");
  assert.equal(moduleRecord.hasTests, true);
  assert.equal(moduleRecord.hasContract, true);
  assert.ok(moduleRecord.supportingTests[0]?.includes("execution-lease-service.test.ts"));
  assert.ok(moduleRecord.supportingContracts[0]?.includes("execution_lease_contract.md"));
  assert.ok(moduleRecord.ciGates.includes("audit:tenant-isolation"));
  assert.ok(moduleRecord.ciGates.includes("test:invariants"));
});
