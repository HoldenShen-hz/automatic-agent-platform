import test from "node:test";
import assert from "node:assert/strict";

import { ArtifactGovernanceService } from "../../../../../src/platform/state-evidence/artifacts/artifact-governance-service.js";
import type { ArtifactBundleExtended, ArtifactRecord } from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";
import type { SensitiveContentScanResult } from "../../../../../src/platform/state-evidence/artifacts/sensitive-content-scanner.js";

function createArtifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    artifactId: "artifact_test_1",
    taskId: "task_1",
    stepId: "step_1",
    agentRole: "agent",
    type: "source_code",
    path: "/tmp/artifact.txt",
    contentHash: "abc123",
    version: 1,
    parentArtifactId: null,
    size: 1024,
    createdAt: "2026-04-01T00:00:00.000Z",
    status: "published",
    ...overrides,
  };
}

function createBundle(overrides: Partial<ArtifactBundleExtended> = {}): ArtifactBundleExtended {
  return {
    bundleId: "bundle_1",
    taskId: "task_1",
    bundleType: "release_bundle",
    domainId: "test_domain",
    publishStatus: "published",
    publishedAt: "2026-04-01T00:00:00.000Z",
    artifacts: [createArtifact()],
    links: [],
    finalDeliverables: ["/tmp/output.txt"],
    totalSize: 1024,
    createdAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function createMockScanner(result: SensitiveContentScanResult): { scanStructured: (value: unknown) => SensitiveContentScanResult } {
  return {
    scanStructured: () => result,
  };
}

test("ArtifactGovernanceService.review allows clean bundle", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle();

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.issues, []);
});

test("ArtifactGovernanceService.review rejects bundle exceeding size limit", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle({ totalSize: 11 * 1024 * 1024 });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.includes("artifact.bundle_size_limit_exceeded"));
});

test("ArtifactGovernanceService.review rejects bundle with secret detected", () => {
  const mockScanner = createMockScanner({
    findings: [{ code: "artifact.secret.aws_access_key_detected", kind: "secret", severity: "critical", description: "AWS access key detected.", redactedSample: "AKIA...XXXX" }],
    criticalFindingCount: 1,
    blocked: true,
  });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle();

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.includes("artifact.sensitive_secret_detected"));
});

test("ArtifactGovernanceService.review rejects bundle with PII detected", () => {
  const mockScanner = createMockScanner({
    findings: [{ code: "artifact.pii.email_detected", kind: "pii", severity: "warning", description: "Email PII detected.", redactedSample: "t***@example.com" }],
    criticalFindingCount: 0,
    blocked: false,
  });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle();

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.includes("artifact.sensitive_pii_detected"));
});

test("ArtifactGovernanceService.review rejects bundle with multiple issues", () => {
  const mockScanner = createMockScanner({
    findings: [
      { code: "artifact.secret.aws_access_key_detected", kind: "secret", severity: "critical", description: "AWS access key detected.", redactedSample: "AKIA...XXXX" },
      { code: "artifact.pii.email_detected", kind: "pii", severity: "warning", description: "Email PII detected.", redactedSample: "t***@example.com" },
    ],
    criticalFindingCount: 1,
    blocked: true,
  });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle({ totalSize: 11 * 1024 * 1024 });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.includes("artifact.bundle_size_limit_exceeded"));
  assert.ok(decision.issues.includes("artifact.sensitive_secret_detected"));
  assert.ok(decision.issues.includes("artifact.sensitive_pii_detected"));
});

test("ArtifactGovernanceService.review allows bundle at exactly size limit", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle({ totalSize: 10 * 1024 * 1024 });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.issues, []);
});

test("ArtifactGovernanceService.review rejects bundle just over size limit", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle({ totalSize: 10 * 1024 * 1024 + 1 });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.includes("artifact.bundle_size_limit_exceeded"));
});

test("ArtifactGovernanceService.review uses default scanner when none provided", () => {
  const service = new ArtifactGovernanceService();
  const bundle = createBundle();

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
});

test("ArtifactGovernanceService.review handles empty artifacts array", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle({ artifacts: [] });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
});

test("ArtifactGovernanceService.review handles empty links array", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle({ links: [] });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
});

test("ArtifactGovernanceService.review handles empty finalDeliverables array", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle({ finalDeliverables: [] });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
});

test("ArtifactGovernanceService.review passes correct bundle properties to scanner", () => {
  const bundle = createBundle({
    bundleId: "custom_bundle_id",
    artifacts: [createArtifact({ artifactId: "artifact_x" })],
    links: [{ linkId: "link_1", fromArtifactId: "a", toArtifactId: "b", relation: "depends_on" as const }],
    finalDeliverables: ["/path/to/deliverable"],
    totalSize: 5000,
  });

  let capturedValue: any;
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  mockScanner.scanStructured = (value: any) => {
    capturedValue = value;
    return { findings: [], criticalFindingCount: 0, blocked: false };
  };

  const service = new ArtifactGovernanceService(mockScanner as any);
  service.review(bundle);

  assert.equal(capturedValue.artifacts[0].artifactId, "artifact_x");
  assert.equal(capturedValue.links[0].linkId, "link_1");
  assert.equal(capturedValue.finalDeliverables[0], "/path/to/deliverable");
});

test("ArtifactGovernanceService.review handles zero size bundle", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle({ totalSize: 0 });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
});

test("ArtifactGovernanceService.review returns empty issues when allowed", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle();

  const decision = service.review(bundle);

  assert.equal(decision.issues.length, 0);
});

test("ArtifactGovernanceService.review does not detect secret when only PII findings exist", () => {
  const mockScanner = createMockScanner({
    findings: [{ code: "artifact.pii.email_detected", kind: "pii", severity: "warning", description: "Email PII detected.", redactedSample: "t***@example.com" }],
    criticalFindingCount: 0,
    blocked: false,
  });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle();

  const decision = service.review(bundle);

  assert.ok(decision.issues.includes("artifact.sensitive_pii_detected"));
  assert.ok(!decision.issues.includes("artifact.sensitive_secret_detected"));
});

test("ArtifactGovernanceService.review does not detect PII when only secret findings exist", () => {
  const mockScanner = createMockScanner({
    findings: [{ code: "artifact.secret.aws_access_key_detected", kind: "secret", severity: "critical", description: "AWS access key detected.", redactedSample: "AKIA...XXXX" }],
    criticalFindingCount: 1,
    blocked: true,
  });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle();

  const decision = service.review(bundle);

  assert.ok(decision.issues.includes("artifact.sensitive_secret_detected"));
  assert.ok(!decision.issues.includes("artifact.sensitive_pii_detected"));
});

test("ArtifactGovernanceService.review handles bundle with different artifact types", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle({
    artifacts: [
      createArtifact({ type: "source_code" }),
      createArtifact({ type: "config" }),
      createArtifact({ type: "document" }),
      createArtifact({ type: "binary" }),
    ],
  });

  const decision = service.review(bundle);

  assert.equal(decision.allowed, true);
});

test("ArtifactGovernanceService.review decision structure is correct", () => {
  const mockScanner = createMockScanner({ findings: [], criticalFindingCount: 0, blocked: false });
  const service = new ArtifactGovernanceService(mockScanner as any);
  const bundle = createBundle();

  const decision = service.review(bundle);

  assert.ok("allowed" in decision);
  assert.ok("issues" in decision);
  assert.ok(Array.isArray(decision.issues));
});
