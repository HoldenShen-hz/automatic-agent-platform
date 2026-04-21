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
import type { SqliteSchemaStatus } from "../../state-evidence/truth/sqlite-database.js";
export interface RuntimeVersionSnapshot {
    applicationVersion: string | null;
    buildCommit: string | null;
    buildTimestamp: string | null;
    buildProfile: string | null;
    configVersion: string;
    promptBundleVersion: string;
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
 * Builds a comprehensive snapshot of the current runtime version configuration.
 * This snapshot is used for diagnostics, debugging, and governance reporting.
 *
 * @param schemaStatus - Current database schema status from SQLite migrations
 * @returns Complete runtime version snapshot
 */
export declare function buildRuntimeVersionSnapshot(schemaStatus: SqliteSchemaStatus): RuntimeVersionSnapshot;
