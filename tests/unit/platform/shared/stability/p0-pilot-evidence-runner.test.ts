import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

import {
  buildP0PilotEvidencePackage,
  runAllP0PilotEvidence,
  writeP0PilotEvidenceArtifacts,
  type CodingEvalCase,
  type CustomerServiceEvalCase,
  type KnowledgeEvalCase,
  type P0PilotBenchmarkComparisonResult,
  type P0PilotObservationInput,
  type P0PilotRedTeamCaseResult,
  type P0PilotRoiSample,
} from "../../../../../src/platform/shared/stability/p0-pilot-evidence-runner.js";

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function writeJson(path: string, value: unknown): void {
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function createWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "aa-p0-pilot-evidence-"));
}

function seedConfig(workspace: string): void {
  writeFile(join(workspace, "config", "division-coverage", "family-readiness.yaml"), [
    "families:",
    "  - familyId: engineering",
    "    displayName: Engineering",
    "    readinessStatus: local_leadership_ready",
    "    targetClaimLevel: local_leader",
    "    owner: engineering-owner",
    "    canonicalFamilies: [engineering]",
    "    canonicalDivisions: [coding]",
    "    benchmarkRefs: [swe-bench-verified]",
    "    minimumEvidenceRef: engineering-core",
    "    notes: \"issue to patch\"",
    "  - familyId: knowledge-research",
    "    displayName: Knowledge / Research",
    "    readinessStatus: local_leadership_ready",
    "    targetClaimLevel: local_leader",
    "    owner: knowledge-owner",
    "    canonicalFamilies: [knowledge]",
    "    canonicalDivisions: [knowledge-base]",
    "    benchmarkRefs: [rag-citation-eval]",
    "    minimumEvidenceRef: knowledge-core",
    "    notes: \"grounding first\"",
    "  - familyId: enterprise-ops",
    "    displayName: Enterprise Ops",
    "    readinessStatus: pilot_ready",
    "    targetClaimLevel: pilot_ready",
    "    owner: ops-owner",
    "    canonicalFamilies: [operations]",
    "    canonicalDivisions: [customer-service]",
    "    benchmarkRefs: [tau-bench]",
    "    minimumEvidenceRef: enterprise-ops-core",
    "    notes: \"policy first\"",
  ].join("\n"));
  writeFile(join(workspace, "config", "division-coverage", "benchmark-map.yaml"), [
    "families:",
    "  - familyId: engineering",
    "    benchmarks:",
    "      - benchmarkId: swe-bench-verified",
    "        label: SWE-bench Verified",
    "        url: \"https://example.com/swe\"",
    "        purpose: \"correctness\"",
    "    internalMappings:",
    "      - metricId: patch_correctness",
    "        description: \"correct patch output\"",
    "      - metricId: pr_acceptance",
    "        description: \"human reviewers accept output\"",
    "  - familyId: knowledge-research",
    "    benchmarks:",
    "      - benchmarkId: rag-citation-eval",
    "        label: RAG citation evaluation",
    "        url: \"https://example.com/rag\"",
    "        purpose: \"citation grounding\"",
    "    internalMappings:",
    "      - metricId: citation_verifier_pass_rate",
    "        description: \"citation verifier pass rate\"",
    "      - metricId: experiment_link_coverage",
    "        description: \"conclusions link to evidence\"",
    "  - familyId: enterprise-ops",
    "    benchmarks:",
    "      - benchmarkId: tau-bench",
    "        label: tau-bench",
    "        url: \"https://example.com/tau\"",
    "        purpose: \"policy adherence\"",
    "    internalMappings:",
    "      - metricId: policy_adherence",
    "        description: \"policy adherence rate\"",
    "      - metricId: sla_handoff",
    "        description: \"handoff correctness\"",
  ].join("\n"));
  writeFile(join(workspace, "config", "division-coverage", "minimum-leading-evidence.yaml"), [
    "families:",
    "  - familyId: engineering",
    "    minimumEvidenceId: engineering-core",
    "    mvpThresholds:",
    "      - label: Internal SWE-style tasks",
    "        requirement: \">=50\"",
    "      - label: AWI red-team cases",
    "        requirement: \">=30\"",
    "      - label: Real pilot PRs",
    "        requirement: \">=10\"",
    "    leadershipThresholds:",
    "      - label: Internal SWE-style tasks",
    "        requirement: \">=200\"",
    "      - label: AWI red-team cases",
    "        requirement: \">=100\"",
    "      - label: Real pilot PRs",
    "        requirement: \">=50\"",
    "  - familyId: knowledge-research",
    "    minimumEvidenceId: knowledge-core",
    "    mvpThresholds:",
    "      - label: Citation evaluation cases",
    "        requirement: \">=100\"",
    "      - label: Experiment-linked conclusions",
    "        requirement: \">=20\"",
    "      - label: Stale doc checks",
    "        requirement: \"required\"",
    "    leadershipThresholds:",
    "      - label: Citation evaluation cases",
    "        requirement: \">=500\"",
    "      - label: Experiment-linked conclusions",
    "        requirement: \">=100\"",
    "      - label: Stale doc checks",
    "        requirement: \"automated\"",
    "  - familyId: enterprise-ops",
    "    minimumEvidenceId: enterprise-ops-core",
    "    mvpThresholds:",
    "      - label: Tau-style cases",
    "        requirement: \">=100\"",
    "      - label: Policy tests",
    "        requirement: \">=50\"",
    "      - label: Pilot tasks",
    "        requirement: \">=50\"",
    "    leadershipThresholds:",
    "      - label: Tau-style cases",
    "        requirement: \">=500\"",
    "      - label: Policy tests",
    "        requirement: \">=300\"",
    "      - label: Pilot tasks",
    "        requirement: \">=500\"",
  ].join("\n"));
  writeFile(join(workspace, "roi", "divisions", "coding.yaml"), [
    "divisionId: coding",
    "minimumSampleSize: 50",
  ].join("\n"));
  writeFile(join(workspace, "roi", "divisions", "knowledge-base.yaml"), [
    "divisionId: knowledge-base",
    "minimumSampleSize: 100",
  ].join("\n"));
  writeFile(join(workspace, "roi", "divisions", "customer-service.yaml"), [
    "divisionId: customer-service",
    "minimumSampleSize: 100",
  ].join("\n"));
}

function createCodingEvalCases(count: number): CodingEvalCase[] {
  return Array.from({ length: count }, (_, index) => ({
    caseId: `coding-${index + 1}`,
    patchApplied: true,
    targetedTestsPassed: true,
    p2pPreserved: true,
    changedPaths: [`src/file-${index + 1}.ts`],
    generatedCommands: ["npm test -- file"],
    secretFindings: [],
    evidenceRefs: [`eval://coding/${index + 1}`],
    humanEditDistance: 0.1,
    prDrafted: true,
  }));
}

function createKnowledgeEvalCases(count: number): KnowledgeEvalCase[] {
  return Array.from({ length: count }, (_, index) => ({
    caseId: `knowledge-${index + 1}`,
    claims: [
      {
        claimId: `claim-${index + 1}-a`,
        text: "Supported claim",
        citationId: `cite-${index + 1}-a`,
        sourceId: `source-${index + 1}-a`,
        supported: true,
        sourceDate: "2026-04-01T00:00:00.000Z",
      },
      {
        claimId: `claim-${index + 1}-b`,
        text: "Another supported claim",
        citationId: `cite-${index + 1}-b`,
        sourceId: `source-${index + 1}-b`,
        supported: true,
        sourceDate: "2026-04-02T00:00:00.000Z",
      },
    ],
  }));
}

function createCustomerServiceEvalCases(count: number): CustomerServiceEvalCase[] {
  return Array.from({ length: count }, (_, index) => ({
    caseId: `support-${index + 1}`,
    policyMatched: true,
    toolArgumentsValid: true,
    handoffCorrect: true,
    requiresHitl: false,
    hitlApproved: true,
  }));
}

function createRedTeamCases(count: number): P0PilotRedTeamCaseResult[] {
  return Array.from({ length: count }, (_, index) => ({
    caseId: `rt-${index + 1}`,
    severity: index === 0 ? "critical" : "high",
    outcome: "blocked",
    evidenceRefs: [`redteam://case/${index + 1}`],
  }));
}

function createRoiSamples(count: number): P0PilotRoiSample[] {
  return Array.from({ length: count }, (_, index) => ({
    sampleId: `roi-${index + 1}`,
    baselineDurationMinutes: 60,
    assistedDurationMinutes: 30,
    baselineCostUsd: 40,
    assistedCostUsd: 25,
    baselineQualityScore: 0.9,
    assistedQualityScore: 0.94,
    baselineRiskScore: 0.2,
    assistedRiskScore: 0.1,
  }));
}

function createPilotObservations(count: number, metadata: P0PilotObservationInput["metadata"] = {}): P0PilotObservationInput {
  return {
    observations: Array.from({ length: count }, (_, index) => ({
      observationId: `pilot-${index + 1}`,
      status: "completed",
      humanApproved: true,
      evidenceLinked: true,
    })),
    metadata,
  };
}

function seedDivisionInput(
  workspace: string,
  divisionId: "coding" | "knowledge-base" | "customer-service",
  payload: {
    readonly evalCases: readonly unknown[];
    readonly redTeamCases: readonly P0PilotRedTeamCaseResult[];
    readonly roiSamples: readonly P0PilotRoiSample[];
    readonly benchmarkComparisons: readonly P0PilotBenchmarkComparisonResult[];
    readonly pilotObservations: P0PilotObservationInput;
  },
): void {
  const root = join(workspace, "data", "pilot-evidence-inputs", divisionId);
  writeJson(join(root, "eval-cases.json"), { cases: payload.evalCases });
  writeJson(join(root, "redteam-results.json"), { cases: payload.redTeamCases });
  writeJson(join(root, "roi-samples.json"), { samples: payload.roiSamples });
  writeJson(join(root, "benchmark-results.json"), { comparisons: payload.benchmarkComparisons });
  writeJson(join(root, "pilot-observations.json"), payload.pilotObservations);
}

test("buildP0PilotEvidencePackage marks engineering evidence as mvp_ready when real thresholds are met", () => {
  const workspace = createWorkspace();
  try {
    seedConfig(workspace);
    seedDivisionInput(workspace, "coding", {
      evalCases: createCodingEvalCases(50),
      redTeamCases: createRedTeamCases(30),
      roiSamples: createRoiSamples(50),
      benchmarkComparisons: [
        {
          benchmarkId: "swe-bench-verified",
          metricId: "patch_correctness",
          comparison: "gte",
          internalValue: 0.93,
          externalBaselineValue: 0.9,
        },
        {
          benchmarkId: "swe-bench-verified",
          metricId: "pr_acceptance",
          comparison: "gte",
          internalValue: 0.85,
          externalBaselineValue: 0.8,
        },
      ],
      pilotObservations: createPilotObservations(10),
    });

    const report = buildP0PilotEvidencePackage("coding", {
      platformRoot: workspace,
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    assert.equal(report.familyId, "engineering");
    assert.equal(report.eval.caseCount, 50);
    assert.equal(report.eval.passed, true);
    assert.equal(report.redTeam.caseCount, 30);
    assert.equal(report.roi.sampleCount, 50);
    assert.equal(report.thresholds.mvpPassed, true);
    assert.equal(report.thresholds.leadershipPassed, false);
    assert.equal(report.verdict.status, "mvp_ready");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("buildP0PilotEvidencePackage marks knowledge evidence as leadership_ready when leadership thresholds and component checks are met", () => {
  const workspace = createWorkspace();
  try {
    seedConfig(workspace);
    seedDivisionInput(workspace, "knowledge-base", {
      evalCases: createKnowledgeEvalCases(500),
      redTeamCases: createRedTeamCases(100),
      roiSamples: createRoiSamples(200),
      benchmarkComparisons: [
        {
          benchmarkId: "rag-citation-eval",
          metricId: "citation_verifier_pass_rate",
          comparison: "gte",
          internalValue: 0.98,
          externalBaselineValue: 0.95,
        },
        {
          benchmarkId: "rag-citation-eval",
          metricId: "experiment_link_coverage",
          comparison: "gte",
          internalValue: 0.96,
          externalBaselineValue: 0.9,
        },
      ],
      pilotObservations: createPilotObservations(120, {
        staleDocChecksAutomated: true,
        staleDocChecksCompleted: true,
      }),
    });

    const report = buildP0PilotEvidencePackage("knowledge-base", {
      platformRoot: workspace,
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    assert.equal(report.familyId, "knowledge-research");
    assert.equal(report.eval.caseCount, 500);
    assert.equal(report.thresholds.leadershipPassed, true);
    assert.equal(report.verdict.status, "leadership_ready");
    assert.equal(report.roi.confidence, "high");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("runAllP0PilotEvidence writes aggregate artifacts and keeps enterprise ops insufficient when benchmark mapping is invalid", () => {
  const workspace = createWorkspace();
  try {
    seedConfig(workspace);
    seedDivisionInput(workspace, "coding", {
      evalCases: createCodingEvalCases(50),
      redTeamCases: createRedTeamCases(30),
      roiSamples: createRoiSamples(50),
      benchmarkComparisons: [
        {
          benchmarkId: "swe-bench-verified",
          metricId: "patch_correctness",
          comparison: "gte",
          internalValue: 0.93,
          externalBaselineValue: 0.9,
        },
      ],
      pilotObservations: createPilotObservations(10),
    });
    seedDivisionInput(workspace, "knowledge-base", {
      evalCases: createKnowledgeEvalCases(100),
      redTeamCases: createRedTeamCases(20),
      roiSamples: createRoiSamples(100),
      benchmarkComparisons: [
        {
          benchmarkId: "rag-citation-eval",
          metricId: "citation_verifier_pass_rate",
          comparison: "gte",
          internalValue: 0.97,
          externalBaselineValue: 0.95,
        },
      ],
      pilotObservations: createPilotObservations(20, {
        staleDocChecksCompleted: true,
      }),
    });
    seedDivisionInput(workspace, "customer-service", {
      evalCases: createCustomerServiceEvalCases(100),
      redTeamCases: createRedTeamCases(30),
      roiSamples: createRoiSamples(100),
      benchmarkComparisons: [
        {
          benchmarkId: "tau-bench",
          metricId: "unknown_metric",
          comparison: "gte",
          internalValue: 0.9,
          externalBaselineValue: 0.8,
        },
      ],
      pilotObservations: createPilotObservations(50, {
        policyTestCount: 40,
      }),
    });

    const aggregate = runAllP0PilotEvidence({
      platformRoot: workspace,
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    assert.equal(aggregate.divisionCount, 3);
    assert.equal(aggregate.summary.insufficientEvidenceCount, 1);
    const customerService = aggregate.artifacts.find((entry) => entry.divisionId === "customer-service");
    assert.equal(customerService?.status, "insufficient_evidence");
    assert.deepEqual(customerService?.report.benchmark.validationErrors, ["unknown_metric:unknown_metric"]);

    const persisted = JSON.parse(
      readFileSync(join(workspace, "artifacts", "validation", "p0-pilot-evidence", "p0-pilot-evidence-report.json"), "utf8"),
    ) as { divisionCount: number };
    assert.equal(persisted.divisionCount, 3);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("writeP0PilotEvidenceArtifacts writes JSON and markdown summaries for a single division", () => {
  const workspace = createWorkspace();
  try {
    seedConfig(workspace);
    seedDivisionInput(workspace, "coding", {
      evalCases: createCodingEvalCases(50),
      redTeamCases: createRedTeamCases(30),
      roiSamples: createRoiSamples(50),
      benchmarkComparisons: [
        {
          benchmarkId: "swe-bench-verified",
          metricId: "patch_correctness",
          comparison: "gte",
          internalValue: 0.91,
          externalBaselineValue: 0.9,
        },
      ],
      pilotObservations: createPilotObservations(10),
    });
    const report = buildP0PilotEvidencePackage("coding", {
      platformRoot: workspace,
      now: new Date("2026-06-01T00:00:00.000Z"),
    });
    const artifact = writeP0PilotEvidenceArtifacts(report, { platformRoot: workspace });
    assert.equal(artifact.status, "mvp_ready");
    assert.match(readFileSync(artifact.markdownPath, "utf8"), /Verdict: mvp_ready/u);
    assert.equal(JSON.parse(readFileSync(artifact.jsonPath, "utf8")).divisionId, "coding");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("buildP0PilotEvidencePackage rejects malformed real input instead of silently coercing it", () => {
  const workspace = createWorkspace();
  try {
    seedConfig(workspace);
    writeJson(join(workspace, "data", "pilot-evidence-inputs", "coding", "eval-cases.json"), {
      cases: [
        {
          caseId: "coding-001",
          patchApplied: "yes",
          targetedTestsPassed: true,
          p2pPreserved: true,
          changedPaths: ["src/example.ts"],
          generatedCommands: ["npm test"],
          secretFindings: [],
        },
      ],
    });
    writeJson(join(workspace, "data", "pilot-evidence-inputs", "coding", "redteam-results.json"), {
      cases: createRedTeamCases(30),
    });
    writeJson(join(workspace, "data", "pilot-evidence-inputs", "coding", "roi-samples.json"), {
      samples: createRoiSamples(50),
    });
    writeJson(join(workspace, "data", "pilot-evidence-inputs", "coding", "benchmark-results.json"), {
      comparisons: [
        {
          benchmarkId: "swe-bench-verified",
          metricId: "patch_correctness",
          comparison: "gte",
          internalValue: 0.91,
          externalBaselineValue: 0.9,
        },
      ],
    });
    writeJson(join(workspace, "data", "pilot-evidence-inputs", "coding", "pilot-observations.json"), createPilotObservations(10));

    assert.throws(
      () => buildP0PilotEvidencePackage("coding", {
        platformRoot: workspace,
        now: new Date("2026-06-01T00:00:00.000Z"),
      }),
      /pilot_evidence\.invalid_boolean:coding\.eval\.cases\[0\]\.patchApplied/u,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
