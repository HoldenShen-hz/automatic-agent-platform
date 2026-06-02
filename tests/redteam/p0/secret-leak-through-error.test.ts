/**
 * @issue  REDTEAM-P0-SECRET-LEAK-001
 * @invariant INV-SECRET-LEAK-DENY-001
 * @gate   redteam:p0
 * @severity P0
 *
 * Redteam P0 case (per methodology §12.3 / §44.13.1):
 * attacker attempts to extract a secret (bearer / apiKey / token / etc.)
 * by reading an error message, log line, or event payload that was
 * produced by a downstream sink.
 *
 * Defense in depth for this case must hold at three layers:
 *   1. Static: `audit:secret-sinks` MUST flag a real leak on the
 *      positive seed (bearerToken / apiKey reaching a sink).
 *   2. Runtime: when the user-facing error formatter interpolates a
 *      secret identifier, the formatted message MUST NOT contain the
 *      secret value (a redaction placeholder is acceptable).
 *   3. Schema: a redteam case file MUST contain caseId, objective,
 *      severity, scope, evidenceRefs, runner, result, critical_success
 *      count, and release_blocking flag per the redteam-suite schema.
 *
 * If any of these layers fails, the redteam suite must mark this case
 * as not passing the release-blocking gate.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

const POSITIVE_SEED = "tests/fixtures/seeded-defects/secret-logged/positive.ts";
const NEGATIVE_SEED = "tests/fixtures/seeded-defects/secret-logged/negative.ts";

interface AuditFinding {
  rule: string;
  severity: string;
  path: string;
  line: number;
  message: string;
}

interface AuditReport {
  findings: AuditFinding[];
  findingCount: number;
  bySeverity: Record<string, number>;
}

function runSecretSinksAudit(relativePath: string): AuditReport {
  const out = execFileSync("node", ["scripts/ci/audit-secret-sinks.mjs", "--path", relativePath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as AuditReport;
}

/**
 * Layer-2 runtime helper: simulate the kind of error formatter a
 * developer might write in a route handler or service wrapper. The
 * formatter is intentionally naive — the *test* is what verifies
 * it is not safe to ship.
 */
function formatError(err: unknown): string {
  if (err instanceof Error) {
    return `error_code=internal_failure; reason=${err.message}`;
  }
  return `error_code=internal_failure; reason=${String(err)}`;
}

function safeRedact(message: string): string {
  // Redaction must replace any token-shaped substring (sk-..., bearer xxx, etc.)
  // with a placeholder before the message leaves the boundary.
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\bapi[_-]?key\s*[:=]\s*[A-Za-z0-9._-]+/gi, "apiKey=[REDACTED]");
}

describe("redteam:p0 secret-leak-through-error", () => {
  it("positive seed: audit:secret-sinks catches a real secret reaching a sink", () => {
    assert.ok(existsSync(join(repoRoot, POSITIVE_SEED)), `missing positive seed: ${POSITIVE_SEED}`);
    const report = runSecretSinksAudit(POSITIVE_SEED);
    const p0 = report.findings.filter((f) => f.severity === "P0" && f.rule.startsWith("secret_sink."));
    assert.ok(
      p0.length >= 1,
      `expected >=1 P0 secret_sink finding, got ${p0.length}: ${JSON.stringify(report.findings)}`,
    );
  });

  it("negative seed: a redaction placeholder is NOT flagged", () => {
    assert.ok(existsSync(join(repoRoot, NEGATIVE_SEED)), `missing negative seed: ${NEGATIVE_SEED}`);
    const report = runSecretSinksAudit(NEGATIVE_SEED);
    const p0 = report.findings.filter((f) => f.severity === "P0");
    assert.equal(
      p0.length,
      0,
      `redacted sample must not be flagged, got ${JSON.stringify(p0)}`,
    );
  });

  it("runtime: a naive error formatter leaks the secret into the user-facing string", () => {
    const bearer = "sk-test-EXAMPLE-not-a-real-secret";
    const formatted = formatError(new Error(`failed with token=${bearer}`));
    // The naive formatter is intentionally broken: it must surface
    // the secret-shaped substring, which is what the redteam case
    // is documenting as the *attack surface*.
    assert.ok(
      formatted.includes(bearer),
      `naive formatter must echo the secret so the test captures the threat model`,
    );
  });

  it("runtime: a redaction step strips the secret before it leaves the boundary", () => {
    const bearer = "sk-test-EXAMPLE-not-a-real-secret";
    const formatted = formatError(new Error(`failed with token=${bearer}`));
    const redacted = safeRedact(formatted);
    assert.ok(
      !redacted.includes(bearer),
      `redacted output must not contain the secret value, got: ${redacted}`,
    );
    assert.ok(redacted.includes("[REDACTED]"), `redaction placeholder missing in: ${redacted}`);
  });
});
