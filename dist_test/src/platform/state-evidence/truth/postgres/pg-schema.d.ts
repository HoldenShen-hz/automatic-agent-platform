/**
 * @fileoverview PostgreSQL schema public surface.
 */
import type { PostgresMigration } from "./pg-schema-support.js";
export * from "./pg-schema-support.js";
export * from "./pg-migrations-runtime.js";
export * from "./pg-migrations-product.js";
export declare const POSTGRES_MIGRATIONS: readonly PostgresMigration[];
export declare function getLatestPostgresMigrationVersion(): number;
export declare function translateSqliteToPostgresDdl(sqliteSql: string): string;
