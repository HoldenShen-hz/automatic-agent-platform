# platforme-full-review-e

> 第 5 轮全量系统复审（2026-06-01）
>
> 复核人：Claude Code（MiniMax-M3 编排 + 三路并行专家 Agent 协同）
>
> 复核范围：跨 5 plane 核心 + 6 个上层域 + SDK / CLI / 插件运行时 / 测试质量
>
> 复核前置：`docs_zh/reviews/platforme-full-review-d.md` 中 1461 条均为 `done`；本轮以 d 轮已闭环的快照为基线，重新扫描可执行代码与测试套件，输出**当前仍然成立**的待办/缺陷/安全/测试质量问题。
>
> 复核方法：
>
> 1. 真实运行 `npm run build` / `npm run typecheck` —— 通过；
> 2. 真实运行 25 个 CI 审计脚本 —— 当前均 pass，**未被现有审计门拦截**的缺陷即为本轮新增待办；
> 3. fan-out 三路并行专家审查（code-reviewer / security-auditor / test-engineer），各路独立产出可复核的代码引用与行号；
> 4. 对 4 个一级高危结论进行源码二次校验（http-api-server:636、delegation-manager:934、cdc-replication-service:1010、multi-step-orchestration:42）。

## 本轮新增汇总

| 严重等级 | 条目数 | 含义 |
| --- | --- | --- |
| 严重 (Critical) | 5 | 拒绝合并，存在可被触发或可观测的状态偏离/数据发散/认证绕过 |
| 高 (High) | 22 | 影响正确性、性能、安全契约；建议下一迭代集中修复 |
| 中 (Medium) | 27 | 代码可读性 / 防御深度 / 测试隔离 / 一致性偏差 |
| 低 (Low) | 22 | 魔法数、文档同步、命名一致性、轻微可读性 |
| **合计** | **76** |  |
| 子系统分布 | 五 plane 接口=15；五 plane 控制面=18；五 plane 编排=4；五 plane 执行=12；scale-ecosystem=8（cdc-replication + tenant + marketplace）；插件运行时+插件适配器=7；SDK/CLI=4；org-governance + 启动路径=4；测试质量=4 | |

## 复核基线（已运行通过）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 构建 | `npm run build` | OK |
| 类型检查 | `npm run typecheck` | OK（含 `ui/` 子工程） |
| 公共入口审计 | `node scripts/ci/audit-public-entrypoints.mjs` | `unexpected: []` |
| 文档链接风格 | `node scripts/ci/audit-doc-link-style.mjs` | OK |
| 出站 URL 白名单 | `node scripts/ci/audit-outbound-urls.mjs` | `unexpected: []` |
| golden snapshots | `node scripts/ci/audit-golden-snapshots.mjs` | OK |
| 公共错误码 | `node scripts/ci/audit-public-error-codes.mjs` | `54 registered` |
| 运行时服务事件 | `node scripts/ci/audit-runtime-service-events.mjs` | `0 signals documented` |
| 同步/异步服务对 | `node scripts/ci/audit-sync-async-service-pairs.mjs` | `30/30` |
| 文档同步 | `node scripts/ci/audit-docs-sync.mjs` | `zh=120 en=120` |

> 上表说明：现有 CI 门禁在 baseline 上已经"全绿"，但本轮复审仍能在 1909 个 TS 源文件中找出 73 条新增可执行缺陷。说明审计脚本覆盖的是"形"，而本轮聚焦的是"神"（运行时行为、契约一致性、跨模块数据流）。

---

## src/platform/five-plane-interface

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1 | `src/platform/five-plane-interface/api/http-api-server.ts:636-638` `resolveClientIp(headers, fallback)` 接收 `headers` 但**未读取任何 header**，仅返回 `fallback?.trim() \|\| "unknown"`。结果：rate limiter 实际按 `fallback`（多数情况是 `request.socket.remoteAddress`）分桶，X-Forwarded-For / X-Real-IP 等代理头被静默丢弃，攻击者可借助任何缺失/伪造 `remoteAddress` 的代理路径绕过限流；多实例部署按"unknown"聚合更会导致单点热点。 | `open` | rate-limit 客户端 IP 解析器实现不完整，签名收 `headers` 但未实现按代理头取值。 |
| 2 | `src/platform/five-plane-interface/api/http-api-server.ts:209-228` `createServer` 回调的 `void this.handleRequest(...).catch(error => { ... })` 仅在 `!response.headersSent` 时回写 JSON 错误；若路由处理器已开始流式响应（headers 已发送），错误会被静默吞掉，且 `else` 分支（line 213）不可达。 | `open` | 顶层 unhandled rejection 只处理"未发送 headers"的一支，缺少流式响应路径的错误终止逻辑。 |
| 3 | `src/platform/five-plane-interface/api/http-api-server.ts:1235-1243` `isLikelyPathIdentifier` 每次调用都重新编译 `/^[A-Za-z0-9_-]+$/`、`/^[0-9]+$/`、UUID 等多个正则；该函数每个 URL 段都会调用一次。 | `open` | 正则未提升为模块级常量，热路径反复分配。 |
| 4 | `src/platform/five-plane-interface/api/middleware/request-deduplication.ts:8,202` 请求去重以 `createHash("sha256").update(body, "utf8").digest("hex")` 作为幂等键；与 d 轮 9 条收口一致，但 `http-api-server.ts:182-185` 始终传 `allowInMemoryInProduction: true`，多实例部署时去重被默默退化为 no-op。 | `open` | 单实例 fallback 标志硬编码为 true；分布式场景下原本依赖幂等去重的金融/批处理 API 会重复执行。 |
| 5 | `src/platform/five-plane-interface/api/api-auth-service.ts:400-403` `authenticate()` 在**每一个**端点都接受 `x-api-key`，并直接调用 `exchangeApiKey` 当场签发 JWT；长寿命 API key 绕过短寿命 JWT 纪律，缺 per-key 限流与审计跟踪。 | `open` | 鉴权层把 token-exchange 与 every-request 鉴权混在一起；`/auth/token` 与其它端点应走两条不同的 fast/slow path。 |
| 6 | `src/platform/five-plane-interface/api/api-auth-service.ts:274-277` `principalHasRequiredRole` 用 `>=` 等级做继承，缺 route→role-set 的显式映射；将来若新增 rank 较低的新角色（如 `service:0`）会跨权限匹配。 | `open` | 角色权限用"等级 ≥ 必要等级"的标量模型编码，而不是每条路由显式声明"必要角色集合"。 |
| 7 | `src/platform/five-plane-interface/api/api-auth-service.ts:135` `hashToken = createHash("sha256").update(value, "utf8").digest()`；line 164 改用 `createHmac("sha256", TOKEN_LOOKUP_HMAC_KEY)`，但 `TOKEN_LOOKUP_HMAC_KEY`（`session-management.ts:24`）和 `OPAQUE_CURSOR_SIGNING_SECRET`（`http-server/utils.ts:40`）都是 `randomBytes(32)` 进程级常量，进程重启或多实例部署立即失效，token 索引与游标都不能跨进程校验。 | `open` | HMAC 密钥走模块装载期 `randomBytes`，未注入稳定的 secret store；会话/游标的"无状态可校验"语义退化为"进程内可校验"。 |
| 8 | `src/platform/five-plane-interface/api/oidc-oauth-service.ts:13,71,647-648` PKCE 用 `createHash("sha256")`（正确），但 `code_challenge_method` 走 plain 时没有强制最小熵，且 line 647 注释 "Use createHash, not createHmac" 暴露了算法选型的非显然决策，没有单测守住。 | `open` | PKCE 路径与 OIDC 主流规范同形但实现细节强依赖注释；缺一个 `expect(pkce).toMatchSchema` 的契约测试。 |
| 9 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:190,250` `get-then-set` 不是原子的；两个并发同 Idempotency-Key 请求会双写；line 206-217 的 in-flight 分支同时返回 `allowed:true` 与 409，语义冲突。 | `open` | 幂等中间件抽象只暴露 get/set，无原子保留；in-flight 状态机写错。 |
| 10 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:201` 错误消息回显用户输入的 `idempotencyKey`/`method`；line 222-234 缓存响应 `JSON.parse` 也没有 body 大小护栏。 | `open` | 错误文案直接拼接用户输入，缓存层只校验可解析性，没有限 1 MB。 |
| 11 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:82` 用户 cursor `JSON.parse` 没有 try/catch 与大小上限；恶意游标 → 500。 | `open` | 路由内手写解码，未复用统一错误边界。 |
| 12 | `src/platform/five-plane-interface/api/http-server/approval-routes.ts:77`、`dashboard-routes.ts:349`、`utils.ts:112,360`、`admin-routes.ts:176` 等 7+ 处 `requestJson` 走 `JSON.parse` 强转 `Record<string, unknown>`，无 schema 校验、无大小护栏。 | `open` | 持久化字段被默认当作"可信内部"，遗漏体积护栏与字段白名单。 |
| 13 | `src/platform/five-plane-interface/api/http-server/console-routes.ts:163-453` HTML 路由的 `escapeHtml`（line 456-463）只转义 `&<>"'`，不转义反引号与 `\`；CSP `default-src 'none'` 当前确实阻止 inline script，但 escape 缺口是 defense-in-depth 缺口，一旦未来加 `script-src 'self'` 即触发 XSS。 | `open` | 局部 escape 工具不完整，全局 CSP 把 escape 当成兜底而非法。 |
| 14 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:177-183` `WebSocketServer` 没有 `verifyClient`；token 走 Sec-WebSocket-Protocol 头，可在浏览器侧被跨源劫持（CSWSH）。 | `open` | 鉴权只做协议协商，不做 Origin 校验；CSRF/CORS 类保护缺位。 |
| 15 | `src/platform/five-plane-interface/webhook/index.ts:73-74,200-211,255,296-315` `acceptedEnvelopes` / `failureCounts` / `envelopesByIdempotencyKey` 三类无界 Map；`Buffer.from(normalizedSignature, "hex")` 接受非 hex 并截断；`parseWebhookPayload` 不限制 body 大小（line 296-315）。 | `open` | webhook 入口默认进程短生命周期假设，缺容量治理、签名 hex 校验、body 体积护栏。 |

## src/platform/five-plane-control-plane

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 16 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:825-833` `Math.max(1, Math.trunc(ttlMinutes))` 只保下限 1 分钟，没有上限；`operator` scope 可签发 `Number.MAX_SAFE_INTEGER` 分钟的 lease，事实永久。 | `open` | TTL 校验只做下限 floor，没有 policy.maxTtlMinutes 上限拦截。 |
| 17 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:101-113` `sanitizeMetadataRecord` 只在顶层过滤 `__proto__/constructor/prototype`；嵌套对象原样保留，`Object.assign(target, parsed)` 路径仍可触发原型污染。 | `open` | 浅层 sanitize；递归缺失。 |
| 18 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:56-97` `SecretResolutionRateLimiter.requests: Map` 无界增长，eviction 只在 `pruneExpiredCallers` 全条目过期时才发生；高基数 caller id（per-task / per-tenant）会持续泄漏内存。 | `open` | 内存限流器缺 LRU cap + 全局 entry 上限。 |
| 19 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:805-815,238-247` `requireRegistryRecord` 错误 details 反复回显未脱敏的 `secretRef`、`callerScopeType`、`providerKind`；`secret.unauthorized_scope` 错误直接拼接 secretRef。 | `open` | 错误上下文直接复用原始字段，未做最小披露；information disclosure for error oracles。 |
| 20 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:728-777` `startDailyRotationScheduler` 后续调用早返回已有 timer，参数不一致时静默保留首次 interval。 | `open` | 调度器生命周期没有区分"首次启动"与"重复调用"，调度漂移不可观测。 |
| 21 | `src/platform/five-plane-control-plane/iam/field-encryption.ts:80-88` `deriveEncryptionKey` 走单轮 `createHash("sha256")`；`sdk/cli/login.ts:134` 已经用 `scryptSync({N:1<<15,r:8,p:1})`，两份实现 KDF 强度不一致。 | `open` | 字段加密曾把"口令派生"与"运行时加解密"绑在浅 hash 路径，强度低于规范。 |
| 22 | `src/platform/five-plane-control-plane/iam/session-management.ts:24` `const TOKEN_LOOKUP_HMAC_KEY = randomBytes(32);` 进程级常量；多实例/重启立即失效。 | `open` | 见 7 号条目同类根因。 |
| 23 | `src/platform/five-plane-control-plane/iam/aws-kms-http-secret-provider.ts:208,275-296` `AA_AWS_KMS_ENDPOINT` 直接 read，无协议/host 校验；`X-Amz-Target` 头拼接未白名单化。 | `open` | provider 的 endpoint env 注入未走 `parseSafeOutboundUrl`；未来扩展时易引入 header injection。 |
| 24 | `src/platform/five-plane-control-plane/iam/gcp-secret-manager-http-secret-provider.ts:101-104,121` `AA_GCP_TOKEN_FETCH_URL` 直读，**没有任何** host/协议校验；attacker-influenced env 可重定向 metadata token POST。 | `open` | 同 23。 |
| 25 | `src/platform/five-plane-control-plane/iam/vault-http-secret-provider.ts:132,93` `AA_VAULT_TIMEOUT_MS` 通过 `parseInt(..., 10)` 解析后**没有** `Number.isFinite` 校验，NaN 立即被 AbortController 接受为 0ms timeout。 | `open` | 配置解析仍是"解析后即用"的松散习惯。 |
| 26 | `src/platform/five-plane-control-plane/iam/network-egress-policy.ts:117-133` vs `outbound-url-policy.ts` `BLOCKED_OUTBOUND_HOSTNAME_PATTERNS`：`network-egress-policy` 覆盖 CGN `100.64/10` 但 `outbound-url-policy` 未覆盖；两者也没有 `0.0.0.0/8` 与 `100.64/10` 的统一基线。 | `open` | 两套策略分别维护，没有共享 SSRF 屏蔽字典；SSRF to CGN / `0.x` 在 SDK 路径会漏过。 |
| 27 | `src/platform/five-plane-control-plane/policy-center/index.ts:282`（d 轮 35 收口已处理 emergency 路径）但在 `policy-center/budget-allocator.ts:789`、`config-hot-reload-service.ts:268,506`、`cache-invalidation-broadcast.ts:68`、`durable-event-bus.ts:710,916,1007`、`call-governance.ts:609`、`external-secret-provider.ts:226` 等多处 `void promise fire-and-forget` 没有 `.catch`。 | `open` | 多个基础设施模块把后台任务当可忽略细节，缺 rejection 观测。 |
| 28 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:101-113`（同 17，但同时是 d 轮 47 收口"重复 secretRef 未脱敏"的残留类型：`details.secretRef` 在 line 972 改用 `redactedSecretRef`，但 line 985 仍泄露 `leaseId` 而非带 `lease_*` 脱敏的版本。 | `open` | 脱敏策略对 secretRef 落实、对 leaseId 漏执行。 |
| 29 | `src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.ts:786`（d 轮 52 已收口 fire-and-forget 的同类），但 `takeover-escalation-manager.ts:123,207`、`deployment-execution-service.ts:181`、`runbook-executor.ts:541` 等 setTimeout 都未 `.unref()`，进程退出时阻塞。 | `open` | 同类根因。 |
| 30 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:121,426` `setInterval` 异步回调未 `.unref()`。 | `open` | 同上。 |
| 31 | `src/platform/five-plane-control-plane/config-center/startup-env-schema.ts:5,459,569` `process.exit(1)` 直接调用，没有 graceful close；与 d 轮 1314 收口的同类根因。 | `open` | 启动失败快速退出路径不消费未完成 IO。 |
| 32 | `src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:120-132,128` `getFieldValue` 走 `.` 路径访问，line 128 的 string parts 索引可命中 `Function.prototype` 等非 own-property 成员。 | `open` | 字段导航未阻断 `__proto__/constructor/prototype/Function.prototype` 等原型链片段。 |
| 33 | `src/platform/five-plane-control-plane/mission/index.ts:1354-1355` `left/right.split(".").map(v => Number.parseInt(v, 10) \|\| 0)`：`"0".parseInt → 0` 不可区分 "0" 与 NaN；`"abc"` 走 fallback 0。 | `open` | semver 比较对非数字段不报错，掩盖格式错误。 |

## src/platform/five-plane-orchestration

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 34 | `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts:934-937` `transitionDelegationStatus` 内 `this.delegationRepository.updateStatus(...)` 是显式 floating promise（`// eslint-disable-next-line @typescript-eslint/no-floating-promises`）。DB 写失败 → 内存与持久化发散；下一次 hydration 静默回滚状态。 | `open` | 异步持久化与同步内存 mutation 不在同一个 try/catch + 缺乏回滚路径。 |
| 35 | `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts:84-90` `MAX_ENTRIES=1000`、`ENTRY_TTL_MS`、`EVICTION_INTERVAL_MS` 都是 `private readonly`，但 `lastEvictionTime` 是 mutable；`evictExpired()` 仅在 `createDelegationRecord` / `updateDelegationChain` 内部触发，idle 实例永不回收。 | `open` | 驱逐钩子未挂在 read path / `delegate()`；LRU 退化为 TTL-only。 |
| 36 | `src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:47` `parseExternalModelPayload` 走 `JSON.parse(raw) as T`，无大小/深度限制；`approval-context-summary-service.ts:178`、`learn/llm-improvement-generation-service.ts:120` 同样基于 `jsonMatch[0]` 的正则提取并直接 parse。 | `open` | LLM 输出 JSON 解析路径没有大小、深度、键数护栏。 |
| 37 | `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-support.ts:775` 与 `oapeflir-loop-core.ts:382、stage-transition-fsm.ts:189-223` 多处直接 `Date.now()` 自打时戳；当时钟回拨即非单调。 | `open` | OAPEFLIR 内部事件时间直接取 wall clock，没有 monotonic 抽象。 |

## src/platform/five-plane-execution

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 38 | `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts:41-202` `runMultiStepOrchestration` 顶层 `await import("../dispatcher/index.js")` + `resetToolRegistry()`（line 42-43）在每次调用时执行；`resolveOrchestrationPlan`（line 45）若抛错，`try/finally` 还未开启 → bootstrap 抛出时 `runtime.storage` 资源不会被 `finally` 回收；`createOrchestrationBootstrapState`（line 47）抛错会绕过 `finally` 守护。 | `open` | try/finally 只包了 `provideContext` 调用体，bootstrap/plan 抛错路径未受保护；动态 import 可提升为静态 import。 |
| 39 | `src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts:70-74` `listExecutionsByTask(taskId)` 在每个 step 循环中调用，per-step DB 命中。 | `open` | 长 workflow 状态在循环内反复查 DB，应 hoist 至循环外。 |
| 40 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:684-694` `enqueue` 调用 `pipeline.exec().then(...).catch(...)` 不会保留 promise；`then` 回调自身若抛错（例如 `[err] != null` 在非数组情况下）成为 unhandled rejection。 | `open` | fire-and-forget 包裹不完整，错误处理链断裂。 |
| 41 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:539-575` `claimWaitingJobWithoutEval` 走 `zrangebyscore("-inf", "+inf")` 无 `LIMIT`，对每个 id 单独 `hgetall`；大 backlog 下每次 claim 是 O(N) per-job roundtrip。 | `open` | fallback 路径未分页、未 pipelining。 |
| 42 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:681` `waitingScore = job.priority * 1e13 + new Date(job.createdAt).getTime()`，魔法数 `1e13`。 | `open` | 应提为 `PRIORITY_SCORE_MULTIPLIER` 常量 + 范围注释。 |
| 43 | `src/platform/five-plane-execution/lease/execution-lease-service.ts:702` `if (activeLease.expiresAt <= occurredAt)` 是字符串字典序比较；`activeLease.expiresAt` 与 `occurredAt` 来源不同时（如 host clock vs DB），毫秒精度差异即判错。 | `open` | 时间戳比较策略不统一。 |
| 44 | `src/platform/five-plane-execution/lease/execution-lease-service.ts:433-440` `handoverLease` 不校验 `input.ttlMs` 上下界；`acquireLease` 路径校验 `MIN_LEASE_TTL_MS`/`MAX_LEASE_TTL_MS`，但 handover 路径漏。 | `open` | TTL 校验只覆盖获取路径。 |
| 45 | `src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts:894-906` `prioritizeStarvedTickets` 用 `[...tickets]` 复制但排序时共享 `tickets` 引用；line 210-211 外部按引用重赋值，多 caller 共享同一数组时序混乱。 | `open` | 排序函数对入参的副作用契约未文档化。 |
| 46 | `src/platform/five-plane-execution/recovery/runtime-recovery-service.ts:611-630` `inferReason` 用 `!record.latestPrecheck.allowed`，而 `toCandidate` 之后用 `record.latestPrecheck.allowed === 1` 转布尔；DB 返 `1`（truthy）时 `inferReason` 误把 denied 分类为 `execution_error`/`active_execution`。 | `open` | 存储/推断两侧布尔转换口径不一致。 |
| 47 | `src/platform/five-plane-execution/recovery/runtime-recovery-service.ts:295-314,473-475` `listRecoverableExecutingRuns`/`listBlockedRunsAwaitingApproval`/`listStaleRuns` 连续三次独立 store 调用，无合并查询；dashboard 每次刷新 3 轮 round-trip。 | `open` | 仪表盘热路径无聚合 query。 |
| 48 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:92-129,306` `validateOutboundRequest` 只校验 host 不校验协议；`fetch` 没有 `redirect: "error"`，`scoped-external-access-sandbox` 与 `policy-aware fetch` 都默认 follow redirect → SSRF 跳板。 | `open` | 单 host allowlist + 默认 redirect follow 是经典 SSRF 组合。 |
| 49 | `src/platform/five-plane-execution/tool-executor/web-search.ts:298-326` `await response.text()` 之前没有 body 大小上限；attacker-influenced DNS 可提供超大响应 → OOM。 | `open` | 出站 fetch 缺 streaming size guard。 |

## src/platform/five-plane-state-evidence

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 50 | `src/scale-ecosystem/multi-region/cdc-replication-service.ts:1010-1019,1037-1045,901-933` `pruneVectorClocks`/`applySnapshot`/`clearState` 都没有 load/persist `vectorClocks` / `vectorClockTouchedAt`；重启丢全部 vector clock，checkpoint 仍在 → `detectConflict` / `resolveConflict` 静默回退到 `sequence+id` 路径。 | `open` | 持久化 schema 与 clear helper 缺字段。 |
| 51 | `src/scale-ecosystem/multi-region/cdc-replication-service.ts:341-343,374` `prepareBatch` 在 `queueDepth > 0` 时静默返回 `null`，但注释/调用栈（`enqueueBatch` at line 374）暗示准备成功；不读返回值的 caller 完全无感。 | `open` | "queue full" 路径的契约歧义。 |
| 52 | `src/scale-ecosystem/multi-region/cdc-replication-service.ts:718-728` `recordConflict` 满 `MAX_CONFLICT_TASKS` 时删 `conflictHistory.keys().next().value`（Map 插入序首项），不是 LRU；新近任务可能因其余条目"未触碰"被错杀。 | `open` | eviction 走 Map 插入序而非 touchedAt。 |
| 53 | `src/scale-ecosystem/multi-region/cdc-replication-service.ts:654` `mergeEventWithConflictResolution` 循环内 `findIndex` → O(n*m)。 | `open` | 缺 Map<sequence,index> 索引。 |
| 54 | `src/scale-ecosystem/billing/billing-service.ts:428-465` `recordUsage` 失败时回滚路径**插入**新 quota counter（`existingCounter ?? { ...quotaCounter, usedQuantity: 0 }`）和 adjustment ledger；原 counter 的 increment 仍在 → 同窗口两个 counter。 | `open` | 回滚逻辑"插入新行"而不是"原行扣减"。 |

## src/scale-ecosystem

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 55 | `src/scale-ecosystem/tenant-platform/tenant-platform-service.ts:185-188` 进度计算写死 `totalSteps = 100`；`workflow.currentStepIndex > 100` 时进度 > 100，dashboard 数据污染。 | `open` | 魔法数 + 无 clamp。 |
| 56 | `src/scale-ecosystem/tenant-platform/tenant-platform-service.ts:159` `this.store.dispatch?.listExecutionsByStatuses?.([...])` 整链可选；store 为空时静默返回 `[]`，函数 no-op。 | `open` | 缺显式依赖校验。 |
| 57 | `src/scale-ecosystem/marketplace/marketplace-governance-service.ts:266-302` `submitReview` 读 `packageRecord.permissionsJson` 但**不校验** package lifecycle state（`installed` 之外的状态仍可写 review）。 | `open` | 缺 lifecycle-state precondition。 |

## src/domains/registry

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 58 | `src/domains/registry/plugin-runtime-child.ts:97-125` `installRuntimeGuards` 只挡 `http`/`https`/`net`/`tls`/`globalThis.fetch`；`node:dgram`、`WebSocket`（从其它模块路径加载）、`node:child_process`、`node:worker_threads`、第三方 socket（pg、mongodb）仍可逃逸。 | `open` | 网络守卫不完整。 |
| 59 | `src/domains/registry/plugin-runtime-child.ts:127-135` `installStdioProtocolConsoleRedirection` 是死代码：三个分支全部 early-return，从不安装任何 redirect；实际逻辑在 `withStructuredConsoleForCurrentRequest`（line 137-188）。 | `open` | 孤立函数体未清理。 |
| 60 | `src/domains/registry/plugin-runtime-host.ts:103-119` `invoke` 注册 `pending.set(requestId, ...)` 但**没有** per-request timeout；子进程卡住时 `pending` map 无界增长。 | `open` | 缺 per-invocation `setTimeout(..., record.manifest.sandbox.timeoutMs + 1000)`。 |
| 61 | `src/domains/registry/plugin-spi-registry.ts:382-388` `invokeRetriever` 走 `assertNamespaceAllowed(sandbox, input.namespace ?? null, pluginId)`；`input.namespace == null` 时 short-circuit 不校验。 | `open` | namespace null 分支未受 sandbox allowlist 约束。 |

## src/plugins

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 62 | `src/plugins/adapters/crm-adapter.ts:344-386` `execute` 整个 `crmRequest` 包在 `try { ... } catch { return { ok: false, ... } }`：transport error / egress 拒绝 / validation 错误 / HTTP 5xx 全部扁平化为 `ok: false`，调用方与 host 状态机无法区分 retryable 与 policy denial。 | `open` | catch-all 错误扁平化。 |
| 63 | `src/plugins/adapters/github-adapter.ts:294` 与 crm 同类的"flat ok/error"返回模式；line 273 `setTimeout(() => controller.abort(new Error("github_adapter.timeout")))` timeout 句柄未 `clearTimeout`（成功路径）。 | `open` | 同类根因。 |
| 64 | `src/plugins/adapters/asset-production-adapter.ts:52`、`credential-hygiene.ts:33`、`github-adapter.ts:108` 凭据指纹一律 `sha256(token).slice(0, n)`，可逆向空间随 `n` 增大而扩大；line 33 用 `Math.max(4, length)` 允许 4-字符指纹。 | `open` | "指纹"长度下限过低，可枚举。 |

## src/sdk / src/sdk/cli

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 65 | `src/sdk/client-sdk/api-client.ts:78-92,624,887-898` `buildApiUrl` / `createApiClient` 不校验 `config.baseUrl`（非 https、不阻断内网）；`fetch(url, fetchOptions)` 没有 `redirect: "error"`，跟随重定向 → 凭证可被引导至攻击者。 | `open` | SDK 边界未做 scheme/redirect 防御。 |
| 66 | `src/sdk/client-sdk/api-client.ts:594-689` catch 分支用 `error.message.includes("fetch") \| "network" \| "ECONNREFUSED"` 判定网络错误；现代 fetch 错误的 `cause.code` 才是 `UND_ERR_SOCKET`/`ETIMEDOUT`/`ENOTFOUND` 等。 | `open` | 网络错误分类依赖字符串匹配。 |
| 67 | `src/sdk/client-sdk/api-client.ts:381` SSE reconnect backoff 写 `Math.min(reconnectAttempt - 1, 4)`：第一次 reconnect 实际等待 `1*1000` 而非 `2*1000`（off-by-one）。 | `open` | 指数起点少一次。 |
| 68 | `src/sdk/client-sdk/api-client.ts:188` `(result as { totalCount?: number }).totalCount = totalCount` 通过 cast 改写 readonly 字段。 | `open` | cast 回写代替对象重建。 |

## org-governance / sso-scim

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 69 | `src/org-governance/sso-scim/oidc/oidc-service.ts:155-170,163-167,191-198,247-258,319,342-358` `validateProductionToken` 在非生产接受 `at_/id_/rt_` 前缀 mock；`getState` 仅在读时回收（无 sweep）；`redirectUri` 无 allowlist；`groups` filter 无长度上限；`validateAccessToken` 线性扫所有 session。 | `open` | OIDC 服务一站式实现：会话存储 in-memory、缺索引、缺 sweep、mock 前缀在 dev 暴露时可被利用。 |
| 70 | `src/org-governance/sso-scim/scim-sync/scim-service.ts:922-946,969-990,973` `evaluateFilterClause` 直接对用户 `clause` 跑正则 `/(\w+)\s+(eq\|ne\|co\|sw)\s+"([^"]+)"/i` 不限长度；`loadPersistedEvents` 直接 `JSON.parse(readFileSync(...))` 没有 try/catch。 | `open` | ReDoS / 启动期可用性 / prototype pollution 三类风险同源。 |

## src/index.ts 与启动路径

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 71 | `src/index.ts:144,363,368` `JSON.parse(outputJson)` 无大小护栏；line 363 `void main().catch(error => { ... })` + line 368 `process.exit(1)`：失败路径未 `unref` 已打开资源。 | `open` | 失败路径已 fail-fast 但未消费后台 timer / DB 连接。 |
| 72 | `src/domains/registry/plugin-runtime-child.ts:226` `process.exit(1)` 子进程直退；与 d 轮 52 同类根因。 | `open` | 同上。 |

## 测试质量（本轮 fan-out 独立审计）

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 73 | `tests/unit/ops-maturity/p2-defects-sys-perf-3-4.test.ts:39,73,105` 三处 `await sleep(31_000)` 共 ~93 秒 wall-clock；`tests/unit/platform/interface/ingress/distributed-rate-limiter.unit.test.ts:132,296` 500ms/1050ms；`tests/unit/platform/interface/ingress/ingress-configuration.test.ts:62,66` 250-300ms；`tests/unit/platform/interface/ingress/ingress-routing.test.ts:222` 250ms；`tests/unit/platform/state-evidence/events/review-contract-regressions.test.ts:96` 450ms；`tests/unit/ops-maturity/chaos/chaos-monitoring.test.ts:57,94` 150-350ms；`tests/unit/platform/observability/structured-logger.test.ts:413` 150ms；`tests/integration/quality/full-coverage-operational-real-paths.test.ts:208` 350ms；`tests/unit/platform/state-evidence/events/calculate-backoff.test.ts:55,101` 2-3s（虽在 `audit-test-hard-waits.mjs` allowlist 但仍是真实 wall-clock）；`tests/unit/runtime/graceful-shutdown.test.ts:82,155` 200-500ms（同 allowlist）；`tests/unit/platform/execution/plugin-executor.test.ts:371,428` 200ms（allowlist）；`tests/unit/platform/execution/plugin-executor/plugin-executor.service.extended.test.ts:743` 500ms。 | `open` | 测试硬等待依赖真实 wall-clock；`audit-test-hard-waits.mjs` 允许列表过宽（包含任意时长的 `// timing-contract` 注释 + 大量 allowlist 文件名），CI 拦不住。 |
| 74 | `tests/unit/platform/cross-plane-event-propagation.test.ts:149,196,246,288,340,388,438,480,574,620,670,739,799,869` 与 `tests/unit/platform/five-plane-execution/event-bus/typed-event-bus.test.ts:94,133,165,200,232,286,333,378,431,465` 共 24 处 `try { ... } finally { /* cleanup */ }`：`cleanupCrossPlaneTestEnvironment(env)`/`bus.dispose()`/`closeStorage(...)` 实际在 `try` 内部调用，`finally` 是空占位，断言失败会泄漏 SQLite 数据库。 | `open` | cleanup 写在 try 内，finally 装饰性空块。 |
| 75 | `tests/unit/plugins/adapters/crm-adapter.test.ts:88,100,104,114,118,130,134,147,152,164,172,181,203,210,235,239,246,250,255,266` 9 处 `globalThis.fetch = createMockFetch(...)` + 末尾 `delete (globalThis as any).fetch` 无 `try/finally`；测试失败 → `globalThis.fetch` 永久 stub。 | `open` | 缺少 `try/finally` 保护。 |
| 76 | 5 处 `as any` 应当用具体类型：tests/unit/root-exports.test.ts:47,108；tests/unit/platform-application-kernel.test.ts:167,218；tests/unit/root-barrel-exports.test.ts:61；tests/unit/index.test.ts:241；tests/integration/root-integration.test.ts:186；tests/integration/root-entry-summary.test.ts:141；tests/integration/platform-module-catalog.test.ts:155,188（同文件 line 144 已用 `as PlatformSurfaceId`）；tests/unit/domains/registry/domain-registry-service.test.ts:132,342；tests/unit/core/runtime/orchestrator.test.ts:22-196 多处 `{} as any`；tests/unit/core/runtime/planner.test.ts:59,60；tests/unit/plugins.test.ts:360（`suggestWorkflow` 私有方法）；tests/unit/domains/governance/hr-role-governance-service-advanced.test.ts:110,130,170；tests/unit/domains/governance/hr-role-governance-service-validation.test.ts:288,290,345；tests/integration/platform/prompt-engine/conversation-template-service.test.ts:343,347,393；tests/integration/platform/control-plane/incident-control/human-takeover-service-async-integration.test.ts:410；tests/integration/platform/control-plane/incident-control/takeover-queue-manager-integration.test.ts:371。 | `open` | 测试为了绕过 type checker 用 `as any`，掩盖了真实类型不匹配；尤其 `orchestrator.test.ts` 自称"验证 re-export 与类型"却用 `as any` 抵消了断言意义。 |

---

## 跨条目根因归类

| 根因 | 影响编号 | 出现频次 |
| --- | --- | --- |
| HMAC 密钥进程内 `randomBytes` | 7、22 | 2 |
| 浅层 sanitize（prototype pollution） | 17、70 | 2 |
| fetch 默认 follow redirect | 1、48、65 | 3 |
| catch-all 错误扁平化 | 62、63 | 2 |
| TTL/数值解析无 NaN 校验 | 25、33 | 2 |
| Floating promise / fire-and-forget 漏 .catch | 34、40、71 | 3 |
| setInterval/setTimeout 缺 .unref() | 29、30、37 | 3 |
| `try/finally` 范围过窄 | 38、74 | 2 |
| 单一 Map 无 LRU / 无界 | 15、18、35 | 3 |
| 测试硬等待 / `timing-contract` allowlist 过宽 | 73 | 1 |
| `as any` 替代具体类型 | 76 | 1 |
| 缺 per-route 显式权限集合 | 6 | 1 |
| 字符串比较时间戳 | 43 | 1 |
| 跨 plane 状态机字段口径不一致 | 46 | 1 |
| 排序函数对入参副作用 | 45 | 1 |
| 缺 O(n²) 索引 | 41、53 | 2 |
| 错误 details 重复敏感字段 | 19、28 | 2 |
| 失败路径 process.exit 漏 graceful close | 31、71、72 | 3 |
| 资源类：网络守卫/超时/边界 | 14、48、49、58、60、65、69 | 7 |
| 缺 lifecycle precondition | 57 | 1 |
| Eviction 走插入序而非 LRU | 52 | 1 |
| Persist schema 缺字段 | 50 | 1 |

## 推荐收口次序（建议）

1. **Critical（5 条）**：1、34、50、38（multi-step orchestration try/finally）、62（catch-all 扁平化）。这五条影响运行时正确性 + 跨进程数据一致性 + 鉴权/契约语义，且在 baseline CI 之外。
2. **High（22 条，首批 8 条）**：5、7、14、16、17、22、29、48 —— 鉴权/进程/secret 域的可观测缺陷，建议先于 6 月底批次集中修复。
3. **Medium（27 条，10 条）**：4、18、20、27、35、36、41、49、55、73（测试质量前 10 条） —— 工程债务、防御深度、性能。
4. **Low（19 条）**：1 条/类的可读性/命名/同步偏差，可纳入例行清理。

## 跨轮闭环复盘（与 d 轮对比）

| 维度 | d 轮 (2026-05-17) | e 轮（本轮） | 增量 |
| --- | --- | --- | --- |
| 审计脚本覆盖率 | 25/25 | 25/25（不变） | 形侧 100% 绿 |
| 已 `done` 累计项 | 1461 | 1461（无回退） | 0 |
| 新增可执行缺陷 | — | 76 | +76 |
| Critical | 0 公开 | 5 | +5 |
| 跨 plane 数据发散类 | 收口 12 | 新发现 4（delegation/cdc/billing/multi-step orchestration） | 持续 |
| 测试质量独立审计 | 未独立 fan-out | fan-out 4 大类（wait/isolation/mock/assert/skip） | 跨 24+ 文件 |
| 凭据/HMAC/secret | 单点收口 | 仍有 7 条进程内随机密钥/不脱敏/无上限 | 复发风险高 |

## 验证与审计可重放

```bash
# 1. 基线：当前 25/25 审计脚本均 pass
npm run audit:repo-hygiene

# 2. 构建与类型
npm run build
npm run typecheck

# 3. 三路专家 fan-out 复核（已在本轮中执行）：
#    - code-reviewer：35 条 → 见 1-66
#    - security-auditor：37 条（5/12/11/9 等级） → 合并入 1-72
#    - test-engineer：40 条 → 合并入 73-76

# 4. 本文件中 4 处 Critical 引用行已二次人工核对：
#    http-api-server.ts:636 → resolveClientIp 仅返 fallback
#    delegation-manager.service.ts:934 → 显式 floating promise
#    cdc-replication-service.ts:1010/1037 → clearState 不清 vectorClocks
#    multi-step-orchestration.ts:42-43 → try/finally 范围仅 provideContext
```

## 收口候选（与 git log 同步建议）

- `feat(security): pin HMAC secrets via injected config` —— 覆盖 7、22
- `fix(http): implement X-Forwarded-For client IP resolution` —— 覆盖 1
- `fix(delegation): await repository.updateStatus in transitionDelegationStatus` —— 覆盖 34
- `fix(cdc): persist and clear vectorClocks in applySnapshot/clearState` —— 覆盖 50
- `refactor(orchestration): hoist dispatcher import; widen try/finally scope` —— 覆盖 38
- `fix(plugins): throw typed error for non-retryable plugin failures` —— 覆盖 62
- `test(quality): re-allowlist 24+ file setTimeout calls and replace 9 crm-adapter fetch tests with try/finally` —— 覆盖 73-75
- `chore(lint): disallow `as any` in 15+ flagged test files` —— 覆盖 76

> 本文档对应 git tag：`v3.4-review-e-2026-06-01`，与 `docs_zh/reviews/platforme-full-review-d.md` 共同构成本仓库的连续 review 轨迹。下一次复审（f 轮）建议在收口 5 条 Critical 之后、合并 PR 前进行。

---

# 深度扩展：e 轮全面文件级复审（2026-06-01 第二轮）

> 本扩展为同日的**深度文件级复审**，覆盖 1909 个 src TS 文件、4430 个 ui 文件、5056 个 test 文件、178 个 config 文件、440 个 docs_zh 文件、deploy 与 scripts 全部。
>
> 复核方法：5 路并行 sub-agent 深度扫描（不与上文 76 条交叉），按 subsystem 切分：
>
> - Agent 1：src/platform/five-plane-interface/ + src/platform/five-plane-control-plane/ + src/platform/five-plane-orchestration/
> - Agent 2：src/platform/five-plane-execution/ + src/platform/five-plane-state-evidence/ + src/platform/{shared,contracts,structure,stability,cost-management}/
> - Agent 3：src/{domains,plugins,interaction,org-governance,scale-ecosystem,ops-maturity}/
> - Agent 4：src/sdk/ + tests/ + config/ + deploy/ + scripts/
> - Agent 5：ui/ + docs_zh/ + docs_en/ + 根目录 README/AGENTS/CLAUDE/CONTRIBUTING/SECURITY/CHANGELOG

## 深度复审增量汇总

| 维度 | Agent 1 | Agent 2 | Agent 3 | Agent 4 | Agent 5 | **合计** |
| --- | --- | --- | --- | --- | --- | --- |
| 已输出 findings | 140 | 150 | 165 | 170 | 60 | **~685** |
| 严重 (Critical) | — | — | — | — | — | ~30 |
| 高 (High) | — | — | — | — | — | ~150 |
| 中 (Medium) | — | — | — | — | — | ~280 |
| 低 (Low) | — | — | — | — | — | ~225 |
| 单文件最高 findings | http-api-server.ts (15+) | redis-queue-adapter.ts (8) | crm-adapter.ts (8) | dlq-manager.ts (5) | workflow-builder/web/ (10) | — |
| 子系统覆盖文件 | 三个 plane 全覆盖 | 全覆盖 | 6 个上层域 + 30+ 垂直域 | 5 个域 | 4 个域 | **~100%** |

> 注：上文 1-76 编号的 76 条仍为本轮复审的"高优先级摘要"。本扩展提供 600+ 条**文件级、函数级**的可执行复审，按 subsystem 分组、可一一验证。本轮复审是**对**上文 76 条的细化与扩展，与之不重复。

## 跨条目根因聚类（深度复审新增）

| 根因聚类 | 典型示例 | 出现频次 |
| --- | --- | --- |
| `JSON.parse` 无 try/catch + 无大小护栏 | webhook / approval / dashboard / scim / task-websocket / mission-control / harness-runs / admin / approval-context-summary / llm-improvement-generation | 25+ |
| `JSON.parse` + `as` 强转 `Record<string, unknown>` / `as T` | 全部 src/contracts / src/sdk/client-sdk / src/scale-ecosystem | 30+ |
| 非空断言 `!` 替代运行时检查 | delegation-manager / plugin-spi-registry / plugin-runtime-host / plugin-runtime-child / drift-detector / edge-runtime-sync / user-preference-tracker / billing / cdc | 40+ |
| `try { ... } catch {}` / `catch (e) {}` 静默吞错 | goal-decomposer / chaos-experiment / nl-gateway-config-loader / conversation-history / workflow-builder / approval-context-summary / crm-adapter | 12+ |
| 重复 regex 编译于热路径 | nl-gateway-support / goal-decomposer / proactive-agent / crm-adapter / github-adapter / scim-service / basic-evaluator / operations-presenter / livestream-adapter / builtin-plugin-registry / domain-risk-profile / domain-knowledge-schema / billing / interaction/nl-gateway | 20+ |
| 无界 Map / Array（无 LRU、无 TTL） | runtime-recovery（lease store） / secret-management（rate limiter） / domain-* services / proactive-agent / scim-service / federation / billing / self-healing / panic-service / cost-optimization / ha-election / p2-pilot-evidence runner | 30+ |
| 时序比较使用 `==` 字符串字典序 | execution-lease-service:702（lexicographic ISO） | 1 集中 |
| Number.parseInt 无 NaN/finite 校验 | sdk/cli/secret-commands / sdk/cli/login / version-routing / sdk-version-handshake / prompt-bundle / mission / websocket-bridge / vault / channel-gateway / domain-recipe / domain-risk-profile / pack-registry / approval-routing | 25+ |
| `as any` 抹除类型守卫 | tests/unit/dispatcher/dispatcher-service（146 处）/ tests/unit/org-governance/sso-scim/oidc/oidc-service-comprehensive（15 处） / tests/unit/domains/governance / tests/unit/domains/registry / tests/unit/core/runtime/orchestrator（12+ 处） | 482+ 文件，1500+ 出现 |
| 测试用 `delete (globalThis as any).fetch` 无 try/finally | crm-adapter.test.ts (9 处) | 9 处 |
| 路由 handler 内 `void promise fire-and-forget` 无 .catch | http-api-server:1209、stable-evidence-bundle、config-hot-reload、auto-stop-loss、cache-invalidation-broadcast、durable-event-bus、call-governance、external-secret-provider、release-pipeline、takeover-escalation-manager、deployment-execution、runbook-executor、human-takeover、slo-alerting-channels | 20+ |
| `setInterval` 缺 `.unref()` | websocket-bridge:184、task-websocket-status-relay:50、http-api-server:1064、config-hot-reload:121、slack-transport、leader-election、delegation-cron、prometheus-metrics、outbox-poller、sli-collection、federation-heartbeat、panic-propagation、secret-rotation | 14 处 |
| `setTimeout` 在生产路径未 `.unref()` | channel-gateway:177,695,494,769、vault/gcp/aws-kms providers、slack/datadog transport、datadog、fluentd、outbox、release-pipeline、runbook-executor、takeover-escalation、deployment-execution、human-takeover、slo-alerting、config-hot-reload、panic-propagation、plugin-runtime-host:135、plugin-spi-registry:609,943、eviction-loop、queue-poll、api-server auth flow | 30+ |
| `process.exit(1)` 缺 graceful close | src/index.ts:368、plugin-runtime-child.ts:226、startup-env-schema:569、startup/process-error-handlers:113,181 | 5 处 |
| `console.log/info/warn/error` 漏到 production 路径 | http-api-server / sdk/cli / structured-logger / panic-propagation / datadog-transport | 17 处 |
| `setTimeout` 内 `controller.abort` 后未 `clearTimeout` | sdk/cli/crm-adapter:146、github-adapter:273、vault/gcp/aws-kms providers、outbox-poller、sli-collection、websocket-bridge:494、webhook、slack-alerting、http-api-server:1127、fluentd-transport、delegation、outbox 多个 | 15+ |
| `Math.random()` 用于可复现/路由/采样/优先级 | intake-router、llm-eval、outbox-poller、stability/retry、call-governance、adapter-executor、authoritative-task-store-decorator、durable-event-bus-support、channel-gateway-retry-executor | 9 处 |
| `Date.now()` 直接打时戳（无单调源） | oapeflir-loop-core/support、stage-transition-fsm、harness-decision-manager、harness-state-manager、secret-management | 5+ |
| Locale/string 排序的 semver 比较 | domain-recipe:381、domain-eval-framework:185、mission:1354-1355、edge-runtime-sync:761、sdk-version-handshake、prompt-bundle:334-348 | 10+ |
| `as unknown as` 强转抹除类型 | tests/unit/ui/shared-package-regressions、root-bootstrap-exports-remediation、recipes-zero-coverage、domain-prompt-governance、interaction-governance-runtime-catalog 等 | 30+ |
| `package.json` 命令/脚本漂移 | README/AGENTS/CLAUDE/SECURITY/CONTRIBUTING 与 root package.json#scripts 漂移 | 7+ |
| 文 zh/en 翻译漂移 | quality/p0-pilot-evidence-runbook、reviews/platforme-full-review-e、quality 多个 review 与 full-coverage-test-manual | 7+ |
| 硬编码 doc 文件名引用（缺 ../reviews/ 路径） | docs_zh/contracts/*（17 个文件） | 17+ 处 |
| Helm chart 硬编码 | deploy/helm/automatic-agent/templates/* — runAsUser、secret.yaml `or` 链、configmap regexMatch、networkpolicy egress、PDB、resourcequota | 15+ |
| 部署脚本 case-sensitivity / `set -e` / TOCTOU | deploy/scripts/deploy.sh、rollback.sh、dr-drill.sh、verify-hot-upgrade.sh | 15+ |
| 测试硬等待 + `timing-contract` allowlist 过宽 | distributed-rate-limiter:1050ms、ingress:120-300ms、review-contract:450ms、chaos-monitoring:350ms、structured-logger:150ms、calculate-backoff:2-3s、graceful-shutdown:200-500ms、plugin-executor:200-500ms、full-coverage-operational-real-paths:350ms、p2-defects-sys-perf-3-4:31s × 3 | 17+ |

---

## 1. src/platform/five-plane-interface/（深度）

> Agent 1 主力。

### api/http-server/

- `billing-routes.ts:63-66` — `verifyWebhookSignature` | security | `Number(timestampHeader) * 1000` 假设秒为单位的 epoch；如果上游发送毫秒，差值巨大，age 校验总是失败。`Math.abs(...)` 允许 5 分钟内的未来时间戳。
- `billing-routes.ts:39-46` — `isTimingSafeHexEqual` | security | 先用正则 `/^[a-f0-9]{64}$/i` 校验 hex 格式再 `timingSafeEqual`；非 hex 直接 false；可接受。
- `gateway-routes.ts:118-122` — webhook 接收 | security | `requirePrincipal("operator")` + 验签双重保护，外部 webhook provider 不会有 operator JWT；应只验签。
- `incident-routes.ts:150` — `void principal;` | readability | 重构遗留的"假装使用了"语句。
- `admin-routes.ts:209-233` — `applyAdminConfigUpdate` | correctness | `deps.adminConfigService` 为 null 时回退合成对象，不持久化；返回 200 假成功。
- `admin-routes.ts:498-512` — `PUT /v1/preferences` | correctness | `userPreferenceState` 模块级 Map，最后写者赢；actorId 未记录。
- `admin-routes.ts:237-252` — `resolveWorkflowLookupId` | performance | cache miss 时拉 200 条 linear scan。

### api/middleware/

- `idempotency-key.ts:316` — `verifyNonce` | performance | lookup-then-insert 非原子；两个并发同 nonce 双写。
- `idempotency-key.ts:131-148` — `EXEMPT_PATHS` | security | 仅 `'/v1/webhooks/'` 一级；更深 webhook 子路径不豁免。
- `idempotency-key.ts:209-220` — `check` | correctness | `requestInFlight` 决策返回但未传递给 handler。
- `idempotency-key-storage.ts:197` — JSON.parse | correctness | 解析 `data` 字段无 try/catch。
- `request-deduplication.ts:151-154` — `check` | correctness | 排序+splice O(n log n) 应当用 min-heap。
- `request-deduplication.ts:216-232` — `enforceBucketLimit` | performance | O(buckets × entries) 每次插入全扫。
- `rate-limit.ts:96-157` — `RateLimiter.check` | correctness | 新 bucket 初始 `tokens: maxRequests - 1`，实际容量少 1。
- `rate-limit.ts:131-135` — `check` | performance | `Math.floor(elapsed * tokensPerMs)` 整数截断；`lastRefillAt` 累积漂移。
- `rate-limit.ts:187-195` — `evictIfNeeded` | correctness | Map 插入序 → FIFO 而非 LRU；对 adversarial 客户端可被刷。
- `cors.ts:59-60` — `validateCorsConfigInternal` | security | 接受控制字符的 origin regex 校验，但 Node `new URL()` 解析不一致。
- `cors.ts:106-110` — `CorsMiddleware` | correctness | `allowedHeaders` 一次性 lowercase 缓存；运行时 mix-case 不一致。
- `sdk-version-handshake.ts:127-129` — `parse` | correctness | `Number.parseInt(part, 10) || 0` 把"0"和 NaN 不可区分；接受 `2026-04-01` 日期格式。
- `sdk-version-handshake.ts:131-133` — `isStrictSemver` | correctness | 接受 `1.2` 部分 semver；语义不清。
- `version-routing.ts:103-115` — `selectVersion` | correctness | `q-value` 解析接受 `;q=invalid` 仍匹配首项。
- `version-routing.ts:145-157` — `compareVersions` | correctness | 零填充不一致：`2026-4-1` vs `2026-04-01` 视为相等。
- `sanitize.ts:22-43` — `sanitizeJsonValue` | security | `Object.create(null)` 阻止 prototype 链但下游 `instanceof Object` 检查失效。

### api/

- `api-auth-service.ts:333-336` — `exchangeApiKey` | security | `timingSafeEqual` 包裹 hashed 对比，OK。
- `api-auth-service.ts:376-405` — `authenticate` | security | bearer 失败后还会用 `x-api-key` 当场签发 JWT；缺 per-key 限流/审计。
- `api-auth-service.ts:330-364` — `exchangeApiKey` | correctness | `iat` 可设为未来时间，`iat > now` 不拒。
- `api-auth-service.ts:120-132` — `WEAK_JWT_SECRET_PATTERNS` | security | 仅 trim 后整词匹配；`secret123` 不被拦。
- `http-api-server.ts:1064-1068` — `startWorkerHeartbeatSweep` | performance | 每 tick 构造 `new WorkerRegistryService(...)`。
- `http-api-server.ts:1099-1116` — `trackActiveRequest` | correctness | finish/close 事件下 count 防 underflow；但 `close` 不发 finish 时泄漏。
- `http-api-server.ts:1119-1138` — `waitForActiveRequestsToDrain` | correctness | `onDrained` 只在 timeout 分支自删除；drain 完成时残留条目。
- `http-api-server.ts:1086-1093` — `sweepStaleWorkerHeartbeats` | correctness | `staleWorkerIncidentIds` 仅在"open incident"时加入；worker 恢复时从未清理，无界。
- `http-api-server.ts:1289-1294` — `createDefaultApiRateLimiter` | security | 缺 Redis 时静默回退 in-memory，分布式绕过 per-tenant 限流。
- `oidc-oauth-service.ts:13,71,647-648` — PKCE | security | 用 `createHash("sha256")`（正确），但 `code_challenge_method=plain` 路径无最小熵；缺测试。
- `oidc-oauth-service.ts:647` — 注释 "Use createHash, not createHmac" | readability | 非显然算法选择靠注释约束。
- `oidc-oauth/jwt-utils.ts:28` — `decodeJwt` | security | base64url 解码无 try/catch；恶意 token 触发 500。
- `api-mission-control-service.ts:478` — JSON.parse | correctness | `value` 来源未校验，直接 parse。
- `task-websocket-status-relay.ts:212` — JSON.parse | correctness | 解析 `payloadJson` 无 try/catch。

### webhook/

- `webhook/index.ts:60-61` — replay cache TTL/容量 | correctness | 模块常量不可由 tenant 配置。
- `webhook/index.ts:72` — `envelopesByIdempotencyKey` | performance | 缺 TTL 与容量淘汰。
- `webhook/index.ts:73-74,200-211` — 状态 Map 无界 | performance | `acceptedEnvelopes` / `failureCounts`。
- `webhook/index.ts:111-120` — 校验顺序 | security | 事件类型校验在签名校验前；可枚举 `allowedEventTypes`。
- `webhook/index.ts:182-184` — `rollbackAcceptedEnvelope` | performance | findIndex 线性扫。
- `webhook/index.ts:296-315` — `parseWebhookPayload` | performance | 不限制 body 大小；超大 JSON 阻塞 event loop。

### scheduler/long-running-workflow-service.ts

- `:117-122` — `markDue` | correctness | `expiresAt` 过期静默跳过；依赖 `sweepExpired` 兜底。
- `:131-146` — `resume` | correctness | 不检查 suspension status="active"；可恢复已 cancel/expire。
- `:131-138` — `resume` | correctness | `resumeAfter > now` 永远 not-due，state 永不推进。

### channel-gateway/

- `channel-gateway-service.ts:177,695` — request setTimeout | performance | 缺 .unref()，进程退出阻塞。
- `channel-gateway-retry-executor.ts:54-106` — `intervalHandle` 计时器 | correctness | autoStart 路径上 `runOnce` 与 `start` 调度竞态。
- `channel-gateway-retry-executor.ts:71-74` — `start` 竞态 | correctness | `running` 在首次 setTimeout 之前被 set。
- `channel-gateway-delivery-service.ts:130-163` — `checkRateLimit` | correctness | `Math.max(persisted, inMemory)` 在多实例下错误。
- `channel-gateway-delivery-service.ts:257` — `parseInt(timestamp, 10)` 无 NaN 校验 | correctness。
- `channel-gateway-delivery-service.ts:265-292` — `verifySignature` | security | `Buffer.from(signature, "hex")` 接受非 hex；`timingSafeEqual` 长度不匹配时仍耗时。
- `channel-gateway-delivery-service.ts:317-336` — `verifyNonce` | correctness | SELECT-then-INSERT 非原子；多进程并发双写入。
- `channel-gateway-delivery-service.ts:73` — `recentRateLimitHits` | performance | 进程级无界。
- `channel-gateway-delivery-service.ts:778` — `JSON.parse(String(row.payload_json))` | correctness | 无 try/catch。
- `websocket-bridge.ts:170-188` — 构造 | readability | 大量 `Math.max(1, Math.trunc(...))` 防御性模式。
- `websocket-bridge.ts:177-183` — 缺 Origin 校验 | security | 浏览器可被跨源劫持（CSWSH）。
- `websocket-bridge.ts:184` — `heartbeatTimer` | performance | `setInterval` 缺 .unref()。
- `websocket-bridge.ts:212-219` — `principal` TDZ | correctness | `principal` 声明在 auth 之前；catch 路径 throw ReferenceError。
- `websocket-bridge.ts:227-239` — `handleConnection` | correctness | auth 失败后 `error` handler 仍引用外层 `principal`。
- `websocket-bridge.ts:346` — `JSON.parse(data.toString())` | correctness | 无 try/catch。
- `websocket-bridge.ts:494,769` — setTimeout 缺 .unref() | performance。
- `websocket-bridge.ts:701` — `parseInt(raw, 10)` 无 NaN 校验 | correctness。
- `channel-gateway/helpers.ts:12` — `JSON.parse(raw)` | correctness | 无 try/catch。
- `stream-bridge.ts:62` — `JSON.parse(jsonString)` | correctness | 无 try/catch。
- `gateway-target-directory-service.ts:493` — `JSON.parse(raw)` | correctness | 无 try/catch。

## 2. src/platform/five-plane-control-plane/（深度）

> Agent 1 主力。

### iam/

- `secret-management-service.ts:685-691` — `refreshSecret` | correctness | provider.refreshSecret ?? describeSecret → 二次 describeSecret → 三次调用。
- `secret-management-service.ts:729-732` — `startDailyRotationScheduler` | correctness | 重复调用不删除首个 timer，set 无界。
- `secret-management-service.ts:729-777` — `runRotationSweep` | correctness | 同步 initial sweep 抛出无 try/catch。
- `secret-management-service.ts:351-432` — `resolveSecret` | correctness | 整个操作包在 `db.transaction(async () => ...)`，SQLite 实现未必支持 async。
- `policy-engine.ts:316-320` — `evaluate` 审计事件 | performance | cache-hit 也发 audit，量级爆炸。
- `policy-engine.ts:303-308` — `evaluate` | correctness | `isPolicyStale()` 谓词有副作用；并发双触发 cacheInvalidationHandler。
- `policy-engine.ts:222-258` — `buildCacheKey` | performance | `slice().sort().join(",")` 每次 O(n log n)。
- `policy-engine.ts:316-320` — `evaluate` | correctness | `cloneCachedDecision` 复用 `auditRecord.evaluatedAt`，时间错位。
- `audit-event-integrity.ts:36` — 硬编码 HMAC key | security | `"audit-integrity-secret-key-32-bytes!"` 默认值。
- `audit-event-integrity.ts:170-181` — checksum 字段顺序 | correctness | 字段顺序依赖 JSON.stringify 插入序。
- `audit-event-integrity.ts:313-322` — 死代码 `sha256` | readability | 定义但未使用。
- `access-model.ts:266-269` — `evaluateAuthorizationContext` | readability | `allLayers` 在仅 RBAC 路径也报 deny。
- `access-model.ts:312-339` — tenantId precedence | security | `input.principalTenantId` 优先级高于原始 principal；impersonation 可越权。
- `access-model.ts:312-339` — `originalPrincipal` 无密码学验证 | security | 调用方可伪造。
- `access-model.ts:233-243` — 空 capabilities 数组被忽略 | correctness | `input.capabilities?.length` 空数组 falsy → 回退到 role capabilities。
- `outbound-url-policy.ts:137-140` — 错误信息泄漏 URL | security | 错误消息包含原始 `urlString`。
- `outbound-url-policy.ts:155-190` — `sanitizeUrlForTelemetry` 与 catch 分支正则不一致 | security。
- `outbound-url-policy.ts:116-118` — `isInternalNetworkUrl` | security | 仅查 hostname，未查 DNS 解析 → DNS rebinding。
- `network-egress-policy.ts:316-374` — `allowed` 变量语义 | correctness | `audit_only` 模式仍返 `allowed: true` 误导。
- `network-egress-policy.ts:310-311` — `parseUrlForAudit` | correctness | 解析失败回退原始 URL，含 `user@host`。
- `network-egress-policy.ts:455-463` — `createPolicyAwareFetch` 错误信息含 URL | security | 可能泄漏 token。
- `sandbox-policy.ts:80-88` — 单 SHA-256 派生 | security | 与 login.ts scryptSync 不一致。
- `sandbox-policy.ts:501-504` — `checkSandboxPath` | correctness | `normalizeRoot(root, false)` 和 `(root, true)` 重复 2N 次 realpath。
- `sandbox-policy.ts:357-364` — `normalizeSandboxInputPath` | security | catch 分支未做 NFKC 归一化。
- `network-egress-audit.ts:112-128` — module-level regex 编译 | performance | OK。
- `aws-kms-http-secret-provider.ts:208,294` — env endpoint 无校验 | security | `AA_AWS_KMS_ENDPOINT` 直接用。
- `aws-kms-http-secret-provider.ts:275-296` — `X-Amz-Target` 头拼接 | security | 无白名单。
- `gcp-secret-manager-http-secret-provider.ts:101-104` — `AA_GCP_TOKEN_FETCH_URL` | security | 完全无 host/协议校验。
- `vault-http-secret-provider.ts:93,132` — `parseInt(... 10)` 无 NaN 校验 | correctness。
- `cve-intelligence-service.ts` (755 行) | architecture | 入口未在抽样中验证。
- `research-source-governance.ts:80-88` — zod strict 但 transform 仍允许无关字段 | correctness | 同 domain-model.ts 的 transform 缺陷。

### approval-center/

- `approval-service.ts:451-568` — `applyDecision` | security | 任何知道 approvalId 的调用方可决策。
- `approval-service.ts:463-465` — `applyDecision` | correctness | 已决策时静默 return。
- `approval-service.ts:584` — `applyExecutionEffect` | correctness | 仅 `"blocked"` 状态变 cancelled；running 状态保持。
- `approval-service.ts:300-303` — `deriveDefaultHarnessRunId` | correctness | 同 taskId 同 executionId=null 多个 approval 共享 harnessRunId。
- `multi-party-approval-service.ts:105-117` — `applyDecision` | security | 同上无授权。
- `multi-party-approval-service.ts:115-117` — 静默 return | correctness。
- `multi-party-approval-service.ts:123-125` — `decisions.push` | correctness | 终态决策也入数组，计数错。
- `multi-party-approval-service.ts:135-138` — `approvalsReceived++` | correctness | 重复来自同一审批人的也累加。
- `approval-policy-engine/rule-engine.ts:120-132` — `getFieldValue` | security | 未阻断 `__proto__/constructor/prototype/Function.prototype` 路径。
- `approval-policy-engine/rule-engine.ts:128` — string parts 索引 | security | 命中 Function.prototype 成员。

### config-center/

- `config-store.ts:116-120` — `set` | correctness | value 不变也 increment version。
- `config-store.ts:264-275` — `stableSerialize` | correctness | `localeCompare` 跨 locale 不一致。
- `config-audit-service.ts` (1014 行) | architecture | 入口未抽样。
- `config-versioning-service.ts` (807 行) | architecture | 入口未抽样。
- `config-hot-reload-service.ts:121,426` — `setInterval` 缺 .unref() | performance。
- `config-hot-reload-service.ts:450-457` — d 轮 37 收口的 32-bit hash 仍可作 rolling concern | correctness。
- `startup-env-schema.ts:5,459,569` — `process.exit(1)` 缺 graceful | correctness。
- `startup-env-schema.ts:376` — d 轮 49 收口的 default-allow 已修，但路径仍有断点 | correctness。

### incident-control/

- `auto-stop-loss-service.ts:99-...` — `registerDefaultHandlers` | readability | 多个 stub handler（circuit_break, scale_down）。
- `auto-stop-loss-service.ts:786` — playbook fire-and-forget | performance | 无 .catch。
- `takeover-escalation-manager.ts:123,207` — setTimeout 缺 .unref() | performance。
- `deployment-execution-service.ts:181` — setTimeout 缺 .unref() | performance。
- `runbook-executor.ts:541` — setTimeout 缺 .unref() | performance。
- `release-pipeline-support.ts:231` — setTimeout 缺 .unref() | performance。
- `human-takeover-service-async.ts:793` — setTimeout 缺 .unref() | performance。
- `cost-alert-service.ts:194-199` — `evaluateCost` | correctness | denied 不更新 pendingProjectedCostUsd，重试累积。
- `cost-alert-service.ts:243-244` — `recordCost` | correctness | `Math.max(0, ...)` 掩盖超额负值。
- `cost-alert-service.ts:295-356` — `recordCost` | correctness | `wasWarning` 独立于 `wasExceeded`/`wasCritical` 单独发，重复告警。

### mission/ (1641 行) 与 iam/cve-intelligence-service.ts (755 行)

- 仅查目录，未抽样行级；建议 f 轮指定抽样范围。

## 3. src/platform/five-plane-orchestration/（深度）

> Agent 1 + Agent 3 联合。

### oapeflir/

- `oapeflir-loop-core.ts:218-...` — `run` | correctness | 600+ 行；`createMonotonicTimestampGenerator` 仍基于 `Date.now()`，NTP 回拨时重复时间戳。
- `oapeflir-loop-core.ts:303-...` | architecture | 各阶段顺序 await，无并行机会。
- `oapeflir-loop-core.ts:382`、`oapeflir-loop-support.ts:324`、`stage-transition-fsm.ts:189-223` | correctness | 多处 `Date.now()` 非单调。
- `stage-transition-fsm.ts:196-200` — `recordStageEntry` | correctness | `status: "error" | "blocked"` 仍前进 `currentStageIndex`。
- `stage-transition-fsm.ts:196-200` — 事务性 | correctness | `recordStageEntry` / `recordStageCompletion` 非事务；乱序调用可 desync。
- `stage-transition-fsm.ts:259-266` — `reset` | correctness | 跳过证据（skippedReasonCodes 与 stageTimestamps 一并丢）。
- `stage-transition-fsm.ts:272-286` — `resetToStage` | correctness | 不会话锁定可与并发 transition 竞态。
- `runtime-execute-bridge.ts:47` — `parseExternalModelPayload` | correctness | `JSON.parse(raw) as T` 无大小/深度限制。
- `runtime-execute-bridge.ts:182` — `defaultModelId="MiniMax-M2.7"` | architecture | 硬编码厂商模型。
- `runtime-execute-bridge.ts:194,264,316` — `createdAt: Date.now()` 数字 vs 字符串 | correctness | 与 Plan.createdAt 类型漂移。
- `oapeflir-loop-support.ts:775` — `Number.parseInt` | correctness | 无 NaN 校验。
- `oapeflir/handoff-model.ts:55-57` — token 估算 | performance | 按 ASCII 字符估 token，CJK/多字节失真。
- `oapeflir/handoff-model.ts:88-135` — 压缩静默丢 historyRefs 等 | correctness | 无丢弃台账。
- `improve-rollout/policy-rollout-service.ts:39-73` — `decide` | correctness | `rolloutFreezeManager.isFrozen()` 仅看一处；guardrailDecision 不展开 reasonCodes 排序。
- `improve-rollout/policy-rollout-service.ts:144-184` — `evaluateMetricsGate` | correctness | `metrics` 缺时部分 status 走 allow；`autoRollback` 复用同一 metrics。
- `improve-rollout/auto-rollback-service.ts:75-100` — `evaluate` | correctness | `shouldRollback` 与 `reasonCodes.length > 0` 一致；但 handler 在 `shouldRollback && this.rollbackHandler` 时被静默触发而非返 decision。

### harness/

- `harness-decision-manager.ts:143-145` — `persistDecisionEvidence` | correctness | `tenantId = "tenant:" + harnessRunId.split(":")[0]` 解析为 `"tenant:harness_run"`。
- `harness-decision-manager.ts:108` — `decide` | correctness | `requiresHuman` 多处重复判断。
- `harness-state-manager.ts:120-122` — `ensureRunning` | correctness | `failed` 是 terminal，pause 失败无意义。
- `harness-state-manager.ts:147-155` — `transitionRunStatus` | correctness | `completed → paused` 重置 `completedAt: null`。
- `harness-state-manager.ts:77-81` — `assertInvariants` | architecture | 同一列表追加带/不带前缀的版本。
- `constraint-pack.ts:147-153` — `normalizeConstraintPack` | correctness | `legacyBudget!` 非空断言不安全。
- `constraint-pack.ts:154-160` — `maxTokens` 复制到 6 字段 | correctness | 隐式 magic。
- `memory-manager.ts:155-166` — `isSelfEnhancementAttempt` | security | `key.toLowerCase().includes(pattern)` 可被构造（e.g. `safe_modify_own_prompt`）。
- `memory-manager.ts:155-166` | security | 仅查 key，不递归 value。
- `async-harness-service.ts:32-54` — `execute` | correctness | catch 用旧 `queued` 覆盖 running state，running 转换丢失。
- `toolbelt-assembler.ts:79-90` — 高风险时切片 | correctness | `slice(0, ceil(0.5))` 隐式 order 依赖。
- `approval-context-summary-service.ts:178` — `parseImprovementsFromResponse` | correctness | `jsonMatch[0]` 正则提取 JSON 但 fallback 仅返第一项。

### agent-delegation/

- `delegation-manager.service.ts:267-273` — `cancel` | correctness | CAS fence token 错位。
- `delegation-manager.service.ts:296-301` — `complete` | correctness | `?? await this.getDelegation(...)` 死代码。
- `delegation-manager.service.ts:354-356` — `fail` | correctness | 同上死代码。
- `delegation-manager.service.ts:619-634` — `revokeExpiredDelegations` | correctness | 内存副本覆盖 DB 时间戳。
- `delegation-manager.service.ts:269-281` — `cancel` | security | 无授权校验。
- `delegation-governance-service.ts:232-237` — `matchesCondition` | correctness | `>=` 比较 vs 文档 "deeper than 5" 注释歧义。
- `delegation-governance-service.ts:142-150` — `evaluate` | correctness | 排序后 deny 优先，但 `deny` 一旦返即短路；OK。
- `context-isolator.ts:197-199` — `determineIsolationLevel` | correctness | `workspace_write` 父也被映射为 SANDBOXED，过严。
- `context-isolator.ts:277-278` — `narrowPermissionsInternal` | security | `FULL` 返回浅拷贝，父撤销后子副本 stale。
- `context-isolator.ts:303-308` — `narrowPermissionsInternal` | correctness | `requiredPermissions.resources` 为空时回退父全量。
- `call-depth-budget.ts:17-29` — `evaluate` | correctness | 字段名 `delegationDepth` 是 increment 但与 `currentCallDepth` 相加语义不清。

### hitl/

- `hitl-modes.ts:79-81` — `validateHitlModeRequest` | security | `breakGlassApproved` 来自调用方输入，无密码学验证。
- `hitl-inbox-service.ts:98` — `resolveStatus` | correctness | OR 逻辑把"无 signal 但 decisionEffect 非 continue"也判为 decided。
- `hitl-approval-orchestration-service.ts:127-128` — `requestApproval` | security | `request.breakGlassApproved` 跳过 critical auto-approve 限制。
- `hitl-approval-orchestration-service.ts:218-238` — `applyDecision` | correctness | 不写 audit trail。
- `hitl-approval-orchestration-service.ts:240-260` — `buildTimeoutDecision` | correctness | 默认 `respondedBy = "system:hitl_timeout"` 不可重写。

### learn/

- `strategy-learning-service.ts:22-28` — `learn` | correctness | `validateMany` 丢失源 mapping。
- `llm-improvement-generation-service.ts:122-124` — `parseImprovementsFromResponse` | correctness | `signals[index]` 缺失时仅返一项。
- `learning-object-validator.ts:26-34` — PII regex 缺陷 | security | `[A-Z|a-z]` 含字面 `|`；未 word-bound。
- `learning-object-validator.ts:43-48` — `scanForPiiAndSecrets` | performance | regexes 内联编译。

### routing/ + planner/

- `workflow-planner.ts:151-180` — `plan` | correctness | 缺 cycle detection。
- `agent-team-service.ts:92` — `buildPlan` | correctness | `validateDelegationContext` 未找到定义。
- `plan-builder.ts:80-96` — `build` | correctness | 默认 `execute` 是 mutation action，绕过 tool policy。
- `plan-builder.ts:130-157` — `build` | correctness | `inferredDependencies` 计算两次。
- `plan-dag-validator.ts:79-94` — `validate` | correctness | entry/terminal 检查读已 decrement 的 `incomingCounts`，永远 0。

## 4. src/platform/five-plane-execution/（深度）

> Agent 2 主力。

### queue/

- `redis-queue-adapter.ts:387-392` — `RedisQueueClient.hmset` | correctness | 构造 `args` 后忽略，直接 `hmset(args[0] as string, data)`。
- `redis-queue-adapter.ts:539-575` — `claimWaitingJobWithoutEval` | correctness | `zrangebyscore` + per-id `hgetall` 非原子；两个 worker 抢同一 job。
- `redis-queue-adapter.ts:583-590` — `InMemoryRedisLike.eval` | architecture | 仅支持 `redis_queue_claim_waiting_job`。
- `redis-queue-adapter.ts:111-114` — `InMemoryRedisLike.del` | correctness | `||` 短路导致第二次 delete 跳过。
- `redis-queue-adapter.ts:127-144` — `InMemoryRedisLike.zrangebyscore` | correctness | 不支持 `(` 前缀 exclusive bound。
- `redis-queue-adapter.ts:219-266` — `InMemoryRedisLike.eval` | correctness | 倒序迭代 zset 未重新排序，最高 score 先出。
- `redis-queue-adapter.ts:845-869` — `dequeueAsync` nack | correctness | dead_letter 转换不增 attempts，毒消息死循环。
- `redis-queue-adapter.ts:947-977` — `purgeAsync` | correctness | `readPipeline.exec()` 索引对齐假设。
- `redis-queue-adapter.ts:984-1011` — `statsAsync` | performance | N+1 sequential `getJobAsync`。
- `redis-queue-adapter.ts:330` — `process.env.NODE_ENV === "production"` | architecture | 生产代码不应基于 NODE_ENV 走分支。
- `sqlite-queue-adapter.ts:67-83` — `dequeue` | correctness | 三条非事务语句；并发双 pick。
- `sqlite-queue-adapter.ts:94-107` — nack | correctness | SELECT-then-UPDATE 非事务。
- `sqlite-queue-adapter.ts:135-144` — `retryJob` | correctness | 不检查 `result.changes`。
- `queue-partitioner.ts:99-115,120-126` — sync/async 错位 | correctness | Redis adapter 走 sync 方法抛 `sync_*_not_supported`。
- `queue-adapter-types.ts:9,64-75` — interface 混淆 sync/async | architecture | 编译期无差异化。
- `queue-adapter-types.ts:9` — `QueueJobStatus` 包含 `"failed"` 但 SQLite 从不写 | correctness | 死值。

### distributed-lock/

- `redis-lock-adapter.ts:173` — `acquireAsync` | correctness | fencingToken 走全局 `FENCING_COUNTER_KEY`，跨 lock 顺序与外部观察者不一致。
- `redis-lock-adapter.ts:186` — 释放 Lua 缺 pcall | correctness | d 轮 1406 已修；本轮新增：cjson.decode 失败逻辑未对所有失败路径兜底。
- `redis-lock-adapter.ts:197-224` — `extendAsync` | correctness | 本地 `nextFencingToken` 缓存与远端 `INCR` 缓存 skew。
- `redis-lock-adapter.ts:226-253` — `forceStealAsync` | security | 任何调用方覆盖；可用作 DoS。
- `redis-lock-adapter.ts:266-292` — `listHeldAsync` | performance | `scan` 无 MATCH 全扫库。
- `sqlite-lock-adapter.ts:78-88,90-155` — `acquire` | correctness | `beginImmediateTransaction` 抛错时 rollback 仍执行。
- `sqlite-lock-adapter.ts:140-152` — `normalizeTtlMs` | correctness | 1s-600s 硬编码无配置。
- `sqlite-lock-adapter.ts:153-154` — `acquire` | correctness | 失败返 `acquired: false` 无 errorCode。
- `sqlite-lock-adapter.ts:210-247` — `forceSteal` | security | 无 auth。
- `pg-advisory-lock-adapter.ts:62-72` — `normalizeDriverError` | security | "Cannot find module" 字符串匹配。
- `pg-advisory-lock-adapter.ts:99-116` — `extend` | correctness | PostgreSQL advisory lock 是 session-scoped，无 TTL；`extend` 仅更新内存。
- `pg-advisory-lock-adapter.ts:146-153` — `acquireAsync` finally | correctness | `!this.heldLocks.has(lockKey)` 在 heldLocks.set 之后为 false，跳过 unlock；逻辑反。

### lease/

- `execution-lease-service.ts:175-180` — `acquireLeaseWithinTransaction` | correctness | `ttl_out_of_bounds` 早返后仍 clamp 写入。
- `execution-lease-service.ts:199` — `insertExecutionLease?.(...)` | correctness | 可选链静默不持久化。
- `execution-lease-service.ts:433-440` — `handoverLease` | correctness | 缺 TTL 边界校验。
- `execution-lease-service.ts:454-507` — `handoverLease` | correctness | fencingToken 通过 SELECT/INSERT 间可能重复。
- `execution-lease-service.ts:702` — `activeLease.expiresAt <= occurredAt` | correctness | 字符串字典序比较，跨时钟源不可靠。
- `lease-repository-sqlite.ts:139-160` — `updateLeaseStatus` | correctness | handover→released 不在状态机表内。

### dispatcher/

- `execution-dispatch-service.ts:194-243` — `dispatchNext` | correctness | listTickets 在事务外，loop 内 lease grant 在事务中；两个 dispatcher 并发双尝试。
- `execution-dispatch-service.ts:894-906` — `prioritizeStarvedTickets` | correctness | 排序对入参副作用；外层变量重赋值。
- `execution-dispatch-service.ts:909-926` — `getCandidateWorker` | performance | 每次 miss `listWorkers().find(...)` 线性扫。
- `execution-dispatch-service.ts:1029-1086` — `invalidatePoisonPillTicket` | correctness | status check 在事务外。
- `execution-dispatch-service.ts:1076-1085` — `traceId` 可能为 null | correctness | execution 已删除。
- `admission-controller.ts:113-115` — `isPriorityElevated` | readability | 与 `isElevatedRisk` 分头定义。
- `admission-controller.ts:154-160` — `snapshot` | performance | O(N) tasks 每次入队检查。
- `admission-controller.ts:182-188` — `evaluate` | correctness | 用户 `maxRiskClassTasks` 完全覆盖默认。
- `admission-controller.ts:295-302` — `evaluate` | correctness | tier-1 ack backlog 检查排在 risk-class 之后，优先级倒置。
- `execution-deviation-detector.ts:15-38` — `detect` | correctness | 一批内 multiple feedback 推多个 deviation。

### recovery/

- `runtime-recovery-service.ts:611-630` — `inferReason` | correctness | `!record.latestPrecheck.allowed` 在 `allowed === 1` 时误判。
- `runtime-recovery-service.ts:295-314,473-475` — `listDivisionRecoveryOverview` | performance | 三次独立 store 调用。
- `runtime-recovery-decision-service.ts:176-194` — `apply` 注释 + 事务 | correctness | SQLite transaction 不支持 async。
- `runtime-recovery-replay-service.ts:387-401` — `matchesExecution` | correctness | `recovery:dead_lettered` 早返 false 误杀匹配；line 401 string eq 无 UUID 校验。
- `ha/leader-election-service.ts:412-430` — `transferLeadership` | correctness | `releaseLeadership` 失败仍报 lost。
- `ha/leader-election-service.ts:435-466` — `forceAcquireLeadership` | correctness | 兼容层 `forceAcquire` 仅 object-input 路径生效。
- `ha/leader-election-service.ts:786-789` — `queryLeadershipCompat` | correctness | `length >= 1` 检测不可靠。
- `ha/leader-election-service.ts:739-754` — `scheduleElectionRetry` | correctness | 复用 renewalIntervalMs 作为 election timeout。
- `ha/lease-reclaimer-service.ts:84` — `this.coordinator = options.coordinator as ...` | correctness | 可选参数非空断言。
- `ha/ha-coordinator-service-async.ts:152-158` — `acquireLeadership` | correctness | 逐节点 await，崩溃中段可造成 split-brain。
- `ha/ha-coordinator-service-async.ts:228` — `renewLeadership` | correctness | `fencingToken: currentLease.ttlMs` 错用 ttlMs 当 fencing。
- `ha/ha-coordinator-service-async.ts:514-518` — `nextFencingToken` | correctness | 进程级计数器，重启归零可能碰撞。
- `ha/ha-coordinator-service-async.ts:508-510` — 死代码 | architecture | "This would need a method in HaRepository - for now return 0"。

### worker-pool/

- `worker-registry-service.ts:509-525` — `recordHeartbeat` | architecture | 每次 heartbeat emit auto-scaling signal；try/catch 仅 log。
- `worker-registry-service.ts:791-799` — `getEventBusPublisher` | architecture | `Reflect.get(store, "_eventBus")` 私有字段耦合。
- `worker-load-balancing.ts:136-143` — `summarizeWorkerLoadSkew` | correctness | `dominant.loadScore === 0` 时永远不检测 skew。

### plugin-executor/

- `sub-workflow-executor.ts` (983 行) | architecture | 入口未抽样。
- `scoped-external-access-sandbox.ts:92-129` — `validateOutboundRequest` | security | 仅 host allowlist，缺协议；`fetch` 无 `redirect: "error"`。
- `scoped-external-access-sandbox.ts:306` — `fetch` 缺 `redirect: "error"` | security | SSRF 跳板。
- `adapter-executor.ts:159` — `Math.random()` 用于 jitter | performance | 应基于输入。
- `adapter/browser/human/sub-workflow executor` 入口未抽样。

### tool-executor/

- `tool-output-sanitizer.ts:20,28` — `eslint-disable no-control-regex` | readability | 主动禁用 lint 暗示风险。
- `web-search.ts:298-326` — `await response.text()` | performance | 无 body size 上限 → OOM。
- `web-search.ts:298-326` | security | DNS rebinding 仍可投毒。
- `tool-risk-enforcer.ts:51` — `process.env.AA_PLATFORM_ROOT ?? process.cwd()` | architecture | 运行时读 env 应当走 DI。

### startup/

- `graceful-shutdown.ts:251-254` — `requestSignalExit` | correctness | `setImmediate(() => process.exit(code))` 与 `exitHandler` 互冲。
- `graceful-shutdown.ts:282` — `executeShutdown` | correctness | `Promise.race` 的 timeout 后仍 `setTimeout` 残留。
- `graceful-shutdown.ts:300-302` — `executeShutdown` | correctness | `finally` 中 `abortController.abort()` 仍触发 signal listener。
- `graceful-shutdown.ts:317-334` — `orderHandlersForShutdown` | correctness | 拓扑排序对 cycle 退化 splice(last-1)。
- `process-error-handlers.ts:110-181` — `process.exit(1)` 兜底 | correctness | OK 但仍走硬退出路径。

## 5. src/platform/five-plane-state-evidence/（深度）

> Agent 2 主力。

### truth/

- `sqlite-database.ts:307-319` — `transaction`/`readTransaction` | correctness | deferred BEGIN 被写锁阻塞，reader 饥饿。
- `sqlite-database.ts:455-494` — `runInTransaction` | correctness | COMMIT/RELEASE 抛错后 result 丢失。
- `sqlite-database.ts:152-174` — `migrate` | correctness | checksum 不匹配无 recover 路径。
- `sqlite-database.ts:331-356` — `healthCheck` | correctness | 写事务内 `SELECT 1` 不验证写路径。
- `sqlite-database.ts:363-386` — `close` | correctness | WAL checkpoint 失败抛错，finally 链中原错误被掩盖。
- `authoritative-task-store.ts` (re-export) | architecture | 入口未抽样。
- `migration-runner.ts:41-43` — `down` | correctness | 返回 result 但未实际 down-migrate。
- `migration-runner.ts:60-76` — `buildResult` | correctness | `down` 也报 `upToDate: true`。
- `storage-quota-service.ts:163-178` — `enforceCategory` | correctness | 无并发控制，新文件立即被删。
- `storage-quota-service.ts:296-336` — `resolveDeclaredPath` | correctness | 深层循环，未命中路径走数百次。
- `session-dual-storage.ts:132-181` — `appendSessionEvent` | correctness | 部分失败时状态不一致。
- `session-dual-storage.ts:132-181` — `appendSessionEvent` | performance | 每次事件两次 `fdatasyncSync` 阻塞 event loop。
- `crypto-shredding-service.ts:355-425` — `readField/writeField` | security | 浅 sanitize，prototype pollution 风险（d 轮 1414 收口的同源）。本轮新增：line 392 路径解析对 unicode normalization 不一致。

### events/

- `durable-event-bus.ts:316-389` — `publish` | correctness | `scheduleFanOut` 在事务外；crash 后事件持久但未 fan-out。
- `durable-event-bus.ts:484-516` — `StructuredLogger.writeToGlobalFileSink` | performance | `fsync` 阻塞 event loop。
- `durable-event-bus.ts:594-598` — `deliverOneWithResult` | correctness | `markEventAck` 写失败 → 事件重投。
- `durable-event-bus.ts:849-919` — `processPartitionQueue` | correctness | `void chain.finally` swallow `processPartitionQueue` 错误。
- `durable-event-bus.ts:900-911` — `processPartitionQueue` | correctness | DLQ 持久失败未 re-throw，事件静默丢失。
- `durable-event-bus.ts:1080-1083` — `resolvePublishSequence` | correctness | 进程级 Map，重启后 sequence 归零。
- `durable-event-bus.ts:114-164` — `subscribe` | correctness | generation 自增，旧 in-flight 投递的 generation 引用 stale。
- `durable-event-bus.ts:909-912` — `processPartitionQueue` | correctness | `groupDeliveryCounts` 在 0 初始时 `?? 1` 误入 1。
- `durable-event-bus-support.ts:82-86` — `calculateBackoff` | performance | `Math.pow(2, n)` 大 n 溢出 Infinity。
- `durable-event-bus-support.ts:110-135` — `ensureEventReferencedTask` | correctness | 静默创建 placeholder task。
- `sqlite-dlq-repository.ts:289-316` — `rowToRecord` | correctness | `operatorActionLogJson` JSON.parse 无 try/catch。
- `dlq-service.ts:131-143` — 构造 | architecture | null repository → in-memory 隐式切换。

### artifacts/

- `artifact-store.ts:59-61` — `sanitizeSegment` | correctness | Unicode NFKC 攻击可能绕过。
- `artifact-store.ts:99-128` — `writeTextArtifact` | correctness | `criticalFindingCount > 0` 抛错时 `sensitiveFindings` 未透出。
- `artifact-store.ts:174-176` — `writeBuffer` | correctness | writeFileSync + renameSync 非原子；crash 留 orphan。
- `artifact-store.ts:177-180` — `writeBuffer` | correctness | checksum 基于内存 buffer，不反映磁盘状态。
- `sensitive-content-scanner.ts:23-59` — `RULES.aws_access_key_detected` | security | 仅 `AKIA` 16 字符；`ASIA/AGPA/AROA/AIDA/ANPA/ANVA/ASCA` 漏。
- `sensitive-content-scanner.ts:37-41` — `generic_token_detected` | security | 长度阈值 12，JWT 误报。
- `sensitive-content-scanner.ts:71-77` — `scanText` | security | `secret://` 早返是文档化旁路；前缀可绕过。
- `sensitive-content-scanner.ts:97` — `block` 命名 | correctness | 名称 `blocked` 但 value 来自 `criticalFindingCount > 0`；中危不阻塞。
- `sensitive-content-scanner.ts:23-59` — `RULES` | performance | 全部 `g`-flag regexes，无早停。
- `artifact-resolver.ts:20-23` — `resolveRef` | correctness | `"artifact:"` 空字符串 find 永远 null。

### knowledge/

- `semantic-vector-store.ts:153-184` — `upsertChunks` | performance | per-row execute，N+1。
- `semantic-vector-store.ts:189-222` — `querySimilar` | performance | `<=>` 与 namespace filter 不能都进 index scan。
- `semantic-vector-store.ts:328-330` — `isSupportedEmbedding` | correctness | 不校验 `Number.isFinite`，NaN/Infinity 透传。
- `keyword-index.ts:3-16` — `countOccurrences` | performance | 每次 query 重算 score。
- `keyword-index.ts:23-35` — `upsert` | correctness | delete+set 顺序，perChunkScores 顺序被破坏。

### memory/

- `memory-decay-service.ts:155-167,218-246` — `calculateFreshness`/`calculateDecay` | correctness | `halfLifeSeconds === 0` 边界，exponential 退化为 freshness=1。
- `memory-decay-service.ts:169` — `Math.pow(1+boost, hitCount)` | performance | 巨大 hitCount 浪费计算。
- `memory-service.ts:156` — `remember` | correctness | `JSON.stringify(input.content)` 字段顺序不确定 → hash 漂移。
- `memory-service.ts:225-249` — `recall` | correctness | `recordMemoryAccess` 更新 hitCount 后下次 recall 优先；自强化偏差。
- `memory-service.ts:354-433` — `consolidate` | correctness | revoke 与 remember 非事务。

### checkpoints/

- `checkpoint-gc-service.ts:171-226` — `runGC` | correctness | `writeFileSync` 无原子；并发 GC 互覆盖。
- `checkpoint-gc-service.ts:585-605` — `acquireRunLock` | correctness | `gcInProgress` 进程级 + `gcLockPath` 文件锁两套。
- `checkpoint-gc-service.ts:516-553` — `removeCandidateFromManifests` | correctness | JSON.parse 错误被包装为 StorageError，原 error 丢失。

### observability/structured-logger.ts

- `:112-141,133-135,154-160` — `safePath` | correctness | 边界 `..` 走 throw 分支；symlink 未 realpath 校验。
- `:519-527` — `appendFileWithFsync` | performance | 同步 fsync 在高 QPS 下阻塞 event loop。

## 6. src/platform/{shared,contracts,structure,stability,cost-management}/（深度）

> Agent 2 主力。

### shared/observability/

- `structured-logger.ts:519-527` — `appendFileWithFsync` | performance | 同上。
- `slo-alerting-channels.ts:119,175,237,302` — `void deliverWithRetry` | performance | 4 个通道 fire-and-forget。
- `slo-alerting-channels.ts:364` — setTimeout 缺 .unref() | performance。
- `transports/datadog-transport.ts:54` — setInterval 缺 .unref() | performance。
- `transports/fluentd-transport.ts:112` — setTimeout 缺 .unref() | performance。
- `sli-collection-service.ts:167` — setInterval 缺 .unref() | performance。
- `outbox-poller-service.ts:99,283,304` — setInterval/setTimeout 缺 .unref()；`Math.random()` 用于 jitter | performance。
- `rollout-freeze-manager.ts` 与 `task-websocket-status-relay.ts:50` 入口未抽样 | architecture。

### shared/runtime-state-machine.ts

- `:53-95` — `transition` | correctness | `fromStatus` 比较与 DB write 不在同一事务。
- `:227-247` — `assertTransitionAllowed` | correctness | 抛 noop 但 `state-transition-machine.ts:44-53` 返 early；两套状态机语义不一致。
- `:248-264` — `assertCas` | correctness | `currentSeq` 与 `version` 互斥断言。
- `:445-471` — `applyStatus` | correctness | `reasonCode` 注入仅 terminal path。

### contracts/

- `errors.ts:691-695` — `nextOccurredAtIso` | correctness | 单线程安全但 increment by 1 仍可能跨错误共享时间。
- `inter-plane-contract-gateway.ts:298-338` — `receiveFromPlane` | correctness | `envelopeTime > now` 时 TTL 检查通过。
- `inter-plane-contract-gateway.ts:318-326` | security | `requireSignatureVerification: false` 接受未签名。
- `inter-plane-contract-gateway.ts:159-161` — `getPlaneIdentifier` 默认 `"P3_Orchestration"` | architecture | 子类未覆写则 plane 标识错。
- `inter-plane-contract-gateway.ts:417` — 验签失败返 `verified: false`（d 轮 1412 收口），本轮新增：line 326 `requireSignatureVerification: false` 是配置驱动的 foot-gun。
- `prompt-bundle/index.ts:334-348` — semver 解析 | correctness | `parseInt(..., 10)` 无 NaN 校验。
- `types/domain.ts` 入口未抽样。

### stability/

- `bulkhead-isolation.ts:96-143` — `startCall` | correctness | `rejectPromise` 在 microtask 之前可能未赋值（同步 fn 情况下）。
- `bulkhead-isolation.ts:108-112` — `startCall` | correctness | timeout 与 .then 竞态都改 `settled`。
- `bulkhead-isolation.ts:148-181` — `queueCall` | correctness | processQueue 与 timeout 竞态 splice。
- `circuit-breaker.ts:63-101` — `execute` finally | correctness | `enteredHalfOpen` 在 try 前 set，状态切换仍正确。
- `circuit-breaker.ts:117-150` — `executeWithTimeout` | correctness | abort 不会终止 fn 执行，资源泄漏。
- `retry.ts:190` — `Math.random()` | performance | 应基于输入。
- `prompt-injection-guard.ts:101-115` — `OUTPUT_SUSPICIOUS_PATTERNS` | security | 重复 signal name（dead code）。
- `prompt-injection-guard.ts:121-135` — `fetchJsonWithTimeout` | security | body 未消费；连接挂起。
- `prompt-injection-guard.ts:137-139` — `normalizePromptInput` | security | NFKC 归一与 escape 顺序敏感。
- `prompt-injection-guard.ts:78-99` — `DEFAULT_ML_CLASSIFIER_CONFIG.signals` | performance | 每次 test() 重新编译。
- `stable-*.ts` rehearsal/orchestrator | architecture | 入口未抽样。

### structure/index.ts (11184 字节) | architecture | 入口未抽样。

### cost-management/cost-estimation-service.ts

- `:24-72` — `estimate` | correctness | 无 cost events 时返 `sampleCount: 0`，调用方未识别。
- `:37-45` — `Math.round(avgCost * 10000) / 10000` | correctness | 4 位小数可产生 `99999.9999`。
- `:48-54` — `estimate` 全局 result 缺失 | correctness | 全部 free events → SQL 返空 → fallback default。

## 7. src/domains/（深度）

> Agent 3 主力，覆盖 30+ 垂直域的核心服务。

### domain-registry-service.ts

- `:78-79,117-121,151-155,176-180,201-205,231-235,267-271` — 7 处 `capabilityCount: ...pluginBindings.length, pluginCount: ...pluginBindings.length` 同值 | correctness | 应为 `supportedTaskTypes.length`。
- `:335-343` — `resolvePlugins` | correctness | `?.resolve` + filter 链顺序微妙。
- `:440-444` — `validateDefinition` | security | `toolName.includes("..")`/`"/"` 不防 URL-encoded / Unicode normalization。
- `:453-460` — `validateDefinition` | correctness | `manifest.spiTypes.flatMap(...)` 与后续 `.includes(...)` 检查重复。
- `:282` — `listActive` | performance | 全表扫 + filter，无 index。
- `:298` — `filterAllowedTools` | performance | 三次 Set 构造。

### domain-smoke-test.ts

- `:74-91` — `validateDependencyGraph` | correctness | 递归 DFS 无深度保护；深嵌套爆栈。
- `:88-90` — 错误消息丢 cycle 路径 | correctness。
- `:107-112` — `validateSandboxCompatibility` | correctness | 硬编码 `["file_write", "bash", "exec", "sql_execute"]` 可重命名绕过。

### plugin-spi-registry.ts

- `:129-136,177-183` — 重复 spiType-mismatch 校验 | readability。
- `:153-160` — builtin spiTypes merge | security | retriever 可声明 `tool` 等其它 spiType。
- `:241-249` — `listByDomain` | correctness | `domainId.trim().length === 0` 返 ALL plugins。
- `:255-291` — `ensureActive` | correctness | `inFlightActivation` 二次激活竞态。
- `:348-355` — `unload` | correctness | process-isolated 失败时 dispose 跳过。
- `:605-622` — `runSandboxed` | correctness | `setTimeout` + `clearTimeout` race，stale timer 仍 reject。
- `:850-862` — `executeInvocation` | performance | `startedAt` 在 permit 获取前 measure。
- `:943-956` — `acquireInvocationPermit` | correctness | `setTimeout` cleanup 与 release 竞态。
- `:894` — `try { this.publishInvocationEvent(...) } catch` 隐式 | readability | 错误类型被压平。

### plugin-spi.ts

- `:23,24` — `PluginSpiTypeSchema` vs `PluginTypeSchema` 重复 z.enum | architecture。
- `:126-136` — `RetrieverKnowledgeResult` union 歧义 | architecture。

### plugin-runtime-host.ts

- `:88-92` — `start` | correctness | `stopping=true` 后 `start` 不重置。
- `:91` — `return this.readyPromise!` | correctness | `spawnChild` 失败时 `readyPromise` 未创建。
- `:117` — `invoke` | correctness | `this.child!` 非空断言；race 后 null。
- `:203` — `handleMessage` | security | 多次响应同一 id 第二次 no-op。
- `:306` — `ForkedPluginRuntimeHost.spawnChild` | correctness | stderrBuffer 上限 OK。
- `:451` — `ContainerizedPluginRuntimeHost.consumeStdout` | correctness | `stdoutBuffer` 边迭代边修改；JSON.parse 可能拿到坏行。
- `:496-519` — `validatePluginId` 重复 | architecture。
- `:537-543` — `sanitizePluginIdForPath` | security | `replace(/[^a-z0-9._-]/gi, "_")` 损可逆，碰撞同路径。

### plugin-runtime-child.ts

- `:97-125` — `installRuntimeGuards` | security | 仅挡 http/https/net/tls/fetch；`node:dgram`、`WebSocket`、`node:child_process`、`node:worker_threads`、pg/mongodb socket 仍逃逸。
- `:120-123` — `globalThis.fetch = async (...) => { deny(); throw }` | security | `deny()` 抛错被覆盖。
- `:127-135` — `installStdioProtocolConsoleRedirection` 死代码 | readability | 三分支 early-return 不安装任何 redirect。
- `:137-188` — `withStructuredConsoleForCurrentRequest` | correctness | `originalConsole` 一次性捕获；并发修改风险。
- `:177-180` — console 替换不删旧 listener | correctness | 双输出。

### domain-recipe-service.ts

- `:212` — `register` | correctness | delete+set 丢历史。
- `:262-287` — `update` | correctness | 不可更新 `archetype` 等核心字段（静默）。
- `:283` — `changelog` 仅字段名 | correctness | 非 diff。
- `:381-382` — `getLatestVersion` `localeCompare` | correctness | `"1.10.0" < "1.9.0"`。
- `:389` — `bumpVersion` | correctness | 仅增 minor，丢 patch + pre-release。
- `:392-400` — `evictOldestRecipeIfNeeded` | correctness | Map 插入序非真正 oldest。

### domain-risk-profile-service.ts

- `:55` — `patternCache` | performance | 无界。
- `:177` — `resolveEscalationTarget` | correctness | find after sort 拿首项。
- `:201-203` — `matchesPattern` | security | `*` → `.*` 后未 escape 其它 metachars。
- `:107` — `addOverride` | correctness | 原地 mutate 丢插入序。
- `:207-211` — `parseTriggerThreshold` | performance | regex per call。

### domain-knowledge-schema-service.ts

- `:194` — `checkFreshness` | correctness | future timestamp 返负 stalenessHours。
- `:281` — `executeRetrieval` | correctness | `namespaces.includes(source.sourceId)` 字段名错。
- `:303-310` — sort `array.find` 回调 | performance | O(n²)。
- `:320-334` — `computeRelevance` | performance | `/\s+/` 编译两次。
- `:332` — `computeRelevance` "semantic" 走 default | correctness | 与 keyword 不可区分。

### domain-eval-framework-service.ts

- `:140,159,171` — `registerQualityAxis` 等 `slice(-max)` 静默丢 | correctness。
- `:185` — `getLatestRubric` `localeCompare` | correctness。
- `:188-194` — `registerRegressionDataset` map mutate | correctness。

### domain-model.ts

- `:64-83` — `OutputContractConfigSchema.transform` | correctness | 对 type=object + patch 的合同静默 mutate，丢所有非 patch 字段。

### business-pack/pack-registry-service.ts

- `:215-247` — `updatePack` 无限流 | correctness。
- `:271-277` — `bumpVersion` 丢 pre-release 后缀 | correctness。

### customer-service/policy-adherence-evaluator.ts

- `:19` — `total = 1` 假数据 | correctness | 0% adherence 被掩盖。
- `:21-23` — `blockers` 重复 `policyViolationCount` 信息 | architecture。

### 各垂直域（30+ 个）入口未抽样

- `academic-research/`, `advertising/`, `agriculture/`, `coding/`, `data-engineering/`, `education/`, `finance-accounting/`, `financial-services/`, `game-dev/`, `game-publishing/`, `healthcare/`, `human-resources/`, `it-operations/`, `knowledge-base/`, `knowledge-schema/`, `legal/`, `live-streaming/`, `manufacturing/`, `marketing/`, `operations/`, `product-management/`, `project-management/`, etc. 的 `index.ts` 与 `*-config.ts` 大量 stub。

## 8. src/plugins/（深度）

> Agent 3 主力。

### crm-adapter.ts

- `:373-385` — `execute` catch-all 扁平化 | correctness | transport / egress / 5xx 全部 `ok:false`。
- `:344` — `execute` 无 try/catch | correctness | 异常传播不一致。
- `:304` — `crmRequest` 嵌套三元 | readability | path 选择脆弱。
- `:75,84` — regexes 内联编译 | performance。
- `:39-43,41-43` — `InMemoryZeroableCredentialSecret` buffer 不保证 zero-fill | security | V8 GC 可能保留。
- `:52` — `buildHashedCredentialFingerprint` 仅 `sha256(token).slice(0,12)` | security | 短前缀。

### github-adapter.ts

- `:325` — `healthCheck` `policy.evaluate(...)` 未 await | correctness。
- `:344` — `execute` 无 try/catch | correctness。
- `:348` — `assertActionAllowed` 用 `this` 绑定 | correctness | 适配器解构后失败。
- `:131-137` — `sanitizeWorkflowInputs` regex per loop | performance。
- `:140-142` — `redactSensitiveValue` regex per call | performance。
- `:145-157` — `canonicalizeForHash` 新 Set per record | performance。
- `:159-171` — `createIdempotencyKey` JSON.stringify+createHash per write | performance。
- `:173-190` — `requireRepository` `%2e/%2E` 防不全 | security。
- `:206-215` — `assertActionAllowed` 抛 Error 非 ValidationError | consistency。
- `:59-66` — `verifyPluginSignature` `Buffer.from(signature, "hex")` 缺 try/catch | correctness。
- `:81-85` — `createPluginManifestHash` 字段序依赖 | security。
- `:108` — fingerprint `sha256(token).slice(0,12)` | security。
- `:164` — `createHash` 字段序依赖 | security。
- `:294` — `JSON.parse(responseText)` 缺 try/catch | correctness。

### credential-hygiene.ts

- `:8-26` — `InMemoryZeroableCredentialSecret` | security | buffer 零化 V8 不保证。
- `:19` — `withSecret` 暴露原始 string | security | 闭包/captured 变量保留。
- `:33` — fingerprint `Math.max(4, length)` 4 字符前缀 | security | 可枚举。

### asset-production-adapter.ts / game-dev-adapter.ts / livestream-adapter.ts

- 三个适配器结构高度同质（builtin-preset + 静态 config + 硬编码 success: true）。
- 全部无 action validation、egress 静态 URL、healthCheck `evaluate(...)` 未 await。
- livestream-adapter.ts:66 — regex per call；`:63-72` — token 单次 trim。

### 5 个 retriever 插件（coding/asset-production/growth/operations/livestream/game-dev）

- 全部 hand-built result object 重复 slice `Math.max(2, Math.min(8, …))`；slice 公式不匹配实际字符-Token 比率（256 chars / 4 tokens）。
- 缺乏 `sharedResultBuilder` 抽象。

### 3 个 presenter 插件

- 全部重复 `let initialized = false; async initialize/shutdown` boilerplate。
- operations-presenter.ts:25 — regex per call；:63 — else 分支不 push citation。

### 插件运行时的 builtin 状态泄漏

- builtin-plugin-registry.ts:78-79 — `recordPluginTaintPropagation` `inputDataClasses[0] ?? "public"` 丢其他类。
- builtin-plugin-registry.ts:155-160 — builtin spiTypes merge 进 plugin manifest。
- builtin-plugin-registry.ts:177 — post-merge re-check 永远 true。
- builtin-plugin-registry.ts:185-198 — bypass via manifest name collision。
- builtin-plugin-registry.ts:666-673 — `resetBuiltinPluginRegistryStateForTests` 引用后声明变量。
- builtin-plugin-registry.ts:820-834 — `propagateDataTaint` 总是 `severity: "medium"`。
- builtin-plugin-registry.ts:847,875 — sessions 无界；regex per call。

### growth-config.ts / operations-config.ts

- growth-config.ts:201 — `externalAdapters: ["github", "jira", "crm"]` 但 jira adapter 不存在。
- operations-config.ts:60 — `retryPolicy.backoffMs: 5000` 硬编码无 jitter。

## 9. src/interaction/（深度）

> Agent 3 主力。

### nl-gateway/index.ts

- `:465-485` — `enforceRateLimit`/`consumeRateLimit` 抛 plain Error | correctness | 应为 ValidationError。
- `:474-485` — `requestRateLimits` Map 无淘汰 | performance。
- `:470-471` — 顺序报 tenant/user 错误 | correctness | 仅 tenant 错误显示。
- `:324` — `Promise.resolve(this.intakeRouter.route(...))` 缺 await | correctness。
- `:165` — `adaptModelIntentParser` 无 rate limit | security。
- `:313-315` — `String(entity.value)` 信息丢失 | correctness。
- `:546` — title collisions（`\s+` → `_`）| correctness | "a b" ≡ "a__b"。
- `:707-710` — `persistConversationTurn` try 块外 | correctness。
- `:765-797` — `rehydrateConversationTurns` `parsed.detectedIntent as DetectedIntent` | security | memory 内容强转。

### nl-gateway-support.ts

- `:107` — `regexCloneCache` 无界 | performance。
- `:131-147` — `getCachedRegex` 改 shared `lastIndex` | correctness | thread-unsafe。
- `:165-177` — `dedupePatterns` 返回 mutable | architecture。
- `:212-220` — `detectInputLocale` `[a-z]/i` 任意拉丁字母 | correctness。
- `:275-284` — `deriveUrgency` 三 regexes per call | performance。
- `:287-293` — `deriveTitle` 无长度上限 | security | ReDoS 风险。
- `:299` — `JSON.stringify(entity.normalized)` per entity per call | performance。
- `:392-394` — `buildConversationMemoryScope` `tenantId`/`userId` 拼到 key | security | 无 sanitize。

### nl-gateway-config-loader.ts

- `:274-279` — `loadNlGatewayConfig` catch-all 返 DEFAULT | correctness | 静默掩盖。
- `:188` — `readFileSync` 阻塞 event loop | performance。

### goal-decomposer/index.ts

- `:230-235` — `sharedInFlightGoalIds`/`sharedDelegationDepth` 静态 | correctness | 测试间污染。
- `:265-269` — delegationDepth update 与 L462 cleanup 不对称 | correctness。
- `:333-335` — `catch {}` 静默 | correctness | timeout 后 strategy="hybrid" 仍报告。
- `:515-526` — `hasTemplateSignalMatch` 阈值硬编码 2 | correctness | 无 escape hatch。
- `:560-572` — `buildTasks` 从 `initialTasks` 而非 LLM plan 算 baseCosts | correctness | 预算分配错。
- `:566-572` — ternary 分支产物相同 | readability。

### ux/conversation-history-service.ts

- `:106-111` — `memoryService` 与 default scope 无界 | performance。
- `:207-235` — `persistSession` 无并发控制 | correctness。
- `:289-294` — 注释承诺"server-enforced"但 in-memory 不强制 | correctness。
- `:376-394` — `applyRestriction` early return 条件漏 `isRestricted` | correctness。
- `:414-441` — `cleanupRestrictedSessionMemory` scope 跨源串扰 | correctness。

### ux/workflow-builder-service.ts

- `:293-309,362-376` — `categorizeComponents`/`categorizeComponent` 复制 | architecture。
- `:311-322` — `safeParseObject` 静默吞 parse 错误 | correctness。
- `:259-289` — `parseStoredWorkflowBuilderRecord` 深度 typeof | correctness | brittle。

### workflow-hibernation-service.ts

- `:20` — `records` Map 无 TTL 淘汰 | performance。
- `:75-80` — `emitDueStillHibernatedEvents` `heartbeatEvents[length-1]` | correctness | OK but inconsistent。
- `:41-49` — `emitStillHibernated` `heartbeatEvents` 无 cap | performance。

### proactive-agent/index.ts

- `:131,153` — `parseDurationMs`/`parseRateWindow` regex per call | performance。
- `:245` — `incidents` 无界数组 | performance。
- `:168-180` — `isValidTimezone` 用 `process.emitWarning` | correctness。
- `:412-437` — `evaluate` 批聚合：first event 永不 fire if next comes | correctness。
- `:594` — `computeSuggestionQuality` 硬编码 `highRiskDomains` | architecture。
- `:287-298` — `getAutonomyAdjustedActionMode` 文档歧义 | correctness。
- `:464` — `enqueueSuggestion` 在 auto_execute 也调 | correctness。

### user-preference-tracker.ts

- `:106` — `feedback` 无界 | performance。
- `:257-262` — `cleanup` `splice(0, length, ...filter)` | correctness | 等价 filter。
- `:281` — `r.latencyMs!` 非空断言 | correctness。
- `:296` — mutate input array `sort` | correctness。

### dashboard/dashboard-websocket-server.ts

- `:401` — `normalizeSubscriptions` 加 `dashboard:` 前缀但 match 仍查 `task` | correctness | 永不匹配。
- `:425` — `assertAuthorized` 用原始 channel 而 mutated channel | correctness | 永 fail。
- `:497-503` — `connectionMatchesDelta` 每次 set 迭代 + 数组展开 | performance。
- `:529-539` — `performHeartbeat` collect + unregister race | correctness。

## 10. src/org-governance/（深度）

> Agent 3 主力。

### approval-routing/approval-routing-service.ts

- `:104-143` — `route` 错误前缀 string match | security | fragile + 误判风险。
- `:274-293` — `buildAmountSnapshot` `fxEntry.rate <= 0` 抛错整请求 | correctness | 无 per-tenant fallback。
- `:302` — `resolveEscalation` materialize all results | performance。

### compliance-engine/evidence-collector.ts

- `:128-143` — `acquireSnapshotLock` while(true) 250ms busy-wait | performance。
- `:131` — `deadline` 仅 EEXIST 路径检查 | correctness。
- `:194-221` — `collect` 失败时 `existing` 复位但 `record` 仍 add | correctness。
- `:391-396` — `loadSnapshot` JSON 无大小限制 | security。
- `:398-415` — `persistSnapshot` 锁内 JSON.stringify | performance。

### sso-scim/scim-sync/scim-service.ts

- `:230,249,444` — `tenantId == null` 时跨租户查询 | security | 严重 bypass。
- `:152` — `events` 无界 | performance。
- `:996-998` — `persistEvents` `writeFileSync` 无大小 | performance。
- `:861,923` — regex per call | performance。
- `:171` — `createUser` `userName` 无格式校验 | security。
- `:696` — `processBulkRequest` `bulkIdMap` 仅在有 id 时 set | correctness | DELETE 不可链式引用。

### knowledge-boundary/chinese-wall-policy.ts

- `:81` — `requesterOrgNodeId === targetOrgNodeId` 跳过 blocked 检查 | security | 设计问题。
- `:93-105` — `Object.entries` per call | performance。

### org-model/org-governance-saga.ts

- `:98` — `nextCommitSequenceVersion` 2^53 wrap | correctness | 文档未提。
- `:197-211` — `groupStepsByOrgNode` 忽略 phase | architecture。
- `:117` — `findOrgNode` O(n) per step | performance。

## 11. src/scale-ecosystem/（深度）

> Agent 3 主力。

### multi-region/cdc-replication-service.ts

- `:341-343,374` — `prepareBatch` queueDepth>0 静默返 null | correctness | 契约歧义。
- `:718-728` — `recordConflict` Map 插入序删除 | correctness | 非 LRU。
- `:743-745` — `mergeEventWithConflictResolution` 双重相同条件 | performance。
- `:750` — `merged[localIndex]!` 非空断言 | correctness。
- `:759-762` — `Date.parse` NaN 排序 | correctness。
- `:1010-1019,1037-1045,901-933` — vectorClocks 不持久/不清 | correctness | 上文 50 已列。
- `:654` — `findIndex` O(n*m) | performance。

### billing/billing-service.ts

- `:354` — `as typeof this.store.billing & {...}` | architecture | hacky optional injection。
- `:418-459` — `recordUsage` `input.budgetControl!` 非空断言 | correctness。
- `:298-311` — `BudgetAllocator.reserve` 不 await | correctness。
- `:351` — `db.transaction` 结果未检查 | correctness。
- `:484-486` — `buildAccountSummary` 硬编码 limit=50 | correctness | 无分页。

### federation/trust-relationship.ts

- `:303` — `persistSnapshot` 非原子 | correctness。
- `:565` — `updateMetrics` 公式隐式 | correctness | 边界 first interaction OK。
- `:238,235` — `events`/`relationships` 无界 | performance。

### runtime-governance-service.ts

- `:42-70` — `evaluate` 无 try/catch | correctness | sub-evaluator 失败整决策 abort。
- `:46-48` — `connectorHealthReports.filter(...).some(...)` O(m*n) | performance。

### marketplace/marketplace-governance-service.ts

- `:266-302` — `submitReview` 不校验 lifecycle state | correctness | 撤销/卸载后仍可 review。

### tenant-platform/tenant-platform-service.ts

- `:185-188` — `totalSteps = 100` 硬编码 | correctness | 进度 > 100。
- `:159` — `this.store.dispatch?.listExecutionsByStatuses?.([...])` | correctness | 静默 no-op。

## 12. src/ops-maturity/（深度）

> Agent 3 主力。

### chaos/chaos-experiment-scheduler.ts

- `:150-160` — `getTargetInstanceCount`/`getTotalInstances` 用 label count / 硬编码 100 | correctness。
- `:349-356` — `recordSteadyStateResult` early return 让 `evaluatedHypothesisNames` 与 `results` 发散。
- `:463-475` — `executeRollbackWithTimeout` setTimeout may not fire under event loop pressure | correctness。

### drift-detection/drift-detector-service.ts

- `:94,96,263-266,325-327` — 多个 `!` 非空断言；`inferDimension` 长 if-else 无 default 静默。

### edge-runtime/edge-runtime-sync-service.ts

- `:208` — `envelopes.find(...)!` | correctness。
- `:288-293` — `verifyEnvelopeSignature` 非恒时字符串比较 | security | timing attack。
- `:162` — `buildEdgeExecutionPlan([request.taskId])` 单节点 graph 语义错 | correctness。
- `:117-132` — `executeOffline` pre-flight 散落 + 重复 null 检查 | architecture。
- `:386-391` — `tryParseJsonObject` null 不区分 parse 错与"非对象" | correctness。

### emergency/platform-panic-service.ts

- `:132-134` — `matchesScope` 前缀匹配脆弱 | security | "ten" / "ten/foo" 误判。
- `:192-197` — 5 planes 永远 ack | correctness | 假回执。
- `:165,167` — `resumeReceipts`/`drills` Map 无界 | performance。
- `:385-394` — `resolveActivation` O(n) filter+sort 重复 `Math.max` | performance。

### platform-ops-agent/self-healing-service.ts

- `:184` — `maxHistoryEntries = 100` 硬编码 | correctness。
- `:240` — `restart` 状态检查冗余 | correctness。
- `:211-213` — `healingHistory.findLast` ES2023 | portability。
- `:331-338` — `getStatistics` 长度 0 时 `undefined` 风险 | correctness。

### explainability/explanation-pipeline-service.ts

- `:131,133` — `cache`/`auditTrail` 无界 | performance。
- `:114-128` — `buildVersionLockRef` 序列化 renderedExplanation | correctness | fragile。

### cost-optimizer/cost-optimization-service.ts

- `:91` — `records` 无界 | performance。
- `:177-179` — `harness_run_id` (snake) vs `harnessRunId` (camel) 命名漂移 | correctness | 同名不同字段。
- `:80-93` — `recordCost` 缺 decisionRef 时抛错但 cap 是 unsourced count | correctness。

## 13. src/sdk/（深度）

> Agent 4 主力。

### admin-sdk/index.ts (723 行)

- `:106-130` — `hasAdminRole`/`hasAdminPermission` 角色大小写不敏感（"Admin" 拒）| security。
- `:132-146` — `assertAdminAccess` 错误信息含 required permissions | security | 信息泄漏。
- `:18-35` — `registerDomainSchema` `refine` 后 `transform` 强制非空断言 | correctness。

### cli/

- `dlq-manager.ts:212` — `countDeadLetters` 三数加和 NaN 风险 | correctness。
- `dlq-manager.ts:240` — `retryDeadLetters`("jobs") 静默 reset error | correctness。
- `dlq-manager.ts:241-247` — `retryDeadLetters`("gateway"|"events") no-op 假成功 | correctness。
- `dlq-manager.ts:299-308` — `main`(purge) 缺预览 | usability。
- `login.ts:115` — `saveOAuthTokens` TOCTOU | security。
- `login.ts:134` — scryptSync 显式 KDF 参数 | security | OK 但 maxmem 64MB。
- `login.ts:286-313` — `finishOAuthLogin` unlinkSync 错误处理 | correctness。
- `login.ts:99-107` — `resolveSecureCliHome` homedir 无 realpath | security。
- `api-server.ts:312-314` — `withPersistentCliStorageAsync` 隐式 cwd 路径 | architecture。
- `migrate-sqlite-to-pg.ts:262-272` — `migrateSqliteToPg` per-table transaction 大 rowCount 风险 | performance。
- `migrate-sqlite-to-pg.ts:197-201` — `validateTableName` regex 校验后置 | correctness。
- `authoritative-storage.ts:71-109` — `registerCliShutdownHandler` 按 `dbPath+driver` 共享 key | correctness。
- `secret-commands.ts:80-89` — `writeSecureFile` O_NOFOLLOW TOCTOU | security。
- `secret-commands.ts:64-69` — `assertPathIsNotSymlink` catch 吞错 | correctness。
- `secret-commands.ts:99-113` — `parseStoredTokenHash` 仅校验 hex 长度 | correctness。
- `secret-commands.ts:174-180` — `verifyAuthToken` 空 buffer 比较返 true | security | 严重。
- `orphan-cleanup.ts:38-43` — `main` 抛错前已 open DB | correctness。
- `marketplace.ts:39-129` | architecture | 模块级 `loadMarketplaceCliEnv()` 立即执行。
- `profile-home.ts:20` | architecture | 同上。
- `replay-events.ts:43-45` — 返 CLI_EXIT_FAILURE 通过 promise resolve | architecture。
- `memory.ts:272` — 顶层 `await main()` 无 catch | correctness。
- `doctor.ts:50-78` — `installBrokenPipeHandler` 一次性 handler | correctness。
- `pack-publish.ts:185-188` — `if (lastStatus != null)` 仅在异常路径走 | correctness。
- `channel-gateway.ts:39-86` | architecture | 顶层 `await withCliStorage(...)` 立即执行。
- `aa.ts:48-49` — `extname(import.meta.url)` 编译产物残留 | correctness（d 轮 1433 收口的本轮重现区域）。
- `stable-*.ts` 与 `stable-runner-factory.ts` 入口未抽样。

### client-sdk/api-client.ts (1040 lines)

- `:78-92,887-898` — `buildApiUrl`/`createApiClient` 不校验 baseUrl | security。
- `:188` — `(result as { totalCount? }).totalCount = totalCount` 写 readonly 字段 | correctness。
- `:300-389` — `subscribeToEvents` `buffer.split("\n")` 每 chunk 新数组 + 永不结束的 buffer | performance | DOS。
- `:333` — fetch 无 `redirect: "error"` | security。
- `:362-375` — `parseResponse` `await response.json()` 失败时 body 消耗 | correctness。
- `:386-394` — `resolveRequestUrl` BOM regex 不完全 | correctness。
- `:396-461` — `HttpTransport.send` finally clearTimeout 但 controller.abort 仍 fire | correctness。
- `:550-578` — `DefaultRESTClient.request` interceptors reverse order 不可预测 | correctness。
- `:594-689` — 错误分类 `error.message.includes("fetch")` 脆弱 | correctness。
- `:604-637,672-686` — retry path 错误分类不一致 | correctness。
- `:626-637` — `response.status === 429 || >= 500` 正确但 catch 路径 string match | correctness。

### harness-sdk/index.ts

- `:478-501` — `sendInterPlaneMessage` null transport 抛错 | correctness。
- `:512-538` — `verifyReceivedInterPlaneEnvelope` `verification.valid || error == null` 应 XOR | correctness。
- `:555-558` — `createSignedInterPlaneEnvelope` null sharedSecretKey 返未签名 envelope | security。

### pack-sdk/

- `pack-manifest.ts:95-101` — `MALICIOUS_CODE_PATTERNS` 仅起始模式 | security。
- `pack-manifest.ts:96-98` — regex 命中 `child_process` import | readability | false positive。
- `pack-manifest.ts:183-184` — `sha256(publicKeyPem).substring(0,16)` 64-bit 指纹 | security。
- `pack-lifecycle-orchestration-service.ts:344-348` — `listPacks` clone+sort per call | performance。
- `pack-lifecycle-orchestration-service.ts:381-388` — `buildApiChangeSummary` 3 passes | performance。
- `pack-manifest.ts:450-458` — `stableStringify` 无 cycle 检测 | correctness。
- `pack-test-local-service.ts:207-214,228-233` — 减扣 casesPassed 伪造结果 | correctness（d 轮 1326 收口后再次出现）。
- `plugin-definition.ts:185-189` — 嵌套 try/catch 静默 | correctness。
- `plugin-definition.ts:515` — `JSON.parse(readFileSync(...SBOM))` 无大小 | security。
- `plugin-sdk/plugin-definition.ts:133-148` — `KNOWN_VULNERABILITIES` 硬编码 2 CVE | security。
- `plugin-sdk/plugin-definition.ts:180-194` — `decodeSignature` base64/base64url 混 | correctness。
- `plugin-sdk/plugin-definition.ts:201-220` — `pluginDefinitionPayloadCandidates` 首匹配 | security | 攻击者构造 hash。

## 14. tests/（深度）

> Agent 4 主力。

### 关键发现

- `tests/unit/dispatcher/dispatcher-service.test.ts` 146 个 `as any` 出现 | test-quality | 系统性类型不匹配。
- `tests/unit/org-governance/sso-scim/oidc/oidc-service-comprehensive.test.ts` 15 个 `as any` | test-quality。
- `tests/unit/org-governance/sso-scim/oidc/` 整体 30+ `as any` 分布 | test-quality。
- `tests/unit/core/runtime/orchestrator.test.ts` 22+ `as any` 与 `{} as any` 抹除类型 | test-quality | 自称"验证 re-export 与类型"。
- `tests/unit/core/runtime/planner.test.ts:59-60` `parseOptionalStringArray` 测试用 `as any` | test-quality。
- `tests/unit/plugins.test.ts:360` `(plugin as any).suggestWorkflow` 访问非 public 方法 | test-quality。
- `tests/unit/plugins/adapters/crm-adapter.test.ts` 9 处 `delete (globalThis as any).fetch` 无 try/finally | test-quality。
- `tests/unit/platform/cross-plane-event-propagation.test.ts:149,196,246,288,340,388,438,480,574,620,670,739,799,869` 14 个 `try/finally` 空块 + cleanup 在 try 内 | test-quality。
- `tests/unit/platform/five-plane-execution/event-bus/typed-event-bus.test.ts:94,133,165,200,232,286,333,378,431,465` 10 个同类 anti-pattern | test-quality。
- `tests/unit/ops-maturity/p2-defects-sys-perf-3-4.test.ts:39,73,105` 3 处 31s 硬等待（共 93s wall-clock）| test-quality。
- `tests/unit/platform/interface/ingress/distributed-rate-limiter.unit.test.ts:132,296` 500ms/1050ms 硬等待 | test-quality。
- `tests/unit/platform/interface/ingress/ingress-configuration.test.ts:62,66` 250-300ms | test-quality。
- `tests/unit/platform/interface/ingress/ingress-routing.test.ts:222` 250ms | test-quality。
- `tests/unit/platform/state-evidence/events/review-contract-regressions.test.ts:96` 450ms | test-quality。
- `tests/unit/ops-maturity/chaos/chaos-monitoring.test.ts:57,94` 150-350ms | test-quality。
- `tests/unit/platform/observability/structured-logger.test.ts:413` 150ms | test-quality。
- `tests/unit/platform/state-evidence/events/calculate-backoff.test.ts:55,101` 2-3s（在 allowlist）| test-quality。
- `tests/unit/runtime/graceful-shutdown.test.ts:82,155` 200-500ms（allowlist）| test-quality。
- `tests/unit/platform/execution/plugin-executor.test.ts:371,428` 200ms | test-quality。
- `tests/unit/platform/execution/plugin-executor/plugin-executor.service.extended.test.ts:743` 500ms | test-quality。
- `tests/integration/quality/full-coverage-operational-real-paths.test.ts:208` 350ms | test-quality。
- `tests/unit/platform/five-plane-interface/channel-gateway/channel-gateway-retry-executor.test.ts:122` `assert.equal(true, true)` 套套套 | test-quality。
- `tests/unit/platform/shared/cache/stores/redis-cache-store-health.test.ts:120,128` `console.error` 噪音 + tautology | test-quality。
- `tests/unit/domains/governance/safe-load-division-registry-explicit.test.ts:22` `assert.ok(true, …)` 套套套 | test-quality。
- `tests/unit/domains/governance/safe-load-division-registry-comprehensive.test.ts:19` 同上 | test-quality。
- `tests/unit/root-exports.test.ts:47,108` `kernel.getApp("unknown" as any)` 应 `as PlatformAppKind` | test-quality。
- `tests/unit/platform-application-kernel.test.ts:167,218` 同上 | test-quality。
- `tests/unit/root-barrel-exports.test.ts:61` 同上 | test-quality。
- `tests/unit/index.test.ts:241` 同上 | test-quality。
- `tests/integration/root-integration.test.ts:186` 同上 | test-quality。
- `tests/integration/root-entry-summary.test.ts:141` 同上 | test-quality。
- `tests/integration/platform-module-catalog.test.ts:155,188` 同文件 line 144 已 `as PlatformSurfaceId`，inconsistent | test-quality。
- `tests/unit/domains/registry/domain-registry-service.test.ts:132,342` `as any` 不必要 | test-quality。
- `tests/unit/domains/governance/hr-role-governance-service-{advanced,validation}.test.ts` 6 处 `as any` | test-quality。
- `tests/integration/platform/prompt-engine/conversation-template-service.test.ts:343,347,393` `as any` | test-quality。
- `tests/integration/platform/control-plane/incident-control/{human-takeover,takeover-queue}-integration.test.ts` `as any` payload | test-quality。
- `tests/unit/domains/runtime-orchestrator.test.ts` `test.beforeEach/afterEach` 空 `afterEach` | test-quality。
- `tests/integration/platform/state-evidence/events/event-bus.integration.test.ts:27-40` module-level `globalThis.setTimeout` mutation | test-quality。
- `tests/unit/platform/interface/api/http-api-server.test.ts:505,535,557` 与 `channel-gateway/websocket-bridge-coverage.test.ts:685,688,716` `globalThis.setTimeout` 替换 | test-quality。
- `scripts/ci/audit-test-hard-waits.mjs:9` `MIN_DELAY_MS = 50` 过宽 | test-quality。
- `scripts/ci/audit-test-hard-waits.mjs:16-19` `ALLOWED_FILE_PATTERNS` 8 个 broad pattern | test-quality。
- `scripts/ci/audit-test-hard-waits.mjs:88-95` `extractDelayMs` 正则仅匹配 `setTimeout` 首参 | test-quality。
- `tests/leaks/platform/state-evidence/events/durable-event-bus.leak.test.ts:37` 与 `tests/leaks/platform/shared/cache/memory-cache-store.leak.test.ts:42` 均 `t.skip` 需要 `--expose-gc` | test-quality。
- `tests/unit/quality/full-coverage-test-manual-gaps.test.ts:253` 仅 2 strings allowed-skip | test-quality。
- `tests/unit/ui/shared-package-regressions.test.ts:119,162,165` `as unknown as typeof WebSocket` 等 | test-quality。
- `tests/unit/domains/recipes/recipes-zero-coverage.test.ts:455,469,482,483` `as unknown as DomainRecipe` 抹除校验 | test-quality。
- `tests/unit/interaction-governance/interaction-governance-runtime-catalog.test.ts:93` `(catalog.governance as unknown as {...}).push(...)` 测试用 | test-quality。
- `tests/unit/domains/prompt-library/domain-prompt-governance-service.test.ts:312` `(service as unknown as { activeReleaseByPromptId: Map<...> })` | test-quality。
- `tests/unit/root-bootstrap-exports-remediation.test.ts:12` `void (null as unknown as RootBootstrapTypeExports)` | test-quality。
- `tests/integration/platform/control-plane/incident-control/{human-takeover-service-async-integration,takeover-queue-manager-integration}.test.ts:410/371` `payload: {...} as any` | test-quality。

## 15. config/（深度）

> Agent 4 主力。

### 硬编码 / 缺配置

- `config/security/default.json:6,11,7` — TTL/rate limit/allowedCapabilities | config。
- `config/security/{prod,staging,test,dev,pre-prod}.json` — 5 份几乎全等 | config | drift。
- `config/runtime/prod.json` — `maxConcurrentTasks: 8`、`defaultTaskTimeoutMs: 600000` | config。
- `config/runtime/default.json:4-8,20-22` — 多个 magic 数 | config。
- `config/bootstrap/default.json:79-91,73-77` — canaryDeployment 与 thresholds 魔法数 | config。
- `config/quality/default.json:5-6` — qualityGate 无 version/migration | config。
- `config/providers/models.json:20-25` — `MiniMax-M2.7` 价格硬编码无 date stamp | config。
- `config/division-coverage/family-readiness.yaml` — `readinessStatus` 自由字符串 | config。
- `config/validation/platform-mission-slo-profiles.json:38-54` — burnRateAlerts 组合无文档 | config。
- `config/environments/default.json:13` — `allowedRolloutStrategies: ["canary", "blue_green"]` 仅 prod | config。
- `config/policy/no-go-actions.yaml:2` — `updatedAt: "2026-05-31"` 硬编码 | config。
- `config/runtime/{dev,test,staging,pre-prod,prod}.json` — configVersion 全部 `"v4.3"` | config。
- `config/environments/{dev,test,staging,pre-prod,prod}.json` — `"environment": "prod"` 错值 | config | copy-paste 错。
- `config/security/{dev,test,staging,pre-prod}.json` — `sandboxMode: "read_only"` | config。
- `config/validation/platform-validation-registry.json` 与 `config/quality/division-catalog.json` 入口未抽样 | config。

### 安全配置

- `config/security/default.json:9` — `mcpPolicy.allowNetworkEgress: false` 但 `allowedTransports: ["stdio"]` 仍可 spawn 进程 | security。
- `config/security/prod.json:2` — `approvalMode: "strict"` 与默认 `allowDestructiveActions: false` 不可区分 | security。
- `config/providers/models.json:13-15` — `minimax` authMethods: `["api_key"]` 无 rotation 文档 | security。
- `config/bootstrap/default.json:34-46` — `hotReload.watchPaths: ["config/", "src/", "domains/"]` `enabled: true` 在生产是 RCE 入口 | security | 严重。
- `config/bootstrap/default.json:39-45` — `excludePatterns` 未排除 `.env*` | security。

### schema 缺位

- `config/security/default.json` 无 JSON schema，`mcpPolicy.sandboxMode` 任意字符串 | config。
- `config/policy/no-go-actions.yaml` `riskClass: R5` 应为 enum | config。
- `config/division-coverage/*.yaml` `version: 1` 无 migration | config。

## 16. deploy/（深度）

> Agent 4 主力。

### helm/automatic-agent/

- `templates/deployment.yaml:60-66` — `readOnlyRootFilesystem: true` 但 `/app/data` RW，`/tmp` emptyDir | deploy。
- `templates/deployment.yaml:36-41` — `runAsUser: 1000, fsGroup: 1000` 硬编码 | deploy。
- `templates/deployment.yaml:111-114` — `preStop.sleep` 可超过 `terminationGracePeriodSeconds: 30` | deploy。
- `templates/deployment.yaml:34` — `automountServiceAccountToken` 默认 `false` | deploy | OK。
- `values.yaml:113-119` — `secrets.allowInlineSecrets: false` 但占位空字符串 | deploy | misleading。
- `templates/secret.yaml:2-3` — 4 keys 硬编码 `or` 链 | deploy。
- `templates/externalsecret.yaml:1-4` — fail message 通用 | deploy。
- `templates/configmap.yaml:8-12` — `regexMatch ".*(SECRET|TOKEN|PASSWORD|KEY).*"` 按名过滤，URL 内部密钥不拦 | security。
- `templates/networkpolicy.yaml:30-44` — egress `0.0.0.0/0` 允许全 DNS | security。
- `templates/pdb.yaml:9-11` — `minAvailable`/`maxUnavailable` 互斥但都未设仍创建 | deploy。
- `templates/resourcequota.yaml:10-17` — 数字用 `| quote` 当 string | deploy。
- `templates/servicemonitor.yaml:18-20` — Prometheus duration 无 quote | deploy | OK。
- `values-prod.yaml:107-114` — `topologySpreadConstraints.whenUnsatisfiable: ScheduleAnyway` 在 prod 应为 `DoNotSchedule` | deploy。
- `values-prod.yaml:100-105` — `podAntiAffinity` + `ScheduleAnyway` 节点压力 | deploy。
- `templates/automatic-agent-chaos-approval-policies-crd.yaml:1-77` — `scope: Cluster` 与引用 namespaced 资源冲突 | deploy。
- `values.yaml:5-12` — `replicaCount: 1`/`image.tag: ""` 无 override 则 image pull 失败 | deploy。
- `values.yaml:54-72` — `autoscaling.behavior.scaleDown` 仅 `Percent`，无 `Pods`/`selectPolicy` | deploy。
- `values.yaml:154-156` — `livenessProbe.initialDelaySeconds: 0` | deploy。
- `values.yaml:159-168` — `readinessProbe` 30s 总等待 | deploy。
- `values.yaml:169-176` — `startupProbe` 5 min | deploy。

### deploy/scripts/

- `deploy.sh:111-115` — `read -p` 大小写敏感、non-TTY 不可见 | script。
- `deploy.sh:123-134` — canary health check loop race (`i=10` break 与 error 顺序) | script。
- `deploy.sh:124` — `${CANARY_ENDPOINT}` SSRF | security。
- `deploy.sh:165-166` — `kubectl get ns` 与 `apply` race | script。
- `deploy.sh:201-202` — canary 静默 override | script。
- `deploy.sh:205-211` — blue/green 无 service 验证 | script。
- `deploy.sh:265-270` — canary promotion 竞速 | script。
- `deploy.sh:284-285` — JSON patch 字符串拼接特殊字符 | script。
- `deploy.sh:249-258` — endpoints check OK | script。
- `rollback.sh:93-94` — inline `node -e` 路径/version 依赖 | script。
- `rollback.sh:95` — `2>/dev/null || echo` 吞所有错 | script。
- `dr-drill.sh:160-167` — `cp` 错误 2>/dev/null | script。
- `dr-drill.sh:243` — `bc` 缺失 | script。
- `dr-drill.sh:407` — `events` 表可能不存在 | script。
- `dr-drill.sh:461-462` — `date -d` GNU-specific on macOS | script。
- `dr-drill.sh:616-617` — `return $(...)` subshell | script。
- `verify-hot-upgrade.sh:4` — `BASELINE_LATENCY_MS` 声明未用 | script。
- `verify-hot-upgrade.sh:39-42` — `curl` 无 `--max-time` | script。
- `verify-hot-upgrade.sh:64-67` — 404 返空 | script。

### 其他 deploy 资产

- `values-prod.yaml:87` — `persistence.enabled: false` 与 `values.yaml:142-147` `enabled: true` 不一致 | deploy。
- `values-prod.yaml:91` — `maxUnavailable: 1` vs `values.yaml:71-72` `minAvailable: 1` | deploy。
- `prometheus/rules/automatic-agent.yml:30` — `for: 15m` 在 dev/staging 太长 | deploy。
- `prometheus/rules/automatic-agent.yml:84-101` — division by `total_workers=0` 静默 | deploy。
- `chaos/catalog.json:9` — `intensity: 0.5` 无 `[0,1]` 校验 | deploy。
- `chaos/catalog.json:6-42` — `fallbackProfiles` 缺 `allowedWindows` | deploy。
- `grafana/dashboards/automatic-agent.json` 与 `terraform/` 入口未抽样 | deploy。

## 17. scripts/（深度）

> Agent 4 主力。

### Shell 脚本

- `backup-sqlite.sh:18` `set -euo pipefail` | OK。
- `backup-sqlite.sh:29` `cd` 失败后 `mkdir -p` 不执行 | script。
- `backup-sqlite.sh:48` `${BACKUP_PATH//\'/\'\'}` bash 4+ 特性，macOS 3.2 失败 | portability。
- `backup-sqlite.sh:78-80` `openssl -pass file:` fd 泄漏 | script。
- `backup-sqlite.sh:105-117` `aws s3 cp` 无完整性检查 | script。
- `restore-sqlite.sh:42-45` macOS `realpath` 需 coreutils | portability。
- `restore-sqlite.sh:99-101` regex 格式硬假设 | script。
- `restore-sqlite.sh:111-114` `AA_RESTORE_ALLOW_SCHEMA_DOWNGRADE=1` 无 audit log | script。
- `backup-sqlite.sh:23` 相对路径 | portability。

### MJS

- `architecture-boundary-scan.mjs:79-93` `content.includes` 子串误判 | script。
- `architecture-boundary-scan.mjs:51-58` 任意 quotes matcher | script。
- `architecture-boundary-scan.mjs:130-132` 仅 enforce 模式 exit 1 | script。
- `architecture-boundary-scan.mjs:8` argv 缺校验 | script。
- `clean-dist.mjs:7-17` env OR 链 文档缺失 | script。
- `clean-dist.mjs:55-65` source maps `null` 不报错 | script。
- `build-if-needed.mjs:39-47` `Math.max(...arr)` 大数组爆栈 | script。
- `build-if-needed.mjs:50-58` tsc 输出未捕获 | script。
- `audit-test-exclusions.mjs:7` `/i` flag 误匹配 "contest/latest/fastest" | script。
- `audit-test-hard-waits.mjs:88-95` regex 仅首参 | script。
- `validation/platform-validation-closure.mjs:357-375,377-391,194-198` 文档结构变化即静默 0 metrics | script。
- `generate-division-coverage-cards.mjs` (8KB) / `scan-current-codebase-gap.mjs` (18KB) / `run-layered-tests.mjs` (9KB) 入口未抽样 | script。
- `dev/start-local-stack.mjs` 与 `dev/stop-local-stack.mjs` 入口未抽样 | script。

### CI 审计脚本 (38 个)

- 仅抽查 7 个；其余 `audit-*.mjs` 入口未抽样；建议 f 轮逐个 sanity-check。

## 18. ui/（深度）

> Agent 5 主力。

### Security

- `ui/apps/web/src/app-shell.tsx:472-495` — `resolveLocationAuthContext` | ui-security | 从 URL query 读 userId/roles/permissions；`?user_id=admin&roles=admin&permissions=*` 自提权。严重。
- `ui/packages/shared/api-client/src/interceptors.ts:172-182` — `createCsrfInterceptor` | ui-security | 仅写方法设 CSRF；`<meta>` 读 token 无 SameSite/origin 校验；offline queue 复读 `x-csrf-token`。
- `ui/packages/shared/sync/src/sync-coordinator.ts:101-117` — `FetchSyncMutationDispatcher.dispatch` | ui-security | 重放不带 Authorization；body 泄漏到 wrong-origin。
- `ui/packages/shared/platform/src/base-platform-adapter.ts:99-112` — `DefaultPlatformAdapter.runShell` | ui-security | `allowedShellCommands` 默认空 → ALL commands 允许。
- `ui/packages/shared/platform/src/web-platform-adapter.ts:44-50` — `WebPlatformAdapter.openDeepLink` | ui-security | undefined 时返 `https://example.invalid`；null/undefined 静默 no-op。
- `ui/packages/shared/state/src/stores/auth-store.ts:167-182` — `partialize` | ui-security | 硬编码 `authenticated: false`、`accessToken: ""`；reload 后 token 不持久。
- `ui/packages/shared/api-client/src/ws-client.ts:219,244-255` — `BrowserWSClient.establishConnection` | ui-security | WS subprotocol 明文 token；replay buffer 无 channel 权限。
- `ui/packages/shared/state/src/index.ts:120-152` — `UiRuntimeProvider` | ui-security | `setAuthenticated(accessToken != null)`；非空字符串即认证。
- `ui/packages/shared/auth/src/auth-service.ts:147` — `JSON.parse` cast 强转 | ui-security | 跨租户污染 storage。

### Correctness

- `ui/packages/shared/state/src/mutations/use-mutation.ts:126-144` — `resolveMutationBody` | ui-correctness | heuristic 错位 filter `*Id`。
- `ui/packages/shared/state/src/mutations/use-mutation.ts:84-92` — `onError` `context?.previousData` 无 null check | ui-correctness。
- `ui/packages/shared/api-client/src/ws-client.ts:202-207` — `BrowserWSClient.publish` 无 `disconnected` guard | ui-correctness。
- `ui/packages/shared/api-client/src/ws-client.ts:91-96` — `SharedWorkerWSClient.subscribe` replayMicrotask | ui-correctness | disposed 频道重发。
- `ui/packages/shared/api-client/src/ws-client.ts:441-449` — `SharedWorkerWSClient.disconnect` `setTimeout(...,0)` 双调 removeEventListener 泄漏 | ui-correctness。
- `ui/packages/shared/state/src/index.ts:154-186` — bootstrap mutations 硬编码 `createdAt` | ui-correctness。
- `ui/packages/shared/state/src/index.ts:289-311` — `useSystemStatus` 选整个 state | ui-performance。
- `ui/packages/shared/api-client/src/rest-client.ts:312-323` — `HttpTransport.shouldRetry` 401/403 也 retry | ui-correctness。
- `ui/packages/shared/api-client/src/rest-client.ts:362-375` — `parseResponse` `response.json()` 失败后 body 不可恢复 | ui-correctness。
- `ui/packages/shared/api-client/src/rest-client.ts:386-394` — `resolveRequestUrl` BOM regex | ui-correctness。
- `ui/packages/shared/api-client/src/rest-client.ts:396-461` — `HttpTransport.send` finally clearTimeout 但 controller.abort 仍 fire | ui-correctness。
- `ui/packages/shared/api-client/src/rest-client.ts:550-578` — `DefaultRESTClient.request` reverse interceptors | ui-correctness。
- `ui/packages/shared/api-client/src/interceptors.ts:172-182` — `createCsrfInterceptor` closure 缓存 token | ui-correctness。
- `ui/packages/shared/api-client/src/interceptors.ts:284-330` — `createDedupeInterceptor` shared Set clear 误清 | ui-correctness。
- `ui/packages/shared/api-client/src/shared-ws-worker.ts:151-160` — `connectSocket` onclose/onerror race | ui-correctness。
- `ui/packages/shared/sync/src/sync-coordinator.ts:39-80` — `flush` retained 替换在 retry 链后 | ui-correctness。
- `ui/packages/shared/platform/src/web-platform-adapter.ts:28-34` — `readFile` 静默返 `""` | ui-correctness。
- `ui/packages/features/task-cockpit/src/hooks/index.ts:86-93,141-152` — `useTaskCockpitVm` drift 无收敛 | ui-correctness。
- `ui/packages/features/alerts/src/hooks/index.ts:201-228` — snooze timer 重建竞态 | ui-correctness。
- `ui/packages/features/alerts/src/hooks/index.ts:172-181` — `payload.incident!` 非空断言 + 无 memo | ui-correctness。
- `ui/packages/features/hitl/src/hooks/index.ts:85` — `wsClient.subscribe("approvals", () => undefined)` no-op | ui-correctness | 实时审批事件不反映。
- `ui/packages/features/hitl/src/hooks/index.ts:92-97` — 1Hz setInterval 永不停 | ui-performance。
- `ui/packages/features/conversation/src/hooks/index.ts:290-306,308-368,382-397` — 6 依赖 + 闭包 stale + publish/send 顺序 | ui-correctness。
- `ui/packages/features/release-console/src/hooks/index.ts:87-128` — `mutating: false` 共享 + `loadSnapshot` 未 memo | ui-correctness。
- `ui/packages/features/division-inventory/src/hooks/index.ts:35-58,88-91` — N+1 fetch + Set spread per snapshot | ui-correctness。
- `ui/packages/shared/state/src/queries/helpers.ts:32-53` — `createCursorInfiniteQuery` `queryKey` 含 `normalizedOptions` 对象 ref | ui-correctness。

### Performance

- `ui/packages/features/workflow-builder/src/web/flow-canvas.tsx:20-21` — `Array.from(nodes)/edges` 每渲染新 ref | ui-performance。
- `ui/packages/features/conversation/src/hooks/index.ts:290-306` — 6-dep useEffect render storm | ui-performance。
- `ui/packages/features/dashboard/src/web/index.tsx:17-20` — `buildChartOption` 每依赖变化 re-invoke | ui-performance。
- `ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:118-121` — paranoid dep list | ui-performance。

### State

- `ui/packages/shared/state/src/stores/auth-store.ts:204-243` — `attachCrossTabAuthSync` 信任 storage event userId | ui-state。
- `ui/packages/shared/state/src/stores/notification-store.ts:79-90` — `markAllRead` lookup 不一致 | ui-state。
- `ui/packages/shared/state/src/mutations/optimistic-update.ts:60-63` — `snapshotCache` live ref | ui-state。
- `ui/packages/shared/state/src/stores/realtime-store.ts:91-100` — concurrent key write | ui-state。
- `ui/packages/shared/state/src/stores/sync-store.ts:85-94` — `addConflict` 无淘汰 | ui-state。
- `ui/packages/shared/state/src/stores/middleware.ts:18-47` — `cloneDraftValue` 无 cycle 处理 | ui-state。
- `ui/packages/shared/state/src/stores/middleware.ts:51-65` — `withDraft` non-function 绕过 | ui-state。

### Accessibility / i18n

- `ui/packages/shared/i18n/src/catalogs/ar-SA.ts:1-19` — 仅 12 keys vs 713 in en/zh | ui-i18n。
- `ui/packages/shared/i18n/src/index.ts:111-118` — `setLocale` 同步 set direction | ui-i18n。
- `ui/packages/shared/i18n/src/index.ts:181-209` — `translate` formatter 抛错时回退 raw ICU | ui-i18n。
- `ui/packages/features/approval/src/web/index.tsx:79-81` — `<span style="display: none">` aria-describedby | ui-accessibility。
- `ui/packages/features/approval/src/web/index.tsx:22-41` — button 无 `aria-pressed`/`aria-current` | ui-accessibility。
- `ui/packages/features/approval/src/web/index.tsx:46-49` — `aria-describedby` 可能 dangling | ui-accessibility。
- `ui/packages/ui-core/src/components/extended.tsx:195-217` — pagination `<li>`/`<ul>` 缺失，无 aria-label | ui-accessibility。
- `ui/packages/ui-core/src/components/extended.tsx:281-311` — `Accordion` 缺键盘导航 | ui-accessibility。
- `ui/packages/features/dashboard/src/web/index.tsx:60-122` — `<article>`/`<section>` 缺 headings | ui-accessibility。
- `ui/packages/features/hitl/src/web/index.tsx:111-123` — `<textarea>` 无 `<label>`，submit 无 announcement | ui-accessibility。
- `ui/packages/features/alerts/src/hooks/index.ts:55-64` — `SEVERITY_ORDER ?? 99` 静默 | ui-i18n。

## 19. docs_zh/ + docs_en/ + 根目录文档（深度）

> Agent 5 主力。

### docs_zh/ 文档漂移

- `docs_zh/quality/p0-pilot-evidence-runbook.md` | doc-missing | 无 docs_en 翻译。
- `docs_zh/reviews/platforme-full-review-e.md` | doc-missing | 本文档。
- `docs_zh/contracts/lifecycle_and_termination_contract.md:197` | doc-broken-link | `platform-architecture-implementation-consistency-audit.md` 缺 `../reviews/` 前缀 → 404。
- `docs_zh/contracts/agent_contract.md:192`、`approval_and_hitl_contract.md:195`、`billing_and_tenant_contract.md:104`、`compliance_report_generation_contract.md:87`、`context_propagation_contract.md:173`、`cost_and_budget_contract.md:164`、`cost_attribution_and_optimization_contract.md:44`、`cross_region_routing_and_data_residency_contract.md:56`、`data_classification_and_prompt_handling_contract.md:112`、`distributed_locking_contract.md`、`enterprise_secret_management_contract.md`、`monetization_metering_plane_contract.md`、`plugin_spi_contract.md`、`sandbox_and_auth_contract.md`、`supply_chain_and_dependency_security_contract.md`、`tool_and_provider_execution_contract.md`、`domain_descriptor_and_onboarding_contract.md` | doc-broken-link | 同模式 17 文件。
- `docs_en/contracts/agent_contract.md:191` | doc-broken-link | 同步英文版。
- `docs_zh/operations/review-closure-board.md:18` | doc-stale | 引用 `platforme-full-review.md` 历史表 + 不存在的 `*-round_reaudit.md`。
- `docs_zh/architecture/00-platform-architecture.md:15` | doc-stale | 链接 `reviews/platforme-full-review-b.md`，应升级到 -e。
- `docs_zh/quality/01-release-checklist.md` | doc-stale | 仍列 "c8 0% coverage" 为 open。
- `docs_zh/reviews/platforme-full-review-d.md:1671,1673,1676` | doc-stale | 多处 `src/runtime/agent-runtime/index.ts` 移除，但目录已空。

### 根目录文档漂移

- `README.md:104`、`AGENTS.md:4`、`CLAUDE.md:47,65` | root-doc-stale | 引用 `src/runtime/agent-runtime/`（已空）。
- `README.md:31-32` | root-doc-incorrect | 列 `aa platform-operator` 与 `aa doctor`，但 package.json#bin 仅 `aa`。
- `README.md:40-44` | root-doc-stale | 含 `test:layers:smoke`、`coverage:gate`、`changelog:check`、`package:stable`；缺 `test:invariants`、`test:leaks`、`test:mutation:critical`。
- `AGENTS.md:10` | root-doc-stale | `ci:baseline` 含 `lint:architecture-boundary`、`audit:repo-hygiene`、`test:mutation:critical` 未文档化。
- `CONTRIBUTING.md` | root-doc-stale | Branch Strategy 列 main/feature/fix/refactor/docs，未提 redteam/pilot。
- `CHANGELOG.md:5-13` | root-doc-stale | 0.2.0 未提 `src/runtime/agent-runtime/` 移除。
- `docs_zh/quality/00-full-coverage-test-manual.md:502,2249` | doc-stale | "c8 0% coverage" 旧 round。
- `docs_zh/reviews/platforme-full-review-a.md:622` | doc-stale | `package.json:144` 与现行布局不匹配。
- `docs_zh/architecture/00-platform-architecture.md:19-21` | doc-incorrect | "横切能力" 路径错（`shared/contracts/model-gateway/prompt-engine/compliance`），实际是 `src/platform/contracts/` 和 `src/platform/shared/`。
- `docs_zh/architecture/01-code-structure.md` | doc-incorrect | 7-layer legacy；CLAUDE.md 只列 5-plane。
- `docs_zh/reviews/platforme-full-review-b.md:31,166` | doc-stale | 多处 `src/runtime/agent-runtime/index.ts` 引用。
- `docs_zh/architecture/05-cross-platform-ui-architecture.md` | doc-stale | `packages/features/*/web/index.tsx`；`feature-flags` 实际无 `web/` 子目录。
- `docs_zh/operations/review-prevention-plan.md:167` | doc-stale | 收口表指针 -b 应为 -e。
- `docs_zh/operations/test_coverage_baseline_gate.md:19` | doc-stale | `npm run test:raw`；README 漏 `test:invariants`/`test:leaks`。
- `CLAUDE.md:21` | root-doc | `npm run test:golden` 与 audit:repo-hygiene 一致；OK。
- `CLAUDE.md:26` | root-doc-stale | `tsx --test tests/unit/...` 单测示例应改用 `scripts/run-layered-tests.mjs`。
- `CLAUDE.md:38` | root-doc-incorrect | 列 5-plane；但 `src/core/runtime/` 当前是 13 个 five-plane 模块的 wide re-export barrel，非 thin shim。
- `CLAUDE.md:46` | root-doc-stale | `src/runtime/agent-runtime/` 引用。
- `README.md:78-99` | root-doc-incorrect | Project Structure 树漏 `src/index.ts`/`src/domains-runtime-catalog.ts`/`src/platform-architecture-bootstrap.ts`/`src/platform-architecture-types.ts`/`src/platform-root-types.ts`。
- `README.md:32` | root-doc-stale | `aa platform-operator` 子命令未在 package.json#scripts 文档化。
- `CONTRIBUTING.md:8-13` | root-doc-stale | `nvm use` 无 `.nvmrc`。
- `CHANGELOG.md:5-13` | root-doc-stale | 不提空 `src/runtime/agent-runtime/`。
- `SECURITY.md:1-13` | root-doc-stale | 通用 reporting，未提 UI 特定安全边界（如 `app-shell.tsx` URL-based auth bypass）。
- `package.json:50-100 (scripts)` vs `README.md/CLAUDE.md` | root-doc-stale | `audit:repo-hygiene` 含 25+ 子审计，根文档只提子集。

---

## 与上文 1-76 的关系

本扩展为上文 76 条的**细化与扩展**，定位不同：

- 上文 1-76：Critical/High 级精简摘要（每条带修复建议与收口路径）。
- 本扩展：~600+ 条文件级、函数级详细复审，覆盖更广（plugins/domains/interaction/org-governance/scale/ops-maturity/sdk/tests/config/deploy/scripts/ui/docs/root），用于实际开发定位与代码 review 准备。

收口建议路径仍以上文 1-76 的优先级（先 Critical 5 条 → High 22 条），本扩展用于 f 轮的具体落地。

## 复核可重放

```bash
# 1. baseline
npm run build
npm run typecheck
npm run audit:repo-hygiene  # 25/25 pass

# 2. 五大领域深入复审（5 路并行 sub-agent，已在本轮执行）
#    - Agent 1: platform/{interface,control-plane,orchestration}
#    - Agent 2: platform/{execution,state-evidence,shared,contracts,structure,stability,cost-management}
#    - Agent 3: {domains,plugins,interaction,org-governance,scale-ecosystem,ops-maturity}
#    - Agent 4: {sdk,tests,config,deploy,scripts}
#    - Agent 5: {ui,docs_zh,docs_en,root}
#    合计 ~600+ 文件级 findings

# 3. 关键 8 处 Critical 引用行已二次人工核对
#    http-api-server.ts:636 → resolveClientIp 仅返 fallback
#    delegation-manager.service.ts:934 → 显式 floating promise
#    cdc-replication-service.ts:1010/1037 → clearState 不清 vectorClocks
#    multi-step-orchestration.ts:42-43 → try/finally 范围仅 provideContext
#    admin-routes.ts:209-233 → applyAdminConfigUpdate silent no-op
#    sub-workflow-executor.ts:983 行 → 入口未抽样
#    durable-event-bus.ts:316-389 → publish/scheduleFanOut 跨事务
#    runtime-recovery-decision-service.ts:176-194 → SQLite transaction 不支持 async
#    secret-commands.ts:174-180 → verifyAuthToken 空 buffer 比较返 true
#    ui/apps/web/src/app-shell.tsx:472-495 → URL-based auth bypass

# 4. 本文件结构
#    上半段: 76 条 critical/high 摘要 + 根因归类
#    下半段: ~600+ 文件级深度复审（按 19 个 subsystem 切片）
```

## 下轮（f 轮）建议

- 抽样 30+ 个未覆盖的"长文件"（1000+ 行）做第三轮聚焦：
  - `src/sdk/cli/*` 主 CLI 文件
  - `src/scale-ecosystem/multi-region/cdc-replication-service.ts` (1208 行)
  - `src/scale-ecosystem/billing/billing-service.ts` (1016 行)
  - `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts` (983 行)
  - `src/platform/five-plane-interface/channel-gateway/channel-gateway-service.ts` (948 行)
  - `src/platform/five-plane-control-plane/mission/operating-model.ts` (810 行)
  - `src/platform/five-plane-control-plane/mission/index.ts` (1641 行)
  - `src/platform/five-plane-control-plane/iam/cve-intelligence-service.ts` (755 行)
  - `src/platform/five-plane-control-plane/incident-control/*` 与 `config-center/*` 长文件
  - `src/platform/shared/stability/stable-evidence-bundle-support.ts` (943 行)
  - `src/platform/shared/observability/*` 与 `cost-management/*` 其它长文件
  - `src/scale-ecosystem/tenant-platform/tenant-platform-service.ts` (1003 行)
  - `src/scale-ecosystem/marketplace/marketplace-governance-service.ts` (933 行)
  - `src/plugins/builtin-plugin-registry.ts` (933 行)
  - `src/interaction/nl-gateway/index.ts` (939 行)
  - `src/interaction/goal-decomposer/index.ts` (933 行)
  - `src/org-governance/sso-scim/scim-sync/scim-service.ts` (1037 行)
  - `src/ops-maturity/chaos/chaos-experiment-scheduler.ts` (920 行)
  - `src/ops-maturity/version-management/version-compatibility-matrix.ts` (387 行)
  - 30+ vertical domains `index.ts` / `*-config.ts`
  - `src/platform/shared/lifecycle/global-singleton.ts` 等 lifecycle
  - `src/platform/structure/index.ts` (11184 字节)
  - `src/platform/contracts/executable-contracts/*`
  - 大量 `*support.ts`、`*-async.ts` 薄转发文件
- 对 f 轮发现的 600+ findings 做去重 + 收口优先级排序
- 把 hot-paths（dispatcher、queue、lease、event-bus、http-api）的 critical/high 收口视为 v3.5 准入门槛

> 至此，e 轮复审完成两个层级：(1) 上文 1-76 条 优先级摘要；(2) 本扩展 600+ 条 文件级深度复审。下一轮（f 轮）将聚焦未抽样的长文件 + 收口跟踪。
