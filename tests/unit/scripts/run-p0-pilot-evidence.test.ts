import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

type PilotEvidenceCliModule = {
  runP0PilotEvidenceCli: (options?: {
    platformRoot?: string;
    inputRoot?: string;
    outputRoot?: string;
    divisionId?: "coding" | "knowledge-base" | "customer-service";
    now?: Date;
  }) => { mode: "all" | "coding" | "knowledge-base" | "customer-service"; artifactPath: string };
};

const pilotEvidenceCli = await import(
  new URL("../../../scripts/validation/run-p0-pilot-evidence.ts", import.meta.url).href
) as PilotEvidenceCliModule;
const scriptPath = join(process.cwd(), "scripts", "validation", "run-p0-pilot-evidence.ts");

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function writeJson(path: string, value: unknown): void {
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function seedWorkspace(workspace: string): void {
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
  ].join("\n"));
  writeFile(join(workspace, "roi", "divisions", "coding.yaml"), [
    "divisionId: coding",
    "minimumSampleSize: 50",
  ].join("\n"));
  writeJson(join(workspace, "data", "pilot-evidence-inputs", "coding", "eval-cases.json"), {
    cases: Array.from({ length: 50 }, (_, index) => ({
      caseId: `coding-${index + 1}`,
      patchApplied: true,
      targetedTestsPassed: true,
      p2pPreserved: true,
      changedPaths: [`src/file-${index + 1}.ts`],
      generatedCommands: ["npm test -- file"],
      secretFindings: [],
      prDrafted: true,
    })),
  });
  writeJson(join(workspace, "data", "pilot-evidence-inputs", "coding", "redteam-results.json"), {
    cases: Array.from({ length: 30 }, (_, index) => ({
      caseId: `rt-${index + 1}`,
      severity: "high",
      outcome: "blocked",
    })),
  });
  writeJson(join(workspace, "data", "pilot-evidence-inputs", "coding", "roi-samples.json"), {
    samples: Array.from({ length: 50 }, (_, index) => ({
      sampleId: `roi-${index + 1}`,
      baselineDurationMinutes: 60,
      assistedDurationMinutes: 30,
      baselineCostUsd: 50,
      assistedCostUsd: 30,
      baselineQualityScore: 0.9,
      assistedQualityScore: 0.95,
      baselineRiskScore: 0.2,
      assistedRiskScore: 0.1,
    })),
  });
  writeJson(join(workspace, "data", "pilot-evidence-inputs", "coding", "benchmark-results.json"), {
    comparisons: [
      {
        benchmarkId: "swe-bench-verified",
        metricId: "patch_correctness",
        comparison: "gte",
        internalValue: 0.94,
        externalBaselineValue: 0.9,
      },
    ],
  });
  writeJson(join(workspace, "data", "pilot-evidence-inputs", "coding", "pilot-observations.json"), {
    observations: Array.from({ length: 10 }, (_, index) => ({
      observationId: `pilot-${index + 1}`,
      status: "completed",
      humanApproved: true,
      evidenceLinked: true,
    })),
  });
}

test("runP0PilotEvidenceCli exports a single-division evidence package", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-p0-cli-"));
  try {
    seedWorkspace(workspace);
    const result = pilotEvidenceCli.runP0PilotEvidenceCli({
      platformRoot: workspace,
      divisionId: "coding",
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    assert.equal(result.mode, "coding");
    assert.equal(JSON.parse(readFileSync(result.artifactPath, "utf8")).verdict.status, "mvp_ready");
    assert.match(
      readFileSync(join(workspace, "artifacts", "validation", "p0-pilot-evidence", "coding", "summary.md"), "utf8"),
      /Engineering \/ coding P0 Pilot Evidence/u,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("run-p0-pilot-evidence CLI accepts spaced flags and rejects unknown flags", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-p0-cli-flags-"));
  try {
    seedWorkspace(workspace);
    const ok = spawnSync(
      process.execPath,
      ["--import", "tsx", scriptPath, "--platform-root", workspace, "--division", "coding"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
    assert.equal(ok.status, 0, `${ok.stdout}\n${ok.stderr}`);

    const bad = spawnSync(
      process.execPath,
      ["--import", "tsx", scriptPath, "--platform-root", workspace, "--unknown", "value"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
    assert.equal(bad.status, 1, `${bad.stdout}\n${bad.stderr}`);
    assert.match(bad.stderr, /pilot_evidence\.unknown_flag:--unknown/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
