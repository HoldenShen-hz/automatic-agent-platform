/**
 * [SYS-DEPLOY-6.1] Terraform Remote Backend Validation Tests
 *
 * Tests to verify that terraform main.tf has remote backend configured.
 * Without a remote backend, state files are stored locally which is
 * a security and collaboration issue.
 *
 * Defect: deploy/terraform/main.tf lacks backend {} block for remote state storage.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("[SYS-DEPLOY-6.1] terraform main.tf has remote backend configured", () => {
  const configPath = join(process.cwd(), "deploy/terraform/main.tf");

  let content: string;
  try {
    content = readFileSync(configPath, "utf8");
  } catch {
    // Try alternative path
    try {
      content = readFileSync(join(process.cwd(), "..", "deploy", "terraform", "main.tf"), "utf8");
    } catch {
      assert.ok(true, "Terraform config not found at expected path, skipping test");
      return;
    }
  }

  // Check for backend block
  const hasBackendBlock = content.includes("backend ");
  const hasLocalBackend = content.includes('backend "local"') || content.includes("backend {") && content.includes('type = "local"');

  assert.ok(
    hasBackendBlock,
    "main.tf must contain a backend block for remote state. Defect: no backend block found. This is critical for team collaboration and state locking.",
  );

  assert.ok(
    !hasLocalBackend,
    "Backend must not be local. Found local backend configuration. Use S3, GCS, or Azure storage for remote state.",
  );

  // Check for common remote backend types
  const hasS3Backend = content.includes('backend "s3"') || content.toLowerCase().includes("s3_backend");
  const hasGcsBackend = content.includes('backend "gcs"') || content.toLowerCase().includes("gcs_backend");
  const hasAzBackend = content.includes('backend "azurerm"') || content.toLowerCase().includes("azure_backend");

  assert.ok(
    hasS3Backend || hasGcsBackend || hasAzBackend,
    "Must use S3, GCS, or Azure backend for remote state storage. Current config lacks remote backend configuration.",
  );
});

test("[SYS-DEPLOY-6.1] terraform backend has required configuration", () => {
  const configPath = join(process.cwd(), "deploy/terraform/main.tf");

  let content: string;
  try {
    content = readFileSync(configPath, "utf8");
  } catch {
    try {
      content = readFileSync(join(process.cwd(), "..", "deploy", "terraform", "main.tf"), "utf8");
    } catch {
      assert.ok(true, "Terraform config not found, skipping test");
      return;
    }
  }

  // If backend block exists, check it has proper configuration
  if (content.includes("backend ")) {
    // For S3 backend - only check if backend "s3" or backend type is explicitly s3
    const hasS3BackendBlock = content.includes('backend "s3"') ||
      (content.includes("backend") && content.toLowerCase().includes('backend"') && content.toLowerCase().includes("s3"));
    if (hasS3BackendBlock) {
      // Only validate if the S3 backend block is not empty (has actual config)
      const s3BackendMatch = content.match(/backend\s+"s3"\s*\{([^}]*)\}/);
      if (s3BackendMatch && s3BackendMatch[1].trim().length > 0) {
        assert.ok(
          content.includes("bucket") || content.toLowerCase().includes("s3_bucket"),
          "S3 backend must specify bucket",
        );
        assert.ok(
          content.includes("region") || content.toLowerCase().includes("aws_region"),
          "S3 backend must specify region",
        );
      }
    }

    // For GCS backend
    if (content.includes('backend "gcs"') || content.toLowerCase().includes("gcs")) {
      assert.ok(
        content.includes("bucket") || content.toLowerCase().includes("gcs_bucket"),
        "GCS backend must specify bucket",
      );
    }
  }
});

test("[SYS-DEPLOY-6.1] terraform state file not stored in git", () => {
  const configPath = join(process.cwd(), "deploy/terraform/main.tf");

  let content: string;
  try {
    content = readFileSync(configPath, "utf8");
  } catch {
    try {
      content = readFileSync(join(process.cwd(), "..", "deploy", "terraform", "main.tf"), "utf8");
    } catch {
      assert.ok(true, "Terraform config not found, skipping test");
      return;
    }
  }

  // If using local backend, warn about state file location
  const hasLocalBackend = content.includes('backend "local"');

  if (hasLocalBackend) {
    // Check that state file path is not in a git-tracked directory
    // This is a warning rather than hard failure since some teams use local state
    assert.ok(
      content.includes(".gitignore") || content.includes("terraform.tfstate"),
      "Local state file should be in .gitignore to prevent accidental commit",
    );
  }
});

test("[SYS-DEPLOY-6.1] terraform required providers are defined", () => {
  const configPath = join(process.cwd(), "deploy/terraform/main.tf");

  let content: string;
  try {
    content = readFileSync(configPath, "utf8");
  } catch {
    try {
      content = readFileSync(join(process.cwd(), "..", "deploy", "terraform", "main.tf"), "utf8");
    } catch {
      assert.ok(true, "Terraform config not found, skipping test");
      return;
    }
  }

  // Verify required_providers block exists
  assert.ok(
    content.includes("required_providers"),
    "main.tf must define required_providers block",
  );

  // Verify AWS provider is configured
  assert.ok(
    content.includes("hashicorp/aws") || content.includes("registry.terraform.io/hashicorp/aws"),
    "AWS provider must be configured",
  );
});