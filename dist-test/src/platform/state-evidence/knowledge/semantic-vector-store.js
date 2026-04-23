import { ValidationError } from "../../contracts/errors.js";
import { cosineSimilarity, buildSemanticEmbedding } from "./semantic-embedding.js";
export const SEMANTIC_VECTOR_DIMENSIONS = 32;
const DEFAULT_LIMIT = 12;
const DEFAULT_MIN_SIMILARITY = 0.18;
export function resolveSemanticVectorBackend(env = process.env) {
    const raw = env.AA_KNOWLEDGE_VECTOR_BACKEND?.trim() ?? env.AA_KNOWLEDGE_SEMANTIC_BACKEND?.trim() ?? "";
    if (raw.length === 0) {
        return "local_hash";
    }
    if (raw === "local_hash" || raw === "pgvector") {
        return raw;
    }
    throw new ValidationError(`knowledge.semantic_backend_invalid:${raw}`, `knowledge.semantic_backend_invalid:${raw}`, {
        retryable: false,
        details: { raw },
    });
}
export class LocalHashSemanticVectorStore {
    backend = "local_hash";
    records = new Map();
    async upsertChunks(records) {
        for (const record of records) {
            if (!isSupportedEmbedding(record.embedding)) {
                continue;
            }
            this.records.set(record.knowledgeRef, {
                ...record,
                embedding: [...record.embedding],
            });
        }
    }
    async querySimilar(input) {
        const embedding = buildSemanticEmbedding(input.query);
        if (!isSupportedEmbedding(embedding)) {
            return [];
        }
        return [...this.records.values()]
            .filter((record) => input.namespace == null || record.namespace === input.namespace)
            .map((record) => ({
            knowledgeRef: record.knowledgeRef,
            namespace: record.namespace,
            similarity: cosineSimilarity(record.embedding, embedding),
        }))
            .filter((candidate) => candidate.similarity >= (input.minSimilarity ?? DEFAULT_MIN_SIMILARITY))
            .sort((left, right) => right.similarity - left.similarity)
            .slice(0, input.limit ?? DEFAULT_LIMIT);
    }
    inspect() {
        return {
            backend: this.backend,
            ready: true,
            details: {
                recordCount: this.records.size,
            },
        };
    }
}
export class PgvectorSemanticVectorStore {
    backend = "pgvector";
    database;
    schema;
    tableName;
    extensionRequired;
    readiness = null;
    ready = false;
    constructor(options) {
        this.database = options.database;
        this.schema = validateIdentifier(options.schema ?? "public", "knowledge.semantic_pgvector_schema_invalid");
        this.tableName = validateIdentifier(options.tableName ?? "knowledge_semantic_vectors", "knowledge.semantic_pgvector_table_invalid");
        this.extensionRequired = options.extensionRequired ?? true;
    }
    async upsertChunks(records) {
        await this.ensureReady();
        const eligible = records.filter((record) => isSupportedEmbedding(record.embedding));
        if (eligible.length === 0) {
            return;
        }
        await this.database.transaction(async (conn) => {
            for (const record of eligible) {
                const embedding = record.embedding;
                if (!isSupportedEmbedding(embedding)) {
                    continue;
                }
                await conn.execute(`
            INSERT INTO ${this.qualifiedTableName()} (
              knowledge_ref,
              chunk_id,
              document_id,
              namespace,
              embedding_id,
              embedding_model,
              embedding,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, CAST($7 AS vector(${SEMANTIC_VECTOR_DIMENSIONS})), $8, $8)
            ON CONFLICT (knowledge_ref) DO UPDATE SET
              chunk_id = EXCLUDED.chunk_id,
              document_id = EXCLUDED.document_id,
              namespace = EXCLUDED.namespace,
              embedding_id = EXCLUDED.embedding_id,
              embedding_model = EXCLUDED.embedding_model,
              embedding = EXCLUDED.embedding,
              updated_at = EXCLUDED.updated_at
          `, record.knowledgeRef, record.chunkId, record.documentId, record.namespace, record.embeddingId, "local_hash_v1", toPgvectorLiteral(embedding), record.updatedAt);
            }
        });
    }
    async querySimilar(input) {
        await this.ensureReady();
        const embedding = buildSemanticEmbedding(input.query);
        if (!isSupportedEmbedding(embedding)) {
            return [];
        }
        const rows = await this.database.asyncConnection.query(`
        SELECT
          knowledge_ref,
          namespace,
          GREATEST(0, 1 - (embedding <=> CAST($1 AS vector(${SEMANTIC_VECTOR_DIMENSIONS})))) AS similarity
        FROM ${this.qualifiedTableName()}
        WHERE ($2::TEXT IS NULL OR namespace = $2)
          AND (1 - (embedding <=> CAST($1 AS vector(${SEMANTIC_VECTOR_DIMENSIONS})))) >= $3
        ORDER BY embedding <=> CAST($1 AS vector(${SEMANTIC_VECTOR_DIMENSIONS}))
        LIMIT $4
      `, toPgvectorLiteral(embedding), input.namespace ?? null, input.minSimilarity ?? DEFAULT_MIN_SIMILARITY, input.limit ?? DEFAULT_LIMIT);
        return rows.rows.map((row) => ({
            knowledgeRef: row.knowledge_ref,
            namespace: row.namespace,
            similarity: Number(row.similarity.toFixed(6)),
        }));
    }
    inspect() {
        return {
            backend: this.backend,
            ready: this.ready,
            details: {
                schema: this.schema,
                tableName: this.tableName,
                extensionRequired: this.extensionRequired,
                filePath: this.database.filePath,
            },
        };
    }
    async ensureReady() {
        if (this.readiness) {
            return this.readiness;
        }
        this.readiness = (async () => {
            const extension = await this.database.asyncConnection.queryOne("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed");
            if (!extension?.installed && this.extensionRequired) {
                throw new ValidationError("knowledge.semantic_pgvector_extension_missing", "knowledge.semantic_pgvector_extension_missing", {
                    retryable: false,
                    details: {
                        schema: this.schema,
                        tableName: this.tableName,
                    },
                });
            }
            const table = await this.database.asyncConnection.queryOne("SELECT to_regclass($1) AS regclass", `${this.schema}.${this.tableName}`);
            if (!table?.regclass) {
                throw new ValidationError("knowledge.semantic_pgvector_table_missing", "knowledge.semantic_pgvector_table_missing", {
                    retryable: false,
                    details: {
                        schema: this.schema,
                        tableName: this.tableName,
                    },
                });
            }
            this.ready = true;
        })();
        return this.readiness;
    }
    qualifiedTableName() {
        return `${this.schema}.${this.tableName}`;
    }
}
export function createSemanticVectorStoreFromEnvironment(input = {}) {
    const backend = resolveSemanticVectorBackend(input.env);
    if (backend === "local_hash") {
        return new LocalHashSemanticVectorStore();
    }
    if (input.storageDriver !== "postgres" || input.database == null) {
        throw new ValidationError("knowledge.semantic_pgvector_requires_postgres", "knowledge.semantic_pgvector_requires_postgres", {
            retryable: false,
            details: {
                storageDriver: input.storageDriver ?? null,
            },
        });
    }
    return new PgvectorSemanticVectorStore({
        database: input.database,
        schema: input.env?.AA_KNOWLEDGE_PGVECTOR_SCHEMA?.trim() || "public",
        tableName: input.env?.AA_KNOWLEDGE_PGVECTOR_TABLE?.trim() || "knowledge_semantic_vectors",
        extensionRequired: input.env?.AA_KNOWLEDGE_PGVECTOR_EXTENSION_REQUIRED?.trim() !== "false",
    });
}
function validateIdentifier(value, code) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
        throw new ValidationError(code, code, {
            retryable: false,
            details: { value },
        });
    }
    return value;
}
function isSupportedEmbedding(embedding) {
    return Array.isArray(embedding) && embedding.length === SEMANTIC_VECTOR_DIMENSIONS;
}
function toPgvectorLiteral(embedding) {
    return `[${embedding.map((value) => Number(value).toFixed(6)).join(",")}]`;
}
//# sourceMappingURL=semantic-vector-store.js.map