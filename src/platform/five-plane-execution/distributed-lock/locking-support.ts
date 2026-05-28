import postgres from "postgres";

import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { PostgresFactory, PostgresSqlDriver } from "./distributed-lock-types.js";

export const lockLogger = new StructuredLogger({ retentionLimit: 100 });

export function defaultPostgresFactory(dsn: string, options: Record<string, unknown>): PostgresSqlDriver {
  return (postgres as unknown as PostgresFactory)(dsn, options);
}

export function inferPgSslFromDsn(dsn: string): false | { rejectUnauthorized: true } | null {
  try {
    const searchParams = new URL(dsn).searchParams;
    const sslmode = Array.from(searchParams.entries()).find(([key]) => key.toLowerCase() === "sslmode")?.[1];
    return sslmode?.trim().toLowerCase() === "require"
      ? { rejectUnauthorized: true }
      : null;
  } catch {
    return null;
  }
}
