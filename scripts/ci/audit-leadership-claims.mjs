import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BLOCKED_TERMS = [
  "industry-leading",
  "benchmark-leading",
  "行业领先",
  "基准领先",
  "production-ready",
  "企业级就绪",
  "best-in-class",
  "state-of-the-art",
  "regulated-ready",
  "fully autonomous",
  "完全自主",
  "全自主",
];

const GOVERNANCE_VOCAB_FILES = new Set([
  "docs_zh/contracts/assurance-pipeline-contract.md",
  "docs_en/contracts/assurance-pipeline-contract.md",
  "docs_zh/contracts/coverage-scorecard-contract.md",
  "docs_en/contracts/coverage-scorecard-contract.md",
  "docs_zh/contracts/release_rollout_and_rollback_contract.md",
  "docs_en/contracts/release_rollout_and_rollback_contract.md",
  "docs_zh/contracts/ring_model_contract.md",
  "docs_en/contracts/ring_model_contract.md",
  "docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md",
  "docs_en/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md",
  "docs_zh/reference/automatic_agent_platform_v3_3_detailed_todolist.md",
  "docs_en/reference/automatic_agent_platform_v3_3_detailed_todolist.md",
  "docs_zh/releases/automatic_agent_platform_v3_3_release_readiness.md",
  "docs_en/releases/automatic_agent_platform_v3_3_release_readiness.md",
  "docs_zh/governance/autonomy_boundary_policy.md",
  "docs_en/governance/autonomy_boundary_policy.md",
  "docs_zh/governance/rollout_release_policy.md",
  "docs_en/governance/rollout_release_policy.md",
  "docs_zh/adr/075-controlled-rollout-release.md",
  "docs_zh/reviews/platforme-full-review-e.md",
]);

const GOVERNANCE_VOCAB_PATTERNS = [
  /\brelease claims?\b/i,
  /\bproduction-ready claim\b/i,
  /\bindustry-leading claims?\b/i,
  /\bmust not\b/i,
  /\bunverified\b/i,
  /\bblocked\b/i,
  /\bextract promises?\b/i,
  /\bwhether\b.*\bclaims?\b/i,
  /\bmode\s*[:=]/i,
  /--mode=production-ready/i,
  /`production-ready`|`industry-leading`|`final`/i,
  /final\/production-ready\/industry-leading/i,
  /done\|accepted\|final\|release-ready\|production-ready\|industry-leading/i,
  /\bnew production-ready claim\b/i,
  /\bput production-ready claim\b/i,
  /\bcarry evidenceref\b/i,
];

const SUPPORTED_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".ts", ".tsx", ".js", ".jsx", ".json"]);

function tokenizeYaml(raw) {
  return raw
    .split(/\r?\n/)
    .map((line, index) => ({ rawLine: line, lineNumber: index + 1 }))
    .filter(({ rawLine }) => rawLine.trim().length > 0 && !rawLine.trimStart().startsWith("#"))
    .map(({ rawLine, lineNumber }) => ({
      indent: rawLine.match(/^ */)?.[0].length ?? 0,
      text: rawLine.trim(),
      lineNumber,
    }));
}

function isYamlArrayItem(text) {
  return text === "-" || text.startsWith("- ");
}

function splitKeyValue(text) {
  const separatorIndex = text.indexOf(":");
  if (separatorIndex <= 0) {
    throw new Error(`audit.leadership_claims.invalid_yaml_mapping:${text}`);
  }
  return [text.slice(0, separatorIndex).trim(), text.slice(separatorIndex + 1).trim()];
}

function looksLikeKeyValue(text) {
  return text.includes(":");
}

function parseScalar(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    return inner.length === 0 ? [] : inner.split(",").map((item) => parseScalar(item.trim()));
  }
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseObject(lines, startIndex, indent) {
  const result = {};
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.indent < indent) break;
    if (line.indent > indent) {
      throw new Error(`audit.leadership_claims.invalid_yaml_indent:${line.lineNumber}`);
    }
    if (line.text.startsWith("- ")) break;
    const [key, inlineValue] = splitKeyValue(line.text);
    index += 1;
    if (inlineValue.length > 0) {
      result[key] = parseScalar(inlineValue);
      continue;
    }
    if (index < lines.length && (lines[index]?.indent ?? -1) > indent) {
      const [nestedValue, nextIndex] = parseBlock(lines, index, indent + 2);
      result[key] = nestedValue;
      index = nextIndex;
      continue;
    }
    result[key] = null;
  }
  return [result, index];
}

function parseArray(lines, startIndex, indent) {
  const result = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.indent < indent) break;
    if (line.indent > indent) {
      throw new Error(`audit.leadership_claims.invalid_yaml_indent:${line.lineNumber}`);
    }
    if (!isYamlArrayItem(line.text)) break;
    const itemText = line.text === "-" ? "" : line.text.slice(2).trim();
    index += 1;
    if (itemText.length === 0) {
      if (index >= lines.length || (lines[index]?.indent ?? -1) <= indent) {
        result.push(null);
        continue;
      }
      const [nestedValue, nextIndex] = parseBlock(lines, index, indent + 2);
      result.push(nestedValue);
      index = nextIndex;
      continue;
    }
    if (looksLikeKeyValue(itemText)) {
      const [key, inlineValue] = splitKeyValue(itemText);
      const objectValue = { [key]: inlineValue.length > 0 ? parseScalar(inlineValue) : null };
      if (index < lines.length && (lines[index]?.indent ?? -1) > indent) {
        const [nestedValue, nextIndex] = parseObject(lines, index, indent + 2);
        Object.assign(objectValue, nestedValue);
        index = nextIndex;
      }
      result.push(objectValue);
      continue;
    }
    result.push(parseScalar(itemText));
  }
  return [result, index];
}

function parseBlock(lines, startIndex, indent) {
  const line = lines[startIndex];
  if (!line || line.indent < indent) return [{}, startIndex];
  if (line.indent !== indent) {
    throw new Error(`audit.leadership_claims.invalid_yaml_indent:${line.lineNumber}`);
  }
  return isYamlArrayItem(line.text)
    ? parseArray(lines, startIndex, indent)
    : parseObject(lines, startIndex, indent);
}

function parseLimitedYaml(raw) {
  const lines = tokenizeYaml(raw);
  if (lines.length === 0) return {};
  return parseBlock(lines, 0, lines[0].indent)[0];
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toObjectArray(value) {
  return Array.isArray(value) ? value.filter((entry) => isPlainObject(entry)) : [];
}

function toStringArray(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string").map((entry) => entry.trim()).filter((entry) => entry.length > 0)
    : [];
}

function loadYamlObject(path) {
  return existsSync(path) ? parseLimitedYaml(readFileSync(path, "utf8")) : {};
}

const ALLOWLIST_SCHEMA_REF = "config/division-coverage/schemas/leadership-claim-allowlist.schema.json";
const CLAIM_LEVELS = new Set(["designed", "pilot_ready", "local_leader", "industry_comparable", "industry_leading"]);
const CLAIM_SURFACES = new Set(["docs", "ui", "release_note", "sales_material", "readme"]);

function normalizeIsoOrNull(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function isExpired(iso, now) {
  return iso != null && Date.parse(iso) < now.getTime();
}

function normalizeForComparison(value) {
  return String(value)
    .toLowerCase()
    .replace(/[“”"'"`]/g, "")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function inferClaimSurface(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const baseName = basename(normalized).toLowerCase();
  if (baseName.startsWith("readme")) {
    return "readme";
  }
  if (normalized.startsWith("ui/")) {
    return "ui";
  }
  if (normalized.includes("/sales/") || baseName.includes("sales")) {
    return "sales_material";
  }
  if (baseName.includes("release") || baseName.includes("changelog")) {
    return "release_note";
  }
  return "docs";
}

function enumerateFiles(rootDir, scanRoots) {
  const files = [];
  const visit = (absolutePath) => {
    if (!existsSync(absolutePath)) {
      return;
    }
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      if (basename(absolutePath) === "node_modules") {
        return;
      }
      for (const child of readdirSync(absolutePath)) {
        visit(join(absolutePath, child));
      }
      return;
    }
    if (stats.isFile() && SUPPORTED_EXTENSIONS.has(extname(absolutePath).toLowerCase())) {
      files.push(absolutePath);
    }
  };

  for (const root of scanRoots) {
    visit(resolve(rootDir, root));
  }
  return files;
}

function buildLineIndex(content, offset) {
  const before = content.slice(0, offset);
  return before.split(/\r?\n/).length;
}

function buildExcerpt(content, offset) {
  const lines = content.split(/\r?\n/);
  const lineNumber = buildLineIndex(content, offset);
  return {
    lineNumber,
    excerpt: lines[lineNumber - 1]?.trim() ?? "",
  };
}

function isGovernanceVocabularyUse(relativePath, excerpt) {
  if (GOVERNANCE_VOCAB_FILES.has(relativePath)) {
    return true;
  }
  return GOVERNANCE_VOCAB_PATTERNS.some((pattern) => pattern.test(excerpt));
}

function assertIsoString(value, code) {
  if (normalizeIsoOrNull(value) == null) {
    throw new Error(`${code}:${String(value ?? "")}`);
  }
}

function validateAllowlistDocument(document) {
  if (!isPlainObject(document)) {
    throw new Error("audit.leadership_claims.invalid_allowlist_document");
  }
  if (document.$schema !== ALLOWLIST_SCHEMA_REF) {
    throw new Error(`audit.leadership_claims.invalid_allowlist_schema_ref:${String(document.$schema ?? "")}`);
  }
  if (!Number.isInteger(document.version) || document.version < 1) {
    throw new Error(`audit.leadership_claims.invalid_allowlist_version:${String(document.version ?? "")}`);
  }
  assertIsoString(document.updatedAt, "audit.leadership_claims.invalid_allowlist_updated_at");
  for (const entry of toObjectArray(document.entries)) {
    if (typeof entry.filePath !== "string" || entry.filePath.trim().length === 0) {
      throw new Error("audit.leadership_claims.invalid_allowlist_file_path");
    }
    if (typeof entry.matchedText !== "string" || entry.matchedText.trim().length === 0) {
      throw new Error(`audit.leadership_claims.invalid_allowlist_matched_text:${entry.filePath}`);
    }
    if (entry.claimLevel != null && !CLAIM_LEVELS.has(entry.claimLevel)) {
      throw new Error(`audit.leadership_claims.invalid_allowlist_claim_level:${entry.filePath}:${entry.claimLevel}`);
    }
    if (entry.surface != null && !CLAIM_SURFACES.has(entry.surface)) {
      throw new Error(`audit.leadership_claims.invalid_allowlist_surface:${entry.filePath}:${entry.surface}`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim().length === 0) {
      throw new Error(`audit.leadership_claims.invalid_allowlist_reason:${entry.filePath}`);
    }
    if (typeof entry.owner !== "string" || entry.owner.trim().length === 0) {
      throw new Error(`audit.leadership_claims.invalid_allowlist_owner:${entry.filePath}`);
    }
    assertIsoString(entry.expiresAt, `audit.leadership_claims.invalid_allowlist_expires_at:${entry.filePath}`);
  }
}

function loadAllowlist(configRoot, now) {
  const allowlist = loadYamlObject(join(configRoot, "claims", "allowlist.yaml"));
  validateAllowlistDocument(allowlist);
  return toObjectArray(allowlist.entries).map((entry) => ({
    filePath: typeof entry.filePath === "string" ? entry.filePath.replace(/\\/g, "/") : "",
    matchedText: typeof entry.matchedText === "string" ? entry.matchedText : "",
    claimLevel: typeof entry.claimLevel === "string" ? entry.claimLevel : null,
    surface: typeof entry.surface === "string" ? entry.surface : null,
    reason: typeof entry.reason === "string" ? entry.reason : "unspecified",
    owner: typeof entry.owner === "string" ? entry.owner : "unassigned-owner",
    expiresAt: normalizeIsoOrNull(entry.expiresAt),
    expired: isExpired(normalizeIsoOrNull(entry.expiresAt), now),
    replacementSuggestion: typeof entry.replacementSuggestion === "string" ? entry.replacementSuggestion : null,
  }));
}

function loadApprovedClaims(configRoot, dataRoot, now) {
  const claims = loadYamlObject(join(configRoot, "claims", "records.yaml"));
  const revokedClaimIds = loadStatusOverrides(dataRoot);
  return toObjectArray(claims.claims)
    .map((claim) => ({
      claimId: typeof claim.claimId === "string" ? claim.claimId : "unknown-claim",
      claimLevel: typeof claim.claimLevel === "string" ? claim.claimLevel : null,
      claimText: typeof claim.claimText === "string" ? claim.claimText : "",
      normalizedClaimText: normalizeForComparison(typeof claim.claimText === "string" ? claim.claimText : ""),
      status: typeof claim.status === "string" ? claim.status : "draft",
      expiresAt: normalizeIsoOrNull(claim.expiresAt),
      allowedSurfaces: toStringArray(claim.allowedSurfaces),
    }))
    .filter((claim) => claim.status === "approved" && !isExpired(claim.expiresAt, now) && !revokedClaimIds.has(claim.claimId));
}

function loadStatusOverrides(dataRoot) {
  const path = join(dataRoot, "governance", "leadership-claim-status-overrides.json");
  if (!existsSync(path)) {
    return new Set();
  }
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return new Set(
    toObjectArray(parsed)
      .filter((entry) => entry.status === "revoked" && typeof entry.claimId === "string")
      .map((entry) => entry.claimId),
  );
}

function inferClaimLevelFromTerm(term) {
  if (term === "industry-leading" || term === "行业领先" || term === "benchmark-leading" || term === "基准领先") {
    return "industry_leading";
  }
  if (term === "production-ready" || term === "企业级就绪") {
    return "industry_comparable";
  }
  return null;
}

function resolveMatchDisposition(relativePath, matchedText, surface, content, allowlistEntries, approvedClaims) {
  const inferredClaimLevel = inferClaimLevelFromTerm(matchedText);
  const allowlistEntry = allowlistEntries.find((entry) => (
    entry.filePath === relativePath
    && entry.matchedText === matchedText
    && (entry.surface == null || entry.surface === surface)
    && (entry.claimLevel == null || entry.claimLevel === inferredClaimLevel)
  ));
  if (allowlistEntry != null) {
    return allowlistEntry.expired
      ? { status: "expired_allowlist", claimId: null, reason: allowlistEntry.replacementSuggestion ?? allowlistEntry.reason }
      : { status: "allowlisted", claimId: null, reason: allowlistEntry.reason };
  }

  const normalizedContent = normalizeForComparison(content);
  const approvedClaim = approvedClaims.find((claim) => (
    claim.allowedSurfaces.includes(surface)
    && claim.normalizedClaimText.length > 0
    && normalizedContent.includes(claim.normalizedClaimText)
    && (inferredClaimLevel == null || claim.claimLevel == null || claim.claimLevel === inferredClaimLevel)
  ));
  if (approvedClaim != null) {
    return { status: "approved_claim", claimId: approvedClaim.claimId, reason: "approved_claim_text" };
  }

  return { status: "blocked", claimId: null, reason: null };
}

export function buildLeadershipClaimScanReport(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const configRoot = resolve(options.configRoot ?? join(rootDir, "config", "division-coverage"));
  const dataRoot = resolve(options.dataRoot ?? join(rootDir, "data"));
  const scanRoots = options.scanRoots ?? ["README.md", "docs_zh", "docs_en", "ui", "release_notes", "marketing", "sales"];
  const now = options.now instanceof Date ? options.now : new Date();
  const schemaPath = join(configRoot, "schemas", "leadership-claim.schema.json");
  const schema = existsSync(schemaPath) ? JSON.parse(readFileSync(schemaPath, "utf8")) : {};
  const allowlistEntries = loadAllowlist(configRoot, now);
  const approvedClaims = loadApprovedClaims(configRoot, dataRoot, now);
  const hits = [];

  for (const absolutePath of enumerateFiles(rootDir, scanRoots)) {
    const relativePath = relative(rootDir, absolutePath).replace(/\\/g, "/");
    const content = readFileSync(absolutePath, "utf8");
    for (const term of BLOCKED_TERMS) {
      const regex = /[A-Za-z-]/.test(term)
        ? new RegExp(escapeRegExp(term), "gi")
        : new RegExp(escapeRegExp(term), "g");
      for (const match of content.matchAll(regex)) {
        const offset = match.index ?? 0;
        const { lineNumber, excerpt } = buildExcerpt(content, offset);
        if (isGovernanceVocabularyUse(relativePath, excerpt)) {
          continue;
        }
        const surface = inferClaimSurface(relativePath);
        const disposition = resolveMatchDisposition(relativePath, term, surface, content, allowlistEntries, approvedClaims);
        hits.push({
          filePath: relativePath,
          matchedText: term,
          lineNumber,
          excerpt,
          surface,
          status: disposition.status,
          claimId: disposition.claimId,
          reason: disposition.reason,
        });
      }
    }
  }

  const report = {
    generatedAt: now.toISOString(),
    blockedTerms: BLOCKED_TERMS,
    schemaId: typeof schema.$id === "string" ? schema.$id : null,
    hits: hits.sort((left, right) => left.filePath.localeCompare(right.filePath) || left.lineNumber - right.lineNumber),
    summary: {
      blockedCount: hits.filter((hit) => hit.status === "blocked" || hit.status === "expired_allowlist").length,
      allowlistedCount: hits.filter((hit) => hit.status === "allowlisted").length,
      approvedClaimCount: hits.filter((hit) => hit.status === "approved_claim").length,
      scannedRootCount: scanRoots.length,
    },
  };

  const reportDir = join(dataRoot, "governance");
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, "leadership-claim-scan-report.json"), JSON.stringify(report, null, 2), "utf8");
  return report;
}

export function runLeadershipClaimAudit(options = {}) {
  const report = buildLeadershipClaimScanReport(options);
  const failed = report.hits.some((hit) => hit.status === "blocked" || hit.status === "expired_allowlist");
  return { report, failed };
}

function parseCliOptions(argv) {
  const options = {};
  for (const arg of argv) {
    if (arg.startsWith("--roots=")) {
      const roots = arg.slice("--roots=".length).split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
      options.scanRoots = roots;
    } else if (arg.startsWith("--root-dir=")) {
      options.rootDir = arg.slice("--root-dir=".length);
    } else if (arg.startsWith("--config-root=")) {
      options.configRoot = arg.slice("--config-root=".length);
    } else if (arg.startsWith("--data-root=")) {
      options.dataRoot = arg.slice("--data-root=".length);
    }
  }
  return options;
}

const isEntrypoint = process.argv[1] != null && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isEntrypoint) {
  const { report, failed } = runLeadershipClaimAudit(parseCliOptions(process.argv.slice(2)));
  if (failed) {
    console.error("[audit:leadership-claims] blocked or expired claim language detected");
    for (const hit of report.hits.filter((entry) => entry.status === "blocked" || entry.status === "expired_allowlist")) {
      console.error(` - ${hit.status} ${hit.filePath}:${hit.lineNumber} ${hit.matchedText}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`[audit:leadership-claims] ok (${report.summary.allowlistedCount} allowlisted hits, ${report.summary.approvedClaimCount} approved claim hits)`);
  }
}
