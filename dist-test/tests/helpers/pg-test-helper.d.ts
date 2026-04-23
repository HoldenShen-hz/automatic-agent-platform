import { PgDatabase } from "../../src/platform/state-evidence/truth/postgres/pg-database.js";
export declare function shouldRunPgIntegration(): {
    enabled: boolean;
    reason: string | null;
};
export declare function createTestPgDatabase(): Promise<PgDatabase>;
export declare function resetPgTables(db: PgDatabase, tables: string[]): Promise<void>;
