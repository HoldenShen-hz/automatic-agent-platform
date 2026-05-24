import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import {
  validateBusinessPackManifest,
  summarizeCapabilityMatrix,
  scanPackSecurity,
  signPackArtifact,
  verifyPackSignature,
  verifyPackArtifact,
  generateArtifactHash,
  generateSigningKeyPair,
  type BusinessPackManifest,
  type BusinessPackCapability,
} from "../../../../src/sdk/pack-sdk/pack-manifest.js";

test("validateBusinessPackManifest trims packId, version, domain, owner", () => {
  const manifest = validateBusinessPackManifest({
    packId: "  ops-pack  ",
    version: "  1.0.0  ",
    domainId: "  operations  ",
    domain: "  operations  ",
    owner: "  ops@example.com  ",
    capabilities: [
      { capabilityKey: " triage ", maturity: "ga", requiredContracts: [" runtime_execution_contract "] },
    ],
  });

  assert.equal(manifest.packId, "ops-pack");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.domain, "operations");
  assert.equal(manifest.owner, "ops@example.com");
  assert.equal(manifest.capabilities[0]!.capabilityKey, "triage");
  const capability = manifest.capabilities[0];
  assert.ok(capability);
  assert.ok(Array.isArray(capability.requiredContracts));
  assert.equal(capability.requiredContracts[0]!, "runtime_execution_contract");
});

test("validateBusinessPackManifest deduplicates requiredContracts within a capability", () => {
  const manifest = validateBusinessPackManifest({
    packId: "ops-pack",
    version: "1.0.0",
    domainId: "operations",
    domain: "operations",
    owner: "ops@example.com",
    capabilities: [
      { capabilityKey: "triage", maturity: "ga", requiredContracts: ["contract_a", " contract_a ", "contract_b"] },
    ],
  });

  assert.deepEqual(manifest.capabilities[0]!.requiredContracts, ["contract_a", "contract_b"]);
});

test("validateBusinessPackManifest removes empty contracts", () => {
  const manifest = validateBusinessPackManifest({
    packId: "ops-pack",
    version: "1.0.0",
    domainId: "operations",
    domain: "operations",
    owner: "ops@example.com",
    capabilities: [
      { capabilityKey: "triage", maturity: "ga", requiredContracts: ["runtime", "", "  ", "contract"] },
    ],
  });

  assert.deepEqual(manifest.capabilities[0]!.requiredContracts, ["runtime", "contract"]);
});

test("validateBusinessPackManifest rejects empty packId", () => {
  assert.throws(
    () =>
      validateBusinessPackManifest({
        packId: "   ",
        version: "1.0.0",
        domainId: "operations",
        domain: "operations",
        owner: "ops@example.com",
        capabilities: [
          { capabilityKey: "triage", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        ],
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_sdk.invalid_pack_id",
  );
});

test("validateBusinessPackManifest rejects empty capabilities", () => {
  assert.throws(
    () =>
      validateBusinessPackManifest({
        packId: "ops-pack",
        version: "1.0.0",
        domainId: "operations",
        domain: "operations",
        owner: "ops@example.com",
        capabilities: [],
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_sdk.empty_capabilities",
  );
});

test("summarizeCapabilityMatrix counts all maturity levels correctly", () => {
  const manifest = validateBusinessPackManifest({
    packId: "ops-pack",
    version: "1.0.0",
    domainId: "operations",
    domain: "operations",
    owner: "ops@example.com",
    capabilities: [
      { capabilityKey: "triage", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "capacity", maturity: "beta", requiredContracts: ["capacity_contract"] },
      { capabilityKey: "observe", maturity: "experimental", requiredContracts: ["observe_contract"] },
      { capabilityKey: "search", maturity: "ga", requiredContracts: ["search_contract"] },
      { capabilityKey: "transform", maturity: "beta", requiredContracts: ["transform_contract"] },
    ],
  });

  const summary = summarizeCapabilityMatrix(manifest);
  assert.deepEqual(summary, { experimental: 1, beta: 2, ga: 2 });
});

// ── Security Scanning Tests ─────────────────────────────────────────

test("scanPackSecurity passes for safe code", () => {
  const safeCode = `
    export function processData(input: string): string {
      const filtered = input.replace(/[^a-z]/g, "");
      return filtered.toUpperCase();
    }
  `;
  const hash = generateArtifactHash(safeCode);
  const result = scanPackSecurity(safeCode, hash);

  assert.equal(result.passed, true);
  assert.equal(result.artifactHash, hash);
  assert.equal(result.issues.length, 0);
});

test("scanPackSecurity detects eval with user input", () => {
  const maliciousCode = `
    export function processData(req: Request): string {
      return eval(req.body);
    }
  `;
  const hash = generateArtifactHash(maliciousCode);
  const result = scanPackSecurity(maliciousCode, hash);

  assert.equal(result.passed, false);
  assert.ok(result.issues.some(i => i.code === "PACK_SCAN_DYNAMIC_CODE_EXEC"));
});

test("scanPackSecurity detects shell execution", () => {
  const maliciousCode = `
    import { exec } from 'child_process';
    export function run(cmd: string) {
      exec('ls ' + cmd);
    }
  `;
  const hash = generateArtifactHash(maliciousCode);
  const result = scanPackSecurity(maliciousCode, hash);

  assert.equal(result.passed, false);
  assert.ok(result.issues.some(i => i.code === "PACK_SCAN_SHELL_EXEC" && i.severity === "critical"));
});

test("scanPackSecurity detects sensitive env access", () => {
  const code = `
    export function getPath() {
      return process.env.HOME;
    }
  `;
  const hash = generateArtifactHash(code);
  const result = scanPackSecurity(code, hash);

  assert.ok(result.issues.some(i => i.code === "PACK_SCAN_ENV_ACCESS"));
});

// ── Artifact Signing Tests ───────────────────────────────────────────

test("signPackArtifact creates valid signature", () => {
  const manifest: BusinessPackManifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test-cap", maturity: "ga", requiredContracts: ["contract_a"] },
    ],
  };

  const { privateKey } = generateSigningKeyPair();
  const signature = signPackArtifact(manifest, privateKey);

  assert.equal(signature.packId, "test-pack");
  assert.equal(signature.version, "1.0.0");
  assert.ok(signature.signature.length > 0);
  assert.ok(signature.keyFingerprint.length === 16);
  assert.ok(signature.algorithm === "RSA-SHA256");
});

test("verifyPackSignature validates correct signature", () => {
  const manifest: BusinessPackManifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test-cap", maturity: "ga", requiredContracts: ["contract_a"] },
    ],
  };

  const { privateKey, publicKey } = generateSigningKeyPair();
  const signature = signPackArtifact(manifest, privateKey);
  const isValid = verifyPackSignature(manifest, signature, publicKey);

  assert.equal(isValid, true);
});

test("verifyPackSignature rejects tampered manifest", () => {
  const manifest: BusinessPackManifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test-cap", maturity: "ga", requiredContracts: ["contract_a"] },
    ],
  };

  const tamperedManifest: BusinessPackManifest = {
    ...manifest,
    owner: "hacker@example.com",
  };

  const { privateKey, publicKey } = generateSigningKeyPair();
  const signature = signPackArtifact(manifest, privateKey);
  const isValid = verifyPackSignature(tamperedManifest, signature, publicKey);

  assert.equal(isValid, false);
});

test("verifyPackSignature rejects wrong packId/version", () => {
  const manifest: BusinessPackManifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test-cap", maturity: "ga", requiredContracts: ["contract_a"] },
    ],
  };

  const { privateKey, publicKey } = generateSigningKeyPair();
  const signature = signPackArtifact(manifest, privateKey);

  const wrongVersionManifest = { ...manifest, version: "2.0.0" };
  const isValid = verifyPackSignature(wrongVersionManifest, signature, publicKey);

  assert.equal(isValid, false);
});

// ── Verification Tests ───────────────────────────────────────────────

test("verifyPackArtifact passes for signed pack with no issues", () => {
  const manifest: BusinessPackManifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test-cap", maturity: "ga", requiredContracts: ["contract_a"] },
    ],
  };

  const safeCode = "export function test() { return true; }";
  const { privateKey, publicKey } = generateSigningKeyPair();
  const signature = signPackArtifact(manifest, privateKey);

  const result = verifyPackArtifact({
    manifest,
    sourceCode: safeCode,
    signature,
    publicKey,
    requireSignature: true,
    performSecurityScan: true,
  });

  assert.equal(result.valid, true);
  assert.equal(result.failures.length, 0);
  assert.equal(result.signatureValid, true);
  assert.ok(result.securityScan?.passed);
});

test("verifyPackArtifact fails for unsigned pack when signature required", () => {
  const manifest: BusinessPackManifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test-cap", maturity: "ga", requiredContracts: ["contract_a"] },
    ],
  };

  const result = verifyPackArtifact({
    manifest,
    requireSignature: true,
  });

  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.includes("missing_signature")));
});

test("verifyPackArtifact fails for pack with security issues", () => {
  const manifest: BusinessPackManifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test-cap", maturity: "ga", requiredContracts: ["contract_a"] },
    ],
  };

  const maliciousCode = "import { exec } from 'child_process'; exec('rm -rf /');";

  const result = verifyPackArtifact({
    manifest,
    sourceCode: maliciousCode,
    performSecurityScan: true,
  });

  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.includes("security_scan_failed")));
});

test("generateArtifactHash produces consistent hashes", () => {
  const content = "test content";
  const hash1 = generateArtifactHash(content);
  const hash2 = generateArtifactHash(content);

  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64); // SHA-256 hex is 64 chars
});

test("generateSigningKeyPair creates valid key pair", () => {
  const { privateKey, publicKey } = generateSigningKeyPair();

  assert.ok(privateKey.includes("-----BEGIN PRIVATE KEY-----"));
  assert.ok(publicKey.includes("-----BEGIN PUBLIC KEY-----"));
});
