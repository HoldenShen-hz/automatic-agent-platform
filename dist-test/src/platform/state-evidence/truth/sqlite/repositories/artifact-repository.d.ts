/**
 * ArtifactRepository - Data access for artifacts.
 *
 * This repository handles all data access for:
 * - ArtifactRecord (artifacts table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */
import type { ArtifactRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class ArtifactRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insertArtifact(artifact: ArtifactRecord): void;
    /**
     * Get an artifact by ID.
     */
    getArtifact(artifactId: string): ArtifactRecord | null;
    /**
     * List artifacts for a task.
     */
    listArtifactsByTask(taskId: string, tenantId?: string | null): ArtifactRecord[];
}
