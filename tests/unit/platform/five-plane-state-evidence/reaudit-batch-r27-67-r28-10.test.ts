import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { canAccessKnowledgeBoundary } from "../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";
import {
  validateListingDependencies,
  type MarketplaceCatalogEntry,
} from "../../../../src/scale-ecosystem/marketplace/catalog/index.js";
import type { AsyncQueryResult, AsyncSqlConnection } from "../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import { AsyncReleaseRepository } from "../../../../src/platform/five-plane-state-evidence/truth/async-repositories/release-repository.js";
import { AsyncMarketplaceRepository } from "../../../../src/platform/five-plane-state-evidence/truth/async-repositories/marketplace-repository.js";
import { AsyncOperationsRepository } from "../../../../src/platform/five-plane-state-evidence/truth/async-repositories/operations-repository.js";
import { AsyncPromptRepository } from "../../../../src/platform/five-plane-state-evidence/truth/async-repositories/prompt-repository.js";
import { AsyncMarketplaceListingRepository } from "../../../../src/platform/five-plane-state-evidence/truth/async-repositories/marketplace-repository-ext.js";

type SqlCall = {
  method: "query" | "queryOne" | "execute";
  sql: string;
  params: unknown[];
};

function createConnectionRecorder(options: {
  queryRows?: unknown[][];
  queryOneRows?: unknown[];
  executeResults?: number[];
} = {}): {
  readonly calls: SqlCall[];
  readonly conn: AsyncSqlConnection;
} {
  const calls: SqlCall[] = [];
  let queryIndex = 0;
  let queryOneIndex = 0;
  let executeIndex = 0;
  return {
    calls,
    conn: {
      async query<T>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
        calls.push({ method: "query", sql, params });
        const rows = (options.queryRows?.[queryIndex++] ?? []) as T[];
        return { rows, rowCount: rows.length, changes: rows.length };
      },
      async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
        calls.push({ method: "queryOne", sql, params });
        return options.queryOneRows?.[queryOneIndex++] as T | undefined;
      },
      async execute(sql: string, ...params: unknown[]): Promise<number> {
        calls.push({ method: "execute", sql, params });
        return options.executeResults?.[executeIndex++] ?? 1;
      },
    },
  };
}

function createCatalogEntry(overrides: Partial<MarketplaceCatalogEntry> = {}): MarketplaceCatalogEntry {
  return {
    listingId: overrides.listingId ?? "listing-1",
    title: overrides.title ?? "Test Listing",
    trustLevel: overrides.trustLevel ?? "community",
    lifecycleState: overrides.lifecycleState ?? "active",
    version: overrides.version ?? "1.0.0",
    dependencies: overrides.dependencies ?? [],
    artifactType: overrides.artifactType ?? "pack",
    compatibility: overrides.compatibility ?? {
      minPlatformVersion: "0.0.0",
      supportedArtifactTypes: [],
    },
    qualityMetrics: overrides.qualityMetrics ?? {
      reliabilityScore: 0.8,
      usabilityScore: 0.8,
      supportScore: 0.8,
    },
    ...overrides,
  };
}

test("R27-67 validateListingDependencies checks dependency compatibility against the requesting listing type", () => {
  const pluginEntry = createCatalogEntry({
    listingId: "plugin-1",
    artifactType: "plugin",
    dependencies: [{ listingId: "shared-pack", versionRange: "^1.0.0", optional: false }],
  });
  const dependency = createCatalogEntry({
    listingId: "shared-pack",
    artifactType: "pack",
    compatibility: {
      minPlatformVersion: "0.0.0",
      supportedArtifactTypes: ["plugin"],
    },
  });

  const allowed = validateListingDependencies(pluginEntry, [dependency]);
  assert.equal(allowed.valid, true);

  const incompatibleDependency = createCatalogEntry({
    ...dependency,
    compatibility: {
      minPlatformVersion: "0.0.0",
      supportedArtifactTypes: ["connector"],
    },
  });
  const blocked = validateListingDependencies(pluginEntry, [incompatibleDependency]);
  assert.equal(blocked.valid, false);
  assert.deepEqual(blocked.incompatibilities, ["artifact_type:shared-pack"]);
});

test("R27-68 canAccessKnowledgeBoundary allows public boundaries", () => {
  const result = canAccessKnowledgeBoundary({
    boundaryId: "kb-public",
    ownerOrgNodeId: "finance",
    namespaceIds: [],
    defaultVisibility: "public",
    allowedOrgNodeIds: [],
    auditOnAccess: true,
    fieldAllowlist: [],
  }, "sales");

  assert.equal(result, true);
});

test("R28-03 AsyncReleaseRepository uses '=' for environment filtering", async () => {
  const { conn, calls } = createConnectionRecorder({ queryRows: [[]] });
  const repo = new AsyncReleaseRepository(conn);

  await repo.listReleaseBundleRecords({ environment: "prod", limit: 5 });

  assert.match(calls[0]!.sql, /WHERE environment = \$1/);
  assert.doesNotMatch(calls[0]!.sql, /WHERE environment IS \$1/);
});

test("R28-04 AsyncMarketplaceRepository tenant filters use '=' across query paths", async () => {
  const { conn, calls } = createConnectionRecorder({ queryRows: [[], []], queryOneRows: [undefined] });
  const repo = new AsyncMarketplaceRepository(conn);

  await repo.getExtensionPackage("pkg-1", "tenant-1");
  await repo.listMarketplaceGovernanceReports(10, "tenant-1");

  assert.match(calls[0]!.sql, /tenant_id = \$2/);
  assert.doesNotMatch(calls[0]!.sql, /tenant_id IS \$2/);
  assert.match(calls[1]!.sql, /WHERE tenant_id = \$1/);
  assert.doesNotMatch(calls[1]!.sql, /WHERE tenant_id IS \$1/);
});

test("R28-05 AsyncOperationsRepository tenant filters use '=' across analytics and replay queries", async () => {
  const { conn, calls } = createConnectionRecorder({ queryRows: [[], []] });
  const repo = new AsyncOperationsRepository(conn);

  await repo.listAnalyticsFactRecords({ tenantId: "tenant-a", limit: 2 });
  await repo.listReplayDatasetRecords({ tenantId: "tenant-a", limit: 2 });

  assert.match(calls[0]!.sql, /tenant_id = \$1/);
  assert.doesNotMatch(calls[0]!.sql, /tenant_id IS \$1/);
  assert.match(calls[1]!.sql, /tenant_id = \$1/);
  assert.doesNotMatch(calls[1]!.sql, /tenant_id IS \$1/);
});

test("R28-06 setCurrentVersion keeps the two updates inside an explicit transaction", async () => {
  const { conn, calls } = createConnectionRecorder({ executeResults: [1, 1, 1, 1] });
  const repo = new AsyncPromptRepository(conn);

  await repo.setCurrentVersion("bundle-1", "version-1");

  assert.deepEqual(
    calls.map((call) => call.sql),
    [
      "BEGIN",
      "UPDATE prompt_versions SET is_current = false WHERE bundle_id = $1",
      "UPDATE prompt_versions SET is_current = true WHERE version_id = $1",
      "COMMIT",
    ],
  );
});

test("R28-07 and R28-08 prompt repository uses PostgreSQL booleans in read paths", async () => {
  const { conn, calls } = createConnectionRecorder({ queryRows: [[], []], queryOneRows: [undefined] });
  const repo = new AsyncPromptRepository(conn);

  await repo.listPromptBundlesByDomain("coding");
  await repo.listActivePromptBundles();
  await repo.getCurrentVersion("bundle-1");

  assert.match(calls[0]!.sql, /deprecated = false/);
  assert.match(calls[1]!.sql, /deprecated = false/);
  assert.match(calls[2]!.sql, /is_current = true/);
});

test("R28-09 listDownloadsByListing passes the sanitized limit instead of raw input", async () => {
  const { conn, calls } = createConnectionRecorder({ queryRows: [[]] });
  const repo = new AsyncMarketplaceListingRepository(conn);

  await repo.listDownloadsByListing("listing-1", 12.9);

  assert.equal(calls[0]!.params[1], 12);
});

test("R28-10 prompt repository no longer calls this.conn.execute directly", () => {
  const source = readFileSync(
    "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/truth/async-repositories/prompt-repository.ts",
    "utf8",
  );

  assert.doesNotMatch(source, /this\.conn\.execute\(/);
});
