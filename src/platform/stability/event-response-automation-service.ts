/**
 * Event Response Automation Service
 *
 * Per §12.2/§60/§28: Implements SEV1-4 emergency response, emergency brake,
 * and incident DLQ (Dead Letter Queue) handling.
 */

import { DurableEventBus } from "../state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../contracts/types/ids.js";

/**
 * Incident severity levels.
 */
export type SevLevel = "SEV1" | "SEV2" | "SEV3" | "SEV4";

/**
 * Emergency brake mode.
 */
export type BrakeMode = "none" | "advisory" | "partial" | "full";

/**
 * Incident status.
 */
export type IncidentStatus = "open" | "acknowledged" | "mitigating" | "resolved" | "escalated";

/**
 * DLQ entry status.
 */
export type DlqEntryStatus = "pending" | "retrying" | "dead" | "processed";

/**
 * Represents an incident.
 */
export interface Incident {
  /** Unique incident ID */
  incidentId: string;
  /** Severity level */
  severity: SevLevel;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Current status */
  status: IncidentStatus;
  /** Who acknowledged the incident */
  acknowledgedBy: string | null;
  /** When it was acknowledged */
  acknowledgedAt: string | null;
  /** Who resolved the incident */
  resolvedBy: string | null;
  /** When it was resolved */
  resolvedAt: string | null;
  /** Root cause if known */
  rootCause: string | null;
  /** Resolution steps taken */
  resolution: string | null;
  /** Affected components */
  affectedComponents: string[];
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Trace ID for correlation */
  traceId: string | null;
}

/**
 * DLQ entry for failed events.
 */
export interface DlqEntry {
  /** Unique DLQ entry ID */
  dlqId: string;
  /** Original event type */
  eventType: string;
  /** Original event payload */
  payload: Record<string, unknown>;
  /** Error message from last attempt */
  lastError: string | null;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum retry attempts before dead */
  maxRetries: number;
  /** Current status */
  status: DlqEntryStatus;
  /** When first failed */
  firstFailedAt: string;
  /** When last attempted */
  lastAttemptedAt: string | null;
  /** When will be retried (if scheduled) */
  nextRetryAt: string | null;
}

/**
 * Emergency brake state.
 */
export interface EmergencyBrakeState {
  /** Current brake mode */
  mode: BrakeMode;
  /** Who engaged the brake */
  engagedBy: string | null;
  /** When the brake was engaged */
  engagedAt: string | null;
  /** Reason for engagement */
  reason: string | null;
  /** Severity that triggered this */
  triggerSeverity: SevLevel | null;
  /** Affected planes/planes (comma-separated) */
  affectedPlanes: string[];
}

/**
 * Options for EventResponseAutomationService.
 */
export interface EventResponseAutomationServiceOptions {
  /** Event bus for publishing events */
  eventBus?: DurableEventBus | null;
  /** Maximum retry attempts for DLQ items (default: 3) */
  maxDlqRetries?: number;
  /** Retry backoff base in ms (default: 1000) */
  retryBackoffMs?: number;
  /** Auto-acknowledge SEV1 within seconds (default: 60) */
  sev1AutoAckSeconds?: number;
  /** Auto-acknowledge SEV2 within seconds (default: 300) */
  sev2AutoAckSeconds?: number;
}

/**
 * Service for event response automation.
 *
 * Per §12.2/§60/§28: Implements:
 * - SEV1-4 incident creation and lifecycle
 * - Emergency brake (advisory/partial/full)
 * - Incident DLQ for failed event handling
 */
export class EventResponseAutomationService {
  private readonly eventBus: DurableEventBus | null;
  private readonly maxDlqRetries: number;
  private readonly retryBackoffMs: number;
  private readonly sev1AutoAckSeconds: number;
  private readonly sev2AutoAckSeconds: number;

  /** Active incidents by ID */
  private readonly incidents = new Map<string, Incident>();

  /** DLQ entries by ID */
  private readonly dlqEntries = new Map<string, DlqEntry>();

  /** Current emergency brake state */
  private brakeState: EmergencyBrakeState = {
    mode: "none",
    engagedBy: null,
    engagedAt: null,
    reason: null,
    triggerSeverity: null,
    affectedPlanes: [],
  };

  private _initialized = false;

  public constructor(options: EventResponseAutomationServiceOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.maxDlqRetries = options.maxDlqRetries ?? 3;
    this.retryBackoffMs = options.retryBackoffMs ?? 1000;
    this.sev1AutoAckSeconds = options.sev1AutoAckSeconds ?? 60;
    this.sev2AutoAckSeconds = options.sev2AutoAckSeconds ?? 300;
  }

  /**
   * Initializes the service.
   */
  public async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    if (this.eventBus) {
      // Subscribe to relevant events
      await this.eventBus.subscribe(
        "incident.sev1",
        (event) => this.handleSeverityEvent(this.parseEventPayload(event)),
      );
      await this.eventBus.subscribe(
        "incident.sev2",
        (event) => this.handleSeverityEvent(this.parseEventPayload(event)),
      );
      await this.eventBus.subscribe(
        "incident.sev3",
        (event) => this.handleSeverityEvent(this.parseEventPayload(event)),
      );
      await this.eventBus.subscribe(
        "incident.sev4",
        (event) => this.handleSeverityEvent(this.parseEventPayload(event)),
      );
      await this.eventBus.subscribe(
        "emergency.brake.engage",
        (event) => this.handleBrakeEngageEvent(this.parseEventPayload(event)),
      );
      await this.eventBus.subscribe(
        "emergency.brake.release",
        (event) => this.handleBrakeReleaseEvent(this.parseEventPayload(event)),
      );
      await this.eventBus.subscribe(
        "dlq.retry",
        (event) => this.handleDlqRetryEvent(this.parseEventPayload(event)),
      );
    }

    this._initialized = true;
  }

  // ============ Incident Management ============

  /**
   * Creates a new incident.
   *
   * @param severity - Incident severity
   * @param title - Incident title
   * @param description - Detailed description
   * @param affectedComponents - Affected components
   * @param traceId - Optional trace ID
   * @returns The created incident
   */
  public createIncident(
    severity: SevLevel,
    title: string,
    description: string,
    affectedComponents: string[] = [],
    traceId: string | null = null,
  ): Incident {
    const incidentId = newId("inc");
    const now = nowIso();

    const incident: Incident = {
      incidentId,
      severity,
      title,
      description,
      status: "open",
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      rootCause: null,
      resolution: null,
      affectedComponents,
      createdAt: now,
      updatedAt: now,
      traceId,
    };

    this.incidents.set(incidentId, incident);

    // Auto-engage emergency brake for SEV1
    if (severity === "SEV1") {
      this.engageBrake("full", `SEV1: ${title}`, incidentId, affectedComponents);
    } else if (severity === "SEV2") {
      this.engageBrake("partial", `SEV2: ${title}`, incidentId, affectedComponents);
    }

    // Emit incident event
    this.emitIncidentEvent("incident.created", incident);

    return incident;
  }

  /**
   * Acknowledges an incident.
   *
   * @param incidentId - Incident ID
   * @param acknowledgedBy - Who acknowledged
   * @returns Updated incident or null if not found
   */
  public acknowledgeIncident(
    incidentId: string,
    acknowledgedBy: string,
  ): Incident | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return null;
    }

    incident.status = "acknowledged";
    incident.acknowledgedBy = acknowledgedBy;
    incident.acknowledgedAt = nowIso();
    incident.updatedAt = nowIso();

    this.emitIncidentEvent("incident.acknowledged", incident);

    return incident;
  }

  /**
   * Resolves an incident.
   *
   * @param incidentId - Incident ID
   * @param resolvedBy - Who resolved
   * @param rootCause - Root cause of the incident
   * @param resolution - How it was resolved
   * @returns Updated incident or null if not found
   */
  public resolveIncident(
    incidentId: string,
    resolvedBy: string,
    rootCause: string,
    resolution: string,
  ): Incident | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return null;
    }

    incident.status = "resolved";
    incident.resolvedBy = resolvedBy;
    incident.resolvedAt = nowIso();
    incident.rootCause = rootCause;
    incident.resolution = resolution;
    incident.updatedAt = nowIso();

    // Release brake if all SEV1/SEV2 resolved
    if ((incident.severity === "SEV1" || incident.severity === "SEV2") && this.brakeState.mode !== "none") {
      const activeSevIncidents = this.getActiveIncidents().filter(
        (i) => (i.severity === "SEV1" || i.severity === "SEV2") && i.incidentId !== incidentId,
      );
      if (activeSevIncidents.length === 0) {
        this.releaseBrake(resolvedBy, "All SEV1/SEV2 resolved");
      }
    }

    this.emitIncidentEvent("incident.resolved", incident);

    return incident;
  }

  /**
   * Escalates an incident to higher severity.
   *
   * @param incidentId - Incident ID
   * @param newSeverity - New severity level
   * @returns Updated incident or null if not found
   */
  public escalateIncident(
    incidentId: string,
    newSeverity: SevLevel,
  ): Incident | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return null;
    }

    const oldSeverity = incident.severity;
    incident.severity = newSeverity;
    incident.updatedAt = nowIso();

    // Re-engage brake if escalated to SEV1/SEV2
    if (newSeverity === "SEV1" || newSeverity === "SEV2") {
      this.engageBrake(
        newSeverity === "SEV1" ? "full" : "partial",
        `Escalated ${oldSeverity}→${newSeverity}: ${incident.title}`,
        incidentId,
        incident.affectedComponents,
      );
    }

    this.emitIncidentEvent("incident.escalated", incident);

    return incident;
  }

  /**
   * Gets an incident by ID.
   */
  public getIncident(incidentId: string): Incident | null {
    return this.incidents.get(incidentId) ?? null;
  }

  /**
   * Gets all incidents, optionally filtered.
   */
  public getIncidents(filter?: {
    status?: IncidentStatus | null;
    severity?: SevLevel | null;
    limit?: number;
  }): Incident[] {
    let incidents = Array.from(this.incidents.values());

    if (filter?.status) {
      incidents = incidents.filter((i) => i.status === filter.status);
    }
    if (filter?.severity) {
      incidents = incidents.filter((i) => i.severity === filter.severity);
    }

    // Sort by severity then created time
    incidents.sort((a, b) => {
      const severityOrder = { SEV1: 0, SEV2: 1, SEV3: 2, SEV4: 3 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return a.createdAt.localeCompare(b.createdAt);
    });

    if (filter?.limit) {
      incidents = incidents.slice(0, filter.limit);
    }

    return incidents;
  }

  /**
   * Gets all active (open/acknowledged) incidents.
   */
  public getActiveIncidents(): Incident[] {
    return this.getIncidents({ status: "open" }).concat(
      this.getIncidents({ status: "acknowledged" }),
    );
  }

  // ============ Emergency Brake ============

  /**
   * Engages the emergency brake.
   *
   * @param mode - Brake mode (advisory/partial/full)
   * @param reason - Reason for engagement
   * @param triggerIncidentId - Optional incident that triggered this
   * @param affectedPlanes - Affected planes
   */
  public engageBrake(
    mode: Exclude<BrakeMode, "none">,
    reason: string,
    triggerIncidentId: string | null = null,
    affectedPlanes: string[] = [],
  ): EmergencyBrakeState {
    this.brakeState = {
      mode,
      engagedBy: "system",
      engagedAt: nowIso(),
      reason,
      triggerSeverity: triggerIncidentId
        ? this.incidents.get(triggerIncidentId)?.severity ?? null
        : null,
      affectedPlanes,
    };

    this.emitBrakeEvent("emergency.brake.engaged", this.brakeState);

    return this.brakeState;
  }

  /**
   * Releases the emergency brake.
   *
   * @param releasedBy - Who released the brake
   * @param reason - Reason for release
   */
  public releaseBrake(releasedBy: string, reason: string): EmergencyBrakeState {
    this.brakeState = {
      mode: "none",
      engagedBy: null,
      engagedAt: null,
      reason: null,
      triggerSeverity: null,
      affectedPlanes: [],
    };

    this.emitBrakeEvent("emergency.brake.released", this.brakeState);

    return this.brakeState;
  }

  /**
   * Gets the current emergency brake state.
   */
  public getBrakeState(): EmergencyBrakeState {
    return { ...this.brakeState };
  }

  // ============ DLQ Management ============

  /**
   * Adds an event to the DLQ.
   *
   * @param eventType - Original event type
   * @param payload - Original event payload
   * @param error - Error message
   * @returns The created DLQ entry
   */
  public addToDlq(
    eventType: string,
    payload: Record<string, unknown>,
    error: string,
  ): DlqEntry {
    const dlqId = newId("dlq");
    const now = nowIso();

    const entry: DlqEntry = {
      dlqId,
      eventType,
      payload,
      lastError: error,
      retryCount: 0,
      maxRetries: this.maxDlqRetries,
      status: "pending",
      firstFailedAt: now,
      lastAttemptedAt: null,
      nextRetryAt: null,
    };

    this.dlqEntries.set(dlqId, entry);

    this.emitDlqEvent("dlq.entry.added", entry);

    return entry;
  }

  /**
   * Retries a DLQ entry.
   *
   * @param dlqId - DLQ entry ID
   * @returns Whether retry was scheduled
   */
  public retryDlqEntry(dlqId: string): boolean {
    const entry = this.dlqEntries.get(dlqId);
    if (!entry || entry.status === "dead" || entry.status === "processed") {
      return false;
    }

    entry.retryCount++;
    entry.lastAttemptedAt = nowIso();
    entry.status = "retrying";

    if (entry.retryCount >= entry.maxRetries) {
      entry.status = "dead";
      this.emitDlqEvent("dlq.entry.dead", entry);
    } else {
      // Schedule next retry with exponential backoff
      const backoffMs = this.retryBackoffMs * Math.pow(2, entry.retryCount - 1);
      entry.nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
      this.emitDlqEvent("dlq.entry.retry_scheduled", entry);
    }

    return true;
  }

  /**
   * Marks a DLQ entry as successfully processed.
   *
   * @param dlqId - DLQ entry ID
   */
  public markProcessed(dlqId: string): void {
    const entry = this.dlqEntries.get(dlqId);
    if (entry) {
      entry.status = "processed";
      this.emitDlqEvent("dlq.entry.processed", entry);
    }
  }

  /**
   * Gets a DLQ entry by ID.
   */
  public getDlqEntry(dlqId: string): DlqEntry | null {
    return this.dlqEntries.get(dlqId) ?? null;
  }

  /**
   * Gets all DLQ entries, optionally filtered.
   */
  public getDlqEntries(filter?: {
    status?: DlqEntryStatus | null;
    eventType?: string | null;
    limit?: number;
  }): DlqEntry[] {
    let entries = Array.from(this.dlqEntries.values());

    if (filter?.status) {
      entries = entries.filter((e) => e.status === filter.status);
    }
    if (filter?.eventType) {
      entries = entries.filter((e) => e.eventType === filter.eventType);
    }

    // Sort by first failed time
    entries.sort((a, b) => a.firstFailedAt.localeCompare(b.firstFailedAt));

    if (filter?.limit) {
      entries = entries.slice(0, filter.limit);
    }

    return entries;
  }

  /**
   * Gets DLQ statistics.
   */
  public getDlqStats(): {
    total: number;
    pending: number;
    retrying: number;
    dead: number;
    processed: number;
  } {
    const entries = Array.from(this.dlqEntries.values());
    return {
      total: entries.length,
      pending: entries.filter((e) => e.status === "pending").length,
      retrying: entries.filter((e) => e.status === "retrying").length,
      dead: entries.filter((e) => e.status === "dead").length,
      processed: entries.filter((e) => e.status === "processed").length,
    };
  }

  // ============ Event Handlers ============

  private handleSeverityEvent(payload: Record<string, unknown>): void {
    const severity = payload["severity"] as SevLevel;
    const title = (payload["title"] as string) ?? "Unknown incident";
    const description = (payload["description"] as string) ?? "";
    const components = (payload["affectedComponents"] as string[]) ?? [];
    const traceId = (payload["traceId"] as string) ?? null;

    this.createIncident(severity, title, description, components, traceId);
  }

  private handleBrakeEngageEvent(payload: Record<string, unknown>): void {
    const mode = payload["mode"] as Exclude<BrakeMode, "none">;
    const reason = (payload["reason"] as string) ?? "Unknown";
    const triggerIncidentId = (payload["incidentId"] as string) ?? null;
    const affectedPlanes = (payload["affectedPlanes"] as string[]) ?? [];

    this.brakeState = {
      mode,
      engagedBy: "event",
      engagedAt: nowIso(),
      reason,
      triggerSeverity: triggerIncidentId
        ? this.incidents.get(triggerIncidentId)?.severity ?? null
        : null,
      affectedPlanes,
    };
  }

  private handleBrakeReleaseEvent(_payload: Record<string, unknown>): void {
    this.brakeState = {
      mode: "none",
      engagedBy: null,
      engagedAt: null,
      reason: null,
      triggerSeverity: null,
      affectedPlanes: [],
    };
  }

  private handleDlqRetryEvent(payload: Record<string, unknown>): void {
    const dlqId = payload["dlqId"] as string;
    this.retryDlqEntry(dlqId);
  }

  private parseEventPayload(event: { payloadJson: string }): Record<string, unknown> {
    try {
      const parsed = JSON.parse(event.payloadJson) as unknown;
      return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  // ============ Event Emitters ============

  private emitIncidentEvent(
    eventType: string,
    incident: Incident,
  ): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.publish({
      eventType,
      payload: { ...incident },
    });
  }

  private emitBrakeEvent(
    eventType: string,
    state: EmergencyBrakeState,
  ): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.publish({
      eventType,
      payload: { ...state },
    });
  }

  private emitDlqEvent(eventType: string, entry: DlqEntry): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.publish({
      eventType,
      payload: { ...entry },
    });
  }
}
