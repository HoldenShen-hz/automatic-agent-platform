/**
 * @fileoverview PostgreSQL schema support primitives.
 */
export interface PostgresMigration {
    version: number;
    name: string;
    ddl: string;
    checksum: string;
    downDdl: string;
}
export declare function normalizeSql(sql: string): string;
export declare function checksumSql(sql: string): string;
export declare function defineMigration(version: number, name: string, ddl: string, options?: {
    downDdl?: string;
}): PostgresMigration;
export declare const PHASE_1A_SCHEMA_DDL: string;
