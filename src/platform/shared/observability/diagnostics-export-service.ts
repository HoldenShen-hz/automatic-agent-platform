/**
 * Diagnostics export service for minimal repro bundle generation.
 *
 * Exports task diagnostics into a portable artifact bundle containing task input,
 * workflow state, relevant messages, tool usage, and configuration snapshots for
 * failure investigation and support scenarios.
 *
 * ## References
 * - Contract: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/diagnostics_snapshot_and_repro_bundle_contract.md Diagnostics Snapshot And Repro Bundle Contract}
 * - Related: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/debug_inspect_health_backpressure_contract.md debug_inspect_health_backpressure_contract.md}
 * - Related: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/tool_output_sanitization_contract.md tool_output_sanitization_contract.md}
 * - Glossary: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/governance/glossary_and_terminology.md Glossary - artifact, minimal repro bundle, diagnostics, trace, RCA}
 * - Architecture: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/automatic_agent_patform_arthitecture_design.md 01_architecture_and_technical_design.md}
 *
 * @module
 */

import { ArtifactStore, type ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
import type { ArtifactRef } from "../../contracts/types/domain.js";
import { nowIso } from "../../contracts/types/ids.js";
import type { StalledExecutionEscalationPackage } from "../../execution/recovery/stalled-execution-escalation-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { sanitizeStructuredOutput } from "../../execution/tool-executor/tool-output-sanitizer.js";
import {
  buildIncidentTimelineMarkdown,
  DiagnosticsService,
  type IncidentTimelineReport,
  type MinimalReproBundle,
} from "./diagnostics-service.js";

export interface MinimalReproExportResult {
  bundle: MinimalReproBundle;
  artifact: ArtifactRef;
}

export interface IncidentTimelineExportResult {
  report: IncidentTimelineReport;
  jsonArtifact: ArtifactRef;
  markdownArtifact: ArtifactRef;
}

export interface StalledEscalationExportResult {
  packages: StalledExecutionEscalationPackage[];
  artifacts: ArtifactRef[];
}

export class DiagnosticsExportService {
  private readonly artifactStore: ArtifactStore;

  public constructor(
    private readonly diagnosticsService: DiagnosticsService,
    private readonly store: AuthoritativeTaskStore,
    artifactStoreOptions: ArtifactStoreOptions = {},
  ) {
    this.artifactStore = new ArtifactStore(artifactStoreOptions);
  }

  public exportMinimalReproBundle(taskId: string): MinimalReproExportResult {
    const bundle = sanitizeStructuredValue(this.diagnosticsService.buildMinimalReproBundle(taskId));
    const artifact = this.artifactStore.writeJsonArtifact({
      taskId,
      kind: "minimal_repro_bundle",
      fileName: `minimal-repro-${taskId}.json`,
      content: {
        exportedAt: nowIso(),
        bundle,
      },
      lineage: {
        source: "diagnostics_export_service",
        taskId,
      },
    });

    this.store.artifact.insertArtifact(artifact.record);

    return {
      bundle,
      artifact: artifact.ref,
    };
  }

  public exportIncidentTimeline(taskId: string): IncidentTimelineExportResult {
    const report = sanitizeStructuredValue(this.diagnosticsService.buildIncidentTimelineReport(taskId));
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId,
      kind: "incident_timeline_report",
      fileName: `incident-timeline-${taskId}.json`,
      content: {
        exportedAt: nowIso(),
        report,
      },
      lineage: {
        source: "diagnostics_export_service",
        exportKind: "incident_timeline",
        taskId,
      },
    });
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId,
      kind: "incident_timeline_markdown",
      fileName: `incident-timeline-${taskId}.md`,
      mimeType: "text/markdown",
      content: buildIncidentTimelineMarkdown(report),
      lineage: {
        source: "diagnostics_export_service",
        exportKind: "incident_timeline_markdown",
        taskId,
      },
    });

    this.store.artifact.insertArtifact(jsonArtifact.record);
    this.store.artifact.insertArtifact(markdownArtifact.record);

    return {
      report,
      jsonArtifact: jsonArtifact.ref,
      markdownArtifact: markdownArtifact.ref,
    };
  }

  public exportStalledExecutionEscalations(
    packages: readonly StalledExecutionEscalationPackage[],
  ): StalledEscalationExportResult {
    const sanitizedPackages = sanitizeStructuredValue([...packages]);
    const artifacts = sanitizedPackages.map((item) => {
      const artifact = this.artifactStore.writeJsonArtifact({
        taskId: item.taskId,
        kind: "stalled_execution_escalation",
        fileName: `stalled-escalation-${item.executionId}.json`,
        content: {
          exportedAt: nowIso(),
          package: item,
        },
        lineage: {
          source: "diagnostics_export_service",
          exportKind: "stalled_execution_escalation",
          taskId: item.taskId,
          executionId: item.executionId,
          staleKind: item.staleKind,
          suggestedOperatorAction: item.suggestedOperatorAction,
        },
      });

      this.store.artifact.insertArtifact(artifact.record);
      return artifact.ref;
    });

    return {
      packages: sanitizedPackages,
      artifacts,
    };
  }
}

function sanitizeStructuredValue<T>(value: T): T {
  return sanitizeStructuredOutput(value).sanitizedValue;
}
