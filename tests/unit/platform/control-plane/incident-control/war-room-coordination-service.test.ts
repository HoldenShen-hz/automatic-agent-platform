/**
 * Unit tests for WarRoomCoordinationService
 * Tests multi-participant coordination for SEV1 incidents
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WarRoomCoordinationService } from "../../../../../src/platform/five-plane-control-plane/incident-control/war-room-coordination-service.js";
import type { WarRoomRole } from "../../../../../src/platform/five-plane-control-plane/incident-control/war-room-coordination-service.js";

test.describe("WarRoomCoordinationService", () => {
  test("createWarRoom creates session with initiator as incident commander", () => {
    const service = new WarRoomCoordinationService();

    const session = service.createWarRoom("incident-001", "SEV1", "operator-1");

    assert.ok(session.sessionId);
    assert.equal(session.incidentId, "incident-001");
    assert.equal(session.severity, "SEV1");
    assert.equal(session.status, "active");
    assert.equal(session.currentPhase, "investigation");
    assert.equal(session.participants.length, 1);
    assert.equal(session.participants[0]!.role, "incident_commander");
    assert.equal(session.participants[0]!.userId, "operator-1");
    assert.equal(session.participants[0]!.status, "active");
  });

  test("getWarRoom returns session for incident", () => {
    const service = new WarRoomCoordinationService();

    const created = service.createWarRoom("incident-002", "SEV2", "operator-2");
    const retrieved = service.getWarRoom("incident-002");

    assert.ok(retrieved);
    assert.equal(retrieved!.sessionId, created.sessionId);
    assert.equal(retrieved!.incidentId, "incident-002");
  });

  test("getWarRoom returns null for unknown incident", () => {
    const service = new WarRoomCoordinationService();

    const result = service.getWarRoom("unknown-incident");

    assert.equal(result, null);
  });

  test("addParticipant adds non-observer without limit", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-003", "SEV1", "operator-3");

    const participant = service.addParticipant(session.sessionId, "tech-lead-1", "technical_lead");

    assert.ok(participant);
    assert.equal(participant!.role, "technical_lead");
    assert.equal(participant!.userId, "tech-lead-1");
    assert.equal(participant!.status, "active");
  });

  test("addParticipant enforces observer limit", () => {
    const service = new WarRoomCoordinationService({ maxObservers: 2 });
    const session = service.createWarRoom("incident-004", "SEV1", "operator-4");

    // Add 2 observers (at limit)
    const observer1 = service.addParticipant(session.sessionId, "observer-1", "observer");
    const observer2 = service.addParticipant(session.sessionId, "observer-2", "observer");

    assert.ok(observer1);
    assert.ok(observer2);

    // Third observer should be rejected
    const observer3 = service.addParticipant(session.sessionId, "observer-3", "observer");
    assert.equal(observer3, null);
  });

  test("addParticipant rejects when session is not active", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-005", "SEV1", "operator-5");
    service.resolveWarRoom(session.sessionId);

    const participant = service.addParticipant(session.sessionId, "new-person", "technical_lead");

    assert.equal(participant, null);
  });

  test("removeParticipant marks participant as offline", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-006", "SEV1", "operator-6");
    const participant = service.addParticipant(session.sessionId, "tech-lead-1", "technical_lead");

    const removed = service.removeParticipant(session.sessionId, participant!.participantId);

    assert.equal(removed, true);
    const updatedSession = service.getWarRoom("incident-006");
    const removedParticipant = updatedSession!.participants.find(
      (p) => p.participantId === participant!.participantId,
    );
    assert.equal(removedParticipant!.status, "offline");
    assert.ok(removedParticipant!.leftAt);
  });

  test("removeParticipant returns false for unknown session", () => {
    const service = new WarRoomCoordinationService();

    const removed = service.removeParticipant("unknown-session", "participant-id");

    assert.equal(removed, false);
  });

  test("recordDecision creates approved decision", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-007", "SEV1", "operator-7");

    const decision = service.recordDecision(
      session.sessionId,
      "Restart the database",
      "Only viable option to clear corrupted state",
      ["operator-7", "tech-lead-1"],
    );

    assert.ok(decision);
    assert.equal(decision!.description, "Restart the database");
    assert.equal(decision!.rationale, "Only viable option to clear corrupted state");
    assert.deepEqual(decision!.decidedBy, ["operator-7", "tech-lead-1"]);
    assert.equal(decision!.outcome, "approved");
  });

  test("recordDecision returns null for inactive session", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-008", "SEV1", "operator-8");
    service.resolveWarRoom(session.sessionId);

    const decision = service.recordDecision(session.sessionId, "Test", "Rationale", ["operator-8"]);

    assert.equal(decision, null);
  });

  test("addStatusUpdate creates info status update", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-009", "SEV1", "operator-9");

    const update = service.addStatusUpdate(session.sessionId, "operator-9", "Investigating root cause", "info");

    assert.ok(update);
    assert.equal(update!.content, "Investigating root cause");
    assert.equal(update!.severity, "info");
    assert.equal(update!.authorId, "operator-9");
  });

  test("addStatusUpdate creates critical status update", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-010", "SEV1", "operator-10");

    const update = service.addStatusUpdate(
      session.sessionId,
      "operator-10",
      "Production data loss detected",
      "critical",
    );

    assert.ok(update);
    assert.equal(update!.severity, "critical");
  });

  test("advancePhase transitions session phase", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-011", "SEV1", "operator-11");

    const advanced = service.advancePhase(session.sessionId, "mitigation");

    assert.equal(advanced, true);
    const updatedSession = service.getWarRoom("incident-011");
    assert.equal(updatedSession!.currentPhase, "mitigation");
  });

  test("advancePhase fails for inactive session", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-012", "SEV1", "operator-12");
    service.resolveWarRoom(session.sessionId);

    const advanced = service.advancePhase(session.sessionId, "mitigation");

    assert.equal(advanced, false);
  });

  test("resolveWarRoom marks session as resolved", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-013", "SEV1", "operator-13");

    const resolved = service.resolveWarRoom(session.sessionId);

    assert.ok(resolved);
    assert.equal(resolved!.status, "resolved");
    assert.ok(resolved!.resolvedAt);
  });

  test("hasActiveWarRoom returns true for active incident", () => {
    const service = new WarRoomCoordinationService();
    service.createWarRoom("incident-014", "SEV1", "operator-14");

    const hasActive = service.hasActiveWarRoom("incident-014");

    assert.equal(hasActive, true);
  });

  test("hasActiveWarRoom returns false for resolved incident", () => {
    const service = new WarRoomCoordinationService();
    const session = service.createWarRoom("incident-015", "SEV1", "operator-15");
    service.resolveWarRoom(session.sessionId);

    const hasActive = service.hasActiveWarRoom("incident-015");

    assert.equal(hasActive, false);
  });

  test("getActiveWarRoomCount returns correct count", () => {
    const service = new WarRoomCoordinationService();
    service.createWarRoom("incident-016", "SEV1", "operator-16");
    service.createWarRoom("incident-017", "SEV2", "operator-17");
    const session3 = service.createWarRoom("incident-018", "SEV1", "operator-18");
    service.resolveWarRoom(session3.sessionId);

    const count = service.getActiveWarRoomCount();

    assert.equal(count, 2);
  });

  test("WarRoomRole type accepts all valid roles", () => {
    const roles: WarRoomRole[] = [
      "incident_commander",
      "technical_lead",
      "communications_lead",
      "subject_matter_expert",
      "observer",
    ];

    assert.equal(roles.length, 5);
  });

  test("options with autoNotifyOnSev1 defaults to true", () => {
    const service = new WarRoomCoordinationService();

    assert.equal((service as any).options.autoNotifyOnSev1, true);
  });

  test("options with custom maxObservers", () => {
    const service = new WarRoomCoordinationService({ maxObservers: 5 });

    assert.equal((service as any).options.maxObservers, 5);
  });
});