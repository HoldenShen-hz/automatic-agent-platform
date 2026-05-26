# System-Level Manual Review (2026-05-26)

| Field | Content |
|---|---|
| Review Date | 2026-05-26 |
| Review Scope | `src/`, `ui/`, `.github/workflows/`, `docs_zh/reference/` |
| Review Method | Manual sampling of high-risk chains: event delivery, execution identity, federation governance, UI shell bridging, CI architecture gates |
| Current Conclusion | System backbone is largely complete, but there remain 6 priority issues to address: 1 directly breaks Tier-1 event reliability, 3 are "governance/audit state not persisted", 1 is missing CI gate, 1 is Electron shell bridging failure. |

---

## Issue List

| ID | Severity | Issue | Review Conclusion | Root Cause Classification | Evidence |
|---|---|---|---|---|---|
| SYS-001 | P0 | `DurableEventBusAsync` swallows async handler rejections, causing events to be incorrectly acked | Not resolved. The async facade converts consumer failures to success returns; `DurableEventBus` then calls `markEventAck`, bypassing Tier-1 retry/DLQ semantics. | Reliability defect / async contract violation | `src/platform/five-plane-state-evidence/events/durable-event-bus-async.ts:44-52`; `src/platform/five-plane-state-evidence/events/durable-event-bus.ts:575-595` |
| SYS-002 | P1 | Worker identity registration returns success on persistence failure, and preferentially uses in-memory auth | Not resolved. Registration path writes to `memoryStore` first; persistence failure is silently swallowed; claims continue to pass in same process, but identity is lost after restart, creating split behavior ("accept in current process, reject after restart"). | State consistency / silent failure | `src/platform/five-plane-execution/worker-pool/worker-service-identity.ts:49-82`; `src/platform/five-plane-execution/worker-pool/worker-service-identity.ts:109-163` |
| SYS-003 | P1 | Federation audit claims 7-year retention, but implementation only stores in-process memory | Not resolved. `FederationAudit` only has `Map`/`Set` indexes and memory records; no disk persistence, replay, or external storage injection; all audit traces are lost after process restart, inconsistent with compliance retention claims. | Governance capability not persisted | `src/scale-ecosystem/federation/federation-audit.ts:75-112`; `src/scale-ecosystem/federation/federation-audit.ts:142-190` |
| SYS-004 | P1 | Federation trust relationship is purely in-memory model; revocation/degradation/revocation state cannot survive restarts | Not resolved. `TrustRelationshipManager` uses in-memory `Map` for trust/policy/event/index; create, revoke, degrade all write no source of truth; governance state for multi-org collaboration resets after process restart. | Governance capability not persisted | `src/scale-ecosystem/federation/trust-relationship.ts:94-148`; `src/scale-ecosystem/federation/trust-relationship.ts:179-240` |
| SYS-005 | P1 | Architecture boundary lint not integrated into main CI, but reference docs mark `CI-001` as completed | Not resolved. Repo already has `lint:architecture-boundary` command, but `ci.yml`'s `validate` job doesn't execute it; also reference doc `automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md` already marks `CI-001` as `completed`, so documentation and pipeline actual state are inconsistent. | Engineering governance / documentation state drift | `package.json:222`; `.github/workflows/ci.yml:24-59`; `docs_zh/reference/automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md:1391-1396` |
| SYS-006 | P1 | Electron preload exposes bridge name that doesn't match runtime adapter's reading name; desktop bridge effectively broken | Not resolved. Preload exposes bridge via `contextBridge.exposeInMainWorld("AA_ELECTRON", bridge)`, but `ElectronPlatformAdapter` reads `window.__AA_ELECTRON__`; this causes secure storage, deep link, shell and other capabilities to fall back to default adapter indefinitely. | Interface contract inconsistency | `ui/apps/electron-win/src/preload.ts:27-35`; `ui/packages/shared/platform/src/desktop-platform-adapter.ts:11-25` |

---

## Root Cause Summary

1. Async facade destroys main chain success/failure semantics in the name of "avoiding unhandled rejections".
2. Multiple governance subsystems still use in-process state, lacking authoritative store or recovery mechanism.
3. Documentation closure claims precede actual CI implementation, creating drift between "documentation complete, pipeline not enforced".
4. UI shell has bridge name inconsistency contract bug, causing platform capabilities to appear present but not actually function.

---

## Recommended Priority

1. Fix `SYS-001` first - this is the most direct reliability breach, causing Tier-1 event failures to be incorrectly recorded as success.
2. Second batch: handle `SYS-002`, `SYS-003`, `SYS-004` - converge worker identity, federation audit, and trust relationship to recoverable source of truth.
3. Third batch: handle `SYS-005`, `SYS-006` - tighten CI governance and fix Electron real bridge respectively.

---

## Notes

1. This document only records manually confirmed real issues from this round; it does not delete existing review document content.
2. This round did not perform full testing, nor code fixes for the above issues; current output is only review conclusion and evidence archival.

---

## Second Round Deep Cross-Review Addendum (2026-05-26)

This round additionally checked federation governance, UI API contracts, frontend/backend path systems, and cross-consistency between documentation and implementation. The following issues are added to the same system review ledger.

| ID | Severity | Issue | Review Conclusion | Root Cause Classification | Evidence |
|---|---|---|---|---|---|
| SYS-007 | P1 | `FederationAudit.query()` only uses the first index to narrow candidate set, but doesn't continue to validate other filter conditions like `actor/action/correlationId/orgId` | Not resolved. Multi-condition queries exhibit "filter by first condition only, subsequent conditions ignored" incorrect results; audit retrieval results are unreliable. | Query semantics defect / audit inconsistency | `src/scale-ecosystem/federation/federation-audit.ts:152-191` |
| SYS-008 | P1 | Federation audit retention claims to support archive-before-delete, but actually only increments `archived` count with no actual archive destination | Not resolved. `applyRetentionPolicy()` with `archiveBeforeDelete=true` only performs comment placeholder logic; eventually returns "archived" but has no real archive evidence. | Governance capability not closed / fake archiving | `src/scale-ecosystem/federation/federation-audit.ts:276-298` |
| SYS-009 | P1 | Trust policy `expiresAt`, `requirePeriodicReauth`, `reauthIntervalDays` only participate in scoring, not in admission blocking | Not resolved. `getTrustBetweenOrgs()` only checks `status === "active"`, does not reject due to expiration or reauth window exceeded; `calculateTrustFactors()` only reduces score without triggering `expired/suspended` state migration. | Governance policy not enforced | `src/scale-ecosystem/federation/trust-relationship.ts:163-176`; `src/scale-ecosystem/federation/trust-relationship.ts:404-413`; `src/scale-ecosystem/federation/trust-relationship.ts:477-481` |
| SYS-010 | P1 | UI default API prefix, endpoint catalog path, and real paths in tests/documentation are inconsistent; frontend/backend integration defaults to wrong address | Not resolved. Web runtime defaults `baseUrl=/api`, endpoint catalog uses `/tasks`, `/workflows` unversioned paths; after concatenation gets `/api/tasks`; but tests and architecture docs use `/api/v1/tasks`, `/api/v1/dashboard/*` as standard. | Interface contract drift / version prefix inconsistency | `ui/apps/web/src/runtime.ts:143-149`; `ui/packages/shared/api-client/src/rest-client.ts:334-335`; `ui/packages/shared/api-client/src/endpoints.ts:177-190`; `docs_zh/architecture/05-cross-platform-ui-architecture.md:2482-2487`; `ui/tests/tools/tooling.test.ts:11-12` |
| SYS-011 | P1 | UI endpoint catalog marks several interfaces as `planned: false` / directly consumable, but corresponding backend routes and OpenAPI don't exist | Not resolved. Current at least the following drift examples exist: `/dashboard/metrics`, `/marketplace`, `/workflows/builder`, `/knowledge`, `/packs/:packId/versions`, `/explanations`. Frontend calls them as implemented interfaces; backend route table and OpenAPI don't have corresponding capabilities. | Frontend/backend contract mismatch / status labeling error | `ui/packages/shared/api-client/src/endpoints.ts:205-221`; `src/platform/five-plane-interface/api/openapi-document.ts:1-120`; `src/platform/five-plane-interface/api/http-server/pack-routes.ts:1-146`; route scan of `src/platform/five-plane-interface/api/http-server/` found no corresponding implementations for `/v1/marketplace`, `/v1/workflows/builder`, `/v1/explanations`, `/v1/dashboard/metrics` |
| SYS-012 | P2 | Shared Mission Control query layer directly consumes Layer B's `/admin/workers`, `/admin/queues`, conflicting with UI architecture "frontend only consumes Layer C" requirement | Not resolved. Endpoint catalog already marks `workers`, `queues` as `apiLayer: "B"`, but shared query layer still exposes them as general mission-control data sources; this solidifies internal admin-plane contracts into the public frontend layer long-term. | Architecture layer violation | `ui/packages/shared/api-client/src/endpoints.ts:202-203`; `ui/packages/shared/state/src/queries/mission-control-queries.ts:23-29`; `docs_zh/architecture/05-cross-platform-ui-architecture.md:2518-2548` |

### Second Round Supplementary Conclusions

1. The main problem with the federation governance module has shifted from "whether capability exists" to "whether query, retention, and policy enforcement are truly closed-loop".
2. The biggest risk of the UI subsystem is not whether features exist, but "path prefix, Layer marker, and interface completion status" three sets of metrics haven't converged to one authoritative contract.
3. The area most likely to cause integration misjudgment in the current system is the shared api client: it appears quite complete on the surface, but some endpoints still outpace the backend's actual routes and OpenAPI.

---

## Fix Result Writeback (2026-05-26)

The following writeback does not delete previous review records; it only supplements the latest status of "whether currently closed", root cause, and evidence.

| ID | Current Conclusion | Root Cause | Fix Basis | Targeted Testing |
|---|---|---|---|---|
| SYS-001 | Fixed. `DurableEventBusAsync` no longer swallows async consumer rejections; failures propagate back through original chain to durable bus, avoiding incorrect `ack` of Tier-1 events. | Async facade converts failures to success to avoid unhandled rejections, breaking success/failure contract. | `src/platform/five-plane-state-evidence/events/durable-event-bus-async.ts` | `tests/unit/platform/state-evidence/events/durable-event-bus-async.test.ts` |
| SYS-002 | Fixed. Worker identity registration changed to persist first, then enter in-memory state; persistence failure fails closed, bad-format durable payload also rejects auth. | Original implementation wrote memory first then tried to persist, and swallowed persistence exceptions, causing same-process accept / post-restart reject. | `src/platform/five-plane-execution/worker-pool/worker-service-identity.ts` | `tests/unit/platform/execution/worker-pool/worker-service-identity.test.ts`; `tests/unit/platform/execution/worker-pool/worker-service-identity-r13.test.ts` |
| SYS-003 | Fixed. Federation audit changed to default to persistent snapshots + archive files; records recoverable after restart, no longer only in-process memory. | Audit implementation only had `Map/Set` indexes, no authoritative persistence. | `src/scale-ecosystem/federation/federation-audit.ts` | `tests/unit/scale-ecosystem/federation-audit.test.ts` |
| SYS-004 | Fixed. Trust relationship / policy / event now all write to persistent snapshots; revocation, degradation, and suspension survive restarts. | Trust governance state only existed in in-memory `Map`, lacking recovery path. | `src/scale-ecosystem/federation/trust-relationship.ts` | `tests/unit/scale-ecosystem/trust-relationship.test.ts` |
| SYS-005 | Fixed. Main CI `validate` job now includes `lint:architecture-boundary`; documentation "completed" and pipeline enforcement realigned. | Engineering governance claim preceded pipeline rollout, creating documentation-complete / CI-not-enforced drift. | `.github/workflows/ci.yml` | `npm run typecheck`; CI workflow contract passes repo validation |
| SYS-006 | Fixed. Electron preload now exposes both `AA_ELECTRON` and `__AA_ELECTRON__`; desktop adapter also compatible with dual name reading; desktop bridge reconnected. | Preload and runtime adapter used two different bridge names. | `ui/apps/electron-win/src/preload.ts`; `ui/packages/shared/platform/src/bridge-types.ts`; `ui/packages/shared/platform/src/desktop-platform-adapter.ts` | `ui/tests/unit/ui/apps/electron-win/preload.test.ts`; `ui/tests/shared/platform.test.ts` |
| SYS-007 | Fixed. Federation audit query now continues to intersect-validate all filter conditions after index narrows candidate set; no longer just uses first condition. | Query implementation only used first index condition for filtering; subsequent conditions weren't actually executed. | `src/scale-ecosystem/federation/federation-audit.ts` | `tests/unit/scale-ecosystem/federation-audit.test.ts` |
| SYS-008 | Fixed. Retention's archive-before-delete now truly writes NDJSON archive, then deletes from active set; no longer fake archive count. | Original implementation only incremented `archived` number, no real archive sink. | `src/scale-ecosystem/federation/federation-audit.ts` | `tests/unit/scale-ecosystem/federation-audit.test.ts` |
| SYS-009 | Fixed. `expiresAt` and periodic reauth now enter trust admission blocking; expiration or reauth window exceeded migrates out of active usable state. | Policy fields only participated in scoring, not in active trust's usability determination. | `src/scale-ecosystem/federation/trust-relationship.ts` | `tests/unit/scale-ecosystem/trust-relationship.test.ts` |
| SYS-010 | Fixed. Shared endpoint catalog unified to `/v1/*` path system; combined with Web default `/api` prefix gives correct `/api/v1/*`. | UI runtime, endpoint catalog, docs/tests used different version prefixes. | `ui/packages/shared/api-client/src/endpoints.ts` | `ui/tests/shared/api-client.test.ts`; `ui/tests/shared/endpoint-type-contracts.test.ts` |
| SYS-011 | Fixed. Interfaces previously marked as consumable now have backend routes and OpenAPI added: `/v1/dashboard/metrics`, `/v1/workers`, `/v1/queues`, `/v1/agents`, `/v1/explanations`, `/v1/meta/contract-version`, `/v1/knowledge`, `/v1/marketplace`, `/v1/packs/:packId/versions`, `/v1/workflows/builder`. | Frontend endpoint catalog was ahead of backend's actual export surface, causing "frontend implemented, backend doesn't exist" contract drift. | `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts`; `src/platform/five-plane-interface/api/http-server/plane-routes.ts`; `src/platform/five-plane-interface/api/http-server/pack-routes.ts`; `src/platform/five-plane-interface/api/http-server/task-routes.ts`; `src/platform/five-plane-interface/api/openapi-document.ts` | `tests/unit/platform/interface/api/http-server/dashboard-routes.test.ts`; `tests/unit/platform/interface/api/http-server/plane-routes.test.ts`; `tests/unit/platform/interface/api/http-server/pack-routes.test.ts`; `tests/unit/platform/interface/api/http-server/task-routes.test.ts`; `tests/unit/platform/interface/api/openapi-document.test.ts` |
| SYS-012 | Fixed. `workers`, `queues` promoted to Layer C public interfaces; frontend query layer no longer depends on Layer B admin-plane paths `/admin/*`. | Shared Mission Control query directly consumed internal admin contract, violating UI architecture layering. | `ui/packages/shared/api-client/src/endpoints.ts`; `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts` | `ui/tests/shared/endpoint-type-contracts.test.ts`; `tests/unit/platform/interface/api/http-server/dashboard-routes.test.ts` |

### This Round Verification Scope

1. Root repo targeted regression:
   - `tests/unit/platform/state-evidence/events/durable-event-bus-async.test.ts`
   - `tests/unit/platform/execution/worker-pool/worker-service-identity.test.ts`
   - `tests/unit/platform/execution/worker-pool/worker-service-identity-r13.test.ts`
   - `tests/unit/scale-ecosystem/federation-audit.test.ts`
   - `tests/unit/scale-ecosystem/trust-relationship.test.ts`
   - `tests/unit/platform/interface/api/http-server/dashboard-routes.test.ts`
   - `tests/unit/platform/interface/api/http-server/plane-routes.test.ts`
   - `tests/unit/platform/interface/api/http-server/pack-routes.test.ts`
   - `tests/unit/platform/interface/api/http-server/task-routes.test.ts`
   - `tests/unit/platform/interface/api/openapi-document.test.ts`
2. UI targeted regression:
   - `ui/tests/unit/ui/apps/electron-win/preload.test.ts`
   - `ui/tests/shared/platform.test.ts`
   - `ui/tests/shared/api-client.test.ts`
   - `ui/tests/shared/endpoint-type-contracts.test.ts`
3. Type checking:
   - `npm run typecheck`