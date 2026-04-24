import test from "node:test";
import assert from "node:assert/strict";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import { ArtifactPlaneService } from "../../../../../src/platform/state-evidence/artifacts/artifact-plane-service.js";
import type { ArtifactBundleExtended, ArtifactLink, ArtifactRecord } from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";
import type { ArtifactGovernanceDecision } from "../../../../../src/platform/state-evidence/artifacts/artifact-governance-service.js";
import type { ArtifactPublishLedgerEntry } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

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
    status: "draft",
    ...overrides,
  };
}

function createBundle(overrides: Partial<ArtifactBundleExtended> = {}): ArtifactBundleExtended {
  return {
    bundleId: "bundle_1",
    taskId: "task_1",
    bundleType: "release_bundle",
    domainId: "test_domain",
    publishStatus: "draft",
    publishedAt: null,
    artifacts: [createArtifact()],
    links: [],
    finalDeliverables: ["/tmp/output.txt"],
    totalSize: 1024,
    createdAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock implementations
// ---------------------------------------------------------------------------

function createMockBundleService(buildResult: ArtifactBundleExtended) {
  return {
    build: () => buildResult,
  };
}

function createMockGovernanceService(decision: ArtifactGovernanceDecision) {
  return {
    review: () => decision,
  };
}

function createMockPreviewService(rendered: string) {
  return {
    renderBundle: () => rendered,
  };
}

function createMockPublishService(publishedBundle: ArtifactBundleExtended, ledgerEntries: ArtifactPublishLedgerEntry[] = []) {
  return {
    publish: () => publishedBundle,
    listPublishHistory: () => ledgerEntries,
  };
}

// ---------------------------------------------------------------------------
// Tests: prepareBundle
// ---------------------------------------------------------------------------

test("prepareBundle returns bundle, governance decision, and preview", () => {
  const bundle = createBundle();
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  const preview = "# Artifact Bundle bundle_1";

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService(preview) as any,
    createMockPublishService(bundle) as any,
  );

  const result = service.prepareBundle({
    taskId: "task_1",
    domainId: "test_domain",
    bundleType: "release_bundle",
    artifacts: [createArtifact()],
  });

  assert.equal(result.bundle, bundle);
  assert.equal(result.governance, governance);
  assert.equal(result.preview, preview);
});

test("prepareBundle passes links and finalDeliverables to bundle service", () => {
  const bundle = createBundle({ links: [], finalDeliverables: ["/tmp/deliverable.txt"] });
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  const preview = "preview";

  let buildInput: unknown = null;
  const mockBundleService = {
    build: (input: unknown) => {
      buildInput = input;
      return bundle;
    },
  };

  const service = new ArtifactPlaneService(
    mockBundleService as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService(preview) as any,
    createMockPublishService(bundle) as any,
  );

  const links: ArtifactLink[] = [{ linkId: "link_1", fromArtifactId: "a1", toArtifactId: "a2", relation: "derived_from" }];
  const finalDeliverables = ["/tmp/deliverable.txt"];

  service.prepareBundle({
    taskId: "task_1",
    domainId: "test_domain",
    bundleType: "release_bundle",
    artifacts: [createArtifact()],
    links,
    finalDeliverables,
  });

  assert.deepEqual((buildInput as any).links, links);
  assert.deepEqual((buildInput as any).finalDeliverables, finalDeliverables);
});

test("prepareBundle handles multiple artifacts", () => {
  const artifacts = [
    createArtifact({ artifactId: "artifact_1", size: 500 }),
    createArtifact({ artifactId: "artifact_2", size: 300 }),
  ];
  const bundle = createBundle({ artifacts, totalSize: 800 });
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  const preview = "preview";

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService(preview) as any,
    createMockPublishService(bundle) as any,
  );

  const result = service.prepareBundle({
    taskId: "task_1",
    domainId: "test_domain",
    bundleType: "release_bundle",
    artifacts,
  });

  assert.equal(result.bundle.artifacts.length, 2);
  assert.equal(result.bundle.totalSize, 800);
});

test("prepareBundle returns governance with issues when not allowed", () => {
  const bundle = createBundle();
  const governance: ArtifactGovernanceDecision = {
    allowed: false,
    issues: ["artifact.sensitive_secret_detected"],
  };
  const preview = "preview";

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService(preview) as any,
    createMockPublishService(bundle) as any,
  );

  const result = service.prepareBundle({
    taskId: "task_1",
    domainId: "test_domain",
    bundleType: "release_bundle",
    artifacts: [createArtifact()],
  });

  assert.equal(result.governance.allowed, false);
  assert.ok(result.governance.issues.includes("artifact.sensitive_secret_detected"));
});

// ---------------------------------------------------------------------------
// Tests: publishBundle
// ---------------------------------------------------------------------------

test("publishBundle returns published bundle with governance and preview on success", () => {
  const draftBundle = createBundle({ publishStatus: "draft" });
  const publishedBundle = createBundle({ publishStatus: "published", publishedAt: "2026-04-01T00:00:00.000Z" });
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  const preview = "# Artifact Bundle bundle_1 (published)";

  const service = new ArtifactPlaneService(
    createMockBundleService(draftBundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService(preview) as any,
    createMockPublishService(publishedBundle) as any,
  );

  const result = service.publishBundle(draftBundle);

  assert.equal(result.bundle, publishedBundle);
  assert.equal(result.governance, governance);
  assert.equal(result.preview, preview);
});

test("publishBundle throws ValidationError when governance blocks publish", () => {
  const bundle = createBundle();
  const governance: ArtifactGovernanceDecision = {
    allowed: false,
    issues: ["artifact.bundle_size_limit_exceeded"],
  };

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService("preview") as any,
    createMockPublishService(bundle) as any,
  );

  assert.throws(
    () => service.publishBundle(bundle),
    (err: unknown) => err instanceof ValidationError && err.code === "artifact_plane.publish_blocked",
  );
});

test("publishBundle error includes governance issues in details", () => {
  const bundle = createBundle({ bundleId: "bundle_test" });
  const governance: ArtifactGovernanceDecision = {
    allowed: false,
    issues: ["artifact.sensitive_secret_detected", "artifact.sensitive_pii_detected"],
  };

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService("preview") as any,
    createMockPublishService(bundle) as any,
  );

  let error: ValidationError | null = null;
  try {
    service.publishBundle(bundle);
  } catch (err) {
    if (err instanceof ValidationError) {
      error = err;
    }
  }

  assert.ok(error !== null);
  assert.deepEqual(error!.details?.issues, ["artifact.sensitive_secret_detected", "artifact.sensitive_pii_detected"]);
  assert.equal(error!.details?.bundleId, "bundle_test");
});

test("publishBundle calls governance review with correct bundle", () => {
  const bundle = createBundle();
  let reviewCallArgs: unknown = null;
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  const mockGovernanceService = {
    review: (arg: unknown) => {
      reviewCallArgs = arg;
      return governance;
    },
  };

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    mockGovernanceService as any,
    createMockPreviewService("preview") as any,
    createMockPublishService(bundle) as any,
  );

  service.publishBundle(bundle);

  assert.equal(reviewCallArgs, bundle);
});

test("publishBundle calls publish service with bundle", () => {
  const draftBundle = createBundle({ publishStatus: "draft" });
  const publishedBundle = createBundle({ publishStatus: "published" });
  let publishCallArgs: unknown = null;
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  const mockPublishService = {
    publish: (arg: unknown) => {
      publishCallArgs = arg;
      return publishedBundle;
    },
    listPublishHistory: () => [],
  };

  const service = new ArtifactPlaneService(
    createMockBundleService(draftBundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService("preview") as any,
    mockPublishService as any,
  );

  service.publishBundle(draftBundle);

  assert.equal(publishCallArgs, draftBundle);
});

test("publishBundle renders preview using published bundle", () => {
  const draftBundle = createBundle({ publishStatus: "draft" });
  const publishedBundle = createBundle({ publishStatus: "published" });
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  let renderCallArgs: unknown = null;
  const mockPreviewService = {
    renderBundle: (arg: unknown) => {
      renderCallArgs = arg;
      return "rendered";
    },
  };

  const service = new ArtifactPlaneService(
    createMockBundleService(draftBundle) as any,
    createMockGovernanceService(governance) as any,
    mockPreviewService as any,
    createMockPublishService(publishedBundle) as any,
  );

  service.publishBundle(draftBundle);

  assert.equal(renderCallArgs, publishedBundle);
});

test("publishBundle returns correct result structure", () => {
  const bundle = createBundle({ publishStatus: "published", publishedAt: "2026-04-01T00:00:00.000Z" });
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  const preview = "preview content";

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService(preview) as any,
    createMockPublishService(bundle) as any,
  );

  const result = service.publishBundle(bundle);

  assert.ok("bundle" in result);
  assert.ok("governance" in result);
  assert.ok("preview" in result);
  assert.equal(result.preview, preview);
});

// ---------------------------------------------------------------------------
// Tests: listPublishHistory
// ---------------------------------------------------------------------------

test("listPublishHistory returns ledger entries", () => {
  const bundle = createBundle();
  const ledgerEntries: ArtifactPublishLedgerEntry[] = [
    {
      publishId: "pub_1",
      bundleId: "bundle_1",
      taskId: "task_1",
      domainId: "test_domain",
      bundleType: "release_bundle",
      artifactCount: 1,
      totalSize: 1024,
      publishedAt: "2026-04-01T00:00:00.000Z",
      publishStatus: "published",
    },
    {
      publishId: "pub_2",
      bundleId: "bundle_2",
      taskId: "task_2",
      domainId: "test_domain",
      bundleType: "asset_bundle",
      artifactCount: 2,
      totalSize: 2048,
      publishedAt: "2026-04-02T00:00:00.000Z",
      publishStatus: "published",
    },
  ];

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService({ allowed: true, issues: [] }) as any,
    createMockPreviewService("preview") as any,
    createMockPublishService(bundle, ledgerEntries) as any,
  );

  const result = service.listPublishHistory();

  assert.equal(result.length, 2);
  assert.equal(result[0]?.publishId, "pub_1");
  assert.equal(result[1]?.publishId, "pub_2");
});

test("listPublishHistory returns empty array when no entries", () => {
  const bundle = createBundle();

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService({ allowed: true, issues: [] }) as any,
    createMockPreviewService("preview") as any,
    createMockPublishService(bundle, []) as any,
  );

  const result = service.listPublishHistory();

  assert.equal(result.length, 0);
});

// ---------------------------------------------------------------------------
// Tests: constructor defaults
// ---------------------------------------------------------------------------

test("constructor creates instance with default services", () => {
  const service = new ArtifactPlaneService();

  assert.ok(service instanceof ArtifactPlaneService);
});

// ---------------------------------------------------------------------------
// Tests: prepareBundle with different bundle types
// ---------------------------------------------------------------------------

test("prepareBundle works with asset_bundle type", () => {
  const bundle = createBundle({ bundleType: "asset_bundle" });
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  const preview = "preview";

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService(preview) as any,
    createMockPublishService(bundle) as any,
  );

  const result = service.prepareBundle({
    taskId: "task_1",
    domainId: "test_domain",
    bundleType: "asset_bundle",
    artifacts: [],
  });

  assert.equal(result.bundle.bundleType, "asset_bundle");
});

test("prepareBundle works with incident_bundle type", () => {
  const bundle = createBundle({ bundleType: "incident_bundle" });
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  const preview = "preview";

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService(preview) as any,
    createMockPublishService(bundle) as any,
  );

  const result = service.prepareBundle({
    taskId: "task_1",
    domainId: "test_domain",
    bundleType: "incident_bundle",
    artifacts: [],
  });

  assert.equal(result.bundle.bundleType, "incident_bundle");
});

test("prepareBundle works with workflow_snapshot type", () => {
  const bundle = createBundle({ bundleType: "workflow_snapshot" });
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };
  const preview = "preview";

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService(preview) as any,
    createMockPublishService(bundle) as any,
  );

  const result = service.prepareBundle({
    taskId: "task_1",
    domainId: "test_domain",
    bundleType: "workflow_snapshot",
    artifacts: [],
  });

  assert.equal(result.bundle.bundleType, "workflow_snapshot");
});

// ---------------------------------------------------------------------------
// Tests: publishBundle with different publish statuses
// ---------------------------------------------------------------------------

test("publishBundle works with review status bundle that passes governance", () => {
  const bundle = createBundle({ publishStatus: "review" });
  const publishedBundle = createBundle({ publishStatus: "published", publishedAt: "2026-04-01T00:00:00.000Z" });
  const governance: ArtifactGovernanceDecision = { allowed: true, issues: [] };

  const service = new ArtifactPlaneService(
    createMockBundleService(bundle) as any,
    createMockGovernanceService(governance) as any,
    createMockPreviewService("preview") as any,
    createMockPublishService(publishedBundle) as any,
  );

  const result = service.publishBundle(bundle);

  assert.equal(result.bundle.publishStatus, "published");
});
