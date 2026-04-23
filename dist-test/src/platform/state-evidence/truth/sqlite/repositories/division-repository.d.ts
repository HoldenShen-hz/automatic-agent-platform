/**
 * DivisionRepository - Data access for data movement and division records.
 *
 * This repository handles all data access for:
 * - DataMovementJobRecord (data_movement_jobs table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */
import type { DataMovementJobRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class DivisionRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    /**
     * List data movement job records with optional filtering.
     */
    listDataMovementJobRecords(options?: {
        tenantId?: string | null;
        status?: DataMovementJobRecord["status"];
        movementType?: DataMovementJobRecord["movementType"];
        limit?: number;
    }): DataMovementJobRecord[];
}
