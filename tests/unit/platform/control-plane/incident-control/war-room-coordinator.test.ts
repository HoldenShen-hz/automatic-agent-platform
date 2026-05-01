/**
 * Unit tests for WarRoomCoordinator
 * Tests war room coordination for SEV1 incident multi-participant response
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WarRoomCoordinator } from "../../../../../src/platform/control-plane/incident-control/war-room-coordinator.js";
import type { WarRoomRole, ParticipantStatus } from "../../../../../src/platform/control-plane/incident-control/war-room-coordinator.js";

test.describe("WarRoomCoordinator", () => {
  test("createWarRoom creates room with forming status", () => {
    const coordinator = new WarRoomCoordinator();

    const warRoom = coordinator.createWarRoom({ incidentId: "incident-001" });

    assert.ok(warRoom.warRoomId);
    assert.equal(warRoom.incidentId, "incident-001");
    assert.equal(warRoom.status, "forming");
    assert.equal(warRoom.currentPhase, "initial_assessment");
    assert.ok(warRoom.createdAt);
    assert.equal(warRoom.activatedAt, null);
    assert.equal(warRoom.closedAt, null);
  });

  test("createWarRoom with initial participants", () => {
    const coordinator = new WarRoomCoordinator();

    const warRoom = coordinator.createWarRoom({
      incidentId: "incident-002",
      initialParticipants: [
        { userId: "ic-1", role: "incident_commander" },
        { userId: "tech-1", role: "technical_lead" },
      ],
    });

    assert.equal(warRoom.participants.length, 2);
    assert.equal(warRoom.participants[0]!.userId, "ic-1");
    assert.equal(warRoom.participants[0]!.role, "incident_commander");
    assert.equal(warRoom.participants[0]!.status, "joined");
  });

  test("activateWarRoom changes status from forming to active", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({ incidentId: "incident-003" });

    const activated = coordinator.activateWarRoom(warRoom.warRoomId);

    assert.equal(activated, true);
    const retrieved = coordinator.getWarRoom(warRoom.warRoomId);
    assert.equal(retrieved!.status, "active");
    assert.ok(retrieved!.activatedAt);
  });

  test("activateWarRoom fails for non-forming room", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({ incidentId: "incident-004" });
    coordinator.activateWarRoom(warRoom.warRoomId);

    const activated = coordinator.activateWarRoom(warRoom.warRoomId);

    assert.equal(activated, false);
  });

  test("closeWarRoom changes status to closed", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({ incidentId: "incident-005" });

    const closed = coordinator.closeWarRoom(warRoom.warRoomId);

    assert.equal(closed, true);
    const retrieved = coordinator.getWarRoom(warRoom.warRoomId);
    assert.equal(retrieved!.status, "closed");
    assert.ok(retrieved!.closedAt);
  });

  test("addParticipant adds to active war room", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({ incidentId: "incident-006" });

    const participant = coordinator.addParticipant(warRoom.warRoomId, "sme-1", "subject_matter_expert");

    assert.ok(participant);
    assert.equal(participant!.userId, "sme-1");
    assert.equal(participant!.role, "subject_matter_expert");
    assert.equal(participant!.status, "joined");
    assert.equal(participant!.currentTask, null);
  });

  test("addParticipant rejects for closed war room", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({ incidentId: "incident-007" });
    coordinator.closeWarRoom(warRoom.warRoomId);

    const participant = coordinator.addParticipant(warRoom.warRoomId, "someone", "observer");

    assert.equal(participant, null);
  });

  test("removeParticipant removes from war room", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({
      incidentId: "incident-008",
      initialParticipants: [{ userId: "ic-1", role: "incident_commander" }],
    });
    const participantId = warRoom.participants[0]!.participantId;

    const removed = coordinator.removeParticipant(warRoom.warRoomId, participantId);

    assert.equal(removed, true);
    const retrieved = coordinator.getWarRoom(warRoom.warRoomId);
    assert.equal(retrieved!.participants.length, 0);
  });

  test("removeParticipant returns false for unknown participant", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({ incidentId: "incident-009" });

    const removed = coordinator.removeParticipant(warRoom.warRoomId, "unknown-participant");

    assert.equal(removed, false);
  });

  test("updateParticipantStatus updates status and task", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({
      incidentId: "incident-010",
      initialParticipants: [{ userId: "tech-1", role: "technical_lead" }],
    });
    const participantId = warRoom.participants[0]!.participantId;

    const updated = coordinator.updateParticipantStatus(
      warRoom.warRoomId,
      participantId,
      "active",
      "Investigating database",
    );

    assert.equal(updated, true);
    const retrieved = coordinator.getWarRoom(warRoom.warRoomId);
    const participant = retrieved!.participants.find((p) => p.participantId === participantId);
    assert.equal(participant!.status, "active");
    assert.equal(participant!.currentTask, "Investigating database");
  });

  test("logCommand adds command to timeline", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({
      incidentId: "incident-011",
      initialParticipants: [{ userId: "ic-1", role: "incident_commander" }],
    });
    const participantId = warRoom.participants[0]!.participantId;

    const cmd = coordinator.logCommand(
      warRoom.warRoomId,
      participantId,
      "incident_commander",
      "restart_database",
      "primary-db",
      "Success",
    );

    assert.ok(cmd);
    assert.equal(cmd!.command, "restart_database");
    assert.equal(cmd!.target, "primary-db");
    assert.equal(cmd!.result, "Success");
  });

  test("logCommand returns null for unknown war room", () => {
    const coordinator = new WarRoomCoordinator();

    const cmd = coordinator.logCommand("unknown", "participant", "incident_commander", "test");

    assert.equal(cmd, null);
  });

  test("setPhase updates current phase", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({ incidentId: "incident-012" });

    const set = coordinator.setPhase(warRoom.warRoomId, "mitigation");

    assert.equal(set, true);
    const retrieved = coordinator.getWarRoom(warRoom.warRoomId);
    assert.equal(retrieved!.currentPhase, "mitigation");
  });

  test("getWarRoom returns room by ID", () => {
    const coordinator = new WarRoomCoordinator();
    const created = coordinator.createWarRoom({ incidentId: "incident-013" });

    const retrieved = coordinator.getWarRoom(created.warRoomId);

    assert.ok(retrieved);
    assert.equal(retrieved!.warRoomId, created.warRoomId);
  });

  test("getWarRoom returns null for unknown ID", () => {
    const coordinator = new WarRoomCoordinator();

    const retrieved = coordinator.getWarRoom("unknown-id");

    assert.equal(retrieved, null);
  });

  test("getWarRoomsByIncident returns matching rooms", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom1 = coordinator.createWarRoom({ incidentId: "incident-014" });
    coordinator.createWarRoom({ incidentId: "incident-014" });
    coordinator.createWarRoom({ incidentId: "incident-015" });

    const rooms = coordinator.getWarRoomsByIncident("incident-014");

    assert.equal(rooms.length, 2);
    assert.ok(rooms.some((r) => r.warRoomId === warRoom1.warRoomId));
  });

  test("getActiveWarRooms returns only active rooms", () => {
    const coordinator = new WarRoomCoordinator();
    const room1 = coordinator.createWarRoom({ incidentId: "incident-016" });
    coordinator.createWarRoom({ incidentId: "incident-017" });
    coordinator.activateWarRoom(room1.warRoomId);

    const activeRooms = coordinator.getActiveWarRooms();

    assert.equal(activeRooms.length, 1);
    assert.equal(activeRooms[0]!.incidentId, "incident-016");
  });

  test("getWarRoomsForUser returns rooms for participant", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({
      incidentId: "incident-018",
      initialParticipants: [{ userId: "user-123", role: "technical_lead" }],
    });

    const rooms = coordinator.getWarRoomsForUser("user-123");

    assert.equal(rooms.length, 1);
    assert.equal(rooms[0]!.warRoomId, warRoom.warRoomId);
  });

  test("getWarRoomsForUser returns empty for non-participant", () => {
    const coordinator = new WarRoomCoordinator();
    coordinator.createWarRoom({ incidentId: "incident-019" });

    const rooms = coordinator.getWarRoomsForUser("stranger");

    assert.equal(rooms.length, 0);
  });

  test("WarRoomRole type accepts all valid roles", () => {
    const roles: WarRoomRole[] = [
      "incident_commander",
      "deputy_commander",
      "technical_lead",
      "communications_lead",
      "scribe",
      "subject_matter_expert",
      "observer",
    ];

    assert.equal(roles.length, 7);
  });

  test("ParticipantStatus type accepts all valid statuses", () => {
    const statuses: ParticipantStatus[] = ["joined", "active", "standing_by", "departed"];

    assert.equal(statuses.length, 4);
  });

  test("createWarRoom with objectives", () => {
    const coordinator = new WarRoomCoordinator();

    const warRoom = coordinator.createWarRoom({
      incidentId: "incident-020",
      objectives: ["Restore service", "Identify root cause", "Prevent recurrence"],
    });

    assert.equal(warRoom.objectives.length, 3);
    assert.ok(warRoom.objectives.includes("Restore service"));
  });

  test("multiple participants can be added and tracked", () => {
    const coordinator = new WarRoomCoordinator();
    const warRoom = coordinator.createWarRoom({ incidentId: "incident-021" });

    coordinator.addParticipant(warRoom.warRoomId, "ic-1", "incident_commander");
    coordinator.addParticipant(warRoom.warRoomId, "tech-1", "technical_lead");
    coordinator.addParticipant(warRoom.warRoomId, "comms-1", "communications_lead");
    coordinator.addParticipant(warRoom.warRoomId, "scribe-1", "scribe");

    const retrieved = coordinator.getWarRoom(warRoom.warRoomId);
    assert.equal(retrieved!.participants.length, 4);

    const rooms = coordinator.getWarRoomsForUser("tech-1");
    assert.equal(rooms.length, 1);
  });
});