/**
 * Runtime Version Snapshot
 *
 * Builds a comprehensive snapshot of the runtime version configuration including
 * application version, build information, config version, prompt bundle version,
 * enabled extensions, feature flags, and database schema status.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/architecture_governance_and_versioning_contract.md | Architecture Governance Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ConfigGovernanceService } from "../config-center/config-governance-service.js";
import { resolveAgentProfileHome } from "../config-center/profile-home.js";
import { readTrimmedEnv } from "../config-center/runtime-env.js";
import { EnabledExtensionsSchema, FeatureFlagsSchema } from "../config-center/startup-env-schema.js";
import type { SqliteSchemaStatus } from "../../five-plane-state-evidence/truth/index.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

function getRuntimeVersionSnapshotLogger(): StructuredLogger {
  return new StructuredLogger({ retentionLimit: 100 });
}

export interface RuntimeVersionSnapshot {
  applicationVersion: string | null;
  buildCommit: string | null;
  buildTimestamp: string | null;
  buildProfile: string | null;
  configVersion: string | null;
  promptBundleVersion: string | null;
  enabledExtensions: string[];
  featureFlags: string[];
  configIssues: string[];
  profile: {
    profileId: string;
    profileHome: string;
    promptCacheRoot: string;
    source: "default_managed_home" | "explicit_home";
  };
  schemaVersion: {
    currentVersion: number;
    expectedVersion: number;
    upToDate: boolean;
  };
}

/**
 * Parses a comma-separated environment variable value into a sorted, deduplicated array.
 * Used for parsing extension and feature flag lists from environment variables.
 */
function parseCsvEnv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter((item) => item.length > 0))).sort();
}

function readValidatedCsvEnv(
  name: "AA_ENABLED_EXTENSIONS" | "AA_FEATURE_FLAGS",
  schema: typeof EnabledExtensionsSchema | typeof FeatureFlagsSchema,
): string[] {
  const rawValue = readTrimmedEnv(process.env, name);
  const parsed = schema.safeParse(rawValue ?? undefined);
  if (!parsed.success) {
    getRuntimeVersionSnapshotLogger().warn("runtime_version_snapshot.invalid_csv_env", {
      data: {
        envName: name,
        issues: parsed.error.issues.map((issue) => issue.message),
      },
    });
    return [];
  }
  return parseCsvEnv(parsed.data ?? undefined);
}

/**
 * Reads the application version from package.json by checking multiple possible paths.
 * Falls back to the npm_package_version environment variable if file reading fails.
 */
function readApplicationVersion(): string | null {
  const candidatePaths = [
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "package.json"),
    join(process.cwd(), "package.json"),
  ];

  for (const packageJsonPath of candidatePaths) {
    try {
      const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
      if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
        continue;
      }

      const candidate = parsed as Record<string, unknown>;
      if (typeof candidate.version === "string") {
        return candidate.version;
      }
    } catch (err) {
      getRuntimeVersionSnapshotLogger().warn("detectApplicationVersion parse failed", { error: err });
      continue;
    }
  }

  try {
    return process.env.npm_package_version ?? null;
  } catch (err) {
    getRuntimeVersionSnapshotLogger().warn("detectApplicationVersion npm_package_version failed", { error: err });
    return null;
  }
}

function resolveConfigEnvironment(): "dev" | "staging" | "prod" {
  const value = (process.env.AA_CONFIG_ENV ?? "prod").trim().toLowerCase();
  if (value === "dev" || value === "staging" || value === "prod") {
    return value;
  }
  return "prod";
}

/**
 * Safely loads the config bundle, returning default values if loading fails.
 * This ensures the version snapshot can still be generated even if config
 * loading encounters errors.
 */
function safeLoadConfigBundle(): {
  configVersion: string | null;
  promptBundleVersion: string | null;
  configIssues: string[];
} {
  try {
    const bundle = new ConfigGovernanceService().loadBundle(resolveConfigEnvironment());
    return {
      configVersion: bundle.version.versionId,
      promptBundleVersion: bundle.version.versionId,
      configIssues: bundle.issues,
    };
  } catch (error) {
    return {
      configVersion: null,
      promptBundleVersion: null,
      configIssues: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Builds a comprehensive snapshot of the current runtime version configuration.
 * This snapshot is used for diagnostics, debugging, and governance reporting.
 *
 * @param schemaStatus - Current database schema status from SQLite migrations
 * @returns Complete runtime version snapshot
 */
export function buildRuntimeVersionSnapshot(schemaStatus: SqliteSchemaStatus): RuntimeVersionSnapshot {
  const config = safeLoadConfigBundle();
  const profile = resolveAgentProfileHome();

  return {
    applicationVersion: readApplicationVersion(),
    buildCommit: process.env.AA_BUILD_COMMIT ?? null,
    buildTimestamp: process.env.AA_BUILD_TIMESTAMP ?? null,
    buildProfile: process.env.AA_BUILD_PROFILE ?? null,
    configVersion: config.configVersion,
    promptBundleVersion: config.promptBundleVersion,
    enabledExtensions: readValidatedCsvEnv("AA_ENABLED_EXTENSIONS", EnabledExtensionsSchema),
    featureFlags: readValidatedCsvEnv("AA_FEATURE_FLAGS", FeatureFlagsSchema),
    configIssues: config.configIssues,
    profile: {
      profileId: profile.profileId,
      profileHome: profile.profileHome,
      promptCacheRoot: profile.promptCacheRoot,
      source: profile.source,
    },
    schemaVersion: {
      currentVersion: schemaStatus.currentVersion,
      expectedVersion: schemaStatus.expectedVersion,
      upToDate: schemaStatus.upToDate,
    },
  };
}
