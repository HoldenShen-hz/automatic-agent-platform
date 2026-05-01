import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PackSecurityService } from "../../../../src/scale-ecosystem/marketplace/pack-security-service.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

test("PackSecurityService fails closed when manifest checksum is malformed", async () => {
  const service = new PackSecurityService();

  const result = await service.runSecurityScan({
    packId: "pack.analytics",
    version: "1.0.0",
    sourceUri: "registry://packs/analytics",
    manifestChecksum: "bad-checksum",
    capabilities: ["reporting"],
    permissions: ["read.audit"],
  });

  assert.equal(result.status, "failed");
  assert.equal(result.issues[0]?.code, "PKG001");
});

test("PackSecurityService validates inline source checksum integrity", async () => {
  const service = new PackSecurityService();
  const inlineSource = "export default { action: 'summarize' };";

  const result = await service.runSecurityScan({
    packId: "pack.inline",
    version: "2.0.0",
    sourceUri: `inline:${inlineSource}`,
    manifestChecksum: sha256("different-source"),
    capabilities: ["reporting"],
    permissions: ["read.audit"],
  });

  assert.equal(result.status, "failed");
  assert.equal(result.issues.some((issue) => issue.code === "PKG002"), true);
});

test("PackSecurityService warns on high-risk permissions and overlapping dependency versions", async () => {
  const service = new PackSecurityService();
  const inlineSource = "export const capability = 'catalog';";

  const scan = await service.runSecurityScan({
    packId: "pack.catalog",
    version: "3.1.0",
    sourceUri: `inline:${inlineSource}`,
    manifestChecksum: sha256(inlineSource),
    capabilities: ["catalog", "reporting"],
    permissions: ["file:write"],
  });

  assert.equal(scan.status, "passed");
  assert.equal(scan.issues.some((issue) => issue.code === "PERM001"), true);

  const resolution = service.detectDependencyConflicts(
    "pack.catalog",
    "3.1.0",
    [{
      packId: "shared.renderer",
      version: "2.0.0",
      capabilities: ["render", "catalog"],
    }],
    [{
      packId: "shared.renderer",
      version: "1.5.0",
      capabilities: ["catalog"],
    }],
  );

  assert.equal(resolution.resolved, false);
  assert.equal(resolution.conflicts[0]?.conflictType, "capability_overlap");
  assert.equal(resolution.suggestions.length > 0, true);
});

test("PackSecurityService fails on combined exec capability and bash permission", async () => {
  const service = new PackSecurityService();
  const inlineSource = "exec(userInput)";

  const result = await service.runSecurityScan({
    packId: "pack.exec",
    version: "0.9.0",
    sourceUri: `inline:${inlineSource}`,
    manifestChecksum: sha256(inlineSource),
    capabilities: ["exec"],
    permissions: ["exec:bash"],
  });

  assert.equal(result.status, "failed");
  assert.equal(result.issues.some((issue) => issue.code === "SAND010"), true);
  assert.equal(result.issues.some((issue) => issue.code === "SAND001"), true);
});

test("PackSecurityService scans actual source content from file URIs", async () => {
  const workspace = createTempWorkspace("aa-pack-security-");
  const sourcePath = `${workspace}/pack.js`;
  const sourceCode = "eval(userInput);";
  writeFileSync(sourcePath, sourceCode, "utf8");

  try {
    const service = new PackSecurityService();
    const result = await service.runSecurityScan({
      packId: "pack.file-uri",
      version: "1.2.0",
      sourceUri: pathToFileURL(sourcePath).href,
      manifestChecksum: "a".repeat(64),
      capabilities: ["reporting"],
      permissions: ["read.audit"],
    });

    assert.equal(result.status, "warning");
    assert.equal(result.issues.some((issue) => issue.code === "SAND002"), true);
    assert.equal(result.issues.some((issue) => issue.code === "PKG003"), false);
  } finally {
    cleanupPath(workspace);
  }
});

test("PackSecurityService fails closed when source content is unavailable for static analysis", async () => {
  const service = new PackSecurityService();
  const result = await service.runSecurityScan({
    packId: "pack.remote-uri",
    version: "4.0.0",
    sourceUri: "registry://packs/remote-malware",
    manifestChecksum: "b".repeat(64),
    capabilities: ["reporting"],
    permissions: ["read.audit"],
  });

  assert.equal(result.status, "failed");
  assert.equal(result.issues.some((issue) => issue.code === "PKG003"), true);
});

test("PackSecurityService flags a single dangerous capability", async () => {
  const service = new PackSecurityService();
  const inlineSource = "export const capability = 'exec';";

  const result = await service.runSecurityScan({
    packId: "pack.single-capability",
    version: "1.0.1",
    sourceUri: `inline:${inlineSource}`,
    manifestChecksum: sha256(inlineSource),
    capabilities: ["exec"],
    permissions: ["read.audit"],
  });

  assert.equal(result.issues.some((issue) => issue.code === "CAP001"), true);
});
