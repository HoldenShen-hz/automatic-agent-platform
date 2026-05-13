# Production Storage And Queue Contract

---

## OAPEFLIR Related

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the formal path from the current transactional storage baseline to industrial-grade PostgreSQL + Redis/BullMQ queues.

It answers the question: after the platform enters production, which data must be placed in the authoritative relational store, which responsibilities go to queue/broker, and which designs must from now on be constrained by PG semantics.

Related documents:

- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `execution_plane_contract.md`
- `event_bus_contract.md`

## 2. Goals

- Clarify division of responsibilities among transactional truth, queue dispatch, and cache.
- Avoid implementation over-binding to SQLite characteristics.
- Freeze PG semantics-prioritized repository / migration rules in advance.
- Provide clear boundaries for Redis/BullMQ as execution queue.

## 3. Production Data Tiering

| Tier | Primary Backend | Responsible Content |
| --- | --- | --- |
| `transaction store` | PostgreSQL | task, workflow, execution, approval, lease, audit, quota authoritative truth |
| `queue / dispatch` | Redis + BullMQ | execution ticket, delayed queue, retry queue, dead-letter routing |
| `artifact store` | object storage / file store | large files, reports, attachments, export packages |
| `knowledge / rollout store` | PostgreSQL + pgvector | knowledge namespace metadata, semantic vector index, rollout record, strategy lineage |
| `analytics / replay` | PG secondary or follow-up analysis storage | usage, cost, evaluation, ops aggregation |

## 4. Key Invariants

- Authoritative task / execution state must not exist solely in queue.
- If queue message is lost, it must be reconstructable from transaction store.
- Dispatch queue is responsible for "delivery and retry", not "final truth state".
- PG schema design takes priority over SQLite convenience features.
- rollout / strategy / knowledge namespace metadata must not be retained only in cache or artifact.
- If knowledge semantic embedding uses external vector retrieval, authoritative vector index must be reconstructable by PG/pgvector; must not exist only in in-process cache.

## 5. Production Recommended Topology

```mermaid
flowchart LR
    A["API / Gateway"] --> B["Coordinator / Control Plane"]
    B --> C["PostgreSQL"]
    B --> D["Redis / BullMQ"]
    D --> E["Execution Workers"]
    E --> C
    E --> F["Artifact Store"]
    C --> G["Audit / Reporting"]
```

## 6. PostgreSQL Semantic Requirements

- All repository designs must be compatible with row-level locks, transactions, unique constraints, foreign keys, and JSONB.
- SQLite-specific implementation methods must not be written as contract truth.
- Migrations must from the start support validation on PG.
- Any "only works under SQLite" shortcuts must be registered as technical debt.
- Knowledge semantic infra target backend is `pgvector`; schema should include `knowledge_semantic_vectors` or equivalent table, using `knowledge_ref` as stable key, and retain `chunk_id`, `document_id`, `namespace`, `embedding_id`, `embedding_model`, `embedding vector(32)`, `updated_at`.
- When pgvector extension is missing, migration can fail-soft and retain notice, but runtime with explicitly selected `AA_KNOWLEDGE_VECTOR_BACKEND=pgvector` must fail-close.
- Semantic query should sort via `embedding <=> query_vector` or equivalent cosine distance semantics; keyword score must not be disguised as vector similarity.
- Repository must provide executable pgvector readiness / roundtrip check entry; currently `knowledge-semantic-readiness` CLI performs extension/table/ivfflat/roundtrip validation against `AA_STORAGE_DRIVER=postgres` + `AA_KNOWLEDGE_VECTOR_BACKEND=pgvector`, and fails-close on failure.
- When `AA_STORAGE_DRIVER=postgres`, startup preflight / doctor must first perform fail-close validation on DSN, SSL, pool sizing, dual-run switch, and shadow SQLite path; cannot enable postgres driver if validation fails.

## 7. Queue Semantic Requirements

- Dispatch at least-once delivery.
- Queue consumption success does not equal business success; must wait for authoritative writeback.
- Delay, retry, and dead-letter are managed by queue, but decision source still comes from control plane.
- Duplicate delivery must rely on idempotency key + fencing token protection.

## 8. Dual-Run and Migration Suggestions

Industrial-grade progression order:

1. Repository first implements interface by PG semantics.
2. Migration performs compatibility validation on both SQLite and PG sides.
3. Queue first validates in single-instance mode, then goes to Redis/BullMQ.
4. Complete PG + queue drill before production; do not delay switch after Phase 4.

Knowledge semantic infra migration route:

1. `Current`: Local hash embedding + archive scan / in-memory vector store can be used for development and non-PG environments.
2. `Transition`: `SemanticVectorStore` abstraction supports both `local_hash` and `pgvector` simultaneously; API query path uses async retrieval, can wait for vector index write.
3. `Target`: Production enables PostgreSQL + pgvector, `knowledge_semantic_vectors` written by ingestion pipeline, semantic query goes through pgvector distance sorting; after snapshot restore, semantic vector index must also be backfillable. Repository readiness CLI and roundtrip validation are complete, but real PG environment must still complete live validation evidence.

## 9. Consistency Model

| Object | Consistency |
| --- | --- |
| task / execution / lease | Strongly consistent |
| approval decision | Strongly consistent |
| queue delivery | At least once |
| UI progress | Eventually consistent |
| analytics aggregation | Lazily consistent |

## 10. Failure and Fallback

- When Redis/BullMQ is unavailable, system should enter admission control or degrade; must not silently drop tasks.
- When PG is unwritable, must not continue accepting tasks requiring authoritative state.
- When `AA_STORAGE_DRIVER=postgres`, startup preflight / doctor must first perform fail-close validation on DSN, SSL, pool sizing, dual-run switch and shadow SQLite path; if validation fails, cannot enable postgres driver.
- Queue and DB write inconsistency should prioritize trusting DB truth and triggering repair job.

## 11. Phase Boundaries

Currently:

- Documents and repository first design by PG/queue semantics
- Implementation allowed to start from single-machine baseline

Must complete before entering production:

- PG migration compatibility test
- Queue replay / duplicate delivery drill
- DB/queue disconnection fault drill
- rollout / strategy lineage consistency drill

## 12. Closure Conclusion

Industrial-grade production cannot treat PostgreSQL and queue as just "future replacements".

From documents and contracts onward, design must follow the structure of "transactional truth in PG, scheduling delivery in queue, duplicate delivery guaranteed by idempotency and fencing".