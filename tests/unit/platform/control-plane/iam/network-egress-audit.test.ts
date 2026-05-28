import assert from "node:assert/strict";
import test from "node:test";

import {
  parseUrlForAudit,
  classifyUrl,
  extractDestination,
  createEgressAuditEvent,
  NetworkEgressAuditService,
  type EgressDestinationType,
  type EgressAuditEvent,
} from "../../../../../src/platform/five-plane-control-plane/iam/network-egress-audit.js";

test("parseUrlForAudit parses http URL", () => {
  const result = parseUrlForAudit("http://example.com:8080/path");
  assert.ok(result !== null);
  assert.equal(result!.protocol, "http");
  assert.equal(result!.host, "example.com");
  assert.equal(result!.port, 8080);
  assert.equal(result!.path, "/path");
});

test("parseUrlForAudit parses https URL", () => {
  const result = parseUrlForAudit("https://api.example.com/v1");
  assert.ok(result !== null);
  assert.equal(result!.protocol, "http");
  assert.equal(result!.host, "api.example.com");
  assert.equal(result!.port, null);
  assert.equal(result!.path, "/v1");
});

test("parseUrlForAudit parses https URL without path", () => {
  const result = parseUrlForAudit("https://example.com");
  assert.ok(result !== null);
  assert.equal(result!.path, "/");
});

test("parseUrlForAudit parses ssh URL", () => {
  // Note: SSH_PATTERN requires exact format ssh://host or ssh://host:port with nothing after
  const result = parseUrlForAudit("ssh://github.com");
  assert.ok(result !== null);
  assert.equal(result!.protocol, "ssh");
  assert.equal(result!.host, "github.com");
  assert.equal(result!.port, 22);
});

test("parseUrlForAudit parses ssh URL with explicit port", () => {
  const result = parseUrlForAudit("ssh://github.com:2222");
  assert.ok(result !== null);
  assert.equal(result!.port, 2222);
});

test("parseUrlForAudit parses s3 URL", () => {
  const result = parseUrlForAudit("s3://my-bucket/path/to/file");
  assert.ok(result !== null);
  assert.equal(result!.protocol, "s3");
  assert.equal(result!.host, "my-bucket");
  // Path is captured without leading slash: path/to/file
  assert.equal(result!.path, "path/to/file");
});

test("parseUrlForAudit returns null for unknown format", () => {
  assert.equal(parseUrlForAudit("not-a-url"), null);
});

test("parseUrlForAudit returns null for empty string", () => {
  assert.equal(parseUrlForAudit(""), null);
});

test("classifyUrl returns registry for github.com", () => {
  assert.equal(classifyUrl("https://github.com/user/repo"), "registry");
  assert.equal(classifyUrl("http://github.com/user/repo"), "registry");
});

test("classifyUrl returns registry for gitlab.com", () => {
  assert.equal(classifyUrl("https://gitlab.com/user/repo"), "registry");
});

test("classifyUrl returns registry for bitbucket.org", () => {
  assert.equal(classifyUrl("https://bitbucket.org/user/repo"), "registry");
});

test("classifyUrl returns ssh for ssh:// URLs (non-registry hosts)", () => {
  assert.equal(classifyUrl("ssh://custom-host.com"), "ssh");
});

test("classifyUrl returns registry for git@ URLs (github is registry first)", () => {
  // Note: github.com is classified as registry before ssh check
  assert.equal(classifyUrl("git@github.com:user/repo.git"), "registry");
});

test("classifyUrl returns s3 for s3:// URLs", () => {
  assert.equal(classifyUrl("s3://my-bucket/file"), "s3");
});

test("classifyUrl returns s3 for AWS S3 URLs", () => {
  assert.equal(classifyUrl("https://my-bucket.s3.amazonaws.com/file"), "s3");
});

test("classifyUrl returns url for http URLs", () => {
  assert.equal(classifyUrl("http://example.com/api"), "url");
});

test("classifyUrl returns url for https URLs", () => {
  assert.equal(classifyUrl("https://example.com/api"), "url");
});

test("classifyUrl returns unknown for unrecognized URLs", () => {
  assert.equal(classifyUrl("ftp://example.com"), "unknown");
  assert.equal(classifyUrl("telnet://example.com"), "unknown");
});

test("classifyUrl is case-insensitive", () => {
  assert.equal(classifyUrl("HTTPS://EXAMPLE.COM"), "url");
  assert.equal(classifyUrl("GitHub.com"), "registry");
});

test("extractDestination returns host from parsed URL", () => {
  assert.equal(extractDestination("https://api.example.com/v1"), "api.example.com");
});

test("extractDestination handles SSH git URLs", () => {
  // git@ URLs are detected via contains("@") check
  assert.equal(extractDestination("git@github.com:user/repo.git"), "github.com");
});

test("extractDestination handles SSH git URLs without path", () => {
  assert.equal(extractDestination("git@github.com"), "github.com");
});

test("extractDestination handles host:port format", () => {
  assert.equal(extractDestination("localhost:8080"), "localhost");
});

test("extractDestination returns original for unparseable", () => {
  assert.equal(extractDestination("some-unknown-format"), "some-unknown-format");
});

test("createEgressAuditEvent creates event with all fields", () => {
  const event = createEgressAuditEvent("example.com", "url", "fetch", true);
  assert.ok(event.id.startsWith("egress_"));
  assert.match(event.id, /^egress_[0-9a-f-]{36}$/);
  assert.equal(event.destination, "example.com");
  assert.equal(event.destinationType, "url");
  assert.equal(event.action, "fetch");
  assert.equal(event.success, true);
  assert.ok(event.timestamp.length > 0);
});

test("createEgressAuditEvent includes error code when provided", () => {
  const event = createEgressAuditEvent("example.com", "url", "fetch", false, {
    errorCode: "EGRESS_BLOCKED",
  });
  assert.equal(event.success, false);
  assert.equal(event.errorCode, "EGRESS_BLOCKED");
});

test("createEgressAuditEvent includes metadata when provided", () => {
  const event = createEgressAuditEvent("example.com", "url", "fetch", true, {
    metadata: { reason: "test" },
  });
  assert.deepEqual(event.metadata, { reason: "test" });
});

test("createEgressAuditEvent omits optional fields when not provided", () => {
  const event = createEgressAuditEvent("example.com", "url", "fetch", true);
  assert.equal(event.errorCode, undefined);
  assert.equal(event.metadata, undefined);
});

test("NetworkEgressAuditService records egress events", () => {
  const service = new NetworkEgressAuditService();
  const event = service.recordEgress("https://example.com", "fetch", true);
  assert.equal(event.destination, "example.com");
  assert.equal(event.destinationType, "url");
});

test("NetworkEgressAuditService records github.com as registry", () => {
  const service = new NetworkEgressAuditService();
  const event = service.recordEgress("https://github.com/user/repo", "git_clone", true);
  assert.equal(event.destinationType, "registry");
});

test("NetworkEgressAuditService throws when disabled", () => {
  const service = new NetworkEgressAuditService({ enabled: false });
  assert.throws(
    () => service.recordEgress("https://example.com", "fetch", true),
    /Network egress audit is disabled/,
  );
});

test("NetworkEgressAuditService getEvents returns all events", () => {
  const service = new NetworkEgressAuditService();
  service.recordEgress("https://example1.com", "fetch", true);
  service.recordEgress("https://example2.com", "fetch", true);
  const events = service.getEvents();
  assert.equal(events.length, 2);
});

test("NetworkEgressAuditService evicts oldest events beyond maxEvents", () => {
  const service = new NetworkEgressAuditService({ maxEvents: 3 });
  for (let i = 0; i < 5; i++) {
    service.recordEgress(`https://example${i}.com`, "fetch", true);
  }

  const events = service.getEvents();
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((event) => event.destination), ["example2.com", "example3.com", "example4.com"]);
});

test("NetworkEgressAuditService getEventsByType filters correctly", () => {
  const service = new NetworkEgressAuditService();
  service.recordEgress("https://example.com", "fetch", true);
  service.recordEgress("https://github.com/repo", "git_clone", true);
  const registryEvents = service.getEventsByType("registry");
  assert.equal(registryEvents.length, 1);
  assert.equal(registryEvents[0]!.destinationType, "registry");
});

test("NetworkEgressAuditService getFailedEvents returns only failures", () => {
  const service = new NetworkEgressAuditService();
  service.recordEgress("https://example.com", "fetch", true);
  service.recordEgress("https://fail.com", "fetch", false, { errorCode: "FAILED" });
  const failedEvents = service.getFailedEvents();
  assert.equal(failedEvents.length, 1);
  assert.equal(failedEvents[0]!.destination, "fail.com");
});

test("NetworkEgressAuditService clearEvents removes all events", () => {
  const service = new NetworkEgressAuditService();
  service.recordEgress("https://example.com", "fetch", true);
  service.clearEvents();
  assert.equal(service.getEvents().length, 0);
});

test("NetworkEgressAuditService getConfig returns configuration", () => {
  const service = new NetworkEgressAuditService({ enabled: false, maxBodyCaptureBytes: 2048 });
  const config = service.getConfig();
  assert.equal(config.enabled, false);
  assert.equal(config.maxBodyCaptureBytes, 2048);
});

test("NetworkEgressAuditService records with error code", () => {
  const service = new NetworkEgressAuditService();
  const event = service.recordEgress("https://blocked.com", "fetch", false, {
    errorCode: "EGRESS_BLOCKED",
    metadata: { reason: "blocked" },
  });
  assert.equal(event.success, false);
  assert.equal(event.errorCode, "EGRESS_BLOCKED");
});
