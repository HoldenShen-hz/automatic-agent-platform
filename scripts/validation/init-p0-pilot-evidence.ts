import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  CodingEvalCase,
  CustomerServiceEvalCase,
  KnowledgeEvalCase,
  P0PilotBenchmarkComparisonResult,
  P0PilotObservationInput,
  P0PilotRedTeamCaseResult,
  P0PilotRoiSample,
} from "../../src/platform/shared/stability/p0-pilot-evidence-runner.js";

const DIVISIONS = ["coding", "knowledge-base", "customer-service"] as const;
type TemplateDivisionId = (typeof DIVISIONS)[number];

export interface InitP0PilotEvidenceOptions {
  readonly platformRoot?: string;
  readonly inputRoot?: string;
  readonly force?: boolean;
}

function resolveDefaultPlatformRoot(): string {
  return dirname(dirname(dirname(fileURLToPath(import.meta.url))));
}

function resolveInputRootWithinPlatform(platformRoot: string, inputRoot?: string): string {
  const defaultRoot = join(platformRoot, "data", "pilot-evidence-inputs");
  const resolved = resolve(inputRoot ?? process.env.AA_PILOT_EVIDENCE_INPUT_ROOT ?? defaultRoot);
  const allowedRoot = `${resolve(join(platformRoot, "data"))}/`;
  if (resolved !== resolve(join(platformRoot, "data")) && !resolved.startsWith(allowedRoot)) {
    throw new Error(`pilot_evidence.invalid_input_root:${resolved}`);
  }
  return resolved;
}

function writeJsonFile(path: string, value: unknown, force: boolean): void {
  if (!force && existsSync(path)) {
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function codingEvalTemplate(): { cases: readonly CodingEvalCase[] } {
  return {
    cases: [
      {
        caseId: "coding-001",
        patchApplied: true,
        targetedTestsPassed: true,
        p2pPreserved: true,
        changedPaths: ["src/example.ts"],
        generatedCommands: ["npm run test:unit -- tests/unit/example.test.ts"],
        secretFindings: [],
        evidenceRefs: ["ticket://ENG-1001", "ci://run-1001"],
        humanEditDistance: 0.2,
        prDrafted: true,
      },
    ],
  };
}

function knowledgeEvalTemplate(): { cases: readonly KnowledgeEvalCase[] } {
  return {
    cases: [
      {
        caseId: "knowledge-001",
        claims: [
          {
            claimId: "claim-001",
            text: "结论必须可追溯到权威来源。",
            citationId: "cite-001",
            sourceId: "source-001",
            supported: true,
            sourceDate: "2026-05-20T00:00:00.000Z",
          },
        ],
      },
    ],
  };
}

function customerServiceEvalTemplate(): { cases: readonly CustomerServiceEvalCase[] } {
  return {
    cases: [
      {
        caseId: "support-001",
        policyMatched: true,
        toolArgumentsValid: true,
        handoffCorrect: true,
        requiresHitl: false,
        hitlApproved: true,
      },
    ],
  };
}

function redTeamTemplate(): { cases: readonly P0PilotRedTeamCaseResult[] } {
  return {
    cases: [
      {
        caseId: "redteam-001",
        severity: "high",
        outcome: "blocked",
        evidenceRefs: ["redteam://case-001"],
      },
    ],
  };
}

function roiTemplate(): { samples: readonly P0PilotRoiSample[] } {
  return {
    samples: [
      {
        sampleId: "roi-001",
        baselineDurationMinutes: 60,
        assistedDurationMinutes: 32,
        baselineCostUsd: 45,
        assistedCostUsd: 28,
        baselineQualityScore: 0.9,
        assistedQualityScore: 0.94,
        baselineRiskScore: 0.2,
        assistedRiskScore: 0.1,
      },
    ],
  };
}

function codingBenchmarkTemplate(): { comparisons: readonly P0PilotBenchmarkComparisonResult[] } {
  return {
    comparisons: [
      {
        benchmarkId: "swe-bench-verified",
        metricId: "patch_correctness",
        internalValue: 0.92,
        externalBaselineValue: 0.9,
        comparison: "gte",
        evidenceRefs: ["benchmark://coding/patch-correctness"],
      },
    ],
  };
}

function knowledgeBenchmarkTemplate(): { comparisons: readonly P0PilotBenchmarkComparisonResult[] } {
  return {
    comparisons: [
      {
        benchmarkId: "rag-citation-eval",
        metricId: "citation_verifier_pass_rate",
        internalValue: 0.97,
        externalBaselineValue: 0.95,
        comparison: "gte",
        evidenceRefs: ["benchmark://knowledge/citation-pass-rate"],
      },
    ],
  };
}

function customerServiceBenchmarkTemplate(): { comparisons: readonly P0PilotBenchmarkComparisonResult[] } {
  return {
    comparisons: [
      {
        benchmarkId: "tau-bench",
        metricId: "policy_adherence",
        internalValue: 0.94,
        externalBaselineValue: 0.9,
        comparison: "gte",
        evidenceRefs: ["benchmark://customer-service/policy-adherence"],
      },
    ],
  };
}

function codingPilotTemplate(): P0PilotObservationInput {
  return {
    observations: [
      {
        observationId: "pilot-pr-001",
        status: "completed",
        humanApproved: true,
        evidenceLinked: true,
      },
    ],
    metadata: {
      note: "真实 PR / code review / CI 证据请替换示例值。",
    },
  };
}

function knowledgePilotTemplate(): P0PilotObservationInput {
  return {
    observations: [
      {
        observationId: "pilot-knowledge-001",
        status: "completed",
        humanApproved: true,
        evidenceLinked: true,
      },
    ],
    metadata: {
      staleDocChecksCompleted: true,
      staleDocChecksAutomated: false,
      note: "真实 experiment / source refresh / review evidence 请替换示例值。",
    },
  };
}

function customerServicePilotTemplate(): P0PilotObservationInput {
  return {
    observations: [
      {
        observationId: "pilot-support-001",
        status: "completed",
        humanApproved: true,
        evidenceLinked: true,
      },
    ],
    metadata: {
      policyTestCount: 1,
      note: "真实 ticket / SLA / handoff evidence 请替换示例值。",
    },
  };
}

function writeDivisionTemplates(root: string, divisionId: TemplateDivisionId, force: boolean): void {
  const divisionRoot = join(root, divisionId);
  const benchmarkTemplate = divisionId === "coding"
    ? codingBenchmarkTemplate()
    : divisionId === "knowledge-base"
      ? knowledgeBenchmarkTemplate()
      : customerServiceBenchmarkTemplate();
  const pilotTemplate = divisionId === "coding"
    ? codingPilotTemplate()
    : divisionId === "knowledge-base"
      ? knowledgePilotTemplate()
      : customerServicePilotTemplate();
  const evalTemplate = divisionId === "coding"
    ? codingEvalTemplate()
    : divisionId === "knowledge-base"
      ? knowledgeEvalTemplate()
      : customerServiceEvalTemplate();

  writeJsonFile(join(divisionRoot, "eval-cases.json"), evalTemplate, force);
  writeJsonFile(join(divisionRoot, "redteam-results.json"), redTeamTemplate(), force);
  writeJsonFile(join(divisionRoot, "roi-samples.json"), roiTemplate(), force);
  writeJsonFile(join(divisionRoot, "benchmark-results.json"), benchmarkTemplate, force);
  writeJsonFile(join(divisionRoot, "pilot-observations.json"), pilotTemplate, force);
  writeJsonFile(join(divisionRoot, "README.json"), {
    divisionId,
    requiredFiles: [
      "eval-cases.json",
      "redteam-results.json",
      "roi-samples.json",
      "benchmark-results.json",
      "pilot-observations.json",
    ],
    note: "将示例值替换为真实 pilot / eval / red-team / ROI / benchmark 数据后，再运行 npm run pilot:evidence:p0。",
  }, force);
}

export function initP0PilotEvidence(options: InitP0PilotEvidenceOptions = {}): {
  readonly inputRoot: string;
  readonly divisions: readonly TemplateDivisionId[];
  readonly force: boolean;
} {
  const platformRoot = options.platformRoot
    ?? process.env.AA_PLATFORM_ROOT
    ?? resolveDefaultPlatformRoot();
  const inputRoot = resolveInputRootWithinPlatform(platformRoot, options.inputRoot);
  const force = options.force ?? process.argv.includes("--force");
  mkdirSync(inputRoot, { recursive: true });
  for (const divisionId of DIVISIONS) {
    writeDivisionTemplates(inputRoot, divisionId, force);
  }
  return { inputRoot, divisions: DIVISIONS, force };
}

if (process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = initP0PilotEvidence();
    console.log(`p0 pilot evidence templates initialized: ${result.inputRoot}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
