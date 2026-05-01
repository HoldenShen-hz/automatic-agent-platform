import assert from "node:assert/strict";
import test from "node:test";

import {
  EventResponseAutomationService,
  type SevLevel,
  type BrakeMode,
  type IncidentStatus,
  type DlqEntryStatus,
  type Incident,
  type DlqEntry,
  type EmergencyBrakeState,
} from "../../../../src/platform/stability/event-response-automation-service.js";

test("EventResponseAutomationService can be instantiated", () => {
  const service = new EventResponseAutomationService();
  assert.ok(service instanceof EventResponseAutomationService);
});

test("EventResponseAutomationService.createIncident creates SEV1 incident", () => {
  const service = new EventResponseAutomationService();
  const incident = service.createIncident("SEV1", "Test SEV1", "Test description", ["plane-a"]);

  assert.equal(incident.severity, "SEV1");
  assert.equal(incident.title, "Test SEV1");
  assert.equal(incident.status, "open");
  assert.ok(incident.incidentId.startsWith("inc_"));
});

test("EventResponseAutomationService.createIncident creates SEV2 incident", () => {
  const service = new EventResponseAutomationService();
  const incident = service.createIncident("SEV2", "Test SEV2", "Test description");

  assert.equal(incident.severity, "SEV2");
  assert.equal(incident.status, "open");
});

test("EventResponseAutomationService.createIncident engages brake for SEV1", () => {
  const service = new EventResponseAutomationService();
  service.createIncident("SEV1", "Test SEV1", "Test description");

  const brakeState = service.getBrakeState();
  assert.equal(brakeState.mode, "full");
  assert.ok(brakeState.engagedAt !== null);
});

test("EventResponseAutomationService.createIncident engages partial brake for SEV2", () => {
  const service = new EventResponseAutomationService();
  service.createIncident("SEV2", "Test SEV2", "Test description");

  const brakeState = service.getBrakeState();
  assert.equal(brakeState.mode, "partial");
});

test("EventResponseAutomationService.createIncident does not engage brake for SEV3/SEV4", () => {
  const service = new EventResponseAutomationService();
  service.createIncident("SEV3", "Test SEV3", "Test description");

  const brakeState = service.getBrakeState();
  assert.equal(brakeState.mode, "none");
});

test("EventResponseAutomationService.acknowledgeIncident updates incident", () => {
  const service = new EventResponseAutomationService();
  const incident = service.createIncident("SEV3", "Test SEV3", "Test description");

  const updated = service.acknowledgeIncident(incident.incidentId, "operator-1");

  assert.ok(updated);
  assert.equal(updated.status, "acknowledged");
  assert.equal(updated.acknowledgedBy, "operator-1");
  assert.ok(updated.acknowledgedAt !== null);
});

test("EventResponseAutomationService.acknowledgeIncident returns null for unknown id", () => {
  const service = new EventResponseAutomationService();

  const result = service.acknowledgeIncident("unknown-id", "operator-1");
  assert.equal(result, null);
});

test("EventResponseAutomationService.resolveIncident updates incident", () => {
  const service = new EventResponseAutomationService();
  const incident = service.createIncident("SEV3", "Test SEV3", "Test description");

  const resolved = service.resolveIncident(
    incident.incidentId,
    "operator-1",
    "Root cause found",
    "Fixed by restarting",
  );

  assert.ok(resolved);
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.resolvedBy, "operator-1");
  assert.equal(resolved.rootCause, "Root cause found");
  assert.equal(resolved.resolution, "Fixed by restarting");
  assert.ok(resolved.resolvedAt !== null);
});

test("EventResponseAutomationService.resolveIncident releases brake when all SEV1/2 resolved", () => {
  const service = new EventResponseAutomationService();
  const sev1 = service.createIncident("SEV1", "SEV1 incident", "Test");

  // Brake should be engaged for SEV1
  assert.equal(service.getBrakeState().mode, "full");

  // Resolve the SEV1 incident
  service.resolveIncident(sev1.incidentId, "operator-1", "Root cause", "Fixed");

  // Brake should be released
  assert.equal(service.getBrakeState().mode, "none");
});

test("EventResponseAutomationService.escalateIncident changes severity", () => {
  const service = new EventResponseAutomationService();
  const incident = service.createIncident("SEV3", "Test SEV3", "Test description");

  const escalated = service.escalateIncident(incident.incidentId, "SEV1");

  assert.ok(escalated);
  assert.equal(escalated.severity, "SEV1");
  assert.equal(service.getBrakeState().mode, "full");
});

test("EventResponseAutomationService.getIncident returns incident by id", () => {
  const service = new EventResponseAutomationService();
  const created = service.createIncident("SEV4", "Test SEV4", "Test description");

  const retrieved = service.getIncident(created.incidentId);

  assert.ok(retrieved);
  assert.equal(retrieved.incidentId, created.incidentId);
});

test("EventResponseAutomationService.getIncident returns null for unknown id", () => {
  const service = new EventResponseAutomationService();

  const result = service.getIncident("unknown-id");
  assert.equal(result, null);
});

test("EventResponseAutomationService.getIncidents filters by status", () => {
  const service = new EventResponseAutomationService();
  const incident1 = service.createIncident("SEV4", "Open incident", "Test");
  const incident2 = service.createIncident("SEV4", "SEV4-2", "Test");
  service.acknowledgeIncident(incident2.incidentId, "op");

  const openIncidents = service.getIncidents({ status: "open" });
  assert.ok(openIncidents.length >= 1);
  assert.ok(openIncidents.some((i) => i.incidentId === incident1.incidentId));
});

test("EventResponseAutomationService.getIncidents filters by severity", () => {
  const service = new EventResponseAutomationService();
  service.createIncident("SEV1", "SEV1", "Test");
  service.createIncident("SEV4", "SEV4", "Test");

  const sev1Incidents = service.getIncidents({ severity: "SEV1" });
  assert.equal(sev1Incidents.length, 1);
  assert.equal(sev1Incidents[0]!.severity, "SEV1");
});

test("EventResponseAutomationService.getIncidents respects limit", () => {
  const service = new EventResponseAutomationService();
  service.createIncident("SEV4", "Incident 1", "Test");
  service.createIncident("SEV4", "Incident 2", "Test");
  service.createIncident("SEV4", "Incident 3", "Test");

  const limited = service.getIncidents({ limit: 2 });
  assert.equal(limited.length, 2);
});

test("EventResponseAutomationService.getActiveIncidents returns open and acknowledged", () => {
  const service = new EventResponseAutomationService();
  const incident1 = service.createIncident("SEV4", "Open", "Test");
  const incident2 = service.createIncident("SEV4", "To Ack", "Test");
  service.acknowledgeIncident(incident2.incidentId, "op");

  const active = service.getActiveIncidents();
  assert.ok(active.length >= 2);
  assert.ok(active.some((i) => i.incidentId === incident1.incidentId));
  assert.ok(active.some((i) => i.incidentId === incident2.incidentId));
});

test("EventResponseAutomationService.engageBrake updates brake state", () => {
  const service = new EventResponseAutomationService();
  service.engageBrake("advisory", "Testing brake", null, ["plane-a"]);

  const state = service.getBrakeState();
  assert.equal(state.mode, "advisory");
  assert.equal(state.reason, "Testing brake");
  assert.deepEqual(state.affectedPlanes, ["plane-a"]);
});

test("EventResponseAutomationService.releaseBrake clears state", () => {
  const service = new EventResponseAutomationService();
  service.engageBrake("full", "Testing", null, ["plane-a"]);
  service.releaseBrake("operator-1", "Testing complete");

  const state = service.getBrakeState();
  assert.equal(state.mode, "none");
  assert.equal(state.engagedBy, null);
  assert.equal(state.reason, null);
});

test("EventResponseAutomationService.addToDlq creates DLQ entry", () => {
  const service = new EventResponseAutomationService();
  const entry = service.addToDlq("task.failed", { taskId: "task-1" }, "Connection timeout");

  assert.ok(entry.dlqId.startsWith("dlq_"));
  assert.equal(entry.eventType, "task.failed");
  assert.equal(entry.status, "pending");
  assert.equal(entry.retryCount, 0);
  assert.equal(entry.maxRetries, 3);
});

test("EventResponseAutomationService.retryDlqEntry increments retry count", () => {
  const service = new EventResponseAutomationService();
  const entry = service.addToDlq("task.failed", { taskId: "task-1" }, "Error");

  const result = service.retryDlqEntry(entry.dlqId);
  assert.equal(result, true);

  const updated = service.getDlqEntry(entry.dlqId);
  assert.ok(updated);
  assert.equal(updated.retryCount, 1);
  assert.equal(updated.status, "retrying");
});

test("EventResponseAutomationService.retryDlqEntry marks dead after max retries", () => {
  const service = new EventResponseAutomationService({ maxDlqRetries: 3 });
  const entry = service.addToDlq("task.failed", { taskId: "task-1" }, "Error");

  service.retryDlqEntry(entry.dlqId);
  service.retryDlqEntry(entry.dlqId);
  const thirdRetry = service.retryDlqEntry(entry.dlqId);

  assert.equal(thirdRetry, true);

  const updated = service.getDlqEntry(entry.dlqId);
  assert.ok(updated);
  assert.equal(updated.status, "dead");
});

test("EventResponseAutomationService.markProcessed updates status", () => {
  const service = new EventResponseAutomationService();
  const entry = service.addToDlq("task.failed", { taskId: "task-1" }, "Error");

  service.markProcessed(entry.dlqId);

  const updated = service.getDlqEntry(entry.dlqId);
  assert.ok(updated);
  assert.equal(updated.status, "processed");
});

test("EventResponseAutomationService.getDlqEntries filters by status", () => {
  const service = new EventResponseAutomationService();
  const entry1 = service.addToDlq("task.1", {}, "Error 1");
  const entry2 = service.addToDlq("task.2", {}, "Error 2");
  service.markProcessed(entry2.dlqId);

  const pending = service.getDlqEntries({ status: "pending" });
  assert.equal(pending.length, 1);
  assert.equal(pending[0]!.dlqId, entry1.dlqId);
});

test("EventResponseAutomationService.getDlqEntries filters by eventType", () => {
  const service = new EventResponseAutomationService();
  service.addToDlq("task.type_a", {}, "Error");
  service.addToDlq("task.type_b", {}, "Error");

  const typeA = service.getDlqEntries({ eventType: "task.type_a" });
  assert.equal(typeA.length, 1);
  assert.equal(typeA[0]!.eventType, "task.type_a");
});

test("EventResponseAutomationService.getDlqEntries respects limit", () => {
  const service = new EventResponseAutomationService();
  service.addToDlq("task.1", {}, "Error");
  service.addToDlq("task.2", {}, "Error");
  service.addToDlq("task.3", {}, "Error");

  const limited = service.getDlqEntries({ limit: 2 });
  assert.equal(limited.length, 2);
});

test("EventResponseAutomationService.getDlqStats returns correct counts", () => {
  const service = new EventResponseAutomationService();
  const entry1 = service.addToDlq("task.1", {}, "Error");
  const entry2 = service.addToDlq("task.2", {}, "Error");
  service.markProcessed(entry2.dlqId);

  const stats = service.getDlqStats();
  assert.equal(stats.total, 2);
  assert.equal(stats.pending, 1);
  assert.equal(stats.processed, 1);
  assert.equal(stats.retrying, 0);
  assert.equal(stats.dead, 0);
});

test("EventResponseAutomationService incident sorting by severity then time", () => {
  const service = new EventResponseAutomationService();
  service.createIncident("SEV4", "SEV4 first", "Test");
  service.createIncident("SEV1", "SEV1 second", "Test");
  service.createIncident("SEV3", "SEV3 third", "Test");

  const incidents = service.getIncidents();
  // SEV1 should be first regardless of creation order
  assert.equal(incidents[0]!.severity, "SEV1");
});

test("EventResponseAutomationService type exports are correct", () => {
  // Verify type exports are available
  const sevLevels: SevLevel[] = ["SEV1", "SEV2", "SEV3", "SEV4"];
  const brakeModes: BrakeMode[] = ["none", "advisory", "partial", "full"];
  const incidentStatuses: IncidentStatus[] = ["open", "acknowledged", "mitigating", "resolved", "escalated"];
  const dlqStatuses: DlqEntryStatus[] = ["pending", "retrying", "dead", "processed"];

  assert.equal(sevLevels.length, 4);
  assert.equal(brakeModes.length, 4);
  assert.equal(incidentStatuses.length, 5);
  assert.equal(dlqStatuses.length, 4);
});
