/**
 * War Room Coordination Service
 *
 * Provides multi-participant coordination for SEV1 incident response.
 * §12 defines war room coordination for critical incidents requiring
 * real-time collaboration between multiple responders.
 *
 * Features:
 * - Real-time participant tracking
 * - Role-based assignments (incident commander, scribe, comms lead, etc.)
 * - Unified command timeline for coordinated response
 * - SEV1 escalation with automatic war room creation
 */

import { newId, nowIso } from "../../contracts/types/ids.js";

/**
 * War room participant role assignments.
 */
export type WarRoomRole =
  | "incident_commander"
  | "deputy_commander"
  | "technical_lead"
  | "communications_lead"
  | "scribe"
  | "subject_matter_expert"
  | "observer";

/**
 * Participant status in war room.
 */
export type ParticipantStatus = "joined" | "active" | "standing_by" | "departed";

/**
 * A participant in the war room.
 */
export interface WarRoomParticipant {
  participantId: string;
  userId: string;
  role: WarRoomRole;
  joinedAt: string;
  status: ParticipantStatus;
  currentTask: string | null;
}

/**
 * War room command entry for timeline tracking.
 */
export interface WarRoomCommand {
  commandId: string;
  timestamp: string;
  participantId: string;
  role: WarRoomRole;
  command: string;
  target: string | null;
  result: string | null;
}

/**
 * War room status.
 */
export type WarRoomStatus = "forming" | "active" | "mitigation_complete" | "closed";

/**
 * War room instance for SEV1 incident coordination.
 */
export interface WarRoom {
  warRoomId: string;
  incidentId: string | null;
  status: WarRoomStatus;
  createdAt: string;
  activatedAt: string | null;
  closedAt: string | null;
  participants: readonly WarRoomParticipant[];
  commandLog: readonly WarRoomCommand[];
  currentPhase: string;
  objectives: readonly string[];
}

/**
 * War room creation options.
 */
export interface WarRoomCreateOptions {
  incidentId?: string;
  initialParticipants?: readonly { userId: string; role: WarRoomRole }[];
  objectives?: readonly string[];
}

/**
 * War Room Coordination Service for SEV1 multi-participant incidents.
 */
export class WarRoomCoordinator {
  private readonly warRooms = new Map<string, WarRoom>();
  private readonly participantWarRooms = new Map<string, Set<string>>();

  /**
   * Creates a new war room for incident coordination.
   */
  public createWarRoom(options: WarRoomCreateOptions = {}): WarRoom {
    const warRoomId = newId("warroom");
    const now = nowIso();

    const participants: WarRoomParticipant[] = options.initialParticipants
      ? options.initialParticipants.map((p) => ({
          participantId: newId("wrparticipant"),
          userId: p.userId,
          role: p.role,
          joinedAt: now,
          status: "joined" as ParticipantStatus,
          currentTask: null,
        }))
      : [];

    const warRoom: WarRoom = {
      warRoomId,
      incidentId: options.incidentId ?? null,
      status: "forming",
      createdAt: now,
      activatedAt: null,
      closedAt: null,
      participants,
      commandLog: [],
      currentPhase: "initial_assessment",
      objectives: options.objectives ?? [],
    };

    this.warRooms.set(warRoomId, warRoom);

    // Track participant to war room mapping
    for (const p of participants) {
      this.addParticipantMapping(p.userId, warRoomId);
    }

    return warRoom;
  }

  /**
   * Activates a war room, indicating active incident response.
   */
  public activateWarRoom(warRoomId: string): boolean {
    const warRoom = this.warRooms.get(warRoomId);
    if (!warRoom || warRoom.status !== "forming") {
      return false;
    }

    warRoom.status = "active";
    warRoom.activatedAt = nowIso();
    return true;
  }

  /**
   * Closes a war room after incident resolution.
   */
  public closeWarRoom(warRoomId: string): boolean {
    const warRoom = this.warRooms.get(warRoomId);
    if (!warRoom) {
      return false;
    }

    warRoom.status = "closed";
    warRoom.closedAt = nowIso();
    return true;
  }

  /**
   * Adds a participant to a war room.
   */
  public addParticipant(
    warRoomId: string,
    userId: string,
    role: WarRoomRole,
  ): WarRoomParticipant | null {
    const warRoom = this.warRooms.get(warRoomId);
    if (!warRoom || warRoom.status === "closed") {
      return null;
    }

    const participant: WarRoomParticipant = {
      participantId: newId("wrparticipant"),
      userId,
      role,
      joinedAt: nowIso(),
      status: "joined",
      currentTask: null,
    };

    // Create new participants array (immutable update)
    const participants = [...warRoom.participants, participant];
    warRoom.participants = participants;

    this.addParticipantMapping(userId, warRoomId);
    return participant;
  }

  /**
   * Removes a participant from a war room.
   */
  public removeParticipant(warRoomId: string, participantId: string): boolean {
    const warRoom = this.warRooms.get(warRoomId);
    if (!warRoom) {
      return false;
    }

    const participant = warRoom.participants.find((p) => p.participantId === participantId);
    if (!participant) {
      return false;
    }

    // Create new participants array without the removed participant
    warRoom.participants = warRoom.participants.filter((p) => p.participantId !== participantId);
    return true;
  }

  /**
   * Updates a participant's status.
   */
  public updateParticipantStatus(
    warRoomId: string,
    participantId: string,
    status: ParticipantStatus,
    currentTask?: string,
  ): boolean {
    const warRoom = this.warRooms.get(warRoomId);
    if (!warRoom) {
      return false;
    }

    const participant = warRoom.participants.find((p) => p.participantId === participantId);
    if (!participant) {
      return false;
    }

    participant.status = status;
    if (currentTask !== undefined) {
      participant.currentTask = currentTask;
    }
    return true;
  }

  /**
   * Logs a command in the war room timeline.
   */
  public logCommand(
    warRoomId: string,
    participantId: string,
    role: WarRoomRole,
    command: string,
    target?: string,
    result?: string,
  ): WarRoomCommand | null {
    const warRoom = this.warRooms.get(warRoomId);
    if (!warRoom) {
      return null;
    }

    const cmd: WarRoomCommand = {
      commandId: newId("wrcommand"),
      timestamp: nowIso(),
      participantId,
      role,
      command,
      target: target ?? null,
      result: result ?? null,
    };

    warRoom.commandLog = [...warRoom.commandLog, cmd];
    return cmd;
  }

  /**
   * Updates the current phase of the war room.
   */
  public setPhase(warRoomId: string, phase: string): boolean {
    const warRoom = this.warRooms.get(warRoomId);
    if (!warRoom) {
      return false;
    }

    warRoom.currentPhase = phase;
    return true;
  }

  /**
   * Gets a war room by ID.
   */
  public getWarRoom(warRoomId: string): WarRoom | null {
    return this.warRooms.get(warRoomId) ?? null;
  }

  /**
   * Gets all war rooms for a specific incident.
   */
  public getWarRoomsByIncident(incidentId: string): WarRoom[] {
    return [...this.warRooms.values()].filter((wr) => wr.incidentId === incidentId);
  }

  /**
   * Gets all active war rooms.
   */
  public getActiveWarRooms(): WarRoom[] {
    return [...this.warRooms.values()].filter((wr) => wr.status === "active");
  }

  /**
   * Gets all war rooms for a specific user.
   */
  public getWarRoomsForUser(userId: string): WarRoom[] {
    const warRoomIds = this.participantWarRooms.get(userId);
    if (!warRoomIds) {
      return [];
    }
    return [...warRoomIds].map((id) => this.warRooms.get(id)).filter((wr): wr is WarRoom => wr !== undefined);
  }

  private addParticipantMapping(userId: string, warRoomId: string): void {
    let warRooms = this.participantWarRooms.get(userId);
    if (!warRooms) {
      warRooms = new Set<string>();
      this.participantWarRooms.set(userId, warRooms);
    }
    warRooms.add(warRoomId);
  }
}