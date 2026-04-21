/**
 * Industrial Ops Program Service
 *
 * Provides the top-level Industrial Ops Program report that synthesizes
 * governance reports, SLO status, and incident information into a
 * structured handoff package for operations teams.
 *
 * The Industrial Ops Program is designed to ensure continuity of operations
 * during shift handoffs by providing a comprehensive view of system health,
 * active incidents, recommended runbooks, and mitigation commands.
 */
import { type ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
import type { ArtifactRef, EnvironmentName } from "../../contracts/types/domain.js";
import { OperationsGovernanceService, type OperationsGovernanceReport, type RunbookSeverity } from "./operations-governance-service.js";
export interface IndustrialOpsProgramInput {
    environment: EnvironmentName;
    taskId?: string;
    generatedAt?: string;
    shiftOwner?: string;
}
export interface IndustrialOpsAlertPolicy {
    severity: RunbookSeverity;
    ackWithinMinutes: number;
    channels: string[];
    autoMitigation: string[];
}
export interface IndustrialOpsProgramReport {
    programId: string;
    generatedAt: string;
    environment: EnvironmentName;
    shiftOwner: string;
    status: "pass" | "warning" | "fail";
    failingSloKeys: string[];
    warningSloKeys: string[];
    incidentId: string | null;
    handoffChecklist: string[];
    alertPolicies: IndustrialOpsAlertPolicy[];
    recommendedRunbooks: string[];
    recommendedCommands: string[];
    governanceReport: OperationsGovernanceReport;
}
export interface IndustrialOpsProgramExportResult {
    report: IndustrialOpsProgramReport;
    jsonArtifact: ArtifactRef;
    markdownArtifact: ArtifactRef;
}
export interface IndustrialOpsProgramServiceOptions {
    artifactStoreOptions?: ArtifactStoreOptions;
}
/**
 * IndustrialOpsProgramService builds comprehensive operations reports
 * that combine governance data, SLO status, and incident information
 * into a format suitable for shift handoffs and incident management.
 */
export declare class IndustrialOpsProgramService {
    private readonly governanceService;
    private readonly artifactStore;
    constructor(governanceService: OperationsGovernanceService, options?: IndustrialOpsProgramServiceOptions);
    /**
     * Builds an Industrial Ops Program report by aggregating the operations
     * governance report with Industrial Ops-specific information including
     * handoff checklists, alert policies, and recommended runbooks.
     *
     * @param input - Report generation parameters including environment and optional task ID
     * @returns Complete Industrial Ops Program report
     */
    buildReport(input: IndustrialOpsProgramInput): IndustrialOpsProgramReport;
    /**
     * Exports the Industrial Ops Program report to both JSON and markdown artifacts
     * using the artifact store.
     *
     * @param input - Report generation parameters
     * @returns The report along with references to the stored artifacts
     */
    exportReport(input: IndustrialOpsProgramInput): IndustrialOpsProgramExportResult;
}
