/**
 * @fileoverview PostgreSQL schema support primitives.
 */

import { createHash } from "node:crypto";
import { PHASE_1A_SCHEMA_DDL_PART_1 } from "./phase_1a_schema_ddl_part-1.js";
import { PHASE_1A_SCHEMA_DDL_PART_2 } from "./phase_1a_schema_ddl_part-2.js";
import { PHASE_1A_SCHEMA_DDL_PART_3 } from "./phase_1a_schema_ddl_part-3.js";
import { PHASE_1A_SCHEMA_DDL_PART_4 } from "./phase_1a_schema_ddl_part-4.js";
import { PHASE_1A_SCHEMA_DDL_PART_5 } from "./phase_1a_schema_ddl_part-5.js";

export interface PostgresMigration {
  version: number;
  name: string;
  ddl: string;
  checksum: string;
  downDdl: string;
}

export function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, " ") + "\n";
}

export function checksumSql(sql: string): string {
  return createHash("sha256").update(normalizeSql(sql), "utf8").digest("hex");
}

export function defineMigration(
  version: number,
  name: string,
  ddl: string,
  options: { downDdl?: string } = {},
): PostgresMigration {
  return {
    version,
    name,
    ddl: normalizeSql(ddl),
    checksum: checksumSql(ddl),
    downDdl: normalizeSql(
      options.downDdl
        ?? `-- down migration placeholder for ${name}\nSELECT 'manual rollback required for ${name}';`,
    ),
  };
}

export const PHASE_1A_SCHEMA_DDL = [
  PHASE_1A_SCHEMA_DDL_PART_1,
  PHASE_1A_SCHEMA_DDL_PART_2,
  PHASE_1A_SCHEMA_DDL_PART_3,
  PHASE_1A_SCHEMA_DDL_PART_4,
  PHASE_1A_SCHEMA_DDL_PART_5,
].join("\n");
