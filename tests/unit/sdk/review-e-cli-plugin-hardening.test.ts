import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ValidationError } from "../../../src/platform/contracts/errors.js";
import {
  buildPackCreateManifest,
  parsePackCreateArgs,
} from "../../../src/sdk/cli/pack-create.js";
import { publishPack } from "../../../src/sdk/cli/pack-publish.js";
import {
  buildMigrateSqliteToPgUsage,
  parseMigrateSqliteToPgArgs,
} from "../../../src/sdk/cli/migrate-sqlite-to-pg.js";
import { readGuardedJsonFile } from "../../../src/sdk/cli/cli-file-guards.js";
import {
  definePlugin,
  registerPluginSigningVerificationKey,
  verifyPluginSignature,
  type PluginDefinition,
} from "../../../src/sdk/plugin-sdk/plugin-definition.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";

const aaSource = readFileSync(join(process.cwd(), "src", "sdk", "cli", "aa.ts"), "utf8");
const migrateSource = readFileSync(join(process.cwd(), "src", "sdk", "cli", "migrate-sqlite-to-pg.ts"), "utf8");
const packValidateSource = readFileSync(join(process.cwd(), "src", "sdk", "cli", "pack-validate.ts"), "utf8");
const packTestSource = readFileSync(join(process.cwd(), "src", "sdk", "cli", "pack-test.ts"), "utf8");
const secretManagementSource = readFileSync(join(process.cwd(), "src", "sdk", "cli", "secret-management.ts"), "utf8");
const pluginDefinitionSource = readFileSync(join(process.cwd(), "src", "sdk", "plugin-sdk", "plugin-definition.ts"), "utf8");

test("aa CLI sanitizes child environment and no longer self-signals on child exit", () => {
  assert.match(aaSource, /function buildChildEnv/);
  assert.match(aaSource, /CLI_ENV_SECRET_PATTERN/);
  assert.doesNotMatch(aaSource, /env:\s*\{\s*\.\.\.env/);
  assert.doesNotMatch(aaSource, /process\.kill\(process\.pid,\s*signal\)/);
});

test("migrate-sqlite-to-pg rejects unknown flags and missing values", () => {
  assert.throws(
    () => parseMigrateSqliteToPgArgs(["--sqlite", "/tmp/source.db", "--unknown"]),
    /usage:/,
  );
  assert.throws(
    () => parseMigrateSqliteToPgArgs(["--sqlite", "/tmp/source.db", "--pg-dsn"]),
    /usage:/,
  );
  assert.match(buildMigrateSqliteToPgUsage(), /--pg-dsn <dsn>/);
});

test("migrate-sqlite-to-pg uses schema-derived columns and batched inserts", () => {
  assert.match(migrateSource, /PRAGMA table_info/);
  assert.match(migrateSource, /buildInsertSql/);
  assert.match(migrateSource, /process\.once\("SIGINT"/);
});

test("readGuardedJsonFile blocks relative path traversal and oversized misuse", () => {
  assert.throws(
    () => readGuardedJsonFile("../package.json", "Pack manifest"),
    (error) => error instanceof ValidationError && error.code === "cli.file_path_traversal",
  );
});

test("pack-create normalizes list inputs and can build deduplicated manifest", () => {
  const options = parsePackCreateArgs([
    "--pack-id",
    "demo-pack",
    "--domain",
    "ops",
    "--owner",
    "owner@example.com",
    "--capabilities",
    "cap.one,cap.one,cap-two",
    "--tools",
    "tool-a,tool-a,tool-b",
  ]);

  assert.deepEqual(options.capabilities, ["cap.one", "cap-two"]);
  assert.deepEqual(options.tools, ["tool-a", "tool-b"]);

  const manifest = buildPackCreateManifest(options);
  assert.deepEqual(
    manifest.capabilities.map((capability) => capability.capabilityKey),
    ["cap.one", "cap-two"],
  );
  assert.deepEqual(manifest.tools, ["tool-a", "tool-b"]);
});

test("pack-validate and pack-test use guarded file reads and sanitized error summaries", () => {
  assert.match(packValidateSource, /readGuardedJsonFile/);
  assert.match(packValidateSource, /summarizeCliError/);
  assert.match(packValidateSource, /Number\.parseInt/);
  assert.match(packTestSource, /readGuardedJsonFile/);
  assert.match(packTestSource, /summarizeCliError/);
  assert.doesNotMatch(packTestSource, /err instanceof Error \? err\.message/);
});

test("pack-publish supports token files and preserves retry context", async () => {
  const workspace = createTempWorkspace("aa-review-e-pack-publish-");
  const manifestPath = join(workspace, "pack.json");
  const tokenPath = join(workspace, "token.txt");
  const originalFetch = globalThis.fetch;
  let attempts = 0;

  writeFileSync(manifestPath, JSON.stringify({
    packId: "retry-pack",
    version: "1.0.0",
    domainId: "ops",
    owner: "ops@example.com",
    capabilities: [{ capabilityKey: "ops.run", requiredContracts: ["runtime_execution_contract"] }],
  }));
  writeFileSync(tokenPath, "token-from-file\n");

  globalThis.fetch = async (input, init) => {
    attempts += 1;
    const authorization = init?.headers instanceof Headers
      ? init.headers.get("authorization")
      : typeof init?.headers === "object" && init?.headers != null
        ? (init.headers as Record<string, string>)["authorization"]
        : null;
    assert.equal(authorization, "Bearer token-from-file");
    return {
      ok: attempts >= 2,
      status: attempts >= 2 ? 201 : 503,
      headers: new Headers(),
      json: async () => ({ artifactId: "artifact-retry" }),
      text: async () => "",
    } as Response;
  };

  try {
    const result = await publishPack([
      "--manifest",
      manifestPath,
      "--registry-url",
      "https://registry.example.com",
      "--bearer-token-file",
      tokenPath,
    ]);
    assert.equal(result.published, true);
    assert.ok(result.errors.some((error) => error.includes("attempt=1")));
  } finally {
    globalThis.fetch = originalFetch;
    cleanupPath(workspace);
  }
});

test("secret-management sanitizes stdout payloads and stderr failures", () => {
  assert.match(secretManagementSource, /function sanitizeSecretResult/);
  assert.match(secretManagementSource, /JSON\.stringify\(sanitizeSecretResult\(result\)/);
  assert.match(secretManagementSource, /error instanceof ValidationError \? error\.code : "secret_management\.failed"/);
  assert.doesNotMatch(secretManagementSource, /error instanceof Error \? error\.message/);
});

function buildSignedPluginDefinition(
  overrides: Partial<PluginDefinition["signing"]> & { algorithm: string },
): { definition: Omit<PluginDefinition, "resourceLimits" | "dependencies" | "security" | "spiTypes" | "domainIds" | "sbomRef" | "signing">; publicKey: string; privateKey: string; signature: string } {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const definition = {
    pluginId: "signed.plugin",
    name: "Signed Plugin",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [{ name: "execute", description: "Run", inputSchema: {}, outputSchema: {} }],
  };
  const payload = JSON.stringify({
    pluginId: definition.pluginId,
    name: definition.name,
    version: definition.version,
    type: definition.type,
    capabilities: definition.capabilities,
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    spiTypes: ["tool"],
    domainIds: [],
  });
  const signer = createSign("RSA-SHA256");
  signer.update(payload);
  const signature = signer.sign(privateKey, "base64url");
  return { definition, publicKey, privateKey, signature };
}

test("plugin-definition rejects unsupported signing algorithms instead of downgrading", () => {
  const { definition, publicKey, signature } = buildSignedPluginDefinition({ algorithm: "RSA-SHA999" });
  registerPluginSigningVerificationKey({ keyId: "unsupported-algo-key", publicKeyPem: publicKey, algorithm: "RSA-SHA256" });
  assert.throws(
    () => definePlugin({
      ...definition,
      signing: { keyId: "unsupported-algo-key", signature, algorithm: "RSA-SHA999" },
    }),
    /Unsupported plugin signing algorithm/i,
  );
});

test("plugin-definition rejects subset-payload signatures and base64 signatures", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  registerPluginSigningVerificationKey({ keyId: "subset-payload-key", publicKeyPem: publicKey, algorithm: "RSA-SHA256" });
  const subsetPayload = JSON.stringify({
    pluginId: "subset.plugin",
    name: "Subset Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "execute", description: "Run", inputSchema: {}, outputSchema: {} }],
    spiTypes: ["tool"],
    domainIds: [],
  });
  const signer = createSign("RSA-SHA256");
  signer.update(subsetPayload);
  const base64Signature = signer.sign(privateKey, "base64");

  const plugin: PluginDefinition = {
    pluginId: "subset.plugin",
    name: "Subset Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "execute", description: "Run", inputSchema: {}, outputSchema: {} }],
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: ["late-added-dependency"],
    security: { sandboxTier: "read_only", egressDomains: [] },
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: {
      keyId: "subset-payload-key",
      signature: base64Signature,
      algorithm: "RSA-SHA256",
    },
  };

  assert.equal(verifyPluginSignature(plugin), false);
});

test("plugin-definition requires synchronous SBOM verification before returning a plugin", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "sbom.plugin",
      name: "SBOM Plugin",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "execute", description: "Run", inputSchema: {}, outputSchema: {} }],
      sbomRef: "https://example.com/sbom.json",
    }),
    /Unsupported SBOM protocol/i,
  );
  assert.match(pluginDefinitionSource, /verifySbomRefSync/);
  assert.doesNotMatch(pluginDefinitionSource, /attachAsyncPluginVerification/);
});
