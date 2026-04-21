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
 * - Architecture: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/architecture/00-platform-architecture.md 01_architecture_and_technical_design.md}
 *
 * @module
 */
import { type ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
import type { ArtifactRef } from "../../contracts/types/domain.js";
import type { StalledExecutionEscalationPackage } from "../../execution/recovery/stalled-execution-escalation-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { DiagnosticsService, type IncidentTimelineReport, type MinimalReproBundle } from "./diagnostics-service.js";
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
export declare class DiagnosticsExportService {
    private readonly diagnosticsService;
    private readonly store;
    private readonly artifactStore;
    constructor(diagnosticsService: DiagnosticsService, store: AuthoritativeTaskStore, artifactStoreOptions?: ArtifactStoreOptions);
    exportMinimalReproBundle(taskId: string): MinimalReproExportResult;
    exportIncidentTimeline(taskId: string): IncidentTimelineExportResult;
    exportStalledExecutionEscalations(packages: readonly StalledExecutionEscalationPackage[]): StalledEscalationExportResult;
}
