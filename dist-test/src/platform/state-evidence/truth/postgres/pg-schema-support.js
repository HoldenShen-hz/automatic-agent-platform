/**
 * @fileoverview PostgreSQL schema support primitives.
 */
import { createHash } from "node:crypto";
import { PHASE_1A_SCHEMA_DDL_PART_1 } from "./phase_1a_schema_ddl_part-1.js";
import { PHASE_1A_SCHEMA_DDL_PART_2 } from "./phase_1a_schema_ddl_part-2.js";
import { PHASE_1A_SCHEMA_DDL_PART_3 } from "./phase_1a_schema_ddl_part-3.js";
import { PHASE_1A_SCHEMA_DDL_PART_4 } from "./phase_1a_schema_ddl_part-4.js";
import { PHASE_1A_SCHEMA_DDL_PART_5 } from "./phase_1a_schema_ddl_part-5.js";
export function normalizeSql(sql) {
    return sql.trim().replace(/\s+/g, " ") + "\n";
}
export function checksumSql(sql) {
    return createHash("sha256").update(normalizeSql(sql), "utf8").digest("hex");
}
export function defineMigration(version, name, ddl, options = {}) {
    return {
        version,
        name,
        ddl: normalizeSql(ddl),
        checksum: checksumSql(ddl),
        downDdl: normalizeSql(options.downDdl
            ?? `-- down migration placeholder for ${name}\nSELECT 'manual rollback required for ${name}';`),
    };
}
export const PHASE_1A_SCHEMA_DDL = [
    PHASE_1A_SCHEMA_DDL_PART_1,
    PHASE_1A_SCHEMA_DDL_PART_2,
    PHASE_1A_SCHEMA_DDL_PART_3,
    PHASE_1A_SCHEMA_DDL_PART_4,
    PHASE_1A_SCHEMA_DDL_PART_5,
].join("\n");
//# sourceMappingURL=pg-schema-support.js.map