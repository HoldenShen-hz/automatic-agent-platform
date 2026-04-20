import { createRequire } from "node:module";

import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { PostgresFactory, PostgresSqlDriver } from "./distributed-lock-types.js";

export const lockLogger = new StructuredLogger({ retentionLimit: 100 });

const require = createRequire(import.meta.url);

export function defaultPostgresFactory(dsn: string, options: Record<string, unknown>): PostgresSqlDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require("postgres") as PostgresFactory;
  return postgres(dsn, options);
}

export function inferPgSslFromDsn(dsn: string): false | { rejectUnauthorized: true } | null {
  try {
    return new URL(dsn).searchParams.get("sslmode")?.trim().toLowerCase() === "require"
      ? { rejectUnauthorized: true }
      : null;
  } catch {
    return null;
  }
}
