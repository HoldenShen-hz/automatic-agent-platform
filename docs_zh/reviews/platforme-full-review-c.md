## src/platform/five-plane-interface

| 编号 | 问题 | 状态 |
| --- | --- | --- |
| 1 | `iam/audit-event-integrity.ts:43-44`、`distributed-rate-limiter.ts:47`、`request-deduplication.ts:82`、`http-api-server.ts:119-122`、`http-server/health-routes.ts:19-21` 库内直接读 `process.env.NODE_ENV`/常量，破坏 DI 与测试 | `todo` |
| 2 | `stryker.config.mjs:30-33` `mutate:` 仅 9 个文件集中在 `http-server/`，覆盖远窄于策略文档声明 | `todo` |
| 3 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:82` 用户 `cursor JSON.parse` 无 `try/catch`，恶意游标 → 500 | `todo` |
| 4 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:103-104` 模块级 `InMemoryHarnessRunStore` 单例，跨请求共享、重启丢数据 | `todo` |
| 5 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:159-162` `/events` 接口固定返回空数组，未对接 Truth | `todo` |
| 6 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:209,217-218,228` `body.riskLevel/status` 直接 `as` 强转无枚举校验 | `todo` |
| 7 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:273-279` `PATCH` 把 `body.status/terminalReason` 直接写存储，无白名单 | `todo` |
| 8 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:76-89` `list` 每请求 `Array.from+sort O(n log n)` 全量重排 | `todo` |
| 9 | `src/platform/five-plane-interface/webhook/index.ts:73-74` `acceptedEnvelopes/failureCounts` 无界增长 | `todo` |
| 10 | `src/platform/five-plane-interface/webhook/index.ts:72` `envelopesByIdempotencyKey` 缺 TTL/上限 | `todo` |
| 11 | `src/platform/five-plane-interface/webhook/index.ts:111-120` 事件类型/允许列表校验先于签名校验，未签名探测可枚举 `allowedEventTypes` | `todo` |
| 12 | `src/platform/five-plane-interface/webhook/index.ts:207-209` 失败计数硬编码 50，自动 disable 后无再激活路径 | `todo` |
| 13 | `src/platform/five-plane-interface/webhook/index.ts:200-211` `recordDeliveryFailure` 直接 mutate 注册对象 `enabled`，破坏不可变契约 | `todo` |
| 14 | `src/platform/five-plane-interface/webhook/index.ts:182-184` `rollbackAcceptedEnvelope findIndex` 线性搜索 | `todo` |
| 15 | `src/platform/five-plane-interface/webhook/index.ts:296-315` `parseWebhookPayload` 不限制 body 大小，超大 JSON 阻塞 event loop | `todo` |
| 16 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:190,250` 先 `get` 后 `set` 非原子，并发同 `Idempotency-Key` 双写入 | `todo` |
| 17 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:206-217` `in-flight` 分支返回 `allowed:true` 但同时附 409，语义冲突 | `todo` |
| 18 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:201` 错误消息回显用户 `idempotencyKey/method`，响应注入风险 | `todo` |
| 19 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:222-234` 缓存响应 `JSON.parse` 无大小限制 | `todo` |
| 20 | `src/platform/five-plane-interface/api/http-server/approval-routes.ts:73` 用户 `requestJson JSON.parse` 无大小限制 | `todo` |
| 21 | `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts:344` `dashboard requestJson JSON.parse` 同上 | `todo` |
| 22 | `src/platform/five-plane-interface/api/http-server/utils.ts:339,344` 游标 base64url 编解码无 `try/catch`、无完整性签名，可篡改 | `todo` |
| 23 | `src/platform/five-plane-interface/api/http-server/gateway-routes.ts:125` `body` 非字符串时 `JSON.stringify` 后转发，丢字节序签名失败 | `todo` |
| 24 | `src/platform/five-plane-interface/api/http-server/task-routes.ts:340,357` `JSON.stringify(payload)` 持久化未限定字段顺序 | `todo` |
| 25 | `src/platform/five-plane-interface/webhook/index.ts:255` `Buffer.from(normalizedSignature,"hex")` 接受非 hex 并截断，长度比对掩盖污染 | `todo` |
| 26 | `src/platform/five-plane-interface/webhook/index.ts:60-61` 重放缓存 TTL/容量都是 module 常量，不可由租户/endpoint 配置 | `todo` |
| 27 | `tests/integration/platform/interface/api/grpc-adapter-service-integration.test.ts:24,47,145,178,207,337` 6 处 `host:"0.0.0.0"` 监听全网卡 | `todo` |
| 28 | `api-server-env.ts` 读 `AA_API_KEYS_JSON` 与文档 `AA_API_KEYS` 不一致 | `todo` |

## src/platform/five-plane-control-plane

| 编号 | 问题 | 状态 |
| --- | --- | --- |
| 29 | 控制面深入状态-证据面 SQLite 私有路径（`approval/config/incident-control` 多处） | `todo` |
| 30 | 执行面约 40 处 import 控制面 IAM/配置实现细节，未通过 contract/policy 端口 | `todo` |
| 31 | `iam/field-encryption.ts:10,24` PBKDF2 仅 100k 次 + 同步 `pbkdf2Sync`，低于 OWASP 600k 且阻塞事件循环 | `todo` |
| 32 | `iam/session-management.ts:164-167` `hashToken` 用裸 `sha256(token)`，文件注释承认应用 HMAC | `todo` |
| 33 | `tests/integration/platform/control-plane/config-center/config-rollout-service-integration.test.ts:317,332,355` `Date.now()-90000000` 注释 `"25h"` 实为 25h00m00s，等于 TTL 即抖动 | `todo` |
| 34 | `tests/integration/platform/control-plane/incident-control/doctor.test.ts:1096` `delete process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION` 无前置捕获 | `todo` |
| 35 | `src/platform/five-plane-control-plane/policy-center/index.ts:282` 紧急模式 `requiresApproval=subjectType!=="system"`，`system` 主体绕过 break-glass 审批 | `todo` |
| 36 | `src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:120-132` `getFieldValue` 沿 `.` 路径访问，未拒绝 `__proto__/constructor/prototype` | `todo` |
| 37 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:450` `JSON.stringify(config, Object.keys(config).sort())` 误用 replacer 当 key 白名单，嵌套字段被裁剪 | `todo` |
| 38 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:451-457` 32-bit 非密码学哈希做配置 checksum，碰撞概率明显 | `todo` |
| 39 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:765-768` `startDailyRotationSchedulers` 入口先清空再 add，重入丢正在执行的 sweep | `todo` |
| 40 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:770-776` `runRotationSweep("initial")` 与 `setInterval` 同步起，可能并发同一 sweep | `todo` |
| 41 | `src/platform/five-plane-control-plane/iam/aws-kms-http-secret-provider.ts:358-364` 双重 base64 解码假设 KMS 永返 base64 | `todo` |
| 42 | `src/platform/five-plane-control-plane/iam/gcp-secret-manager-http-secret-provider.ts:256` GCP secret 返回值未校验是否 base64 | `todo` |
| 43 | `src/platform/five-plane-control-plane/incident-control/runbook-executor/runbook-executor.ts:192-198,258-266` `runbook executor` 仅 simulate，生产路径未对接 | `todo` |
| 44 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts` 配置 hash 仅取 keys 顶层不递归 | `todo` |
| 45 | `src/platform/five-plane-control-plane/iam/field-encryption.ts:46` `Buffer.from(value,"base64")` 直接解码，未拒绝纯 utf-8 输入 | `todo` |
| 46 | `src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:128` 任意 string parts 索引到 `Function.prototype` 等成员，假阳/假阴匹配 | `todo` |
| 47 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:805-815` `requireRegistryRecord` 错误路径 `details` 重复 `secretRef` 未脱敏 | `todo` |
| 48 | `tests/unit/platform/control-plane/iam/sandbox-policy-extended.test.ts:66` `/tmp/test-file-${Date.now()}` 越出 `sandbox-root` 测试矩阵 | `todo` |
| 49 | `startup-env-schema.ts:376` JWT 密钥 `undefined` 走 default-allow，缺密钥仍可签发 | `todo` |
| 50 | `api-client.ts` `Retry-After` 直接 `parseInt`，未识别 HTTP-date | `todo` |
| 51 | `test:secret-providers` 路径错误（少一层 `platform/`） | `todo` |
| 52 | `auto-stop-loss-service.ts:789`、`config-hot-reload-service.ts:268,506`、`cache-invalidation-broadcast.ts:68`、`durable-event-bus.ts:710,916,1007`、`call-governance.ts:609`、`external-secret-provider.ts:226` 多处 `void promise fire-and-forget` 无 `.catch` | `todo` |
| 53 | `aws-kms-http-secret-provider.ts:211`、`gcp-secret-manager-http-secret-provider.ts:103`、`vault-http-secret-provider.ts:132` `setTimeout(...controller.abort)` 未 `.unref()` 且部分成功路径漏 `clearTimeout` | `todo` |
| 54 | `secret-management-service.ts:765-768` `startDailyRotationSchedulers` 静默 `clear` 已有 schedulers，外部 handle 失效 | `todo` |
| 55 | `client-sdk/api-client.ts:188` `(result as { totalCount?: number }).totalCount = totalCount` 通过 cast 改写 readonly 字段 | `todo` |
| 56 | `client-sdk/api-client.ts:368` `connect()` 在 SSE bootstrap 处 `fire-and-forget`，初始 fetch rejection 未处理 | `todo` |

## src/platform/five-plane-orchestration

| 编号 | 问题 | 状态 |
| --- | --- | --- |
| 57 | `src/platform/agent-delegation/index.ts` 与 `five-plane-orchestration/agent-delegation/*` 形成双入口 | `todo` |
| 58 | `config/quality/test-exclusion-allowlist.json` 列 `tests/integration/platform/orchestration/**`（已重命名为 `five-plane-orchestration`），永不命中 | `todo` |
| 59 | `oapeflir/runtime-execute-bridge.ts:223-235` `executor` 为 `null` 时合成假 `succeeded + validationPassed:true`，stub 静默返回 | `todo` |
| 60 | `oapeflir/runtime-execute-bridge.ts:182` `defaultModelId="MiniMax-M2.7"` 把具体厂商模型硬编码到框架代码 | `todo` |
| 61 | `oapeflir/runtime-execute-bridge.ts:194,264,316` `createdAt: Date.now()` 数字与 `Plan.createdAt: string` 类型漂移，仅靠 `as Plan cast` | `todo` |
| 62 | `oapeflir/handoff-model.ts:55-57` `Math.ceil(JSON.stringify(value).length/4)` 估 token 对 CJK/多字节失真 | `todo` |
| 63 | `oapeflir/handoff-model.ts:88-135` 压缩静默丢弃 `historyRefs/toolCallRecords/planDelta/blockers/artifactRefs`，无丢弃台账 | `todo` |
| 64 | `oapeflir/oapeflir-loop-core.ts:382`、`oapeflir-loop-support.ts:324`、`stage-transition-fsm.ts:189-223` 多处 `Date.now()` 自打时戳，时钟回拨即非单调 | `todo` |
| 65 | `oapeflir/oapeflir-loop-core.ts:299` 把 `process.{version,platform,cwd()}` 写入 `environmentContext` 留存 evidence，泄漏宿主指纹 | `todo` |
| 66 | `docs_zh/contracts/oapeflir_loop_contract.md` 存在但 `README` 不列；`ADR-016` 引用 OAPEFLIR 也未链接 | `todo` |
| 67 | `scripts/ci/mutation-critical-tests.sh:13` 引 `tests/unit/platform/orchestration/oapeflir/...` 而权威路径为 `five-plane-orchestration`，重命名后静默零测 | `todo` |
| 68 | `src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:275` `super("mock://runtime","local-simulated")` 默认指向 mock 运行时 | `todo` |
| 69 | `scripts/ci/audit-oapeflir-terminology.mjs` 仅扫八字母拼写，遗漏中文术语漂移 | `todo` |

## src/platform/five-plane-execution

| 编号 | 问题 | 状态 |
| --- | --- | --- |
| 70 | `plugin-executor.service.ts:482` 显式抛 `action_not_implemented`，hook 缺失即 500 | `todo` |
| 71 | `five-plane-execution/state-transition/*` 经 `core/runtime/index.ts` 重新出口越界 | `todo` |
| 72 | `tests/unit/runtime/`、`platform/execution/`、`platform/five-plane-execution/` 平行重复 | `todo` |
| 73 | `plugin-executor.service.ts:106` `enforceSignatures` 默认 `false`，env 未设时不安全 fail-open | `todo` |
| 74 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:55-90` `SELECT/DELETE/INSERT` 不在事务内，TTL 过期淘汰 TOCTOU；并发夺锁可误删刚获取者 | `todo` |
| 75 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:34-37` `distributed_lock_fencing_tokens` 仅 `INSERT` 自增、永不清理，无界增长 | `todo` |
| 76 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:54` `ttlMs` 缺下界校验，负值/0 直接写入 | `todo` |
| 77 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:135-148` `forceSteal` 无前置授权/原因白名单，任意调用即可夺锁 | `todo` |
| 78 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:140` `forceSteal` 硬编码 `ttlMs=30000` 而非沿用原锁配置 | `todo` |
| 79 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:107-112` `release owner` 不匹配时静默返回 `false` 无审计事件 | `todo` |
| 80 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:549-573` `dequeueAsync` 多 `await` 间无原子性，两 worker 可同时取走同 `jobId` | `todo` |
| 81 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:569` 状态确认前 `hincrby attempts`，状态重置导致计数错位 | `todo` |
| 82 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:566-568` 状态非 `waiting` 即 `zrem` 返回 `null` 静默丢任务 | `todo` |
| 83 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:592-596` 仅 ack 路径 `expire` 任务键，`nack`/失败任务无 TTL key 累积 | `todo` |
| 84 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:605-609` `nack` 重排不带退避，立即被同 worker 再拉 | `todo` |
| 85 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:664-672` `retryJobAsync` 强置 `attempts=0` 绕过 `maxAttempts` 预算 | `todo` |
| 86 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:600` `nack` 闭包引用陈旧 `jobData.priority` | `todo` |
| 87 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:675-695` `purgeAsync` 对每条 ID 逐个 `hgetall` N+1 RTT | `todo` |
| 88 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:308-317` 先 `arrayBuffer()` 全量读再判大小，可被超大响应 OOM | `todo` |
| 89 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:323-324` `JSON.parse` 无 `try/catch`，恶意 JSON 直接抛 | `todo` |
| 90 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:296-298` `Content-Type` 大小写敏感比较，调用方 `Content-type` 时双写 header | `todo` |
| 91 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:672-678` `simulateStepExecution` 仅 `setTimeout 50ms`，未真执行任何 action | `todo` |
| 92 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:729-733` `simulateRollback` 是 no-op，回滚永远成功 | `todo` |
| 93 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:665-669` `findStepDefinition` 遍历所有 executions `O(N·M)` | `todo` |
| 94 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:642` `step.output` 写死 `"Step X completed successfully"` 覆盖真实输出 | `todo` |
| 95 | `src/platform/five-plane-execution/compensation-manager.ts:312-319` `reverseExternalEffect` 直接 `return true`，外部副作用未反转 | `todo` |
| 96 | `src/platform/five-plane-execution/compensation-manager.ts:326-333` `executeCompensateAction` stub 永真 | `todo` |
| 97 | `src/platform/five-plane-execution/compensation-manager.ts:339-344` `sendCompensationNotification` 空体，通知从未发出 | `todo` |
| 98 | `src/platform/five-plane-execution/compensation-manager.ts:350-358` `executeRollback` stub，回滚契约不实现 | `todo` |
| 99 | `src/platform/five-plane-execution/execution-engine/phase1a-happy-path.ts:1-6` 仅 `re-export`，按 `AGENTS` 应彻底移除 | `todo` |
| 100 | `src/platform/five-plane-execution/execution-engine/phase1b-orchestration.ts:1-31` 兼容文件维持冗余命名 | `todo` |
| 101 | `src/platform/five-plane-execution/execution-engine/phase1b-tool-definitions.ts` 与 `phase1b-utils.ts` `phase1b` 兼容残留 | `todo` |
| 102 | `src/platform/five-plane-execution/recovery/runtime-recovery-service.ts` 与 `runtime-recovery-service-root.ts` 等四对 `*-service/*-service-root` 双胞胎 | `todo` |
| 103 | `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts` 581 行单文件违反 `AGENTS small modules` 原则 | `todo` |
| 104 | `src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts` 814 行同上 | `todo` |
| 105 | `src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:47` ESM 内反向用 CJS `require` | `todo` |
| 106 | `src/platform/five-plane-execution/distributed-lock/locking-support.ts:12` `require("postgres")` 同步加载，可选依赖耦合 | `todo` |
| 107 | `src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:67-68` 构造期 `createRequire+require("ioredis")`，缺失依赖即启动崩 | `todo` |
| 108 | `src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:167,226` `lock id` 用 `Date.now()` 拼字符串，毫秒级冲突可复用 | `todo` |
| 109 | `src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:25-47` `createRequire` 后动态 `require` 同胞 `.js`，模块图无法静态分析 | `todo` |
| 110 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-manager.ts` 9 行 dead shim | `todo` |
| 111 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-service.ts` 10 行 dead shim | `todo` |
| 112 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-factory.ts` 21 行轻量包装与 `manager/service` 重叠 | `todo` |
| 113 | `src/platform/five-plane-execution/execution-engine/runtime-context.ts` 1 行 shim | `todo` |
| 114 | `src/platform/five-plane-execution/execution-engine/single-task-execution.ts` 7 行 `re-export shim` | `todo` |
| 115 | `src/platform/five-plane-execution/distributed-lock/index.ts` 1 行 barrel | `todo` |
| 116 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:560-562` 取最高 score（最新）违反 FIFO 直觉文档未说明 | `todo` |
| 117 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:686-693` checkpoint state 直接引用原 `entries` 数组，后续 mutate 污染历史 checkpoint | `todo` |
| 118 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:706-713` `performRollback` 在 `rollbackHistory` 为空时全标 `rolled_back`，不区分未执行步骤 | `todo` |
| 119 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:286-288` `AbortController.unref` 后 timeout 不阻塞退出，但 abort 后未 `await` 清理与 ESM top-level race | `todo` |
| 120 | `src/platform/five-plane-execution/recovery/runtime-recovery-service-root.ts` 与 `runtime-recovery-service.ts` 仅 import 路径与少量变量名不同，构成事实分支 | `todo` |
| 121 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:60,87,119-121` `Math.min(ttlMs,MAX_LOCK_TTL_MS)` 三处重复，常量 `600_000ms` 硬编码 | `todo` |
| 122 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:115-127` `extend` 用 `MIN(ttl_ms+?, MAX)` 累加而非自现在重置，TTL 永远滑向上限 | `todo` |
| 123 | `pg-advisory-lock-adapter.ts` 取锁后无 `try/finally`，throw 路径锁泄漏 | `todo` |
| 124 | `pg-advisory-lock-adapter.ts:34-43` 自定义 FNV-1a 截断到 63 位，碰撞被静默接受 | `todo` |
| 125 | `pg-advisory-lock-adapter.ts:71-83` `extend()` 仅改内存 map，不刷新 PG 端 advisory lock TTL | `todo` |
| 126 | `pg-advisory-lock-adapter.ts:107-115` catch-all 把瞬时 PG 错误伪装成 `"lock taken"` | `todo` |
| 127 | `pg-advisory-lock-adapter.ts:101` `Number(result.fencing_token)` 超 `2^53` 精度丢失 | `todo` |

## src/platform/five-plane-state-evidence

| 编号 | 问题 | 状态 |
| --- | --- | --- |
| 128 | `CLAUDE.md:50` 引用不存在的 `state-evidence/artifacts/` 目录 | `todo` |
| 129 | 多个 contract/review 指向不存在的 `state-evidence/artifacts/` 目录 | `todo` |
| 130 | `runtime-truth-repository.ts:741`、`projection-rebuild-service.ts:429`、`memory-gateway/index.ts:248`、`plan-builder.ts:193` 用非规范化 `JSON.stringify` 做指纹，键序变化即误判 diff | `todo` |
| 131 | `tests/integration/platform/state-evidence/memory/memory-layer-model-integration.test.ts:261` 用 `Date.now()-90000` 做老化断言，时钟漂移即抖动 | `todo` |
| 132 | `tests/integration/platform/state-evidence/events/durable-event-bus.integration.test.ts` 与 `durable-event-bus-integration.test.ts` 命名不一致疑似双跑 | `todo` |
| 133 | `package.json:223-234` `test:receipt-store/tool-gateway/memory-gateway/sandbox-provider` 无 aggregator，仅操作员入口 | `todo` |
| 134 | `five-plane-state-evidence/index.ts:1` `re-export` 不存在的 `./artifacts/index.js`，import 即抛 | `todo` |
| 135 | `truth/sqlite/repositories/operations-repository.ts:898` `listRuntimeRecoveryRecords` 把 caller `whereClause` 直拼 SQL，仅过滤 `;\\|--\\|/*` 仍允许 `OR 1=1/子查询` | `todo` |
| 136 | `truth/sqlite/repositories/event-repository.ts:788-828` `insertEvent` 与 outbox `INSERT` 双 prepared 无统一事务，破坏 outbox 原子性 | `todo` |
| 137 | `truth/sqlite/repositories/task-repository.ts:96-125` `listTasks cursor` 仅按 `updated_at`，无 `id tiebreaker`，分页可丢行/死循环 | `todo` |
| 138 | `truth/sqlite/repositories/tenant-repository.ts:203-204` `listAll` 用 `[...Map.values()].slice` 无稳定排序，跨页结果重排 | `todo` |
| 139 | `truth/sqlite/repositories/release-repository.ts:611,632,654` `listEnterprise*` 仅 `limit=20`，无 cursor/offset/tenant 过滤 | `todo` |
| 140 | `truth/sqlite/repositories/intelligence-repository.ts:350` `listIntelBriefs(limit=20)` 无 cursor 静默截断 | `todo` |
| 141 | `truth/sqlite/repositories/organization-repository.ts:273` `listOrganizationRecords(limit=50)` 无租户过滤，跨租户泄漏 | `todo` |
| 142 | `truth/sqlite/repositories/worker-repository.ts:63` 与 `worker-snapshot-repository.ts:276` `listCoordinatorInstanceSnapshots` 双实现 schema 漂移 | `todo` |
| 143 | `state-evidence/dlq/index.ts:110-113` `enqueue` 用线性 `listByConsumer` 去重，`O(n)` 每 insert，无索引 | `todo` |
| 144 | `state-evidence/dlq/index.ts:282-284` `runDueRetries` 空 `catch {}` 吞错无 logger/telemetry/退避 | `todo` |
| 145 | `state-evidence/dlq/index.ts:99` `maxRetries=5` 硬编码，与 `dlq-service.ts retry policy` 冲突 | `todo` |
| 146 | `state-evidence/dlq/index.ts:6-23` `DeadLetterRecord` 与 `contracts/types/domain/session-types.ts EventDeadLetterRecord schema` 双源 | `todo` |
| 147 | `state-evidence/incident/index.ts:127-161` `listIncidents/listIncidentsPaginated` 全量 `Map.values() + sort + findIndex`，并发插入下 cursor 失效 | `todo` |
| 148 | `state-evidence/incident/index.ts:35` `linkedEvidenceRefs: input.linkedEvidenceRefs ?? []` 直接存 caller 引用，外部 mutation 污染内部 | `todo` |
| 149 | `state-evidence/incident/index.ts:117-121` `resolve()` 接受任意当前状态，绕过 `triaged→mitigating→reviewed→resolved` FSM | `todo` |
| 150 | `state-evidence/incident/index.ts:22` `nextIncidentOrder` 单调 ID 公开预测可枚举 | `todo` |
| 151 | `state-evidence/audit/index.ts:21,29` `AuditTrailService.records` 内存数组无轮换/持久化，长进程必 OOM | `todo` |
| 152 | `projections/projection-rebuild-service.ts:265-266,278-294` `JSON.stringify` 比对非规范化键序；cutover 无乐观并发 token | `todo` |
| 153 | `checkpoints/checkpoint-envelope.ts:226` `Buffer.from(payload,"base64")` 不抛错，恶意 payload 静默截断后入 gunzip | `todo` |
| 154 | `checkpoints/checkpoint-envelope.ts:147-149` `JSON.stringify` 大对象先全量物化再判 size，OOM 早于守卫 | `todo` |
| 155 | `checkpoints/checkpoint-gc-service.ts:548-560` `acquireRunLock` 不记录 PID/host，崩溃残留锁与活锁不可区分 | `todo` |
| 156 | `knowledge/keyword-index.ts:22-30` `upsert` 不清除前一次 keywords 反向索引，遗留陈旧 posting | `todo` |
| 157 | `knowledge/keyword-index.ts:32-47` `query` 每次重扫 `countOccurrences` 无缓存 | `todo` |
| 158 | `knowledge/keyword-index.ts:1-53` 缺 `delete(chunkId)` API，chunk 永生 | `todo` |
| 159 | `memory-gateway/index.ts:248-258` `projectionHash` 用 `JSON.stringify([...input.memoryIds])` 保留 caller 顺序，相同集合不同序 hash 不同 | `todo` |
| 160 | `memory-gateway/index.ts:280-298` 内存层映射 `L1/L2/L4/L6 round-trip` 有损，未断言 | `todo` |
| 161 | `memory-gateway/index.ts:328` `Number.isFinite(Number(metadata.version))` 接受 `1e308`，缺整数/范围校验 | `todo` |
| 162 | `state-evidence/memory/trust-level-service.ts:245-248` `MAX=500/TTL=24h/EVICT=60s` 硬编码无 config | `todo` |
| 163 | `state-evidence/memory/trust-level-service.ts:280-289` 每次驱逐 `[...entries].sort O(n log n)`，含非空断言吞 OOB | `todo` |
| 164 | `state-evidence/memory/trust-level-service.ts:384-385` `includes("TODO"/"FIXME")` 字面字符串过滤，正常文本误伤 | `todo` |
| 165 | `truth/sqlite/repositories/prompt-bundle-repository.ts:164-332` 8 处 `JSON.stringify(input.*)` 列写入无 zod 校验 | `todo` |
| 166 | `truth/sqlite/repositories/billing-repository.ts:168` `Number(result.changes)` BigInt `> 2^53` 静默截断 | `todo` |
| 167 | `truth/sqlite/repositories/worker-snapshot-repository.ts:249` 同一查询按 filter 切换 `ORDER BY`，cursor 跨 filter 即失效 | `todo` |
| 168 | `state-evidence/events/event-ops-service.ts:216-221` `setTimeout(...) reject` 计时器未 `unref`；`Promise.race` 胜者不 `clearTimeout` | `todo` |
| 169 | `state-evidence/events/durable-event-bus.ts:9` 不同实例化点 `retentionLimit:500/100` 不一致 | `todo` |
| 170 | `tests/integration/platform/state-evidence/events/transactional-event-appender` 与 `event-repository.ts:788-828` outbox 拆分两 prepared 调用，SQLite WAL autocommit 下观察方可见部分状态 | `todo` |
| 171 | `tests/integration/platform/state-evidence/checkpoints/checkpoint-envelope.ts:178` `createdAt:new Date().toISOString()` 用本地时钟，不同 TZ 重放产物元数据非确定 | `todo` |
| 172 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:138` `PRAGMA journal_mode=WAL` 不断言返回，NFS 等环境静默回退 delete | `todo` |
| 173 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:134` `busy_timeout` 允许 0，瞬时 `SQLITE_BUSY` 与并发冲突 | `todo` |
| 174 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283` `Object.values(row)` 依赖 `wal_checkpoint` 列序，缺键名解构 | `todo` |
| 175 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:347-350` `close()` 不检查 `wal_checkpoint busy>0`，存帧未刷盘即关 | `todo` |
| 176 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:442-449` 通过正则 `database is locked\\|busy` 识别 `BUSY`，本地化/errno 改即失效 | `todo` |
| 177 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-340` `healthCheck` 标 `async` 实仅同步事务，误导调用方 | `todo` |
| 178 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:455-465` `applyCompatibleColumnMigrationIfKnown` 命中后跳过 `migration.sql`，索引/约束变更悄然丢 | `todo` |
| 179 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:108,233` `fetch` 无 `AbortController/超时` | `todo` |
| 180 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:121-126,246-251` 错误体直接拼到 `Error message`，潜在日志注入 | `todo` |
| 181 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:137,259+` `response.json()` 无 `try/catch` | `todo` |
| 182 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:142-144` 未校验返回 `index` 范围/重复，序后映射假定一一对应 | `todo` |
| 183 | `src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts:226` `Buffer.from(payload,"base64")` 不校验长度/MIME，损坏 payload 解空 buffer 不报错 | `todo` |
| 184 | `src/platform/five-plane-state-evidence/memory/trust-level-service.ts:384-385` 用 `content.includes("TODO/FIXME")` 当信任级别下调依据，明显误报 | `todo` |
| 185 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-330` `healthCheck` 在事务内 `CREATE/DROP TEMP TABLE`，rollback 残留 TEMP 句柄 | `todo` |
| 186 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283-290` `checkpointWal` 不区分 `busy>0` 与 `frames=0`，运维无法识真实瓶颈 | `todo` |
| 187 | `tests/integration/platform/state-evidence/dlq-persistence.test.ts:464` `/tmp/dlq-persistence-test-${Date.now()}.db` 不可移植 Windows 且不在 finally 清理 | `todo` |
| 188 | `tests/unit/platform/state-evidence/knowledge/knowledge-store.test.ts:17` `/tmp/aa-sandbox/ktest_${suffix}_${Date.now()}` 集中污染 | `todo` |
| 189 | `tests/unit/platform/state-evidence/knowledge/p2-defects-sys-sec-4-2.test.ts:63,113` 两处 `/tmp/aa-sandbox/...` 不清理 | `todo` |
| 190 | `tests/leaks/platform/state-evidence/events/durable-event-bus.leak.test.ts` 阈值 10MB 同理且不区 `RSS/heapUsed` | `todo` |
| 191 | `dashboard-projection-service.ts:110` `system.health.changed` 未注册到 `TypedEventType` | `todo` |
| 192 | `migrate-sqlite-to-pg.ts` 列名/表名直拼 SQL，无白名单（注入风险） | `todo` |
| 193 | `idempotency-key-storage.ts` `${this.tableName}` 直拼 SQL，构造期未校验 | `todo` |
| 194 | `semantic-vector-store.ts` `process.env[name]` 中 `name` 来自配置，可读任意 env | `todo` |
| 195 | `checkpoint-gc-service.ts` `fs.stat→fs.unlink` TOCTOU 窗口 | `todo` |
| 196 | `shadow-snapshot-service.ts` `lstat→rename` 间存在 symlink swap 窗口 | `todo` |
| 197 | `sqlite-database-wrapper.ts:94-114` `savepoint` 名直拼 `exec`，未来调用方可注入 | `todo` |
| 198 | `sqlite-database.ts:143` `PRAGMA busy_timeout = ${this.busyTimeoutMs}` 拼 SQL，`busyTimeoutMs` 未做整数校验 | `todo` |
| 199 | `pg-advisory-lock-adapter.ts` 中 `Number(result.fencing_token)`、`sqlite-lock-adapter.ts:36 Number(result.lastInsertRowid)` 超 `2^53` 精度丢失 | `todo` |
| 200 | `checkpoint-gc-service.ts:171,557`、`learning-object-model.ts:180,184`、`risk-register.ts:87,110`、`invariant-registry.ts:137,165,180`、`responsibility-boundary.ts:158-308`、`admin-config-service.ts:66`、`outbox-repository.ts:117`、`memory-layer-model.ts:214,549`、`graphql-adapter-service.ts:294`、`conversation-template-service.ts:408`、`approval-policy-engine/version-manager.ts:111`、`stable-evidence-bundle-support.ts:612,616,732`、`dlq-service.ts:238`、`knowledge-snapshot-store.ts:25-48`、`semantic-vector-validation.ts:276`、`tool-gateway/index.ts:150,160`、`idempotency-key-storage.ts:310,338,341`、`cors.ts:49-68`、`reliability/timeout.ts:45,54` 多处抛裸 `Error` 而非结构化 `AppError/ValidationError` | `todo` |
| 201 | `.gitignore` 全局 `*.db-shm/*.db-wal` 不存在，sqlite WAL 残留可被 commit | `todo` |

## src/platform/shared

| 编号 | 问题 | 状态 |
| --- | --- | --- |
| 202 | `src/platform/stability/` 与 `src/platform/shared/stability/` 平行同名目录实现已分歧 | `todo` |
| 203 | `src/platform/shared/reliability/`、`shared/stability/reliability/`、`stability/reliability/` 三处可靠性实现重复 | `todo` |
| 204 | `src/platform/shared/observability/structured-logger.ts:484-491` 每条 fsync 日志 `openSync+appendFileSync+fsyncSync+closeSync` 串行同步 IO | `todo` |
| 205 | `src/platform/shared/observability/structured-logger.ts:153,180` `sinkBaseDir=process.cwd()`，运行时 `chdir` 后语义漂移 | `todo` |
| 206 | `src/platform/shared/observability/structured-logger.ts:194` `mkdirSync` 无错误处理，权限不足时 configure 直接抛 | `todo` |
| 207 | `src/platform/shared/observability/structured-logger.ts:262` `retentionLimit=0` 时 buffer 长度 0，所有 log 静默丢弃 | `todo` |
| 208 | `src/platform/shared/outbox/outbox-poller-service.ts:193-197` `retryCount>=maxRetries` 仅 `failed++;continue`，永不投 DLQ | `todo` |
| 209 | `src/platform/shared/outbox/outbox-poller-service.ts:188-217` `for-await` 串行处理，无并发批量发布 | `todo` |
| 210 | `src/platform/shared/observability/otel-tracer.ts` 与 `otel-bootstrap.ts` 各自 `loadOtelApi/loadOtelModules`，OTel 加载两条路径 | `todo` |
| 211 | `src/platform/shared/observability/structured-logger.ts:153` `sinkBaseDir=process.cwd()` 多 worker fork 后各持自身 cwd，路径不一致 | `todo` |
| 212 | `tests/unit/platform/shared/stability/stable-prompt-injection-red-team-additional.test.ts:82,97,111,129,145` 5 处 `/tmp/...` 不可移植 | `todo` |
| 213 | `tests/unit/platform/shared/stability/stable-runtime-validator-additional.test.ts:30` `/tmp/${caseId}.backup.db` 跨 case 重名互覆盖 | `todo` |
| 214 | `graceful-shutdown.ts` `setImmediate(()=>process.exit())` 未 flush stdio | `todo` |
| 215 | `slo-alerting-channels.ts` 在 `queueMicrotask` 内做同步阻塞 I/O | `todo` |
| 216 | `graceful-shutdown.ts:122` `void this.handleSignal(signal)` 无 `.catch`；shutdown 错误成为 unhandled rejection | `todo` |

## src/platform/stability

| 编号 | 问题 | 状态 |
| --- | --- | --- |
| 217 | `src/platform/stability/timeout.ts:82` 成功路径未 `clearTimeout`，`setTimeout` 句柄泄漏 | `todo` |
| 218 | `src/platform/stability/timeout.ts cancel()` 仅取消计时器，未通过 `AbortSignal` 传给被包裹函数 | `todo` |
| 219 | `src/platform/stability/retry.ts` 与 `stability/reliability/retry.ts` 两份并存且策略分歧 | `todo` |

## src/platform/prompt-engine

| 编号 | 问题 | 状态 |
| --- | --- | --- |
| 220 | `ha-repository-postgres.ts:22`、`coordinator-load-balancing-service.ts:78`、`prompt-engine/registry/index.ts:123`、`tight-loop-detector.ts:82,95`、`loop-detection.ts:97`、`semantic-embedding.ts:108`、`structured-logger.ts:851`、`prompt-injection-guard.ts:543`、`profile-home.ts:31` 多处 `sha256` 截断到 32-64 位作为身份/缓存键，碰撞概率高 | `todo` |
| 221 | `prompt-engine/registry/index.ts:114` `listVersions` 用 `localeCompare` 排序，`"10"` 字典序排在 `"2"` 前 | `todo` |
| 222 | `prompt-engine/registry/index.ts:117-119` `listTemplates()` 全量 `flat-map` 无分页 | `todo` |
| 223 | `prompt-engine/registry/index.ts:81-86` `version_conflict` 检查后两阶段写入无回滚，部分失败遗留映射 | `todo` |
| 224 | `prompt-engine/eval/quality-config-loader.ts:24-35` schema 缺 `qualityScoreWeights` 求和≈1 与 `completeMinScore>approvalRequiredScore` 的 `.refine` | `todo` |
| 225 | `prompt-engine/eval/quality-config-loader.ts:101-105` zod 校验失败被吞为通用 `throw`，非结构化 `AppError` | `todo` |
| 226 | `prompt-engine/eval/llm-eval-service.ts:633` `logger.warn` 含 raw `suite.cases payload`，PII/prompt 内容外泄 | `todo` |
| 227 | `prompt-engine/eval/prompt-model-policy-governance-service.ts:584` `JSON.parse(release.metadata)` 无 zod 校验 | `todo` |
| 228 | `prompt-registry/index.ts:1-30` 30 行纯重出口 shim，违反单一来源 | `todo` |
| 229 | `prompt-engine/conversation-template-config-loader.ts:35` `JSON.parse(content)` 无大小上限，配置文件 OOM | `todo` |
| 230 | `template-registry/index.ts` 两处 `@ts-expect-error` | `todo` |

## src/platform/contracts & types

| 编号 | 问题 | 状态 |
| --- | --- | --- |
| 231 | `client-sdk/api-client.ts:984-992` `declare module ".../executable-contracts/index.js"` 模块增强会全局污染 `ContractEnvelope.principal` | `todo` |
| 232 | 全仓 `assert.ok(true)` 共 193 处（`tests/e2e/sdk/sdk-e2e.test.ts:388`、`tests/unit/platform/interface/ingress/*` 多处、`vcr-replay-fixture.test.ts:338`、`contracts/types/domain/index.test.ts:32`、`redis-lock-adapter.test.ts:1079,1082` 等），系统性占位 | `todo` |
| 233 | `contracts/types/responsibility-boundary.ts:316-326` 在 `"types"` 文件内放 `GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE` 单例运行时态 | `todo` |
| 234 | `contracts/types/responsibility-boundary.ts:302,306` 热路径每调用 `new Set` | `todo` |
| 235 | `contracts/types/domain/billing-types.ts:68` `summaryJson:string` 不透明 blob 无 zod | `todo` |
| 236 | `contracts/types/domain/billing-types.ts:63,95,177` `currency:"USD"` 三处字面，类型上禁多币种 | `todo` |
| 237 | `contracts/types/domain/billing-types.ts:122-129` `executionId/stepId` 标 `@deprecated` 仍 required，无移除计划 | `todo` |
| 238 | `contracts/types/domain/index.ts:1-249` 100+ 符号手维护，非 `export *`，新类型必致漂移 | `todo` |
| 239 | `contracts/types/index.ts:191` 跨入 `executable-contracts/index.js` `re-export`，绕过 domain 命名空间 | `todo` |
| 240 | `contracts/mission/{playbook,index}.ts:373/357` 两份 `stableStringify` 独立实现，可能漂移 | `todo` |
| 241 | `mission/index.ts` 1637 行单文件过大 | `todo` |
| 242 | `data-classification-service.ts:680`、`network-egress-audit.ts:335`、`auto-stop-loss-service.ts:65-71`、`panic-propagation-service.ts:119-123`、`war-room-coordinator.ts:93-94`、`policy-engine.ts:83`、`takeover-escalation-manager.ts:46,49`、`approval-flow-engine.ts:571`、`approval-policy-engine/version-manager.ts:443`、`mission/index.ts:685`、`config-audit-service.ts:319,824`、`provider-health-tracker.ts:55`、`task-timeline-service.ts:181` 多处 `push` 类内存无界增长 | `todo` |
