import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EVENT_SCHEMA_REGISTRY } from "../../src/platform/five-plane-state-evidence/events/event-registry.js";
import { VALIDATION_SPAN_NAMES } from "../../src/platform/shared/observability/validation-semantic-conventions.js";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const artifactRoot = join(root, "artifacts/validation/platform/contracts");
const schemaRoot = join(root, "artifacts/validation/platform/schemas");
const eventPayloadSchemaRoot = join(schemaRoot, "event-payload-schemas");
const generatedRoot = join(root, "artifacts/validation/platform/generated");
const registry = readJson(
  "config/validation/platform-validation-registry.json",
) as PlatformValidationRegistry;
const metricMap = readJson(
  "config/validation/platform-monitoring-metric-map.json",
) as PlatformMonitoringMetricMap;
const runbookMetadata = readJson(
  registry.sources.runbookMetadata,
) as PlatformRunbookMetadataRegistry;
const missionSloProfiles = readJson(
  registry.sources.missionSloProfiles,
) as PlatformMissionSloProfileRegistry;
const lifecycleMatrix = readJson(
  "config/validation/platform-lifecycle-matrix.json",
) as Record<string, unknown>;
const referenceDocument = readText(
  "docs_zh/reference/automatic_agent_platform_validation_monitoring_full_v1_7_1.md",
);
const targetMetrics = extractCoreMetricRegistry(referenceDocument);
const eventRegistry = Object.values(EVENT_SCHEMA_REGISTRY);
const runbookMetadataById = new Map(
  runbookMetadata.runbooks.map((runbook) => [runbook.runbookId, runbook]),
);
const enrichedRunbooks = registry.runbooks.map((runbook) => {
  const metadata = runbookMetadataById.get(runbook.runbookId);
  if (metadata == null) {
    throw new Error(
      `platform_validation_artifacts.runbook_metadata_missing:${runbook.runbookId}`,
    );
  }
  return {
    ...runbook,
    ...metadata,
  };
});
const enrichedGates = registry.gates.map((gate) => {
  const runbook = runbookMetadataById.get(gate.runbookId);
  return {
    ...gate,
    defaultSeverity: runbook?.severity ?? "P1",
    escalationRules: [] as unknown[],
    blocking: true,
    owner: runbook?.owner ?? "Platform Owner",
    linkedMetrics: runbook?.linkedMetrics ?? [],
    automationAllowed: runbook?.automationAllowed ?? "none",
  };
});

mkdirSync(artifactRoot, { recursive: true });
mkdirSync(eventPayloadSchemaRoot, { recursive: true });
mkdirSync(generatedRoot, { recursive: true });
writeJson("event-registry.canonical.json", {
  version: registry.version,
  events: eventRegistry.map((event) => ({
    ...event,
    nameForm: event.type.includes(".") ? "canonical" : "legacy_compat",
  })),
});
writeJson("gate-registry.canonical.json", {
  version: registry.version,
  gates: enrichedGates,
});
writeJson("ci-job-registry.canonical.json", {
  version: registry.version,
  ciJobs: registry.ciJobs,
});
writeJson("runbook-registry.canonical.yaml", {
  version: runbookMetadata.version,
  runbooks: enrichedRunbooks,
});
writeJson("metric-registry.canonical.json", {
  version: registry.version,
  targetMetrics,
  runtimeMappings: metricMap.metrics,
  forbiddenAlertMetrics: metricMap.forbiddenAlertMetrics,
  forbiddenValidationSpanNames: VALIDATION_SPAN_NAMES,
});
writeJson("lifecycle-matrix.canonical.json", lifecycleMatrix);
writeJson("mission-slo-profiles.canonical.json", missionSloProfiles);
writeSchemaArtifacts();
writeGeneratedArtifacts();

console.log(`platform validation artifacts exported: ${artifactRoot}`);

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function readText(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function writeJson(name: string, value: unknown): void {
  writeFileSync(
    join(artifactRoot, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function writeSchema(name: string, value: unknown): void {
  writeFileSync(
    join(schemaRoot, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function writeEventPayloadSchema(name: string, value: unknown): void {
  writeFileSync(
    join(eventPayloadSchemaRoot, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function writeGenerated(name: string, value: string): void {
  writeFileSync(join(generatedRoot, name), value, "utf8");
}

function extractCoreMetricRegistry(
  markdown: string,
): PlatformTargetMetricRecord[] {
  const start = markdown.indexOf("## 48.1 Core Metrics");
  const end = markdown.indexOf("\n---\n\n# 49. Runbook Registry", start);
  const section = markdown.slice(start, end);

  return section
    .split("\n")
    .filter((line) => line.startsWith("| `aa."))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/^`|`$/g, ""));
      const [
        metric = "",
        type = "",
        formula = "",
        window = "",
        labels = "",
        source = "",
        dashboard = "",
        alert = "",
        owner = "",
        target = "",
      ] = cells;
      return {
        metric,
        type,
        formula,
        window,
        labels,
        source,
        dashboard,
        alert,
        owner,
        target,
      };
    });
}

function writeSchemaArtifacts(): void {
  for (const event of eventRegistry) {
    writeEventPayloadSchema(`${schemaFileName(event.type)}.schema.json`, {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: event.payloadSchemaRef,
      title: `${event.type} payload`,
      type: "object",
      additionalProperties: true,
      $comment:
        "Runtime payload validators in event-registry-payloads.ts remain authoritative; this export pins the registry schema ref for evidence bundles and external validation tooling.",
    });
  }

  writeSchema("validation-evidence-bundle.schema.json", {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "aa://validation/validation-evidence-bundle.schema.json",
    title: "ValidationEvidenceBundle",
    type: "object",
    additionalProperties: false,
    required: [
      "validationRunId",
      "missionId",
      "taskIds",
      "validationPhase",
      "roadmapStage",
      "sourceDatasetVersion",
      "gitCommitSha",
      "configVersion",
      "contractSchemaVersion",
      "eventRegistryVersion",
      "gateRegistryVersion",
      "metricRegistryVersion",
      "ciJobRegistryVersion",
      "runbookRegistryVersion",
      "eventRegistryHash",
      "gateRegistryHash",
      "metricRegistryHash",
      "ciJobRegistryHash",
      "runbookRegistryHash",
      "testReportRefs",
      "coverageReportRefs",
      "mutationReportRefs",
      "scorecardRef",
      "dashboardSnapshotRefs",
      "eventTruthConsistencyReportRef",
      "projectionRebuildReportRef",
      "budgetAuditReportRef",
      "hitlAuditReportRef",
      "securityScanReportRef",
      "pluginRuntimeReportRef",
      "dataGovernanceReportRef",
      "artifactIntegrityReportRef",
      "bundleHash",
      "signature",
      "signedBy",
      "signedAt",
      "decision",
      "approvedBy",
      "createdAt",
    ],
    properties: {
      validationRunId: nonEmptyString(),
      missionId: nonEmptyString(),
      taskIds: stringArray(),
      validationPhase: enumSchema([
        "validation_phase_0",
        "validation_phase_1",
        "validation_phase_2",
        "validation_phase_3",
        "validation_phase_4",
      ]),
      roadmapStage: enumSchema([
        "stage_1_research",
        "stage_2_code",
        "stage_3_ops",
        "stage_4_business",
        "stage_5_marketplace",
      ]),
      runtimeRing: nonEmptyString(),
      sourceDatasetVersion: nonEmptyString(),
      gitCommitSha: nonEmptyString(),
      configVersion: nonEmptyString(),
      contractSchemaVersion: nonEmptyString(),
      eventRegistryVersion: nonEmptyString(),
      gateRegistryVersion: nonEmptyString(),
      metricRegistryVersion: nonEmptyString(),
      ciJobRegistryVersion: nonEmptyString(),
      runbookRegistryVersion: nonEmptyString(),
      eventRegistryHash: nonEmptyString(),
      gateRegistryHash: nonEmptyString(),
      metricRegistryHash: nonEmptyString(),
      ciJobRegistryHash: nonEmptyString(),
      runbookRegistryHash: nonEmptyString(),
      testReportRefs: stringArray(),
      coverageReportRefs: stringArray(),
      mutationReportRefs: stringArray(),
      scorecardRef: nonEmptyString(),
      dashboardSnapshotRefs: stringArray(),
      eventTruthConsistencyReportRef: nonEmptyString(),
      projectionRebuildReportRef: nonEmptyString(),
      budgetAuditReportRef: nonEmptyString(),
      hitlAuditReportRef: nonEmptyString(),
      securityScanReportRef: nonEmptyString(),
      pluginRuntimeReportRef: nonEmptyString(),
      dataGovernanceReportRef: nonEmptyString(),
      artifactIntegrityReportRef: nonEmptyString(),
      bundleHash: nonEmptyString(),
      signature: nonEmptyString(),
      signedBy: stringArray(),
      signedAt: dateTimeString(),
      decision: enumSchema(["pass", "fail", "conditional_pass"]),
      approvedBy: stringArray(),
      createdAt: dateTimeString(),
    },
  });

  writeSchema("mission-slo-profile.schema.json", {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "aa://validation/mission-slo-profile.schema.json",
    title: "PlatformMissionSloProfiles",
    type: "object",
    additionalProperties: false,
    required: ["version", "profiles", "burnRateAlerts"],
    properties: {
      version: nonEmptyString(),
      profiles: {
        type: "array",
        minItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "missionType",
            "evidenceCoverageTarget",
            "toolReceiptCoverageTarget",
            "budgetAttributionCoverageTarget",
            "harnessCompletionTarget",
            "hitlSlaMs",
            "recoveryRtoMs",
            "projectionLagP95Ms",
            "apiAvailabilityTarget",
          ],
          properties: {
            missionType: enumSchema(["research", "code_agent", "ops"]),
            evidenceCoverageTarget: zeroToOne(),
            toolReceiptCoverageTarget: zeroToOne(),
            budgetAttributionCoverageTarget: zeroToOne(),
            harnessCompletionTarget: zeroToOne(),
            hitlSlaMs: positiveInteger(),
            recoveryRtoMs: positiveInteger(),
            projectionLagP95Ms: positiveInteger(),
            apiAvailabilityTarget: zeroToOne(),
          },
        },
      },
      burnRateAlerts: {
        type: "array",
        minItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["window", "burnRateThreshold", "severity"],
          properties: {
            window: enumSchema(["1h", "6h", "24h"]),
            burnRateThreshold: positiveInteger(),
            severity: enumSchema(["P0", "P1", "P2", "P3"]),
          },
        },
      },
    },
  });

  writeSchema("plugin-manifest.schema.json", {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "aa://validation/plugin-manifest.schema.json",
    title: "PluginManifest",
    type: "object",
    additionalProperties: false,
    required: [
      "pluginId",
      "name",
      "version",
      "owner",
      "spiTypes",
      "publicSdkSurface",
    ],
    properties: {
      pluginId: nonEmptyString(),
      name: nonEmptyString(),
      version: nonEmptyString(),
      owner: nonEmptyString(),
      domainIds: stringArray(),
      capabilityIds: stringArray(),
      spiTypes: {
        type: "array",
        minItems: 1,
        items: enumSchema([
          "tool",
          "retriever",
          "validator",
          "planner",
          "presenter",
          "adapter",
          "evaluator",
        ]),
      },
      extensionKind: enumSchema(["domain_plugin", "external_adapter"]),
      trustLevel: enumSchema([
        "internal",
        "trusted",
        "verified",
        "certified",
        "community",
        "unverified",
      ]),
      publicSdkSurface: nonEmptyString(),
      settingsSchema: { type: "object" },
      sandbox: {
        type: "object",
        additionalProperties: false,
        properties: {
          timeoutMs: positiveInteger(),
          allowFilesystemWrite: { type: "boolean" },
          allowNetworkEgress: { type: "boolean" },
          allowedKnowledgeNamespaces: stringArray(),
          maxConcurrentInvocations: positiveInteger(),
          maxQueuedInvocations: { type: "integer", minimum: 0 },
          runtimeIsolation: enumSchema([
            "shared_process",
            "serialized_in_process",
            "forked_process",
            "sandboxed_process",
            "containerized_process",
          ]),
          runtimeContainerImage: nonEmptyString(),
          cooldownMs: { type: "integer", minimum: 0 },
          allowedExternalDomains: stringArray(),
          maxResponseSizeBytes: positiveInteger(),
          rateLimitPerMinute: positiveInteger(),
        },
      },
    },
  });

  writeSchema("tool-definition.schema.json", {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "aa://validation/tool-definition.schema.json",
    title: "ToolDefinition",
    type: "object",
    additionalProperties: false,
    required: ["name", "description", "inputSchema"],
    properties: {
      name: nonEmptyString(),
      description: nonEmptyString(),
      inputSchema: { type: "object" },
    },
  });

  writeSchema("data-governance.schema.json", {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "aa://validation/data-governance.schema.json",
    title: "ResearchDataGovernanceRecord",
    type: "object",
    additionalProperties: false,
    required: [
      "sourceId",
      "sourceType",
      "sourceAttribution",
      "dataClass",
      "license",
      "copyrightBoundary",
      "retentionPolicy",
      "contaminationTag",
      "piiDetected",
      "redactionApplied",
      "tenantId",
      "accessPolicyRef",
      "evidenceRef",
    ],
    properties: {
      sourceId: nonEmptyString(),
      sourceType: enumSchema([
        "paper",
        "blog",
        "webpage",
        "internal_report",
        "benchmark",
        "experiment_log",
      ]),
      sourceAttribution: nonEmptyString(),
      dataClass: enumSchema([
        "public",
        "internal",
        "confidential",
        "restricted",
      ]),
      license: nonEmptyString(),
      copyrightBoundary: enumSchema([
        "summary_only",
        "short_excerpt_allowed",
        "internal_fulltext_allowed",
        "restricted",
      ]),
      retentionPolicy: nonEmptyString(),
      contaminationTag: enumSchema([
        "benchmark",
        "train_candidate",
        "do_not_train",
        "unknown",
      ]),
      piiDetected: { type: "boolean" },
      redactionApplied: { type: "boolean" },
      tenantId: nonEmptyString(),
      accessPolicyRef: nonEmptyString(),
      evidenceRef: nonEmptyString(),
    },
  });
}

function writeGeneratedArtifacts(): void {
  writeGenerated(
    "typed-event-payloads.generated.ts",
    [
      "/* Generated by scripts/validation/export-platform-validation-artifacts.ts. */",
      "export interface ValidationEventPayloadIndex {",
      ...eventRegistry.map(
        (event) =>
          `  ${JSON.stringify(event.type)}: { payload: Record<string, unknown>; payloadSchemaRef: ${JSON.stringify(event.payloadSchemaRef)}; };`,
      ),
      "}",
      "",
    ].join("\n"),
  );
  writeGenerated(
    "gate-registry.generated.ts",
    generatedConst("PLATFORM_GATE_REGISTRY", enrichedGates),
  );
  writeGenerated(
    "metric-registry.generated.ts",
    generatedConst("PLATFORM_METRIC_REGISTRY", targetMetrics),
  );
  writeGenerated(
    "mission-slo-profiles.generated.ts",
    generatedConst("PLATFORM_MISSION_SLO_PROFILES", missionSloProfiles),
  );
  writeGenerated(
    "runbook-registry.generated.ts",
    generatedConst("PLATFORM_RUNBOOK_REGISTRY", enrichedRunbooks),
  );
}

function generatedConst(name: string, value: unknown): string {
  return [
    "/* Generated by scripts/validation/export-platform-validation-artifacts.ts. */",
    `export const ${name} = ${JSON.stringify(value, null, 2)} as const;`,
    "",
  ].join("\n");
}

function schemaFileName(eventType: string): string {
  return eventType.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function enumSchema(values: readonly string[]): Record<string, unknown> {
  return { type: "string", enum: [...values] };
}

function nonEmptyString(): Record<string, unknown> {
  return { type: "string", minLength: 1 };
}

function dateTimeString(): Record<string, unknown> {
  return { ...nonEmptyString(), format: "date-time" };
}

function stringArray(): Record<string, unknown> {
  return { type: "array", items: nonEmptyString() };
}

function positiveInteger(): Record<string, unknown> {
  return { type: "integer", minimum: 1 };
}

function zeroToOne(): Record<string, unknown> {
  return { type: "number", minimum: 0, maximum: 1 };
}

interface PlatformValidationRegistry {
  readonly version: string;
  readonly sources: {
    readonly runbookMetadata: string;
    readonly missionSloProfiles: string;
  };
  readonly ciJobs: readonly unknown[];
  readonly gates: ReadonlyArray<{
    readonly gateId: string;
    readonly ciJob: string;
    readonly runbookId: string;
  }>;
  readonly runbooks: ReadonlyArray<{
    readonly runbookId: string;
    readonly path: string;
  }>;
}

interface PlatformMonitoringMetricMap {
  readonly version: string;
  readonly metrics: readonly unknown[];
  readonly forbiddenAlertMetrics: readonly string[];
}

interface PlatformRunbookMetadataRegistry {
  readonly version: string;
  readonly runbooks: ReadonlyArray<{
    readonly runbookId: string;
    readonly title: string;
    readonly severity: "P0" | "P1" | "P2" | "P3";
    readonly owner: string;
    readonly linkedGates: readonly string[];
    readonly linkedMetrics: readonly string[];
    readonly automationAllowed: "none" | "partial" | "full";
    readonly requiresHumanApproval: boolean;
    readonly rollbackSupported: boolean;
    readonly lastReviewedAt: string;
  }>;
}

interface PlatformMissionSloProfileRegistry {
  readonly version: string;
  readonly profiles: readonly unknown[];
  readonly burnRateAlerts: readonly unknown[];
}

interface PlatformTargetMetricRecord {
  readonly metric: string;
  readonly type: string;
  readonly formula: string;
  readonly window: string;
  readonly labels: string;
  readonly source: string;
  readonly dashboard: string;
  readonly alert: string;
  readonly owner: string;
  readonly target: string;
}
