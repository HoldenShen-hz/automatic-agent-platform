# Module Inventory

> Snapshot document. Last reviewed: 2026-04-14
> For latest code structure judgments, see [18_code_architecture.md](./18_code_architecture.md).
> For current progress and status, see [operations/project_progress_tracker.md](./operations/project_progress_tracker.md) and [operations/gap-analysis.md](./operations/gap-analysis.md).

## Maturity Legend

| Status | Description |
|--------|-------------|
| **Implemented** | In production path, core functionality verified |
| **Partial** | Core exists, some scenarios unverified or known issues |
| **Experimental** | Code exists, not validated in production path |
| **Stub** | Skeleton only, not functional |
| **Broken** | Known major issues requiring significant work |

## Runtime Core (`src/core/runtime/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Phase 1A Happy Path | `phase1a-happy-path.ts` | Implemented | Yes | Yes | Yes | ~589 lines, verified baseline |
| Phase 1B Orchestration | `phase1b-orchestration.ts` | Implemented | Yes | Partial | Yes | ~2380 lines, multi-step DAG |
| Transition Service | `transition-service.ts` | Implemented | Yes | Yes | Yes | Four state machines, ~484 lines |
| Execution Dispatch | `execution-dispatch-service.ts` | Implemented | Yes | Partial | Yes | ~1232 lines, Worker routing |
| Execution Lease | `execution-lease-service.ts` | Implemented | Yes | Yes | Yes | ~972 lines, fencing tokens |
| Worker Handshake | `execution-worker-handshake-service.ts` | Implemented | Yes | Yes | Yes | ~1166 lines |
| Worker Writeback | `execution-worker-writeback-service.ts` | Implemented | Yes | Yes | Yes | ~734 lines |
| Worker Registry | `worker-registry-service.ts` | Implemented | Yes | Partial | Yes | ~694 lines |
| Runtime Recovery | `runtime-recovery-service.ts` | Implemented | Yes | Partial | Yes | ~546 lines |
| Recovery Replay | `runtime-recovery-replay-service.ts` | Implemented | Yes | Partial | Yes | ~700 lines |
| Runtime Repair | `runtime-repair-service.ts` | Partial | Yes | No | No | ~595 lines, needs production validation |
| HA Coordinator | `ha-coordinator-service.ts` | Partial | No | Partial | Yes | ~839 lines, leader election |
| Hot Upgrade | `hot-upgrade-service.ts` | Experimental | No | No | No | ~706 lines, not production-validated |
| Cross-Region Deploy | `cross-region-deployment-service.ts` | Experimental | No | No | No | ~663 lines, not production-validated |
| Context Compaction | `context-compaction-service.ts` | Implemented | Yes | Partial | Yes | ~250 lines |
| Loop Detection | `loop-detection.ts` | Implemented | Yes | Partial | Yes | ~442 lines |
| Tight Loop Detection | `tight-loop-detector.ts` | Implemented | Yes | No | No | ~228 lines |
| Stall Detection | `stalled-execution-detector.ts` | Implemented | Yes | No | No | ~85 lines |
| Agent Executor | `agent-executor.ts` | Implemented | Yes | Partial | Yes | ~287 lines |
| Agent Middleware | `agent-middleware-chain.ts` | Implemented | Yes | Partial | Yes | ~467 lines |
| Model Call Provider | `model-call-provider.ts` | Implemented | Yes | Yes | Yes | ~254 lines |
| Effect Buffer | `effect-buffer.ts` | Implemented | Yes | Partial | Yes | ~545 lines |
| Complexity Router | `complexity-router.ts` | Implemented | Yes | No | No | ~151 lines |
| Coordinator Load Balance | `coordinator-load-balancing-service.ts` | Partial | No | No | No | ~245 lines |
| License Enforcement | `license-enforcement-service.ts` | Partial | No | No | No | ~583 lines |
| HITL Explainability | `hitl-explainability-service.ts` | Partial | No | No | No | ~582 lines |
| State Machine | `state-transition-machine.ts` | Implemented | Yes | Yes | Yes | ~20 lines, foundation only |
| Admission Controller | `admission-controller.ts` | Implemented | Yes | No | No | ~193 lines |
| Graceful Shutdown | `graceful-shutdown.ts` | Implemented | Yes | No | No | ~276 lines |

## Storage (`src/core/storage/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| SQLite Database | `sqlite-database.ts` | Implemented | Yes | Yes | Yes | ~624 lines |
| Phase1A Store | `phase1a-store.ts` | Implemented | Yes | Yes | Yes | ~8610 lines, core DAL |
| SQLite Migration Plan | `sqlite-migration-plan.ts` | Implemented | Yes | Yes | Yes | ~1380 lines, checksum validation |
| SQLite Reliability | `sqlite-reliability-service.ts` | Implemented | Yes | Partial | Yes | ~236 lines |
| Schema Compatibility Gate | `sqlite-schema-compatibility-gate.ts` | Implemented | Yes | No | Yes | ~172 lines |
| Migration Compatibility | `sqlite-migration-compatibility.ts` | Implemented | Yes | No | No | ~151 lines |
| PostgreSQL Database | `pg-database.ts` | Partial | No | No | Yes | ~483 lines, adapter issues |
| PostgreSQL Schema | `pg-schema.ts` | Partial | No | No | Yes | ~1026 lines |
| SQLite Wrapper | `sqlite-database-wrapper.ts` | Partial | No | No | Yes | ~111 lines, adapter issues |
| Storage Backend Factory | `storage-backend-factory.ts` | Implemented | Yes | Yes | Yes | ~313 lines |
| Storage Quota Service | `storage-quota-service.ts` | Implemented | Yes | No | No | ~230 lines |
| Phase1A Schema | `phase1a-schema.ts` | Implemented | Yes | Yes | Yes | ~818 lines, ~49 tables |
| Runtime Lifecycle Repo | `runtime-lifecycle-repository.ts` | Implemented | Yes | Partial | Yes | ~360 lines |
| Store Decorator | `phase1a-store-decorator.ts` | Implemented | Yes | No | No | ~71 lines |

## Events (`src/core/events/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Durable Event Bus | `durable-event-bus.ts` | Implemented | Yes | Yes | Yes | ~273 lines, Tier 1/2/3 |
| Typed Event Bus | `typed-event-bus.ts` | Implemented | Yes | Partial | Yes | ~186 lines |
| Event Registry | `event-registry.ts` | Implemented | Yes | Partial | Yes | ~330 lines |
| Event Types | `event-types.ts` | Implemented | Yes | Yes | Yes | ~92 lines |
| Event Ops Service | `event-ops-service.ts` | Partial | Yes | No | Yes | ~154 lines, retry incomplete |

## Security (`src/core/security/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Sandbox Policy | `sandbox-policy.ts` | Implemented | Yes | Yes | Yes | ~207 lines, 3 modes |
| Policy Engine | `policy-engine.ts` | Implemented | Yes | Partial | Yes | ~217 lines, risk categories |
| Secret Management | `secret-management-service.ts` | Partial | Yes | Partial | Yes | ~744 lines |
| External Secret Provider | `external-secret-provider.ts` | Partial | Yes | No | Yes | ~332 lines |
| Vault HTTP Provider | `vault-http-secret-provider.ts` | Partial | No | No | No | ~231 lines |
| AWS KMS Provider | `aws-kms-http-secret-provider.ts` | Partial | No | No | No | ~271 lines |
| CVE Intelligence | `cve-intelligence-service.ts` | Partial | No | No | No | ~563 lines |
| Data Classification | `data-classification-service.ts` | Partial | No | No | No | ~458 lines |
| Network Egress Policy | `network-egress-policy.ts` | Implemented | Yes | Partial | Yes | ~278 lines |
| Network Egress Audit | `network-egress-audit.ts` | Implemented | Yes | No | Yes | ~233 lines |
| Outbound URL Policy | `outbound-url-policy.ts` | Implemented | Yes | No | Yes | ~108 lines |

## Providers (`src/core/providers/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Unified Chat Provider | `unified-chat-provider.ts` | Implemented | Yes | Yes | Yes | ~438 lines |
| Model Routing | `model-routing-service.ts` | Implemented | Yes | Yes | Yes | ~542 lines |
| Provider Credential Pool | `provider-credential-pool.ts` | Implemented | Yes | Partial | Yes | ~743 lines |
| OpenAI Chat | `openai-chat-service.ts` | Implemented | Yes | Yes | Yes | ~617 lines |
| Anthropic Chat | `anthropic-chat-service.ts` | Implemented | Yes | Yes | Yes | ~580 lines |
| MiniMax Chat | `minimax-chat-service.ts` | Implemented | Yes | Yes | Yes | ~450 lines |

## Tools (`src/core/tools/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Command Executor | `command-executor.ts` | Implemented | Yes | Yes | Yes | ~483 lines, injection defense |
| Command Security | `command-security.ts` | Implemented | Yes | Yes | Yes | ~339 lines |
| Edit Replacement | `edit-replacement-service.ts` | Implemented | Yes | Yes | Yes | ~1689 lines |
| Tool Output Sanitizer | `tool-output-sanitizer.ts` | Implemented | Yes | Yes | Yes | ~459 lines, secret redaction |
| Tool Metadata | `tool-metadata.ts` | Implemented | Yes | Partial | Yes | ~593 lines |
| Tool Parallel Executor | `tool-parallel-executor.ts` | Implemented | Yes | Partial | Yes | ~436 lines |
| Skill Execution | `skill-execution-service.ts` | Implemented | Yes | Yes | Yes | ~1358 lines |
| Skill Creator | `skill-creator-service.ts` | Implemented | Yes | Partial | Yes | ~474 lines |
| Skill Governance | `skill-governance-service.ts` | Implemented | Yes | Partial | Yes | ~475 lines |
| Patch DSL | `patch-dsl-service.ts` | Implemented | Yes | Partial | Yes | ~978 lines |
| Tool Recommend | `tool-recommend-service.ts` | Implemented | Yes | Partial | Yes | ~615 lines |
| Semantic Repo Map | `semantic-repo-map-service.ts` | Implemented | Yes | Partial | Yes | ~610 lines |
| Code Diagnostics | `code-diagnostics-service.ts` | Implemented | Yes | No | No | ~317 lines |
| Shadow Snapshot | `shadow-snapshot-service.ts` | Implemented | Yes | Partial | Yes | ~306 lines |
| Edit Snapshot | `edit-snapshot-service.ts` | Implemented | Yes | No | No | ~268 lines |
| Question Tool | `question-tool.ts` | Implemented | Yes | No | No | ~243 lines |
| Todo Write | `todo-write-tool.ts` | Implemented | Yes | No | No | ~394 lines |
| Web Search | `web-search.ts` | Implemented | Yes | No | No | ~265 lines |
| Web Fetch | `web-fetch.ts` | Implemented | Yes | No | No | ~261 lines |
| Role Tool Exposure | `role-tool-exposure-service.ts` | Implemented | Yes | No | No | ~124 lines |
| Tool Contract Validator | `tool-contract-validator.ts` | Implemented | Yes | No | Yes | ~101 lines |
| Tool Argument Coercion | `tool-argument-coercion.ts` | Implemented | Yes | No | No | ~377 lines |
| MCP Tool Guard | `mcp-tool-guard.ts` | Implemented | Yes | No | No | ~179 lines |
| Tool Path Scope | `tool-path-scope.ts` | Implemented | Yes | No | No | ~72 lines |

## Observability (`src/core/observability/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Health Service | `health-service.ts` | Implemented | Yes | Yes | Yes | ok→degraded→overloaded→unhealthy |
| Structured Logger | `structured-logger.ts` | Implemented | Yes | Partial | Yes | Some raw console.* remains |
| Diagnostics Service | `diagnostics-service.ts` | Implemented | Yes | Partial | Yes | ~1120 lines |
| Inspect Service | `inspect-service.ts` | Implemented | Yes | Partial | Yes | ~966 lines |
| Metrics Service | `metrics-service.ts` | Partial | No | No | No | Incomplete implementation |
| SLO Alerting | `slo-alerting-service.ts` | Partial | No | No | Yes | ~649 lines, integration unverified |
| Anomaly Detection | `anomaly-detection-service.ts` | Partial | No | No | Yes | ~758 lines, integration unverified |
| Prometheus Exporter | `prometheus-metrics-exporter.ts` | Partial | No | No | Yes | No real /metrics endpoint |
| Diagnostics Export | `diagnostics-export-service.ts` | Implemented | Yes | No | No | |
| Observability Retention | `observability-retention-service.ts` | Partial | Yes | No | No | Persistence inadequate |
| SLI Collection | `sli-collection-service.ts` | Implemented | Yes | No | No | |
| Trace Context | `trace-context.ts` | Implemented | Yes | No | No | |
| Provider Health Tracker | `provider-health-tracker.ts` | Implemented | Yes | No | No | |
| Task Board | `task-board-service.ts` | Implemented | Yes | No | No | |
| Task Timeline | `task-timeline-service.ts` | Implemented | Yes | No | No | |

## Gateway (`src/gateway/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Channel Gateway Service | `channel-gateway-service.ts` | Implemented | Yes | Partial | Yes | ~634 lines |
| Channel Gateway Delivery | `channel-gateway-delivery-service.ts` | Implemented | Yes | Partial | Yes | ~906 lines |
| Channel Gateway Retry | `channel-gateway-retry-executor.ts` | Implemented | Yes | Partial | Yes | ~100 lines |
| Stream Bridge | `stream-bridge.ts` | Implemented | Yes | Partial | Yes | ~396 lines, SSE |
| Gateway Target Directory | `gateway-target-directory-service.ts` | Implemented | Yes | Partial | Yes | ~368 lines |

## Memory (`src/core/memory/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Memory Service | `memory-service.ts` | Implemented | Yes | Partial | Yes | ~285 lines |
| Memory Retrieval | `memory-retrieval-service.ts` | Implemented | Yes | Partial | Yes | ~407 lines |
| Experience Cache | `experience-cache-service.ts` | Implemented | Yes | Partial | Yes | ~520 lines |
| Memory Pollution Control | (distributed) | Partial | No | No | No | Functionality distributed across memory-service.ts, memory-quality.ts, memory-consolidation.ts; no independent file |
| Memory Schema | `memory-schema.ts` | Implemented | Yes | Yes | Yes | ~336 lines |
| Builtin Memory Provider | `builtin-memory-provider.ts` | Implemented | Yes | Partial | Yes | ~334 lines |
| Memory Consolidation | `memory-consolidation.ts` | Implemented | Yes | No | Yes | ~102 lines |
| Memory Quality | `memory-quality.ts` | Partial | No | No | No | ~183 lines, validation needed |

## Workflow & Orchestration (`src/core/orchestration/`, `src/core/workflow/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Intake Router | `intake-router.ts` | Implemented | Yes | Partial | Yes | ~693 lines |
| Workflow Planner | `workflow-planner.ts` | Implemented | Yes | Partial | Yes | |
| Minimal Workflow | `minimal-workflow.ts` | Implemented | Yes | Yes | Yes | |
| Workflow Validator | `workflow-validator.ts` | Implemented | Yes | Yes | Yes | |
| Division Loader | `division-loader.ts` | Implemented | Yes | Partial | Yes | ~1292 lines |
| Approval Service | `approval-service.ts` | Implemented | Yes | Partial | Yes | HITL |

## Product/Business (`src/core/product/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Billing Service | `billing-service.ts` | Implemented | Yes | Partial | Yes | ~687 lines |
| PMF Validation | `pmf-validation-service.ts` | Implemented | Yes | Partial | Yes | ~697 lines |
| Marketplace Governance | `marketplace-governance-service.ts` | Implemented | Yes | Partial | Yes | ~585 lines |
| Perception Service | `perception-service.ts` | Implemented | Yes | Partial | Yes | ~527 lines |
| Enterprise Capability Matrix | `enterprise-capability-matrix-service.ts` | Stub | No | No | No | ~522 lines, skeleton only |
| Data Plane Flow | `data-plane-flow-service.ts` | Partial | No | No | No | ~469 lines |
| Platform Operator | `platform-operator-service.ts` | Partial | No | No | No | ~430 lines |
| Tenant Platform | `tenant-platform-service.ts` | Partial | No | No | No | ~404 lines |
| Billing Payment Gateway | `billing-payment-gateway.ts` | Stub | No | No | No | ~132 lines, unusable |
| Compliance Program | `compliance-program-service.ts` | Stub | No | No | No | ~129 lines |
| Cost Estimation | `cost-estimation-service.ts` | Partial | No | No | No | ~113 lines |
| HA Program | `ha-program-service.ts` | Partial | No | No | No | ~160 lines |

## Ops (`src/core/ops/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Doctor Service | `doctor-service.ts` | Implemented | Yes | Partial | Yes | ~723 lines |
| Human Takeover | `human-takeover-service.ts` | Implemented | Yes | Partial | Yes | ~746 lines |
| Enterprise Governance | `enterprise-governance-service.ts` | Implemented | Yes | Partial | Yes | ~953 lines |
| Release Pipeline | `release-pipeline-service.ts` | Implemented | Yes | Partial | Yes | ~798 lines |
| Operations Governance | `operations-governance-service.ts` | Implemented | Yes | Partial | Yes | ~648 lines |
| Auto Stop Loss | `auto-stop-loss-service.ts` | Implemented | Yes | Partial | Yes | ~637 lines |
| Deployment Execution | `deployment-execution-service.ts` | Implemented | Yes | Partial | Yes | ~636 lines |
| Environment Deployment | `environment-deployment-service.ts` | Partial | No | No | No | |
| Tenant Execution Isolation | `tenant-execution-isolation-service.ts` | Partial | No | No | No | |
| Workflow Dispatch Receipt | `workflow-dispatch-receipt.ts` | Implemented | Yes | No | No | |
| Runtime Version Snapshot | `runtime-version-snapshot.ts` | Partial | No | No | No | |

## API (`src/core/api/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| HTTP API Server | `http-api-server.ts` | Implemented | Yes | Partial | Yes | ~1346 lines |
| OIDC OAuth | `oidc-oauth-service.ts` | Partial | No | No | Yes | ~668 lines, incomplete integration |
| API Auth | `api-auth-service.ts` | Partial | No | No | No | |
| Mission Control | `mission-control-service.ts` | Partial | No | No | No | |
| OpenAPI Document | `openapi-document.ts` | Partial | No | No | No | |

## Stability (`src/core/stability/`)

| Module | File | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Stable Release Gate | `stable-release-gate.ts` | Implemented | N/A | Yes | Yes | ~662 lines |
| Stable Evidence Bundle | `stable-evidence-bundle.ts` | Implemented | N/A | Yes | Yes | ~937 lines |
| Stable Evidence Campaign | `stable-evidence-campaign.ts` | Implemented | N/A | Yes | Yes | ~414 lines |
| Stable Chaos Smoke | `stable-chaos-smoke.ts` | Implemented | N/A | Yes | Yes | ~496 lines |
| Stable Concurrency Rehearsal | `stable-concurrency-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~462 lines |
| Stable Dispatch Rehearsal | `stable-dispatch-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~536 lines |
| Stable Lease Rehearsal | `stable-lease-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~435 lines |
| Stable Rollback Rehearsal | `stable-rollback-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~521 lines |
| Stable Rolling Upgrade | `stable-rolling-upgrade-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~518 lines |
| Stable Worker Handshake | `stable-worker-handshake-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~454 lines |
| Stable Worker Writeback | `stable-worker-writeback-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~380 lines |
| Stable Queue Delivery | `stable-queue-delivery-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~380 lines |
| Stable DB Queue Disconnect | `stable-db-queue-disconnect-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~408 lines |
| Stable DB Writability | `stable-db-writability-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~340 lines |
| Stable Backup Restore | `stable-backup-restore-rehearsal.ts` | Partial | N/A | Partial | Yes | ~254 lines, coverage inadequate |
| Stable Migration Compat | `stable-migration-compatibility-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~122 lines |
| Stable Cross Division Recovery | `stable-cross-division-recovery-drill.ts` | Implemented | N/A | Yes | Yes | ~358 lines |
| Stable Runtime Soak | `stable-runtime-soak-runner.ts` | Implemented | N/A | Yes | Yes | ~131 lines |
| Stable Runtime Validator | `stable-runtime-validator.ts` | Implemented | N/A | Yes | Yes | ~394 lines |
| Stable Acceptance Line | `stable-acceptance-line.ts` | Implemented | N/A | Yes | Yes | ~310 lines |
| Stable Maintenance | `stable-maintenance-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~579 lines |
| Stable Gray Release | `stable-gray-release-rehearsal.ts` | Partial | N/A | Partial | Yes | ~578 lines, production validation incomplete |
| Stable Release Package | `stable-release-package.ts` | Implemented | N/A | Yes | Yes | ~570 lines |
| Stable Event Replay | `stable-event-replay-rehearsal.ts` | Implemented | N/A | Yes | Yes | ~195 lines |
| Stable Prompt Injection | `stable-prompt-injection-red-team.ts` | Implemented | N/A | Yes | Yes | ~165 lines |
| VCR Replay Fixture | `vcr-replay-fixture.ts` | Implemented | N/A | Yes | Yes | ~207 lines |
| Golden Task Runner | `golden-task-runner.ts` | Implemented | N/A | Yes | Yes | ~296 lines |

## Other Modules

| Module | Path | Status | Hot Path | Tested | Contract | Notes |
|--------|------|--------|----------|--------|----------|-------|
| Distributed Lock | `src/core/locking/distributed-lock-service.ts` | Implemented | Yes | Partial | Yes | ~778 lines |
| Queue Adapter | `src/core/queue/queue-adapter.ts` | Partial | No | No | Yes | ~1176 lines, PG adapter issues |
| Evolution MVP | `src/core/evolution/evolution-mvp-service.ts` | Experimental | No | No | No | ~754 lines |
| Artifact Store | `src/core/artifacts/artifact-store.ts` | Implemented | Yes | Partial | Yes | |
| Process Tracker | `src/core/resource/process-tracker.ts` | Implemented | Yes | No | No | |
| Result Envelope | `src/core/results/result-envelope.ts` | Implemented | Yes | No | No | |
| Message Parts | `src/core/messages/message-parts.ts` | Implemented | Yes | No | No | |
| Token Estimator | `src/core/messages/token-estimator.ts` | Implemented | Yes | No | No | |
| Audit Export | `src/core/compliance/audit-export-service.ts` | Implemented | Yes | No | No | |
| Traffic Routing | `src/core/deployment/traffic-routing-service.ts` | Implemented | Yes | No | No | |
| HR Role Governance | `src/core/hr/hr-role-governance-service.ts` | Implemented | Yes | No | No | |
| LLM Eval | `src/core/evaluation/llm-eval-service.ts` | Implemented | Yes | No | No | |
| Prompt Model Policy | `src/core/evaluation/prompt-model-policy-governance-service.ts` | Implemented | Yes | No | No | |

## Summary Statistics

| Category | Total | Implemented | Partial | Experimental | Stub |
|----------|-------|-------------|---------|--------------|------|
| Runtime | 27 | 20 | 5 | 2 | 0 |
| Storage | 13 | 10 | 3 | 0 | 0 |
| Events | 5 | 4 | 1 | 0 | 0 |
| Security | 11 | 5 | 6 | 0 | 0 |
| Providers | 6 | 6 | 0 | 0 | 0 |
| Tools | 24 | 24 | 0 | 0 | 0 |
| Observability | 14 | 8 | 6 | 0 | 0 |
| Gateway | 5 | 5 | 0 | 0 | 0 |
| Memory | 8 | 6 | 2 | 0 | 0 |
| Workflow/Orchestration | 6 | 6 | 0 | 0 | 0 |
| Product | 12 | 4 | 5 | 0 | 3 |
| Ops | 11 | 7 | 4 | 0 | 0 |
| API | 5 | 1 | 4 | 0 | 0 |
| Testing | 27 | 25 | 2 | 0 | 0 |
| Other | 13 | 11 | 1 | 1 | 0 |
| **Total** | **187** | **142** | **39** | **3** | **3** |

## Missing Test Coverage

Modules without tests that need coverage:
- `runtime-repair-service.ts`
- `event-ops-service.ts` (retry logic)
- `ha-coordinator-service.ts`
- `hot-upgrade-service.ts`
- `cross-region-deployment-service.ts`
- `license-enforcement-service.ts`
- `cve-intelligence-service.ts`
- `metrics-service.ts`
- `observability-retention-service.ts`
- `queue-adapter.ts` (PostgreSQL path)
- `stable-backup-restore-rehearsal.ts` (coverage inadequate)
