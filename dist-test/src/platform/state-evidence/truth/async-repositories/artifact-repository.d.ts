/**
 * AsyncArtifactRepository - Async data access for artifacts.
 *
 * This is the async PostgreSQL-compatible version of ArtifactRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { ArtifactRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncArtifactRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertArtifact(artifact: ArtifactRecord): Promise<void>;
    /**
     * Get an artifact by ID.
     */
    getArtifact(artifactId: string): Promise<ArtifactRecord | null>;
    /**
     * List artifacts for a task.
     */
    listArtifactsByTask(taskId: string, tenantId?: string | null): Promise<ArtifactRecord[]>;
}
