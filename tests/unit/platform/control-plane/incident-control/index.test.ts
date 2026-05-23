import assert from "node:assert/strict";
import test from "node:test";

test("incident-control barrel exports runtime services", async () => {
  const mod = await import("../../../../../src/platform/five-plane-control-plane/incident-control/index.js");
  assert.equal(typeof mod.IncidentResolver, "function");
  assert.equal(typeof mod.WarRoomCoordinationService, "function");
});

test("incident-control barrel keeps post-mortem generation on IncidentResolver", async () => {
  const mod = await import("../../../../../src/platform/five-plane-control-plane/incident-control/index.js");
  assert.equal(typeof mod.IncidentResolver.prototype.generatePostMortem, "function");
});

test("doctor types stay on doctor-service module instead of incident barrel", async () => {
  const mod = await import("../../../../../src/platform/five-plane-control-plane/incident-control/index.js");
  assert.equal("summarizeDoctorChecks" in mod, false);
});

test("doctor-service keeps doctor exports", async () => {
  const mod = await import("../../../../../src/platform/five-plane-control-plane/incident-control/doctor-service.js");
  assert.equal(typeof mod.summarizeDoctorChecks, "function");
});
