import { newId, nowIso } from "../../contracts/types/ids.js";
import { buildSemanticEmbedding, semanticEmbeddingId } from "./semantic-embedding.js";
import { createSemanticVectorStoreFromEnvironment, resolveSemanticVectorBackend, } from "./semantic-vector-store.js";
export async function validateSemanticVectorReadiness(options) {
    const env = options.env ?? process.env;
    const schema = validateIdentifier(env.AA_KNOWLEDGE_PGVECTOR_SCHEMA?.trim() || "public");
    const tableName = validateIdentifier(env.AA_KNOWLEDGE_PGVECTOR_TABLE?.trim() || "knowledge_semantic_vectors");
    const warnings = [];
    const checks = [];
    const rawBackend = env.AA_KNOWLEDGE_VECTOR_BACKEND?.trim() ?? env.AA_KNOWLEDGE_SEMANTIC_BACKEND?.trim() ?? "local_hash";
    const report = {
        validatedAt: nowIso(),
        storageDriver: options.storageDriver,
        vectorBackend: rawBackend,
        databaseFilePath: options.database?.filePath ?? null,
        schema,
        tableName,
        ready: false,
        warnings,
        checks,
    };
    const pushCheck = (check) => {
        checks.push(check);
    };
    const finalize = () => {
        report.ready = checks.every((check) => !check.required || check.ok);
        return report;
    };
    pushCheck({
        name: "storage_driver_postgres",
        ok: options.storageDriver === "postgres",
        required: true,
        errorCode: options.storageDriver === "postgres" ? null : "knowledge.semantic_readiness_requires_postgres_driver",
        errorMessage: options.storageDriver === "postgres" ? null : "knowledge.semantic_readiness_requires_postgres_driver",
        details: {
            observedStorageDriver: options.storageDriver,
        },
    });
    if (options.storageDriver !== "postgres") {
        return finalize();
    }
    let backend = rawBackend;
    try {
        backend = resolveSemanticVectorBackend(env);
    }
    catch (error) {
        pushCheck({
            name: "semantic_backend_pgvector",
            ok: false,
            required: true,
            errorCode: error instanceof Error ? error.message : "knowledge.semantic_backend_invalid",
            errorMessage: error instanceof Error ? error.message : String(error),
            details: {
                observedBackend: rawBackend,
            },
        });
        return finalize();
    }
    report.vectorBackend = backend;
    pushCheck({
        name: "semantic_backend_pgvector",
        ok: backend === "pgvector",
        required: true,
        errorCode: backend === "pgvector" ? null : "knowledge.semantic_readiness_requires_pgvector_backend",
        errorMessage: backend === "pgvector" ? null : "knowledge.semantic_readiness_requires_pgvector_backend",
        details: {
            observedBackend: backend,
        },
    });
    if (backend !== "pgvector") {
        return finalize();
    }
    pushCheck({
        name: "database_available",
        ok: options.database != null,
        required: true,
        errorCode: options.database != null ? null : "knowledge.semantic_readiness_database_missing",
        errorMessage: options.database != null ? null : "knowledge.semantic_readiness_database_missing",
        details: {
            databaseFilePath: options.database?.filePath ?? null,
        },
    });
    if (options.database == null) {
        return finalize();
    }
    const extensionInstalled = Boolean((await options.database.asyncConnection.queryOne("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed"))?.installed);
    pushCheck({
        name: "pgvector_extension_installed",
        ok: extensionInstalled,
        required: true,
        errorCode: extensionInstalled ? null : "knowledge.semantic_pgvector_extension_missing",
        errorMessage: extensionInstalled ? null : "knowledge.semantic_pgvector_extension_missing",
        details: {
            schema,
            tableName,
        },
    });
    if (!extensionInstalled) {
        return finalize();
    }
    const tablePresent = Boolean((await options.database.asyncConnection.queryOne("SELECT to_regclass($1) AS regclass", `${schema}.${tableName}`))?.regclass);
    pushCheck({
        name: "semantic_table_present",
        ok: tablePresent,
        required: true,
        errorCode: tablePresent ? null : "knowledge.semantic_pgvector_table_missing",
        errorMessage: tablePresent ? null : "knowledge.semantic_pgvector_table_missing",
        details: {
            qualifiedTableName: `${schema}.${tableName}`,
        },
    });
    if (!tablePresent) {
        return finalize();
    }
    const ivfflatIndexPresent = Boolean((await options.database.asyncConnection.queryOne(`
      SELECT EXISTS(
        SELECT 1
        FROM pg_index index_def
        JOIN pg_class index_rel ON index_rel.oid = index_def.indexrelid
        JOIN pg_class table_rel ON table_rel.oid = index_def.indrelid
        JOIN pg_namespace table_ns ON table_ns.oid = table_rel.relnamespace
        JOIN pg_am access_method ON access_method.oid = index_rel.relam
        WHERE table_ns.nspname = $1
          AND table_rel.relname = $2
          AND access_method.amname = 'ivfflat'
      ) AS present
    `, schema, tableName))?.present);
    pushCheck({
        name: "semantic_ivfflat_index_present",
        ok: ivfflatIndexPresent,
        required: false,
        errorCode: null,
        errorMessage: null,
        details: {
            schema,
            tableName,
            accessMethod: "ivfflat",
        },
    });
    if (!ivfflatIndexPresent) {
        warnings.push("knowledge.semantic_pgvector_ivfflat_missing");
    }
    const store = createSemanticVectorStoreFromEnvironment({
        env,
        storageDriver: options.storageDriver,
        database: options.database,
    });
    const probeId = newId("semantic_probe");
    const probeText = `semantic readiness probe build retry cache ${probeId}`;
    const probeNamespace = "system/readiness";
    const probeKnowledgeRef = `knowledge:${probeId}`;
    const probeEmbedding = buildSemanticEmbedding(probeText);
    let roundtripOk = false;
    let cleanupDeleted = 0;
    try {
        await store.upsertChunks([{
                knowledgeRef: probeKnowledgeRef,
                chunkId: `chunk_${probeId.slice(-12)}`,
                documentId: `document_${probeId.slice(-12)}`,
                namespace: probeNamespace,
                embeddingId: semanticEmbeddingId(probeText),
                embedding: probeEmbedding,
                updatedAt: nowIso(),
            }]);
        const similar = await store.querySimilar({
            query: probeText,
            namespace: probeNamespace,
            limit: 3,
            minSimilarity: 0.2,
        });
        roundtripOk = similar.some((candidate) => candidate.knowledgeRef === probeKnowledgeRef);
        pushCheck({
            name: "semantic_roundtrip",
            ok: roundtripOk,
            required: true,
            errorCode: roundtripOk ? null : "knowledge.semantic_pgvector_roundtrip_failed",
            errorMessage: roundtripOk ? null : "knowledge.semantic_pgvector_roundtrip_failed",
            details: {
                probeKnowledgeRef,
                namespace: probeNamespace,
                hitCount: similar.length,
                topHitKnowledgeRef: similar[0]?.knowledgeRef ?? null,
                topHitSimilarity: similar[0]?.similarity ?? null,
                backend: store.inspect().backend,
            },
        });
    }
    finally {
        cleanupDeleted = await options.database.asyncConnection.execute(`DELETE FROM ${schema}.${tableName} WHERE knowledge_ref = $1`, probeKnowledgeRef).catch(() => 0);
    }
    const roundtripCheck = checks.find((check) => check.name === "semantic_roundtrip");
    if (roundtripCheck) {
        roundtripCheck.details.cleanupDeleted = cleanupDeleted;
    }
    return finalize();
}
function validateIdentifier(value) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
        throw new Error(`knowledge.semantic_pgvector_identifier_invalid:${value}`);
    }
    return value;
}
//# sourceMappingURL=semantic-vector-validation.js.map