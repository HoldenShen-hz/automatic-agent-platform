import { createRequire } from "node:module";

import { PgDatabase } from "../../src/platform/five-plane-state-evidence/truth/postgres/pg-database.js";

const require = createRequire(import.meta.url);
const DEFAULT_PG_TEST_DSN = "postgresql:///agent_company_os";
const PG_TEST_DSN_KEYS = ["AA_TEST_PG_DSN", "AA_STORAGE_POSTGRES_DSN", "AA_PG_DSN", "DATABASE_URL"] as const;

function readConfiguredPgDsn(): string | null {
  for (const key of PG_TEST_DSN_KEYS) {
    const value = process.env[key];
    if (value != null && value.length > 0) {
      return value;
    }
  }
  return null;
}

export function resolvePgTestDsn(): string {
  return readConfiguredPgDsn() ?? DEFAULT_PG_TEST_DSN;
}

export function shouldRunPgIntegration(): { enabled: boolean; reason: string | null } {
  try {
    require.resolve("postgres");
  } catch {
    return { enabled: false, reason: "postgres runtime dependency is not installed" };
  }
  if (readConfiguredPgDsn() == null && !process.env["PGHOST"] && !process.env["PGDATABASE"] && !process.env["PGUSER"] && !process.env["PGPORT"]) {
    return { enabled: false, reason: "PostgreSQL test connection is not configured" };
  }
  return { enabled: true, reason: null };
}

export async function createTestPgDatabase(): Promise<PgDatabase> {
  if (readConfiguredPgDsn() == null && !process.env["PGHOST"]) {
    process.env["PGHOST"] = "/tmp";
  }
  const dsn = resolvePgTestDsn();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require("postgres") as (
    inputDsn: string,
    options: Record<string, unknown>,
  ) => {
    unsafe: (sql: string) => Promise<unknown>;
    end: (options?: { timeout?: number }) => Promise<void>;
  };

  const schema = `aa_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const bootstrap = postgres(dsn, { max: 1, min: 1, idle_timeout: 1, connect_timeout: 10 });
  await bootstrap.unsafe("SELECT pg_advisory_lock(968421)");
  try {
    await bootstrap.unsafe("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public");
    await bootstrap.unsafe("ALTER EXTENSION vector SET SCHEMA public");
  } catch {
    // pgvector is optional in some environments; migration logic handles absence.
  } finally {
    await bootstrap.unsafe("SELECT pg_advisory_unlock(968421)");
  }
  await bootstrap.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await bootstrap.end({ timeout: 1 });

  const db = await PgDatabase.open({ dsn, poolMin: 1, poolMax: 4, schema });
  await db.migrate();
  return db;
}

export async function resetPgTables(db: PgDatabase, tables: string[]): Promise<void> {
  await db.transaction(async (conn) => {
    for (const table of tables) {
      await conn.execute(`DELETE FROM ${table}`);
    }
  });
}
