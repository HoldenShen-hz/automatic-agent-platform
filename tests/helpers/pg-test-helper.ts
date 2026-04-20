import { createRequire } from "node:module";

import { PgDatabase } from "../../src/platform/state-evidence/truth/postgres/pg-database.js";

const require = createRequire(import.meta.url);

export function shouldRunPgIntegration(): { enabled: boolean; reason: string | null } {
  if (!process.env["AA_TEST_PG_DSN"]) {
    return { enabled: false, reason: "AA_TEST_PG_DSN is not configured" };
  }
  try {
    require.resolve("postgres");
  } catch {
    return { enabled: false, reason: "postgres runtime dependency is not installed" };
  }
  return { enabled: true, reason: null };
}

export async function createTestPgDatabase(): Promise<PgDatabase> {
  const dsn = process.env["AA_TEST_PG_DSN"];
  if (!dsn) {
    throw new Error("AA_TEST_PG_DSN is required");
  }
  const db = await PgDatabase.open({ dsn, poolMin: 1, poolMax: 4 });
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
