/**
 * AsyncDivisionRepository - Async data access for data movement and division records.
 *
 * This is the async PostgreSQL-compatible version of DivisionRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { DataMovementJobRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncDivisionRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    /**
     * List data movement job records with optional filtering.
     */
    listDataMovementJobRecords(options?: {
        tenantId?: string | null;
        status?: DataMovementJobRecord["status"];
        movementType?: DataMovementJobRecord["movementType"];
        limit?: number;
    }): Promise<DataMovementJobRecord[]>;
}
