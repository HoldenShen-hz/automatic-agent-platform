import test from "node:test";
import assert from "node:assert/strict";
import { createWebFetchTool } from "../../../../src/platform/execution/tool-executor/web-fetch.js";

test("WebFetch sandbox: blocks file protocol", async () => {
  const tool = createWebFetchTool();
  const result = await tool.execute({ url: "file:///etc/passwd" });

  assert.ok(!result.success);
  assert.equal(result.status, "blocked");
  assert.ok(result.errorCode === "INTERNAL_NETWORK_BLOCKED" || result.errorCode === "INVALID_URL");
});

test("WebFetch sandbox: blocks ftp protocol", async () => {
  const tool = createWebFetchTool();
  const result = await tool.execute({ url: "ftp://example.com" });

  assert.ok(!result.success);
  assert.equal(result.status, "blocked");
  assert.equal(result.errorCode, "INTERNAL_NETWORK_BLOCKED");
});

test("WebFetch sandbox: blocks javascript protocol", async () => {
  const tool = createWebFetchTool();
  const result = await tool.execute({ url: "javascript:alert(1)" });

  assert.ok(!result.success);
  assert.equal(result.status, "blocked");
  assert.equal(result.errorCode, "INTERNAL_NETWORK_BLOCKED");
});

test("WebFetch sandbox: blocks private IP ranges", async () => {
  const tool = createWebFetchTool();

  const privateIPs = [
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://172.16.0.1",
    "http://192.168.0.1",
  ];

  for (const url of privateIPs) {
    const result = await tool.execute({ url });
    assert.ok(!result.success, `Should block ${url}`);
    assert.equal(result.status, "blocked");
    assert.equal(result.errorCode, "INTERNAL_NETWORK_BLOCKED");
  }
});

test("WebFetch sandbox: blocks IPv6 localhost", async () => {
  const tool = createWebFetchTool();
  const result = await tool.execute({ url: "http://[::1]" });

  assert.ok(!result.success);
  assert.ok(result.status === "blocked" || result.status === "failed");
});

test("WebFetch sandbox: blocks metadata endpoint", async () => {
  const tool = createWebFetchTool();

  const metadataURLs = [
    "http://169.254.169.254/latest/meta-data",
    "http://metadata.google.internal/computeMetadata/v1/",
  ];

  for (const url of metadataURLs) {
    const result = await tool.execute({ url });
    assert.ok(!result.success, `Should block ${url}`);
    assert.equal(result.status, "blocked");
    assert.equal(result.errorCode, "INTERNAL_NETWORK_BLOCKED");
  }
});

test("WebFetch sandbox: blocks internal domain suffixes", async () => {
  const tool = createWebFetchTool();

  const internalDomains = [
    "http://server.local",
    "http://host.internal",
    "http://machine.private",
  ];

  for (const url of internalDomains) {
    const result = await tool.execute({ url });
    assert.ok(!result.success, `Should block ${url}`);
    assert.equal(result.status, "blocked");
    assert.equal(result.errorCode, "INTERNAL_NETWORK_BLOCKED");
  }
});

test("WebFetch sandbox: respects domain blacklist", async () => {
  const tool = createWebFetchTool();
  const result = await tool.execute({
    url: "https://blocked-domain.com",
    blockedDomains: ["blocked-domain.com"],
  });

  assert.ok(!result.success);
  assert.equal(result.status, "blocked");
  assert.equal(result.errorCode, "DOMAIN_BLOCKED");
});

test("WebFetch sandbox: respects domain whitelist", async () => {
  const tool = createWebFetchTool();
  const result = await tool.execute({
    url: "https://untrusted-domain.com",
    allowedDomains: ["trusted-domain.com"],
  });

  assert.ok(!result.success);
  assert.equal(result.status, "blocked");
  assert.equal(result.errorCode, "DOMAIN_BLOCKED");
});

test("WebFetch sandbox: subdomain is allowed by whitelist", async () => {
  const tool = createWebFetchTool();
  const result = await tool.execute({
    url: "https://api.example.com",
    allowedDomains: ["example.com"],
  });

  assert.ok(result.errorCode !== "DOMAIN_BLOCKED");
});
