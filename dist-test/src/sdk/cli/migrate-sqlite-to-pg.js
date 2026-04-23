import { basename } from "node:path";
import { SqliteDatabase } from "../../platform/state-evidence/truth/sqlite/sqlite-database.js";
import { PgDatabase } from "../../platform/state-evidence/truth/postgres/pg-database.js";
const TABLES = [
    "tasks",
    "sessions",
    "executions",
    "leases",
    "events",
    "approvals",
    "artifacts",
    "billing_records",
    "dispatches",
    "divisions",
    "evolutions",
    "intelligence_records",
    "locks",
    "marketplace_listings",
    "memory_entries",
    "operations",
    "organizations",
    "releases",
    "secret_registry",
    "secret_usage_audits",
    "secret_rotation_events",
    "secret_leases",
    "workers",
    "workflows",
];
export function parseMigrateSqliteToPgArgs(argv) {
    let sqlitePath = "";
    let pgDsn = "";
    let dryRun = false;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index] ?? "";
        if (arg === "--sqlite" || arg === "--sqlite-path") {
            sqlitePath = argv[index + 1] ?? "";
            index += 1;
            continue;
        }
        if (arg === "--pg-dsn") {
            pgDsn = argv[index + 1] ?? "";
            index += 1;
            continue;
        }
        if (arg === "--dry-run") {
            dryRun = true;
        }
    }
    if (!sqlitePath || !pgDsn) {
        throw new Error("usage: migrate-sqlite-to-pg --sqlite <path> --pg-dsn <dsn> [--dry-run]");
    }
    return { sqlitePath, pgDsn, dryRun };
}
export function planSqliteToPgMigration(sqlite) {
    return TABLES.map((table) => {
        try {
            const row = sqlite.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
            return { table, rowCount: row?.count ?? 0 };
        }
        catch (error) {
            if (error instanceof Error && /no such table/i.test(error.message)) {
                return { table, rowCount: 0 };
            }
            throw error;
        }
    });
}
export async function migrateSqliteToPg(options) {
    const sqlite = new SqliteDatabase(options.sqlitePath);
    const plan = planSqliteToPgMigration(sqlite);
    if (options.dryRun) {
        sqlite.close();
        return plan.map(({ table, rowCount }) => ({ table, migrated: rowCount }));
    }
    const pg = await PgDatabase.open({ dsn: options.pgDsn });
    try {
        await pg.migrate();
        const migrated = [];
        for (const { table, rowCount } of plan) {
            if (rowCount === 0) {
                migrated.push({ table, migrated: 0 });
                continue;
            }
            const rows = sqlite.connection.prepare(`SELECT * FROM ${table}`).all();
            if (rows.length === 0) {
                migrated.push({ table, migrated: 0 });
                continue;
            }
            const columns = Object.keys(rows[0] ?? {});
            const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
            const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
            let count = 0;
            await pg.transaction(async (conn) => {
                for (const row of rows) {
                    await conn.execute(sql, ...columns.map((column) => row[column]));
                    count += 1;
                }
            });
            migrated.push({ table, migrated: count });
        }
        return migrated;
    }
    finally {
        sqlite.close();
        await pg.close();
    }
}
async function main() {
    const options = parseMigrateSqliteToPgArgs(process.argv.slice(2));
    const result = await migrateSqliteToPg(options);
    process.stdout.write(`${JSON.stringify({
        sqlite: basename(options.sqlitePath),
        pgDsn: options.pgDsn,
        dryRun: options.dryRun,
        tables: result,
    }, null, 2)}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) {
    void main();
}
//# sourceMappingURL=migrate-sqlite-to-pg.js.map