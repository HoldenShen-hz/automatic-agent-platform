import type { AsyncSqlDatabase } from "../truth/async-sql-database.js";
export declare const SEMANTIC_VECTOR_DIMENSIONS = 32;
export type SemanticVectorBackend = "local_hash" | "pgvector";
export interface SemanticVectorChunkRecord {
    knowledgeRef: string;
    chunkId: string;
    documentId: string;
    namespace: string;
    embeddingId: string | null;
    embedding: readonly number[] | null;
    updatedAt: string;
}
export interface SemanticVectorCandidate {
    knowledgeRef: string;
    namespace: string;
    similarity: number;
}
export interface SemanticVectorStoreProfile {
    backend: SemanticVectorBackend;
    ready: boolean;
    details: Record<string, unknown>;
}
export interface SemanticVectorStore {
    readonly backend: SemanticVectorBackend;
    upsertChunks(records: readonly SemanticVectorChunkRecord[]): Promise<void>;
    querySimilar(input: {
        query: string;
        namespace?: string;
        limit?: number;
        minSimilarity?: number;
    }): Promise<SemanticVectorCandidate[]>;
    inspect(): SemanticVectorStoreProfile;
}
export declare function resolveSemanticVectorBackend(env?: NodeJS.ProcessEnv): SemanticVectorBackend;
export declare class LocalHashSemanticVectorStore implements SemanticVectorStore {
    readonly backend: "local_hash";
    private readonly records;
    upsertChunks(records: readonly SemanticVectorChunkRecord[]): Promise<void>;
    querySimilar(input: {
        query: string;
        namespace?: string;
        limit?: number;
        minSimilarity?: number;
    }): Promise<SemanticVectorCandidate[]>;
    inspect(): SemanticVectorStoreProfile;
}
export interface PgvectorSemanticVectorStoreOptions {
    database: AsyncSqlDatabase;
    schema?: string;
    tableName?: string;
    extensionRequired?: boolean;
}
export declare class PgvectorSemanticVectorStore implements SemanticVectorStore {
    readonly backend: "pgvector";
    private readonly database;
    private readonly schema;
    private readonly tableName;
    private readonly extensionRequired;
    private readiness;
    private ready;
    constructor(options: PgvectorSemanticVectorStoreOptions);
    upsertChunks(records: readonly SemanticVectorChunkRecord[]): Promise<void>;
    querySimilar(input: {
        query: string;
        namespace?: string;
        limit?: number;
        minSimilarity?: number;
    }): Promise<SemanticVectorCandidate[]>;
    inspect(): SemanticVectorStoreProfile;
    private ensureReady;
    private qualifiedTableName;
}
export declare function createSemanticVectorStoreFromEnvironment(input?: {
    env?: NodeJS.ProcessEnv;
    storageDriver?: "sqlite" | "postgres";
    database?: AsyncSqlDatabase | null;
}): SemanticVectorStore;
