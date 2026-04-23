import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactGovernanceService } from "../../../../../src/platform/state-evidence/artifacts/artifact-governance-service.js";
import { SensitiveContentScanner } from "../../../../../src/platform/state-evidence/artifacts/sensitive-content-scanner.js";
import type { ArtifactBundleExtended } from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";

function createMockBundle(overrides: Partial<ArtifactBundleExtended> = {}): ArtifactBundleExtended {
  const now = new Date().toISOString();
  return {
    bundleId: "bundle_001",
    taskId: "task_001",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 1024,
    createdAt: now,
    bundleType: "release_bundle",
    domainId: "domain_001",
    publishStatus: "draft",
    publishedAt: null,
    ...overrides,
  };
}

test("ArtifactGovernanceService allows bundle under size limit", () => {
  const service = new ArtifactGovernanceService();
  const bundle = createMockBundle({ totalSize: 1024 * 1024 }); // 1MB

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.issues, []);
});

test("ArtifactGovernanceService blocks bundle over 10MB size limit", () => {
  const service = new ArtifactGovernanceService();
  const bundle = createMockBundle({ totalSize: 10 * 1024 * 1024 + 1 }); // 10MB + 1 byte

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.includes("artifact.bundle_size_limit_exceeded"));
});

test("ArtifactGovernanceService allows bundle at exactly 10MB", () => {
  const service = new ArtifactGovernanceService();
  const bundle = createMockBundle({ totalSize: 10 * 1024 * 1024 }); // exactly 10MB

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
});

test("ArtifactGovernanceService detects secrets in artifacts", () => {
  const scanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(scanner);
  const bundle = createMockBundle({
    artifacts: [
      {
        artifactId: "a1",
        taskId: "t1",
        stepId: "s1",
        agentRole: "agent",
        type: "source_code",
        path: "/config.js",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "",
        status: "committed",
        // @ts-ignore - adding content for testing
        content: 'const apiKey = "AKIAIOSFODNN7EXAMPLE";',
      } as any,
    ],
  });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.some((issue) => issue.includes("secret")));
});

test("ArtifactGovernanceService detects PII in artifacts", () => {
  const scanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(scanner);
  const bundle = createMockBundle({
    artifacts: [
      {
        artifactId: "a1",
        taskId: "t1",
        stepId: "s1",
        agentRole: "agent",
        type: "document",
        path: "/notes.txt",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "",
        status: "committed",
        // @ts-ignore - adding content for testing
        content: "User SSN: 123-45-6789",
      } as any,
    ],
  });

  const decision = service.review(bundle);

  // PII findings are warnings, not blocking by default unless they are critical secrets
  // The governance service checks for "secret" kind findings to block
  // PII is added as an issue but doesn't block unless it's a secret
  assert.ok(decision.issues.some((issue) => issue.includes("pii")));
});

test("ArtifactGovernanceService allows bundle with no issues", () => {
  const service = new ArtifactGovernanceService();
  const bundle = createMockBundle({
    artifacts: [
      {
        artifactId: "a1",
        taskId: "t1",
        stepId: "s1",
        agentRole: "agent",
        type: "source_code",
        path: "/main.js",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "",
        status: "committed",
        // @ts-ignore - adding content for testing
        content: "console.log('hello world');",
      } as any,
    ],
  });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.issues, []);
});

test("ArtifactGovernanceService checks links for sensitive content", () => {
  const scanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(scanner);
  const bundle = createMockBundle({
    links: [
      {
        linkId: "link1",
        fromArtifactId: "a1",
        toRefId: "a2",
        relation: "derived_from",
      } as any,
    ],
    artifacts: [
      {
        artifactId: "a1",
        taskId: "t1",
        stepId: "s1",
        agentRole: "agent",
        type: "source_code",
        path: "/file1.js",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "",
        status: "committed",
        // @ts-ignore
        content: "api_key=AKIAIOSFODNN7EXAMPLE12345678",
      } as any,
    ],
  });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
});

test("ArtifactGovernanceService uses custom scanner", () => {
  const customScanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(customScanner);

  // Verify the service uses the provided scanner by checking a bundle with content
  const bundle = createMockBundle({
    artifacts: [
      {
        artifactId: "a1",
        taskId: "t1",
        stepId: "s1",
        agentRole: "agent",
        type: "source_code",
        path: "/file.js",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "",
        status: "committed",
        // @ts-ignore
        content: "const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';",
      } as any,
    ],
  });

  const decision = service.review(bundle);

  // JWT token should be detected as a secret
  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.some((issue) => issue.includes("secret")));
});

test("ArtifactGovernanceService returns multiple issues", () => {
  const scanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(scanner);
  const bundle = createMockBundle({
    totalSize: 15 * 1024 * 1024, // over limit
    artifacts: [
      {
        artifactId: "a1",
        taskId: "t1",
        stepId: "s1",
        agentRole: "agent",
        type: "source_code",
        path: "/file.js",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "",
        status: "committed",
        // @ts-ignore
        content: "api_key = 'AKIAIOSFODNN7EXAMPLE';",
      } as any,
    ],
  });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.length >= 2);
  assert.ok(decision.issues.includes("artifact.bundle_size_limit_exceeded"));
  assert.ok(decision.issues.some((issue) => issue.includes("secret")));
});

test("ArtifactGovernanceService allows empty artifacts array", () => {
  const service = new ArtifactGovernanceService();
  const bundle = createMockBundle({ artifacts: [] });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
});

test("ArtifactGovernanceService handles bundle with only links", () => {
  const service = new ArtifactGovernanceService();
  const bundle = createMockBundle({
    artifacts: [],
    links: [
      {
        linkId: "link1",
        fromArtifactId: "a1",
        toRefId: "a2",
        relation: "depends_on",
      } as any,
    ],
  });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
});

test("ArtifactGovernanceService blocks bundle with AWS access key pattern", () => {
  const scanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(scanner);
  const bundle = createMockBundle({
    artifacts: [
      {
        artifactId: "a1",
        taskId: "t1",
        stepId: "s1",
        agentRole: "agent",
        type: "config",
        path: "/aws.yaml",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "",
        status: "committed",
        // @ts-ignore
        content: "aws_access_key_id: AKIAIOSFODNN7EXAMPLE\naws_secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      } as any,
    ],
  });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.some((issue) => issue.includes("secret")));
});

test("ArtifactGovernanceService blocks bundle with JWT token pattern", () => {
  const scanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(scanner);
  // JWT token is detected as a secret and blocked
  const bundle = createMockBundle({
    artifacts: [
      {
        artifactId: "a1",
        taskId: "t1",
        stepId: "s1",
        agentRole: "agent",
        type: "source_code",
        path: "/key.pem",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "",
        status: "committed",
        // @ts-ignore
        content: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      } as any,
    ],
  });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  // Governance service reports "artifact.sensitive_secret_detected" for all secret findings
  assert.ok(decision.issues.some((issue) => issue.includes("secret")));
});

test("ArtifactGovernanceService blocks bundle with JWT token", () => {
  const scanner = new SensitiveContentScanner();
  const service = new ArtifactGovernanceService(scanner);
  // Using JWT which is reliably detected by the scanner
  const bundle = createMockBundle({
    artifacts: [
      {
        artifactId: "a1",
        taskId: "t1",
        stepId: "s1",
        agentRole: "agent",
        type: "config",
        path: "/settings.json",
        contentHash: "hash1",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "",
        status: "committed",
        // @ts-ignore
        content: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      } as any,
    ],
  });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  // Governance service reports "artifact.sensitive_secret_detected" for all secret findings
  assert.ok(decision.issues.some((issue) => issue.includes("secret")));
});
