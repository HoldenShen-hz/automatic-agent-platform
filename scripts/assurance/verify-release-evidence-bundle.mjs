#!/usr/bin/env node
/**
 * Evidence bundle verifier
 *
 * Re-derives the HMAC-SHA256 signature of artifacts/release/evidence-bundle.json
 * and compares it with artifacts/release/evidence-bundle.sig.
 *
 * Per docs_zh/contracts/assurance-pipeline-contract.md §5.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const bundlePath = join(repoRoot, "artifacts", "release", "evidence-bundle.json");
const sigPath = join(repoRoot, "artifacts", "release", "evidence-bundle.sig");

function hmacSha256(key, data) {
  return createHmac("sha256", key).update(data).digest("hex");
}

function getReleaseSigningKey() {
  const key = process.env.AA_RELEASE_SIGNING_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function main() {
  if (!existsSync(bundlePath)) {
    process.stderr.write(`error: bundle not found at ${bundlePath}\n`);
    process.exitCode = 1;
    return;
  }
  if (!existsSync(sigPath)) {
    process.stderr.write(`error: signature not found at ${sigPath}\n`);
    process.exitCode = 1;
    return;
  }
  const bundle = readFileSync(bundlePath, "utf8").replace(/\n$/, "");
  const sigLine = readFileSync(sigPath, "utf8").trim();
  const expectedSig = sigLine.split(/\s+/)[0];
  const key = getReleaseSigningKey();
  if (key == null) {
    process.stderr.write("error: AA_RELEASE_SIGNING_KEY is required to verify the release evidence bundle\n");
    process.exitCode = 1;
    return;
  }
  const computed = hmacSha256(key, bundle);
  const match =
    expectedSig.length === computed.length &&
    timingSafeEqual(Buffer.from(expectedSig, "utf8"), Buffer.from(computed, "utf8"));

  // Cross-check report sha256s
  const parsed = JSON.parse(bundle);
  const reportCheck = (parsed.includedReports ?? []).map((r) => {
    if (!r.present) return { path: r.path, present: false };
    const current = createHash("sha256").update(readFileSync(join(repoRoot, r.path))).digest("hex");
    return { path: r.path, present: true, shaMatches: current === r.sha256 };
  });

  const summary = {
    bundlePath,
    sigPath,
    sigValid: match,
    includedReports: reportCheck.length,
    reportIntegrityFailures: reportCheck.filter((r) => r.present && !r.shaMatches).map((r) => r.path),
    missingReports: reportCheck.filter((r) => !r.present).map((r) => r.path),
    signingKeyConfigured: true,
    status:
      match &&
      reportCheck.length > 0 &&
      reportCheck.every((r) => r.present && r.shaMatches)
        ? "pass"
        : "fail",
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status !== "pass") {
    process.exitCode = 1;
  }
}

main();
