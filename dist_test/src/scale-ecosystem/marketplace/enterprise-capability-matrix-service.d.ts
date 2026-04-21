/**
 * Enterprise Capability Matrix Service
 *
 * Tracks and evaluates enterprise capabilities against license tiers and deployment readiness.
 * Provides a matrix of capabilities (admin console, SSO, SCIM, etc.) mapped to their
 * required infrastructure components and readiness gates.
 *
 * Capabilities are evaluated at three levels:
 * 1. License tier check: Is the account on the required tier (community/professional/enterprise)?
 * 2. Deployment mode check: Is the capability supported in the current deployment mode?
 * 3. Readiness check: Are all required infrastructure components verified and gates open?
 *
 * The matrix evaluates:
 * - admin_console: Admin console and human takeover
 * - audit_export: Audit log export pipeline
 * - sso: Single sign-on integration
 * - scim: SCIM user provisioning
 * - tenant_isolation: Multi-tenant data isolation
 * - private_model: Private model access
 * - private_network_deployment: Private network sandbox deployment
 * - rollout_and_rollback: Blue-green deployment controls
 * - incident_console: Incident management console
 * - data_residency_controls: Data residency and sovereignty controls
 *
 * Overall verdict:
 * - ready: All capabilities available
 * - partial: Some capabilities degraded but none blocked
 * - blocked: One or more capabilities blocked by tier/mode/readiness
 *
 * @see docs_zh/contracts/enterprise_contract.md for enterprise capability contracts
 */
import { type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { ArtifactRef, DeploymentMode, EnterpriseCapabilityReportRecord, EnterpriseCapabilityStatus, EnvironmentName, EnvironmentReadinessComponentType, EnvironmentReadinessRecord } from "../../platform/contracts/types/domain.js";
/** License tier levels */
export type LicenseTier = "community" | "professional" | "enterprise";
/** Input for registering environment readiness status for a component */
export interface RegisterEnvironmentReadinessInput {
    readinessId?: string;
    environment: EnvironmentName;
    componentType: EnvironmentReadinessComponentType;
    componentId: string;
    /** Whether credentials are ready for this component */
    credentialReady: boolean;
    /** Optional secondary gates that must all pass */
    secondaryGates?: Record<string, boolean>;
    owner: string;
    lastVerifiedAt?: string;
    /** Whether this readiness record is currently active */
    isActive?: boolean;
    notes?: string | null;
}
/** Reference to a required readiness component */
export interface CapabilityRequirementRef {
    componentType: EnvironmentReadinessComponentType;
    componentId: string;
    /** Optional specific gate key within the component */
    gateKey?: string;
}
/** Definition of a single enterprise capability */
export interface EnterpriseCapabilityDefinition {
    capabilityKey: "admin_console" | "audit_export" | "sso" | "scim" | "tenant_isolation" | "private_model" | "private_network_deployment" | "rollout_and_rollback" | "incident_console" | "data_residency_controls";
    displayName: string;
    requiredTier: LicenseTier;
    supportedDeploymentModes: readonly DeploymentMode[];
    /** Infrastructure components and gates required for this capability */
    readinessRequirements: readonly CapabilityRequirementRef[];
}
/** Entry in the capability matrix for a specific capability */
export interface EnterpriseCapabilityMatrixEntry {
    capabilityKey: EnterpriseCapabilityDefinition["capabilityKey"];
    displayName: string;
    status: EnterpriseCapabilityStatus;
    requiredTier: LicenseTier;
    requiredDeploymentModes: readonly DeploymentMode[];
    reasonCodes: string[];
    readiness: Array<{
        componentType: EnvironmentReadinessComponentType;
        componentId: string;
        gateKey: string | null;
        status: "ready" | "missing" | "gate_blocked";
        recordId: string | null;
    }>;
}
/** Summary counts for capability matrix */
export interface EnterpriseCapabilitySummary {
    available: number;
    degraded: number;
    blocked: number;
    total: number;
    overallVerdict: "ready" | "partial" | "blocked";
}
/** Complete enterprise capability matrix report */
export interface EnterpriseCapabilityMatrixReport {
    reportId: string;
    generatedAt: string;
    environment: EnvironmentName;
    deploymentMode: DeploymentMode;
    tier: LicenseTier;
    accountId: string | null;
    workspaceId: string | null;
    tenantId: string | null;
    summary: EnterpriseCapabilitySummary;
    entries: EnterpriseCapabilityMatrixEntry[];
}
/** Input for running capability matrix evaluation */
export interface EnterpriseCapabilityMatrixRunInput {
    accountId?: string | null;
    workspaceId?: string | null;
    tenantId?: string | null;
    environment: EnvironmentName;
    deploymentMode: DeploymentMode;
    generatedAt?: string;
}
/** Result of running the capability matrix */
export interface EnterpriseCapabilityMatrixRunResult {
    report: EnterpriseCapabilityMatrixReport;
    record: EnterpriseCapabilityReportRecord;
}
/** Extended result including artifact references */
export interface EnterpriseCapabilityMatrixExportResult extends EnterpriseCapabilityMatrixRunResult {
    jsonArtifact: ArtifactRef;
    markdownArtifact: ArtifactRef;
}
/** Configuration options for the service */
export interface EnterpriseCapabilityMatrixServiceOptions {
    artifactStoreOptions?: ArtifactStoreOptions;
    capabilityDefinitions?: readonly EnterpriseCapabilityDefinition[];
}
/**
 * Default enterprise capability definitions.
 *
 * Each capability specifies:
 * - requiredTier: Minimum license tier needed
 * - supportedDeploymentModes: Which deployment modes support this capability
 * - readinessRequirements: Infrastructure components and gates that must be ready
 */
export declare const DEFAULT_ENTERPRISE_CAPABILITIES: readonly EnterpriseCapabilityDefinition[];
/**
 * Enterprise Capability Matrix Service
 *
 * Evaluates enterprise capabilities against license tiers and infrastructure readiness.
 * Maintains environment readiness records for required components and gates.
 */
export declare class EnterpriseCapabilityMatrixService {
    private readonly db;
    private readonly store;
    private readonly artifactStore;
    private readonly capabilityDefinitions;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: EnterpriseCapabilityMatrixServiceOptions);
    /**
     * Registers or updates environment readiness status for a component.
     * Readiness records track whether infrastructure components are operational
     * and have their required gates open.
     */
    registerEnvironmentReadiness(input: RegisterEnvironmentReadinessInput): EnvironmentReadinessRecord;
    /**
     * Builds the capability matrix report for a given context.
     *
     * Evaluates each capability against:
     * 1. License tier of the account
     * 2. Deployment mode
     * 3. Infrastructure readiness and gate status
     */
    buildMatrix(input: EnterpriseCapabilityMatrixRunInput): EnterpriseCapabilityMatrixRunResult;
    /**
     * Exports the capability matrix as JSON and Markdown artifacts.
     */
    exportMatrix(input: EnterpriseCapabilityMatrixRunInput): EnterpriseCapabilityMatrixExportResult;
    /** Lists active environment readiness records for an environment */
    listEnvironmentReadiness(environment?: EnvironmentName | null): EnvironmentReadinessRecord[];
    /** Lists historical capability matrix reports */
    listReports(limit?: number): EnterpriseCapabilityReportRecord[];
    /**
     * Evaluates a single capability against tier, deployment mode, and readiness.
     *
     * Returns an entry with:
     * - status: available (green), degraded (yellow), or blocked (red)
     * - reasonCodes: Why the capability is not available
     * - readiness: Per-component readiness status
     */
    private evaluateCapability;
    /** Builds summary counts from matrix entries */
    private buildSummary;
}
/**
 * Factory function to create a fully-initialized EnterpriseCapabilityMatrixService.
 * Handles storage context opening, migration, and artifact store setup.
 */
export declare function createEnterpriseCapabilityMatrixService(dbPath: string, options?: EnterpriseCapabilityMatrixServiceOptions & {
    artifactRoot?: string;
}): EnterpriseCapabilityMatrixService;
