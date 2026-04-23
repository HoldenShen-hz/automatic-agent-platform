import { createRequire } from "node:module";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
export const lockLogger = new StructuredLogger({ retentionLimit: 100 });
const require = createRequire(import.meta.url);
export function defaultPostgresFactory(dsn, options) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require("postgres");
    return postgres(dsn, options);
}
export function inferPgSslFromDsn(dsn) {
    try {
        return new URL(dsn).searchParams.get("sslmode")?.trim().toLowerCase() === "require"
            ? { rejectUnauthorized: true }
            : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=locking-support.js.map