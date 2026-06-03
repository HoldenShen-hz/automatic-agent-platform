#!/usr/bin/env node
/**
 * Assurance Layer: completeness coverage matrix
 *
 * Turns methodology §21 from prose into a machine-readable matrix that shows,
 * per problem domain, whether the current repository has evidence for:
 *   - static scanning
 *   - dynamic tests
 *   - manual architecture review
 *   - historical promise reconciliation
 *   - CI / release gates
 *   - regression seeds
 *   - source / evidence / owner coverage
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");

const DOMAIN_DEFINITIONS = [
  {
    id: "release_claim_distortion",
    label: "Release claim 失真",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: true,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["release_claims"],
    testPaths: ["tests/audit-tools/release-claims-auditor.test.ts"],
    gateCommands: ["audit:release-claims", "audit:leadership-claims"],
    seedGates: ["audit-release-claims"],
    patterns: [/release claim/i, /production-ready/i, /industry-leading/i, /行业领先/i, /final release/i],
  },
  {
    id: "contract_schema_runtime_drift",
    label: "Contract/schema/runtime drift",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: true,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["contracts_sync", "docs_sot"],
    testPaths: ["tests/audit-tools/contracts-sync-auditor.test.ts"],
    gateCommands: ["audit:contracts-sync", "audit:docs-sot"],
    seedGates: ["audit-contracts-sync", "audit-docs-sot"],
    patterns: [/contract/i, /schema/i, /runtime drift/i, /文档漂移/i, /合同漂移/i],
  },
  {
    id: "tenant_isolation",
    label: "Tenant isolation",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: false,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["tenant_isolation"],
    testPaths: ["tests/audit-tools/tenant-isolation-auditor.test.ts", "tests/redteam/p0/cross-tenant-access.test.ts"],
    gateCommands: ["audit:tenant-isolation"],
    seedGates: ["audit-tenant-isolation"],
    patterns: [/tenant/i, /租户/i, /cross-tenant/i],
  },
  {
    id: "secret_leakage",
    label: "Secret leakage",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: false,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["secret_sinks"],
    testPaths: ["tests/audit-tools/secret-sinks-auditor.test.ts"],
    gateCommands: ["audit:secret-sinks"],
    seedGates: ["audit-secret-sinks"],
    patterns: [/secret/i, /credential/i, /敏感/i, /泄漏/i],
  },
  {
    id: "plugin_sbom_signature",
    label: "Plugin/SBOM/signature",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: true,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["plugin_security"],
    testPaths: ["tests/audit-tools/plugin-security-auditor.test.ts"],
    gateCommands: ["audit:plugin-security"],
    seedGates: ["audit-plugin-security"],
    patterns: [/plugin/i, /sbom/i, /signature/i, /签名/i],
  },
  {
    id: "queue_idempotency",
    label: "Queue/idempotency",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: false,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["idempotency", "queue"],
    testPaths: ["tests/invariants/dispatcher-admission-invariants.test.ts"],
    gateCommands: ["audit:idempotency", "audit:queue", "test:invariant:idempotency", "test:invariant:queue"],
    seedGates: ["audit-idempotency"],
    patterns: [/queue/i, /幂等/i, /idempoten/i],
  },
  {
    id: "lease_fencing",
    label: "Lease/fencing",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: false,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["lease_fencing"],
    testPaths: ["tests/unit/scale-ecosystem/multi-region/failover-controller-comprehensive.test.ts"],
    gateCommands: ["audit:lease-fencing", "test:invariant:lease-fencing"],
    seedGates: [],
    patterns: [/lease/i, /fencing/i, /租约/i],
  },
  {
    id: "side_effect_receipt",
    label: "Side-effect/receipt",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: true,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["side_effect_receipt", "receipt_verification", "event_outbox"],
    testPaths: ["tests/invariants/no-side-effect-in-replay.test.ts"],
    gateCommands: ["audit:side-effect-receipt", "audit:receipt-verification", "audit:event-outbox"],
    seedGates: [],
    patterns: [/side-effect/i, /receipt/i, /回执/i, /副作用/i, /outbox/i],
  },
  {
    id: "audit_evidence_chain",
    label: "Audit/evidence chain",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: true,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["audit_chain", "receipt_verification", "event_outbox"],
    testPaths: ["tests/invariants/truth-event-atomicity.test.ts"],
    gateCommands: ["audit:audit-chain", "audit:receipt-verification", "audit:event-outbox"],
    seedGates: [],
    patterns: [/audit/i, /evidence/i, /证据链/i, /审计链/i],
  },
  {
    id: "eval_redteam_golden_fake_pass",
    label: "Eval/redteam/golden fake pass",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: true,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["eval_oracle"],
    testPaths: [
      "tests/audit-tools/eval-oracle-auditor.test.ts",
      "tests/audit-tools/redteam-auditor.test.ts",
      "tests/audit-tools/golden-auditor.test.ts",
    ],
    gateCommands: ["audit:eval-oracle", "test:redteam:p0", "test:golden:strict"],
    seedGates: ["audit-eval-oracle", "audit-redteam", "audit-golden"],
    patterns: [/eval/i, /redteam/i, /golden/i, /fake pass/i, /假通过/i],
  },
  {
    id: "ui_token_operator_safety",
    label: "UI token/operator safety",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: false,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["ui_token_storage"],
    testPaths: ["tests/audit-tools/ui-token-storage-auditor.test.ts"],
    gateCommands: ["audit:ui-token-storage"],
    seedGates: ["audit-ui-token-storage"],
    patterns: [/ui/i, /token/i, /operator/i, /接管/i, /takeover/i],
  },
  {
    id: "scripts_path_ci_supply_chain",
    label: "Scripts/path/CI supply-chain",
    required: {
      staticScan: true,
      dynamicTest: true,
      manualReview: true,
      historicalPromise: false,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["path_safety", "test_disabled"],
    testPaths: ["tests/audit-tools/path-safety-auditor.test.ts", "tests/audit-tools/test-disabled-auditor.test.ts"],
    gateCommands: ["audit:path-safety", "audit:test-disabled", "audit:repo-hygiene"],
    seedGates: ["audit-path-safety", "audit-test-disabled"],
    patterns: [/path/i, /ci/i, /workflow/i, /supply-chain/i, /脚本/i],
  },
  {
    id: "architecture_boundary",
    label: "Architecture boundary",
    required: {
      staticScan: true,
      dynamicTest: false,
      manualReview: true,
      historicalPromise: true,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["architecture_boundary"],
    testPaths: ["tests/audit-tools/architecture-boundary-auditor.test.ts"],
    gateCommands: ["audit:architecture-boundary", "audit:public-entrypoints"],
    seedGates: ["audit-architecture-boundary"],
    patterns: [/architecture/i, /boundary/i, /边界/i, /cross-plane/i],
  },
  {
    id: "docs_adr_sot_drift",
    label: "Docs/ADR/SOT drift",
    required: {
      staticScan: true,
      dynamicTest: false,
      manualReview: true,
      historicalPromise: true,
      ciGate: true,
      regressionSeed: true,
    },
    auditIds: ["docs_sot", "contracts_sync"],
    testPaths: ["tests/audit-tools/docs-sot-auditor.test.ts", "tests/audit-tools/contracts-sync-auditor.test.ts"],
    gateCommands: ["audit:docs-sot", "audit:docs-sync", "audit:contracts-sync"],
    seedGates: ["audit-docs-sot", "audit-contracts-sync"],
    patterns: [/docs/i, /adr/i, /source of truth/i, /sot/i, /文档/i],
  },
];

function readJsonIfExists(path) {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readJsonlIfExists(path) {
  if (!existsSync(path)) {
    return [];
  }
  const records = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    try {
      records.push(JSON.parse(line));
    } catch {
      // Ignore broken lines; the matrix should expose weak coverage, not crash.
    }
  }
  return records;
}

function normalizeAuditId(id) {
  return String(id ?? "").replace(/-/g, "_");
}

function normalizeGateName(name) {
  if (typeof name !== "string" || name.length === 0) {
    return "";
  }
  if (name.startsWith("audit:")) {
    return name.replace("audit:", "audit-");
  }
  return name;
}

function matchesPatterns(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function recordMatches(record, patterns) {
  const haystack = [
    record?.title,
    record?.description,
    record?.category,
    record?.sourceFile,
    record?.promiseText,
  ]
    .filter(Boolean)
    .join(" ");
  return matchesPatterns(haystack, patterns);
}

function buildEvidenceRefs(refs) {
  return [...new Set(refs.filter(Boolean))];
}

function buildMarkdown(report) {
  const lines = [
    "# Completeness Coverage Matrix",
    "",
    `> Generated: ${report.generatedAt}`,
    `> Domain count: ${report.domainCount}`,
    "",
    "| Problem Domain | Status | Static | Dynamic | Manual | Promise | Gate | Seed | Owner |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.domains.map((domain) =>
      `| ${domain.label} | ${domain.status} | ${domain.coverage.staticScan.present ? "Y" : "N"} | ${domain.coverage.dynamicTest.present ? "Y" : "N"} | ${domain.coverage.manualReview.present ? "Y" : "N"} | ${domain.coverage.historicalPromise.present ? "Y" : "N"} | ${domain.coverage.ciGate.present ? "Y" : "N"} | ${domain.coverage.regressionSeed.present ? "Y" : "N"} | ${domain.coverage.ownerCoverage.present ? "Y" : "N"} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const stamp = new Date().toISOString();

  const staticAuditReport = readJsonIfExists(join(outputRoot, "static-audit-report.json"));
  const reviewLedger = readJsonlIfExists(join(outputRoot, "review-ledger.normalized.jsonl"));
  const issues = readJsonlIfExists(join(outputRoot, "issues.deduped.jsonl"));
  const historicalPromises = readJsonlIfExists(join(outputRoot, "historical-promises.jsonl"));
  const seededDefects = readJsonIfExists(join(outputRoot, "seeded-defect-report.json"))?.results ?? [];
  const packageJson = readJsonIfExists(join(repoRoot, "package.json")) ?? {};
  const rcCheckSource = existsSync(join(repoRoot, "scripts", "assurance", "rc-check.mjs"))
    ? readFileSync(join(repoRoot, "scripts", "assurance", "rc-check.mjs"), "utf8")
    : "";
  const ciBaseline = packageJson.scripts?.["ci:baseline"] ?? "";
  const reviewEvidence = readJsonIfExists(join(outputRoot, "review-evidence-readiness-report.json"))?.reviewSources ?? [];

  const staticAuditIds = new Set(
    Array.isArray(staticAuditReport?.audits)
      ? staticAuditReport.audits.map((audit) => normalizeAuditId(audit.id))
      : [],
  );
  const seededGateSet = new Set(
    seededDefects
      .filter((result) => Array.isArray(result.seeds) && result.seeds.every((seed) => seed.pass === true))
      .map((result) => normalizeGateName(result.gate)),
  );

  const domains = DOMAIN_DEFINITIONS.map((definition) => {
    const matchedReviews = reviewLedger.filter((record) => recordMatches(record, definition.patterns));
    const matchedIssues = issues.filter((record) => recordMatches(record, definition.patterns));
    const matchedPromises = historicalPromises.filter((record) => recordMatches(record, definition.patterns));
    const matchedReviewEvidence = reviewEvidence.filter((record) => matchesPatterns(record.sourceFile, definition.patterns));
    const staticAuditsPresent = definition.auditIds.filter((auditId) => staticAuditIds.has(normalizeAuditId(auditId)));
    const dynamicTestsPresent = definition.testPaths.filter((testPath) => existsSync(join(repoRoot, testPath)));
    const ciGatesPresent = definition.gateCommands.filter((gateCommand) =>
      ciBaseline.includes(gateCommand) || rcCheckSource.includes(gateCommand) || rcCheckSource.includes(`npm run ${gateCommand}`)
    );
    const seededGatesPresent = definition.seedGates.filter((gate) => seededGateSet.has(normalizeGateName(gate)));

    const coverage = {
      sourceCoverage: {
        present: matchedReviews.length > 0 || matchedIssues.length > 0 || matchedPromises.length > 0,
        evidenceRefs: buildEvidenceRefs([
          matchedReviews[0]?.sourceFile,
          matchedIssues[0]?.sourceRef,
          matchedPromises[0]?.sourceFile,
        ]),
      },
      staticScan: {
        present: staticAuditsPresent.length > 0,
        evidenceRefs: staticAuditsPresent.map((auditId) => `static-audit:${auditId}`),
      },
      dynamicTest: {
        present: dynamicTestsPresent.length > 0,
        evidenceRefs: dynamicTestsPresent,
      },
      manualReview: {
        present: matchedReviews.length > 0 || matchedReviewEvidence.length > 0,
        evidenceRefs: buildEvidenceRefs([
          matchedReviews[0]?.sourceFile,
          matchedReviewEvidence[0]?.sourceFile,
        ]),
      },
      historicalPromise: {
        present: matchedPromises.length > 0,
        evidenceRefs: matchedPromises.slice(0, 3).map((record) => `${record.sourceFile}#${record.sourceSection}`),
      },
      ciGate: {
        present: ciGatesPresent.length > 0,
        evidenceRefs: ciGatesPresent,
      },
      regressionSeed: {
        present: seededGatesPresent.length > 0,
        evidenceRefs: seededGatesPresent,
      },
      evidenceCoverage: {
        present:
          matchedReviews.some((record) => (record.evidenceRefs ?? []).length > 0) ||
          matchedIssues.some((record) => (record.evidence ?? []).length > 0),
        evidenceRefs: buildEvidenceRefs([
          matchedReviews.find((record) => (record.evidenceRefs ?? []).length > 0)?.sourceFile,
          matchedIssues.find((record) => (record.evidence ?? []).length > 0)?.sourceRef,
        ]),
      },
      ownerCoverage: {
        present: matchedIssues.some((record) => record.owner && record.owner !== "TBD"),
        evidenceRefs: matchedIssues
          .filter((record) => record.owner && record.owner !== "TBD")
          .slice(0, 3)
          .map((record) => `${record.issueId}:${record.owner}`),
      },
    };

    const missingRequirements = [];
    for (const [dimension, required] of Object.entries(definition.required)) {
      if (required && coverage[dimension].present !== true) {
        missingRequirements.push(dimension);
      }
    }
    if (!coverage.sourceCoverage.present) {
      missingRequirements.push("sourceCoverage");
    }
    if (!coverage.evidenceCoverage.present) {
      missingRequirements.push("evidenceCoverage");
    }
    if (!coverage.ownerCoverage.present) {
      missingRequirements.push("ownerCoverage");
    }

    const status =
      missingRequirements.length === 0
        ? "pass"
        : missingRequirements.length >= 6
          ? "fail"
          : "partial";

    return {
      domainId: definition.id,
      label: definition.label,
      status,
      missingRequirements,
      coverage,
    };
  });

  const report = {
    generatedAt: stamp,
    domainCount: domains.length,
    summary: {
      passCount: domains.filter((domain) => domain.status === "pass").length,
      partialCount: domains.filter((domain) => domain.status === "partial").length,
      failCount: domains.filter((domain) => domain.status === "fail").length,
    },
    domains,
  };

  writeFileSync(
    join(outputRoot, "completeness-coverage-matrix.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(outputRoot, "completeness-coverage-matrix.md"),
    buildMarkdown(report),
    "utf8",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        generatedAt: stamp,
        domainCount: report.domainCount,
        summary: report.summary,
        outputs: {
          json: "artifacts/assurance/completeness-coverage-matrix.json",
          md: "artifacts/assurance/completeness-coverage-matrix.md",
        },
      },
      null,
      2,
    )}\n`,
  );
}

main();
