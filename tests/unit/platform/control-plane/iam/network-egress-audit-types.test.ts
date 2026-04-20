import assert from "node:assert/strict";
import test from "node:test";

import type { EgressDestinationType, EgressAuditEvent } from "../../../../../src/platform/control-plane/iam/network-egress-audit.js";

test("EgressDestinationType accepts all valid values", () => {
  const types: EgressDestinationType[] = ["url", "ssh", "s3", "registry", "publish", "unknown"];
  assert.equal(types.length, 6);
});

test("EgressAuditEvent structure is correct", () => {
  const event: EgressAuditEvent = {
    id: "egress_123",
    timestamp: "2026-04-14T00:00:00.000Z",
    destinationType: "url",
    destination: "https://api.example.com/data",
    action: "fetch",
    success: true,
  };
  assert.equal(event.id, "egress_123");
  assert.equal(event.destinationType, "url");
  assert.equal(event.destination, "https://api.example.com/data");
  assert.equal(event.action, "fetch");
  assert.equal(event.success, true);
});

test("EgressAuditEvent allows optional errorCode", () => {
  const event: EgressAuditEvent = {
    id: "egress_456",
    timestamp: "2026-04-14T00:00:00.000Z",
    destinationType: "url",
    destination: "https://api.example.com/data",
    action: "fetch",
    success: false,
    errorCode: "ECONNREFUSED",
  };
  assert.equal(event.success, false);
  assert.equal(event.errorCode, "ECONNREFUSED");
});

test("EgressAuditEvent for SSH destination", () => {
  const event: EgressAuditEvent = {
    id: "egress_ssh",
    timestamp: "2026-04-14T00:00:00.000Z",
    destinationType: "ssh",
    destination: "git@github.com:user/repo.git",
    action: "git_push",
    success: true,
  };
  assert.equal(event.destinationType, "ssh");
  assert.ok(event.destination.includes("git@"));
});

test("EgressAuditEvent for S3 destination", () => {
  const event: EgressAuditEvent = {
    id: "egress_s3",
    timestamp: "2026-04-14T00:00:00.000Z",
    destinationType: "s3",
    destination: "s3://my-bucket/data.json",
    action: "s3_download",
    success: true,
  };
  assert.equal(event.destinationType, "s3");
  assert.ok(event.destination.startsWith("s3://"));
});

test("EgressAuditEvent for registry destination", () => {
  const event: EgressAuditEvent = {
    id: "egress_reg",
    timestamp: "2026-04-14T00:00:00.000Z",
    destinationType: "registry",
    destination: "https://github.com/user/repo",
    action: "git_clone",
    success: true,
  };
  assert.equal(event.destinationType, "registry");
});

test("EgressAuditEvent for publish destination", () => {
  const event: EgressAuditEvent = {
    id: "egress_pub",
    timestamp: "2026-04-14T00:00:00.000Z",
    destinationType: "publish",
    destination: "https://registry.npmjs.org/package",
    action: "npm_publish",
    success: true,
  };
  assert.equal(event.destinationType, "publish");
});

test("EgressAuditEvent for unknown destination", () => {
  const event: EgressAuditEvent = {
    id: "egress_unk",
    timestamp: "2026-04-14T00:00:00.000Z",
    destinationType: "unknown",
    destination: "custom-protocol://resource",
    action: "custom",
    success: false,
  };
  assert.equal(event.destinationType, "unknown");
});
