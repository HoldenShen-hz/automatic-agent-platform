/**
 * Authoritative SQLite schema definition.
 * This schema defines the core database tables for the automatic agent system.
 */
import { PHASE_1A_SCHEMA_SQL_PART_1 } from "./phase_1a_schema_sql_part-1.js";
import { PHASE_1A_SCHEMA_SQL_PART_2 } from "./phase_1a_schema_sql_part-2.js";
import { PHASE_1A_SCHEMA_SQL_PART_3 } from "./phase_1a_schema_sql_part-3.js";
import { PHASE_1A_SCHEMA_SQL_PART_4 } from "./phase_1a_schema_sql_part-4.js";
import { PHASE_1A_SCHEMA_SQL_PART_5 } from "./phase_1a_schema_sql_part-5.js";
export const AUTHORITATIVE_SCHEMA_SQL = [
    PHASE_1A_SCHEMA_SQL_PART_1,
    PHASE_1A_SCHEMA_SQL_PART_2,
    PHASE_1A_SCHEMA_SQL_PART_3,
    PHASE_1A_SCHEMA_SQL_PART_4,
    PHASE_1A_SCHEMA_SQL_PART_5,
].join("\n");
export const PHASE_1A_SCHEMA_SQL = AUTHORITATIVE_SCHEMA_SQL;
//# sourceMappingURL=authoritative-schema.js.map