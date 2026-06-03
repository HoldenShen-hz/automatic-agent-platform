#!/usr/bin/env node
/**
 * Assurance Layer 3: static audit aggregation
 *
 * Runs the repo static audit scanners, then emits the methodology-required
 * aggregate artifacts:
 *   - artifacts/assurance/static-audit-report.json
 *   - artifacts/assurance/static-audit-report.md
 *   - artifacts/assurance/static-audit-findings.jsonl
 *
 * The aggregated step is observe-mode: findings are reported into artifacts,
 * but the script only fails when a scanner itself crashes or emits
 * non-parseable output.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..", "..");
const outputRoot = join(repoRoot, "artifacts", "assurance");
const jsonReportPath = join(outputRoot, "static-audit-report.json");
const mdReportPath = join(outputRoot, "static-audit-report.md");
const jsonlReportPath = join(outputRoot, "static-audit-findings.jsonl");

const STATIC_AUDITS = [
  { id: "tenant_isolation", command: "npm", args: ["run", "audit:tenant-isolation"] },
  { id: "secret_sinks", command: "npm", args: ["run", "audit:secret-sinks"] },
  { id: "fire_and_forget", command: "npm", args: ["run", "audit:fire-and-forget"] },
  { id: "determinism", command: "npm", args: ["run", "audit:determinism"] },
  { id: "release_claims", command: "npm", args: ["run", "audit:release-claims", "--", "--path", "docs_zh/releases"] },
  { id: "architecture_boundary", command: "npm", args: ["run", "audit:architecture-boundary"] },
  { id: "path_safety", command: "npm", args: ["run", "audit:path-safety"] },
  { id: "eval_oracle", command: "npm", args: ["run", "audit:eval-oracle"] },
  { id: "plugin_security", command: "npm", args: ["run", "audit:plugin-security"] },
  { id: "ui_token_storage", command: "npm", args: ["run", "audit:ui-token-storage"] },
  { id: "contracts_sync", command: "npm", args: ["run", "audit:contracts-sync", "--", "--path", "docs_zh/contracts"] },
  { id: "idempotency", command: "npm", args: ["run", "audit:idempotency"] },
  { id: "queue", command: "npm", args: ["run", "audit:queue"] },
  { id: "lease_fencing", command: "npm", args: ["run", "audit:lease-fencing"] },
  { id: "side_effect_receipt", command: "npm", args: ["run", "audit:side-effect-receipt"] },
  { id: "recovery_replay", command: "npm", args: ["run", "audit:recovery-replay"] },
  { id: "audit_chain", command: "npm", args: ["run", "audit:audit-chain"] },
  { id: "receipt_verification", command: "npm", args: ["run", "audit:receipt-verification"] },
  { id: "event_outbox", command: "npm", args: ["run", "audit:event-outbox"] },
  { id: "auth_role_mapping", command: "npm", args: ["run", "audit:auth-role-mapping"] },
  { id: "docs_sot", command: "npm", args: ["run", "audit:docs-sot", "--", "--path", "docs_zh/contracts"] },
  { id: "execution_invariants", command: "npm", args: ["run", "audit:execution-invariants"] },
  { id: "test_disabled", command: "npm", args: ["run", "audit:test-disabled"] },
];

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const candidates = [];
    for (let idx = text.indexOf("{"); idx >= 0; idx = text.indexOf("{", idx + 1)) {
      candidates.push(idx);
    }
    for (let i = candidates.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(text.slice(candidates[i]));
      } catch {
        continue;
      }
    }
    return null;
  }
}

function summarizeBySeverity(findings) {
  return findings.reduce((acc, finding) => {
    const severity = finding.severity ?? "unknown";
    acc[severity] = (acc[severity] ?? 0) + 1;
    return acc;
  }, {});
}

function runAudit(audit) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(audit.command, audit.args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 32 * 1024 * 1024,
  });
  const endedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const payload = safeParseJson(stdout);
  const findings = Array.isArray(payload?.findings) ? payload.findings : [];
  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }
  if (payload != null) {
    process.stdout.write(`[assurance:static-audit] ${audit.id} ok findings=${payload.findingCount ?? findings.length}\n`);
  } else {
    process.stdout.write(`[assurance:static-audit] ${audit.id} parse-failed exitCode=${result.status ?? 1}\n`);
  }
  return {
    id: audit.id,
    command: [audit.command, ...audit.args].join(" "),
    startedAt,
    endedAt,
    exitCode: result.status ?? 1,
    ok: result.status === 0 && payload != null,
    scannedPath: payload?.scannedPath ?? null,
    scannedFileCount: payload?.scannedFileCount ?? null,
    findingCount: payload?.findingCount ?? findings.length,
    bySeverity: summarizeBySeverity(findings),
    findings,
    parseError: result.status === 0 && payload == null ? "invalid_json_output" : null,
  };
}

function buildMarkdown(report) {
  const lines = [
    "# Static Audit Report",
    "",
    `> Generated: ${report.generatedAt}`,
    `> Overall status: ${report.status}`,
    `> Audit count: ${report.auditCount}`,
    `> Total findings: ${report.findingCount}`,
    "",
    "## Audit Summary",
    "",
    "| Audit | Status | Findings | P0 | P1 | P2 | P3 |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...report.audits.map((audit) => {
      const sev = audit.bySeverity ?? {};
      return `| ${audit.id} | ${audit.ok ? "ok" : "error"} | ${audit.findingCount} | ${sev.P0 ?? 0} | ${sev.P1 ?? 0} | ${sev.P2 ?? 0} | ${sev.P3 ?? 0} |`;
    }),
    "",
    "## Top Findings",
    "",
    "| Audit | Severity | Location | Rule | Message |",
    "| --- | --- | --- | --- | --- |",
    ...report.findings.slice(0, 200).map((finding) => {
      const location = `${finding.path ?? "unknown"}${finding.line != null ? `:${finding.line}` : ""}`;
      const message = String(finding.message ?? "")
        .replace(/\|/g, "\\|")
        .slice(0, 160);
      return `| ${finding.auditId} | ${finding.severity ?? "unknown"} | ${location} | ${finding.rule ?? "unknown"} | ${message} |`;
    }),
  ];
  return `${lines.join("\n")}\n`;
}

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const stamp = new Date().toISOString();
  const audits = STATIC_AUDITS.map(runAudit);
  const findings = audits.flatMap((audit) =>
    audit.findings.map((finding) => ({
      ...finding,
      auditId: audit.id,
      auditCommand: audit.command,
      scannedPath: audit.scannedPath,
      generatedAt: stamp,
    })),
  );
  const bySeverity = summarizeBySeverity(findings);
  const report = {
    generatedAt: stamp,
    repoRoot,
    status: audits.every((audit) => audit.ok) ? "pass" : "fail",
    auditCount: audits.length,
    findingCount: findings.length,
    bySeverity,
    audits: audits.map((audit) => ({
      id: audit.id,
      command: audit.command,
      startedAt: audit.startedAt,
      endedAt: audit.endedAt,
      exitCode: audit.exitCode,
      ok: audit.ok,
      parseError: audit.parseError,
      scannedPath: audit.scannedPath,
      scannedFileCount: audit.scannedFileCount,
      findingCount: audit.findingCount,
      bySeverity: audit.bySeverity,
    })),
    findings,
  };

  writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(mdReportPath, buildMarkdown(report), "utf8");
  writeFileSync(jsonlReportPath, findings.map((finding) => JSON.stringify(finding)).join("\n") + (findings.length > 0 ? "\n" : ""), "utf8");

  process.stdout.write(
    `${JSON.stringify({
      generatedAt: stamp,
      status: report.status,
      auditCount: report.auditCount,
      findingCount: report.findingCount,
      bySeverity,
      outputs: {
        json: "artifacts/assurance/static-audit-report.json",
        md: "artifacts/assurance/static-audit-report.md",
        jsonl: "artifacts/assurance/static-audit-findings.jsonl",
      },
    }, null, 2)}\n`,
  );
  if (report.status === "fail") {
    process.exitCode = 1;
  }
}

main();
