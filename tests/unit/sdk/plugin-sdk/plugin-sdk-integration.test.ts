/**
 * @fileoverview Tests for plugin-sdk index.ts and full SDK integration
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createHash, createSign, generateKeyPairSync } from "node:crypto";

import {
  // From plugin-definition
  definePlugin,
  defineTool,
  defineAdapter,
  defineRetriever,
  defineEvaluator,
  validatePluginDefinition,
  registerPluginSigningVerificationKey,
  verifyPluginSignature,
  enforcePluginSignature,
  getSigningKeyRegistry,
  getSbomScanner,
  setSbomScanner,
  verifySbomRef,
  DefaultSbomScanner,
  // Types from plugin-definition
  type PluginSigningVerificationKey,
  type PluginSignatureVerificationResult,
  type PluginType,
  type PluginRole,
  type PluginCapability,
  type PluginResourceLimits,
  type PluginSecurityConfig,
  type DefinePluginOptions,
  type SbomVulnerability,
  type SbomVerificationOptions,
  type SbomVerificationResult,
} from "../../../../src/sdk/plugin-sdk/index.js";

// From plugin-context
import { PluginContext } from "../../../../src/sdk/plugin-sdk/index.js";

// From plugin-test-harness
import { PluginTestHarness } from "../../../../src/sdk/plugin-sdk/index.js";
import type { TestCase, TestResult, HarnessReport, MockLlmConfig, MockToolResult } from "../../../../src/sdk/plugin-sdk/index.js";

test("index exports definePlugin function", () => {
  const plugin = definePlugin({
    pluginId: "index-test.tool",
    name: "Index Test",
    version: "1.0.0",
    type: "tool",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(plugin.pluginId, "index-test.tool");
});

test("index exports convenience functions", () => {
  const tool = defineTool({
    pluginId: "index.tool",
    name: "Index Tool",
    version: "1.0.0",
    capabilities: [{ name: "exec", description: "d", inputSchema: {}, outputSchema: {} }],
  });
  assert.equal(tool.type, "tool");

  const adapter = defineAdapter({
    pluginId: "index.adapter",
    name: "Index Adapter",
    version: "1.0.0",
    capabilities: [{ name: "adapt", description: "d", inputSchema: {}, outputSchema: {} }],
  });
  assert.equal(adapter.type, "adapter");

  const retriever = defineRetriever({
    pluginId: "index.retriever",
    name: "Index Retriever",
    version: "1.0.0",
    capabilities: [{ name: "retrieve", description: "d", inputSchema: {}, outputSchema: {} }],
  });
  assert.equal(retriever.type, "retriever");

  const evaluator = defineEvaluator({
    pluginId: "index.evaluator",
    name: "Index Evaluator",
    version: "1.0.0",
    capabilities: [{ name: "evaluate", description: "d", inputSchema: {}, outputSchema: {} }],
  });
  assert.equal(evaluator.type, "evaluator");
});

test("index exports PluginContext", () => {
  const ctx = new PluginContext({ pluginId: "index-plugin" });
  assert.equal(ctx.pluginId, "index-plugin");
});

test("index exports PluginTestHarness", () => {
  const plugin = defineTool({
    pluginId: "harness-index-test",
    name: "Harness Index Test",
    version: "1.0.0",
    capabilities: [{ name: "execute", description: "d", inputSchema: {}, outputSchema: {} }],
  });

  const harness = new PluginTestHarness({ plugin });
  assert.equal(harness.getPlugin().pluginId, "harness-index-test");
});

test("index exports signing verification functions", () => {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  registerPluginSigningVerificationKey({
    keyId: "index-key",
    publicKeyPem: publicKey,
    algorithm: "RSA-SHA256",
  });

  const registry = getSigningKeyRegistry();
  assert.equal(registry.hasKey("index-key"), true);
});

test("index exports SBOM functions", () => {
  const scanner = getSbomScanner();
  assert.ok(scanner !== undefined);

  setSbomScanner(new DefaultSbomScanner());
  const newScanner = getSbomScanner();
  assert.ok(newScanner instanceof DefaultSbomScanner);
});

test("index exports validatePluginDefinition", () => {
  const original = definePlugin({
    pluginId: "validate-index",
    name: "Validate Index",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "execute", description: "d", inputSchema: {}, outputSchema: {} }],
  });

  const validated = validatePluginDefinition(original);
  assert.equal(validated.pluginId, original.pluginId);
});

test("index exports type definitions", () => {
  // PluginType
  const toolType: PluginType = "tool";
  const adapterType: PluginType = "adapter";
  assert.equal(toolType, "tool");
  assert.equal(adapterType, "adapter");

  // PluginRole
  const toolRole: PluginRole = "tool";
  assert.equal(toolRole, "tool");

  // Verify all types are assignable
  const allTypes: PluginType[] = ["tool", "adapter", "retriever", "evaluator", "validator", "planner", "presenter"];
  assert.equal(allTypes.length, 7);
});

test("index exports PluginCapability type", () => {
  const capability: PluginCapability = {
    name: "test-capability",
    description: "Test capability description",
    inputSchema: { type: "object", properties: { input: { type: "string" } } },
    outputSchema: { type: "object", properties: { output: { type: "string" } } },
  };

  assert.equal(capability.name, "test-capability");
  assert.ok(capability.inputSchema.properties);
});

test("index exports PluginResourceLimits type", () => {
  const limits: PluginResourceLimits = {
    maxMemoryMb: 1024,
    maxCpuMs: 10000,
    maxDurationMs: 60000,
  };

  assert.equal(limits.maxMemoryMb, 1024);
  assert.equal(limits.maxCpuMs, 10000);
});

test("index exports DefinePluginOptions type", () => {
  const options: DefinePluginOptions = {
    pluginId: "options-test",
    name: "Options Test",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "cap", description: "d", inputSchema: {}, outputSchema: {} }],
  };

  assert.equal(options.pluginId, "options-test");
});

test("index exports SbomVerificationOptions and Result types", () => {
  const options: SbomVerificationOptions = {
    minSeverity: "medium",
  };

  const result: SbomVerificationResult = {
    valid: true,
    scannedAt: new Date().toISOString(),
    vulnerabilities: [],
    scanErrors: [],
  };

  assert.equal(options.minSeverity, "medium");
  assert.equal(result.valid, true);
});

test("index exports SbomVulnerability type", () => {
  const vulnerability: SbomVulnerability = {
    id: "CVE-2021-1234",
    severity: "high",
    packageName: "test-package",
    packageVersion: "1.0.0",
    description: "Test vulnerability",
  };

  assert.equal(vulnerability.id, "CVE-2021-1234");
  assert.equal(vulnerability.severity, "high");
});

test("index exports PluginSignatureVerificationResult type", () => {
  const result: PluginSignatureVerificationResult = {
    valid: true,
    verifiedAt: new Date().toISOString(),
    keyId: "test-key",
    algorithm: "RSA-SHA256",
  };

  assert.equal(result.valid, true);
  assert.equal(result.keyId, "test-key");
});

test("index exports MockLlmConfig and MockToolResult types from harness", () => {
  const mockLlm: MockLlmConfig = {
    responses: [{ content: "response1" }, { content: "response2" }],
    delayMs: 100,
    errorRate: 0.1,
  };

  const mockTool: MockToolResult = {
    toolId: "tool-1",
    success: true,
    output: { result: "ok" },
    durationMs: 50,
  };

  assert.equal(mockLlm.responses.length, 2);
  assert.equal(mockTool.toolId, "tool-1");
});

test("index exports TestCase and TestResult types from harness", () => {
  const testCase: TestCase = {
    name: "test-case",
    input: { key: "value" },
    expectedOutput: { result: "expected" },
  };

  const testResult: TestResult = {
    caseName: "test-case",
    passed: true,
    actualOutput: { result: "actual" },
    expectedOutput: { result: "expected" },
    durationMs: 100,
  };

  assert.equal(testCase.name, "test-case");
  assert.equal(testResult.passed, true);
});

test("index exports HarnessReport type from harness", () => {
  const report: HarnessReport = {
    pluginId: "test-plugin",
    totalCases: 5,
    passedCases: 4,
    failedCases: 1,
    coveragePercent: 80,
    results: [],
    timestamp: new Date().toISOString(),
  };

  assert.equal(report.totalCases, 5);
  assert.equal(report.passedCases, 4);
  assert.equal(report.coveragePercent, 80);
});

test("index exports PluginSigningVerificationKey type", () => {
  const key: PluginSigningVerificationKey = {
    keyId: "signing-key",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----",
    algorithm: "RSA-SHA256",
  };

  assert.equal(key.keyId, "signing-key");
  assert.ok(key.publicKeyPem.includes("BEGIN PUBLIC KEY"));
});

test("full SDK integration - define sign and verify plugin", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  registerPluginSigningVerificationKey({
    keyId: "integration-key",
    publicKeyPem: publicKey,
    algorithm: "RSA-SHA256",
  });

  const pluginDef = {
    pluginId: "integration.tool",
    name: "Integration Tool",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [{
      name: "execute",
      description: "Integration test tool",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  };

  const payload = JSON.stringify({
    pluginId: pluginDef.pluginId,
    name: pluginDef.name,
    version: pluginDef.version,
    type: pluginDef.type,
    capabilities: pluginDef.capabilities,
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    spiTypes: ["tool"],
    domainIds: [],
  });

  const sign = createSign("RSA-SHA256");
  sign.update(payload);
  const signature = sign.sign(privateKey, "base64url");

  const plugin = definePlugin({
    ...pluginDef,
    signing: {
      keyId: "integration-key",
      signature,
      algorithm: "RSA-SHA256",
    },
  });

  assert.equal(plugin.pluginId, "integration.tool");
  assert.equal(plugin.signing?.keyId, "integration-key");
  assert.equal(verifyPluginSignature(plugin), true);
});

test("full SDK integration - PluginTestHarness with PluginContext", () => {
  const plugin = defineTool({
    pluginId: "harness-context-test",
    name: "Harness Context Test",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Test",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  const ctx = harness.createContext({ taskId: "task-123", tenantId: "tenant-abc" });

  assert.equal(ctx.pluginId, "harness-context-test");
  assert.equal(ctx.taskId, "task-123");
  assert.equal(ctx.tenantId, "tenant-abc");

  ctx.set("custom.data", "test-value");
  assert.equal(ctx.get("custom.data"), "test-value");

  const childCtx = ctx.fork({ taskId: "child-task" });
  assert.equal(childCtx.taskId, "child-task");
  assert.equal(childCtx.callDepth, 1);
});

test("full SDK integration - sign enforce and validate plugin", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  registerPluginSigningVerificationKey({
    keyId: "enforce-key",
    publicKeyPem: publicKey,
    algorithm: "RSA-SHA256",
  });

  const pluginDef = {
    pluginId: "enforce.tool",
    name: "Enforce Tool",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [{
      name: "execute",
      description: "Test",
      inputSchema: {},
      outputSchema: {},
    }],
  };

  const payload = JSON.stringify({
    pluginId: pluginDef.pluginId,
    name: pluginDef.name,
    version: pluginDef.version,
    type: pluginDef.type,
    capabilities: pluginDef.capabilities,
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    spiTypes: ["tool"],
    domainIds: [],
  });

  const sign = createSign("RSA-SHA256");
  sign.update(payload);
  const signature = sign.sign(privateKey, "base64url");

  const plugin = definePlugin({
    ...pluginDef,
    signing: {
      keyId: "enforce-key",
      signature,
      algorithm: "RSA-SHA256",
    },
  });

  // Should not throw - signature is valid
  enforcePluginSignature(plugin);

  const validated = validatePluginDefinition(plugin);
  assert.equal(validated.pluginId, "enforce.tool");
});

test("full SDK integration - runCases with coverage tracking", async () => {
  const plugin = defineTool({
    pluginId: "coverage-integration",
    name: "Coverage Integration",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Test",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  const harness = new PluginTestHarness({
    plugin,
    mode: "live",
    timeoutMs: 5000,
    liveRunner: async (input: Record<string, unknown>) => {
      return { result: input.value ? "ok" : "empty" };
    },
  });

  const report = await harness.runCases([
    { name: "with-value", input: { value: true }, expectedOutput: { result: "ok" } },
    { name: "empty-value", input: { value: false }, expectedOutput: { result: "empty" } },
    { name: "no-expected", input: { data: "test" } },
  ]);

  assert.equal(report.totalCases, 3);
  assert.ok(report.timestamp);
  assert.ok(report.coveragePercent >= 0);
  assert.equal(report.pluginId, "coverage-integration");
});

test("verifyPluginSignature returns false for unsigned when no signature", () => {
  const plugin = definePlugin({
    pluginId: "unsigned-integration",
    name: "Unsigned Integration",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "cap", description: "d", inputSchema: {}, outputSchema: {} }],
  });

  // Without a canonical payload, returns boolean
  const result = verifyPluginSignature(plugin);
  assert.equal(result, false);
});

test("verifyPluginSignature returns detailed result with canonicalPayload for unsigned", () => {
  const plugin = definePlugin({
    pluginId: "unsigned-detail-integration",
    name: "Unsigned Detail Integration",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "cap", description: "d", inputSchema: {}, outputSchema: {} }],
  });

  const result = verifyPluginSignature(plugin, "canonical-payload");
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test("enforcePluginSignature throws for unsigned plugin", () => {
  const plugin = definePlugin({
    pluginId: "unsigned-enforce-integration",
    name: "Unsigned Enforce Integration",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "cap", description: "d", inputSchema: {}, outputSchema: {} }],
  });

  assert.throws(
    () => enforcePluginSignature(plugin),
    /signature is required/i,
  );
});