import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { PostgresSqlDriver } from "./distributed-lock-types.js";
export declare const lockLogger: StructuredLogger;
export declare function defaultPostgresFactory(dsn: string, options: Record<string, unknown>): PostgresSqlDriver;
export declare function inferPgSslFromDsn(dsn: string): false | {
    rejectUnauthorized: true;
} | null;
