import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EVENT_SCHEMA_REGISTRY } from "../../src/platform/five-plane-state-evidence/events/event-registry.js";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const artifactRoot = join(root, "artifacts/validation/platform/contracts");
const schemaRoot = join(root, "artifacts/validation/platform/schemas");
const eventPayloadSchemaRoot = join(schemaRoot, "event-payload-schemas");
const generatedRoot = join(root, "artifacts/validation/platform/generated");
const registry = readJson(
  "config/validation/platform-validation-registry.json",
) as {
  version: string;
  ciJobs: unknown[];
  gates: unknown[];
  runbooks: unknown[];
};
const metricMap = readJson(
  "config/validation/platform-monitoring-metric-map.json",
);
const lifecycleMatrix = readJson(
  "config/validation/platform-lifecycle-matrix.json",
);
const referenceDocument = readText(
  "docs_zh/reference/automatic_agent_platform_validation_monitoring_full_v1_7_1.md",
);
const targetMetrics = extractCoreMetricRegistry(referenceDocument);
const eventRegistry = Object.values(EVENT_SCHEMA_REGISTRY);

mkdirSync(artifactRoot, { recursive: true });
mkdirSync(eventPayloadSchemaRoot, { recursive: true });
mkdirSync(generatedRoot, { recursive: true });
writeJson("event-registry.canonical.json", {
  version: registry.version,
  events: eventRegistry,
});
writeJson("gate-registry.canonical.json", {
  version: registry.version,
  gates: registry.gates,
});
writeJson("ci-job-registry.canonical.json", {
  version: registry.version,
  ciJobs: registry.ciJobs,
});
writeJson("runbook-registry.canonical.yaml", {
  version: registry.version,
  runbooks: registry.runbooks,
});
writeJson("metric-registry.canonical.json", {
  version: registry.version,
  targetMetrics,
  runtimeMappings: metricMap.metrics,
  forbiddenAlertMetrics: metricMap.forbiddenAlertMetrics,
});
writeJson("lifecycle-matrix.canonical.json", lifecycleMatrix);
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
): Array<Record<string, string>> {
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
      "classification",
      "license",
      "retentionPolicy",
      "contaminationTag",
      "piiPolicy",
    ],
    properties: {
      sourceId: nonEmptyString(),
      classification: enumSchema([
        "public",
        "internal",
        "confidential",
        "restricted",
      ]),
      license: nonEmptyString(),
      retentionPolicy: nonEmptyString(),
      contaminationTag: nonEmptyString(),
      piiPolicy: enumSchema(["none", "redact", "deny", "review"]),
      copyrightBoundary: nonEmptyString(),
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
    generatedConst("PLATFORM_GATE_REGISTRY", registry.gates),
  );
  writeGenerated(
    "metric-registry.generated.ts",
    generatedConst("PLATFORM_METRIC_REGISTRY", targetMetrics),
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
