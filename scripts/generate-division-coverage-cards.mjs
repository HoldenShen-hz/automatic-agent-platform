import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  AUTONOMY_BOUNDARY_ENUM,
  ensureDir,
  loadYamlObject,
  parseCliArgs,
  readJsonFile,
  resolvePlatformRoot,
  toIsoDate,
  toObjectArray,
  writeYamlFile,
} from "./ci/division-coverage-lib.mjs";

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (value != null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function pickAutonomyBoundary(familyPolicy, riskLevel) {
  if (typeof familyPolicy.defaultAutonomyBoundary === "string" && AUTONOMY_BOUNDARY_ENUM.includes(familyPolicy.defaultAutonomyBoundary)) {
    return familyPolicy.defaultAutonomyBoundary;
  }
  if (riskLevel === "critical") {
    return "no_autonomous_high_impact_action";
  }
  if (riskLevel === "high") {
    return "prepared_action_only";
  }
  return "draft_only";
}

function resolveEvidenceLastUpdatedAt(platformRoot, ref, fallback) {
  if (typeof ref !== "string" || ref.trim().length === 0) {
    return fallback;
  }
  const path = join(platformRoot, ref);
  if (!existsSync(path) || !path.endsWith(".yaml")) {
    return fallback;
  }
  const document = loadYamlObject(path);
  return typeof document.lastRefreshedAt === "string" ? document.lastRefreshedAt : fallback;
}

function buildEvidenceRef(ref, score, confidence, lastUpdatedAt) {
  return {
    score,
    refs: [ref],
    lastUpdatedAt,
    evaluator: "v3.3-coverage-generator",
    confidence,
  };
}

export function buildCoverageCards(options = {}) {
  const platformRoot = resolvePlatformRoot(options.platformRoot);
  const generatedAt = toIsoDate(options.now ?? "2026-06-01T00:00:00.000Z");
  const inventory = readJsonFile(join(platformRoot, "config", "division-coverage", "inventory", "division-inventory.generated.json"));
  if (!inventory || !Array.isArray(inventory.records)) {
    throw new Error("division_coverage.inventory_missing");
  }
  const cards = [];
  for (const record of toObjectArray(inventory.records)) {
    const divisionId = typeof record.divisionId === "string" ? record.divisionId : "unknown-division";
    const familyId = typeof record.familyId === "string" ? record.familyId : "unknown-family";
    const familyPolicy = loadYamlObject(join(platformRoot, "config", "division-coverage", "families", `${familyId}.yaml`));
    const existingPath = join(platformRoot, "config", "division-coverage", "divisions", `${divisionId}.yaml`);
    const existingCard = loadYamlObject(existingPath);
    const owner = typeof existingCard.owner === "string"
      ? existingCard.owner
      : typeof record.coverageOwner === "string"
        ? record.coverageOwner
        : typeof record.legacyFamily === "string"
          ? `${record.legacyFamily}-owner`
          : "TBD-owner";
    const blockers = Array.isArray(record.blockers) ? [...record.blockers] : [];
    const status = blockers.length === 0 && ["coding", "knowledge-base", "research", "customer-service", "support"].includes(divisionId)
      ? "pilot_ready"
      : blockers.length <= 1
        ? "coverage_draft"
        : "untracked";
    const riskLevel = typeof record.riskLevel === "string" ? record.riskLevel : "medium";
    const primaryEvalRef = Array.isArray(record.evalRefs) && record.evalRefs.length > 0 ? record.evalRefs[0] : "TBD://missing-eval";
    const primaryRedTeamRef = Array.isArray(record.redTeamRefs) && record.redTeamRefs.length > 0 ? record.redTeamRefs[0] : "TBD://missing-redteam";
    const primaryTrainingRef = Array.isArray(record.trainingPolicyRefs) && record.trainingPolicyRefs.length > 0 ? record.trainingPolicyRefs[0] : "TBD://missing-training-policy";
    const card = {
      generator: {
        managedBy: "scripts/generate-division-coverage-cards.mjs",
        generatedAt,
      },
      divisionId,
      familyId,
      status,
      riskLevel,
      autonomyBoundary: pickAutonomyBoundary(familyPolicy, riskLevel),
      owner,
      releaseGateRef: typeof familyPolicy.defaultReleaseGateRef === "string"
        ? familyPolicy.defaultReleaseGateRef
        : "docs_zh/releases/automatic_agent_platform_v3_3_release_readiness.md",
      raci: {
        owner,
        approver: `${familyId}-approver`,
        consulted: ["architecture-owner", "security-owner"],
        informed: ["release-owner"],
      },
      evidence: {
        design: buildEvidenceRef(`docs://docs_zh/reference/automatic_agent_platform_v3_3_detailed_todolist.md#${divisionId}`, 2, "medium", generatedAt),
        implementation: buildEvidenceRef(`inventory://config/division-coverage/inventory/division-inventory.generated.json#${divisionId}`, record.hasDivisionYaml === true ? 2 : 1, record.hasDivisionYaml === true ? "medium" : "low", generatedAt),
        evaluation: buildEvidenceRef(
          primaryEvalRef,
          record.hasEval === true ? 2 : 0,
          record.hasEval === true ? "medium" : "low",
          resolveEvidenceLastUpdatedAt(platformRoot, primaryEvalRef, generatedAt),
        ),
        operation: buildEvidenceRef(
          primaryRedTeamRef,
          record.hasRedTeam === true ? 2 : 0,
          record.hasRedTeam === true ? "medium" : "low",
          resolveEvidenceLastUpdatedAt(platformRoot, primaryRedTeamRef, generatedAt),
        ),
        flywheel: buildEvidenceRef(
          primaryTrainingRef,
          record.hasTrainingPolicy === true ? 1 : 0,
          record.hasTrainingPolicy === true ? "medium" : "low",
          generatedAt,
        ),
      },
      inventoryRefs: {
        scenarioRefs: Array.isArray(record.scenarioRefs) ? record.scenarioRefs : [],
        evalRefs: Array.isArray(record.evalRefs) ? record.evalRefs : [],
        redTeamRefs: Array.isArray(record.redTeamRefs) ? record.redTeamRefs : [],
        trainingPolicyRefs: Array.isArray(record.trainingPolicyRefs) ? record.trainingPolicyRefs : [],
        docRefs: Array.isArray(record.docRefs) ? record.docRefs : [],
      },
      blockers,
      notes: blockers.length === 0
        ? "Coverage card generated from inventory with no open structural blocker."
        : "Coverage card generated from inventory; blockers require follow-up before promotion.",
    };
    cards.push({
      divisionId,
      path: existingPath,
      value: card,
      preserveExisting: existsSync(existingPath) && readFileSync(existingPath, "utf8").includes("managedBy: manual"),
    });
  }
  return cards.sort((left, right) => left.divisionId.localeCompare(right.divisionId));
}

export function writeCoverageCards(cards) {
  for (const card of cards) {
    ensureDir(dirname(card.path));
    if (card.preserveExisting) {
      continue;
    }
    writeYamlFile(card.path, card.value);
  }
}

export function checkCoverageCards(cards) {
  const mismatches = [];
  for (const card of cards) {
    if (!existsSync(card.path)) {
      mismatches.push(`${card.divisionId}:missing`);
      continue;
    }
    if (card.preserveExisting) {
      continue;
    }
    const current = loadYamlObject(card.path);
    if (stableSerialize(current) !== stableSerialize(card.value)) {
      mismatches.push(`${card.divisionId}:drift`);
    }
  }
  return mismatches;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flags = parseCliArgs(process.argv.slice(2));
  const cards = buildCoverageCards({
    platformRoot: flags.root,
    now: flags.now,
  });
  if (flags.check === "true") {
    const mismatches = checkCoverageCards(cards);
    if (mismatches.length > 0) {
      console.error(`division_coverage.cards_out_of_date:${mismatches.join(",")}`);
      process.exitCode = 1;
    } else {
      console.log(`division_coverage.cards_ok:${cards.length}`);
    }
  } else {
    writeCoverageCards(cards);
    console.log(`division_coverage.cards_written:${cards.length}`);
  }
}
