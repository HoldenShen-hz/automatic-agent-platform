import { newId } from "../../platform/contracts/types/ids.js";
import { buildOidcAuthorizationUrl, type OidcProviderConfig } from "./oidc/index.js";
import { buildSamlAudience, type SamlProviderConfig } from "./saml/index.js";
import { isTerminalScimAction, ScimProvisioningEventSchema, type ScimProvisioningEvent } from "./scim-sync/index.js";

export interface IdentitySyncSnapshot {
  readonly oidcAuthorizationUrl: string;
  readonly samlAudience: string;
  readonly appliedScimEvents: readonly {
    readonly eventId: string;
    readonly terminal: boolean;
  }[];
  readonly activeSubjects: readonly string[];
  readonly dlqRecords: readonly IdentitySyncDlqRecord[];
  readonly conflictReports: readonly IdentitySyncConflictReport[];
  readonly sessionRevocationPlans: readonly SessionRevocationPlan[];
  readonly agentFreezeDirectives: readonly AgentFreezeDirective[];
}

export interface IdentitySyncDlqRecord {
  readonly dlqId: string;
  readonly eventType: string;
  readonly failureCode: "schema_validation_failed" | "event_id_conflict";
  readonly failureDetail: string;
  readonly retryCount?: number;
  readonly nextRetryAt?: string | null;
  readonly lastRetryAt?: string | null;
}

export interface IdentitySyncConflictReport {
  readonly reportId: string;
  readonly conflictType: "event_id_conflict";
  readonly eventId: string;
  readonly conflictingFields: readonly string[];
}

export interface SessionRevocationPlan {
  readonly planId: string;
  readonly subjectId: string;
  readonly revocationMode: "normal" | "security";
  readonly targetSloSeconds: 300 | 60;
  readonly oidcSessionIds: readonly string[];
  readonly samlSessionIds: readonly string[];
}

export interface AgentFreezeDirective {
  readonly directiveId: string;
  readonly subjectId: string;
  readonly reason: "identity_deconfigured" | "security_revocation";
  readonly targetSloSeconds: 300 | 60;
  readonly agentIds: readonly string[];
}

export interface IdentitySyncBootstrapOptions {
  readonly oidcSessionsBySubject?: Readonly<Record<string, readonly string[]>>;
  readonly samlSessionsBySubject?: Readonly<Record<string, readonly string[]>>;
  readonly agentAssignmentsBySubject?: Readonly<Record<string, readonly string[]>>;
  readonly securityIncidentSubjectIds?: readonly string[];
  readonly deconfiguredSubjectIds?: readonly string[];
}

export interface IdentitySyncDlqProcessingResult {
  readonly processedRecords: readonly IdentitySyncDlqRecord[];
  readonly retryQueue: readonly IdentitySyncDlqRecord[];
}

export interface IdentitySyncDailyReconciliationReport {
  readonly reportId: string;
  readonly windowStartAt: string;
  readonly windowEndAt: string;
  readonly totalDlqRecords: number;
  readonly retryAttempted: number;
  readonly exhaustedRecords: number;
  readonly pendingRetryRecords: number;
}

export class IdentitySyncService {
  private static readonly MAX_DLQ_RETRIES = 3;

  private readonly activeSubjects = new Set<string>();

  public bootstrap(
    oidc: OidcProviderConfig,
    saml: SamlProviderConfig,
    events: readonly unknown[],
    options: IdentitySyncBootstrapOptions = {},
  ): IdentitySyncSnapshot {
    const appliedScimEvents: Array<{ eventId: string; terminal: boolean }> = [];
    const dlqRecords: IdentitySyncDlqRecord[] = [];
    const conflictReports: IdentitySyncConflictReport[] = [];
    const acceptedEvents = new Map<string, ScimProvisioningEvent>();
    const terminalSubjects = new Set<string>(options.deconfiguredSubjectIds ?? []);

    for (const event of events) {
      const parsed = ScimProvisioningEventSchema.safeParse(event);
      if (!parsed.success) {
        const candidate = event as Partial<ScimProvisioningEvent> | undefined;
        dlqRecords.push({
          dlqId: newId("identity_sync_dlq"),
          eventType: candidate?.action ?? "unknown",
          failureCode: "schema_validation_failed",
          failureDetail: parsed.error.issues.map((issue) => issue.message).join("; "),
        });
        continue;
      }

      const accepted = parsed.data;
      const existing = acceptedEvents.get(accepted.eventId);
      if (existing && !sameScimEvent(existing, accepted)) {
        conflictReports.push({
          reportId: newId("identity_sync_conflict"),
          conflictType: "event_id_conflict",
          eventId: accepted.eventId,
          conflictingFields: collectConflictingFields(existing, accepted),
        });
        dlqRecords.push({
          dlqId: newId("identity_sync_dlq"),
          eventType: accepted.action,
          failureCode: "event_id_conflict",
          failureDetail: `Conflicting payload for eventId ${accepted.eventId}`,
        });
        continue;
      }
      if (existing) {
        continue;
      }

      acceptedEvents.set(accepted.eventId, accepted);
      if (isTerminalScimAction(accepted.action)) {
        this.activeSubjects.delete(accepted.subjectId);
        terminalSubjects.add(accepted.subjectId);
      } else {
        this.activeSubjects.add(accepted.subjectId);
      }
      appliedScimEvents.push({
        eventId: accepted.eventId,
        terminal: isTerminalScimAction(accepted.action),
      });
    }

    const sessionRevocationPlans = [...terminalSubjects].sort().map((subjectId) => {
      const securityMode = (options.securityIncidentSubjectIds ?? []).includes(subjectId);
      return {
        planId: newId("session_revocation"),
        subjectId,
        revocationMode: securityMode ? "security" : "normal",
        targetSloSeconds: securityMode ? 60 : 300,
        oidcSessionIds: [...(options.oidcSessionsBySubject?.[subjectId] ?? [])],
        samlSessionIds: [...(options.samlSessionsBySubject?.[subjectId] ?? [])],
      } satisfies SessionRevocationPlan;
    });
    const agentFreezeDirectives = [...terminalSubjects].sort().flatMap((subjectId) => {
      const agentIds = [...(options.agentAssignmentsBySubject?.[subjectId] ?? [])];
      if (agentIds.length === 0) {
        return [];
      }
      const securityMode = (options.securityIncidentSubjectIds ?? []).includes(subjectId);
      return [{
        directiveId: newId("agent_freeze"),
        subjectId,
        reason: securityMode ? "security_revocation" : "identity_deconfigured",
        targetSloSeconds: securityMode ? 60 : 300,
        agentIds,
      } satisfies AgentFreezeDirective];
    });

    return {
      oidcAuthorizationUrl: buildOidcAuthorizationUrl(oidc, newId("oidc_state")),
      samlAudience: buildSamlAudience(saml),
      appliedScimEvents,
      activeSubjects: [...this.activeSubjects].sort(),
      dlqRecords,
      conflictReports,
      sessionRevocationPlans,
      agentFreezeDirectives,
    };
  }

  public processDlqWithRetry(
    records: readonly IdentitySyncDlqRecord[],
    nowIso: string,
  ): IdentitySyncDlqProcessingResult {
    const processedRecords: IdentitySyncDlqRecord[] = [];
    const retryQueue: IdentitySyncDlqRecord[] = [];
    const now = new Date(nowIso);

    for (const record of records) {
      const retryCount = record.retryCount ?? 0;
      if (retryCount >= IdentitySyncService.MAX_DLQ_RETRIES) {
        processedRecords.push({
          ...record,
          retryCount,
          lastRetryAt: record.lastRetryAt ?? nowIso,
          nextRetryAt: null,
        });
        continue;
      }

      const nextRetryCount = retryCount + 1;
      const nextRetryAt = new Date(now.getTime() + computeRetryDelayMs(nextRetryCount)).toISOString();
      retryQueue.push({
        ...record,
        retryCount: nextRetryCount,
        lastRetryAt: nowIso,
        nextRetryAt,
      });
    }

    return {
      processedRecords,
      retryQueue,
    };
  }

  public generateDailyReconciliation(
    records: readonly IdentitySyncDlqRecord[],
    windowStartAt: string,
    windowEndAt: string,
  ): IdentitySyncDailyReconciliationReport {
    const retryAttempted = records.filter((record) => (record.retryCount ?? 0) > 0).length;
    const exhaustedRecords = records.filter(
      (record) => (record.retryCount ?? 0) >= IdentitySyncService.MAX_DLQ_RETRIES,
    ).length;
    return {
      reportId: `identity_reconciliation_${windowEndAt.slice(0, 10)}`,
      windowStartAt,
      windowEndAt,
      totalDlqRecords: records.length,
      retryAttempted,
      exhaustedRecords,
      pendingRetryRecords: Math.max(records.length - exhaustedRecords, 0),
    };
  }
}

function sameScimEvent(left: ScimProvisioningEvent, right: ScimProvisioningEvent): boolean {
  return left.action === right.action
    && left.subjectId === right.subjectId
    && left.occurredAt === right.occurredAt;
}

function collectConflictingFields(
  left: ScimProvisioningEvent,
  right: ScimProvisioningEvent,
): readonly string[] {
  const conflicts: string[] = [];
  if (left.action !== right.action) {
    conflicts.push("action");
  }
  if (left.subjectId !== right.subjectId) {
    conflicts.push("subjectId");
  }
  if (left.occurredAt !== right.occurredAt) {
    conflicts.push("occurredAt");
  }
  return conflicts;
}

function computeRetryDelayMs(retryCount: number): number {
  const baseDelayMs = 5 * 60 * 1000;
  return baseDelayMs * Math.max(retryCount, 1);
}
