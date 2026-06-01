import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  BLOCKER_CODES,
  DEFAULT_ALIAS_ENTRIES,
  DIVISION_STATUS_ENUM,
  RISK_LEVEL_ENUM,
  ensureDir,
  listFiles,
  loadYamlObject,
  parseCliArgs,
  readJsonFile,
  relativeToRoot,
  resolveCoverageFamilyId,
  resolvePlatformRoot,
  slugify,
  toIsoDate,
  toObjectArray,
  writeJsonFile,
  writeTextFile,
} from "./division-coverage-lib.mjs";

function readDivisionCatalog(platformRoot) {
  const catalogPath = join(platformRoot, "config", "quality", "division-catalog.json");
  const catalog = readJsonFile(catalogPath, {});
  return toObjectArray(catalog.divisions).map((entry) => ({
    divisionId: typeof entry.divisionId === "string" ? entry.divisionId : "unknown-division",
    legacyFamily: typeof entry.family === "string" ? entry.family : null,
    scope: typeof entry.scope === "string" ? entry.scope : null,
    canonicalDivisionId: typeof entry.canonicalDivisionId === "string" ? entry.canonicalDivisionId : null,
  }));
}

function buildPathSet(platformRoot, relativeRoot, matcher) {
  const root = join(platformRoot, relativeRoot);
  return new Set(
    (existsSync(root) ? listFiles(root, 6) : [])
      .map((path) => relativeToRoot(platformRoot, path))
      .filter((path) => matcher(path)),
  );
}

function resolveEvalPresence(platformRoot, divisionId) {
  const suitePath = join(platformRoot, "eval", "divisions", divisionId, "eval-suite.yaml");
  if (existsSync(suitePath)) {
    return { hasEval: true, evalRefs: [relativeToRoot(platformRoot, suitePath)] };
  }
  const datasetFiles = existsSync(join(platformRoot, "eval", "datasets"))
    ? listFiles(join(platformRoot, "eval", "datasets"), 4)
    : [];
  const evalRefs = datasetFiles
    .filter((path) => {
      if (!/\.(json|yaml|yml|md)$/i.test(path)) {
        return false;
      }
      const raw = path.toLowerCase();
      return raw.includes(divisionId.toLowerCase()) || raw.includes(slugify(divisionId));
    })
    .map((path) => relativeToRoot(platformRoot, path));
  return { hasEval: evalRefs.length > 0, evalRefs };
}

function buildReferenceIndex(platformRoot, roots, divisionIds) {
  const index = new Map(divisionIds.map((divisionId) => [divisionId, []]));
  const divisionsByKeyword = divisionIds.map((divisionId) => ({
    divisionId,
    keywords: [...new Set([divisionId.toLowerCase(), slugify(divisionId)])],
  }));
  for (const root of roots) {
    const absoluteRoot = join(platformRoot, root);
    if (!existsSync(absoluteRoot)) {
      continue;
    }
    for (const path of listFiles(absoluteRoot, 6)) {
      const relativePath = relativeToRoot(platformRoot, path);
      if (!/\.(md|mdx|ts|tsx|js|jsx|json|yaml|yml)$/i.test(relativePath)) {
        continue;
      }
      const normalized = relativePath.toLowerCase();
      for (const entry of divisionsByKeyword) {
        if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
          index.get(entry.divisionId)?.push(relativePath);
        }
      }
    }
  }
  for (const [divisionId, refs] of index) {
    index.set(divisionId, [...new Set(refs)].sort((left, right) => left.localeCompare(right)));
  }
  return index;
}

function validateRecordShape(record) {
  const missing = [];
  for (const key of [
    "divisionId",
    "normalizedDivisionId",
    "familyId",
    "status",
    "riskLevel",
    "hasDivisionYaml",
    "hasCoverageCard",
    "hasScenarioCard",
    "hasEval",
    "hasRedTeam",
    "hasTrainingPolicy",
    "hasOwner",
    "blockers",
  ]) {
    if (!(key in record)) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`division_inventory.invalid_record:${record.divisionId ?? "unknown"}:${missing.join(",")}`);
  }
  if (!DIVISION_STATUS_ENUM.includes(record.status)) {
    throw new Error(`division_inventory.invalid_status:${record.divisionId}:${record.status}`);
  }
  if (!RISK_LEVEL_ENUM.includes(record.riskLevel)) {
    throw new Error(`division_inventory.invalid_risk:${record.divisionId}:${record.riskLevel}`);
  }
  for (const blocker of record.blockers) {
    if (!BLOCKER_CODES.includes(blocker)) {
      throw new Error(`division_inventory.invalid_blocker:${record.divisionId}:${blocker}`);
    }
  }
}

function buildSummary(report) {
  const lines = [
    "# Division Inventory Summary",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    `Total divisions: ${report.summary.totalDivisions}`,
    `P0 divisions: ${report.summary.p0Divisions}`,
    `Blocked divisions: ${report.summary.blockedDivisions}`,
    `Orphan source modules: ${report.summary.orphanSourceModules}`,
    "",
    "| Division | Family | Status | Risk | Blockers |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const record of report.records) {
    lines.push(`| ${record.divisionId} | ${record.familyId ?? "unknown"} | ${record.status} | ${record.riskLevel} | ${record.blockers.join(", ") || "none"} |`);
  }
  if (report.diff.added.length > 0 || report.diff.removed.length > 0 || report.diff.changed.length > 0) {
    lines.push("", "## Diff", "", `Added: ${report.diff.added.join(", ") || "none"}`, `Removed: ${report.diff.removed.join(", ") || "none"}`);
    for (const entry of report.diff.changed) {
      lines.push(`Changed ${entry.divisionId}: ${entry.changes.join("; ")}`);
    }
  }
  return lines.join("\n");
}

export function buildDivisionInventory(options = {}) {
  const platformRoot = resolvePlatformRoot(options.platformRoot);
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? process.env.AA_FIXED_NOW ?? Date.now());
  const generatedAt = toIsoDate(now);
  const coverageRoot = join(platformRoot, "config", "division-coverage");
  const inventoryRoot = join(coverageRoot, "inventory");
  const previousInventory = readJsonFile(join(inventoryRoot, "division-inventory.generated.json"), { records: [] });
  const coverageCards = buildPathSet(platformRoot, "config/division-coverage/divisions", (path) => path.endsWith(".yaml"));
  const familyPolicies = buildPathSet(platformRoot, "config/division-coverage/families", (path) => path.endsWith(".yaml"));
  const redTeamSuites = buildPathSet(platformRoot, "redteam/divisions", (path) => path.endsWith("redteam-suite.yaml"));
  const trainingPolicies = buildPathSet(platformRoot, "training-data-policy/divisions", (path) => path.endsWith(".yaml"));
  const divisionYamlRoots = buildPathSet(platformRoot, "divisions", (path) => path.endsWith("/division.yaml"));
  const configDomainFiles = buildPathSet(platformRoot, "config/domains", (path) => path.endsWith(".json"));
  const sourceDomainRoots = new Set();
  const sourceDomainRoot = join(platformRoot, "src", "domains");
  if (existsSync(sourceDomainRoot)) {
    for (const entry of readdirSync(sourceDomainRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        continue;
      }
      sourceDomainRoots.add(entry.name);
    }
  }
  const pluginFiles = buildPathSet(platformRoot, "src/plugins", () => true);
  const scenariosByDivision = new Map();
  for (const path of listFiles(join(platformRoot, "config", "division-coverage", "scenarios"), 2)) {
    if (!path.endsWith(".yaml")) {
      continue;
    }
    const scenario = loadYamlObject(path);
    const divisionId = typeof scenario.divisionId === "string" ? scenario.divisionId : null;
    if (divisionId == null) {
      continue;
    }
    const current = scenariosByDivision.get(divisionId) ?? [];
    current.push(relativeToRoot(platformRoot, path));
    scenariosByDivision.set(divisionId, current);
  }

  const aliasEntries = loadYamlObject(join(coverageRoot, "aliases.yaml")).aliases ?? DEFAULT_ALIAS_ENTRIES;
  const aliasMap = new Map(
    toObjectArray(aliasEntries).map((entry) => [
      typeof entry.alias === "string" ? entry.alias : "",
      {
        canonical: typeof entry.canonical === "string" ? entry.canonical : null,
        mode: typeof entry.mode === "string" ? entry.mode : "deprecated_alias",
      },
    ]),
  );
  const catalogEntries = readDivisionCatalog(platformRoot);
  const catalogDivisionIds = new Set(catalogEntries.map((entry) => entry.divisionId));
  const coverageCardIds = new Set([...coverageCards].map((path) => path.split("/").pop()?.replace(/\.yaml$/, "")).filter(Boolean));
  const allDivisionIds = new Set([
    ...catalogEntries.map((entry) => entry.divisionId),
    ...[...divisionYamlRoots].map((path) => path.split("/")[1]),
    ...[...configDomainFiles].map((path) => path.split("/").pop()?.replace(/\.json$/, "")),
    ...sourceDomainRoots,
    ...coverageCardIds,
  ]);
  const allDivisionIdList = [...allDivisionIds].filter(Boolean).sort((left, right) => left.localeCompare(right));
  const docRefIndex = buildReferenceIndex(platformRoot, ["docs_zh", "docs_en"], allDivisionIdList);
  const testRefIndex = buildReferenceIndex(
    platformRoot,
    [
      "tests/unit/domains",
      "ui/tests/features",
      "ui/tests/unit/ui/packages/features",
    ],
    allDivisionIdList,
  );
  const uiRefIndex = buildReferenceIndex(platformRoot, ["ui/packages/features", "ui/apps/web/src"], allDivisionIdList);

  const records = allDivisionIdList
    .map((divisionId) => {
      const catalogEntry = catalogEntries.find((entry) => entry.divisionId === divisionId) ?? null;
      const normalizedDivisionId = slugify(catalogEntry?.canonicalDivisionId ?? aliasMap.get(divisionId)?.canonical ?? divisionId);
      const familyId = resolveCoverageFamilyId(normalizedDivisionId, catalogEntry?.legacyFamily ?? null);
      const divisionYamlPath = join(platformRoot, "divisions", divisionId, "division.yaml");
      const divisionYaml = loadYamlObject(divisionYamlPath);
      const coverageCardPath = join(platformRoot, "config", "division-coverage", "divisions", `${divisionId}.yaml`);
      const coverageCard = loadYamlObject(coverageCardPath);
      const hasDivisionYaml = existsSync(divisionYamlPath);
      const hasCoverageCard = existsSync(coverageCardPath);
      const hasScenarioCard = (scenariosByDivision.get(divisionId) ?? []).length > 0;
      const { hasEval, evalRefs } = resolveEvalPresence(platformRoot, divisionId);
      const redTeamPath = join(platformRoot, "redteam", "divisions", divisionId, "redteam-suite.yaml");
      const hasRedTeam = existsSync(redTeamPath);
      const trainingPolicyPath = join(platformRoot, "training-data-policy", "divisions", `${divisionId}.yaml`);
      const hasTrainingPolicy = existsSync(trainingPolicyPath);
      const hasOwner = typeof divisionYaml.domain_descriptor?.ownerOrgNodeId === "string"
        || typeof coverageCard.owner === "string";
      const riskLevel = typeof coverageCard.riskLevel === "string"
        ? coverageCard.riskLevel
        : typeof divisionYaml.risk_profile?.riskLevel === "string"
          ? divisionYaml.risk_profile.riskLevel
          : familyId === "regulated"
            ? "critical"
            : "medium";
      const explicitStatus = typeof coverageCard.status === "string" ? coverageCard.status : null;
      const status = explicitStatus
        ?? (["coding", "knowledge-base", "research", "customer-service", "support"].includes(divisionId)
          ? "pilot_ready"
          : hasCoverageCard
            ? "coverage_draft"
            : "untracked");
      const blockers = [];
      if (!hasDivisionYaml) blockers.push("missing_division_yaml");
      if (!sourceDomainRoots.has(divisionId) && !configDomainFiles.has(`config/domains/${divisionId}.json`)) blockers.push("missing_source_module");
      if (!hasOwner) blockers.push("missing_owner");
      if (!hasCoverageCard) blockers.push("missing_coverage_card");
      if (!familyPolicies.has(`config/division-coverage/families/${familyId}.yaml`)) blockers.push("missing_family_policy");
      if (familyId == null) blockers.push("unknown_family");
      if ((catalogEntry?.canonicalDivisionId ?? aliasMap.get(divisionId)?.canonical) != null) blockers.push("alias_only_division");
      if (["coding", "knowledge-base", "research", "customer-service", "support"].includes(divisionId)) {
        if (!hasScenarioCard) blockers.push("missing_scenario_card");
        if (!hasEval) blockers.push("missing_eval");
        if (!hasRedTeam) blockers.push("missing_redteam");
        if (!hasTrainingPolicy) blockers.push("missing_training_policy");
      }
      const record = {
        divisionId,
        normalizedDivisionId,
        familyId,
        legacyFamily: catalogEntry?.legacyFamily ?? null,
        status,
        riskLevel,
        hasDivisionYaml,
        hasCoverageCard,
        hasScenarioCard,
        hasEval,
        hasRedTeam,
        hasTrainingPolicy,
        hasOwner,
        coverageCardPath: hasCoverageCard ? relativeToRoot(platformRoot, coverageCardPath) : null,
        scenarioRefs: scenariosByDivision.get(divisionId) ?? [],
        evalRefs,
        redTeamRefs: hasRedTeam ? [relativeToRoot(platformRoot, redTeamPath)] : [],
        trainingPolicyRefs: hasTrainingPolicy ? [relativeToRoot(platformRoot, trainingPolicyPath)] : [],
        docRefs: docRefIndex.get(divisionId) ?? [],
        testRefs: testRefIndex.get(divisionId) ?? [],
        uiRefs: uiRefIndex.get(divisionId) ?? [],
        pluginRefs: [...pluginFiles].filter((path) => path.toLowerCase().includes(divisionId.toLowerCase())),
        blockers: [...new Set(blockers)].sort((left, right) => left.localeCompare(right)),
      };
      validateRecordShape(record);
      return record;
    });

  const previousRecords = new Map(toObjectArray(previousInventory.records).map((entry) => [entry.divisionId, entry]));
  const currentIds = new Set(records.map((entry) => entry.divisionId));
  const previousIds = new Set([...previousRecords.keys()]);
  const diff = {
    added: [...currentIds].filter((id) => !previousIds.has(id)).sort((left, right) => left.localeCompare(right)),
    removed: [...previousIds].filter((id) => !currentIds.has(id)).sort((left, right) => left.localeCompare(right)),
    changed: records.flatMap((record) => {
      const previous = previousRecords.get(record.divisionId);
      if (previous == null) {
        return [];
      }
      const changes = [];
      if (previous.status !== record.status) {
        changes.push(`status:${previous.status}->${record.status}`);
      }
      if (previous.familyId !== record.familyId) {
        changes.push(`family:${previous.familyId ?? "null"}->${record.familyId ?? "null"}`);
      }
      if (JSON.stringify(previous.blockers ?? []) !== JSON.stringify(record.blockers)) {
        changes.push(`blockers:${(previous.blockers ?? []).join(",")}=>${record.blockers.join(",")}`);
      }
      return changes.length > 0 ? [{ divisionId: record.divisionId, changes }] : [];
    }),
  };

  const orphanSourceModules = [...sourceDomainRoots]
    .filter((entry) => !catalogDivisionIds.has(entry))
    .sort((left, right) => left.localeCompare(right));

  const report = {
    generatedAt,
    records,
    diff,
    summary: {
      totalDivisions: records.length,
      p0Divisions: records.filter((record) => ["coding", "knowledge-base", "research", "customer-service", "support"].includes(record.divisionId)).length,
      blockedDivisions: records.filter((record) => record.blockers.length > 0).length,
      orphanSourceModules: orphanSourceModules.length,
    },
    orphans: {
      sourceModules: orphanSourceModules,
    },
  };

  return report;
}

export function writeDivisionInventoryReport(report, options = {}) {
  const platformRoot = resolvePlatformRoot(options.platformRoot);
  const inventoryRoot = join(platformRoot, "config", "division-coverage", "inventory");
  ensureDir(inventoryRoot);
  writeJsonFile(join(inventoryRoot, "division-inventory.generated.json"), report);
  writeJsonFile(join(inventoryRoot, "division-inventory.diff.json"), report.diff);
  writeTextFile(join(inventoryRoot, "division-inventory.summary.md"), buildSummary(report));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flags = parseCliArgs(process.argv.slice(2));
  const report = buildDivisionInventory({
    platformRoot: flags.root,
    now: flags.now,
  });
  writeDivisionInventoryReport(report, { platformRoot: flags.root });
  console.log(`division_inventory.generated:${report.records.length}`);
}
