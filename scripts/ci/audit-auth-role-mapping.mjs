#!/usr/bin/env node
/**
 * Audit: auth / RBAC / approval role-mapping
 *
 * Scans src/ for service-principal / default role / break-glass / approval
 * patterns derived from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §9.3
 * and the issue ledger entry "service principal → admin".
 *
 * Heuristics (§9.3 full coverage, 9 axes):
 *   1. servicePrincipal role mapping
 *   2. operator check
 *   3. break-glass
 *   4. HITL approval
 *   5. multi-party approval
 *   6. delegate vote dedupe
 *   7. no-go policy
 *   8. high-risk action list
 *   9. manual takeover
 *
 * Plus the no-go / high-risk action registry at
 * `config/quality/no-go-policy.json`.
 *
 * Allowlist: `config/quality/auth-role-mapping-allowlist.json` with shape:
 *   { "exact": ["src/foo/bar.ts"], "prefix": ["src/legacy/"], "snippets": [] }
 *
 * Output: JSON `findings[]`.
 * Exit code: 1 with --check if any P0 finding.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "src";
})();

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  "artifacts",
  "build",
  ".tmp",
  ".test-db",
  ".cache",
]);
const ALLOWLIST_PATH = "config/quality/auth-role-mapping-allowlist.json";
const NO_GO_POLICY_PATH = "config/quality/no-go-policy.json";

const RULES = [
  // 1. service principal role mapping - assigning admin to a service principal
  //    or putting admin in a default roles list.
  {
    rule: "auth_role.service_principal_default_admin",
    severity: "P0",
    description:
      "servicePrincipal.roles contains 'admin' or defaultRoles: ['admin'] (P0 per §9.3).",
    regex:
      /(?:servicePrincipal|principal|sp|this|p)\s*[\.\[]\s*(?:roles|role)[\s\S]{0,80}?(?:includes|push|add|concat)\s*\(\s*["']admin["']\s*\)/,
  },
  {
    rule: "auth_role.default_roles_admin",
    severity: "P0",
    description: "defaultRoles / roleDefaults explicitly contains 'admin'.",
    regex:
      /(?:defaultRoles|roleDefaults|defaultAuthorizations|defaultPolicies)[\s:=[A-Z\[\]<>a-z]*\[[^\]]*["']admin["']/,
  },
  // 2. Route handler that hard-codes admin into a default role list.
  {
    rule: "auth_role.route_default_admin",
    severity: "P0",
    description: "Route handler pushes 'admin' into a default role list.",
    regex: /app\s*\.\s*(get|post|put|delete|patch)[\s\S]{0,400}?(?:roles|role|defaultRoles)\s*[:=][\s\S]{0,200}?["']admin["']/,
  },
  // 3. Single-approver without multi-party marker.
  {
    rule: "auth_role.single_approver_no_multiparty",
    severity: "P1",
    description:
      "singleApprover / single-approver flow without multi-party / multiParty marker (P1 per §9.3).",
    regex: /\b(?:singleApprover|single_approver|singleSigner)\b(?![^\n]{0,200}?(multi[Ss]igner|multi[Ss]ign|multiParty|multi_party|quorum))/,
  },
  // 4. breakGlass / emergency-bypass without audit log.
  {
    rule: "auth_role.break_glass_no_audit",
    severity: "P0",
    description:
      "breakGlass() / emergency-bypass path that does not write to an audit log (P0 per §9.3).",
    regex: /\b(?:breakGlass|emergencyBypass|bypassApproval|emergencyOverride)\s*\(/,
  },
  // 5. Operator check missing on a route that dispatches a high-risk action.
  //    Per §9.3: high-risk action must be guarded by an operator identity
  //    check (operatorCheck / operatorContext / operatorId / operatorRole).
  {
    rule: "auth_role.operator_check_missing",
    severity: "P0",
    description:
      "Route handler dispatches a high-risk action without an operator check (P0 per §9.3 / Dataflow 1).",
    regex: /\b(?:externalToolCall|commitSideEffect|publishEvent|settleReceipt|transferFunds|executeMission)\b/,
  },
  // 6. HITL approval bypass: a high-risk action is dispatched in a
  //    request handler that does NOT call hitlApprove / requireHitl /
  //    requestHumanApproval in the same scope.
  {
    rule: "auth_role.hitl_approval_bypass",
    severity: "P0",
    description:
      "High-risk action handler does not invoke hitlApprove / requireHitl / requestHumanApproval (P0 per §9.3).",
    regex: /\b(?:externalToolCall|commitSideEffect|publishEvent|settleReceipt|transferFunds|executeMission)\b(?![^\n]{0,300}?(?:hitlApprove|requireHitl|requestHumanApproval|hitl\.approve|approvalCenter\.request))/,
  },
  // 7. Delegate vote path without a dedupe key. Per §9.3, a delegated
  //    vote must carry a dedupeKey to prevent double-counting.
  {
    rule: "auth_role.delegate_vote_no_dedupe",
    severity: "P0",
    description:
      "Delegate-vote / castVote / recordVote path does not carry a dedupeKey (P0 per §9.3).",
    regex: /\b(?:delegateVote|castVote|recordVote|delegateCastVote)\s*\([^)]*\)(?![^\n]{0,300}?(?:dedupeKey|dedupe_key|deduplicationKey))/,
  },
  // 8. Manual-takeover / human-takeover path that does not write an
  //    audit record (P0 per §9.3 "manual takeover").
  {
    rule: "auth_role.manual_takeover_no_audit",
    severity: "P0",
    description:
      "manualTakeover / humanTakeover path does not write to an audit log (P0 per §9.3).",
    regex: /\b(?:manualTakeover|humanTakeover|takeover\.start|takeover\.activate)\b/,
  },
];

const AUDIT_CALL_HINTS = [
  /\baudit\s*\.\s*(?:record|write|append|emit|log)\b/,
  /\bauditLog\s*\.\s*(?:record|write|append|emit|log)\b/,
  /\bsecurityAudit\s*\.\s*(?:record|write|append|emit|log)\b/,
];

const OPERATOR_CHECK_HINTS = [
  /\boperatorCheck\b/,
  /\boperatorContext\b/,
  /\boperatorId\b/,
  /\boperatorRole\b/,
  /\brequireOperator\b/,
  /\bassertOperator\b/,
];

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { exact: new Set(), prefix: [], snippets: [] };
  }
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  return {
    exact: new Set(Array.isArray(raw.exact) ? raw.exact : []),
    prefix: Array.isArray(raw.prefix) ? raw.prefix : [],
    snippets: Array.isArray(raw.snippets) ? raw.snippets : [],
  };
}

function loadNoGoPolicy() {
  if (!existsSync(NO_GO_POLICY_PATH)) {
    return { noGo: new Set(), highRisk: new Set(), raw: null };
  }
  const raw = JSON.parse(readFileSync(NO_GO_POLICY_PATH, "utf8"));
  return {
    noGo: new Set(Array.isArray(raw.noGoActions) ? raw.noGoActions : []),
    highRisk: new Set(Array.isArray(raw.highRiskActions) ? raw.highRiskActions : []),
    raw,
  };
}

function isAllowlisted(rel, allowlist) {
  if (allowlist.exact.has(rel)) return true;
  return allowlist.prefix.some((p) => rel.startsWith(p));
}

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && SCAN_EXTS.has(extname(entry.name))) {
        out.push(full);
      }
    }
  }
  return out;
}

function isCommentLine(line) {
  return /^\s*(\/\/|[*\/])/.test(line);
}

function buildDynamicNoGoRegex(noGo) {
  if (!noGo || noGo.size === 0) return null;
  const alts = Array.from(noGo)
    .filter((s) => typeof s === "string" && s.length > 0)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  if (!alts) return null;
  return new RegExp(`["'\\b](${alts})["'\\b]`);
}

function findFindings(filePath, allowlist, noGoPolicy) {
  const rel = relative(repoRoot, filePath);
  if (isAllowlisted(rel, allowlist)) return [];
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;

    for (const r of RULES) {
      r.regex.lastIndex = 0;
      if (!r.regex.test(line)) continue;
      // break-glass needs an audit-call window check.
      if (r.rule === "auth_role.break_glass_no_audit") {
        const window = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 30)).join("\n");
        if (AUDIT_CALL_HINTS.some((re) => re.test(window))) continue;
      }
      // operator_check_missing: a high-risk action name appears
      // but the file-level scope lacks an operator-check identifier.
      // Strip comments so docs text containing "operatorId" etc. do
      // not silence the rule.
      if (r.rule === "auth_role.operator_check_missing") {
        const fileScope = lines.filter((l) => !isCommentLine(l)).join("\n");
        if (OPERATOR_CHECK_HINTS.some((re) => re.test(fileScope))) continue;
      }
      // hitl_approval_bypass: the high-risk action must be near a
      // hitl-approval call.
      if (r.rule === "auth_role.hitl_approval_bypass") {
        const window = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 30)).join("\n");
        if (/\b(?:hitlApprove|requireHitl|requestHumanApproval|hitl\.approve|approvalCenter\.request)\b/.test(window)) continue;
      }
      // delegate_vote_no_dedupe: already enforced by the negative
      // lookahead in the regex.
      // manual_takeover_no_audit: same audit-window check as
      // break_glass.
      if (r.rule === "auth_role.manual_takeover_no_audit") {
        const window = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 30)).join("\n");
        if (AUDIT_CALL_HINTS.some((re) => re.test(window))) continue;
      }
      findings.push({
        rule: r.rule,
        severity: r.severity,
        path: rel,
        line: i + 1,
        message: r.description,
        snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
      });
      r.regex.lastIndex = 0;
    }
  }

  // 7. no-go policy: any no-go action referenced as a permitted /
  //    allowed action inside the file (string literal or identifier
  //    used in an `ALLOWED_*` set / `if (isAllowed(...))` branch) is
  //    a P0 violation.
  if (noGoPolicy && noGoPolicy.noGo.size > 0) {
    const noGoRegex = buildDynamicNoGoRegex(noGoPolicy.noGo);
    if (noGoRegex) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isCommentLine(line)) continue;
        if (!noGoRegex.test(line)) continue;
        // Only flag lines that look like a permission grant:
        //   - included in an ALLOWED / ALLOW / allowedNames list
        //   - used as a value in an `isAllowed` / `isPermitted` /
        //     `ALLOW_ACTIONS` constant
        //   - returned by a `dispatch` / `allow` function
        const looksLikeAllowGrant =
          /\bALLOWED\b/i.test(line) ||
          /\bALLOW(?:ED)?_ACTIONS\b/.test(line) ||
          /\bisAllowed\b/.test(line) ||
          /\bisPermitted\b/.test(line) ||
          /\ballowlist\b/i.test(line) ||
          /\ballow\s*[:=]/i.test(line) ||
          /\bdispatch\w*\s*\(/.test(line) ||
          /\bcase\s+["']/.test(line) ||
          /["']\w+["']\s*[,)]/.test(line);
        if (!looksLikeAllowGrant) continue;
        findings.push({
          rule: "auth_role.no_go_policy_violation",
          severity: "P0",
          path: rel,
          line: i + 1,
          message:
            "Action listed in config/quality/no-go-policy.json::noGoActions is permitted by a route handler (P0 per §9.3).",
          snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
        });
      }
    }
  }

  // 8. high-risk action unlisted: any high-risk action name in the
  //    policy file that is dispatched from a route handler without
  //    a corresponding operator check is reported as P1.
  if (noGoPolicy && noGoPolicy.highRisk.size > 0) {
    const codeLines = lines.filter((l) => !isCommentLine(l));
    const text2 = codeLines.join("\n");
    const used = new Set();
    for (const name of noGoPolicy.highRisk) {
      const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${safe}\\b`).test(text2)) {
        used.add(name);
      }
    }
    if (used.size > 0) {
      const hasOperator = OPERATOR_CHECK_HINTS.some((re) => re.test(text2));
      if (!hasOperator) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (isCommentLine(line)) continue;
          for (const name of used) {
            const nameRe = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
            if (nameRe.test(line)) {
              findings.push({
                rule: "auth_role.high_risk_action_unlisted",
                severity: "P1",
                path: rel,
                line: i + 1,
                message: `High-risk action "${name}" is dispatched without an operator check (P1 per §9.3).`,
                snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
              });
              break;
            }
          }
          break;
        }
      }
    }
  }

  return findings;
}

function main() {
  const focusAbs = resolve(repoRoot, focusPath);
  let stat;
  try {
    stat = statSync(focusAbs);
  } catch {
    console.error(JSON.stringify({ error: `path not found: ${focusPath}` }));
    process.exitCode = 2;
    return;
  }
  const allowlist = loadAllowlist();
  const noGoPolicy = loadNoGoPolicy();
  const files = stat.isDirectory()
    ? walk(focusAbs)
    : [focusAbs].filter((f) => SCAN_EXTS.has(extname(f)));
  const findings = [];
  for (const file of files) {
    findings.push(...findFindings(file, allowlist, noGoPolicy));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: focusPath,
    scannedFileCount: files.length,
    findingCount: findings.length,
    bySeverity: findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {}),
    findings,
  };
  console.log(JSON.stringify(report, null, 2));
  if (checkMode && findings.some((f) => f.severity === "P0")) {
    process.exitCode = 1;
  }
}

main();
