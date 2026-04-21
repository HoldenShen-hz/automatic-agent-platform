import type { AsyncSqlDatabase } from "../truth/async-sql-database.js";
export interface SemanticVectorReadinessCheck {
    name: "storage_driver_postgres" | "semantic_backend_pgvector" | "database_available" | "pgvector_extension_installed" | "semantic_table_present" | "semantic_ivfflat_index_present" | "semantic_roundtrip";
    ok: boolean;
    required: boolean;
    errorCode: string | null;
    errorMessage: string | null;
    details: Record<string, unknown>;
}
export interface SemanticVectorReadinessReport {
    validatedAt: string;
    storageDriver: "sqlite" | "postgres";
    vectorBackend: string;
    databaseFilePath: string | null;
    schema: string;
    tableName: string;
    ready: boolean;
    warnings: string[];
    checks: SemanticVectorReadinessCheck[];
}
export interface SemanticVectorReadinessOptions {
    env?: NodeJS.ProcessEnv;
    storageDriver: "sqlite" | "postgres";
    database: AsyncSqlDatabase | null;
}
export declare function validateSemanticVectorReadiness(options: SemanticVectorReadinessOptions): Promise<SemanticVectorReadinessReport>;
