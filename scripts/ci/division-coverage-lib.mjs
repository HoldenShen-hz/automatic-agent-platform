import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const P0_DIVISION_IDS = Object.freeze([
  "coding",
  "knowledge-base",
  "research",
  "customer-service",
  "support",
]);

export const CANONICAL_FAMILY_IDS = Object.freeze([
  "engineering",
  "knowledge-research",
  "enterprise-ops",
  "gtm-content",
  "creative-production",
  "regulated",
]);

export const DIVISION_STATUS_ENUM = Object.freeze([
  "untracked",
  "coverage_draft",
  "pilot_ready",
  "pilot_active",
  "production_candidate",
  "production_ready",
  "deprecated",
  "archived",
]);

export const RISK_LEVEL_ENUM = Object.freeze([
  "low",
  "medium",
  "high",
  "critical",
]);

export const AUTONOMY_BOUNDARY_ENUM = Object.freeze([
  "read_only",
  "draft_only",
  "hitl_required",
  "prepared_action_only",
  "no_autonomous_high_impact_action",
]);

export const BLOCKER_CODES = Object.freeze([
  "missing_division_yaml",
  "missing_source_module",
  "missing_owner",
  "missing_coverage_card",
  "missing_scenario_card",
  "missing_eval",
  "missing_redteam",
  "missing_training_policy",
  "missing_family_policy",
  "alias_only_division",
  "unknown_family",
  "production_ready_without_evidence",
  "production_ready_without_claim_record",
  "r3plus_without_hitl",
  "expired_eval",
  "expired_redteam",
]);

export const DEFAULT_ALIAS_ENTRIES = Object.freeze([
  { alias: "qa", canonical: "quality-assurance", mode: "deprecated_alias", removalTargetVersion: "v3.5" },
  { alias: "game-dev", canonical: "gaming", mode: "legacy_external", removalTargetVersion: "v3.6" },
  { alias: "livestream", canonical: "live-streaming", mode: "deprecated_alias", removalTargetVersion: "v3.5" },
  { alias: "it-ops", canonical: "it-operations", mode: "deprecated_alias", removalTargetVersion: "v3.5" },
  { alias: "finance-accounting", canonical: "financial-services", mode: "family_rollup_only", removalTargetVersion: "v3.6" },
  { alias: "research", canonical: "industry-research", mode: "ambiguous_alias", removalTargetVersion: "v3.6" },
]);

export function resolvePlatformRoot(platformRoot = process.cwd()) {
  return resolve(platformRoot);
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function readJsonFile(path, fallback = null) {
  if (!existsSync(path)) {
    return fallback;
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJsonFile(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(sortValue(value), null, 2)}\n`);
}

export function writeTextFile(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, value.endsWith("\n") ? value : `${value}\n`);
}

export function tokenizeYaml(raw) {
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

function splitKeyValue(text, sourcePath, lineNumber) {
  const separatorIndex = text.indexOf(":");
  if (separatorIndex <= 0) {
    throw new Error(`division_coverage.invalid_yaml_mapping:${sourcePath}:${lineNumber}:${text}`);
  }
  return [text.slice(0, separatorIndex).trim(), text.slice(separatorIndex + 1).trim()];
}

function looksLikeKeyValue(text) {
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    return false;
  }
  return text.includes(":");
}

function parseScalar(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    return inner.length === 0 ? [] : inner.split(",").map((item) => parseScalar(item.trim()));
  }
  return raw;
}

function parseObject(lines, startIndex, indent, sourcePath) {
  const result = {};
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.indent < indent) {
      break;
    }
    if (line.indent > indent) {
      throw new Error(`division_coverage.invalid_yaml_indent:${sourcePath}:${line.lineNumber}`);
    }
    if (line.text.startsWith("- ")) {
      break;
    }
    const [key, inlineValue] = splitKeyValue(line.text, sourcePath, line.lineNumber);
    index += 1;
    if (inlineValue.length > 0) {
      result[key] = parseScalar(inlineValue);
      continue;
    }
    if (index < lines.length && (lines[index]?.indent ?? -1) > indent) {
      const [nestedValue, nextIndex] = parseBlock(lines, index, indent + 2, sourcePath);
      result[key] = nestedValue;
      index = nextIndex;
      continue;
    }
    result[key] = null;
  }
  return [result, index];
}

function parseArray(lines, startIndex, indent, sourcePath) {
  const result = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.indent < indent) {
      break;
    }
    if (line.indent > indent) {
      throw new Error(`division_coverage.invalid_yaml_indent:${sourcePath}:${line.lineNumber}`);
    }
    if (!isYamlArrayItem(line.text)) {
      break;
    }
    const itemText = line.text === "-" ? "" : line.text.slice(2).trim();
    index += 1;
    if (itemText.length === 0) {
      if (index >= lines.length || (lines[index]?.indent ?? -1) <= indent) {
        result.push(null);
        continue;
      }
      const [nestedValue, nextIndex] = parseBlock(lines, index, indent + 2, sourcePath);
      result.push(nestedValue);
      index = nextIndex;
      continue;
    }
    if (looksLikeKeyValue(itemText)) {
      const [key, inlineValue] = splitKeyValue(itemText, sourcePath, line.lineNumber);
      const objectValue = { [key]: inlineValue.length > 0 ? parseScalar(inlineValue) : null };
      if (index < lines.length && (lines[index]?.indent ?? -1) > indent) {
        const [nestedValue, nextIndex] = parseObject(lines, index, indent + 2, sourcePath);
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

function parseBlock(lines, startIndex, indent, sourcePath) {
  const line = lines[startIndex];
  if (!line || line.indent < indent) {
    return [{}, startIndex];
  }
  if (line.indent !== indent) {
    throw new Error(`division_coverage.invalid_yaml_indent:${sourcePath}:${line.lineNumber}`);
  }
  return isYamlArrayItem(line.text)
    ? parseArray(lines, startIndex, indent, sourcePath)
    : parseObject(lines, startIndex, indent, sourcePath);
}

export function parseLimitedYaml(raw, sourcePath = "<inline>") {
  const lines = tokenizeYaml(raw);
  if (lines.length === 0) {
    return {};
  }
  return parseBlock(lines, 0, lines[0].indent, sourcePath)[0];
}

export function loadYamlObject(path) {
  if (!existsSync(path)) {
    return {};
  }
  const parsed = parseLimitedYaml(readFileSync(path, "utf8"), path);
  return isPlainObject(parsed) ? parsed : {};
}

export function writeYamlFile(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${stringifyYaml(sortValue(value))}\n`);
}

export function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function toObjectArray(value) {
  return Array.isArray(value) ? value.filter((entry) => isPlainObject(entry)) : [];
}

export function toStringArray(value) {
  return Array.isArray(value)
    ? value
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
    : [];
}

export function listFiles(root, maxDepth = 3) {
  const output = [];
  const visit = (current, depth) => {
    if (!existsSync(current) || depth > maxDepth) {
      return;
    }
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute, depth + 1);
        continue;
      }
      if (entry.isFile()) {
        output.push(absolute);
      }
    }
  };
  visit(root, 0);
  return output.sort((left, right) => left.localeCompare(right));
}

export function relativeToRoot(platformRoot, absolutePath) {
  return relative(platformRoot, absolutePath).replace(/\\/g, "/");
}

export function parseCliArgs(argv) {
  const flags = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const [key, rawValue] = arg.slice(2).split("=", 2);
    flags[key] = rawValue ?? "true";
  }
  return flags;
}

export function toIsoDate(value = new Date()) {
  return new Date(value).toISOString();
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveCoverageFamilyId(divisionId, legacyFamily = null) {
  const normalizedDivisionId = slugify(divisionId);
  const family = slugify(legacyFamily ?? "");
  if ([
    "coding",
    "devops",
    "security",
    "quality-assurance",
    "qa",
    "engineering-ops",
    "engineering_ops",
    "data-engineering",
  ].includes(normalizedDivisionId) || ["engineering", "quality", "security", "data"].includes(family)) {
    return "engineering";
  }
  if ([
    "knowledge-base",
    "research",
    "academic-research",
    "industry-research",
    "analytics",
  ].includes(normalizedDivisionId) || ["knowledge", "research", "analytics"].includes(family)) {
    return "knowledge-research";
  }
  if ([
    "customer-service",
    "support",
    "user-operations",
    "operations",
    "general-ops",
    "general_ops",
    "it-operations",
    "project-management",
  ].includes(normalizedDivisionId) || ["customer-ops", "operations", "delivery"].includes(family)) {
    return "enterprise-ops";
  }
  if ([
    "advertising",
    "ecommerce",
    "product-management",
  ].includes(normalizedDivisionId) || ["growth", "commerce"].includes(family)) {
    return "gtm-content";
  }
  if ([
    "content",
    "design",
    "live-streaming",
    "content-moderation",
  ].includes(normalizedDivisionId) || ["content", "product", "media", "safety"].includes(family)) {
    return "creative-production";
  }
  if ([
    "finance-accounting",
    "financial-services",
    "healthcare",
    "human-resources",
    "legal",
    "quant-trading",
  ].includes(normalizedDivisionId) || ["finance", "healthcare", "legal", "people"].includes(family)) {
    return "regulated";
  }
  return null;
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortValue(entry)]),
  );
}

function formatScalar(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value !== "string") return JSON.stringify(value);
  if (/^[A-Za-z0-9._/@-]+$/.test(value) && !["true", "false", "null"].includes(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function stringifyYaml(value, indent = 0) {
  const prefix = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    return value
      .map((entry) => {
        if (isPlainObject(entry) || Array.isArray(entry)) {
          const nested = stringifyYaml(entry, indent + 2);
          if (nested.includes("\n")) {
            return `${prefix}-\n${nested}`;
          }
          return `${prefix}- ${nested}`;
        }
        return `${prefix}- ${formatScalar(entry)}`;
      })
      .join("\n");
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "{}";
    }
    return entries
      .map(([key, entry]) => {
        if (isPlainObject(entry) || Array.isArray(entry)) {
          const nested = stringifyYaml(entry, indent + 2);
          if (Array.isArray(entry) && entry.length === 0) {
            return `${prefix}${key}: ${nested}`;
          }
          return `${prefix}${key}:\n${nested}`;
        }
        return `${prefix}${key}: ${formatScalar(entry)}`;
      })
      .join("\n");
  }
  return `${prefix}${formatScalar(value)}`;
}
