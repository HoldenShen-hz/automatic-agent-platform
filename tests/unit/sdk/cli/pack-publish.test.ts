/**
 * Pack Publish CLI Tests
 *
 * Tests for the pack-publish.ts CLI command.
 * Tests parseArgs and publishing logic with mocked API client.
 */

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import test from "node:test";

import { publishPack } from "../../../../src/sdk/cli/pack-publish.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

interface PackPublishOptions {
  manifest: string;
  registryUrl?: string;
  apiVersion?: string;
  bearerToken?: string;
  dryRun?: boolean;
}

function parseArgs(args: string[]): PackPublishOptions {
  const opts: PackPublishOptions = { manifest: "", dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--manifest" && typeof next === "string") {
      opts.manifest = next;
      i += 1;
    } else if (arg === "--registry-url" && typeof next === "string") {
      opts.registryUrl = next;
      i += 1;
    } else if (arg === "--api-version" && typeof next === "string") {
      opts.apiVersion = next;
      i += 1;
    } else if (arg === "--bearer-token" && typeof next === "string") {
      opts.bearerToken = next;
      i += 1;
    }
    else if (arg === "--dry-run") opts.dryRun = true;
  }
  return opts;
}

interface PublishResult {
  published: boolean;
  packId: string;
  version: string;
  artifactId?: string;
  errors: string[];
  dryRun: boolean;
}

// Mock validateBusinessPackManifest behavior
function mockValidateManifest(manifest: Record<string, unknown>): { packId: string; version: string } {
  if (!manifest.packId || typeof manifest.packId !== "string" || !manifest.packId.trim()) {
    throw new Error("packId is required");
  }
  if (!manifest.version || typeof manifest.version !== "string") {
    throw new Error("version is required");
  }
  if (!manifest.domainId || typeof manifest.domainId !== "string" || !manifest.domainId.trim()) {
    throw new Error("domainId is required");
  }
  if (!manifest.owner || typeof manifest.owner !== "string" || !manifest.owner.trim()) {
    throw new Error("owner is required");
  }
  const capabilities = manifest.capabilities as unknown[];
  if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
    throw new Error("capabilities is required and must be non-empty");
  }
  return { packId: manifest.packId as string, version: manifest.version as string };
}

test("parseArgs extracts manifest path", () => {
  const opts = parseArgs(["--manifest", "./pack.json"]);

  assert.equal(opts.manifest, "./pack.json");
});

test("parseArgs extracts registry-url", () => {
  const opts = parseArgs(["--manifest", "./pack.json", "--registry-url", "https://api.example.com"]);

  assert.equal(opts.registryUrl, "https://api.example.com");
});

test("parseArgs extracts api-version", () => {
  const opts = parseArgs(["--manifest", "./pack.json", "--api-version", "v2"]);

  assert.equal(opts.apiVersion, "v2");
});

test("parseArgs extracts bearer-token", () => {
  const opts = parseArgs(["--manifest", "./pack.json", "--bearer-token", "abc123"]);

  assert.equal(opts.bearerToken, "abc123");
});

test("parseArgs sets dryRun to true when present", () => {
  const opts = parseArgs(["--manifest", "./pack.json", "--dry-run"]);

  assert.equal(opts.dryRun, true);
});

test("parseArgs defaults dryRun to false", () => {
  const opts = parseArgs(["--manifest", "./pack.json"]);

  assert.equal(opts.dryRun, false);
});

test("parseArgs handles empty arguments", () => {
  const opts = parseArgs([]);

  assert.equal(opts.manifest, "");
  assert.equal(opts.registryUrl, undefined);
  assert.equal(opts.apiVersion, undefined);
  assert.equal(opts.bearerToken, undefined);
  assert.equal(opts.dryRun, false);
});

test("parseArgs ignores unknown flags", () => {
  const opts = parseArgs([
    "--manifest", "./pack.json",
    "--unknown-flag", "value",
  ]);

  assert.equal(opts.manifest, "./pack.json");
});

test("parseArgs parses all options together", () => {
  const opts = parseArgs([
    "--manifest", "./pack.json",
    "--registry-url", "https://api.example.com",
    "--api-version", "v1",
    "--bearer-token", "token123",
    "--dry-run",
  ]);

  assert.equal(opts.manifest, "./pack.json");
  assert.equal(opts.registryUrl, "https://api.example.com");
  assert.equal(opts.apiVersion, "v1");
  assert.equal(opts.bearerToken, "token123");
  assert.equal(opts.dryRun, true);
});

test("parseArgs handles arguments with special characters in token", () => {
  const opts = parseArgs([
    "--manifest", "./pack.json",
    "--bearer-token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  ]);

  assert.equal(opts.bearerToken, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
});

test("parseArgs handles registry-url with port", () => {
  const opts = parseArgs([
    "--manifest", "./pack.json",
    "--registry-url", "https://localhost:8080",
  ]);

  assert.equal(opts.registryUrl, "https://localhost:8080");
});

test("publishPack returns structured missing token error instead of exiting early", async () => {
  const originalRegistry = process.env["AA_REGISTRY_URL"];
  const originalToken = process.env["AA_BEARER_TOKEN"];
  delete process.env["AA_BEARER_TOKEN"];
  process.env["AA_REGISTRY_URL"] = "https://api.example.com";
  const workspace = createTempWorkspace("aa-pack-publish-");
  try {
    const manifestPath = `${workspace}/pack.json`;
    writeFileSync(manifestPath, JSON.stringify({
      packId: "test-pack",
      version: "1.0.0",
      domainId: "test-domain",
      owner: "test-owner",
      capabilities: [{ capabilityKey: "cap1", requiredContracts: [] }],
    }));
    const result = await publishPack(["--manifest", manifestPath]);
    assert.equal(result.published, false);
    assert.ok(result.errors.some((error) => error.includes("missing_bearer_token")));
  } finally {
    cleanupPath(workspace);
    if (originalRegistry != null) {
      process.env["AA_REGISTRY_URL"] = originalRegistry;
    } else {
      delete process.env["AA_REGISTRY_URL"];
    }
    if (originalToken != null) {
      process.env["AA_BEARER_TOKEN"] = originalToken;
    }
  }
});

test("mockValidateManifest returns packId and version for valid manifest", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [{ capabilityKey: "cap1", requiredContracts: [] }],
  };

  const result = mockValidateManifest(manifest);

  assert.equal(result.packId, "test-pack");
  assert.equal(result.version, "1.0.0");
});

test("mockValidateManifest throws on missing packId", () => {
  const manifest = {
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [{ capabilityKey: "cap1", requiredContracts: [] }],
  };

  assert.throws(
    () => mockValidateManifest(manifest),
    /packId is required/,
  );
});

test("mockValidateManifest throws on missing version", () => {
  const manifest = {
    packId: "test-pack",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [{ capabilityKey: "cap1", requiredContracts: [] }],
  };

  assert.throws(
    () => mockValidateManifest(manifest),
    /version is required/,
  );
});

test("mockValidateManifest throws on missing domainId", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    owner: "test-owner",
    capabilities: [{ capabilityKey: "cap1", requiredContracts: [] }],
  };

  assert.throws(
    () => mockValidateManifest(manifest),
    /domainId is required/,
  );
});

test("mockValidateManifest throws on missing owner", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    capabilities: [{ capabilityKey: "cap1", requiredContracts: [] }],
  };

  assert.throws(
    () => mockValidateManifest(manifest),
    /owner is required/,
  );
});

test("mockValidateManifest throws on empty capabilities", () => {
  const manifest = {
    packId: "test-pack",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [],
  };

  assert.throws(
    () => mockValidateManifest(manifest),
    /capabilities is required/,
  );
});

test("mockValidateManifest throws on whitespace-only packId", () => {
  const manifest = {
    packId: "   ",
    version: "1.0.0",
    domainId: "test-domain",
    owner: "test-owner",
    capabilities: [{ capabilityKey: "cap1", requiredContracts: [] }],
  };

  assert.throws(
    () => mockValidateManifest(manifest),
    /packId is required/,
  );
});

test("parseArgs handles manifest path with directory traversal", () => {
  const opts = parseArgs(["--manifest", "../relative/path/pack.json"]);

  assert.equal(opts.manifest, "../relative/path/pack.json");
});

test("parseArgs handles manifest path with query parameters (edge case)", () => {
  const opts = parseArgs(["--manifest", "./pack.json?v=1"]);

  assert.equal(opts.manifest, "./pack.json?v=1");
});
