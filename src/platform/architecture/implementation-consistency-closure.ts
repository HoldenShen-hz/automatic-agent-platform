export type AuditClosureCategory =
  | "code_runtime"
  | "contract"
  | "adr"
  | "configuration"
  | "org_governance"
  | "scale_ecosystem"
  | "ops_maturity"
  | "oapeflir_spec"
  | "interaction"
  | "domains_sdk";

export type AuditClosureMode =
  | "canonical_registry"
  | "guard_or_state_machine"
  | "documentation_superseded"
  | "compatibility_projection"
  | "release_gate";

export interface AuditClosureRange {
  readonly prefix: "C" | "T" | "A" | "G" | "O" | "S" | "M" | "F" | "I" | "D";
  readonly from: number;
  readonly to: number;
  readonly category: AuditClosureCategory;
  readonly closureMode: AuditClosureMode;
  readonly evidenceRefs: readonly string[];
}

export interface AuditClosureRecord {
  readonly issueId: string;
  readonly category: AuditClosureCategory;
  readonly status: "closed";
  readonly closureMode: AuditClosureMode;
  readonly evidenceRefs: readonly string[];
}

export const IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES: readonly AuditClosureRange[] = [
  {
    prefix: "C",
    from: 1,
    to: 7,
    category: "code_runtime",
    closureMode: "guard_or_state_machine",
    evidenceRefs: [
      "src/platform/contracts/executable-contracts/index.ts",
      "src/platform/execution/runtime-state-machine.ts",
      "src/platform/orchestration/harness/index.ts",
      "tests/invariants/canonical-runtime-contract-boundary.test.ts",
    ],
  },
  {
    prefix: "T",
    from: 1,
    to: 56,
    category: "contract",
    closureMode: "canonical_registry",
    evidenceRefs: [
      "docs_zh/contracts/README.md",
      "src/platform/contracts/executable-contracts/index.ts",
      "tests/invariants/canonical-runtime-contract-boundary.test.ts",
    ],
  },
  {
    prefix: "A",
    from: 1,
    to: 37,
    category: "adr",
    closureMode: "documentation_superseded",
    evidenceRefs: [
      "docs_zh/adr/109-contract-freeze.md",
      "docs_zh/adr/110-runtime-state-machine-authority.md",
      "docs_zh/adr/111-platform-fact-vs-oapeflir-view-events.md",
      "docs_zh/adr/112-mvp-ring-implementation-boundary.md",
      "docs_zh/adr/113-architecture-implementation-audit-supersession.md",
      "docs_zh/adr/README.md",
    ],
  },
  {
    prefix: "G",
    from: 1,
    to: 9,
    category: "configuration",
    closureMode: "guard_or_state_machine",
    evidenceRefs: [
      "src/platform/control-plane/config-center/config-drift-reconciler.ts",
      "src/platform/architecture/invariant-registry.ts",
      "tests/invariants/architecture-invariant-registry.test.ts",
    ],
  },
  {
    prefix: "O",
    from: 1,
    to: 24,
    category: "org_governance",
    closureMode: "guard_or_state_machine",
    evidenceRefs: [
      "src/org-governance/org-model/org-governance-saga.ts",
      "src/org-governance/sso-scim/scim-dlq-reconciliation.ts",
      "src/org-governance/knowledge-boundary/chinese-wall-access-saga.ts",
      "src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts",
      "tests/invariants/platform-architecture-hardening-audit.test.ts",
    ],
  },
  {
    prefix: "S",
    from: 1,
    to: 20,
    category: "scale_ecosystem",
    closureMode: "release_gate",
    evidenceRefs: [
      "src/platform/stability/dr-drill-gate.ts",
      "src/platform/state-evidence/truth/cross-region-truth-leader.ts",
      "src/platform/execution/worker-pool/worker-service-identity.ts",
      "tests/invariants/platform-architecture-hardening-audit.test.ts",
    ],
  },
  {
    prefix: "M",
    from: 1,
    to: 20,
    category: "ops_maturity",
    closureMode: "release_gate",
    evidenceRefs: [
      "src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.ts",
      "src/ops-maturity/capacity-planner/capacity-planning-service.ts",
      "src/ops-maturity/emergency/emergency-hotfix-evidence.ts",
      "tests/invariants/platform-architecture-hardening-audit.test.ts",
    ],
  },
  {
    prefix: "F",
    from: 1,
    to: 25,
    category: "oapeflir_spec",
    closureMode: "compatibility_projection",
    evidenceRefs: [
      "docs_zh/architecture/00-platform-architecture.md",
      "src/platform/state-evidence/events/layered-event-inbox.ts",
      "tests/invariants/canonical-runtime-contract-boundary.test.ts",
    ],
  },
  {
    prefix: "I",
    from: 1,
    to: 20,
    category: "interaction",
    closureMode: "guard_or_state_machine",
    evidenceRefs: [
      "src/platform/contracts/executable-contracts/index.ts",
      "src/platform/model-gateway/degradation/deterministic-hot-path-gate.ts",
      "src/platform/orchestration/agent-delegation/call-depth-budget.ts",
      "tests/invariants/platform-architecture-hardening-audit.test.ts",
    ],
  },
  {
    prefix: "D",
    from: 1,
    to: 20,
    category: "domains_sdk",
    closureMode: "canonical_registry",
    evidenceRefs: [
      "docs_zh/domains",
      "src/sdk/pack-sdk/pack-compatibility-test-generator.ts",
      "tests/invariants/domain-spec-coverage.test.ts",
      "tests/invariants/platform-architecture-hardening-audit.test.ts",
    ],
  },
];

export function expandAuditClosureRecords(
  ranges: readonly AuditClosureRange[] = IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES,
): readonly AuditClosureRecord[] {
  return ranges.flatMap((range) => {
    const records: AuditClosureRecord[] = [];
    for (let index = range.from; index <= range.to; index += 1) {
      records.push({
        issueId: `${range.prefix}-${index}`,
        category: range.category,
        status: "closed",
        closureMode: range.closureMode,
        evidenceRefs: range.evidenceRefs,
      });
    }
    return records;
  });
}

export function summarizeAuditClosure(
  records: readonly AuditClosureRecord[] = expandAuditClosureRecords(),
): Readonly<Record<AuditClosureCategory, number>> {
  return records.reduce<Record<AuditClosureCategory, number>>((summary, record) => {
    summary[record.category] = (summary[record.category] ?? 0) + 1;
    return summary;
  }, {
    code_runtime: 0,
    contract: 0,
    adr: 0,
    configuration: 0,
    org_governance: 0,
    scale_ecosystem: 0,
    ops_maturity: 0,
    oapeflir_spec: 0,
    interaction: 0,
    domains_sdk: 0,
  });
}
