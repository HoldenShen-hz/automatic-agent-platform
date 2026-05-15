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

import { ArtifactStore, type ArtifactStoreOptions } from "../../platform/five-plane-state-evidence/artifacts/artifact-store.js";
import { MonetizationError } from "../../platform/contracts/errors.js";
import { openAuthoritativeStorageContext } from "../../platform/five-plane-state-evidence/truth/storage-backend-factory.js";
import { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type {
  ArtifactRef,
  DeploymentMode,
  EnterpriseCapabilityReportRecord,
  EnterpriseCapabilityStatus,
  EnvironmentName,
  EnvironmentReadinessComponentType,
  EnvironmentReadinessRecord,
} from "../../platform/contracts/types/domain.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { ValidationError } from "../../platform/contracts/errors.js";

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
  capabilityKey:
    | "admin_console"
    | "audit_export"
    | "sso"
    | "scim"
    | "tenant_isolation"
    | "private_model"
    | "private_network_deployment"
    | "rollout_and_rollback"
    | "incident_console"
    | "data_residency_controls";
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
export const DEFAULT_ENTERPRISE_CAPABILITIES: readonly EnterpriseCapabilityDefinition[] = [
  {
    capabilityKey: "admin_console",
    displayName: "Admin Console And Human Takeover",
    requiredTier: "professional",
    supportedDeploymentModes: ["cloud_shared", "private_cloud", "on_prem"],
    readinessRequirements: [
      { componentType: "gateway", componentId: "ops_gateway" },
    ],
  },
  {
    capabilityKey: "audit_export",
    displayName: "Audit Export",
    requiredTier: "enterprise",
    supportedDeploymentModes: ["cloud_shared", "private_cloud", "on_prem"],
    readinessRequirements: [
      { componentType: "artifact_store", componentId: "audit_export_store" },
      { componentType: "external_service", componentId: "audit_export_pipeline", gateKey: "export_ready" },
    ],
  },
  {
    capabilityKey: "sso",
    displayName: "Single Sign-On",
    requiredTier: "enterprise",
    supportedDeploymentModes: ["cloud_shared", "private_cloud", "on_prem"],
    readinessRequirements: [
      { componentType: "gateway", componentId: "identity_gateway", gateKey: "sso_ready" },
    ],
  },
  {
    capabilityKey: "scim",
    displayName: "SCIM Provisioning",
    requiredTier: "enterprise",
    supportedDeploymentModes: ["private_cloud", "on_prem"],
    readinessRequirements: [
      { componentType: "external_service", componentId: "scim_bridge", gateKey: "scim_ready" },
    ],
  },
  {
    capabilityKey: "tenant_isolation",
    displayName: "Tenant Isolation",
    requiredTier: "enterprise",
    supportedDeploymentModes: ["cloud_shared", "private_cloud", "on_prem"],
    readinessRequirements: [
      { componentType: "worker_fleet", componentId: "tenant_scoped_workers" },
      { componentType: "artifact_store", componentId: "tenant_scoped_artifacts", gateKey: "namespace_ready" },
    ],
  },
  {
    capabilityKey: "private_model",
    displayName: "Private Model Access",
    requiredTier: "enterprise",
    supportedDeploymentModes: ["private_cloud", "on_prem"],
    readinessRequirements: [
      { componentType: "provider", componentId: "private_model_provider" },
    ],
  },
  {
    capabilityKey: "private_network_deployment",
    displayName: "Private Network Deployment",
    requiredTier: "enterprise",
    supportedDeploymentModes: ["private_cloud", "on_prem"],
    readinessRequirements: [
      { componentType: "sandbox", componentId: "private_network_boundary", gateKey: "network_ready" },
    ],
  },
  {
    capabilityKey: "rollout_and_rollback",
    displayName: "Enterprise Rollout And Rollback",
    requiredTier: "enterprise",
    supportedDeploymentModes: ["cloud_shared", "private_cloud", "on_prem"],
    readinessRequirements: [
      { componentType: "worker_fleet", componentId: "enterprise_worker_fleet" },
      { componentType: "artifact_store", componentId: "release_artifacts", gateKey: "artifact_namespace_ready" },
    ],
  },
  {
    capabilityKey: "incident_console",
    displayName: "Incident Console",
    requiredTier: "enterprise",
    supportedDeploymentModes: ["cloud_shared", "private_cloud", "on_prem"],
    readinessRequirements: [
      { componentType: "gateway", componentId: "incident_console_gateway" },
      { componentType: "notification_channel", componentId: "oncall_notifications", gateKey: "webhook_ready" },
    ],
  },
  {
    capabilityKey: "data_residency_controls",
    displayName: "Data Residency Controls",
    requiredTier: "enterprise",
    supportedDeploymentModes: ["private_cloud", "on_prem"],
    readinessRequirements: [
      { componentType: "artifact_store", componentId: "residency_store", gateKey: "artifact_namespace_ready" },
      { componentType: "external_service", componentId: "residency_controls", gateKey: "attestation_ready" },
    ],
  },
] as const;

/** Validates identifier format (alphanumeric with dots, underscores, hyphens, colons) */
function assertIdentifier(value: string, code: string): string {
  if (!/^[a-zA-Z0-9._:-]{2,128}$/.test(value)) {
    throw new ValidationError(code, code);
  }
  return value;
}

/** Validates ISO timestamp format */
function assertTimestamp(value: string, code: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(code, code);
  }
  return parsed.toISOString();
}

/** Converts a plan ID to a license tier */
function normalizeTierFromPlan(planId: string | null | undefined): LicenseTier {
  switch (planId) {
    case "enterprise":
      return "enterprise";
    case "pro":
    case "professional":
      return "professional";
    default:
      return "community";
  }
}

/** Compares two license tiers, returns negative if left < right */
function compareTier(left: LicenseTier, right: LicenseTier): number {
  const order: Record<LicenseTier, number> = {
    community: 0,
    professional: 1,
    enterprise: 2,
  };
  return order[left] - order[right];
}

/** Builds Markdown-formatted capability matrix report for human review */
function buildMarkdownReport(report: EnterpriseCapabilityMatrixReport): string {
  const lines = [
    "# Enterprise Capability Matrix",
    "",
    `- Report ID: \`${report.reportId}\``,
    `- Generated At: \`${report.generatedAt}\``,
    `- Environment: \`${report.environment}\``,
    `- Deployment Mode: \`${report.deploymentMode}\``,
    `- License Tier: \`${report.tier}\``,
    `- Account Scope: \`${report.accountId ?? "none"}\``,
    `- Workspace Scope: \`${report.workspaceId ?? "none"}\``,
    `- Tenant Scope: \`${report.tenantId ?? "none"}\``,
    `- Overall Verdict: \`${report.summary.overallVerdict}\``,
    "",
    "| Capability | Status | Required Tier | Reasons |",
    "| --- | --- | --- | --- |",
    ...report.entries.map((entry) =>
      `| ${entry.displayName} | \`${entry.status}\` | \`${entry.requiredTier}\` | ${entry.reasonCodes.join(", ") || "ready"} |`
    ),
  ];
  return lines.join("\n");
}

/**
 * Enterprise Capability Matrix Service
 *
 * Evaluates enterprise capabilities against license tiers and infrastructure readiness.
 * Maintains environment readiness records for required components and gates.
 */
export class EnterpriseCapabilityMatrixService {
  private readonly artifactStore: ArtifactStore;
  private readonly capabilityDefinitions: readonly EnterpriseCapabilityDefinition[];

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    options: EnterpriseCapabilityMatrixServiceOptions = {},
  ) {
    this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
    this.capabilityDefinitions = options.capabilityDefinitions ?? DEFAULT_ENTERPRISE_CAPABILITIES;
  }

  /**
   * Registers or updates environment readiness status for a component.
   * Readiness records track whether infrastructure components are operational
   * and have their required gates open.
   */
  public registerEnvironmentReadiness(input: RegisterEnvironmentReadinessInput): EnvironmentReadinessRecord {
    const record: EnvironmentReadinessRecord = {
      readinessId: input.readinessId?.trim() || newId("readiness"),
      environment: input.environment,
      componentType: input.componentType,
      componentId: assertIdentifier(input.componentId, "enterprise.invalid_component_id"),
      credentialReady: input.credentialReady ? 1 : 0,
      secondaryGatesJson: JSON.stringify(input.secondaryGates ?? {}),
      owner: assertIdentifier(input.owner, "enterprise.invalid_owner"),
      lastVerifiedAt: assertTimestamp(input.lastVerifiedAt ?? nowIso(), "enterprise.invalid_last_verified_at"),
      isActive: input.isActive === false ? 0 : 1,
      notes: input.notes?.trim() || null,
    };
    assertIdentifier(record.readinessId, "enterprise.invalid_readiness_id");
    this.store.release.upsertEnvironmentReadinessRecord(record);
    return record;
  }

  /**
   * Builds the capability matrix report for a given context.
   *
   * Evaluates each capability against:
   * 1. License tier of the account
   * 2. Deployment mode
   * 3. Infrastructure readiness and gate status
   */
  public buildMatrix(input: EnterpriseCapabilityMatrixRunInput): EnterpriseCapabilityMatrixRunResult {
    const generatedAt = assertTimestamp(input.generatedAt ?? nowIso(), "enterprise.invalid_generated_at");
    const account = input.accountId ? this.store.billing.getBillingAccount(input.accountId) : null;
    if (input.accountId && !account) {
      throw new MonetizationError(
        `enterprise.billing_account_not_found:${input.accountId}`,
        `enterprise.billing_account_not_found:${input.accountId}`,
        {
          details: { accountId: input.accountId },
        },
      );
    }

    // Determine license tier from account's plan
    const tier = normalizeTierFromPlan(account?.planId);
    const reportId = newId("enterprise-report");

    // Evaluate each capability
    const entries = this.capabilityDefinitions.map((definition) =>
      this.evaluateCapability(definition, {
        tier,
        environment: input.environment,
        deploymentMode: input.deploymentMode,
      })
    );

    const summary = this.buildSummary(entries);

    const report: EnterpriseCapabilityMatrixReport = {
      reportId,
      generatedAt,
      environment: input.environment,
      deploymentMode: input.deploymentMode,
      tier,
      accountId: account?.accountId ?? input.accountId ?? null,
      workspaceId: account?.workspaceId ?? input.workspaceId ?? null,
      tenantId: input.tenantId ?? null,
      summary,
      entries,
    };

    // Persist report record
    const record: EnterpriseCapabilityReportRecord = {
      reportId,
      accountId: report.accountId,
      workspaceId: report.workspaceId,
      tenantId: report.tenantId,
      environment: report.environment,
      deploymentMode: report.deploymentMode,
      summaryJson: JSON.stringify(report.summary),
      reportJson: JSON.stringify(report),
      generatedAt,
    };
    this.store.release.insertEnterpriseCapabilityReport(record);
    return { report, record };
  }

  /**
   * Exports the capability matrix as JSON and Markdown artifacts.
   */
  public exportMatrix(input: EnterpriseCapabilityMatrixRunInput): EnterpriseCapabilityMatrixExportResult {
    const result = this.buildMatrix(input);
    const scopeId = result.report.tenantId ?? result.report.workspaceId ?? result.report.accountId ?? "global";

    // Export as JSON artifact
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId: `enterprise-capability-${scopeId}`,
      executionId: null,
      stepId: null,
      kind: "enterprise_capability_report",
      fileName: `enterprise-capability-${scopeId}-${result.report.environment}`,
      content: result.report,
      lineage: {
        reportId: result.report.reportId,
        environment: result.report.environment,
        deploymentMode: result.report.deploymentMode,
      },
    }).ref;

    // Export as Markdown for human review
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId: `enterprise-capability-${scopeId}`,
      executionId: null,
      stepId: null,
      kind: "enterprise_capability_report_markdown",
      fileName: `enterprise-capability-${scopeId}-${result.report.environment}.md`,
      content: buildMarkdownReport(result.report),
      lineage: {
        reportId: result.report.reportId,
        environment: result.report.environment,
        deploymentMode: result.report.deploymentMode,
      },
    }).ref;

    return {
      ...result,
      jsonArtifact,
      markdownArtifact,
    };
  }

  /** Lists active environment readiness records for an environment */
  public listEnvironmentReadiness(environment?: EnvironmentName | null): EnvironmentReadinessRecord[] {
    return this.store.release.listEnvironmentReadinessRecords(environment, {
      activeOnly: true,
      limit: 200,
    });
  }

  /** Lists historical capability matrix reports */
  public listReports(limit = 20): EnterpriseCapabilityReportRecord[] {
    return this.store.release.listEnterpriseCapabilityReports(limit);
  }

  /**
   * Evaluates a single capability against tier, deployment mode, and readiness.
   *
   * Returns an entry with:
   * - status: available (green), degraded (yellow), or blocked (red)
   * - reasonCodes: Why the capability is not available
   * - readiness: Per-component readiness status
   */
  private evaluateCapability(
    definition: EnterpriseCapabilityDefinition,
    context: {
      tier: LicenseTier;
      environment: EnvironmentName;
      deploymentMode: DeploymentMode;
    },
  ): EnterpriseCapabilityMatrixEntry {
    const reasonCodes: string[] = [];
    const readiness: EnterpriseCapabilityMatrixEntry["readiness"] = [];

    // Check license tier requirement
    if (compareTier(context.tier, definition.requiredTier) < 0) {
      reasonCodes.push(`license_tier_below_requirement:${definition.requiredTier}`);
    }

    // Check deployment mode support
    if (!definition.supportedDeploymentModes.includes(context.deploymentMode)) {
      reasonCodes.push(`deployment_mode_not_supported:${context.deploymentMode}`);
    }

    // Evaluate each readiness requirement
    for (const requirement of definition.readinessRequirements) {
      const record = this.store.release.getActiveEnvironmentReadinessRecord(
        context.environment,
        requirement.componentType,
        requirement.componentId,
      );

      // Check if readiness record exists and is credential-ready
      if (!record || record.credentialReady !== 1) {
        reasonCodes.push(
          `readiness_missing:${requirement.componentType}:${requirement.componentId}`,
        );
        readiness.push({
          componentType: requirement.componentType,
          componentId: requirement.componentId,
          gateKey: requirement.gateKey ?? null,
          status: "missing",
          recordId: record?.readinessId ?? null,
        });
        continue;
      }

      // Check secondary gate if required
      const secondaryGates = JSON.parse(record.secondaryGatesJson) as Record<string, boolean>;
      if (requirement.gateKey && secondaryGates[requirement.gateKey] !== true) {
        reasonCodes.push(
          `readiness_gate_blocked:${requirement.componentType}:${requirement.componentId}:${requirement.gateKey}`,
        );
        readiness.push({
          componentType: requirement.componentType,
          componentId: requirement.componentId,
          gateKey: requirement.gateKey,
          status: "gate_blocked",
          recordId: record.readinessId,
        });
        continue;
      }

      // Component is ready
      readiness.push({
        componentType: requirement.componentType,
        componentId: requirement.componentId,
        gateKey: requirement.gateKey ?? null,
        status: "ready",
        recordId: record.readinessId,
      });
    }

    // Determine overall status
    const status: EnterpriseCapabilityStatus = reasonCodes.length === 0
      ? "available"
      : reasonCodes.some((reason) => reason.startsWith("license_tier_below_requirement") || reason.startsWith("deployment_mode_not_supported"))
        ? "blocked"
        : "degraded";

    return {
      capabilityKey: definition.capabilityKey,
      displayName: definition.displayName,
      status,
      requiredTier: definition.requiredTier,
      requiredDeploymentModes: definition.supportedDeploymentModes,
      reasonCodes,
      readiness,
    };
  }

  /** Builds summary counts from matrix entries */
  private buildSummary(entries: readonly EnterpriseCapabilityMatrixEntry[]): EnterpriseCapabilitySummary {
    const available = entries.filter((entry) => entry.status === "available").length;
    const degraded = entries.filter((entry) => entry.status === "degraded").length;
    const blocked = entries.filter((entry) => entry.status === "blocked").length;
    let overallVerdict: EnterpriseCapabilitySummary["overallVerdict"] = "ready";
    if (blocked > 0) {
      overallVerdict = "blocked";
    } else if (degraded > 0) {
      overallVerdict = "partial";
    }
    return {
      available,
      degraded,
      blocked,
      total: entries.length,
      overallVerdict,
    };
  }
}

/**
 * Factory function to create a fully-initialized EnterpriseCapabilityMatrixService.
 * Handles storage context opening, migration, and artifact store setup.
 */
export function createEnterpriseCapabilityMatrixService(
  dbPath: string,
  options: EnterpriseCapabilityMatrixServiceOptions & {
    artifactRoot?: string;
  } = {},
): EnterpriseCapabilityMatrixService {
  const storage = openAuthoritativeStorageContext({
    dbPath,
  });
  storage.migrate();
  const artifactStoreOptions: ArtifactStoreOptions | undefined = options.artifactRoot == null
    ? options.artifactStoreOptions
    : {
      ...(options.artifactStoreOptions ?? {}),
      rootDir: options.artifactRoot,
    };
  return new EnterpriseCapabilityMatrixService(storage.sql, storage.store, {
    ...(artifactStoreOptions ? { artifactStoreOptions } : {}),
    ...(options.capabilityDefinitions ? { capabilityDefinitions: options.capabilityDefinitions } : {}),
  });
}
