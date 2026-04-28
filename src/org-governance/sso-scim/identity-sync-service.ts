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

export class IdentitySyncService {
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
