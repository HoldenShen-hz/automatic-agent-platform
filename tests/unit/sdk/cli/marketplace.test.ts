/**
 * Marketplace CLI Tests
 *
 * Tests for marketplace CLI module which manages extension packages
 * in the marketplace including registration, review workflows, and publication.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadMarketplaceCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

describe("loadMarketplaceCliEnv", () => {
  it("parses register_package action", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "register_package",
      AA_DB_PATH: "/tmp/test.db",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
      AA_EXTENSION_ID: "ext-456",
      AA_PACKAGE_TYPE: "tool",
      AA_DISPLAY_NAME: "Test Package",
      AA_VERSION: "1.0.0",
      AA_OWNER: "test-owner",
      AA_TRUST_LEVEL: "verified",
      AA_SOURCE_URI: "https://example.com/package",
      AA_SIGNATURE_VERIFIED: "true",
    });

    assert.equal(config.action, "register_package");
    assert.equal(config.tenantId, "tenant-123");
    assert.equal(config.extensionId, "ext-456");
    assert.equal(config.packageType, "tool");
    assert.equal(config.displayName, "Test Package");
    assert.equal(config.trustLevel, "verified");
  });

  it("parses submit_review action", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "submit_review",
      AA_DB_PATH: "/tmp/test.db",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
      AA_PACKAGE_ID: "pkg-789",
      AA_SUBMITTER: "reviewer-abc",
    });

    assert.equal(config.action, "submit_review");
    assert.equal(config.packageId, "pkg-789");
    assert.equal(config.submitter, "reviewer-abc");
  });

  it("parses decide_review action", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "decide_review",
      AA_DB_PATH: "/tmp/test.db",
      AA_REVIEW_ID: "rev-123",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
      AA_REVIEW_STATUS: "approved",
      AA_REVIEWER: "senior-reviewer",
      AA_REASON_CODE: "quality_passed",
    });

    assert.equal(config.action, "decide_review");
    assert.equal(config.reviewId, "rev-123");
    assert.equal(config.reviewStatus, "approved");
    assert.equal(config.reviewer, "senior-reviewer");
    assert.equal(config.reasonCode, "quality_passed");
  });

  it("parses publish action", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "publish",
      AA_DB_PATH: "/tmp/test.db",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
      AA_PACKAGE_ID: "pkg-789",
      AA_CHANNEL: "stable",
    });

    assert.equal(config.action, "publish");
    assert.equal(config.channel, "stable");
  });

  it("parses revoke action", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "revoke",
      AA_DB_PATH: "/tmp/test.db",
      AA_PUBLICATION_ID: "pub-123",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
      AA_REASON_CODE: "security_issue",
    });

    assert.equal(config.action, "revoke");
    assert.equal(config.publicationId, "pub-123");
    assert.equal(config.reasonCode, "security_issue");
  });

  it("parses summary action", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
    });

    assert.equal(config.action, "summary");
    assert.equal(config.tenantId, "tenant-123");
  });

  it("parses export action", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "export",
      AA_DB_PATH: "/tmp/test.db",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
    });

    assert.equal(config.action, "export");
  });

  it("parses list_packages action with limit", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "list_packages",
      AA_DB_PATH: "/tmp/test.db",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
      AA_LIMIT: "100",
    });

    assert.equal(config.action, "list_packages");
    assert.equal(config.limit, 100);
  });

  it("parses list_reviews action with limit", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "list_reviews",
      AA_DB_PATH: "/tmp/test.db",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
      AA_LIMIT: "100",
    });

    assert.equal(config.action, "list_reviews");
    assert.equal(config.limit, 100);
  });

  it("parses list_publications action with limit", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "list_publications",
      AA_DB_PATH: "/tmp/test.db",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
      AA_LIMIT: "100",
    });

    assert.equal(config.action, "list_publications");
    assert.equal(config.limit, 100);
  });

  it("parses list_reports action with limit", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "list_reports",
      AA_DB_PATH: "/tmp/test.db",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
      AA_LIMIT: "20",
    });

    assert.equal(config.action, "list_reports");
    assert.equal(config.limit, 20);
  });

  it("parses optional artifact root", () => {
    const config = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "summary",
      AA_DB_PATH: "/tmp/test.db",
      AA_MARKETPLACE_TENANT_ID: "tenant-123",
      AA_MARKETPLACE_ARTIFACT_ROOT: "/tmp/artifacts",
    });

    assert.equal(config.artifactRoot, "/tmp/artifacts");
  });

  it("throws ValidationError for unknown action", () => {
    assert.throws(
      () =>
        loadMarketplaceCliEnv({
          AA_MARKETPLACE_ACTION: "unknown_action",
          AA_DB_PATH: "/tmp/test.db",
        }),
      (e) => e instanceof ValidationError && (e as ValidationError).code.includes("unknown_marketplace_action"),
    );
  });
});
