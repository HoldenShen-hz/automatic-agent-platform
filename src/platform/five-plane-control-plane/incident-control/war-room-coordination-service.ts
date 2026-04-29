/**
 * War Room Coordination Service
 *
 * Provides multi-participant coordination for SEV1 incidents.
 * §R14-10: War-room coordination service for SEV1 multi-participant
 *
 * ## Purpose
 *
 * When a SEV1 incident occurs, multiple participants need to coordinate:
 * - Incident Commander (IC) - leads the response
 * - Technical Lead - drives technical investigation
 * - Communications Lead - manages stakeholder updates
 * - Subject Matter Experts - provide domain expertise
 * - Observers - for learning/documentation
 *
 * ## Features
 *
 * - Participant management with roles
 * - Unified incident timeline
 * - Decision logging with voting
 * - Real-time status updates
 * - Automatic stakeholder notifications
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import type { IncidentSeverity } from "./incident-detector.js";

/**
 * War Room participant role
 */
export type WarRoomRole =
  | "incident_commander"
  | "technical_lead"
  | "communications_lead"
  | "subject_matter_expert"
  | "observer";

/**
 * Participant in the war room
 */
export interface WarRoomParticipant {
  participantId: string;
  userId: string;
  role: WarRoomRole;
  joinedAt: string;
  leftAt: string | null;
  status: "active" | "away" | "offline";
}

/**
 * Decision made during incident response
 */
export interface WarRoomDecision {
  decisionId: string;
  description: string;
  rationale: string;
  decidedBy: readonly string[];
  votedBy: readonly string[];
  timestamp: string;
  outcome?: "approved" | "rejected" | "pending";
}

/**
 * Status update in the war room
 */
export interface WarRoomStatusUpdate {
  updateId: string;
  authorId: string;
  content: string;
  timestamp: string;
  severity: "info" | "warning" | "critical";
}

/**
 * War Room session for coordinating incident response
 */
export interface WarRoomSession {
  sessionId: string;
  incidentId: string;
  severity: IncidentSeverity;
  status: "active" | "resolved" | "closed";
  createdAt: string;
  resolvedAt: string | null;
  participants: readonly WarRoomParticipant[];
  decisions: readonly WarRoomDecision[];
  statusUpdates: readonly WarRoomStatusUpdate[];
  currentPhase: "investigation" | "mitigation" | "recovery" | "post_mortem";
}

/**
 * Options for creating a war room
 */
export interface WarRoomOptions {
  autoNotifyOnSev1?: boolean;
  maxObservers?: number;
}

export class WarRoomCoordinationService {
  private readonly sessions = new Map<string, WarRoomSession>();
  private readonly incidentToSession = new Map<string, string>();
  private readonly options: WarRoomOptions;

  public constructor(options: WarRoomOptions = {}) {
    this.options = {
      autoNotifyOnSev1: options.autoNotifyOnSev1 ?? true,
      maxObservers: options.maxObservers ?? 10,
    };
  }

  /**
   * Creates a new war room session for an incident.
   * SEV1 incidents automatically get war room created.
   */
  public createWarRoom(
    incidentId: string,
    severity: IncidentSeverity,
    initiatorId: string,
  ): WarRoomSession {
    const sessionId = newId("warroom");

    const initiator: WarRoomParticipant = {
      participantId: newId("participant"),
      userId: initiatorId,
      role: "incident_commander",
      joinedAt: nowIso(),
      leftAt: null,
      status: "active",
    };

    const session: WarRoomSession = {
      sessionId,
      incidentId,
      severity,
      status: "active",
      createdAt: nowIso(),
      resolvedAt: null,
      participants: [initiator],
      decisions: [],
      statusUpdates: [],
      currentPhase: "investigation",
    };

    this.sessions.set(sessionId, session);
    this.incidentToSession.set(incidentId, sessionId);

    return session;
  }

  /**
   * Gets the war room session for an incident.
   */
  public getWarRoom(incidentId: string): WarRoomSession | null {
    const sessionId = this.incidentToSession.get(incidentId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Adds a participant to the war room.
   */
  public addParticipant(
    sessionId: string,
    userId: string,
    role: WarRoomRole,
  ): WarRoomParticipant | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "active") return null;

    // Check observer limit
    if (role === "observer") {
      const observerCount = session.participants.filter(
        (p) => p.role === "observer" && p.status === "active",
      ).length;
      if (observerCount >= (this.options.maxObservers ?? 10)) {
        return null;
      }
    }

    const participant: WarRoomParticipant = {
      participantId: newId("participant"),
      userId,
      role,
      joinedAt: nowIso(),
      leftAt: null,
      status: "active",
    };

    const updatedParticipants = [...session.participants, participant];
    this.sessions.set(sessionId, { ...session, participants: updatedParticipants });

    return participant;
  }

  /**
   * Removes a participant from the war room.
   */
  public removeParticipant(sessionId: string, participantId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const participant = session.participants.find((p) => p.participantId === participantId);
    if (!participant) return false;

    const updatedParticipants = session.participants.map((p) =>
      p.participantId === participantId
        ? { ...p, leftAt: nowIso(), status: "offline" as const }
        : p,
    );

    this.sessions.set(sessionId, { ...session, participants: updatedParticipants });
    return true;
  }

  /**
   * Records a decision made in the war room.
   */
  public recordDecision(
    sessionId: string,
    description: string,
    rationale: string,
    decidedBy: readonly string[],
  ): WarRoomDecision | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "active") return null;

    const decision: WarRoomDecision = {
      decisionId: newId("decision"),
      description,
      rationale,
      decidedBy,
      votedBy: decidedBy,
      timestamp: nowIso(),
      outcome: "approved",
    };

    const updatedDecisions = [...session.decisions, decision];
    this.sessions.set(sessionId, { ...session, decisions: updatedDecisions });

    return decision;
  }

  /**
   * Adds a status update to the war room.
   */
  public addStatusUpdate(
    sessionId: string,
    authorId: string,
    content: string,
    severity: WarRoomStatusUpdate["severity"] = "info",
  ): WarRoomStatusUpdate | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "active") return null;

    const update: WarRoomStatusUpdate = {
      updateId: newId("update"),
      authorId,
      content,
      timestamp: nowIso(),
      severity,
    };

    const updatedUpdates = [...session.statusUpdates, update];
    this.sessions.set(sessionId, { ...session, statusUpdates: updatedUpdates });

    return update;
  }

  /**
   * Advances the incident phase.
   */
  public advancePhase(
    sessionId: string,
    newPhase: WarRoomSession["currentPhase"],
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "active") return false;

    this.sessions.set(sessionId, { ...session, currentPhase: newPhase });
    return true;
  }

  /**
   * Resolves the war room after incident is resolved.
   */
  public resolveWarRoom(sessionId: string): WarRoomSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const resolvedSession: WarRoomSession = {
      ...session,
      status: "resolved",
      resolvedAt: nowIso(),
    };

    this.sessions.set(sessionId, resolvedSession);
    return resolvedSession;
  }

  /**
   * Checks if an incident has an active war room.
   */
  public hasActiveWarRoom(incidentId: string): boolean {
    const session = this.getWarRoom(incidentId);
    return session !== null && session.status === "active";
  }

  /**
   * Gets active war rooms count.
   */
  public getActiveWarRoomCount(): number {
    return [...this.sessions.values()].filter((s) => s.status === "active").length;
  }
}