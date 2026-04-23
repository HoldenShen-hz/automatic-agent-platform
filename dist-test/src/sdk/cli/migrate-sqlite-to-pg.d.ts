import { SqliteDatabase } from "../../platform/state-evidence/truth/sqlite/sqlite-database.js";
export interface MigrateSqliteToPgOptions {
    sqlitePath: string;
    pgDsn: string;
    dryRun: boolean;
}
export declare function parseMigrateSqliteToPgArgs(argv: string[]): MigrateSqliteToPgOptions;
export declare function planSqliteToPgMigration(sqlite: SqliteDatabase): Array<{
    table: string;
    rowCount: number;
}>;
export declare function migrateSqliteToPg(options: MigrateSqliteToPgOptions): Promise<Array<{
    table: string;
    migrated: number;
}>>;
