# 系统级人工复核审查（2026-05-26）

| 字段 | 内容 |
|---|---|
| 审查日期 | 2026-05-26 |
| 审查范围 | `src/`、`ui/`、`.github/workflows/`、`docs_zh/reference/` |
| 审查方式 | 人工抽样复核高风险链路：事件投递、执lines身份、联邦治理、UI 壳层桥接、CI Architecture门禁 |
| 当前Conclusion | 系统主干已via较完整，但仍存在 6 个需要优先handle的真实缺口，其中 1 个会directly破坏 Tier-1 事件可靠性，3 个belongs to“治理/审计Status不持久”，1 个belongs to CI 门禁缺失，1 个belongs to Electron 壳层桥接失效。 |

---

## Issue清单

| ID | 严重级别 | Issue | ReviewConclusion | Root Cause归class | 证据 |
|---|---|---|---|---|---|
| SYS-001 | P0 | `DurableEventBusAsync` 会吞掉异步 handler 的 reject，导致事件被错误 ack | 未解决。当前 async facade 会把 consumer 的failed转换为success返回，`DurableEventBus` 随后执lines `markEventAck`，Tier-1 重试/DLQ 语义被bypassing。 | 可靠性缺陷 / 异步契约破坏 | `src/platform/five-plane-state-evidence/events/durable-event-bus-async.ts:44-52`；`src/platform/five-plane-state-evidence/events/durable-event-bus.ts:575-595` |
| SYS-002 | P1 | Worker 身份注册在持久化failed时仍然返回success，且优先uses内存态鉴权 | 未解决。注册路径先写 `memoryStore`，持久化failed被静默吞掉；同进程内 claim 继续via，但重启后身份会丢失，形成“当前进程accepts、重启后拒绝”的分裂lines为。 | Status一致性 / 静默failed | `src/platform/five-plane-execution/worker-pool/worker-service-identity.ts:49-82`；`src/platform/five-plane-execution/worker-pool/worker-service-identity.ts:109-163` |
| SYS-003 | P1 | 联邦审计宣称 7 年保留，但实现only保存在进程内内存 | 未解决。`FederationAudit` 只有 `Map`/`Set` 索references和内存record，没有任何落盘、回放或外部仓储注入；进程重启后审计轨迹全部丢失，和合规保留口径不符。 | 治理能力未持久化 | `src/scale-ecosystem/federation/federation-audit.ts:75-112`；`src/scale-ecosystem/federation/federation-audit.ts:142-190` |
| SYS-004 | P1 | 联邦信任关系is纯内存模型，撤权/降级/吊销Status不能跨重启保留 | 未解决。`TrustRelationshipManager` 用内存 `Map` 保存 trust/policy/event/index，创建、吊销、降级都不写真源；多组织协作的治理Status在进程重启后会被重置。 | 治理能力未持久化 | `src/scale-ecosystem/federation/trust-relationship.ts:94-148`；`src/scale-ecosystem/federation/trust-relationship.ts:179-240` |
| SYS-005 | P1 | Architecture边界 lint 没有接入主 CI，但参考文档把 `CI-001` 标成 completed | 未解决。仓库已存在 `lint:architecture-boundary` 命令，但 `ci.yml` 的 `validate` job 没有执lines它；同时参考文档 `automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md` 已把 `CI-001` 标为 `completed`，文档vs流水线实际Statusinconsistent。 | 工程治理 / 文档Status漂移 | `package.json:222`；`.github/workflows/ci.yml:24-59`；`docs_zh/reference/automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md:1391-1396` |
| SYS-006 | P1 | Electron preload 暴露的 bridge 名称vs运lines时 adapter 读取名称inconsistent，桌面桥接实际失效 | 未解决。preload 用 `contextBridge.exposeInMainWorld("AA_ELECTRON", bridge)` 暴露桥，而 `ElectronPlatformAdapter` 读取的is `window.__AA_ELECTRON__`；这会让 secure storage、deep link、shell 等能力长期回退到defaults to adapter。 | 接口契约inconsistent | `ui/apps/electron-win/src/preload.ts:27-35`；`ui/packages/shared/platform/src/desktop-platform-adapter.ts:11-25` |

---

## Root Cause归class汇总

1. 异步 facade 为了“避免未handle reject”而破坏了主链success/failed语义。
2. 多个治理子系统仍uses进程内Status，缺少 authoritative store 或恢复机制。
3. 文档结项口径先于 CI 真正落地，形成“文档完成、流水线未 enforce”的漂移。
4. UI 壳层存在 bridge 名称inconsistent的 contract bug，导致平台能力table面存在、实际不生效。

---

## Recommendation优先级

1. 先修 `SYS-001`，这is当前最directly的可靠性破口，会让 Tier-1 事件failed被误记为success。
2. 第二批handle `SYS-002`、`SYS-003`、`SYS-004`，把 worker identity、federation audit、trust relationship 收敛到可恢复真源。
3. 第三批handle `SYS-005`、`SYS-006`，分别收紧 CI 治理和修复 Electron 真桥接。

---

## Description

1. 本文档只record本轮人工确认的真实Issue，不删除既有 review 文档内容。
2. 本轮没有进linesfull测试，也没有对上述Issue做code修复；当前输出only为审查Conclusionvs证据归档。

---

## 第二轮深入交叉复核追加（2026-05-26）

本轮额外检查了联邦治理、UI API 契约、前后端路径体系，以及文档vs实现之间的交叉一致性。以下Issue追加到同一份系统审查台账中。

| ID | 严重级别 | Issue | ReviewConclusion | Root Cause归class | 证据 |
|---|---|---|---|---|---|
| SYS-007 | P1 | `FederationAudit.query()` 只用首个索references缩小候选集，但不会继续校验 `actor/action/correlationId/orgId` 等其他筛选条件 | 未解决。多条件查询会出现“只按第一条件过滤，后续条件被忽略”的错误结果，审计检索结果不可靠。 | 查询语义缺陷 / 审计inconsistent | `src/scale-ecosystem/federation/federation-audit.ts:152-191` |
| SYS-008 | P1 | 联邦审计 retention 声称supported archive-before-delete，但实际只递增 `archived` 计数，没有任何归档落点 | 未解决。`applyRetentionPolicy()` 在 `archiveBeforeDelete=true` 时only执linescomment占位逻辑，最终会返回“已归档”但没有真实归档证据。 | 治理能力未闭环 / 假归档 | `src/scale-ecosystem/federation/federation-audit.ts:276-298` |
| SYS-009 | P1 | Trust policy 中的 `expiresAt`、`requirePeriodicReauth`、`reauthIntervalDays` 只参vs评分，不参vs准入阻断 | 未解决。`getTrustBetweenOrgs()` 只检查 `status === "active"`，不会因为过期或exceeds出 reauth 窗口而拒绝；`calculateTrustFactors()` 只降低分数，没有触发 `expired/suspended` Status迁移。 | 治理策略未 enforce | `src/scale-ecosystem/federation/trust-relationship.ts:163-176`；`src/scale-ecosystem/federation/trust-relationship.ts:404-413`；`src/scale-ecosystem/federation/trust-relationship.ts:477-481` |
| SYS-010 | P1 | UI defaults to API 前缀、endpoint catalog 路径、测试/文档里的真实路径inconsistent，前后端联调defaults to会打到错误address | 未解决。Web runtime defaults to `baseUrl=/api`，endpoint catalog 用 `/tasks`、`/workflows` 这classno版本路径，拼接后得到 `/api/tasks`；但测试vsArchitecture文档都以 `/api/v1/tasks`、`/api/v1/dashboard/*` 为准。 | 接口契约漂移 / 版本前缀inconsistent | `ui/apps/web/src/runtime.ts:143-149`；`ui/packages/shared/api-client/src/rest-client.ts:334-335`；`ui/packages/shared/api-client/src/endpoints.ts:177-190`；`docs_zh/architecture/05-cross-platform-ui-architecture.md:2482-2487`；`ui/tests/tools/tooling.test.ts:11-12` |
| SYS-011 | P1 | UI endpoint catalog 把多条接口标成 `planned: false` / 可directly消费，但后端路由和 OpenAPI 并don't exist对应入口 | 未解决。当前至少存在以下漂移样例：`/dashboard/metrics`、`/marketplace`、`/workflows/builder`、`/knowledge`、`/packs/:packId/versions`、`/explanations`。前端会按已实现接口call，后端路由table和 OpenAPI 没有对应能力。 | 前后端契约失配 / Status标注错误 | `ui/packages/shared/api-client/src/endpoints.ts:205-221`；`src/platform/five-plane-interface/api/openapi-document.ts:1-120`；`src/platform/five-plane-interface/api/http-server/pack-routes.ts:1-146`；对 `src/platform/five-plane-interface/api/http-server/` 的路由扫描未发现 `/v1/marketplace`、`/v1/workflows/builder`、`/v1/explanations`、`/v1/dashboard/metrics` 对应实现 |
| SYS-012 | P2 | 共享 Mission Control 查询层directly消费 Layer B 的 `/admin/workers`、`/admin/queues`，和 UI Architecture“前端只消费 Layer C”要求conflicts | 未解决。endpoint catalog 已把 `workers`、`queues` 标为 `apiLayer: "B"`，但共享查询层仍把它们作为通用 mission-control data源directly暴露；这会把内部manage面契约长期固化到公共前端层。 | Architecture分层违例 | `ui/packages/shared/api-client/src/endpoints.ts:202-203`；`ui/packages/shared/state/src/queries/mission-control-queries.ts:23-29`；`docs_zh/architecture/05-cross-platform-ui-architecture.md:2518-2548` |

### 第二轮补充Conclusion

1. 联邦治理模块的主要Issue已via从“isno存在能力”转成了“查询、保留、策略 enforce isno真实闭环”。
2. UI 子系统的最大风险不只is feature isno存在，而is“路径前缀、Layer 标记、接口完成Status”三套口径没有收敛到一套 authoritative contract。
3. 当前系统最容易造成联调误判的区域is shared api client：它table面上已via很完整，但其中一部分 endpoint 仍然exceeds前于后端真实路由vs OpenAPI。

---

## 修复结果回写（2026-05-26）

以下回写不删除前文审查record，只补充“当前isno已收口”的最新Status、Root Causevs证据。

| ID | 当前Conclusion | Root Cause | 修复依据 | 定向测试 |
|---|---|---|---|---|
| SYS-001 | 已修复。`DurableEventBusAsync` 不再吞掉异步 consumer 的 reject，failed会accesses along原链路回传给 durable bus，避免错误 `ack` Tier-1 事件。 | async facade 为了避免未handle拒绝，把failed转换成了success完成，破坏了success/failed契约。 | `src/platform/five-plane-state-evidence/events/durable-event-bus-async.ts` | `tests/unit/platform/state-evidence/events/durable-event-bus-async.test.ts` |
| SYS-002 | 已修复。worker identity 注册改为先持久化、后进入内存态；持久化faileddirectly fail-closed，坏格式 durable payload 也会拒绝鉴权。 | 原实现先写内存再尝试持久化，而且吞掉持久化异常，导致同进程accepts、重启后拒绝。 | `src/platform/five-plane-execution/worker-pool/worker-service-identity.ts` | `tests/unit/platform/execution/worker-pool/worker-service-identity.test.ts`；`tests/unit/platform/execution/worker-pool/worker-service-identity-r13.test.ts` |
| SYS-003 | 已修复。联邦审计改为defaults to持久化快照 + 归档文件，重启后可恢复record，不再只有进程内内存。 | 审计实现只有 `Map/Set` 索references，没有 authoritative persistence。 | `src/scale-ecosystem/federation/federation-audit.ts` | `tests/unit/scale-ecosystem/federation-audit.test.ts` |
| SYS-004 | 已修复。trust relationship / policy / event 现在都会writes持久化快照，撤权、降级、吊销能跨重启保留。 | 信任治理Status只存在于内存 `Map`，缺少恢复路径。 | `src/scale-ecosystem/federation/trust-relationship.ts` | `tests/unit/scale-ecosystem/trust-relationship.test.ts` |
| SYS-005 | 已修复。主 CI `validate` job 已纳入 `lint:architecture-boundary`，文档“completed”vs流水线 enforce 重新对齐。 | 工程治理口径先于流水线落地，形成文档完成、CI 未执lines的漂移。 | `.github/workflows/ci.yml` | `npm run typecheck`；CI workflow contract via仓库校验读取 |
| SYS-006 | 已修复。Electron preload 同时暴露 `AA_ELECTRON` vs `__AA_ELECTRON__`，desktop adapter 也兼容双名称读取，桌面桥重新连通。 | preload vs runtime adapter uses了两套不同的 bridge 名称。 | `ui/apps/electron-win/src/preload.ts`；`ui/packages/shared/platform/src/bridge-types.ts`；`ui/packages/shared/platform/src/desktop-platform-adapter.ts` | `ui/tests/unit/ui/apps/electron-win/preload.test.ts`；`ui/tests/shared/platform.test.ts` |
| SYS-007 | 已修复。联邦审计查询在索references缩小候选集后，仍会继续对全部过滤条件做交集校验，不再只吃首个条件。 | 查询实现只uses第一个索references条件做过滤，后续条件没有真正执lines。 | `src/scale-ecosystem/federation/federation-audit.ts` | `tests/unit/scale-ecosystem/federation-audit.test.ts` |
| SYS-008 | 已修复。retention 的 archive-before-delete 现在会真实writes NDJSON 归档，再从活动集删除，不再is假归档计数。 | 原实现只增加 `archived` 数字，没有真实 archive sink。 | `src/scale-ecosystem/federation/federation-audit.ts` | `tests/unit/scale-ecosystem/federation-audit.test.ts` |
| SYS-009 | 已修复。`expiresAt` vs periodic reauth 已进入 trust 准入阻断，过期或复验exceeds窗会迁移出 active 可用态。 | 策略字段只参vs评分，不参vs active trust 的可用性判定。 | `src/scale-ecosystem/federation/trust-relationship.ts` | `tests/unit/scale-ecosystem/trust-relationship.test.ts` |
| SYS-010 | 已修复。shared endpoint catalog 已统一到 `/v1/*` 路径体系，和 Web defaults to `/api` 前缀拼接后得到正确的 `/api/v1/*`。 | UI runtime、endpoint catalog、文档/测试uses了不同版本前缀。 | `ui/packages/shared/api-client/src/endpoints.ts` | `ui/tests/shared/api-client.test.ts`；`ui/tests/shared/endpoint-type-contracts.test.ts` |
| SYS-011 | 已修复。原先标记为可消费的公共接口已补齐后端路由vs OpenAPI：`/v1/dashboard/metrics`、`/v1/workers`、`/v1/queues`、`/v1/agents`、`/v1/explanations`、`/v1/meta/contract-version`、`/v1/knowledge`、`/v1/marketplace`、`/v1/packs/:packId/versions`、`/v1/workflows/builder`。 | 前端 endpoint catalog exceeds前于后端真实export面，导致“前端已实现、后端don't exist”的契约漂移。 | `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts`；`src/platform/five-plane-interface/api/http-server/plane-routes.ts`；`src/platform/five-plane-interface/api/http-server/pack-routes.ts`；`src/platform/five-plane-interface/api/http-server/task-routes.ts`；`src/platform/five-plane-interface/api/openapi-document.ts` | `tests/unit/platform/interface/api/http-server/dashboard-routes.test.ts`；`tests/unit/platform/interface/api/http-server/plane-routes.test.ts`；`tests/unit/platform/interface/api/http-server/pack-routes.test.ts`；`tests/unit/platform/interface/api/http-server/task-routes.test.ts`；`tests/unit/platform/interface/api/openapi-document.test.ts` |
| SYS-012 | 已修复。`workers`、`queues` 已提升为 Layer C 公共接口，前端查询层不再relies on `/admin/*` 的 Layer B manage面路径。 | 共享 Mission Control 查询directly消费内部 admin contract，违反 UI Architecture分层。 | `ui/packages/shared/api-client/src/endpoints.ts`；`src/platform/five-plane-interface/api/http-server/dashboard-routes.ts` | `ui/tests/shared/endpoint-type-contracts.test.ts`；`tests/unit/platform/interface/api/http-server/dashboard-routes.test.ts` |

### 本轮验证范围

1. 根仓定向回归：
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
2. UI 定向回归：
   - `ui/tests/unit/ui/apps/electron-win/preload.test.ts`
   - `ui/tests/shared/platform.test.ts`
   - `ui/tests/shared/api-client.test.ts`
   - `ui/tests/shared/endpoint-type-contracts.test.ts`
3. class型检查：
   - `npm run typecheck`
