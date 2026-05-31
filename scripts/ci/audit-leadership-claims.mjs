import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BLOCKED_TERMS = [
  "industry-leading",
  "行业领先",
  "production-ready",
  "企业级就绪",
  "best-in-class",
  "state-of-the-art",
  "regulated-ready",
  "fully autonomous",
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function inferClaimSurface(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("ui/")) {
    return "ui";
  }
  const baseName = basename(normalized).toLowerCase();
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

function loadAllowlist(configRoot, now) {
  const allowlist = loadYamlObject(join(configRoot, "claims", "allowlist.yaml"));
  return toObjectArray(allowlist.entries).map((entry) => ({
    filePath: typeof entry.filePath === "string" ? entry.filePath.replace(/\\/g, "/") : "",
    matchedText: typeof entry.matchedText === "string" ? entry.matchedText : "",
    reason: typeof entry.reason === "string" ? entry.reason : "unspecified",
    owner: typeof entry.owner === "string" ? entry.owner : "unassigned-owner",
    expiresAt: normalizeIsoOrNull(entry.expiresAt),
    expired: isExpired(normalizeIsoOrNull(entry.expiresAt), now),
  }));
}

function loadApprovedClaims(configRoot, now) {
  const claims = loadYamlObject(join(configRoot, "claims", "records.yaml"));
  return toObjectArray(claims.claims)
    .map((claim) => ({
      claimId: typeof claim.claimId === "string" ? claim.claimId : "unknown-claim",
      claimText: typeof claim.claimText === "string" ? claim.claimText : "",
      status: typeof claim.status === "string" ? claim.status : "draft",
      expiresAt: normalizeIsoOrNull(claim.expiresAt),
      allowedSurfaces: toStringArray(claim.allowedSurfaces),
    }))
    .filter((claim) => claim.status === "approved" && !isExpired(claim.expiresAt, now));
}

function resolveMatchDisposition(relativePath, matchedText, surface, content, allowlistEntries, approvedClaims) {
  const allowlistEntry = allowlistEntries.find((entry) => entry.filePath === relativePath && entry.matchedText === matchedText);
  if (allowlistEntry != null) {
    return allowlistEntry.expired
      ? { status: "expired_allowlist", claimId: null, reason: allowlistEntry.reason }
      : { status: "allowlisted", claimId: null, reason: allowlistEntry.reason };
  }

  const approvedClaim = approvedClaims.find((claim) => claim.allowedSurfaces.includes(surface) && claim.claimText.length > 0 && content.includes(claim.claimText));
  if (approvedClaim != null) {
    return { status: "approved_claim", claimId: approvedClaim.claimId, reason: "approved_claim_text" };
  }

  return { status: "blocked", claimId: null, reason: null };
}

export function buildLeadershipClaimScanReport(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const configRoot = resolve(options.configRoot ?? join(rootDir, "config", "division-coverage"));
  const dataRoot = resolve(options.dataRoot ?? join(rootDir, "data"));
  const scanRoots = options.scanRoots ?? ["README.md", "docs_zh", "docs_en", "ui"];
  const now = options.now instanceof Date ? options.now : new Date();
  const schemaPath = join(configRoot, "schemas", "leadership-claim.schema.json");
  const schema = existsSync(schemaPath) ? JSON.parse(readFileSync(schemaPath, "utf8")) : {};
  const allowlistEntries = loadAllowlist(configRoot, now);
  const approvedClaims = loadApprovedClaims(configRoot, now);
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

const isEntrypoint = process.argv[1] != null && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isEntrypoint) {
  const { report, failed } = runLeadershipClaimAudit();
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
