import assert from "node:assert/strict";
import test from "node:test";

import { classifyOpsIncident } from "../../../../../src/ops-maturity/platform-ops-agent/health-monitor/index.js";

test("classifyOpsIncident returns critical_incident for high error rate", () => {
  assert.equal(classifyOpsIncident(0.2, 0), "critical_incident");
  assert.equal(classifyOpsIncident(0.5, 0), "critical_incident");
});

test("classifyOpsIncident returns critical_incident for high backlog", () => {
  assert.equal(classifyOpsIncident(0, 1000), "critical_incident");
  assert.equal(classifyOpsIncident(0, 5000), "critical_incident");
});

test("classifyOpsIncident returns incident for moderate error rate", () => {
  assert.equal(classifyOpsIncident(0.05, 0), "incident");
  assert.equal(classifyOpsIncident(0.1, 0), "incident");
});

test("classifyOpsIncident returns incident for moderate backlog", () => {
  assert.equal(classifyOpsIncident(0, 200), "incident");
  assert.equal(classifyOpsIncident(0, 500), "incident");
});

test("classifyOpsIncident returns warning for low values", () => {
  assert.equal(classifyOpsIncident(0.01, 10), "warning");
});

test("classifyOpsIncident prioritizes critical over incident", () => {
  assert.equal(classifyOpsIncident(0.2, 500), "critical_incident");
});

test("classifyOpsIncident prioritizes incident over warning", () => {
  assert.equal(classifyOpsIncident(0.05, 10), "incident");
});

test("classifyOpsIncident boundaries: error rate 0.05", () => {
  assert.equal(classifyOpsIncident(0.049, 0), "warning");
  assert.equal(classifyOpsIncident(0.05, 0), "incident");
});

test("classifyOpsIncident boundaries: error rate 0.2", () => {
  assert.equal(classifyOpsIncident(0.199, 0), "incident");
  assert.equal(classifyOpsIncident(0.2, 0), "critical_incident");
});

test("classifyOpsIncident boundaries: backlog 200", () => {
  assert.equal(classifyOpsIncident(0, 199), "warning");
  assert.equal(classifyOpsIncident(0, 200), "incident");
});

test("classifyOpsIncident boundaries: backlog 1000", () => {
  assert.equal(classifyOpsIncident(0, 999), "incident");
  assert.equal(classifyOpsIncident(0, 1000), "critical_incident");
});