import { ValidationError } from "../../contracts/errors.js";
import type { AsyncSqlDatabase } from "../truth/async-sql-database.js";
import { cosineSimilarity, buildSemanticEmbedding } from "./semantic-embedding.js";

export const SEMANTIC_VECTOR_DIMENSIONS = 32;
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

const DEFAULT_LIMIT = 12;
const DEFAULT_MIN_SIMILARITY = 0.18;
const DEFAULT_MAX_LOCAL_HASH_RECORDS = 2_048;

export interface LocalHashSemanticVectorStoreOptions {
  defaultLimit?: number;
  defaultMinSimilarity?: number;
  maxRecords?: number;
}

export function resolveSemanticVectorBackend(env: NodeJS.ProcessEnv = process.env): SemanticVectorBackend {
  const raw = env.AA_KNOWLEDGE_VECTOR_BACKEND?.trim() ?? env.AA_KNOWLEDGE_SEMANTIC_BACKEND?.trim() ?? "";
  if (raw.length === 0) {
    return "local_hash";
  }
  if (raw === "local_hash" || raw === "pgvector") {
    return raw;
  }
  throw new ValidationError(
    `knowledge.semantic_backend_invalid:${raw}`,
    `knowledge.semantic_backend_invalid:${raw}`,
    {
      retryable: false,
      details: { raw },
    },
  );
}

export class LocalHashSemanticVectorStore implements SemanticVectorStore {
  public readonly backend = "local_hash" as const;
  private readonly records = new Map<string, SemanticVectorChunkRecord>();
  private readonly defaultLimit: number;
  private readonly defaultMinSimilarity: number;
  private readonly maxRecords: number;
  private skippedUnsupportedEmbeddings = 0;

  public constructor(options: LocalHashSemanticVectorStoreOptions = {}) {
    this.defaultLimit = Math.max(1, options.defaultLimit ?? DEFAULT_LIMIT);
    this.defaultMinSimilarity = Math.max(0, options.defaultMinSimilarity ?? DEFAULT_MIN_SIMILARITY);
    this.maxRecords = Math.max(1, options.maxRecords ?? DEFAULT_MAX_LOCAL_HASH_RECORDS);
  }

  public async upsertChunks(records: readonly SemanticVectorChunkRecord[]): Promise<void> {
    for (const record of records) {
      if (!isSupportedEmbedding(record.embedding)) {
        this.skippedUnsupportedEmbeddings += 1;
        continue;
      }
      this.records.set(record.knowledgeRef, {
        ...record,
        embedding: [...record.embedding],
      });
      this.enforceCapacity();
    }
  }

  public async querySimilar(input: {
    query: string;
    namespace?: string;
    limit?: number;
    minSimilarity?: number;
  }): Promise<SemanticVectorCandidate[]> {
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
      .filter((candidate) => candidate.similarity >= (input.minSimilarity ?? this.defaultMinSimilarity))
      .sort((left, right) => {
        if (right.similarity === left.similarity) {
          return left.knowledgeRef.localeCompare(right.knowledgeRef);
        }
        return right.similarity - left.similarity;
      })
      .slice(0, input.limit ?? this.defaultLimit);
  }

  public inspect(): SemanticVectorStoreProfile {
    return {
      backend: this.backend,
      ready: true,
      details: {
        recordCount: this.records.size,
        maxRecords: this.maxRecords,
        skippedUnsupportedEmbeddings: this.skippedUnsupportedEmbeddings,
      },
    };
  }

  private enforceCapacity(): void {
    if (this.records.size <= this.maxRecords) {
      return;
    }
    const oldest = [...this.records.values()]
      .sort((left, right) => {
        if (left.updatedAt === right.updatedAt) {
          return left.knowledgeRef.localeCompare(right.knowledgeRef);
        }
        return left.updatedAt.localeCompare(right.updatedAt);
      })
      .slice(0, this.records.size - this.maxRecords);
    for (const record of oldest) {
      this.records.delete(record.knowledgeRef);
    }
  }
}

export interface PgvectorSemanticVectorStoreOptions {
  database: AsyncSqlDatabase;
  schema?: string;
  tableName?: string;
  extensionRequired?: boolean;
}

interface PgvectorQueryRow {
  knowledge_ref: string;
  namespace: string;
  similarity: number;
}

export class PgvectorSemanticVectorStore implements SemanticVectorStore {
  public readonly backend = "pgvector" as const;
  private readonly database: AsyncSqlDatabase;
  private readonly schema: string;
  private readonly tableName: string;
  private readonly extensionRequired: boolean;
  private readiness: Promise<void> | null = null;
  private ready = false;

  public constructor(options: PgvectorSemanticVectorStoreOptions) {
    this.database = options.database;
    this.schema = validateIdentifier(options.schema ?? "public", "knowledge.semantic_pgvector_schema_invalid");
    this.tableName = validateIdentifier(options.tableName ?? "knowledge_semantic_vectors", "knowledge.semantic_pgvector_table_invalid");
    this.extensionRequired = options.extensionRequired ?? true;
  }

  public async upsertChunks(records: readonly SemanticVectorChunkRecord[]): Promise<void> {
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
        await conn.execute(
          `
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
          `,
          record.knowledgeRef,
          record.chunkId,
          record.documentId,
          record.namespace,
          record.embeddingId,
          "local_hash_v1",
          toPgvectorLiteral(embedding),
          record.updatedAt,
        );
      }
    });
  }

  public async querySimilar(input: {
    query: string;
    namespace?: string;
    limit?: number;
    minSimilarity?: number;
  }): Promise<SemanticVectorCandidate[]> {
    await this.ensureReady();
    const embedding = buildSemanticEmbedding(input.query);
    if (!isSupportedEmbedding(embedding)) {
      return [];
    }
    const rows = await this.database.asyncConnection.query<PgvectorQueryRow>(
      `
        SELECT
          knowledge_ref,
          namespace,
          GREATEST(0, 1 - (embedding <=> CAST($1 AS vector(${SEMANTIC_VECTOR_DIMENSIONS})))) AS similarity
        FROM ${this.qualifiedTableName()}
        WHERE ($2::TEXT IS NULL OR namespace = $2)
          AND (1 - (embedding <=> CAST($1 AS vector(${SEMANTIC_VECTOR_DIMENSIONS})))) >= $3
        ORDER BY embedding <=> CAST($1 AS vector(${SEMANTIC_VECTOR_DIMENSIONS}))
        LIMIT $4
      `,
      toPgvectorLiteral(embedding),
      input.namespace ?? null,
      input.minSimilarity ?? DEFAULT_MIN_SIMILARITY,
      input.limit ?? DEFAULT_LIMIT,
    );
    return rows.rows.map((row) => ({
      knowledgeRef: row.knowledge_ref,
      namespace: row.namespace,
      similarity: Number(row.similarity.toFixed(6)),
    }));
  }

  public inspect(): SemanticVectorStoreProfile {
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

  private async ensureReady(): Promise<void> {
    if (this.readiness) {
      return this.readiness;
    }
    this.readiness = (async () => {
      const extension = await this.database.asyncConnection.queryOne<{ installed: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed",
      );
      if (!extension?.installed && this.extensionRequired) {
        throw new ValidationError(
          "knowledge.semantic_pgvector_extension_missing",
          "knowledge.semantic_pgvector_extension_missing",
          {
            retryable: false,
            details: {
              schema: this.schema,
              tableName: this.tableName,
            },
          },
        );
      }
      const table = await this.database.asyncConnection.queryOne<{ regclass: string | null }>(
        "SELECT to_regclass($1) AS regclass",
        `${this.schema}.${this.tableName}`,
      );
      if (!table?.regclass) {
        throw new ValidationError(
          "knowledge.semantic_pgvector_table_missing",
          "knowledge.semantic_pgvector_table_missing",
          {
            retryable: false,
            details: {
              schema: this.schema,
              tableName: this.tableName,
            },
          },
        );
      }
      this.ready = true;
    })();
    return this.readiness;
  }

  private qualifiedTableName(): string {
    return quoteQualifiedIdentifier(this.schema, this.tableName);
  }
}

export function createSemanticVectorStoreFromEnvironment(input: {
  env?: NodeJS.ProcessEnv;
  storageDriver?: "sqlite" | "postgres";
  database?: AsyncSqlDatabase | null;
} = {}): SemanticVectorStore {
  const backend = resolveSemanticVectorBackend(input.env);
  if (backend === "local_hash") {
    return new LocalHashSemanticVectorStore();
  }
  if (input.storageDriver !== "postgres" || input.database == null) {
    throw new ValidationError(
      "knowledge.semantic_pgvector_requires_postgres",
      "knowledge.semantic_pgvector_requires_postgres",
      {
        retryable: false,
        details: {
          storageDriver: input.storageDriver ?? null,
        },
      },
    );
  }
  return new PgvectorSemanticVectorStore({
    database: input.database,
    schema: input.env?.AA_KNOWLEDGE_PGVECTOR_SCHEMA?.trim() || "public",
    tableName: input.env?.AA_KNOWLEDGE_PGVECTOR_TABLE?.trim() || "knowledge_semantic_vectors",
    extensionRequired: input.env?.AA_KNOWLEDGE_PGVECTOR_EXTENSION_REQUIRED?.trim() !== "false",
  });
}

function validateIdentifier(value: string, code: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new ValidationError(code, code, {
      retryable: false,
      details: { value },
    });
  }
  return value;
}

function quoteQualifiedIdentifier(schema: string, tableName: string): string {
  return `"${schema}"."${tableName}"`;
}

function isSupportedEmbedding(embedding: readonly number[] | null): embedding is readonly number[] {
  return Array.isArray(embedding) && embedding.length === SEMANTIC_VECTOR_DIMENSIONS;
}

function toPgvectorLiteral(embedding: readonly number[]): string {
  return `[${embedding.map((value) => Number(value).toFixed(6)).join(",")}]`;
}
