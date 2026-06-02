import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const DEFAULT_PLATFORM_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ALLOWED_CLI_FLAGS = new Set(["root", "now", "mode", "check"]);

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

export function resolvePlatformRoot(platformRoot = DEFAULT_PLATFORM_ROOT) {
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

export function parseLimitedYaml(raw, sourcePath = "<inline>") {
  try {
    const parsed = parseYaml(raw);
    return parsed == null ? {} : parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`division_coverage.invalid_yaml:${sourcePath}:${message}`);
  }
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

export function parseCliArgs(argv, options = {}) {
  const flags = {};
  const cwdRoot = resolve(options.cwd ?? process.cwd());
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      throw new Error(`division_coverage.invalid_cli_argument:${arg}`);
    }
    const [key, rawValue] = arg.slice(2).split("=", 2);
    if (!ALLOWED_CLI_FLAGS.has(key)) {
      throw new Error(`division_coverage.unknown_flag:${key}`);
    }
    flags[key] = rawValue ?? "true";
  }
  if (typeof flags.root === "string") {
    const resolvedRoot = resolve(cwdRoot, flags.root);
    const normalizedCwd = `${cwdRoot}${cwdRoot.endsWith("/") ? "" : "/"}`;
    if (resolvedRoot !== cwdRoot && !resolvedRoot.startsWith(normalizedCwd)) {
      throw new Error(`division_coverage.invalid_root:${flags.root}`);
    }
    flags.root = resolvedRoot;
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
    "engineering-ops",
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
    "general-ops",
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
