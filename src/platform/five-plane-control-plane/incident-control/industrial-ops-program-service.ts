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

import { ArtifactStore, type ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
import type { ArtifactRef, EnvironmentName } from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
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
 * Default alert policies for different severity levels.
 * These define the acknowledgement timeouts and notification channels
 * for incidents of each severity level (P0-P3).
 */
const DEFAULT_ALERT_POLICIES: readonly IndustrialOpsAlertPolicy[] = [
  {
    severity: "P0",
    ackWithinMinutes: 5,
    channels: ["incident_console", "oncall_notifications", "ops_gateway"],
    autoMitigation: ["freeze_rollout", "tighten_admission", "open_incident_console"],
  },
  {
    severity: "P1",
    ackWithinMinutes: 15,
    channels: ["incident_console", "ops_gateway"],
    autoMitigation: ["collect_diagnostics", "route_to_primary_oncall"],
  },
  {
    severity: "P2",
    ackWithinMinutes: 30,
    channels: ["ops_gateway"],
    autoMitigation: ["collect_diagnostics"],
  },
  {
    severity: "P3",
    ackWithinMinutes: 60,
    channels: ["ops_gateway"],
    autoMitigation: ["log_for_review"],
  },
] as const;

/**
 * Builds a markdown representation of the Industrial Ops Program report.
 * Used for human-readable export and documentation purposes.
 */
function buildMarkdown(report: IndustrialOpsProgramReport): string {
  return [
    "# Industrial Ops Program",
    "",
    `- Program ID: \`${report.programId}\``,
    `- Environment: \`${report.environment}\``,
    `- Shift Owner: \`${report.shiftOwner}\``,
    `- Status: \`${report.status}\``,
    `- Incident ID: \`${report.incidentId ?? "none"}\``,
    "",
    "## Failing SLOs",
    "",
    ...(report.failingSloKeys.length > 0 ? report.failingSloKeys.map((item) => `- \`${item}\``) : ["- none"]),
    "",
    "## Handoff Checklist",
    "",
    ...report.handoffChecklist.map((item) => `- ${item}`),
    "",
    "## Recommended Runbooks",
    "",
    ...(report.recommendedRunbooks.length > 0 ? report.recommendedRunbooks.map((item) => `- \`${item}\``) : ["- none"]),
    "",
    "## Recommended Commands",
    "",
    ...(report.recommendedCommands.length > 0 ? report.recommendedCommands.map((item) => `- \`${item}\``) : ["- none"]),
  ].join("\n");
}

/**
 * IndustrialOpsProgramService builds comprehensive operations reports
 * that combine governance data, SLO status, and incident information
 * into a format suitable for shift handoffs and incident management.
 */
export class IndustrialOpsProgramService {
  private readonly artifactStore: ArtifactStore;

  public constructor(
    private readonly governanceService: OperationsGovernanceService,
    options: IndustrialOpsProgramServiceOptions = {},
  ) {
    this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
  }

  /**
   * Builds an Industrial Ops Program report by aggregating the operations
   * governance report with Industrial Ops-specific information including
   * handoff checklists, alert policies, and recommended runbooks.
   *
   * @param input - Report generation parameters including environment and optional task ID
   * @returns Complete Industrial Ops Program report
   */
  public buildReport(input: IndustrialOpsProgramInput): IndustrialOpsProgramReport {
    const governanceReport = this.governanceService.buildReport({
      environment: input.environment,
      ...(input.generatedAt ? { generatedAt: input.generatedAt } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
    });

    // Extract failing and warning SLO keys for quick reference
    const failingSloKeys = governanceReport.slos.filter((item) => item.status === "fail").map((item) => item.key);
    const warningSloKeys = governanceReport.slos.filter((item) => item.status === "warning").map((item) => item.key);

    // Standard handoff checklist items for operations continuity
    const handoffChecklist = [
      `Attach governance report ${governanceReport.reportId} to the active shift handoff.`,
      "Record the last mitigation command that changed system state.",
      "Verify rollback, admission control, and repair status before handing over.",
      "Attach incident timeline and diagnostics bundle to the incident record.",
    ];

    return {
      programId: newId("ops_program"),
      generatedAt: input.generatedAt ?? nowIso(),
      environment: input.environment,
      shiftOwner: input.shiftOwner?.trim() || governanceReport.oncallPolicy.primaryRole,
      status: governanceReport.summary.overallStatus,
      failingSloKeys,
      warningSloKeys,
      incidentId: governanceReport.incident?.incidentId ?? null,
      handoffChecklist,
      alertPolicies: [...DEFAULT_ALERT_POLICIES],
      recommendedRunbooks: governanceReport.incident?.recommendedRunbookIds ?? [],
      recommendedCommands: governanceReport.incident?.recommendedCommands ?? [],
      governanceReport,
    };
  }

  /**
   * Exports the Industrial Ops Program report to both JSON and markdown artifacts
   * using the artifact store.
   *
   * @param input - Report generation parameters
   * @returns The report along with references to the stored artifacts
   */
  public exportReport(input: IndustrialOpsProgramInput): IndustrialOpsProgramExportResult {
    const report = this.buildReport(input);
    const taskId = input.taskId ?? "ops_program";

    // Write JSON artifact for programmatic consumption
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId,
      executionId: null,
      stepId: null,
      kind: "industrial_ops_program",
      fileName: `industrial-ops-program-${input.environment}.json`,
      content: report,
    }).ref;

    // Write markdown artifact for human readability
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId,
      executionId: null,
      stepId: null,
      kind: "industrial_ops_program_markdown",
      fileName: `industrial-ops-program-${input.environment}.md`,
      content: buildMarkdown(report),
      mimeType: "text/markdown",
    }).ref;

    return {
      report,
      jsonArtifact,
      markdownArtifact,
    };
  }
}
