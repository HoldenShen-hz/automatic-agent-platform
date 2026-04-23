import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadMarketplaceCliEnv } from "../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

describe("loadMarketplaceCliEnv", () => {
  it("parses package lifecycle actions with current env names", () => {
    const register = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "register_package",
      AA_DB_PATH: "/tmp/test.db",
      AA_TENANT_ID: "tenant-123",
      AA_EXTENSION_ID: "ext-456",
      AA_PACKAGE_TYPE: "tool",
      AA_DISPLAY_NAME: "Test Package",
      AA_VERSION: "1.0.0",
      AA_OWNER: "test-owner",
      AA_TRUST_LEVEL: "verified",
      AA_SOURCE_URI: "https://example.com/package",
      AA_SIGNATURE_VERIFIED: "true",
      AA_ARTIFACT_ROOT: "/tmp/artifacts",
    });
    const review = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "decide_review",
      AA_DB_PATH: "/tmp/test.db",
      AA_REVIEW_ID: "rev-123",
      AA_REVIEW_STATUS: "approved",
      AA_REVIEWER: "senior-reviewer",
      AA_REASON_CODE: "quality_passed",
    });
    const listing = loadMarketplaceCliEnv({
      AA_MARKETPLACE_ACTION: "list_reports",
      AA_DB_PATH: "/tmp/test.db",
      AA_LIMIT: "20",
    });

    assert.equal(register.tenantId, "tenant-123");
    assert.equal(register.artifactRoot, "/tmp/artifacts");
    assert.equal(review.reviewStatus, "approved");
    assert.equal(listing.limit, 20);
  });

  it("defaults to summary and rejects unknown actions", () => {
    const summary = loadMarketplaceCliEnv({
      AA_DB_PATH: "/tmp/test.db",
    });

    assert.equal(summary.action, "summary");

    assert.throws(
      () =>
        loadMarketplaceCliEnv({
          AA_MARKETPLACE_ACTION: "unknown_action",
          AA_DB_PATH: "/tmp/test.db",
        }),
      (error) =>
        error instanceof ValidationError && error.code === "invalid_env:AA_MARKETPLACE_ACTION",
    );
  });
});
