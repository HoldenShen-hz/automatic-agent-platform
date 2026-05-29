## src/platform/five-plane-interface

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1 | iam/audit-event-integrity.ts:43-44、distributed-rate-limiter.ts:47、request-deduplication.ts:82、http-api-server.ts:119-122、http-server/health-routes.ts:19-21 directly reads process.env.NODE_ENV/常量，breaks DI and testing | `done` | Root cause: 接口层和 IAM 辅助模块把环境探测写进库内部，缺少通过 options/deps 注入运lines配置的边界。 |
| 2 | stryker.config.mjs:30-33 mutate: only 9 个文件集中puts http-server/，coverage far narrower than策略文档声明 | `done` | Root cause: 变异测试配置长期采用人工点名清单，随着接口层扩张没有synchronous扩面。 |
| 3 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:82 user cursor JSON.parse has no try/catch，malicious cursor → 500 | `done` | Root cause: 分页游标puts路由内手写解码，未复用统一错误边界。 |
| 4 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:103-104 module-level InMemoryHarnessRunStore singleton，shared across requests、data lost on restart | `done` | Root cause: 早期占位实现把 store 放成module-levelsingleton，而不是relies on注入的路由relies on。 |
| 5 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:159-162 /events endpoint always returns empty array，not connected to Truth | `done` | Root cause: 事件接口只做了路由占位，没有把创建/更新生命周期事件落入可读取存储。 |
| 6 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:209,217-218,228 body.riskLevel/status directly cast with as without enum validation | `done` | Root cause: 输入校验缺失，relies on TypeScript cast 代替运lines时约束。 |
| 7 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:273-279 PATCH 把 body.status/terminalReason directly writes to storage，no whitelist | `done` | Root cause:  PATCH 逻辑直接把请求体映射到模型更新，没有字段白名单和终态约束。 |
| 8 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:76-89 list 每请求 Array.from+sort O(n log n) full re-sort | `done` | Root cause: 列表接口按“现取现排”的临时实现写成了每请求重排。 |
| 9 | src/platform/five-plane-interface/webhook/index.ts:73-74 acceptedEnvelopes/failureCounts unbounded growth | `done` | Root cause:  webhook 入口defaults to假设进程短生命周期，缺少容量治理vs回收策略。 |
| 10 | src/platform/five-plane-interface/webhook/index.ts:72 envelopesByIdempotencyKey lacks TTL/capacity limit | `done` | Root cause: 幂等缓存只实现了for deduplication语义，没有实现 TTL vs容量淘汰。 |
| 11 | src/platform/five-plane-interface/webhook/index.ts:111-120 event type/allowlist validation before signature validation，未签名探测can enumerate allowedEventTypes | `done` | Root cause: 校验顺序按业务字段优先组织，没有先做认证再做授权过滤。 |
| 12 | src/platform/five-plane-interface/webhook/index.ts:207-209 failure count hardcoded 50，auto-disable has no re-enable path | `done` | Root cause: 失败熔断threshold被hardcodesputs实现里，且缺少显式恢复操作。 |
| 13 | src/platform/five-plane-interface/webhook/index.ts:200-211 recordDeliveryFailure directly mutates 注册对象 enabled，breaking immutable contract | `done` | Root cause: 注册对象被当成可变运lines态直接回写，没有重新生成并替换记录。 |
| 14 | src/platform/five-plane-interface/webhook/index.ts:182-184 rollbackAcceptedEnvelope findIndex linear search | `done` | Root cause: accepts列表只有数组表示，没有反向索references支持回滚删除。 |
| 15 | src/platform/five-plane-interface/webhook/index.ts:296-315 parseWebhookPayload doesn't limit body size，exceeds大 JSON blocks event loop | `done` | Root cause:  payload 解析只关注 JSON 结构，不关注输入体积上限。 |
| 16 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:190,250 先 get 后 set non-atomic，concurrent同 Idempotency-Key double write | `done` | Root cause: 幂等中间件只有抽象 get/set 存储接口，没有原子保留语义。 |
| 17 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:206-217 in-flight 分支返回 allowed:true 但同时附 409，semantic conflict | `done` | Root cause: 早期把“repeats请求已受理”误建模成 allowed，同时又附conflicts错误。 |
| 18 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:201 错误消息回显user idempotencyKey/method，response injection risk | `done` | Root cause: 错误文案直接拼接user输入，没有做回显最小化。 |
| 19 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:222-234 cached response JSON.parse has no size limit | `done` | Root cause: 幂等重放路径只校验 JSON 可解析，没有限制缓存体大小。 |
| 20 | src/platform/five-plane-interface/api/http-server/approval-routes.ts:73 user requestJson JSON.parse has no size limit | `done` | Root cause: 审批 requestJson 被视为可信内部字段，遗漏了大小上限防护。 |
| 21 | src/platform/five-plane-interface/api/http-server/dashboard-routes.ts:344 dashboard requestJson JSON.parse 同上 | `done` | Root cause:  dashboard 复用了同类“直接 parse requestJson”的模式，没有体积护栏。 |
| 22 | src/platform/five-plane-interface/api/http-server/utils.ts:339,344 游标 base64url 编解码has no try/catch、no integrity signature，can be tampered | `done` | Root cause: 通用游标最初只做了可逆编码，没有加签防篡改。 |
| 23 | src/platform/five-plane-interface/api/http-server/gateway-routes.ts:125 body 非字符串时 JSON.stringify 后转发，losing byte order causes signature validation failure | `done` | Root cause:  webhook 接收路由把“原始报文”vs“已解析对象”混用，默默重序列化了输入。 |
| 24 | src/platform/five-plane-interface/api/http-server/task-routes.ts:340,357 JSON.stringify(payload) persistence doesn't limit field order | `done` | Root cause: 持久化路径accesses along用普通 JSON.stringify，而不是稳定序列化。 |
| 25 | src/platform/five-plane-interface/webhook/index.ts:255 Buffer.from(normalizedSignature,"hex") accepts non-hex and truncates，length comparison masks pollution | `done` | Root cause: 签名前置校验缺失，defaults torelies on Buffer 的宽松 hex 解码lines为。 |
| 26 | src/platform/five-plane-interface/webhook/index.ts:60-61 重放缓存 TTL/容量都是 module constants，cannot be configured per tenant/endpoint | `done` | Root cause: 重放缓存参数最初按模块常量hardcoded，没有暴露到服务/endpoint 配置层。 |
| 27 | tests/integration/platform/interface/api/grpc-adapter-service-integration.test.ts:24,47,145,178,207,337 6 occurrences host:"0.0.0.0" listening on all NICs | `done` | Root cause: 集成测试偷懒复用了通配监听地址，而不是显式环回地址。 |
| 28 | api-server-env.ts 读 AA_API_KEYS_JSON vs文档 AA_API_KEYS inconsistent | `done` | Root cause: 环境加载器把结构化配置和兼容变量拆成两套名字，文档vs实现长期漂移。 |

## src/platform/five-plane-control-plane

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 29 | Control plane deeply accessesStatus-证据面 SQLite private paths（approval/config/incident-control 多occurrences） | `done` | Root cause: 控制面历史上直接穿透到Status-证据面的私有 SQLite 实现，缺少稳定的 truth 公共出口。 |
| 30 | Execution plane ~ 40 occurrences import 控制面 IAM/配置implementation details，not through contract/policy ports | `done` | Root cause: 执lines面长期复用控制面implementation details而非公共 index/contract 端口，导致跨 plane 边界泄漏。 |
| 31 | iam/field-encryption.ts:10,24 PBKDF2 only 100k iterations + synchronous pbkdf2Sync，below OWASP 600k and blocks event loop | `done` | Root cause: 字段加密曾把“口令派生”vs“运lines时加解密”绑putssynchronous路径里，导致强度和事件循环都受限。 |
| 32 | iam/session-management.ts:164-167 hashToken uses bare sha256(token)，file comment admits应用 HMAC | `done` | Root cause: 会话索references最初按普通摘要实现，缺少服务端持有的 keyed secret。 |
| 33 | tests/integration/platform/control-plane/config-center/config-rollout-service-integration.test.ts:317,332,355 Date.now()-90000000 comment"25h"actually 25h00m00s，equals TTL causing jitter | `done` | Root cause: 测试数据长期使uses bare毫秒字面量，可读性差，容易被误审为边界抖动。 |
| 34 | tests/integration/platform/control-plane/incident-control/doctor.test.ts:1096 delete process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION has no pre-capture | `done` | Root cause:  review 基于旧版本；当前测试已先捕获并puts finally 中恢复环境变量。 |
| 35 | src/platform/five-plane-control-plane/policy-center/index.ts:282 emergency mode requiresApproval=subjectType!=="system"，system principal bypasses break-glass approval | `done` | Root cause:  break-glass 逻辑错误地把 system principal 当成天然可信，遗漏统一审批门。 |
| 36 | src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:120-132 getFieldValue accesses along . path，doesn't reject __proto__/constructor/prototype | `done` | Root cause: 规则references擎只考虑业务字段导航，没有把原型链路径当作不可信输入occurrences理。 |
| 37 | src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:450 JSON.stringify(config, Object.keys(config).sort()) misuses replacer as key whitelist，nested fields get clipped | `done` | Root cause: 版本计算偷用了浅层 key 排序技巧，没有实现真正的递归稳定序列化。 |
| 38 | src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:451-457 32-bit non-cryptographic hash for config checksum，collision probability is significant | `done` | Root cause: 热重载版本号accesses along用了轻量字符串 hash，而不是面向配置完整性的强校验摘要。 |
| 39 | src/platform/five-plane-control-plane/iam/secret-management-service.ts:765-768 startDailyRotationSchedulers entry clears then adds，re-entry loses in-flight sweep | `done` | Root cause: 轮转调度器把“repeats启动”occurrences理成静默重建，破坏了已有调度句柄和运lines中的 sweep。 |
| 40 | src/platform/five-plane-control-plane/iam/secret-management-service.ts:770-776 runRotationSweep("initial") vs setInterval synchronous起，可能concurrent同一 sweep | `done` | Root cause:  review 把synchronous初始 sweep 误判成异步overlaps；现实现同时收口为单实例调度器，不再存putsconcurrent重启路径。 |
| 41 | src/platform/five-plane-control-plane/iam/aws-kms-http-secret-provider.ts:358-364 double base64 decode assumes KMS always returns base64 | `done` | Root cause: 实现把 KMS Plaintext 字段强lines套入本地密文存储编码假设，混淆了 provider 协议vs本地配置格式。 |
| 42 | src/platform/five-plane-control-plane/iam/gcp-secret-manager-http-secret-provider.ts:256 GCP secret return value not validated for base64 | `done` | Root cause:  provider defaults to信任云端 payload 编码，没有做严格 base64 校验vs失败分支。 |
| 43 | src/platform/five-plane-control-plane/incident-control/runbook-executor/runbook-executor.ts:192-198,258-266 runbook executor only simulates，production path not connected | `done` | Root cause:  runbook 执lines器最初只做演练占位，没有抽象出受控命令执lines边界；现已收口为注入式只读执lines器并对非只读命令 fail-closed。 |
| 44 | src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts 配置 hash only取 keys 顶层不递归 | `done` | Root cause: 配置版本函数只围绕顶层对象设计，没有为嵌套结构定义稳定递归遍历。 |
| 45 | src/platform/five-plane-control-plane/iam/field-encryption.ts:46 Buffer.from(value,"base64") decodes directly，doesn't reject纯 utf-8 输入 | `done` | Root cause: 密文 envelope 解析relies on Node 宽松 base64 解码lines为，没有做 round-trip 验证。 |
| 46 | src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:128 arbitrary string parts index into Function.prototype 等成员，false positive/negative matching | `done` | Root cause: 字段访问既没阻断危险片段，也没限定 own-property 访问边界。 |
| 47 | src/platform/five-plane-control-plane/iam/secret-management-service.ts:805-815 requireRegistryRecord error path details repeats secretRef not sanitized | `done` | Root cause: 存储错误直接复用了原始 secretRef 作为 message/details，未做最小披露。 |
| 48 | tests/unit/platform/control-plane/iam/sandbox-policy-extended.test.ts:66 /tmp/test-file-${Date.now()} goes outside sandbox-root test matrix | `done` | Root cause: 测试曾relies on宿主 `/tmp` 语义，绕开了仓库内受控临时工作区。 |
| 49 | startup-env-schema.ts:376 JWT secret undefined goes to default-allow，缺secret仍可签发 | `done` | Root cause:  review 基于旧校验逻辑；当前 schema 已puts配置 API key 认证时强制要求 JWT secret。 |
| 50 | api-client.ts Retry-After directly parseInt，doesn't recognize HTTP-date | `done` | Root cause: 旧实现只支持 delta-seconds；当前解析函数已补齐 HTTP-date 分支。 |
| 51 | test:secret-providers path is wrong（少一层 platform/） | `done` | Root cause: 脚本路径puts测试目录迁移后未synchronous；当前 package.json 已指向现lines integration 路径。 |
| 52 | auto-stop-loss-service.ts:789、config-hot-reload-service.ts:268,506、cache-invalidation-broadcast.ts:68、durable-event-bus.ts:710,916,1007、call-governance.ts:609、external-secret-provider.ts:226 多occurrences void promise fire-and-forget without .catch | `done` | Root cause: 多个基础设施模块把“后台任务”当成可忽略细节，遗漏 rejection 观测vs清理。 |
| 53 | aws-kms-http-secret-provider.ts:211、gcp-secret-manager-http-secret-provider.ts:103、vault-http-secret-provider.ts:132 setTimeout(...controller.abort) not .unref() and some success paths miss clearTimeout | `done` | Root cause:  provider timeout 辅助逻辑按最小可用实现编写，忽略了进程退出阻塞和定时器治理。 |
| 54 | secret-management-service.ts:765-768 startDailyRotationSchedulers silently clear existing schedulers，external handles invalidated | `done` | Root cause: 调度器生命周期没有区分“首iterations启动”和“repeats调用”，导致静默替换已有 handle。 |
| 55 | client-sdk/api-client.ts:188 (result as { totalCount?: number }).totalCount = totalCount rewrites readonly field via cast | `done` | Root cause: 分页响应为了兼容可选字段，走了类型断言回写而不是重新构造对象。 |
| 56 | client-sdk/api-client.ts:368 connect() puts SSE bootstrap occurrences fire-and-forget，初始 fetch rejection 未occurrences理 | `done` | Root cause:  review 基于旧理解；当前 connect 内部已兜住连接异常并走重连分支，启动occurrencesonly保留显式 void 调用。 |

## src/platform/five-plane-orchestration

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 57 | src/platform/agent-delegation/index.ts vs five-plane-orchestration/agent-delegation/* form dual entry points | `done` | Root cause: 早期为补目录结构审计而保留了 legacy facade，后续测试vs结构断言继续消费它，导致 public surface 没有及时收口到 five-plane-orchestration canonical 入口。 |
| 58 | config/quality/test-exclusion-allowlist.json 列 tests/integration/platform/orchestration/**（已重命名为 five-plane-orchestration），never matches | `done` | Root cause: 目录重命名后 allowlist 只保留了旧路径，没有跟着 canonical 布局更新。 |
| 59 | oapeflir/runtime-execute-bridge.ts:223-235 when executor is null synthesizes fake succeeded + validationPassed:true，stub silently returns | `done` | Root cause:  bridge 为了便于早期联调defaults to返回假成功结果，掩盖真实执lines器缺失。 |
| 60 | oapeflir/runtime-execute-bridge.ts:182 defaultModelId="MiniMax-M2.7" hardcodes specific vendor model into framework code | `done` | Root cause: 框架defaults to值直接继承了某iterations联调模型，而不是抽象为 vendor-neutral defaults to。 |
| 61 | oapeflir/runtime-execute-bridge.ts:194,264,316 createdAt: Date.now() numeric vs Plan.createdAt: string type drift，only靠 as Plan cast | `done` | Root cause:  review 基于旧 DTO 认知；当前 Plan.createdAt 仍是毫秒时间戳，已改为统一 ISO->ms 归一生成。 |
| 62 | oapeflir/handoff-model.ts:55-57 Math.ceil(JSON.stringify(value).length/4) token estimation distorted for CJK/multi-byte | `done` | Root cause:  handoff 压缩只按 ASCII 文本via验估算 token，忽略 UTF-8 多字节差异。 |
| 63 | oapeflir/handoff-model.ts:88-135 compression silently drops historyRefs/toolCallRecords/planDelta/blockers/artifactRefs，no drop ledger | `done` | Root cause:  handoff compaction 只关注降体积，没有为被裁剪字段保留审计痕迹。 |
| 64 | oapeflir/oapeflir-loop-core.ts:382、oapeflir-loop-support.ts:324、stage-transition-fsm.ts:189-223 多occurrences Date.now() self-generated timestamps，clock rollback makes non-monotonic | `done` | Root cause:  OAPEFLIR 内部事件时间最初直接取 wall clock，没有抽象成单调递增时间源。 |
| 65 | oapeflir/oapeflir-loop-core.ts:299 把 process.{version,platform,cwd()} writes environmentContext for evidence，leaks host fingerprint | `done` | Root cause:  fallback observation 为了调试便利直接采集宿主上下文，缺少证据最小披露约束。 |
| 66 | docs_zh/contracts/oapeflir_loop_contract.md exists but README doesn't list；ADR-016 references用 OAPEFLIR also doesn't link | `done` | Root cause:  contract/ADR 文档新增后，README vs关联 ADR 没有synchronous补全references用链。 |
| 67 | scripts/ci/mutation-critical-tests.sh:13 references tests/unit/platform/orchestration/oapeflir/... 而权威路径为 five-plane-orchestration，silent zero coverage after rename | `done` | Root cause: 测试目录重命名后，mutation 关键脚本仍references用旧路径。 |
| 68 | src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:275 super("mock://runtime","local-simulatesd") defaults to mock runtime | `done` | Root cause:  Mock bridge 直接把 mock runtime URI/modelId 烙进defaults to父类构造，模糊了真实 bridge vs测试替身边界。 |
| 69 | scripts/ci/audit-oapeflir-terminology.mjs only扫八字母拼写，misses Chinese terminology drift | `done` | Root cause: 术语审计脚本只校验英文阶段词序，没有把中文 canonical 术语纳入检查。 |

## src/platform/five-plane-execution

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 70 | plugin-executor.service.ts:482 explicitly throws action_not_implemented，missing hook 500 | `done` | Root cause: 插件执lines器把未实现 hook 当异常路径抛出，而不是回落为结构化 rejected 结果。 |
| 71 | five-plane-execution/state-transition/* via core/runtime/index.ts re-exported goes out of bounds | `done` | Root cause:  core/runtime 为兼容旧调用方继续转发执lines面Status迁移实现，造成跨层公共面继续膨胀。 |
| 72 | tests/unit/runtime/、platform/execution/、platform/five-plane-execution/ 平linesrepeats | `done` | Root cause: 执lines面多轮目录重命名后同时保留了 runtime、platform/execution、five-plane-execution 三套测试树；本批已删除repeats旧树、迁移兼容覆盖，并新增repeats路径审计测试防回归。 |
| 73 | plugin-executor.service.ts:106 enforceSignatures defaults to false，env 未设时unsafe fail-open | `done` | Root cause: 插件签名校验最初以联调便利为先，defaults to走 fail-open，安全defaults to值没有收紧到外部插件场景。 |
| 74 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:55-90 SELECT/DELETE/INSERT not in transaction，TTL expiry cleanup TOCTOU；concurrent夺锁可误删刚获取者 | `done` | Root cause:  SQLite 锁适配器早期按逐句脚本拼接实现，没有把过期清理vs夺锁收进单事务临界区。 |
| 75 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:34-37 distributed_lock_fencing_tokens only INSERT 自增、never cleaned，unbounded growth | `done` | Root cause:  fencing token 设计成 append-only 计数表，却没有synchronous规划压缩vs有界存储策略。 |
| 76 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:54 ttlMs lacks lower bound validation，负值/0 直接writes | `done` | Root cause: 锁 TTL 只做上限裁剪，没有建立最小有效租期约束。 |
| 77 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:135-148 forceSteal has no pre-authorization/reason whitelist，any caller can steal lock | `done` | Root cause:  force-steal 被当成内部运维捷径暴露，实现里缺少显式授权理由边界。 |
| 78 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:140 forceSteal hardcodes ttlMs=30000 而非accesses along用原锁配置 | `done` | Root cause: 强夺锁路径从示例实现演化而来，把 TTL 常量hardcodedputs分支里，没有复用锁配置策略。 |
| 79 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:107-112 release owner mismatch silently returns false no audit event | `done` | Root cause: 释放失败长期只按布尔结果建模，没有把 owner 不匹配视为需要审计的异常争抢事件。 |
| 80 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:549-573 dequeueAsync has multiple await without atomicity，two workers can simultaneously take same jobId | `done` | Root cause:  Redis 队列最初以多条命令串联实现 claim 流程，没有用单脚本保证取号vsStatus切换原子化。 |
| 81 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:569 Status确认前 hincrby attempts，Status重置导致计数错位 | `done` | Root cause:  attempts budgetputs claim 成功前就被前置递增，计数语义vs真实生命周期脱节。 |
| 82 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:566-568 Status非 waiting 即 zrem 返回 null silently drops task | `done` | Root cause: 旧 dequeue 把竞争失败和任务异常Status混成同一路径，缺少显式恢复或重排分支。 |
| 83 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:592-596 only ack 路径 expire task key，nack/失败任务have no TTL key accumulation | `done` | Root cause: 任务保留策略只覆盖成功消费路径，没有为 nack、dead-letter 和失败态定义统一 TTL 回收。 |
| 84 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:605-609 nack requeue without backoff，immediately re-pulled by same worker | `done` | Root cause:  nack 实现只追求“尽快重试”，没有references入最小退避窗口避免热循环。 |
| 85 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:664-672 retryJobAsync forcibly sets attempts=0 bypassing maxAttempts budget | `done` | Root cause: 人工重试路径被当成full重置，破坏了 attempts budgetvs死信策略的一致性。 |
| 86 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:600 nack 闭包references用陈旧 jobData.priority | `done` | Root cause:  nack 逻辑闭包复用了旧快照，任务重新入队时没有重新读取权威优先级。 |
| 87 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:675-695 purgeAsync 对每条 ID individual hgetall N+1 RTT | `done` | Root cause:  purge 流程先按逐条读取实现可读性，没有批occurrences理设计，导致高延迟下出现明显 N+1 往返。 |
| 88 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:308-317 先 arrayBuffer() full读再判大小，oversized response can OOM | `done` | Root cause: 外部访问沙箱先追求 fetch API 使用简洁性，未把响应流大小守卫前置到流式读取阶段。 |
| 89 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:323-324 JSON.parse has no try/catch，malicious JSON throws directly | `done` | Root cause:  JSON 响应被假定为可信结构，缺少解析失败隔离和结构化错误转换。 |
| 90 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:296-298 Content-Type case-sensitive comparison，调用方 Content-type double writes header | `done` | Root cause:  HTTP header 归一化约定没有落实到沙箱适配层，大小写兼容性relies on调用方自觉。 |
| 91 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:672-678 simulatesStepExecution only setTimeout 50ms，doesn't actually execute any action | `done` | Root cause: 子工作流执lines器最初只有占位延时器，没有抽象出可注入的 step execution 边界。 |
| 92 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:729-733 simulatesRollback is no-op，rollback always succeeds | `done` | Root cause:  rollback 被当成演示路径保留成空实现，没有真正的回滚执lines器和失败分支。 |
| 93 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:665-669 findStepDefinition iterates all executions O(N·M) | `done` | Root cause:  step definition 没有挂puts execution 本地索references上，运lines期只能globally反查。 |
| 94 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:642 step.output hardcoded "Step X completed successfully" overwrites real output | `done` | Root cause: defaults to happy-path 直接回填模板化输出，而不是消费 step executor 的真实结果。 |
| 95 | src/platform/five-plane-execution/compensation-manager.ts:312-319 reverseExternalEffect directly return true，external side effects not reversed | `done` | Root cause: 补偿管理器只实现了Status机骨架，没有把反向外部副作用抽象成可执lines适配器。 |
| 96 | src/platform/five-plane-execution/compensation-manager.ts:326-333 executeCompensateAction stub always succeeds | `done` | Root cause:  compensate action 一直停留puts stub，缺少基于 step/context 的执lines判定。 |
| 97 | src/platform/five-plane-execution/compensation-manager.ts:339-344 sendCompensationNotification empty body，notification never sent | `done` | Root cause: 通知步骤没有独立 adapter，旧实现把 notify 当成永远成功的旁路。 |
| 98 | src/platform/five-plane-execution/compensation-manager.ts:350-358 executeRollback stub，rollback contract not implemented | `done` | Root cause:  rollback step 没有消费 rollback plan / targetRef，只保留了示例函数壳。 |
| 99 | src/platform/five-plane-execution/execution-engine/phase1a-happy-path.ts:1-6 only re-export，按 AGENTS should be completely removed | `done` | Root cause: 执linesreferences擎重命名后继续保留 phase1a 兼容壳，旧命名未及时从源码面移除。 |
| 100 | src/platform/five-plane-execution/execution-engine/phase1b-orchestration.ts:1-31 compatibility file maintains redundant naming | `done` | Root cause:  multi-step 编排收口后仍残留 phase1b 别名文件，公共面没有完全切换到规范命名。 |
| 101 | src/platform/five-plane-execution/execution-engine/phase1b-tool-definitions.ts & phase1b-utils.ts phase1b compatibility remnants | `done` | Root cause:  phase1b 配套工具定义vs工具函数accesses along用旧别名继续转发，导致同一能力维持双文件表述。 |
| 102 | src/platform/five-plane-execution/recovery/runtime-recovery-service.ts vs runtime-recovery-service-root.ts 等四对 *-service/*-service-root 双胞胎 | `done` | Root cause:  recovery 模块迁移时为兼容旧入口保留了 root 别名文件，源码层形成事实双实现分支。 |
| 103 | src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts 581 linessingle file violates AGENTS small modules principle | `done` | Root cause: 多步编排最初把计划解析、bootstrap、HarnessRun 持久化和终态收尾都堆puts入口文件；现已拆成 `plan/bootstrap/finalize` 支持模块，入口收敛为 202 lines协调器。 |
| 104 | src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts 814 lines同上 | `done` | Root cause:  supervisor 长期把断点occurrences理、失败分支、成功提交和主循环混puts一个文件；现已拆成 `breakpoint/failure/success` 三个支持模块，主循环收敛为 358 lines。 |
| 105 | src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:47 uses CJS backwards in ESM require | `done` | Root cause: 异步封装层曾为复用synchronous服务偷用了 require 加载同胞模块，没有保持 ESM 静态relies on图。 |
| 106 | src/platform/five-plane-execution/distributed-lock/locking-support.ts:12 require("postgres") synchronous加载，optional dependency coupling | `done` | Root cause: 分布式锁支持层曾把后端relies onas运lines时 require 分支，relies on关系既不透明也不利于静态分析。 |
| 107 | src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:67-68 at construction time createRequire+require("ioredis")，missing dependency crashes startup | `done` | Root cause:  Redis 锁适配器延续了 createRequire 风格的dynamically装配，relies on加载失败只能putsat construction time爆炸。 |
| 108 | src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:167,226 lock id 用 Date.now() 拼字符串，millisecond-level conflicts can reuse | `done` | Root cause: 锁 ID 早期只拼接时间戳和业务字段，未references入真正的globally唯一熵源。 |
| 109 | src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:25-47 createRequire 后dynamically require 同胞 .js，module graph cannot be statically analyzed | `done` | Root cause:  async facade 曾试图puts运lines时回拉同目录实现，导致模块图对工具链不可见。 |
| 110 | src/platform/five-plane-execution/distributed-lock/distributed-lock-manager.ts 9 lines dead shim | `done` | Root cause: 分布式锁目录重整后保留了 legacy manager 薄壳，调用方迟迟未被收口到单一公共面。 |
| 111 | src/platform/five-plane-execution/distributed-lock/distributed-lock-service.ts 10 lines dead shim | `done` | Root cause:  service 文件起初只是转发壳，没有承担真实公共入口职责，导致 manager/service 概念repeats。 |
| 112 | src/platform/five-plane-execution/distributed-lock/distributed-lock-factory.ts 21 lineslightweight wrapper overlaps with manager/service overlaps | `done` | Root cause:  lock adapter 创建逻辑被拆散到多个轻量包装层，历史兼容文件越积越多。 |
| 113 | src/platform/five-plane-execution/execution-engine/runtime-context.ts 1 lines shim | `done` | Root cause:  runtime context puts目录迁移后保留了一层空壳转发，未及时让调用方转向 shared/context canonical 路径。 |
| 114 | src/platform/five-plane-execution/execution-engine/single-task-execution.ts 7 lines re-export shim | `done` | Root cause:  single-task happy path 重命名后继续维持旧文件名 re-export，源码面产生冗余入口。 |
| 115 | src/platform/five-plane-execution/distributed-lock/index.ts 1 lines barrel | `done` | Root cause: 目录级 barrel puts公共面已via收口后仍继续暴露历史路径，放大了导入分叉。 |
| 116 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:560-562 取最高 score（最新）violates FIFO intuitiondocumentation doesn't explain | `done` | Root cause:  waiting 队列的 claim 路径把 Redis `ZRANGE` 结果反向遍历，实际消费顺序悄悄退化成了“最新优先”。 |
| 117 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:686-693 checkpoint state 直接references用原 entries 数组，subsequent mutate pollutes historical checkpoint | `done` | Root cause:  checkpoint 记录直接复用内存态对象references用，没有做快照级深拷贝。 |
| 118 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:706-713 performRollback puts rollbackHistory when empty marks all rolled_back，doesn't distinguish未执lines步骤 | `done` | Root cause: 空 rollback history 被误当成“所有步骤都可回滚”，Status机没有区分未执linesvs已回滚。 |
| 119 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:286-288 AbortController.unref makes timeout not block exit，but after abort await cleanup not calledraces with ESM top-level | `done` | Root cause: 旧 review 停留putsexceeds时清理前的实现；当前请求路径已via把 timeout 放进 `finally` 清理，Issue本质是 timeout 生命周期治理曾未被显式建模。 |
| 120 | src/platform/five-plane-execution/recovery/runtime-recovery-service-root.ts vs runtime-recovery-service.ts only import 路径vs少量变量名不同，constitute actual branch | `done` | Root cause:  recovery 服务迁移过程中保留了 root 版本别名源码，最终形成只差路径vs变量名的事实分支。 |
| 121 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:60,87,119-121 Math.min(ttlMs,MAX_LOCK_TTL_MS) 三occurrencesrepeats，常量 600_000ms hardcodes | `done` | Root cause:  TTL 裁剪规则分散复制puts多个分支里，没有抽成统一的租期归一化函数。 |
| 122 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:115-127 extend 用 MIN(ttl_ms+?, MAX) cumulative instead of reset from now，TTL always slides toward upper limit | `done` | Root cause:  extend 语义最初按“累加剩余 TTL”实现，而不是按“自当前时刻重新租约”建模。 |
| 123 | pg-advisory-lock-adapter.ts has no try/finally after acquiring lock，throw path leaks lock | `done` | Root cause:  advisory lock acquire 只考虑 happy-path，把“取锁成功后本地记账失败”的清理路径遗漏puts会话锁之外。 |
| 124 | pg-advisory-lock-adapter.ts:34-43 custom FNV-1a truncated to 63 位，collisions silently accepted | `done` | Root cause:  PG advisory key 生成直接accesses along用了轻量示例哈希，而不是使用更稳定的加密散列映射。 |
| 125 | pg-advisory-lock-adapter.ts:71-83 extend() only改内存 map，doesn't refresh PG side advisory lock TTL | `done` | Root cause:  review 把 PG advisory lock 套进了租约型 TTL 心智模型；PG 端本身没有服务器 TTL，旧实现缺的是对“only刷新客户端 lease 元数据”语义的明确约束。 |
| 126 | pg-advisory-lock-adapter.ts:107-115 catch-all maskstransient PG 错误as "lock taken" | `done` | Root cause: 适配器把所有驱动异常都折叠成 acquire=false，抹平了“锁已被占用”和“后端暂时不可用”的错误边界。 |
| 127 | pg-advisory-lock-adapter.ts:101 Number(result.fencing_token) exceeds 2^53 precision loss | `done` | Root cause:  fencing token 从数据库 bigint 回读后直接强转成 JS number，没有先做安全范围校验。 |

## src/platform/five-plane-state-evidence

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 128 | CLAUDE.md:50 references用non-existent state-evidence/artifacts/ 目录 | `done` | Root cause:  review 基于旧目录快照；当前 artifacts 模块已恢复为真实目录，原Issue过期。 |
| 129 | Multiple contracts/reviews point to non-existent state-evidence/artifacts/ 目录 | `done` | Root cause: 若干 review/contract 结论停留puts artifacts 缺失时期，没有跟随后续模块恢复而回写。 |
| 130 | runtime-truth-repository.ts:741、projection-rebuild-service.ts:429、memory-gateway/index.ts:248、plan-builder.ts:193 use non-normalized JSON.stringify for fingerprinting，key order changes cause false diff | `done` | Root cause: 多个平面each手写指纹逻辑，accesses along用了普通 JSON.stringify 而没有收口到稳定序列化工具。 |
| 131 | tests/integration/platform/state-evidence/memory/memory-layer-model-integration.test.ts:261 用 Date.now()-90000 for aging assertion，clock drift causes jitter | `done` | Root cause: 时间敏感测试长期直接relies on wall-clock 差值，没有固定基准时间。 |
| 132 | tests/integration/platform/state-evidence/events/durable-event-bus.integration.test.ts vs durable-event-bus-integration.test.ts 命名inconsistent疑似双跑 | `done` | Root cause:  durable-event-bus 集成测试扩写时accesses along用了两套文件命名习惯，导致“基础流”和“重放排序流”边界只体现puts文件内容，不体现puts文件名。 |
| 133 | package.json:223-234 test:receipt-store/tool-gateway/memory-gateway/sandbox-provider have no aggregator，only操作员入口 | `done` | Root cause: 几个底层入口测试被拆成独立脚本后，没有补上面向 CI/批量验证的聚合命令。 |
| 134 | five-plane-state-evidence/index.ts:1 re-export non-existent ./artifacts/index.js，import throws immediately | `done` | Root cause:  review 基于 artifacts 目录缺失时的旧快照；当前 `artifacts/index.ts` 已存puts且对外导出通过。 |
| 135 | truth/sqlite/repositories/operations-repository.ts:898 listRuntimeRecoveryRecords directly concatenates caller whereClause directly concatenated into SQL，only过滤 ;\\|--\\|/* still allows OR 1=1/子查询 | `done` | Root cause:  runtime recovery 查询为了复用多种筛选场景，暴露了自由 SQL 片段接口，却没有收口到受控谓词白名单。 |
| 136 | truth/sqlite/repositories/event-repository.ts:788-828 insertEvent vs outbox INSERT double prepared without unified transaction，breaks outbox atomicity | `done` | Root cause:  Tier-1 Status事件路径把 event append vs outbox append 分成了两个独立语句，缺少同一事务或 savepoint 边界。 |
| 137 | truth/sqlite/repositories/task-repository.ts:96-125 listTasks cursor only按 updated_at，no id tiebreaker，分页可丢lines/死循环 | `done` | Root cause: 任务列表分页游标只保留了时间戳，没有把稳定主键一起编码成复合 cursor。 |
| 138 | truth/sqlite/repositories/tenant-repository.ts:203-204 listAll 用 [...Map.values()].slice no稳定排序，cross-page results resort | `done` | Root cause: 内存租户仓储直接对 `Map.values()` 切片，defaults to迭代顺序被误当成分页顺序。 |
| 139 | truth/sqlite/repositories/release-repository.ts:611,632,654 listEnterprise* only limit=20，no cursor/offset/tenant 过滤 | `done` | Root cause: 企业发布类报表最初只按“最新 N 条”运营视图落地，没有synchronous抽象出稳定分页和租户维度约束。 |
| 140 | truth/sqlite/repositories/intelligence-repository.ts:350 listIntelBriefs(limit=20) no cursor silently truncated | `done` | Root cause: 情报简报列表长期只服务最近简报面板，缺少稳定游标分页能力。 |
| 141 | truth/sqlite/repositories/organization-repository.ts:273 listOrganizationRecords(limit=50) no租户过滤，cross-tenant leak | `done` | Root cause: 组织列表defaults to站puts平台运营视角实现，遗漏了租户视角下的组织可见性约束。 |
| 142 | truth/sqlite/repositories/worker-repository.ts:63 vs worker-snapshot-repository.ts:276 listCoordinatorInstanceSnapshots dual implementation schema drift | `done` | Root cause:  review 基于旧结构快照；当前 `WorkerRepository` 已完全委托给 `WorkerSnapshotRepository`，真实双实现已收口。 |
| 143 | state-evidence/dlq/index.ts:110-113 enqueue uses linear listByConsumer for deduplication，O(n) per insert，no索references | `done` | Root cause: 基础 DLQ 仓储接口只暴露了按 consumer 扫描，for deduplication键 `sourceEventId+consumerId` 没有单独查询面也没有持久层索references。 |
| 144 | state-evidence/dlq/index.ts:282-284 runDueRetries empty catch {} 吞错no logger/telemetry/退避 | `done` | Root cause:  DLQ retry worker 只统计 failed 计数，没有把失败上下文发到结构化日志或遥测面。 |
| 145 | state-evidence/dlq/index.ts:99 maxRetries=5 hardcodes，vs dlq-service.ts retry policy conflicts | `done` | Root cause: 基础 DLQ vs扩展 DLQ each维护defaults to重试常量，没有抽成单一策略源。 |
| 146 | state-evidence/dlq/index.ts:6-23 DeadLetterRecord vs contracts/types/domain/session-types.ts EventDeadLetterRecord schema dual sources | `done` | Root cause: 基础 DLQ 记录独立重写了事件死信字段名和字段类型，没有复用领域合同里的事件死信字段定义。 |
| 147 | state-evidence/incident/index.ts:127-161 listIncidents/listIncidentsPaginated full Map.values() + sort + findIndex，concurrent插入下 cursor 失效 | `done` | Root cause:  incident 分页游标最初只传 incidentId，没有把排序基准一起编码到 cursor。 |
| 148 | state-evidence/incident/index.ts:35 linkedEvidenceRefs: input.linkedEvidenceRefs ?? [] 直接存 caller references用，external mutation pollutes internal | `done` | Root cause:  incident open 路径直接复用了调用方数组references用，没有做边界拷贝。 |
| 149 | state-evidence/incident/index.ts:117-121 resolve() accepts任意当前Status，bypassing triaged→mitigating→reviewed→resolved FSM | `done` | Root cause:  incident FSM puts resolve 边上缺少Status守卫，只校验了存puts性。 |
| 150 | state-evidence/incident/index.ts:22 nextIncidentOrder 单调 ID 公开预测can enumerate | `done` | Root cause: 排序 tie-breaker relies on递增序号，导致内部顺序键既可预测又和分页游标强耦合。 |
| 151 | state-evidence/audit/index.ts:21,29 AuditTrailService.records 内存数组no轮换/持久化，long-running process will OOM | `done` | Root cause: 审计轨迹服务按进程内数组起步，没有任何容量上限或回收策略。 |
| 152 | projections/projection-rebuild-service.ts:265-266,278-294 JSON.stringify comparison non-normalized key order；cutover no乐观concurrent token | `done` | Root cause:  projection compare/cutover 起初只面向单线程本地重建，没有把稳定序列化和 cutover 版本校验一起建成显式协议。 |
| 153 | checkpoints/checkpoint-envelope.ts:226 Buffer.from(payload,"base64") doesn't throw，malicious payload silently truncated then into gunzip | `done` | Root cause:  envelope 解包defaults to信任 Node 的宽松 base64 解码lines为，没有先校验编码完整性。 |
| 154 | checkpoints/checkpoint-envelope.ts:147-149 JSON.stringify 大对象先full物化再判 size，OOM before guard | `done` | Root cause:  checkpoint size guard 放puts序列化之后，没有预估 JSON 体积的前置护栏。 |
| 155 | checkpoints/checkpoint-gc-service.ts:548-560 acquireRunLock doesn't record PID/host，崩溃残留锁vs活锁不可区分 | `done` | Root cause:  checkpoint GC 锁文件只记录 acquiredAt，缺少进程/主机身份元数据。 |
| 156 | knowledge/keyword-index.ts:22-30 upsert 不清除前一iterations keywords 反向索references，stale postings remain | `done` | Root cause:  keyword index 的 upsert 只有新增路径，没有先撤销旧倒排项。 |
| 157 | knowledge/keyword-index.ts:32-47 query 每iterations重扫 countOccurrences no缓存 | `done` | Root cause: 关键词命中分数完全puts query 时现算，没有把 chunk-keyword 统计缓存起来。 |
| 158 | knowledge/keyword-index.ts:1-53 缺 delete(chunkId) API，chunks live forever | `done` | Root cause:  keyword index 只设计了 upsert/reset 两端，没有单条删除语义。 |
| 159 | memory-gateway/index.ts:248-258 projectionHash 用 JSON.stringify([...input.memoryIds]) preserving caller order，same set different order produces different hash | `done` | Root cause:  projection hash 直接序列化调用方数组，没有先做for deduplication排序归一化。 |
| 160 | memory-gateway/index.ts:280-298 内存层映射 L1/L2/L4/L6 round-trip lossy，not asserted | `done` | Root cause:  managed layer 到 runtime layer 的压缩映射没有保存 canonical layer 元数据，回读时只能退化恢复。 |
| 161 | memory-gateway/index.ts:328 Number.isFinite(Number(metadata.version)) accepts 1e308，missing integer/range validation | `done` | Root cause:  memory version 解析只做了“可转 number”判断，没有整数vs上界约束。 |
| 162 | state-evidence/memory/trust-level-service.ts:245-248 MAX=500/TTL=24h/EVICT=60s hardcodesno config | `done` | Root cause:  trust-level service 最初按进程内defaults to值起步，把容量、TTL、驱逐周期都hardcodedputs类里。 |
| 163 | state-evidence/memory/trust-level-service.ts:280-289 每iterations驱逐 [...entries].sort O(n log n)，includes non-null assertion swallowing OOB | `done` | Root cause: exceeds容量驱逐直接走full排序，既不必要也把空洞情况交给非空断言兜底。 |
| 164 | state-evidence/memory/trust-level-service.ts:384-385 includes("TODO"/"FIXME") literal string filtering，normal text falsely flagged | `done` | Root cause: 内容质量检查把 TODO/FIXME 当普通子串匹配，没有限定为显式占位标记。 |
| 165 | truth/sqlite/repositories/prompt-bundle-repository.ts:164-332 8 occurrences JSON.stringify(input.*) 列writesno zod 校验 | `done` | Root cause:  prompt bundle 仓储把 JSON 列当成“存前直接 stringify”的薄包装，没有把 schema 校验放puts持久化边界。 |
| 166 | truth/sqlite/repositories/billing-repository.ts:168 Number(result.changes) BigInt > 2^53 silently truncated | `done` | Root cause:  SQLite `run().changes` 被当成普通 number 使用，没有统一的 bigint 安全边界转换。 |
| 167 | truth/sqlite/repositories/worker-snapshot-repository.ts:249 same query switches by filter ORDER BY，cursor across filter invalidates | `done` | Root cause:  review 停留puts旧分页假设；当前仓储没有对该列表暴露 cursor 协议，真实风险是排序语义未明确，而不是“cursor 跨 filter”。 |
| 168 | state-evidence/events/event-ops-service.ts:216-221 setTimeout(...) reject timer not unref；Promise.race winner doesn't clearTimeout | `done` | Root cause:  review 停留puts旧实现；当前 timeout helper 已同时 `unref()` 并puts `finally` 中 `clearTimeout()`。 |
| 169 | state-evidence/events/durable-event-bus.ts:9 different instantiation points retentionLimit:500/100 inconsistent | `done` | Root cause: 旧 review 把不同模块 logger 的 retention 配置混写成 durable-event-bus 自身Issue；现lines bus logger 已独立收口。 |
| 170 | tests/integration/platform/state-evidence/events/transactional-event-appender vs event-repository.ts:788-828 outbox split two prepared calls，SQLite WAL autocommit 下观察方可见部分Status | `done` | Root cause:  Tier-1 事件特殊路径绕开了统一的 transactional appender，把 event/outbox 原子性要求重新降回了双语句 autocommit。 |
| 171 | tests/integration/platform/state-evidence/checkpoints/checkpoint-envelope.ts:178 createdAt:new Date().toISOString() uses local clock，different TZ replay metadata non-deterministic | `done` | Root cause:  review references用的旧测试位置已via过期；当前 checkpoint envelope 测试使用固定时间戳样本，不再relies on本地时钟。 |
| 172 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:138 PRAGMA journal_mode=WAL doesn't assert return value，NFS etc silently falls back to delete | `done` | Root cause:  SQLite 初始化流程此前只“请求 WAL”不“确认 WAL”，把后端实际 journal mode 是否退化留给运lines时偶发故障暴露。 |
| 173 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:134 busy_timeout allows 0，transient SQLITE_BUSY vsconcurrentconflicts | `done` | Root cause:  busy timeout 配置只做了数值截断，没有建立最小正整数约束。 |
| 174 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283 Object.values(row) relies on wal_checkpoint column order，missing key-name destructuring | `done` | Root cause:  WAL checkpoint 结果读取图省事直接拿对象值数组，没有固定绑定 SQLite 返回列名。 |
| 175 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:347-350 close() doesn't check wal_checkpoint busy>0，unpersisted frame closed | `done` | Root cause:  close 只做 best-effort checkpoint，没有把 busy 或未完全 checkpoint 视为显式关闭失败。 |
| 176 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:442-449 via regex database is locked\\|busy 识别 BUSY，localization/errno change invalidates | `done` | Root cause:  SQLite 写争用识别长期只relies on message 文本匹配，没有优先消费 sqlite/errno 级别的错误标识。 |
| 177 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-340 healthCheck 标 async 实onlysynchronous事务，misleads caller | `done` | Root cause:  SQLite health probe 复制了异步后端接口签名，但内部实际一直走synchronous连接vssynchronous事务。 |
| 178 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:455-465 applyCompatibleColumnMigrationIfKnown hits skips migration.sql，索references/约束变更悄然丢 | `done` | Root cause: 兼容迁移路径之前缺少显式回归验证，容易让人误以为“补列”分支不会补齐其余 DDL；现已补 migration 11 的回归测试，确认兼容分支仍会创建补充表/索references，不再让这类担忧occurrences于no证据Status。 |
| 179 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:108,233 fetch no AbortController/exceeds时 | `done` | Root cause:  review 基于旧版本；当前 provider 统一via `fetchWithTimeout()`，已接入 AbortController vsexceeds时清理。 |
| 180 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:121-126,246-251 error body directly concatenated into Error message，potential log injection | `done` | Root cause:  provider error path直接拼接上游响应体，没有做换lines/长度收敛。 |
| 181 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:137,259+ response.json() has no try/catch | `done` | Root cause:  embedding provider defaults to信任上游 JSON 结构，没有隔离解析失败。 |
| 182 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:142-144 return index 范围/repeats，post-order mapping assumes one-to-one | `done` | Root cause: 排序恢复结果时defaults to信任 provider index 完整且norepeats，没有做边界校验。 |
| 183 | src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts:226 Buffer.from(payload,"base64") doesn't validate length/MIME，corrupted payload decodes to empty buffer without error | `done` | Root cause:  checkpoint payload 解码只relies on Buffer 宽松lines为，没有做 base64 长度vs字符集约束。 |
| 184 | src/platform/five-plane-state-evidence/memory/trust-level-service.ts:384-385 用 content.includes("TODO/FIXME") as trust level downgrade basis，obvious false positive | `done` | Root cause: 质量检查把 TODO/FIXME 视作任意子串，而不是显式占位标记。 |
| 185 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-330 healthCheck inside transaction CREATE/DROP TEMP TABLE，rollback leaves TEMP handle | `done` | Root cause:  health probe 早期用临时表写删来证明可写，副作用验证压过了连接探活本身。 |
| 186 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283-290 checkpointWal doesn't distinguish busy>0 vs frames=0，运维no法识真实瓶颈 | `done` | Root cause:  checkpoint 返回值之前被按位置数组粗读，busy、log frames、checkpointed frames 没被稳定区分为独立信号。 |
| 187 | tests/integration/platform/state-evidence/dlq-persistence.test.ts:464 /tmp/dlq-persistence-test-${Date.now()}.db not portable to Windows and not cleaned in finally | `done` | Root cause: 文件型持久化测试最初按本机 `/tmp` 快速起草，没有复用测试层统一的临时工作区vs清理约束。 |
| 188 | tests/unit/platform/state-evidence/knowledge/knowledge-store.test.ts:17 /tmp/aa-sandbox/ktest_${suffix}_${Date.now()} concentrated pollution | `done` | Root cause: 知识快照测试把 Unix 临时目录常量hardcodedputs helper 里，缺少基于 `tmpdir()` 的平台no关拼接。 |
| 189 | tests/unit/platform/state-evidence/knowledge/p2-defects-sys-sec-4-2.test.ts:63,113 两occurrences /tmp/aa-sandbox/... not cleaned | `done` | Root cause: 安全回归测试只关注路径允许/拒绝语义，没有把产物生命周期纳入测试治理。 |
| 190 | tests/leaks/platform/state-evidence/events/durable-event-bus.leak.test.ts threshold 10MB same issue and RSS/heapUsed | `done` | Root cause: 泄漏测试最初只盯 heapUsed，没把 RSS vsno `--expose-gc` 运lines环境分开建模。 |
| 191 | dashboard-projection-service.ts:110 system.health.changed not registered to TypedEventType | `done` | Root cause:  review 没有吸收 typed-event-bus / event-registry 的后续补齐；当前 `system.health.changed` 已注册。 |
| 192 | migrate-sqlite-to-pg.ts 列名/表名directly concatenated into SQL，no whitelist（注入风险） | `done` | Root cause: 迁移脚本早期defaults to表名和列名都来自可信模式；当前实现已对表名做 allowlist、对列名做标识符校验后再拼接。 |
| 193 | idempotency-key-storage.ts ${this.tableName} directly concatenated into SQL，at construction time未校验 | `done` | Root cause: 幂等键存储曾允许不受约束的自定义表名；现已puts构造边界强制校验安全 SQL 标识符并用结构化错误 fail-close。 |
| 194 | semantic-vector-store.ts process.env[name] 中 name comes from config，can read any env | `done` | Root cause: 该条基于旧实现快照；现lines `semantic-vector-store.ts` 只读取固定的 `AA_KNOWLEDGE_VECTOR_BACKEND` / `AA_KNOWLEDGE_SEMANTIC_BACKEND`，don't exist配置驱动的任意 env 读取。 |
| 195 | checkpoint-gc-service.ts fs.stat→fs.unlink TOCTOU window | `done` | Root cause:  GC 删除路径先做存puts性检查再删除；现已改为直接 `lstat/open(O_NOFOLLOW)/fstat/unlink` 绑定对象身份，并puts `ENOENT` 上幂等返回。 |
| 196 | shadow-snapshot-service.ts lstat→rename has symlink swap window between them | `done` | Root cause:  shadow snapshot 元数据之前通过临时文件 `rename()` 覆盖目标，`lstat` vs最终落点分离；现已改为 `O_EXCL|O_NOFOLLOW` 直接独占创建最终文件并拒绝repeats snapshotId，去掉了这条提升窗口。 |
| 197 | sqlite-database-wrapper.ts:94-114 savepoint 名直拼 exec，future caller can inject | `done` | Root cause:  PG 兼容 wrapper 之前把 savepoint 名直接插入 SQL；现已把 savepoint 名收口到受约束生成器并按标识符references用。 |
| 198 | sqlite-database.ts:143 PRAGMA busy_timeout = ${this.busyTimeoutMs} concatenated into SQL，busyTimeoutMs not integer validated | `done` | Root cause:  PRAGMA 值虽comes from config层，但没有puts数据库边界再iterations验证为正整数，留下了拼接型配置注入面。 |
| 199 | pg-advisory-lock-adapter.ts 中 Number(result.fencing_token)、sqlite-lock-adapter.ts:36 Number(result.lastInsertRowid) exceeds 2^53 precision loss | `done` | Root cause: 该条对应的两个风险点已消失：PG 适配器现已做安全整数范围校验，SQLite 锁适配器也不再relies on `lastInsertRowid` 生成 fencing token。 |
| 200 | checkpoint-gc-service.ts:171,557、learning-object-model.ts:180,184、risk-register.ts:87,110、invariant-registry.ts:137,165,180、responsibility-boundary.ts:158-308、admin-config-service.ts:66、outbox-repository.ts:117、memory-layer-model.ts:214,549、graphql-adapter-service.ts:294、conversation-template-service.ts:408、approval-policy-engine/version-manager.ts:111、stable-evidence-bundle-support.ts:612,616,732、dlq-service.ts:238、knowledge-snapshot-store.ts:25-48、semantic-vector-validation.ts:276、tool-gateway/index.ts:150,160、idempotency-key-storage.ts:310,338,341、cors.ts:49-68、reliability/timeout.ts:45,54 多occurrences抛裸 Error 而unstructured AppError/ValidationError | `done` | Root cause: 平台子模块长期each直接抛原生 `Error`；本批已把仍命中的现存路径收口到 `ValidationError` / `StorageError` / typed error，失效路径也不再对应现lines代码。 |
| 201 | .gitignore globally *.db-shm/*.db-wal don't exist，sqlite WAL residuals can be committed | `done` | Root cause: 旧 review 基于过期 `.gitignore` 快照；当前仓库已显式忽略 `*.db-shm` vs `*.db-wal`。 |

## src/platform/shared

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 202 | src/platform/stability/ vs src/platform/shared/stability/ 平lines同名目录实现已分歧 | `done` | Root cause: 稳定性能力曾同时保留 authoritative 实现和历史复制 facade；现已把 reliability 子能力统一回收为对 top-level stability 的薄重导出。 |
| 203 | src/platform/shared/reliability/、shared/stability/reliability/、stability/reliability/ 三occurrences可靠性实现repeats | `done` | Root cause:  reliability 目录重组后旧实现没有彻底下线；现lines仓库已只保留单一实现，shared/stability 侧only作 facade。 |
| 204 | src/platform/shared/observability/structured-logger.ts:484-491 each fsync log openSync+appendFileSync+fsyncSync+closeSync 串linessynchronous IO | `done` | Root cause:  durable sink 先前每条日志都重新打开文件；现已复用持久化文件描述符，只puts轮转时关闭并重开。 |
| 205 | src/platform/shared/observability/structured-logger.ts:153,180 sinkBaseDir=process.cwd()，运lines时 chdir 后语义漂移 | `done` | Root cause:  sink 根目录之前直接绑定 `process.cwd()`；现已固定到模块初始化时解析的稳定绝对基目录，并保留显式覆writes口。 |
| 206 | src/platform/shared/observability/structured-logger.ts:194 mkdirSync no错误occurrences理，insufficient permissions causes configure to throw | `done` | Root cause:  logger 目录创建曾把文件系统异常外漏给调用方；现已捕获并降级为结构化内部错误，且禁用该 sink。 |
| 207 | src/platform/shared/observability/structured-logger.ts:262 retentionLimit=0 buffer length is 0，all logs silently discarded | `done` | Root cause: 该条基于误判；现实现中 `retentionLimit=0` 只关闭内存保留，不会阻断 file sink vs transport 输出。 |
| 208 | src/platform/shared/outbox/outbox-poller-service.ts:193-197 retryCount>=maxRetries only failed++;continue，never sends to DLQ | `done` | Root cause:  outbox poller 之前没有终态失败语义；现已为exceeds限记录writes显式 dead-letter 标记并从 pending 集合移除。 |
| 209 | src/platform/shared/outbox/outbox-poller-service.ts:188-217 for-await 串linesoccurrences理，noconcurrent批量发布 | `done` | Root cause:  outbox 发布循环最初按顺序实现；现已按可配置 chunk concurrent发布，并优先走 batch publish。 |
| 210 | src/platform/shared/observability/otel-tracer.ts & otel-bootstrap.ts each loadOtelApi/loadOtelModules，OTel loading has two paths | `done` | Root cause:  OTel 模块探测逻辑之前分散puts tracer vs bootstrap 两occurrences；现已提取到共享 `otel-module-loader.ts` 单一入口。 |
| 211 | src/platform/shared/observability/structured-logger.ts:153 sinkBaseDir=process.cwd() after multiple worker forks each holds own cwd，路径inconsistent | `done` | Root cause: 日志 sink 曾从各 worker 自己的 `cwd` 推导路径；现已统一锚定到启动期解析的绝对基目录。 |
| 212 | tests/unit/platform/shared/stability/stable-prompt-injection-red-team-additional.test.ts:82,97,111,129,145 5 occurrences /tmp/... not portable | `done` | Root cause: 稳定性附加测试直接手写 Unix 临时目录字符串，没有复用统一测试工作区 helper。 |
| 213 | tests/unit/platform/shared/stability/stable-runtime-validator-additional.test.ts:30 /tmp/${caseId}.backup.db cross-case same name, overwrite each other | `done` | Root cause:  baseline/backup 路径用 caseId 直接拼到共享 `/tmp`，缺少平台no关且具隔离前缀的临时路径生成。 |
| 214 | graceful-shutdown.ts setImmediate(()=>process.exit()) doesn't flush stdio | `done` | Root cause: 旧实现确实只排到下一轮事件循环就退出；当前路径已显式等待 stdout/stderr flush 后再退出。 |
| 215 | slo-alerting-channels.ts puts queueMicrotask 内做synchronous阻塞 I/O | `done` | Root cause: 该 review 结论停留puts旧实现快照；当前 `slo-alerting-channels.ts` 已no `queueMicrotask` 包裹的synchronous阻塞 I/O 路径。 |
| 216 | graceful-shutdown.ts:122 void this.handleSignal(signal) without .catch；shutdown errors become unhandled rejection | `done` | Root cause: 信号监听器把异步 shutdown 启动成 fire-and-forget，没有puts监听器边界消费 rejection。 |

## src/platform/stability

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 217 | src/platform/stability/timeout.ts:82 success path does not clearTimeout，setTimeout handle leaks | `done` | Root cause:  timeout wrapper 只把定时器当成 reject 触发器，没有把成功/失败路径上的句柄清理建成显式步骤。 |
| 218 | src/platform/stability/timeout.ts cancel() only取消计时器，doesn't pass AbortSignal to wrapped function | `done` | Root cause:  timeout/cancel 语义最初只修改包装器内部Status，没有把取消信号传播给被执lines异步任务。 |
| 219 | src/platform/stability/retry.ts vs stability/reliability/retry.ts two copies coexisting with divergent strategies | `done` | Root cause:  retry 之前同时puts top-level stability vs reliability 子目录独立演化；现已把 reliability 版本收口成对 authoritative retry 的重导出。 |

## src/platform/prompt-engine

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 220 | ha-repository-postgres.ts:22、coordinator-load-balancing-service.ts:78、prompt-engine/registry/index.ts:123、tight-loop-detector.ts:82,95、loop-detection.ts:97、semantic-embedding.ts:108、structured-logger.ts:851、prompt-injection-guard.ts:543、profile-home.ts:31 多occurrences sha256 truncated to 32-64 位as identity/cache key，high collision probability | `done` | Root cause: 各模块each手写 `sha256(...).slice(...)`，把短前缀直接拿去做身份键、缓存键或排序偏置；现已统一改为共享 `sha256` helper，普通标识扩到 32 hex，PG advisory lock 改为基于完整 digest 的 63-bit fold，不再relies on脆弱的前缀截断。 |
| 221 | prompt-engine/registry/index.ts:114 listVersions 用 localeCompare 排序，"10" lexicographically before "2" 前 | `done` | Root cause: 模板版本排序先前accesses along用字符串比较；现已切到数值化版本段比较。 |
| 222 | prompt-engine/registry/index.ts:117-119 listTemplates() full flat-map no分页 | `done` | Root cause: 模板枚举接口之前只提供full拉取；现已支持 `offset/limit` 分页参数并保持稳定排序。 |
| 223 | prompt-engine/registry/index.ts:81-86 version_conflict 检查后两阶段writesno回滚，partial failure leaves orphaned mapping | `done` | Root cause: 注册逻辑之前直接原地复用旧版本映射；现已先克隆再替换，消除了中途写坏共享 map 的窗口。 |
| 224 | prompt-engine/eval/quality-config-loader.ts:24-35 schema missing qualityScoreWeights 求和≈1 vs completeMinScore>approvalRequiredScore 的 .refine | `done` | Root cause: 质量配置 schema 之前只校验单字段范围；现已补 cross-field refine 约束。 |
| 225 | prompt-engine/eval/quality-config-loader.ts:101-105 zod validation failure swallowed as generic throw，unstructured AppError | `done` | Root cause: 质量配置加载器之前直接透传 Zod 异常；现已转换为带 issue 明细的 `ValidationError`。 |
| 226 | prompt-engine/eval/llm-eval-service.ts:633 logger.warn contains raw suite.cases payload，PII/prompt content leaked | `done` | Root cause: 该条基于旧实现判断；现lines `parseCases()` 警告日志只记录 `suiteId` vs错误消息，不回写原始 `suite.cases`。 |
| 227 | prompt-engine/eval/prompt-model-policy-governance-service.ts:584 JSON.parse(release.metadata) no zod 校验 | `done` | Root cause:  release metadata 之前被直接 `JSON.parse` 后使用；现已改成受限字段解析并puts格式异常时 fail-close。 |
| 228 | prompt-registry/index.ts:1-30 30 linespure re-export shim，violates single source of truth | `done` | Root cause:  prompt-registry 之前只是薄重导出；现已提升为带 `createPromptRegistryServices()` 的 canonical namespace 入口，不再是纯 shim。 |
| 229 | prompt-engine/conversation-template-config-loader.ts:35 JSON.parse(content) no大小上限，config file can OOM | `done` | Root cause: 会话模板配置之前读全文件后直接解析；现已puts解析前增加尺寸上限并puts schema 失败时返回结构化错误。 |
| 230 | template-registry/index.ts 两occurrences @ts-expect-error | `done` | Root cause: 该条对应的文件/语句已don't exist于现lines仓库；当前搜索结果中没有 `template-registry/index.ts` 的 `@ts-expect-error` 残留。 |

## src/platform/contracts & types

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 231 | client-sdk/api-client.ts:984-992 declare module ".../executable-contracts/index.js" 模块增强会globally污染 ContractEnvelope.principal | `done` | Root cause:  client SDK 之前通过模块增强把 `principal` 污染到globally `ContractEnvelope`；现已改为 SDK 内部局部扩展类型。 |
| 232 | 全仓测试代码中的 `assert.ok(true)` 占位断言已清零；本轮补齐了 SDK 握手、API WebSocket 关闭路径、panic scope、region failover listener、CDC/backpressure、outbox/VCR/sqlite repository、repo map/cache、memory/harness、pg advisory lock 等剩余用例。当前 `rg -n "assert\\.ok\\(true\\)" tests -g '*.test.ts'` only会命中一条历史说明comment，不再命中真实占位断言。 | `done` | Root cause: 早期批量补测试时把“能跑通/不抛异常”直接固化成占位断言，同时缺少禁止空断言的 lint/CI 门禁；本iterations已把剩余占位全部替换为真实Status断言、参数捕获、缓存/计时器内部Status校验、错误码断言和持久化副作用校验，Issue已收口。 |
| 233 | contracts/types/responsibility-boundary.ts:316-326 puts"types"file puts GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE singleton运lines时态 | `done` | Root cause: 责任边界类型文件历史上混入了运lines态singleton；现已把globally实例迁到独立 `contracts/responsibility-boundary-service.ts`。 |
| 234 | contracts/types/responsibility-boundary.ts:302,306 hot path calls new Set every invocation | `done` | Root cause: 责任边界校验曾puts每iterations调用时临时创建动作集合；现已提升为module-level常量集合复用。 |
| 235 | contracts/types/domain/billing-types.ts:68 summaryJson:string 不透明 blob no zod | `done` | Root cause:  billing invoice summary 之前只是裸 JSON 字符串；现已补 `BillingInvoiceSummarySchema` vs parse/stringify helper，把 summary 至少收口到结构化 JSON object。 |
| 236 | contracts/types/domain/billing-types.ts:63,95,177 currency:"USD" 三occurrences字面，type prohibits multi-currency | `done` | Root cause:  billing 域类型把币种hardcoded成字符串字面量；现已提取为 `BillingCurrencyCode`，不再从类型层阻断多币种扩展。 |
| 237 | contracts/types/domain/billing-types.ts:122-129 executionId/stepId marked @deprecated still required，no移除计划 | `done` | Root cause:  usage event 同时保留 deprecated 字段又仍要求必填；现已降为 optional，让 canonical `harnessRunId/nodeRunId/attemptId` 成为主路径。 |
| 238 | contracts/types/domain/index.ts:1-249 100+ symbols hand-maintained，not export *，new types inevitably cause drift | `done` | Root cause:  domain barrel 之前靠手写大清单维护；现已改为按子模块 `export type *` 收口，新增类型不再手工synchronous。 |
| 239 | contracts/types/index.ts:191 jumps into executable-contracts/index.js re-export，bypassing domain 命名空间 | `done` | Root cause: 顶层 `types/index.ts` 曾把 executable-contracts 类型直接横向暴露；现已移除该跨层 re-export，避免绕开 domain/contracts 分层。 |
| 240 | contracts/mission/{playbook,index}.ts:373/357 two stableStringify independent implementations，may drift | `done` | Root cause:  mission vs playbook each维护序列化 helper；现已抽到共享 `contracts/mission/stable-stringify.ts` 单一实现。 |
| 241 | mission/index.ts 1637 lines单文件过大 | `done` | Root cause: 该条基于旧快照；现lines `mission/index.ts` 已降到约 377 lines，不再是exceeds大单文件。 |
| 242 | data-classification-service.ts:680、network-egress-audit.ts:335、auto-stop-loss-service.ts:65-71、panic-propagation-service.ts:119-123、war-room-coordinator.ts:93-94、policy-engine.ts:83、takeover-escalation-manager.ts:46,49、approval-flow-engine.ts:571、approval-policy-engine/version-manager.ts:443、mission/index.ts:685、config-audit-service.ts:319,824、provider-health-tracker.ts:55、task-timeline-service.ts:181 多occurrences push 类内存unbounded growth | `done` | Root cause: 多occurrences控制面服务把审计/生命周期/会话历史长期保存puts内存数组或 Map 中，却缺少统一 retention/eviction 策略；现已为 classification audit、egress audit、panic directive、war room、approval/takeover escalation history、policy version history、mission lifecycle、config audit 增加有界保留vs自动清理。另有部分references用来自旧快照，`auto-stop-loss`、`policy-engine`、`provider-health-tracker`、`task-timeline` 当前版本已分别具备容量上限、缓存上限或only为请求级临时聚合，不再构成no界常驻增长。 |

## src/platform/model-gateway

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 243 | model-gateway/provider-registry/base-chat-provider.ts:260-273 POST no signal/exceeds时；response.text() no大小上限 | `done` | Root cause: 基础 provider 之前把请求控制字段和传输层实现耦puts一起，只做裸 `fetch` 且直接 `response.text()` 读full错误体；现已补运lines时exceeds时/abort signal 组合、错误体字节上限vs截断标记。 |
| 244 | model-gateway/provider-registry/unified-chat-provider.ts:803-811 setTimeout(controller.abort) 未 unref；addEventListener("abort") no对称 remove，listener 泄漏 | `done` | Root cause: 统一 provider 的exceeds时 signal 只负责触发 abort，没有回收 timeout 句柄和上游 listener；现已 `unref()` 定时器并puts abort 后对称移除监听。 |
| 245 | model-gateway/provider-registry/base-chat-provider.ts:189-198 defaultRetryableCodes hardcodesno config/per-tenant 注入 | `done` | Root cause: defaults to重试码之前散落puts基类构造器字面量里；现已收口到 config-center defaults to常量，并支持构造配置vs请求级 override 注入，不再hardcodedputs实现lines内。 |
| 246 | provider-defaults.ts 顶层 const hardcodes 7+ 第三方 API URL | `done` | Root cause:  provider URL 之前以离散常量直接hardcodes，缺少统一目录和环境覆盖入口；现已改为受校验的defaults to目录 `PROVIDER_DEFAULT_URLS` vs `resolveProviderDefaultUrl()`，defaults to manual billing 地址也移出被策略拦截的 `.local` 内网域。 |

## src/platform/cost-management

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 247 | cost-management/index.ts:31-37 同名 CostEstimate 既是类型别名又是 Symbol，import 歧义 | `done` | Root cause:  cost-management barrel 之前把 contract type 和运lines时 token 复用同一导出名；现已把运lines时符号改为 `*Token` 命名，消除了 TS/JS 导入歧义。 |
| 248 | cost-management/index.ts:26 平台模块jumps into scale-ecosystem/billing/cost-estimation-service.js | `done` | Root cause: 平台层 cost-management 之前直接重导出 scale-ecosystem 实现，破坏平台命名空间分层；现已references入本地 `platform/cost-management/cost-estimation-service.ts`，onlyrelies on平台 contract vs state-evidence 数据库端口。 |

## src/platform/compliance

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 249 | compliance/encryption/index.ts:91-93 deriveEncryptionKey only sha256(keyRef)，no KDF/salt/per-record key | `done` | Root cause: 字段加密此前把 `keyRef` 的 sha256 直接当 AES key 用；现已切换到 `scryptSync` + 16-byte per-record salt 派生 32-byte key。 |
| 250 | compliance/encryption/index.ts:113-172 writeField/tokenizeFieldPath 不黑名单 **proto**/constructor，原型污染 | `done` | Root cause: 字段路径 tokenizer 之前accepts任意属性 token；现已显式拒绝 `__proto__`、`prototype`、`constructor` 并对空路径 fail-close。 |
| 251 | compliance/encryption/index.ts:84 密文用 enc:fingerprint:iv:authTag:ciphertext 冒号分隔，未来 keyRef 含冒号即解析失败 | `done` | Root cause: 密文 envelope 之前relies on脆弱的冒号分段协议；现已升级为 `encv1.<base64url-json>` 版本化结构化 envelope，消除了分隔符conflicts。 |
| 252 | compliance/encryption/index.ts:65 Buffer.from(ivHex!,"hex") 非空断言；非 hex 输入 Buffer silently truncated不抛 | `done` | Root cause:  reveal 路径之前靠非空断言和宽松 `Buffer.from(..., "hex")` 解码；现已改为 envelope 结构校验 + strict base64url 解码，不再accepts损坏字段静默下沉。 |
| 253 | compliance/erasure/index.ts:43,32-66 用 Date.parse + slaHours*hour 算 dueAt（本地时钟）；createPlan 不持久化 | `done` | Root cause: 擦除规划服务之前直接从 `nowIso()` 字符串反解析时间并只返回transient plan；现已支持注入时钟、基于 `Date#getTime()` 计算 SLA 截止时间，并为创建的 plan 提供defaults to内存 store、`getPlan()` vs `listPlans()` 持久可见性。 |
| 254 | governance-compliance/web references用错误 CSS 变量 --color-text | `done` | Root cause: 该条基于旧 UI 片段；现lines `governance-compliance` Web 视图已使用正确的 `--aa-color-text` 变量，没有残留错误 token。 |
| 255 | governance-compliance/analytics 的 subPages 声明页面未实现 | `done` | Root cause: 该条对应的 `subPages` 声明已不puts现lines feature module 中；当前 `analytics` vs `governance-compliance` 模块均未声明未实现的 subpage 路由，属于过期 review。 |

## src/platform/integration & connectors

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 256 | integration/connector-framework-service.ts:62-194 5 Map+2 LRU 内存，storageDir 多数 caller 传 null；LRU 部分移除"故意不更新位置"违反语义 | `done` | Root cause:  connector framework 之前把 manifest/instance/breaker 注册态长期留puts内存且no总量上限，同时 bindings/health 的 LRU 只puts写路径刷新，读访问不会更新最近使用顺序；现已为 connector 注册态增加 `maxConnectors` 容量控制，并把 bindings/health 的访问刷新vs加载裁剪补齐。 |
| 257 | integration/connector-framework-service.ts:144-156 驱逐循环含"no进展即 break"占位逻辑掩盖真实 bug | `done` | Root cause:  bindings 驱逐逻辑之前relies on“no进展就 break”的占位防死循环分支；现已改为 `evictLRUBindings()` 返回实际删除数，若删除为 0 直接抛显式 invariant 错误，不再静默吞掉驱逐异常。 |
| 258 | integration/connector-framework-service.ts:289-332 failed Status短路puts circuit breaker 之前，breaker 不递增；success===false 被转 throw，导致 breaker 双计 | `done` | Root cause: 执lines路径之前把 health-failed 直接短路到 breaker 之外，同时把 `success=false` 结果as异常抛回 breaker；现已让 failed health via过 breaker 记一iterations失败，而逻辑性失败结果不再人为二iterations抛错。 |
| 259 | integration/connector-framework-service.ts:392-414 provider 名规范化 servicenow/service-now/service_now vs github 大小写inconsistent | `done` | Root cause: 内建 connector 装配逻辑之前puts `switch` 里散落 provider 字符串变体；现已收口到 `normalizeConnectorProvider()`，统一 canonicalize 大小写、空白、下划线和 `service-now` 变体。 |
| 260 | integration/connector-framework-service.ts:494-509 每iterations register/bind/recordHealth full序列化 3 个 Map 写盘，no batching/debounce | `done` | Root cause:  connector framework 之前任何一iterations manifest/binding/health 变更都会把三个集合全部重写落盘；现已按变更域分别持久化 manifest、binding、health，消除了每iterations写三份full JSON 的放大开销。 |
| 261 | integration/connector-framework-service.ts:115-121 repeats register 相同 connectorId 静默覆盖no事件 | `done` | Root cause: 注册逻辑此前对repeats `connectorId` 直接 `Map#set` 覆盖；现已改为explicitly throws出 `connector_framework.duplicate_connector_id`。 |
| 262 | tests/unit/scale-ecosystem/integration/connector-framework-service.test.ts:513 /tmp/connector-framework-test-${Date.now()} not cleaned | `done` | Root cause: 该单测之前手写 `/tmp` 路径并自己做目录清理；现已切换到统一 `createTempWorkspace()/cleanupPath()` helper。 |
| 263 | test:pg-integration glob 永远匹配空目录 | `done` | Root cause: 该条基于旧脚本；当前 `package.json` 的 `test:pg-integration` 已直接指向 `tests/integration/platform/state-evidence/truth/postgres-fencing-token-service.test.ts`，don't exist空 glob。 |
| 264 | unit 目录下大量 spawn 子进程的测试，应puts integration | `done` | Root cause: 该条混入了误报：当前命中的大量 `fork()` 是 SDK/PluginContext 的对象方法，不是 `node:child_process` 子进程；少量 `execSync` 也只是仓库环境探测辅助，不属于跨进程集成测试主体。 |
| 265 | connector-runtime/index.ts:47 对 caller-supplied callback URL only AbortSignal.timeout(10_000)，no SSRF 白名单 | `done` | Root cause:  callback 解析之前只校验协议、loopback vsno凭据 URL，没有显式 allowlist；现已要求非 loopback 的 `https` callback 主机必须命中 `AA_CONNECTOR_CALLBACK_ALLOWED_HOSTS` 白名单。 |

## src/platform/agent-delegation & harness

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 266 | agent-delegation/delegation-manager.service.ts:847、delegation-manager-support.ts:104、hitl-operator-console-service.ts:63 Promise.all(...) 单点失败导致整体 abort，no per-item fallback | `done` | Root cause: 仓储 fan-out vs HITL 通知 fan-out 之前defaults to所有后端都可靠可用；现已改为 `Promise.allSettled()`，单个Status查询或单条通知失败不会拖垮整批结果。 |
| 267 | harness/loop/index.ts:91、harness/recovery-controller.ts:39 退避 jitter 用 Math.random()，破坏可复现 | `done` | Root cause:  harness 退避实现accesses along用了随机 jitter，而不是基于运lines上下文的确定性抖动；现已改成由 run/attempt 派生的 deterministic jitter，重放vs测试结果可复现。 |
| 268 | harness/hitl-runtime.ts:71,465 30 天 TTL 双字面量，no单一来源 | `done` | Root cause:  HITL request vs责任记录分别each手写 30 天过期值；现已统一复用 `requestTtlMs` 和 `computeExpiryIso()`。 |
| 269 | harness/memory-manager.ts:34,168 shared:1000 vs 30*60*1000 LRU 窗口hardcodes，no config | `done` | Root cause:  harness memory tier 容量vs降级空闲窗口长期hardcodedputs模块常量里；现已暴露 `HarnessMemoryManagerOptions`，支持覆盖 tier 上限和 demotion idle 窗口。 |
| 270 | harness-decision-manager.ts:186 用comment代替接口约束 | `done` | Root cause:  decision evidence 持久化之前拿到了 canonical input bundle 却只用comment压掉未消费字段；现已把 bundle 的关键结构信息writes evidence content/metadata，不再靠comment假装绑定接口。 |
| 271 | contracts/execution-receipt/index.ts:64-67、harness-decision-manager.ts:185、quorum-calculator.ts:249、sub-workflow-executor.ts:731、assessment-service.ts:141、pack-routes.ts:107,121,143,182、incident-routes.ts:150、risk-evaluation-port.ts:26、inter-plane-contract-gateway.ts:332 多occurrences void param; 丢弃声明relies on的参数，租户/principal 鉴权事实上被bypassing | `done` | Root cause: 多occurrences兼容入口把“先拿到上下文再决定是否消费”演化成了直接 `void` 掉输入，最危险的是 pack/incident API 已做鉴权却没有把租户边界真正下沉到服务层；现已把 pack 路由收口为globally租户禁入、incident 服务vs路由改成显式按 tenant 过滤/更新，并让 legacy receipt、quorum vs risk evaluation 至少对入参做一致性校验，不再accepts名义上重要、实际上被丢弃的参数。 |

## src/platform/improve-rollout & learn

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 272 | learn/llm-improvement-generation-service.ts:162 createdAt: String(Date.now()) 用十进制 ms 字符串，vs sibling ISO inconsistent | `done` | Root cause:  improvement generation 之前混用了 epoch-ms 字符串和平台主流的 ISO 时间戳；现已统一写 ISO。 |
| 273 | learn/learning-artifact-model.ts:70-78 dynamically await import("node:crypto") 双载，且 fallback only哈希 objectId 不哈希内容 | `done` | Root cause:  artifact checksum 之前把 crypto 导入和内容哈希做成了脆弱 fallback；现已改为静态references入 `createHash()` 并始终对 artifact 内容本身做 SHA-256。 |
| 274 | improve-rollout/improvement-candidate-registry.ts:93,140,147 用 Date.now() 跟踪 candidate TTL，跨副本驱逐时钟漂移 | `done` | Root cause:  candidate TTL 之前额外维护了一份本地 `Date.now()` 元数据，和 candidate 自身 `createdAt` 脱钩；现已改为基于候选记录的 `createdAt` 计算 TTL，并支持注入时钟。 |
| 275 | improve-rollout/rollout/rollout-state-machine.ts:71 transitionedAt: Date.now() 数字 vs types/rollout-record.ts:143 字符串混用 | `done` | Root cause:  rollout state machine putsStatus记录里继续写数字时间戳，而合同模型已via切到字符串时间；现已统一输出 ISO 字符串。 |

## src/platform/intelligence & PMF

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 276 | intelligence/perception-service.ts:250-257 parseJsonArray 静默 JSON parse 失败返回 []，掩盖损坏数据 | `done` | Root cause:  perception export 之前把损坏的 JSON 字段当空数组吞掉；现已改为explicitly throws `ValidationError`，对坏数据 fail-close。 |
| 277 | intelligence/perception-service.ts:310-312 :memory: 路径下产物落 dirname(":memory:")/artifacts，污染工作目录 | `done` | Root cause:  perception service defaults to把 artifact 根目录从 `db.filePath` 推导，即使 filePath 是 `:memory:`；现已对内存数据库切到系统临时目录。 |
| 278 | intelligence/perception-service.ts:262-292 buildBriefMarkdown 不 escape \|/</反references号，feed 数据可注入 markdown/exfil 图片 | `done` | Root cause:  Markdown 导出直接内联 source/title/rawRef 等外部字符串；现已补齐反斜杠、反references号、竖线和 `<` 的转义。 |
| 279 | intelligence/perception-service.ts:646-666、pmf-validation-service.ts:500-518 divisionId:"system_admin"/"system" 魔术 division，vs division-catalog.json no校验 | `done` | Root cause: 内部占位任务早期直接写了历史遗留的 `system_admin/system` division；现已统一改成目录内存puts的 `operations` 分工。 |
| 280 | intelligence/pmf-validation-service.ts:496-518,594-614 检查后插入存putsconcurrent竞态；selectRow 把未知列加进 T 结果 | `done` | Root cause:  PMF 占位任务之前走 check-then-insert，`selectRow()` 还会把查询里多余列偷偷塞回泛型结果；现已改成 `INSERT OR IGNORE`，并且只回填 defaults 已声明的键。 |
| 281 | intelligence/pmf-validation-service.ts:155-162 listHistory(limit=20) 上限不限可 OOM | `done` | Root cause:  PMF 历史列表之前直接信任调用方传入的 limit；现已做 1..500 的硬上限收口。 |
| 282 | intelligence/perception-service-async.ts:1-83 双方法并存且全用 Parameters<...>[0] 内联类型，sync 签名变更静默破坏 async | `done` | Root cause:  async wrapper 之前把所有参数和返回值都写成内联 `Parameters/ReturnType`；现已切到显式输入/输出类型导入，避免 sync 签名漂移时静默破坏。 |

## src/platform/resource-manager

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 283 | resource-manager/resource-pool-service.ts:13-50 failureRateThreshold:0.3/minSampleSize:20 用 .default() 内联，no config 覆写；池/分配 in-memory no持久化 | `done` | Root cause:  resource pool defaults tothreshold长期埋puts schema `.default()` 里，且服务实例没有任何Status持久化接口；现已支持服务级defaults to配置vs可选 state store。 |
| 284 | resource-manager/resource-pool-service.ts:74-150 分配no CAS（worker_threads/cluster 不安全）；隔离no去抖；恢复no cooldown/审计；错误信息误导 | `done` | Root cause: 该条把“进程内资源池”vs“跨进程共享 CAS”混puts了一起；当前服务仍是单进程内存模型，但真实缺口的隔离抖动和恢复 cooldown 已补齐，并把Status持久化口留出来，避免隔离Status来回抖动。 |
| 285 | resource-manager/fair-scheduling-service.ts:70 饥饿截止 15*60_000 hardcodes | `done` | Root cause:  fair scheduling 之前把 starvation threshold hardcodedputs实现里；现已支持构造配置。 |
| 286 | resource-manager/fair-scheduling-service.ts:114-145 配额exceeds限但 quorum 降级时返回 passed:true；budget tenant 不匹配返回 remaining=Infinity 静默放过 | `done` | Root cause: 公平调度之前把“quorum 未满足”错误地做成配额放lines，同时把 tenant 不匹配 promotion budget 当作no限budget；现已保留 `quota_exceeded` 信号，并对租户不匹配显式拒绝。 |
| 287 | tests/unit/scale-ecosystem/resource-manager/quota-enforcer-stateful-r13.test.ts:13 hardcoded /private/tmp/... only macOS 路径 | `done` | Root cause: Status化 quota 测试之前直接把临时Status文件hardcoded到 `/private/tmp`；现已改为 `tmpdir()` 拼接。 |

## src/platform/architecture & risk

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 288 | architecture/risk-register.ts:20-77,30-72 only 4 风险项且 reviewAfter:"2026-07-01" 全部相同hardcodes | `done` | Root cause: 风险台账之前只保留了最早四条基线风险，并把 review date 统一hardcodes成同一天；现已扩充风险项并按风险类别拆分 reviewAfter。 |

## src/platform/remote-coordination

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 289 | src/platform/remote-coordination/index.ts:1-2 同时 export * as session vs export * 自同模块，命名空间双导出歧义 | `done` | Root cause:  remote-coordination barrel 同时暴露命名空间导出和扁平导出，制造了repeats入口；现已去掉repeats的 `export * as session`。 |

## src/platform/structure

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 290 | src/platform/structure/index.ts 静默吞错 + 不合理的 Deno 探测 | `done` | Root cause: 该条基于旧文件快照；当前 `src/platform/structure/index.ts` 已不含 Deno 探测，也没有静默吞掉目录读取异常。 |
| 291 | src/platform/structure/index.ts:249 require("node:fs") vs ESM Deno.readDirSync 双路径混用 | `done` | Root cause: 该条同样来自过期实现；现lines文件只使用 Node ESM `node:fs` API，没有 `require()`/`Deno.readDirSync` 混用。 |

## src/platform other

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 292 | src/platform/contracts/*/index.ts 5 个合同文件hardcodes docs.example.com/api.example.com 占位 URL，被打入运lines时错误信息 | `done` | Root cause: 该条基于旧合同文案；当前 `src/platform/contracts/*/index.ts` 已no这些占位域名落入运lines时error path。 |
| 293 | src/platform/ops-maturity/index.ts vs顶层 src/ops-maturity/ 同名共存 | `done` | Root cause:  review 记录的 `src/platform/ops-maturity/index.ts` puts现lines仓库里已don't exist，只剩明确的子模块路径和顶层 `src/ops-maturity/`。 |
| 294 | src/platform/ 目录越权：存puts 10 个 AGENTS.md 未授权的子目录 | `done` | Root cause: 该条基于过期目录扫描；当前 `src/platform/` 下don't exist这些越权 `AGENTS.md` 子目录。 |
| 295 | release-pipeline.ts vs deployment-execution.ts hardcodes GitHub Actions URL，且字面量repeats | `done` | Root cause: 两个 CLI 入口each内联了同一条 GitHub Actions run URL 前缀；现已抽成共享 helper。 |
| 296 | deployment-execution-service.ts:178-179、channel-gateway-service.ts:158-161 子进程/请求 buffer 累积no字节上限，OOM 风险 | `done` | Root cause:  deployment command runner 已有输出上限，但 channel gateway 的 pooled fetch 之前会no界累积响应 body；现已补齐 response byte cap。 |

## ui/apps/web (shell, vite, sw)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 297 | ui/apps/web/src/main.tsx:11 if(rootElement!=null) 缺失 #root 时静默 no-op，应抛/告警 | `done` | Root cause:  Web 入口之前puts找不到 `#root` 时直接 no-op；现已记录 telemetry 并抛错 fail-close。 |
| 298 | ui/apps/web/src/main.tsx:8-9 createWebRuntimeClients puts <GlobalErrorBoundary> 挂载前执lines，初始化错bypassing fallback UI | `done` | Root cause:  runtime bootstrap 之前puts根渲染前就执lines；现已移入 `GlobalErrorBoundary` 包裹下的 bootstrap 组件。 |
| 299 | ui/apps/web/src/main.tsx:8 VITE_AUTH_TOKEN via import.meta.env 读，被 Vite 烘焙进公共 bundle 泄漏 | `done` | Root cause: 入口配置之前直接从 `import.meta.env` 读取 auth token；现已改为从运lines时 `<meta name=\"aa-auth-token\">` 读取，不再把 token 烘焙进 bundle。 |
| 300 | ui/apps/web/src/runtime.ts:84 constructOrCall 用 "mock" in factory 启发式判定，含静态 mock 字段的真 class 误路由 | `done` | Root cause:  runtime factory 之前拿 `\"mock\" in factory` 当成构造/调用分流信号；现已改为 `Reflect.construct()` 尝试构造、失败再回退普通调用。 |
| 301 | ui/apps/web/src/runtime.ts:122-130 seedTokenManager hardcodes expiresAt=Date.now()+3600_000 忽略真实 JWT TTL | `done` | Root cause:  review 对应的是旧版 bootstrap token 逻辑；当前实现已puts可解析 JWT 时读取 `exp`，解析失败才退回显式 bootstrap sentinel 过期值。 |
| 302 | ui/apps/web/src/runtime.ts:163 模块顶层references用globally WebSocket，Node/SSR/no stub jsdom 即崩 | `done` | Root cause: 该条基于旧实现；现lines `runtime.ts` 只puts `createWebRuntimeClients()` 内按 `typeof WebSocket` 分支，don't exist模块顶层直接取globally `WebSocket`。 |
| 303 | ui/apps/web/src/runtime.ts:181-206 registerWebServiceWorker has no try/catch，拒绝时变 unhandled rejection | `done` | Root cause:  service worker 注册失败之前完全relies on调用方兜底；现已puts注册函数内部记录 telemetry 并 rethrow。 |
| 304 | ui/apps/web/src/runtime.ts:148 vs其他 transport fallbackToMock defaults to true inconsistent，生产 transport 错误时悄然返回 mock 数据 | `done` | Root cause: 该条基于旧配置假设；当前 Web runtime 明确把 `HttpTransport.fallbackToMock` 设为 `false`，don't exist静默 mock 回退。 |
| 305 | ui/apps/web/src/feature-registry.ts:30-33 深路径 ../../../packages/features/*/src/index bypassing workspace alias，包结构变即坏 | `done` | Root cause: 该条来自过期 registry 快照；现lines `feature-registry.ts` 已统一用 `@aa/feature-*` workspace alias。 |
| 306 | ui/apps/web/src/app-shell.tsx:~356 effectiveAuthContext 每iterations渲染新对象 identity，memo 消费方多余重渲 | `done` | Root cause:  `effectiveAuthContext` 之前每iterations render 都重新构造对象；现已用 `useMemo()` 稳定 identity。 |
| 307 | ui/apps/web/src/global-error-boundary.tsx:14-19 componentDidCatch only console.error，no telemetry，stack 丢弃 | `done` | Root cause: 该条同样基于旧版 Web boundary；当前实现早已通过 `reportUiError()` 上报 component stack。 |
| 308 | ui/apps/web/src/global-error-boundary.tsx fallback no retry 按钮，单错锁全 app | `done` | Root cause: globally错误边界之前只有静态 fallback；现已增加 retry 按钮允许重新尝试渲染。 |
| 309 | ui/apps/web/src/app-shell.tsx:222-230 useMemo 出现puts L219 早期 return 之后，违反 React hooks 必须no条件调用规则 | `done` | Root cause: 该条基于旧结构；现lines `app-shell.tsx` 的 hooks 调用不再位于条件 return 之后。 |
| 310 | ui/apps/web/src/app-shell.tsx:356-366 effectiveAuthContext defaults to permissions:["authenticated"]，未提供 authContext 时全 feature 放lines — 鉴权后门 | `done` | Root cause:  shell 之前defaults to把未显式鉴权的会话视为已认证；现已改为优先使用显式/URL auth，上述信息都没有时defaults to未认证。 |
| 311 | ui/apps/web/src/app-shell.tsx:330 通配 path="*" no 404 页面，未知 URL 静默渲染 features[0] 跑其守卫 | `done` | Root cause: 通配路由之前把未知路径强lines导向首个 feature；现已改成显式 404 fallback。 |
| 312 | ui/apps/web/src/app-shell.tsx:368-372 useEffect setPhase("idle") only切换两态，render 分支立即被覆盖，phase Status死代码 | `done` | Root cause:  shell phase 之前只有 `render/idle` 两态且分支没有真实差异；现已收口成 `booting/ready` 的有效Status机。 |
| 313 | ui/apps/web/src/app-shell.tsx:316-338 phase==="render"\|\|phase==="idle" 判断恒真，else 永不执lines | `done` | Root cause: 原来的 phase 条件把两个可能值都判成真，准备态分支永远走不到；现已改成 `phase === "ready"`。 |
| 314 | ui/apps/web/src/app-shell.tsx:308 startupBanner 背景hardcodes #12201a 不随主题切换 | `done` | Root cause: 该条基于旧 UI 片段；当前 startup banner 已使用 `designTokens.color.accent` 及其透明度派生色。 |
| 315 | ui/apps/web/src/app-shell.tsx:99-105 navigate(-1) 用 window.history.length>1，length 含跨域条目，可能后退到外站 | `done` | Root cause: 访问拒绝返回按钮之前只看 `history.length`；现已要求 referrer vs当前 origin 同源，否则直接回退到安全 fallbackPath。 |
| 316 | ui/apps/web/src/app-shell.tsx:148 错误边界 "Report Issue" only console.error，按钮no副作用 placebo UI | `done` | Root cause: 该条对应的旧按钮实现只做本地打印；当前 `Report Issue` 已调用 `reportUiError()` 带上 retryKey 等上下文。 |
| 317 | ui/apps/web/src/app-shell.tsx:133 错误 fallback 直接渲染 error.message，可能含敏感栈/PII | `done` | Root cause:  feature 级错误边界之前把原始 `error.message` 暴露给最终user；现已改为通用文案。 |
| 318 | ui/apps/web/src/app-shell.tsx:184-206 FeatureContent 同时渲染 feature.Component vs activeSubPage.Component，no <Routes> only按 location 字符串匹配，父+子页双渲染 | `done` | Root cause:  feature shell 之前对带 subpage 的模块总是父页和子页一起渲染；现已改为 overview/subpage 二选一显示。 |
| 319 | ui/apps/web/src/app-shell.tsx:159 重试用 Fragment key=retryKey 强制重挂，含module-level singleton 子树不会真重置 | `done` | Root cause: 该条把 React 子树重挂vsmodule-level singleton 语义混为一谈；当前实现的 retry 仍然负责重挂 React 树，而module-level singleton 不属于该边界能够也不应该重置的范围。 |
| 320 | ui/apps/web/src/app-shell.tsx:268 顶级 grid gridTemplateColumns:"280px 1fr" hardcodes，no响应式断点 | `done` | Root cause:  shell 根布局之前永远使用固定双栏；现已按窄屏/宽屏切换列模板。 |
| 321 | ui/apps/web/src/app-shell.tsx:274,187 多 nav 嵌套但only最外层 nav 有 aria-label，repeats nav landmark 干扰屏阅读 | `done` | Root cause: 主导航和子页导航之前没有each独立 label；现已分别补上 `aria-label`。 |
| 322 | ui/apps/web/src/app-shell.tsx:62 normalizePath only去尾斜杠，不occurrences理多重斜杠/.//../，恶意 URL bypassing匹配 | `done` | Root cause: 路径规范化之前只做了去尾斜杠；现已按 segment 级别折叠空段、`.` 和 `..`。 |
| 323 | ui/apps/web/src/feature-registry.ts:30-33 4 occurrences ../../../packages/features/*/src/index 深路径bypassing alias（feature-flags/memory-review/release-console/trace-explorer 仍hardcodes） | `done` | Root cause: 该条也是旧版 registry 残留；当前四个 feature 都已通过 `@aa/feature-*` alias 导入。 |
| 324 | ui/apps/web/src/feature-registry.ts:36-39 missionControlFeatureContracts 导出但 featureRegistry 未消费，死合约 | `done` | Root cause:  review references用的 `missionControlFeatureContracts` 导出puts现lines文件里已don't exist，不再有死合约残留。 |
| 325 | ui/apps/web/src/feature-registry.ts:77 LazyFeatureDashboard=dashboard 命名 "Lazy" 但synchronous导入，并非 React.lazy | `done` | Root cause:  registry 早期把synchronous import 误命名为 lazy；现已改为描述符驱动的 `React.lazy` feature 包装。 |
| 326 | ui/apps/web/src/feature-registry.ts:41-75 32 feature 顶层 import 全 bundle puts主 chunk，违反代码分割 | `done` | Root cause:  feature registry 之前静态导入所有 feature 模块；现已改成dynamically import，构建产物已拆出独立 `feature-*` chunk。 |
| 327 | ui/apps/web/vite.config.ts:12-22 CSP 缺 worker-src/child-src/manifest-src/form-action/frame-src，浏览器defaults to放lines | `done` | Root cause:  web CSP 基线最初只覆盖核心指令；现已补齐 worker/child/manifest/form/frame 指令并统一注入 dev/preview。 |
| 328 | app-shell.tsx 把 tenant/domain/permissions/roles 全部hardcodes | `done` | Root cause: 旧版 shell 曾puts本地开发环境回填 tenant/domain/permissions/roles；现实现只消费显式 `authContext` vs URL 参数，已去掉本地兜底hardcodes。 |
| 329 | app-shell.tsx useMemo 写puts条件 return 之后违反 Hooks 规则 | `done` | Root cause:  `FeatureContent` 之前先按 `subPages.length` 早退，再声明后续 hooks；现已把 hooks 提前并移除条件 hook 路径。 |
| 330 | app-shell.tsx WebFeatureModule 强lines覆盖 @aa/ui-core 类型 | `done` | Root cause: 应用层此前用 `Omit` 重写 `FeatureModule.subPages` 类型；现已直接使用 `FeatureModule` 并通过解析函数收口 `subPages`。 |
| 331 | web/main.tsx:5-8 createWebRuntimeConfig 输出未被消费，startWebRuntimeTelemetry 从不调用，OTLP/web-vitals 死代码 | `done` | Root cause: 入口文件之前只创建 runtime config 没有驱动后续初始化；现已用 config 初始化 client，并puts生命周期中启动/停止 telemetry。 |
| 332 | web/main.tsx:11 rootElement==null 静默 no-op no任何告警 | `done` | Root cause: 入口文件之前puts找不到 `#root` 时静默返回；现已上报 `ui.root_element_missing` 并直接 fail-fast。 |
| 333 | aa-sw.js:4 预缓存 /offline 但应用no该路由，install 必失败 | `done` | Root cause:  SW 预缓存清单accesses along用了过期 `/offline` 路由；现已only预缓存真实存puts的 `/` app shell。 |
| 334 | aa-sw.js:10 install 内 self.skipWaiting() bypassing runtime 的 notifyUpdateAvailable user提示 | `done` | Root cause:  SW install 阶段之前直接 `skipWaiting()` 抢切版本；现已移除并保留 runtime 更新通知机制。 |
| 335 | aa-sw.js:27-37 所有 GET（含 HTML）cache-first no TTL，部署no法失效返回user的 index.html | `done` | Root cause: 旧 SW 对文档请求采用no TTL 的 cache-first；现已改成 document network-first + TTL 缓存回退。 |
| 336 | aa-sw.js:97-103 replayOfflineMutations 不带 idempotency-key/CSRF/auth，vs runtime 拦截链矛盾 | `done` | Root cause: 离线重放之前直接裸发请求；现已要求并透传 auth/csrf/idempotency 头。 |
| 337 | aa-sw.js:96-107 重放循环no限速/退避；非 2xx（含 401/403/422）每iterations sync 永久重试 | `done` | Root cause: 离线重放最初没有concurrent、退避和永久失败终止策略；现已加入concurrent上限、指数退避和 4xx 丢弃。 |
| 338 | aa-sw.js:44 裸 catch {} 吞 fetch 错误no telemetry | `done` | Root cause:  SW 失败路径曾裸吞异常；现已记录错误上下文，不再静默吃掉 fetch 失败。 |
| 339 | app-shell.tsx:330 通配路由 features[0]! 非空断言；features 中途为空即崩 | `done` | Root cause: 旧通配回退relies on `features[0]!` 非空断言；现已puts guard/fallback 路径统一做空集合保护。 |
| 340 | app-shell.tsx:163-176 FeatureContent 每iterations渲染重算 subPages/activeSubPage no memo | `done` | Root cause:  `FeatureContent` 之前每iterations render 现算子页Status；现已对 `subPages`、路径归一和 `activeSubPage` 做 memo。 |
| 341 | app-shell.tsx:124,137-140 getDerivedStateFromError 总把 retryKey 重置为 0，连续错误丢失计数 | `done` | Root cause: 错误边界派生Status曾隐式把 `retryKey` 归零；现已只设置 `error`，重试计数onlyputs显式 retry 时递增。 |
| 342 | app-shell.tsx:65-77 withAlpha no memo；每iterations渲染对每个 NavLink 解析十六进制 | `done` | Root cause: 导航配色之前puts render 中反复执lines十六进制解析；现已把派生背景色 memo 化复用。 |
| 343 | ui/tests/unit/.../approval/web.test.tsx、hitl/web.test.tsx 缺 afterEach(cleanup)，jsdom 多 root 累积 | `done` | Root cause: 相关 jsdom 视图测试缺统一清场；现已puts suite `afterEach(cleanup)` 中回收多 root。 |
| 344 | ui/apps/web/public/aa-sw.js:97 replayOfflineMutations 重发不重附 Authorization/X-CSRF-Token/Idempotency-Key | `done` | Root cause: 离线 mutation 之前未校验和继承安全头；现已直接从存储 headers 重放，并对受保护请求缺头 fail-close。 |
| 345 | ui/apps/web/public/aa-sw.js /api/v1/* no声明缓存策略，replay vs新 fetch 竞态返陈旧数据 | `done` | Root cause:  SW 之前把 API 请求混进通用缓存策略；现已显式 bypass `/api/*` 运lines时缓存。 |
| 346 | ui/apps/web/vite.config.ts:18 CSP connect-src 含 wildcard https:/wss:，policy 形同虚设 | `done` | Root cause:  CSP `connect-src` 之前偷懒放开 `https:`/`wss:` 通配；现已按 env 推导精确 origin 列表。 |
| 347 | ui/apps/web/vite.config.ts:~57 SRI 注入正则only匹配单lines script 多lines被静默跳过 | `done` | Root cause:  review 基于旧单lines假设；当前 SRI 注入按标签整体匹配，构建产物已稳定注入 `integrity/crossorigin`。 |
| 348 | ui/tests/apps/web.test.tsx:9 断言hardcodes中文 "总览驾驶舱"，绑定defaults to zh-CN locale，切语言即破 | `done` | Root cause: 测试把defaults to中文标题hardcoded；现已从 registry 读取 dashboard 标题断言。 |
| 349 | ui/tests/unit/ui/apps/web/runtime.test.tsx:534 点击 retry 按钮但对结果Status不断言任何东西，零保护 | `done` | Root cause: 错误边界重试测试之前只点按钮不看恢复结果；现已断言 retry 后实际恢复渲染。 |
| 350 | ui/tests/unit/ui/apps/web/runtime.test.tsx 用 mockReturnValueOnce 链，前 expect 失败后排队 mock 渗到下个测试 | `done` | Root cause:  suite 清理不足时 `mockReturnValueOnce` 队列可能串测；现已puts相关 suite `afterEach` 清空 mocks，避免排队残留。 |
| 351 | ui/tests/unit/ui/packages/features/approval/web.test.tsx:43 用真 Date.now() 而非 vi.useFakeTimers，snapshot 跨iterations不稳 | `done` | Root cause: 审批视图测试直接relies on真实时钟；现已切到 fake timers vs固定系统时间。 |
| 352 | ui/tests/unit/ui/packages/features/approval/web.test.tsx:72-74 用 fireEvent.click 而非 userEvent.click，错过 pointer-down/键盘语义 | `done` | Root cause: 审批交互测试只触发 `click`；现已补 `pointerDown + click` 序列覆盖更真实事件语义。 |
| 353 | ui/apps/web/vite.config.ts:14 CSP script-src 'self' no nonce/'strict-dynamic'，vs SRI 注入并存但 inline script全被阻断 | `done` | Root cause:  review 把“no nonce/strict-dynamic”误当成必须项；当前页面只加载外链脚本且 SRI 同时生效，don't exist inline bootstrap 被误阻断的Issue。 |
| 354 | ui/apps/web/vite.config.ts:71-95 configurePreviewServer 设 CSP，configureServer(dev) 未设，dev vs生产 CSP inconsistent | `done` | Root cause: 开发服务器之前没有注入同等 CSP；现已puts dev/preview 两条服务器链路统一注入。 |
| 355 | ui/apps/web/vite.config.ts:101 react-native alias 用 new URL(...).pathname，Windows 下含前导 / + 盘符，alias 失败 | `done` | Root cause:  alias 路径解析之前直接取 `new URL().pathname`；现已改为 `fileURLToPath()` 兼容 Windows 盘符。 |
| 356 | ui/apps/web/vite.config.ts:108 sourcemap:"hidden" 生产仍生成 sourcemap 文件，可被反推 | `done` | Root cause: 生产构建之前仍输出 hidden sourcemap；现已puts production 关闭 sourcemap 产物。 |
| 357 | ui/apps/web/vite.config.ts no define: 排除 process.env，Node globally可能被烘焙 | `done` | Root cause:  Vite 之前未显式清空 `process.env`；现已通过 `define` 阻断 Node globally被烘焙。 |
| 358 | ui/apps/web/public/aa-sw.js:9 cache.addAll(["/","/offline"])，/offline 资源 404 时整 install 失败 SW 永不激活 | `done` | Root cause:  SW 预缓存里混入non-existent `/offline`；现已移除该资源，install 不再被 404 阻断。 |
| 359 | ui/apps/web/public/aa-sw.js:41 每个成功 GET 都 cache.put，no LRU/容量上限 | `done` | Root cause: 静态缓存之前只有 `cache.put` 没有容量治理；现已加入最大条目数裁剪。 |
| 360 | ui/apps/web/public/aa-sw.js:71-76 normalizeCacheRequest 删 search/hash，搜索结果页/不同 query 共用 cache 污染 | `done` | Root cause: 旧缓存 key 归一化会抹掉 query/hash；现实现直接按原始 `Request` 建 key，不再污染不同查询页。 |
| 361 | ui/apps/web/public/aa-sw.js:75 new Request(url,{method:"GET"}) 丢弃原 headers (Accept-Language)，多 locale 共享同 entry | `done` | Root cause: 旧实现重建 `Request` 时丢 header；现已直接缓存原始请求，保留 `Accept-Language` 等变体头。 |
| 362 | ui/apps/web/public/aa-sw.js:96-107 顺序 await replay，单条慢请求阻塞所有；失败响应不 ok 时不删除也不重试上限 | `done` | Root cause: 离线 replay 之前串lines执lines且no终止条件；现已按批concurrent重放并设置失败上限。 |
| 363 | ui/apps/web/public/aa-sw.js:18-22 activate only删 aa-ui-runtime- 前缀缓存，更名前缀后老缓存遗留 | `done` | Root cause: 激活阶段之前只按单一前缀删除旧缓存；现已清理所有 `aa-ui-` 历史缓存并保留当前 shell cache。 |
| 364 | ui/apps/web/public/aa-sw.js:141-145 transaction.oncomplete 检查恒为 undefined，逻辑总走早 resolve 分支，未 await complete 即 resolve 竞态 | `done` | Root cause:  IndexedDB 事务等待之前错误地提前 resolve；现已统一等待 `transaction.oncomplete/onerror/onabort`。 |
| 365 | apps/web/package.json only 2 个 deps 但实际 import 30+ @aa/* | `done` | Root cause:  review 基于早期最小 package 清单；当前 web app 已显式声明 shared/react/router 等实际relies on，不再是“only 2 个 deps”。 |
| 366 | apps/web/index.html 缺 meta description/icon/回退文案 | `done` | Root cause: 旧 HTML 骨架缺少说明元信息vs加载回退；现已补 `description`、icon vs加载文案。 |

## ui/apps/electron-win

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 367 | electron-win/package.json:9 smoke 直跑 node ./src/index.ts，no --import tsx/build，纯 Node 22 必失败 | `done` | Root cause:  smoke 脚本之前直接uses bare Node 执lines TS；现已改为 `node --import tsx ./src/index.ts`。 |
| 368 | ui/apps/electron-win/src/main.ts:103 window.open 外链no origin allowlist | `done` | Root cause: 外链打开之前未做 URL allowlist；现已限制到 `https:`/`mailto:` vs本地开发 HTTP。 |
| 369 | ui/apps/electron-win/src/main.ts:~162 globalShortcut 注册后未puts quit 前 unregisterAll，重启泄漏 | `done` | Root cause: globally快捷键生命周期之前没有 quit 清理；现已puts `will-quit` 统一 `unregisterAll()`。 |
| 370 | ui/apps/electron-win/src/preload.ts:34-35 桥同时暴露 AA_ELECTRON vs私有 **AA_ELECTRON**，后者no完整性校验 | `done` | Root cause:  preload 之前双名暴露公私 bridge；现已只暴露冻结后的 `AA_ELECTRON` 单一对象。 |
| 371 | ui/apps/electron-win/src/preload.ts preload 暴露的 IPC 通道puts main.ts 未 wire，调用静默失败而非 typed error | `done` | Root cause:  preload vs main 的 IPC 契约曾不synchronous；现已为暴露的 channel 全部注册 `ipcMain.handle`。 |
| 372 | ui/apps/electron-win/package.json:7 main:"src/main.ts" 但 Electron 不解析 TS，no build:tsc 步骤，electron . 启动失败 | `done` | Root cause:  Electron 包此前把 `main` 指向 TS 源文件且no编译步骤；现已改为 `dist/main.js` 并补 `tsc` 构建。 |
| 373 | ui/apps/electron-win/src/main.ts 模块定义 bootstrapElectronShell 但全包入口未调用，app.whenReady 永不触发 | `done` | Root cause: 主进程模块定义了 bootstrap 但没有直接入口接线；现已puts direct-entry 分支自动调用 `bootstrapElectronShell()`。 |
| 374 | ui/apps/electron-win/src/main.ts:11,94 ALLOWED_SHELL_COMMANDS/isShellCommandAllowed 导出但no IPC handler 调用，allowlist 死代码 | `done` | Root cause: 早期把诊断命令 allowlist 留成未消费导出；现已删除这段死代码，避免制造“受限 shell”假象。 |
| 375 | ui/apps/electron-win/src/main.ts 缺 app.requestSingleInstanceLock，多iterations启动产生repeats进程 | `done` | Root cause: 桌面壳之前缺少单实例锁；现已puts启动阶段请求 `app.requestSingleInstanceLock()`。 |
| 376 | ui/apps/electron-win/src/main.ts:103-106 setWindowOpenHandler shell.openExternal(url) accepts任意 URL 未限 protocol，file:///javascript: 可注入 | `done` | Root cause: 窗口外链之前未限制协议；现已只允许 allowlist URL，其余统一 deny。 |
| 377 | ui/apps/electron-win/src/main.ts webContents 未注册 will-navigate 守卫，渲染层重定向到外域bypassing沙箱 | `done` | Root cause:  webContents 之前缺少 `will-navigate` 防护；现已拦截跨域导航并改走 allowlisted external open。 |
| 378 | ui/apps/electron-win/src/main.ts no session.defaultSession.webRequest CSP 头注入 | `done` | Root cause:  Electron 响应头之前没有注入 CSP；现已通过 `session.defaultSession.webRequest.onHeadersReceived` 注入。 |
| 379 | ui/apps/electron-win/src/main.ts 缺 autoUpdater 接线（package.json relies on electron-updater 但更新no入口） | `done` | Root cause:  `electron-updater` relies on已声明但未接线；现已puts壳启动时dynamically导入并执lines `checkForUpdatesAndNotify()`。 |
| 380 | ui/apps/electron-win/src/main.ts 缺 app.on('window-all-closed') occurrences理，macOS 退出语义错 | `done` | Root cause: 桌面壳之前漏掉 `window-all-closed` 平台语义；现已补 darwin 例外vs非 darwin 退出逻辑。 |
| 381 | ui/apps/electron-win/src/preload.ts:34-35 AA_ELECTRON vs **AA_ELECTRON** 同对象references用，渲染层覆写其一即同时污染另一 | `done` | Root cause: 旧 preload 双重暴露导致两个globally名共享同一references用；现已收口为单一冻结 bridge，不再存puts联动污染面。 |
| 382 | ui/apps/electron-win/src/preload.ts:27 installElectronBridge(target,bridge) 第一参 target:Window only占位 (void target)，API 误导 | `done` | Root cause:  `installElectronBridge(target, ...)` 之前把 target 当占位参数；现实现已putsno `contextBridge` 时真正把 bridge 安装到传入 target。 |
| 383 | ui/apps/electron-win/src/renderer.js:1-43 桌面 splash 全英文hardcodes，no i18n/RTL，vs web 主壳脱节 | `done` | Root cause:  Electron fallback 文案之前只有英文常量；现已按 `document.lang` 输出中英文本地化文案。 |
| 384 | electron-win/renderer.js 手写 DOM 占位，未加载 React 主应用 | `done` | Root cause:  review 基于only有 fallback shell 的旧Status；当前主窗口优先加载 `../../web/dist/index.html`，手写 DOM only作为 web 构建缺失时的回退壳。 |
| 385 | electron-win/index.html "Electron Windows Shell Baseline" 占位文案直交付 | `done` | Root cause: 交付页标题曾是 baseline 占位；现已改为正式产品标题vs加载文案。 |
| 386 | electron-win/package.json electron@^42.1.0 don't exist | `done` | Root cause:  review 记录停留putsnon-existent `electron@^42.1.0`；当前包版本已是可安装的 `^31.0.0`。 |
| 387 | electron-win/main.ts:9 rendererHtmlPath = "../dist/index.html"，但包no build 脚本产生该文件，生产启动 404 | `done` | Root cause:  Electron build 之前只编译 TS，不复制 fallback shell 资源；现已puts构建阶段生成 `dist/index.html` vs `dist/renderer.js`，主进程 fallback 路径不再悬空。 |
| 388 | electron-win/main.ts:118-126 globalShortcut.register 返回值丢弃；conflicts静默 | `done` | Root cause: 快捷键注册之前只调用 `globalShortcut.register()` 不消费返回值；现已puts注册失败时显式记录错误。 |
| 389 | electron-win/main.ts:159-164 no will-quit/window-all-closed vs globalShortcut.unregisterAll()，OS 级快捷键泄漏 | `done` | Root cause: 桌面壳早期没把快捷键注销纳入生命周期；现已puts `will-quit` 注销并补齐 `window-all-closed` 退出语义。 |
| 390 | electron-win/preload.ts:34-35 同时以 AA_ELECTRON 和 **AA_ELECTRON** 两个名字暴露 bridge | `done` | Root cause:  preload 之前保留了 legacy 私有别名；现已收口成单一冻结后的 `AA_ELECTRON` bridge。 |
| 391 | electron-win/preload.ts:27-28 installElectronBridge(target,...) 立即 void target; 丢弃参数 | `done` | Root cause:  preload 安装函数最初把 `target` only当占位参数；现已putsno `contextBridge` 时真正把 bridge 安装到传入窗口对象。 |
| 392 | electron-win/index.html:8 Electron CSP 缺 worker-src vs report-uri | `done` | Root cause:  Electron 壳的 CSP 只覆盖了最基础指令；现已补充 `worker-src` vs `report-uri`，并synchronous到主进程响应头注入。 |
| 393 | electron-win/package.json:15-19 build.win.signAndEditExecutable: true 但仓库no签名配置，CI 必失败 | `done` | Root cause:  Windows 打包配置accesses along用了需要签名物料的开关，但仓库并未提供签名链路；现已defaults to关闭 `signAndEditExecutable`。 |
| 394 | ui/eslint.config.js:25 不 ignore apps/electron-win/dist/** vs tauri 构建产物 | `done` | Root cause:  lint ignore 列表只覆盖了 web dist，未覆盖 Electron/Tauri 产物目录；现已补齐桌面壳构建产物忽略规则。 |

## ui/apps/tauri-*

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 395 | ui/apps/tauri-linux/src/index.ts 同 mobile 的 adapter-per-render 反模式 | `done` | Root cause: 该条 review 误把 React 壳Issue投到了纯适配器工厂文件；`src/index.ts` only暴露适配器工厂vs manifest，don't exist render 时重建适配器路径。 |
| 396 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:16 CSP img-src 'self' data: https: https: 通配等同任意外站；缺 worker-src/font-src/media-src | `done` | Root cause:  Linux Tauri CSP 之前图省事放开了 `https:` 通配且漏了 worker/font/media；现已收紧为本地资源并补全缺失指令。 |
| 397 | tauri-macos/src-tauri/tauri.conf.json:30 pubkey: "macos-demo-public-key" 占位，updater accepts伪造更新 | `done` | Root cause:  macOS updater 一直occurrences于“占位接线”Status却仍defaults to激活；现已defaults to关闭 updater，避免带着假公钥上线。 |
| 398 | tauri-macos/src-tauri/tauri.conf.json:21、tauri-linux/src-tauri/tauri.conf.json:23 updater 端点 automatic-agent.example 假 TLD | `done` | Root cause: 桌面壳配置曾hardcodes示例域名作为发布端点；现已关闭defaults to updater 并移除占位端点。 |
| 399 | tauri-linux/src-tauri/tauri.conf.json no pubkey 字段，签名校验未配 | `done` | Root cause:  Linux updater 之前被defaults to开启，但没有任何签名校验配置；现已defaults to停用 updater，避免no验签通道暴露。 |
| 400 | tauri-macos/src-tauri/tauri.conf.json:33 plugins.shell.open: true no scope 白名单 | `done` | Root cause:  Tauri shell capability 之前直接全开；现已defaults to关闭 shell open。 |
| 401 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:26-34 shell.open:true os.all:true notification.all:true 过宽 capability | `done` | Root cause:  Linux Tauri capabilities 最初以“全部可用”占位；现已把 shell/os/notification 全部defaults to收紧。 |
| 402 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:20-25 updater no pubkey，Linux updater 签名不校验 | `done` | Root cause:  Linux updater 配置occurrences于半接线Status，只配 endpoint 不配 pubkey；现已defaults to关闭 updater。 |
| 403 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:23 updater endpoint .example 占位指向死域名 | `done` | Root cause:  Linux updater 使用了示例域名占位；现已清空defaults to端点并停用 updater。 |
| 404 | ui/apps/tauri-macos/src-tauri/tauri.conf.json:25 pubkey:"macos-demo-public-key" 占位，验签必 fail | `done` | Root cause:  macOS updater 之前保留了演示公钥；现已defaults to关闭 updater，而不是带着假secret发布。 |
| 405 | ui/apps/tauri-macos/src-tauri/tauri.conf.json:31-39 同 linux 的 os.all/shell.open/notification.all 过宽 | `done` | Root cause:  macOS Tauri 配置vs Linux 一样accesses along用了广开 capability 的占位值；现已synchronous收紧。 |

## ui/apps/mobile

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 406 | apps/mobile/src/App.tsx:13 createMobilePlatformAdapter(detectPlatform()) no useMemo，每iterations渲染重建适配器 | `done` | Root cause:  mobile 壳之前puts render 阶段直接创建 adapter；现已把平台探测和 adapter 构造都收进 `useMemo`。 |
| 407 | apps/mobile/src/App.tsx:8 detectPlatform() relies on navigator.userAgent，纯 RN 环境会 fall-through 到 android | `done` | Root cause: 平台探测最初只relies on浏览器 UA；现已优先读取 React Native `Platform.OS`，再回退到 UA。 |
| 408 | apps/mobile/src/App.tsx:19,20 mobileNavigation.tabs[0]!、settingsSubRoutes[0]! 非空断言no fallback UI | `done` | Root cause:  mobile 壳之前defaults to导航配置永不为空；现已移除非空断言并加入显式 fallback UI。 |
| 409 | ui/apps/mobile/src/App.tsx:13 createMobilePlatformAdapter() 内联渲染no useMemo，每iterations重建 adapter | `done` | Root cause: vs 406 相同，适配器创建逻辑直接内联puts组件体；现已 memo 化。 |
| 410 | apps/mobile/metro.config.js:1 CJS 写法但父 package.json:5 "type":"module" | `done` | Root cause:  Metro 配置accesses along用了 CommonJS 模板，但 workspace 已切到 ESM；现已改为 ESM 配置文件。 |
| 411 | apps/mobile/app.json:1-4 only name/displayName，缺 expo/scheme/version/orientation | `done` | Root cause: 移动端 app manifest 只有最小占位字段；现已补齐 Expo 基础元数据。 |
| 412 | ui/apps/mobile/app.json:1-4 only name/displayName，缺 expo/iOS bundleIdentifier/Android package/icons/permissions，no法构建发布 | `done` | Root cause: 发布侧移动端元信息长期缺席；现已补齐 iOS/Android 标识、图标占位资源vs权限声明。 |
| 413 | ui/apps/mobile/package.json:11 only smoke 脚本，缺 start/android/ios/build；react-native relies on却no metro bundler relies on声明 | `done` | Root cause:  mobile workspace 只保留了 smoke 占位脚本，没有真实开发/打包命令；现已补齐 start/android/ios/build 脚本vs Metro relies on。 |
| 414 | ui/apps/mobile/metro.config.js:11 unstable_enablePackageExports:true 但 monorepo packages 未声明 exports 字段，运lines时解析失败 | `done` | Root cause:  Metro 解析器曾过早启用 package exports 模式，但 monorepo 并未全面声明 `exports`；现已defaults to关闭该开关。 |

## ui/packages/ui-core (components, charts, layouts)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 415 | ui/packages/ui-core/src/index.tsx:53-66 createFeatureModule Component only try/catch synchronous渲染错误，hooks 内异步抛错不被捕获 | `done` | Root cause:  feature module 之前用函数级 `try/catch` 冒充错误边界；现已改成真正的 React error boundary 包装 feature 子树。 |
| 416 | ui/packages/ui-core/src/components/FeatureScaffold.stories.tsx only 1 个 Basic story，Card/Panel/Tabs/Drawer/Accordion/Stepper/PieChart 等 30+ 组件零故事 | `done` | Root cause:  Storybook 只保留了 `FeatureScaffold` 最小故事；现已新增 extended 组件vs图表展示故事，覆盖交互原语vs数据可视化基线。 |
| 417 | ui/packages/ui-core/src/components/extended.tsx:217-219 Tooltip only给 span 设 title+aria-label no keyboard focusable，触发不了 hover 显示 | `done` | Root cause:  tooltip 容器之前不可聚焦；现已让 wrapper 可聚焦，键盘user也能触发提示。 |
| 418 | ui/packages/ui-core/src/components/extended.tsx:221-228 Drawer no focus trap/ESC 关闭/overlay/focus return，违反 dialog WAI-ARIA | `done` | Root cause:  Drawer 早期只是固定定位的侧栏容器；现已补 focus trap、ESC、overlay 和焦点回退。 |
| 419 | ui/packages/ui-core/src/components/extended.tsx:233-236 Toast role="status" vs aria-live="assertive" 角色/活区双指令conflicts | `done` | Root cause:  Toast 之前把危险态继续渲染成 `status`；现已把危险态改为 `alert`，其余保持 `status/polite`。 |
| 420 | ui/packages/ui-core/src/components/extended.tsx:166-173 Pagination 直接渲染 totalPages 个按钮，10⁴ 页 DOM 爆炸 | `done` | Root cause: 分页控件以前按页数full展开；现已改为窗口化分页vs省略号。 |
| 421 | ui/packages/ui-core/src/components/extended.tsx:185-196 Tabs 缺左右箭头键导航/aria-controls/tabindex 管理 | `done` | Root cause:  Tabs 之前只有点击切换；现已补齐箭头键、`aria-controls` vs roving tabindex。 |
| 422 | ui/packages/ui-core/src/components/extended.tsx:199-215 Accordion 按钮no aria-controls 指向内容，内容 div no id/role=region | `done` | Root cause:  Accordion 之前只切显示Status，不建语义关联；现已为 trigger/panel 建立 id vs region 关系。 |
| 423 | ui/packages/ui-core/src/components/extended.tsx:329-353 SegmentedControl role=radiogroup 但no方向键导航vs roving tabindex | `done` | Root cause: 分段控件之前只声明了 radiogroup 语义，没实现键盘lines为；现已补方向键vs roving tabindex。 |
| 424 | ui/packages/ui-core/src/components/extended.tsx:439-453 formatRemainingDuration new Date(deadline) no效字符串得 NaN，输出 "NaNm remaining" | `done` | Root cause:  SLA 倒计时之前defaults to任何字符串都能转成合法时间；现已对非法时间返回明确 fallback 文案。 |
| 425 | ui/packages/ui-core/src/components/extended.tsx:117-127 Skeleton 用 aria-hidden 但no motion 动画，loading Status对低视力user不可感知 | `done` | Root cause: 骨架屏之前只有静态渐变块；现已补 shimmer 动画。 |
| 426 | ui/packages/ui-core/src/components/extended.tsx:8-9,16 StatusPill 文字色hardcodes #04130a，主题切换后对比度no法保证 WCAG AA | `done` | Root cause: Status胶囊颜色之前hardcodesputs组件里；现已改用 design token 文本色，而不是固定十六进制。 |
| 427 | ui/packages/ui-core/src/components/extended.tsx:265-272 Stepper only活跃步显 aria-current="step"，其他步缺 aria-disabled/aria-current="false" 且no role="list" 关系 | `done` | Root cause:  Stepper 之前只是视觉列表；现已补 list/listitem 关系和当前/禁用Status语义。 |
| 428 | ui/packages/ui-core/src/components/index.ts:195 FeatureWorkbench onChange:(event:Event)=>... 用 DOM Event 而非 React.ChangeEvent | `done` | Root cause:  workbench 输入框事件类型之前accesses along用了原生 DOM `Event`；现已改为 React 合成事件类型。 |
| 429 | ui/packages/ui-core/src/components/index.ts:238 onKeyDown:(event:KeyboardEvent)=> 用 DOM 类型而非 React 合成事件 | `done` | Root cause:  workbench 键盘事件类型之前也写成了 DOM `KeyboardEvent`；现已统一为 React 键盘事件。 |
| 430 | ui/packages/ui-core/src/components/index.ts:153-160 triggerAction await action.onTrigger?.(item) has no try/catch，user回调抛错变 unhandled rejection | `done` | Root cause:  workbench action 之前直接 await 外部回调；现已补结构化失败捕获，避免未occurrences理 rejection。 |
| 431 | ui/packages/ui-core/src/components/index.ts:46-52 KeyValueTable key:row.key 作 React key，两lines同 key 即conflicts | `done` | Root cause:  KeyValueTable 之前假定业务 key globally唯一；现已改成 key+index 复合键。 |
| 432 | ui/packages/ui-core/src/components/index.ts:138 filter.toLowerCase() 而非 toLocaleLowerCase，土耳其 i/I locale 折叠失败 | `done` | Root cause:  workbench 过滤逻辑之前只做 ASCII 小写化；现已切到 locale-aware lowercasing。 |
| 433 | ui/packages/ui-core/src/components/index.ts:230-269 Workbench 列表 <button role=option>，listbox 缺 aria-activedescendant/单 tabstop | `done` | Root cause:  workbench 列表之前把每个 option 都做成独立 button；现已改成单 tabstop listbox + `aria-activedescendant` 模式。 |
| 434 | ui/packages/ui-core/src/components/index.ts:288 aria-relevant="additions text" 缺 removals，活动日志删除条目no通报 | `done` | Root cause: 活动日志 live region 之前只通报新增；现已把 removals 纳入 `aria-relevant`。 |
| 435 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:99-101 "mock" in ResizeObserver 启发式判断，含 mock 字段的真 class 误走 callable 路径 | `done` | Root cause:  ResizeObserver 构造分支之前relies on `mock` 字段启发式；现已删掉该分支，只保留受控 constructor fallback。 |
| 436 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:119,123 useMemo relies on数组含 ...chartColorDeps 不定长，违反 React hooks 静态relies on契约 | `done` | Root cause: 图表 option memo 之前展开了不定长relies on数组；现已改成显式静态relies on列表。 |
| 437 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:153 初始化 useEffect relies on [] 但闭包捕获 theme/buildChartOption，主题运lines时切换不重建 chart | `done` | Root cause:  review 关注的是图表主题更新no法生效；现实现已把主题变化收进 option 更新 effect，运lines时换肤会重新 setOption。 |
| 438 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:166-172 setOption 已替换数据后再 appendData repeats尾部，序列出现重影 | `done` | Root cause:  append-only 更新之前先对full数据 `setOption`，再 append 尾段；现已puts追加模式下只对旧序列 setOption，再 append 新尾段。 |
| 439 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:128-129 userAgent.includes("jsdom") 字符串嗅探，自定义 UA 即误判跳过初始化 | `done` | Root cause: 图表初始化之前通过 UA 嗅探跳过 jsdom；现已去掉该字符串嗅探。 |
| 440 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:138 addEventListener("resize") 绑到 mount 时 defaultView，容器移植到新 window 不再触发 | `done` | Root cause: 图表尺寸更新之前同时relies on mount 时的 window resize 监听；现已收口为容器级 ResizeObserver。 |
| 441 | ui/packages/ui-core/src/charts/index.tsx:160 HeatmapGrid 颜色hardcodes rgba(34,197,94,a)，no法跟随 theme 变化 | `done` | Root cause: 热力图颜色之前hardcoded为绿色 RGBA；现已改用 design token accent 色并dynamically注入透明度。 |
| 442 | ui/packages/ui-core/src/charts/index.tsx:80-81 ScatterPlot only取 maxX/maxY，负值vs零基线散点跑出 viewBox | `done` | Root cause: 散点图坐标映射之前只按最大值归一；现已按 min/max 区间共同归一。 |
| 443 | ui/packages/ui-core/src/charts/index.tsx:63 BarChart 直接将外部 point.tone 字符串塞 background，未做 CSS 值白名单 | `done` | Root cause: 柱状图之前把外部 `tone` 当任意 CSS 值直塞样式；现已改为 allowlist 映射。 |
| 444 | ui/packages/ui-core/src/charts/index.tsx:55,83,111,140 chart 用 role="img" aria-label 隐藏数据，未提供 table 可展开 SR 文本 | `done` | Root cause: 轻量图表之前只暴露概要 aria-label；现已为 bar/scatter/gauge/heatmap 加入可展开数据表。 |
| 445 | ui/packages/ui-core/src/charts/index.tsx:142 <span /> 空 placeholder no aria-hidden，屏读器读出空 cell | `done` | Root cause: 热力图左上角空占位单元格之前没有 `aria-hidden`；现已显式隐藏。 |
| 446 | ui/packages/ui-core/src/charts/echart-surface.tsx:11 lazy(()=>import(...)) no错误边界包裹，Suspense fallback 不occurrences理 chunk load failure | `done` | Root cause:  EChart lazy runtime 之前只有 Suspense fallback，没有 chunk load error boundary；现已增加运lines时错误边界。 |
| 447 | ui/packages/ui-core/src/layouts/index.ts:26 ThreePaneLayout 接 viewportWidth prop 但 26-41 完全不使用，死参 | `done` | Root cause: 三栏布局曾遗留未消费的 `viewportWidth` 占位参数；现已移除死参，避免错误 API 暗示。 |
| 448 | ui/packages/ui-core/src/layouts/index.ts:25-41 三栏no aside/main/aside landmark，左中右皆 <div> no aria-label | `done` | Root cause: 早期布局只做视觉栅格，没把信息架构映射到 landmark；现已改为 `aside/main/aside` 并补 `aria-label`。 |
| 449 | ui/packages/ui-core/src/components/extended.tsx:401-408 PieChart gradientStops 累积 percent 浮点累加，1000+ 切片精度漂移产生裂缝 | `done` | Root cause: 饼图渐变起止百分比之前反复切片求和，累计浮点误差；现改为单iterations累加并对末片收口到 `100%`。 |
| 450 | ui/packages/ui-core/src/components/extended.tsx:411-422 PieChart only aria-label="Pie chart" 未声明 role，screen reader 不读切片明细 | `done` | Root cause: 饼图之前只有粗粒度标签；现已补 `role="img"` 的标题/描述关联，读屏可读取切片明细。 |
| 451 | ui/packages/ui-core/src/components/extended.tsx:524-541 DAGVisualization repeat(stages.length,1fr) 单lines布局，20+ stage 时列宽<阅读threshold且no横向滚动 | `done` | Root cause:  DAG 卡片宽度此前线性挤压puts单lines等分列中；现改为最小列宽 + 横向滚动，长流水线可读。 |
| 452 | ui/packages/ui-core/src/components/extended.tsx:265-272 Stepper 用 <ol> 但内部 <li> no role/链接，键盘 tab 跳过整序列 | `done` | Root cause:  Stepper 之前只保留视觉序列，没有稳定的可聚焦语义；现已补列表项语义并放开已到达步骤的 tab 访问。 |
| 453 | ui/.storybook/main.ts:5 stories glob only扫 packages/ui-core/**，所有 packages/features/* vs packages/shared/ui/* 故事零覆盖 | `done` | Root cause:  Storybook 配置只覆盖 `ui-core`；现已扩展到 `features/*` vs `shared/*` 的 stories。 |

## ui/packages/shared/api-client (rest, ws, interceptors)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 454 | ui/packages/shared/api-client/src/rest-client.ts:~398 fallbackTransport puts 401/403 重试失败后悄然返回 mock，遮蔽 auth 失败 | `done` | Root cause:  fallback 逻辑此前doesn't distinguish HTTP 语义错误vs网络错误；现只puts非 `RestHttpError` 场景允许 fallback，不再吞掉鉴权失败。 |
| 455 | ui/packages/shared/api-client/src/rest-client.ts:255-327 重试循环把 4xx 当 transient，no效重试放大限流 | `done` | Root cause: 重试判定曾把客户端错误也视作可恢复；现only对 `429/5xx` 和允许重试的请求放lines。 |
| 456 | ui/packages/shared/api-client/src/rest-client.ts defaults to credentials:"include" 跨域请求，CSRF/cookie 泄漏 | `done` | Root cause:  HTTP transport defaults to值过宽；现defaults to收敛为 `same-origin`，跨域 cookie 不再自动外带。 |
| 457 | ui/packages/shared/api-client/src/rest-client.ts 直接 crypto.randomUUID() no globalThis guard，jsdom/旧 Node 失败 | `done` | Root cause: 请求 envelope id 直接relies on `crypto.randomUUID()`；现统一走带 fallback 的 `generateStableId()`。 |
| 458 | ui/packages/shared/api-client/src/interceptors.ts:49 createTraceInterceptor 同样 crypto.randomUUID() no fallback | `done` | Root cause:  trace id 生成vs transport 一样直接绑死浏览器 crypto；现复用稳定 id 生成器，测试环境可运lines。 |
| 459 | ui/packages/shared/api-client/src/interceptors.ts:243 createRetryInterceptor 重试一切错（含 4xx/AbortError），no status allowlist | `done` | Root cause: 拦截器级重试曾缺少错误类型和幂等边界；现已排除 `4xx/AbortError` 并要求请求本身可安全重试。 |
| 460 | ui/packages/shared/api-client/src/interceptors.ts:274 createDedupeInterceptor module-levelsingletonStatus，跨 vitest 文件泄漏 | `done` | Root cause:  dedupe 观测态曾设计得过宽；现Statusonly封装puts interceptor 实例内，并puts响应后清理，不跨实例泄漏。 |
| 461 | ui/packages/shared/api-client/src/interceptors.ts:294 dedupe key 用 JSON.stringify(body)，对象键序不稳即缓存失效 | `done` | Root cause:  dedupe key 之前直接 `JSON.stringify`，对象键序不同即视为不同请求；现改为稳定序列化。 |
| 462 | ui/packages/shared/api-client/src/interceptors.ts:188 createOfflineQueueInterceptor 把 HEAD/OPTIONS 也入队，replay 风暴 | `done` | Root cause: 离线入队条件此前only排除了 `GET`；现显式排除 `HEAD/OPTIONS`，避免no意义 replay。 |
| 463 | ui/packages/shared/api-client/src/interceptors.ts:294 vs 312 两站点 dedupe key 格式不同，跨站点查找never matches | `done` | Root cause: for deduplication key puts `onRequest` vs `intercept` 两occurrenceseach拼接；现统一复用同一个 `buildKey()`。 |
| 464 | ui/packages/shared/api-client/src/ws-client.ts:48 eventId 正则 ^evt[-_][A-Za-z0-9:-]{1,}$ 比 contract 窄，合法 id puts 252 lines被丢 | `done` | Root cause:  replay event id 校验过窄；现已放宽到契约允许的字符集，不再误丢合法事件。 |
| 465 | ui/packages/shared/api-client/src/ws-client.ts:218 token 走 Sec-WebSocket-Protocol 子协议传输，被代理/访问日志记录 | `done` | Root cause: 早期 WS 鉴权设计曾混淆 token vs子协议；当前实现已固定子协议名，token onlyputs首条 auth message 中发送。 |
| 466 | ui/packages/shared/api-client/src/ws-client.ts:336 重连 jitter 用 Math.random() no可注入种子，测试不可复现 | `done` | Root cause: 重连退避此前硬绑 `Math.random()`；现通过 options 注入随机源，测试可复现。 |
| 467 | ui/packages/shared/api-client/src/shared-ws-worker.ts:207 self.onconnect=… 模块顶层执lines，被任意 import 即puts错误 global 上挂 handler | `done` | Root cause:  SharedWorker 运lines时之前puts模块顶层直接安装 handler；现改为显式安装函数并带运lines环境 guard。 |
| 468 | ui/packages/shared/api-client/src/shared-ws-worker.ts:172 reconnectTimer 调度新 setTimeout 前未置空，可叠多个定时器 | `done` | Root cause:  worker 重连 timer puts回调触发后未复位；现先置空再重连，避免计时器叠加。 |
| 469 | ui/packages/shared/api-client/src/ws-event-router.ts:74 subscribe 不for deduplication handler，repeats注册触发两iterations | `done` | Root cause: 事件路由器之前只追加 cleanup，没有按 channel for deduplication；现以 channel 维度维护订阅表。 |
| 470 | ui/packages/shared/api-client/src/ws-event-router.ts disconnect() 不清 listener registry，重连后路由到上iterations ghost handler | `done` | Root cause: 断开连接时过去只调用 dispose，不清内部 registry；现 disconnect 会一并清空 channel cleanup 表。 |
| 471 | 04-runtime-sequence.md:145 references用需复核的 ui/packages/shared/api-client/... | `done` | Root cause: 运lines时时序文档只列了 endpoint 落点，漏掉 `interceptors/rest/ws/router`；现已synchronous补齐references用。 |
| 472 | ui/vitest.config.ts jsdom 环境未 polyfill crypto.randomUUID/crypto.subtle，导入即用的 interceptors/ws-client puts单测崩溃 | `done` | Root cause: 测试启动文件未补浏览器 crypto 能力；现 `ui/tests/setup.ts` 已兜底 `webcrypto/randomUUID`。 |
| 473 | ui/tests/shared/api-client.test.ts:193 mutate document.head.innerHTML，QueryClient 永不释放，跨 spec 泄漏定时器 | `done` | Root cause: 共享 API 测试此前直接污染 `document.head` 且未统一清场；现 suite 结束后显式清理 DOM 侧Status。 |
| 474 | ui/tests/unit/ui/shared/ws-client.test.ts:158 relies on setTimeout(…,10) 排断言序，慢 CI 即 flake | `done` | Root cause:  WS 单测曾靠真实时间片排顺序；现改为 fake timers / tick 驱动，CI 不再脆弱。 |
| 475 | ui/tests/unit/ui/shared/ws-client.test.ts:269 单 it 内 vi.spyOn(Math,"random") no per-test mockRestore，后续 it 继承 spy 至 afterEach | `done` | Root cause: 测试之前直接globally spy `Math.random()`；现改为给 `BrowserWSClient` 注入随机源，不再污染globally。 |
| 476 | shared/api-client interceptor 组合 createIdempotencyKeyInterceptor 注册早于 createRetryInterceptor，重试时重新生成 idempotency key 击穿服务端for deduplication | `done` | Root cause:  review 基于旧重试假设；当前 idempotency key puts `onRequest` 阶段生成一iterations，重试复用同一 request/header，不会重生 key。 |

## ui/packages/shared/auth & token

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 477 | ui/packages/shared/auth/src/auth-service.ts:121-126 handleSsoCallback 永抛 "auth.redirecting"，文档 happy path 是死代码 | `done` | Root cause:  SSO callback 入口之前只保留 fail-close redirect；现 code/state 回调已委托到 PKCE token exchange，happy path 可达。 |
| 478 | ui/packages/shared/auth/src/auth-service.ts SSO callback 解析 fragment 后未从 window.history 清除，token 留puts浏览器历史/后退栈 | `done` | Root cause: 认证回调清场步骤缺失；现回调结束统一 `history.replaceState()` 清除 code/token/error 参数。 |
| 479 | ui/packages/shared/auth/src/token-manager.ts access/refresh token 明文写 localStorage，XSS 即泄露 | `done` | Root cause: 会话持久化边界曾vs token 管理混淆；当前 `TokenManager` 保持内存态，auth store 持久化也已剔除 access/refresh token。 |
| 480 | api-auth-service.ts:228-231 verificationSecrets.some(...) 短路比较泄露 timing | `done` | Root cause:  review 指向了已下线的旧 `api-auth-service.ts` 实现；当前 shared/auth 路径已no该短路比较风险面。 |
| 481 | shared/auth (AuthSession) vs shared/state/auth-store (AuthStoreState) 两套会话模型字段overlaps，漂移静默 | `done` | Root cause:  shared/auth vs shared/state 之前each维护会话字段；现 auth store 会话类型直接对齐 shared/auth 会话模型。 |

## ui/packages/shared/sync

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 482 | ui/packages/shared/sync/src/offline-queue.ts:82 trimToCapacity 溢出丢最旧no telemetry/DLQ/caller 信号 | `done` | Root cause: 离线队列exceeds容时此前直接 `shift()` 丢弃；现支持 `onEvict` 回调，把丢弃事件暴露给调用方/telemetry。 |
| 483 | ui/packages/shared/sync/src/sync-coordinator.ts:107 replay 漏附 Authorization/X-CSRF-Token/Idempotency-Key/tenant header，refresh 后 401/403 风暴 | `done` | Root cause: 离线 mutation 类型之前未保留受保护请求头；现入队时持久化必要 headers，flush 时完整回放。 |
| 484 | ui/packages/shared/sync/src/conflict-resolver.ts:137 preferMostRecent puts时间戳缺/相等时回退 localValue，vs文档 server_wins defaults to相悖 | `done` | Root cause: 缺元数据时的兜底策略之前偏向 local；现改为only当 local 时间严格更新时才取 local，其余回落 server。 |
| 485 | ui/packages/shared/sync/src/conflict-resolver.ts 不校验 lastModified，伪造未来时间戳即每iterations胜 | `done` | Root cause: 时间戳比较之前no合理时钟漂移上限；现exceeds前时间会被视为no效，不再天然获胜。 |
| 486 | ui/tests/unit/ui/shared/sync-coordinator.test.ts:11 固定真未来日期 2026-05-01T00:00:00.000Z，比 Date.now() 类断言随时钟漂移 | `done` | Root cause: 相关 sync 回归用例曾relies on随日历漂移的时间假设；现改为固定语义断言，不再绑定真实时钟。 |

## ui/packages/shared/state (stores, query, mutations)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 487 | ui/packages/shared/state/src/stores/middleware.ts:19 cloneDraftValue 用 JSON 风格克隆，丢 Map/Set/Symbol 键/类实例 | `done` | Root cause: 草稿克隆之前只覆盖数组/普通对象；现优先用 `structuredClone`，并补 `Map/Set/Reflect.ownKeys` 分支。 |
| 488 | ui/packages/shared/state/src/stores/auth-store.ts:90 logout() Object.assign(draft, DEFAULT_AUTH_STATE) vsdefaults to对象共享数组references用，后续 mutation 别名defaults to | `done` | Root cause:  auth defaults to态之前是共享对象常量；现改为工厂生成defaults to态，每iterations logout 都拿到新副本。 |
| 489 | ui/packages/shared/state/src/stores/auth-store.ts:60 持久化 key aa-auth-store 包含明文 access/refresh token | `done` | Root cause:  auth store 持久化此前把完整会话直接落盘；现通过 `partialize` 去掉 access/refresh token。 |
| 490 | ui/packages/shared/state/src/stores/sync-store.ts:54 setPendingMutations 计数归零仍保留 syncing/error Status | `done` | Root cause:  pending 计数和 sync Status之前没有统一收敛规则；现 pending 归零时按conflicts/错误/空闲重新归并Status。 |
| 491 | ui/packages/shared/state/src/stores/sync-store.ts:88 resolveConflict 的 "merge" 分支静默 no-op | `done` | Root cause: 单conflicts决议曾被错误建模成globally策略副作用；现 local/server/merge 都只消解当前conflicts并清理错误态。 |
| 492 | ui/packages/shared/state/src/stores/sync-store.ts:94-99 单conflicts解决会改写globally strategy，跨no关conflicts渗透策略 | `done` | Root cause:  per-conflict resolution 之前直接覆写globally strategy；现已取消该副作用，策略只允许显式设置。 |
| 493 | ui/packages/shared/state/src/stores/notification-store.ts:33 generateId 用 Date.now()+Math.random()，突发碰撞且测试不可复现 | `done` | Root cause: 通知 id 之前relies on时间戳 + 随机拼接；现统一复用稳定 id 生成器，减少碰撞并可测试。 |
| 494 | ui/packages/shared/state/src/stores/realtime-store.ts:55 triggerPanic no逆操作且 store 持久化，panic Status过 reload 仍存活 | `done` | Root cause:  panic 之前既no清除动作也被持久化；现新增 `clearPanic()` 并puts持久化时强制落 `false`。 |
| 495 | ui/packages/shared/state/src/query-client.ts:11 工厂命名误且defaults to retry:3 让 TanStack Query 重试 4xx | `done` | Root cause: 查询客户端之前只有 `createQueryClientFactory()` 且defaults to `retry:3`；现补 `createQueryClient()` 别名，并把重试收敛到 `429/5xx`。 |
| 496 | ui/packages/shared/state/src/query-cache-persistence.ts:163 flush 忽略 in-flight 写，订阅突发 setTimeout 重置但前iterations写仍 pending 互相覆盖 | `done` | Root cause:  query cache 持久化之前没有writes串lines化；现通过 `writeChain` 顺序落盘，避免concurrent覆盖。 |
| 497 | ui/packages/shared/state/src/query-cache-persistence.ts:146 hydrate has no try/catch，IndexedDB 损坏即崩而非回退新缓存 | `done` | Root cause:  hydrate 之前defaults to信任持久化快照永远可读；现读取失败会 fail-close 并清理坏缓存。 |
| 498 | ui/packages/shared/state/src/query-cache-persistence.ts 任意 cache（含 PII）落 IndexedDB no脱敏/加密 | `done` | Root cause:  query cache 之前no持久化 allowlist；现只允许安全 query key 落盘，敏感缓存defaults to不持久化。 |
| 499 | ui/packages/shared/state/src/mutations/use-mutation.ts:81 调用user onMutate(variables, {} as QueryClient) 强转空对象，cache 调用即崩 | `done` | Root cause:  mutation hook 之前给 `onMutate` 传了伪造 QueryClient；现改为通过 `useQueryClient()` 传真实实例。 |
| 500 | ui/packages/shared/state/src/mutations/use-mutation.ts:88-91 onError only当 context?.previousData 真值时触发，onMutate 返 undefined 时错被吞 | `done` | Root cause: 错误回调此前错误relies on `previousData` 真值；现no论 snapshot 是否为空都会转发 `onError`。 |
| 501 | ui/packages/shared/state/src/mutations/use-mutation.ts:62-66 client.post/put/patch(resolvedPath, variables) 把整 variables（含路径参数 taskId 等）作 body | `done` | Root cause:  mutation body 之前defaults to直接透传 `variables`；现支持显式 `body`，并defaults to剔除已出现puts路径中的 `id/*Id` 字段。 |
| 502 | ui/packages/shared/state/src/mutations/optimistic-update.ts:54 snapshotCache 标 async 实no awaited 工作，API 误导 | `done` | Root cause:  `snapshotCache()` 之前错误声明为 async；现已收敛为synchronous API，语义vs实现一致。 |
| 503 | ui/packages/shared/state/src/mutations/optimistic-update.ts:84 patchCache 取消 query 但不自动 snapshot，调用者忘则 rollback 失效 | `done` | Root cause:  optimistic patch 之前不返回前态快照；现 `patchCache()` 会先抓取 snapshot 再更新缓存。 |
| 504 | ui/packages/shared/state/src/mutations/optimistic-update.ts:129 同 use-mutation 的 previousData gating bug | `done` | Root cause:  optimistic mutation options vs hook 共享同类 gating 失误；现两边都改成no条件转发 `onError`。 |
| 505 | ui/packages/shared/state/src/stores/* 持久化 store no schema migration，字段变形即 hydrate 崩，强迫user清 localStorage | `done` | Root cause:  persist middleware 长期未版本化；现 middleware defaults to注入 `version/migrate`，关键 store 也补了显式迁移配置。 |
| 506 | ui/packages/shared/state/src/stores/auth-store.ts 缺 storage 事件监听跨 tab，退出后另一 tab 仍持旧 token | `done` | Root cause:  auth store 之前只做本 tab 持久化，不监听跨 tab 变更；现已接入 `storage` 事件synchronous登出vs身份态。 |
| 507 | ui/packages/shared/state/src/query-client.ts no defaultOptions.queries.staleTime，所有 query 立即 stale，多 dashboard hook repeats请求风暴 | `done` | 查询缓存分层defaults to值缺失；已补 staleTime/gcTime vs重试边界，review 文档Statussynchronous回写 |
| 508 | ui/packages/shared/state/src/stores/realtime-store.ts 持久化+triggerPanic no panic 复位 API，离线重连后 UI 仍 panic | `done` | panic Status设计成单向触发且被持久化；已补 clearPanic 并禁止把 panicActivated 持久化 |
| 509 | ui/packages/shared/state/src/stores/notification-store.ts:33 generateId=Date.now()+Math.random() 作 React key，碰撞致同帧通知 DOM 复用错位 | `done` | 通知主键曾使用不稳定时间戳随机串；已切到 generateStableId 并回写 review Status |

## ui/packages/shared/i18n

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 510 | ui/packages/shared/i18n/src/index.ts:~185 setLocale puts模块初始化时 mutate documentElement.lang/dir，跨 jsdom 测试文件泄漏 DOM | `done` | i18n defaults to实例putsat construction time直接操作 document；已移除初始化期 DOM mutate，只puts显式 apply 时写 document |
| 511 | ui/packages/shared/i18n/src/index.ts sharedTranslationService 作singleton导出no reset，测试需触模块内部 | `done` | 共享翻译服务缺少生命周期出口；已补 resetSharedTranslationService/dispose 用于测试vs重建 |
| 512 | ui/packages/shared/i18n/src/index.ts:142 翻译命中失败回 key，UI 直接显示 ui.feature.xxx.title no telemetry 告警 | `done` | 缺失翻译被当作正常 fallback；已补 diagnostics reporter，puts miss/format error 时显式上报 |
| 513 | ui/packages/shared/i18n/src/index.ts:139 IntlMessageFormat.format(values) as string 强转，含选择器(<b>{name}</b>)时返数组类型不匹配 | `done` | 直接把 ICU format 结果断言成 string；已改成显式归一化格式化输出，兼容数组片段 |
| 514 | ui/packages/shared/i18n/src/index.ts:139 每iterations translate 都 new IntlMessageFormat(...)，no缓存热点 GC 风暴 | `done` | ICU formatter 未做复用；已references入按 locale+message 的 formatterCache |
| 515 | ui/packages/shared/i18n/src/index.ts:185 setLocale("zh-CN") defaults to调用强制初始化 mutate document，defaults to锁定 zh-CN 而非user偏好 | `done` | defaults to locale 被hardcodes为 zh-CN；已改为按 navigator 偏好探测，不再强制锁中文 |
| 516 | ui/packages/shared/i18n/src/index.ts:128-131 fallback chain 不for deduplication locale+catalog.fallbackLocales+fallbackLocale，repeats值时同 catalog 多iterations访问 | `done` | fallback 链构建使用数组直推；已改成 Set for deduplication后再解析 |
| 517 | ui/packages/shared/i18n/src/index.ts:153 locale.split("-")[0] 空字符串时为 ""，detectLocale 退化为前缀全等空串 | `done` | locale 基语言段未校验空串；已puts detectLocale 中跳过空 baseLanguage |
| 518 | ui/packages/shared/i18n/src/index.ts:206-218 translateFeatureCopy 对每个 featureId 调 translateMessage 两iterations，N feature 即 2N iterations IntlMessageFormat 创建 | `done` | feature 文案解析逐 key 走完整翻译链；已改用 translateMany 共享查找链并复用 formatter cache |
| 519 | ui/packages/shared/i18n/src/index.ts:111-118 applyLocaleToDocument mutate documentElement.lang/dir；未puts dispose 路径清理 | `done` | document lang/dir writes缺少回滚快照；已记录旧值并puts dispose 时恢复 |

## ui/packages/shared/platform adapter

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 520 | ui/packages/shared/platform/src/desktop-platform-adapter.ts:13 读 window.AA_ELECTRON no完整性校验，XSS 可伪造桥 | `done` | Electron 桥原先直接信任globally对象；已要求冻结对象+签名+方法校验后才接桥 |
| 521 | ui/packages/shared/platform/src/desktop-platform-adapter.ts:~86 runShell accepts任意命令no allowlist，渲染层被入即 RCE | `done` | shell 通道缺少最小权限约束；已收敛为 allowlist 命令并先走本地校验再调用桥 |
| 522 | ui/packages/shared/platform/src/web-platform-adapter.ts 写 localStorage no QuotaExceededError occurrences理，配额满即所有写抛 | `done` | 浏览器存储原本应是 best-effort；现代码已对 localStorage writes做 try/catch，review 文档Status回写 |

## ui/packages/shared/telemetry

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 523 | ui/packages/shared/telemetry/src/index.ts:89 no exporter 时 buffer 满静默丢只留最新 | `done` | buffer overflow 被当成no声淘汰；已把被裁剪事件转入 dead letter 并保留原因 |
| 524 | ui/packages/shared/telemetry/src/index.ts:150 splice(0,length) 后 await 期间concurrent record() vs unshift 幸存者竞态破序 | `done` | flush 批iterationsvs缓冲区no显式 in-flight 边界；已拆出 flushingEntries，先synchronous摘批iterations再回插幸存者 |
| 525 | ui/packages/shared/telemetry/src/index.ts:233-235 OtlpHttpTelemetryExporter 构造synchronous抛错，且only校验小写 authorization 头 | `done` | OTLP 认证头校验大小写敏感；已改为大小写no关解析 authorization |
| 526 | ui/packages/shared/telemetry/src/index.ts:295-306 measureDuration has no try/catch，fn() synchronous抛使起始 performance.mark 孤儿 | `done` | duration 包装器只覆盖 Promise.finally；已补synchronous异常路径，保证 end mark/measure 总会落下 |
| 527 | ui/packages/shared/telemetry/src/index.ts:399 PerformanceObserver.observe({type,buffered:true}) 旧 Safari/FF 不支持，try 吞错静默丢 vitals | `done` | 浏览器兼容异常被裸吞；已puts fallback 中显式 warn/report 不再静默丢信号 |
| 528 | ui/packages/shared/telemetry/src/index.ts:141 dispose() 置 disposed 后异步 flush，期间 record() no-op 但 in-flight 未必被 caller await | `done` | dispose 设计成 fire-and-forget；已改为 async dispose，可 await flush 完成 |

## ui/packages/features (approval, dashboard, conversation, alerts, etc.)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 529 | ui/packages/features/approval/src/web/index.tsx:25 选中按钮背景色 #12201a、边框 #334155 hardcodes跳过 design-token | `done` | review 时基于旧实现，现网代码已改用 designTokens，文档Status回写 |
| 530 | ui/packages/features/approval/src/web/index.tsx:62 Delegate button aria-describedby={delegateInputId} 指向 <input> 而非描述文本 | `done` | 可访问性描述关系绑错目标元素；已改为指向专用描述文本节点 |
| 531 | ui/packages/features/approval/src/hooks/index.ts:50-62 approvalFeedVersion 用 : 拼接字段，taskId 含 : 即版本键碰撞 | `done` | 版本键由字符串拼接构造；已改成结构化 JSON 序列化避免碰撞 |
| 532 | ui/packages/features/approval/src/hooks/index.ts:146-158 delegate 失败时no rollback（vs approve/reject inconsistent），UI 永久乐观删除 | `done` | 委派路径漏掉失败回滚分支；已vs approve/reject 对齐恢复快照 |
| 533 | ui/packages/features/approval/src/hooks/index.ts:176-188 approveBatch/rejectBatch Promise.all 一条失败即拒整批 | `done` | 批occurrences理错误模型错误地使用 all-or-nothing；已改用 allSettled，only移除成功项并抛聚合错误 |
| 534 | ui/packages/features/approval/src/hooks/index.ts:76 useEffect relies ononly [approvalFeedVersion]，eslint exhaustive-deps 缺 queryApprovals references用 | `done` | effect relies on表达vs数据synchronous源inconsistent；已references入基于版本键的稳定 approvals references用再入relies on |
| 535 | ui/packages/features/dashboard/src/hooks/index.ts:120-318 buildPanelGroups 标题/描述全 zh-CN hardcodes | `done` | dashboard 面板文案直接hardcodedputs hook；已全部迁移到 shared i18n catalog |
| 536 | ui/packages/features/dashboard/src/hooks/index.ts:390-405 useDashboardVm 6 query hook no门控并lines fire；mapDashboardSnapshotToVm 未 memo | `done` | dashboard 二级查询putsno主快照时也并lines触发且 VM 每iterations重算；已为二级查询加 enabled 门控并 memo VM 映射 |
| 537 | ui/packages/features/dashboard/src/hooks/index.ts:56-58 formatRatio(value) 不 clamp，agent.load<0 或>1 时输出非法百分比 | `done` | 比例格式化defaults to信任上游数据；已对 ratio 做 0..1 clamp |
| 538 | ui/packages/features/dashboard/src/hooks/index.ts:60-65 formatMetricValue String(metric.value) puts value 为对象时变 [object Object] | `done` | 指标值格式化只做粗暴字符串化；已改为 primitive 保留、对象 JSON 序列化 |
| 539 | ui/packages/features/dashboard/src/hooks/index.ts:67-72 findMetric 按 label 字符串 "Queue Throughput" 等匹配，后端翻译即查不到 | `done` | 指标查找把英文 label 当稳定主键；已改成 id/label 归一化别名匹配 |
| 540 | ui/packages/features/dashboard/src/hooks/index.ts:352-362 trendValues 把百分比vs原始计数混入同一序列，趋势图 Y 轴含义崩坏 | `done` | 趋势序列混用不同量纲；已统一改成百分比归一化序列 |
| 541 | ui/packages/features/conversation/src/hooks/index.ts:48 模块顶层 new QueryClient() singleton，跨测试/SSR 实例污染且不 GC | `done` | 会话持久层错误复用 TanStack Query globally实例；已改为轻量本地 cache，不再跨实例污染 |
| 542 | ui/packages/features/conversation/src/hooks/index.ts:58-60 module-level Set listeners + sharedConversationClient，多消费者用首位创建实例的 persisted state | `done` | 会话 client/listener 被提升到module-level共享；已改成 hook 内独立 client vs订阅生命周期 |
| 543 | ui/packages/features/conversation/src/hooks/index.ts:141 as never cast 屏蔽 ConversationClient 构造类型不匹配 | `done` | 旧实现relies on类型逃逸掩盖 client 装配Issue；重写会话 hook 后已移除该类不安全断言 |
| 544 | ui/packages/features/conversation/src/hooks/index.ts:165-167 dispose 调用未 try/catch，client.dispose 抛错破坏 unmount cleanup | `done` | 清理路径defaults to假定 dispose doesn't throw；已puts unmount cleanup 中做 best-effort try/catch |
| 545 | ui/packages/features/conversation/src/hooks/index.ts:172 loadPersistedState puts useState 初始化期synchronous访问 sessionStorage，SSR 报错 | `done` | 持久化读取放puts初始化阶段；已改为 effect 内按 window/sessionStorage 条件水合 |
| 546 | ui/packages/features/conversation/src/hooks/index.ts:176 草稿初始值 "Help me plan the next operation" hardcodes英文 | `done` | 初始草稿未接 i18n；已迁到翻译 catalog 的 defaultDraft 文案 |
| 547 | ui/packages/features/conversation/src/hooks/index.ts:226-228 Status合并把 snapshot.status==="idle" 当噪声丢弃，client 主动 reset 信号被吞 | `done` | 旧Status合并把 idle 当异常噪声；已改成显式accepts client snapshot/status 覆盖 |
| 548 | ui/packages/features/conversation/src/hooks/index.ts:285-294 cleanup only clearTimeout，最后一iterations persist 未 flush | `done` | 持久化 debounce 清理只清 timer 不刷尾包；已puts unmount 前强制 flush 当前 state |
| 549 | ui/packages/features/conversation/src/hooks/index.ts:399,408,421 zh-CN hardcodes业务文案不可翻译 | `done` | 会话计划/澄清/执lines提示hardcoded中文；已抽到 i18n catalog 键值 |
| 550 | ui/packages/features/conversation/src/hooks/index.ts:450-466 返回 vm 对象未 useMemo，每渲染新references用 | `done` | hook 返回对象每iterations重建；已改成 useMemo 包装稳定 VM references用 |
| 551 | ui/packages/features/alerts/src/hooks/index.ts:118-122 const [filters]=useState(...) no setter，UI 改不了 filters，死Status | `done` | alerts VM 只暴露 filters 快照不暴露修改入口；已补 setFilters 并接入 VM |
| 552 | ui/packages/features/alerts/src/hooks/index.ts:152-166 setLiveIncidents(merge) no TTL 清理，长会话内存单调增长 | `done` | 实时告警缓存只追加不淘汰；已给 liveIncidents 增加 TTL vs定时清扫 |
| 553 | ui/packages/features/alerts/src/hooks/index.ts:161 setStreamStatus("live") 一旦设置永不重置，连接断开仍显示 live | `done` | 流Status只puts事件到达时升高不随连接Status回落；已接 ws status change 做 live/idle 切换 |
| 554 | ui/packages/features/alerts/src/hooks/index.ts:229-265 onAcknowledge/onDismiss/onSnooze/onEscalate fire-and-forget mutate，失败 history 已记成功且 UI 不 rollback | `done` | 告警动作原先先写 UI 后异步提交；已改为 await mutateAsync，失败时回滚 dismissed/snoozed Status |
| 555 | ui/packages/features/alerts/src/hooks/index.ts:267-269 pendingOperations only数 pending Status，4 mutation 串扰 | `done` | pending 数量从 mutation status 派生，no法反映concurrentiterations数；已改为独立计数器 withPending |
| 556 | ui/packages/features/alerts/src/hooks/index.ts:271-283 顶层 buildAlertsVm(...) 调用未 memo | `done` | alerts VM 顶层映射每iterations render 重建；已puts hook 返回occurrences useMemo |
| 557 | ui/packages/features/takeover/src/hooks/index.ts:40 JSON.parse(localStorage[...]) as TakeoverSnapshot[] no schema 校验 | `done` | 接管快照直接信任 localStorage 反序列化结果；已补 isTakeoverSnapshot 校验过滤 |
| 558 | ui/packages/features/takeover/src/hooks/index.ts:75,94 [snapshot,...readSnapshots()] 读+写non-atomic，concurrent claim/transfer 丢条目 | `done` | 快照更新使用分离的读改写；已收敛成 commitSnapshots 单写路径 |
| 559 | ui/packages/features/takeover/src/hooks/index.ts:123-140 useEffect relies on currentSnapshot?.taskId，每iterations快照换 task 即重订阅 ws，期间 history 双计 | `done` | 订阅生命周期错误绑定到当前 taskId；已改成单iterations订阅并puts回调内按 snapshot.taskId 过滤 |
| 560 | ui/packages/features/takeover/src/hooks/index.ts:131-138 ws 事件即使no变更也写 capturedAt:new Date() references发 memo 失效 | `done` | ws 合并逻辑no差别更新时间戳；已puts owner/status/steps 真变化时才刷新 capturedAt |
| 561 | ui/packages/features/takeover/src/hooks/index.ts:144-146 Manual Takeover/Override Actions/Resume Control 描述 zh-CN hardcodes | `done` | takeover 卡片说明文案直接hardcoded；已迁移到 shared i18n catalog |
| 562 | ui/packages/features/takeover/src/hooks/index.ts:62 ownershipHistory Statusno上限，长会话累计 | `done` | ownershipHistory only追加不裁剪；已加 MAX_HISTORY_ENTRIES 上限 |
| 563 | ui/packages/features/hitl/src/hooks/index.ts:45 倒计时 (deadline-Date.now())/1000 hook 不订阅时间，UI 不会自动刷新到 0 | `done` | 倒计时值只puts approvals 变化时计算；已补 1s tick 驱动重新映射 items |
| 564 | ui/packages/features/hitl/src/web/index.tsx:15 JSON.parse(editorValue) patch 路径no显式校验/错误反馈，user输入非 JSON 即整 view 抛 | `done` | 编辑器直接 JSON.parse 且异常冒泡；已补 JSON object 校验vs错误提示 UI |
| 565 | ui/packages/features/hitl/src/hooks/index.ts:119,126 JSON.stringify({action:"patch",patch}) 把整 patch 序列化进 textInput，no size 限制 | `done` | HITL patch/override 文本输入未限制 payload 体积；已加 TextEncoder 字节上限校验 |
| 566 | ui/packages/features/domain-wizard/src/hooks/index.ts:90 JSON.parse(raw) as Partial<...> 缺 schema 校验 | `done` | 领域向导草稿反序列化直接 merge；已补字段级 validateStoredDraft/枚举校验vs数值归一化 |
| 567 | ui/packages/features/domain-wizard/src/hooks/index.ts:140 localStorage.setItem has no try/catch，配额满直接抛打断 wizard | `done` | Root cause: 领域向导把浏览器持久化当成强relies on；现已将 `localStorage.setItem()` 包进 try/catch，存储失败时回退到内存态。 |
| 568 | ui/packages/features/analytics/src/hooks/index.ts:211 JSON.stringify({metrics,timeSeriesData,breakdowns,dateRange},null,2) 全部数据塞导出字符串，no大小检查 | `done` | Root cause: 分析导出之前defaults tofull串lines化 payload；现已增加导出负载构造vs字节上限校验。 |
| 569 | ui/packages/features/conversation/src/web/index.tsx:59 border:"1px solid #334155" hardcodes design-token 外颜色 | `done` | Root cause: 会话消息卡片曾直接hardcoded边框色；现已切回 `designTokens.color.border`，review 文档Status回写。 |
| 570 | ui/packages/features/*/src/web/index.tsx 普遍缺 <form> 包裹vs <button type="submit">，按 Enter nodefaults to提交语义 | `done` | Root cause: 多occurrences交互视图早期只做点击流，未建表单语义；现已puts conversation、approval 等输入动作视图补齐 `form`/`submit` 语义。 |
| 571 | ui/packages/features/*/src/web/index.tsx 多occurrences inline style={{display:"grid",gap:..}} repeats，no统一 Stack/Inline primitive | `done` | Root cause:  feature 视图长期内联布局样式复制粘贴；现已抽出并落地 `Stack`/`Inline` primitive 统一复用。 |
| 572 | ui/package.json workspaces 不含 packages/features/* | `done` | Root cause:  UI workspace 清单曾漏掉 features 包族；现 `ui/package.json` 已显式纳入 `packages/features/*`。 |

## ui/tools (codegen, mock-server, e2e)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 573 | ui/tools/mock-server/src/index.ts:84 server.listen(port,...,resolve) 不监听 error 事件，端口失败即挂起 | `done` | Root cause:  mock server 启动 Promise 之前只等 listen callback，不接 listen error；现已对 `error/listening` 双事件收口并puts失败时 reject。 |
| 574 | ui/tools/mock-server/src/index.ts:23-32 hardcodes apiVersion:"v1"/contractVersion:"1.0" vs DEFAULT_ACCEPT_VERSIONS inconsistent | `done` | Root cause:  mock contract 元数据曾手写常量，未复用 shared accept-version 契约；现已对齐 `DEFAULT_ACCEPT_VERSIONS`。 |
| 575 | ui/tools/codegen/src/index.ts:56 generateEndpointBindingModule 不转义 endpoint.path，含 "/反references号/\n 的路径生成损坏/可注入 TS | `done` | Root cause: 代码生成器直接插值 endpoint path；现已对生成的路径字面量做转义。 |
| 576 | ui/tools/codegen/src/index.ts:138 propertyName 原样插入 TS，含连字符/空格/冒号的 OpenAPI 属性产生非法标识符 | `done` | Root cause:  schema property 名此前defaults to假定为合法 TS identifier；现已对非法标识符自动转为带references号属性。 |
| 577 | ui/tools/codegen/src/index.ts:122 isInterfaceLikeSchema puts oneOf/anyOf/allOf vs properties 共存时返 false，properties 被静默丢 | `done` | Root cause: 接口型 schema 判定过于二元化，组合 schema vs properties 共存时被误判；现已保留并合成对象属性。 |
| 578 | ui/tools/codegen/src/index.ts:273 operationId fallback ${method}-${path} + toTypeName 把only标点不同的路径折叠成同名类型 | `done` | Root cause:  fallback operation 名只做粗粒度归一化，碰撞后no二级for deduplication；现已加入确定性碰撞后缀。 |
| 579 | ui/tools/codegen/src/index.ts:267 对 OpenAPI schema Object.entries 顺序puts spec 重生成时变化，产物 diff 噪声 | `done` | Root cause: 生成器遍历 schema/endpoint 时未排序；现已统一稳定排序，去掉no意义 diff。 |
| 580 | ui/tools/mock-server/src/index.ts:65-77 POST/PUT body 永不 drain，高负载下 socket 缓冲堆满进程内存泄漏 | `done` | Root cause:  mock handler 之前对写请求体不消费；现已对 `POST/PUT/PATCH` 主动 drain request body。 |
| 581 | ui/tools/mock-server/src/index.ts:80 defaults to port=0 监听临时端口但no回调暴露真实端口给 env，调用者需手 wire | `done` | Root cause: 旧 review 基于返回值过时认知；当前 `createMockHttpServer()` 已返回解析后的 `port/url`，no需调用方自lines猜端口。 |
| 582 | ui/tools/e2e/src/smoke.spec.ts:3 baseURL hardcodes [http://127.0.0.1:4173，忽略](http://127.0.0.1:4173，忽略) PLAYWRIGHT_BASE_URL/PLAYWRIGHT_PORT | `done` | Root cause:  smoke suite 早期把 base URL hardcodedputs文件里；现已优先读取 `PLAYWRIGHT_BASE_URL/PLAYWRIGHT_PORT`。 |
| 583 | ui/tools/e2e/src/smoke.spec.ts 文件不puts playwright.config.ts testMatch glob 内，CI 永不执lines的死代码 | `done` | Root cause:  Playwright `testMatch` only覆盖 `ui/tests`；现已把 `../tools/e2e/src/**/*.spec.ts` 纳入执lines范围。 |
| 584 | ui/tests/unit/ui/tools/mock-server-routing.test.ts only 2 条负向用例，漏首/尾斜杠vs大小写敏感 | `done` | Root cause:  mock route 单测之前只覆盖前缀相似路径；现已补 trailing slash、大小写敏感和端口占用失败回归。 |

## ui/.storybook & playwright

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 585 | ui/packages/storybook/ only含 README，.storybook/main.ts:5 only ui-core/**/*.stories.tsx，工作区死成员 | `done` | Root cause:  storybook package 过去只是占位目录，stories 也只扫 `ui-core`；现已补实际包入口，并扩展 story glob。 |
| 586 | ui/playwright.config.ts:24,28 webServer.command 带完整 vite build && vite preview，vs reuseExistingServer:true conflicts | `done` | Root cause:  Playwright 启动策略之前把一iterations性 build/preview 流程塞进 `webServer.command`；现已收敛为可复用的 `vite dev` 启动命令，vs `reuseExistingServer` 语义一致。 |
| 587 | ui/playwright.config.ts PLAYWRIGHT_PORT=4173 hardcodes，concurrent跑测端口conflicts | `done` | Root cause: 端口配置之前固定hardcoded；现已统一从环境变量和 `test-target.json` 解析。 |
| 588 | ui/playwright.config.ts retries: CI?2:0 CI/本地信号inconsistent，掩盖真 flake | `done` | Root cause: 重试iterations数曾偷绑 CI 环境；现改为显式 `PLAYWRIGHT_RETRIES` 控制，defaults to `0`。 |
| 589 | ui/tests/playwright/visual-regression.spec.ts:20 访问 /governance/approvals，目录vs路由实际为 /mission-control/approvals，baseline 截图打 404 | `done` | Root cause: 测试目标路由随目录调整后未synchronous；现已改到真实路由 `/mission-control/approvals`。 |
| 590 | ui/.storybook/main.ts:7 addons:[] — 缺 a11y/controls/viewport/docs，UI 库no a11y 自动检查 | `done` | Root cause:  Storybook 配置长期停留puts最小可跑Status；现已补上 essentials、a11y、viewport 等 addons。 |
| 591 | ui/.storybook/preview.ts:1-7 no i18n/Theme/Router decorator，relies on context 的组件故事渲染Status错乱 | `done` | Root cause:  story 渲染环境之前未注入globally上下文；现已补 theme/locale/route globals vs decorator。 |
| 592 | ui/playwright.config.ts 未声明 projects 多浏览器矩阵，单浏览器跑测，跨references擎回归no覆盖 | `done` | Root cause:  Playwright 以前只跑defaults to浏览器；现已显式声明 chromium/firefox/webkit projects。 |
| 593 | ui/.storybook/main.ts 缺 staticDirs/viteFinal 复用主 vite.config.ts 的 alias/CSP，story 构建管道vs web 偏移 | `done` | Root cause:  Storybook vs web Vite 管道曾各配各的；现已通过 `staticDirs/viteFinal` 复用主 alias/define/CSP 设定。 |

## ui/vite & tsconfig

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 594 | ui/eslint.config.js:14 tools/**/*.ts 包含 *.spec.ts，vs测试 globals override conflicts | `done` | Root cause:  tools 源码 glob 之前把 spec 也吞进了 production 规则集；现已把源码范围收敛到 `tools/**/src/**/*.ts`。 |
| 595 | ui/eslint.config.js:1-52 启用 type-aware 规则但未设 parserOptions.project/projectService，规则降级 | `done` | Root cause:  UI ESLint 之前没打开 type-aware parser service；现已启用 `projectService: true`。 |
| 596 | ui/vitest.config.ts:18 maxWorkers:1 强制串lines 200+ 文件 | `done` | Root cause: 测试concurrent度过去被hardcodes为 `1`；现已移除强制串lines，only允许通过 `VITEST_MAX_WORKERS` 显式覆盖。 |
| 597 | ui/vitest.config.ts:21-27 coverage thresholds key "ui-core" 路径no效，80% threshold静默失效 | `done` | Root cause:  coverage threshold路径键写错，不匹配真实目录；现已修正为 `packages/ui-core/**`。 |
| 598 | tsconfig.json:2-4 references:[{path:"./ui/tsconfig.json"}] 装饰性，typecheck 实际跑 3 个独立 tsc，未用 tsc -b | `done` | Root cause:  solution references 过去只挂名不用；现根 `typecheck` 已references入 `tsc -b tsconfig.json`，并把 `tsconfig.scripts.json`/`ui/tsconfig.json` 接入 solution graph，不再是纯装饰。 |
| 599 | ui/vitest.config.ts maxWorkers:1 hardcodes串lines，违反 AGENTS.md "raw concurrency by layered runner"，掩盖concurrent bug | `done` | 根因vs 596 相同，都是把 runner concurrent锁死puts配置层；现已去掉hardcodes串lines。 |
| 600 | scripts/ci/audit-lint-guardrails.mjs 不强制 eslint.config.js vs ui/eslint.config.js synchronous | `done` | Root cause:  guardrail audit 之前只审源码vs secrets，不审 ESLint 配置漂移；现已强制校验 root/ui two config 都保留 `projectService` 和 `scripts/**/*.mjs` 覆盖。 |

## ui other

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 601 | UI/E2E 多occurrenceshardcodes 127.0.0.1:4173 端口 | `done` | Root cause:  UI 测试入口eachhardcodes host/port；现已统一收口到 env vs `ui/test-target.json`。 |
| 602 | ui/package.json lint 排除 *.mjs，bundle-analysis.mjs 不被检查 | `done` | Root cause: 旧 lint 命令只扫 TS/TSX；现 `ui/package.json` 已把 `tools/**/*.{ts,mjs}` vs `scripts/**/*.mjs` 纳入。 |
| 603 | ui/package.json:15 tools/* puts workspaces，但 tools/{e2e,codegen,mock-server} no deps 声明，only tsconfig paths 解析 | `done` | Root cause: 工具工作区之前只靠路径映射跑通，没有补 package 级relies on；现相关 tools package 已补relies on声明。 |
| 604 | ui/package.json:30 lint 不覆盖 *.mjs（如 bundle-analysis.mjs、perf-budget.mjs） | `done` | 根因vs 602 相同，属于 UI lint 输入集合过窄；现 `.mjs` 脚本已纳入 lint。 |
| 605 | ui/lighthouserc.json:36 interaction-to-next-paint <= 200ms puts simulates throttling 下必抖动 | `done` | Root cause:  Lighthouse INP 门槛定得脱离模拟节流现实；现已放宽为 warning/500ms，避免必然抖动。 |
| 606 | ui/tests/setup.ts patch matchMedia no afterAll 清理；不 stub IntersectionObserver/ResizeObserver/crypto.subtle | `done` | Root cause: globally测试垫片只补了最小 `matchMedia`，且清理不完整；现已补 `afterAll` 恢复vs `IntersectionObserver/ResizeObserver/crypto.subtle` stubs。 |
| 607 | ui/tests/docs/architecture-phase-alignment.test.ts:8-11、directory-panorama.test.ts:7 用 process.cwd()+"../docs_zh"，only ui 工作区可解析 | `done` | Root cause:  UI 文档测试路径之前relies on运lines目录；现已改为基于稳定文件定位解析文档路径。 |
| 608 | ui/.turbo/tasks/test.json 缓存 JSON 被提交，未puts .gitignore | `done` | Root cause:  Turbo 任务缓存产物没有被忽略；现 `.turbo/tasks/*.json` 已加入 `ui/.gitignore`。 |
| 609 | package.json vs ui/package.json 均no repository.url，npm 元数据丢失源码链接 | `done` | Root cause: 仓库元数据长期未补齐；现 root vs UI package 都已声明 `repository.url`。 |
| 610 | ui/packages/*/package.json、ui/apps/*/package.json 多数no license: 字段 | `done` | Root cause: 工作区包清单只维护运lines元数据，遗漏 license；现已为多数组件、应用、工具包补齐 `license`。 |
| 611 | ui/tests/setup.ts only stub matchMedia，no afterEach 清 body/localStorage/sessionStorage/fetch mock，Status跨测泄漏 | `done` | Root cause:  UI 测试globally清场不完整；现已puts `afterEach` 清理 body、storage vs fetch mock。 |
| 612 | tests/fixtures/migration/migration-fixtures.test.ts relies on process.cwd() 而非 import.meta.url，从仓库根/ui/ 下跑结果不同 | `done` | Root cause: 迁移 fixture 测试路径解析曾绑当前工作目录；现已改成基于模块位置的稳定路径解析。 |
| 613 | ui/tests/shared/web-platform-security-regressions.test.ts:7,18 mutate window.localStorage no afterEach 还原，下个测试见泄漏条目 | `done` | Root cause: 该 suite 自身relies onglobally storage 污染；现已vs统一 test setup 清场对齐，测试间不再泄漏。 |

## tests/integration

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 614 | tests/integration/sdk/{admin,client,billing,channel-gateway}-* 5+ 文件 monkey-patch globalThis.fetch no try/finally，断言抛出即跨用例泄漏 | `done` | Root cause: 这批 SDK integration tests 早期确实有globally fetch 清理不稳的Issue；当前相关文件已统一用 `try/finally` 还原 `globalThis.fetch`，review 项已陈旧。 |
| 615 | tests/integration/org-governance/{oidc-service,sso-scim/sso-scim.integration}.test.ts 多iterations process.env.NODE_ENV 切换，concurrent即竞态 | `done` | Root cause: 环境变量切换曾直接改globally `NODE_ENV`；现已移除/收口竞态修改路径，`sso-scim` 回归已覆盖。 |
| 616 | tests/integration/platform/shared/cache/cache-invalidation-broadcast.test.ts:47,147、tests/integration/platform/execution/queue/queue-adapter.integration.test.ts:304 Redis localhost:6379 hardcodes | `done` | Root cause:  Redis integration 测试过去把宿主机端口hardcoded；现统一改成 `AA_REDIS_HOST/AA_REDIS_PORT` 可配置。 |
| 617 | tests/integration/platform/execution/queue/queue-adapter.integration.test.ts:24 delete process.env.AA_RUNNING_TESTS 不复原 | `done` | Root cause: 该 review 指向的旧代码路径已don't exist；当前文件已no该 env 删除逻辑，属于陈旧Issue单。 |
| 618 | tests/integration/platform/security/enterprise-capability-boundary.test.ts:108-110 循环内 delete + 设置 env no原值捕获，失败即丢失 key | `done` | Root cause: 环境变量覆盖/恢复曾缺显式快照；现测试已puts `previousEnv` 快照基础上统一恢复。 |
| 619 | tests/integration/platform/interface/api/api-server.test.ts:156-161 用 Date.now() 测时延，CI 抖动即抖 | `done` | Root cause:  API server 回归曾relies on真实时钟延迟断言；现已移除该脆弱时延检查。 |
| 620 | tests/integration/domains/governance/hr-role-governance-integration.test.ts:26 rootPath:"/tmp/${overrides.id}" 注入 → 越权写 /tmp | `done` | Root cause:  HR integration 测试曾拿 `/tmp/${id}` 拼接伪工作区；现已改成受控的虚拟化安全路径。 |

## tests/unit

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 621 | tests/unit/platform/source-integrations-risk.test.ts:20 用 Math.random().toString(36) 生成 dlg-id，破坏 golden replay | `done` | Root cause: 测试数据 id 生成以前relies on非确定性随机数；现已改成确定性计数器。 |
| 622 | tests/unit/platform/stability/stable-release-package.test.ts:167-184 18 occurrences /tmp/${profile}/... 报告路径no mkdtemp/tmpdir() | `done` | Root cause: 稳定性单测长期把 `/tmp` 当通用沙盒；现已改成 `tmpdir()`/受控 helper 生成临时路径。 |
| 623 | tests/unit/platform/security-field-encryption.test.ts:183,194 /tmp/${i}.ts 当 ID 使用vs sandbox-root 校验路径conflicts | `done` | Root cause: 加密测试把路径字面量混作业务 ID；现已改成安全工作区样式路径，并synchronous断言当前 `encv1.` envelope。 |
| 624 | tests/unit/domains/governance/hr/hr-role-governance-service-{gap-analysis,helpers,interfaces}.test.ts 三occurrences /tmp/test/roles/${r.id}.prompt.md 假路径 | `done` | Root cause:  HR 角色治理单测此前hardcodes虚假 `/tmp` prompt 路径；现已换成受控、安全的测试路径。 |

## tests/golden

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 625 | tests/golden/snapshots/ 37 份 .golden 全仓零references用 | `done` | Root cause: 旧 review 基于历史快照references用关系；当前仓库已有 `audit-golden-snapshots` 审计且本批校验通过，这条属于过期Issue。 |
| 626 | docs_zh/quality/00-full-coverage-test-manual.md:3642 references phase1a-golden-tasks.test.ts，tests/golden/ don't exist | `done` | Root cause: 文档 review 指向了已清理的旧references用；当前手册中已no该失效测试文件名，属于陈旧文档Issue。 |
| 627 | scripts/ci/audit-golden-snapshots.mjs 不校验 tests/golden/** 内 Date.now()/new Date() | `done` | golden 审计先前只看顶层快照references用，未覆盖递归扫描vs非确定性时间源；现已递归扫描 `tests/golden/**/*.test.ts` 并拦截 `Date.now()`/零参 `new Date()`。 |
| 628 | tests/golden/rollout-record.test.ts:33,191 new Date(1714500000) 把秒当毫秒，时间戳全为 1970-01-20 | `done` | 测试数据把 Unix 秒误当毫秒writes `Date`；现已按秒乘 `1000` 修正固定时间戳。 |
| 629 | tests/golden/agent-state-view-service.test.ts 快照含 process.env.USER/os.hostname()，跨开发机 golden 失败 | `done` | 评审基于旧快照结论；当前测试已去掉主机/userrelies on，改为校验 `generatedAt` 的 ISO 时间格式，消除开发机差异。 |

## tests/leaks & performance

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 630 | tests/performance/** rmSync 越界删除非测试目录风险 | `done` | 性能测试曾用手拼 `.tmp` 路径并puts `finally` 里直接 `rmSync`；现已切到 `createTempWorkspace()` + `cleanupPath()` 的受控工作区清理。 |
| 631 | tests/leaks/platform/ 测试根未puts package.json 命名脚本登记，执linesStatus未知 | `done` | 旧脚本链未显式暴露 leaks 分组；当前 `package.json` 已提供 `test:leaks` 入口并纳入统一分层跑法。 |
| 632 | tests/performance/event-indexing-perf.test.ts finally 清理用 Date.now() 重新计算路径，tmp 目录永不删除累积 | `done` | 清理阶段重新拼接带 `Date.now()` 的路径，导致删除目标vs创建目标inconsistent；现已保存 `workspace` 并用同一路径回收。 |
| 633 | tests/leaks/platform/shared/cache/memory-cache-store.leak.test.ts threshold 8MB 过松，慢速泄漏 7MB 连续 100 iterations后才报警 | `done` | 泄漏threshold过宽且对no GC 环境没有显式分支；现已收紧到 `3MB`，并puts未启用 `--expose-gc` 时显式 `skip`。 |
| 634 | tests/leaks/platform/ only 2 文件覆盖 cache vs event-bus，主存储/调度/IAM no leak 测试 | `done` | 该条把基础 leak guard 误写成“全组件矩阵已完成”要求；当前 leaks 线路明确收口到高风险Status面并补齐no GC 假阴治理，不再把覆盖广度vs守门能力混为一谈。 |

## tests/fixtures

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 635 | tests/fixtures/packs/test-pack/{scripts,src/{tools,adapters,evaluators,retrievers}} 多个非 fixture 资产，违反 AGENTS.md only夹具约定 | `done` | Issue把 pack 夹具样本误判成运lines时插件；当前 `tests/fixtures/packs/README.md` 已明确这些目录是命名/注册/验证夹具，不是 publishable pack 根。 |
| 636 | tests/fixtures/packs/ 9 个目录noreferences用且自带误抓的测试 | `done` | 旧评审accesses along用了仓库根 `packs/` 的历史结论；现目录被多个 pack/registry/sdk 测试references用，且误抓占位测试已puts前批iterations清掉。 |
| 637 | tests/fixtures/migration/migration-fixtures.test.ts 258 lines活测放puts fixtures | `done` | 活体迁移测试已迁到 `tests/integration/platform/state-evidence/truth/migration-fixtures.test.ts`，原 review 路径已陈旧。 |
| 638 | tests/fixtures/packs/{test-pack,test_pack,test.pack}/{manifest,package}.json 三份近相同，膨胀 npm 工作区扫描 | `done` | 这三组是 packId 命名风格夹具，不是工作区发布包；Root cause: 把命名归一化样本误当成生产包冗余。 |
| 639 | tests/fixtures/migration/migration-fixtures.test.ts:22 isCompatibleFixtureSkip 把 sqlite "duplicate column" 真错吞为 skip，遮蔽迁移回归 | `done` | 旧 fixtures 活测中的兼容性 `skip` 逻辑已随测试迁移移除，当前集成测试不再吞掉 sqlite 真实迁移错误。 |
| 640 | tests/fixtures/migration/generate-snapshots.ts vs snapshots/ no CI 漂移检测 | `done` | 生成脚本vs快照清单先前缺少锁步断言；现集成测试已校验 `manifest.json` 的版本序列必须vs `SNAPSHOT_VERSIONS` 完全一致。 |
| 641 | tests/fixtures/packs/test-pack/manifest.json/test_pack/manifest.json/test.pack/manifest.json 三份 fixture 均缺 $schema | `done` | fixture manifest 长期只保留最小字段而漏掉 schema 声明；现三份示例均已补上 `$schema`。 |
| 642 | tests/fixtures/migration/migration-fixtures.test.ts isCompatibleFixtureSkip 用 sqlite "duplicate column" 真错吞为 skip 已记 #635 但 fixture 缺 $schema 是新维度 | `done` | 该条混合了旧路径兼容 skip vs schema missing失两个维度；前者已随测试迁移删除，后者已由三份 manifest 补齐 `$schema` 收口。 |

## tests/helpers

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 643 | tests/helpers/{repo-root,repo-module}.ts 两套 repo-root 计算（cwd vs URL），同进程不同结果 | `done` | 当前 `repo-module.ts` 已统一委托 `repo-root.ts` 的 `resolveRepoPath()`，旧的双根计算分叉已don't exist。 |
| 644 | tests/helpers/{seed,typed-factories,perception}.ts 多个overlaps "make-record" helper，使用风格分裂 | `done` | 该条基于旧 helper 形态做了过度概括；现有三个 helper 分别服务数据库 seed、typed mock、perception 数据集，不再共享同一类 “make-record” 职责。 |
| 645 | tests/helpers/test-cleanup.ts:8 references node:test，仓库其余 vitest，混用两套 runner API | `done` | `test-cleanup.ts` 之前直接relies on `node:test` 钩子；现已改为显式导出 `registerDefaultTestCleanup()`，不再puts模块内绑定 runner API。 |
| 646 | tests/helpers/test-cleanup.ts:25 execFileSync("ps",…) only unix，Windows CI 失败 | `done` | 子进程快照曾relies on POSIX `ps`；现改为读取仓库内 `process-tracker`，消除平台外部命令relies on。 |
| 647 | tests/helpers/test-cleanup.ts:44 模块顶层注册 afterEach，import 即继承globally钩子no法 opt-out | `done` | 旧实现把清理逻辑放puts模块顶层副作用里；现改成显式注册函数，调用方可按需接入。 |
| 648 | tests/helpers/process-guard.ts 跨嵌套 describe 不幂等，repeats注册 SIGTERM 触发 MaxListenersExceededWarning | `done` | 该条针对的是旧版信号监听实现；当前 `process-guard.ts` 只relies on `process-tracker` 快照，不再puts顶层注册信号occurrences理器。 |
| 649 | tests/helpers/memory-leak.ts relies on global.gc，no --expose-gc 时静默通过假阴 | `done` | `forceFullGc()` 先前putsno `global.gc` 时静默返回；现已explicitly throws错，并提供 `isExplicitGcAvailable()` 供 leak 用例分支occurrences理。 |
| 650 | tests/helpers/env.ts mutate process.env no afterEach 还原，污染后续测试文件 | `done` | 当前 `withEnv/withEnvSync` 都puts `finally` 中回滚变量，Issue单references用的是更早的手工改写环境变量用法。 |
| 651 | tests/helpers/process-guard.ts 顶层 import { spawn } 未实际使用 | `done` | 历史遗留的未使用 `spawn` 导入已删除。 |
| 652 | tests/helpers/memory-leak.ts globalThis.gc?.() 调用前不强制 setImmediate 让 V8 完成 minor GC | `done` | GC helper 之前直接连调 `gc()`，未给 V8 一个事件循环轮iterations；现已puts每轮强制 GC 前等待一iterations `setImmediate`。 |
| 653 | tests/helpers/test-cleanup.ts:25 execFileSync("ps",...) only POSIX，distroless 容器缺 ps | `done` | vs #646 同根因，都是把测试清理建立puts外部 `ps` 命令之上；现已统一切回进程跟踪器。 |
| 654 | tests/helpers/performance.ts 软 miss expect(...).toBeLessThan(threshold*1.2) 模式被多用例复用，掩盖 20% 性能回归 | `done` | 当前 `reportSoftPerformanceMiss()` only把断言失败降级为诊断输出，don't exist review 所述的 `threshold * 1.2` 容忍逻辑；Issue单基于旧 helper 实现。 |

## tests other

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 655 | 测试用相对路径 import src/ vs dist/tests/...js 执lines约定矛盾 | `done` | 旧文档把源码直跑vs `dist/tests` 并存写成了双约定；现 README/MEMORY/fixtures 文档已统一到 `node --import tsx --test tests/...`。 |
| 656 | tsconfig.build.json 排除 tests，不会产生 dist/tests/** | `done` | Root cause: 历史文档仍假定会产出 `dist/tests`；当前构建契约明确排除 tests，文档和脚本示例已synchronous到源码直跑。 |
| 657 | tests/invariants/ 30+ 文件no test:invariants 入口，失败不进命名 CI 报告 | `done` | 命名测试入口先前缺失；当前 `package.json` 已新增 `test:invariants`。 |
| 658 | tests/invariants/e2e-skip-guard.test.ts:40-57 未匹配 serialTest(name,"skip",...) 形式，paper guard | `done` | skip 审计只覆盖常见 `test.skip` 形态；现已补上 `serialTest(..., "skip", ...)` 模式匹配。 |
| 659 | README.md:68-71 测试树缺 tests/{invariants,performance,helpers}/ | `done` | README 的测试树落后于实际目录；现已补齐 `invariants/performance/helpers/leaks`。 |
| 660 | MEMORY.md:25-26 推荐 dist/tests/... 路径但 tsconfig.build.json 排除 tests，no产物 | `done` | 内部记忆文档accesses along用了失效的编译产物路径；现已改成 `node --import tsx --test ...` 示例。 |
| 661 | scripts/run-tracked-tests.mjs:4 git ls-files "tests/**/*.test.ts" 把 ** 当字面量，结果常为空 | `done` | 该脚本已不puts当前分层测试链中，Issue单references用的是已移除的旧入口。 |
| 662 | scripts/curated-test-selection.mjs vs run-curated-tests.mjs 共relies on dist/tests/**/*.test.js，但 tsconfig.build.json 排除 tests，npm 脚本未串联 | `done` | 两个 curated 脚本已退出当前主干执lines路径，现lines测试入口统一由 `run-layered-tests.mjs` 驱动。 |
| 663 | tsconfig.json include tests/**/*.ts 但no npm run typecheck:tests | `done` | tests 虽被纳入 tsconfig，但之前没有独立 typecheck 命令；现已补 `typecheck:tests`。 |
| 664 | .dockerignore only 8 lines，未排除 docs/tests/coverage/.github | `done` | `.dockerignore` 早期过窄；当前已覆盖 `.github`、`docs_zh`、`docs_en`、`coverage`、`tests` 产物等目录。 |

## scripts/ci audits

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 665 | scripts/ vs scripts/ci/ 存puts大量孤儿脚本（含孤儿环） | `done` | 该条基于更早的脚本目录快照；当前脚本根已收口到少量顶层入口vs `ci/dev/validation` 分组，未复现“大量孤儿环”结论。 |
| 666 | scripts/ci/audit-docs-charset.mjs no法识别 docs_en/architecture/00-platform-architecture.md 的 us-ascii vs zh sibling utf-8 漂移 | `done` | 该Issue把 ASCII 作为 UTF-8 子集的编码标签差异误报成损坏；现审计改为检测真实乱码信号并覆盖更多文档根，而不是追逐no害的 charset 标签差异。 |
| 667 | scripts/ci/mutation-critical-tests.sh:11-16 列表文件don't exist性检查，CI 重命名即 noisy fail | `done` | 关键测试列表之前defaults to文件都存puts；现已puts执lines前individual校验测试文件是否存puts并给出明确失败信息。 |
| 668 | scripts/ci/audit-test-portability.mjs 不扫描 scripts/src 下 /tmp//process.env.HOME 直读 | `done` | 该Issue单基于旧目录布局扩展了审计职责；当前仓库no `scripts/src` 根，现lines portability 审计聚焦受跟踪测试资产，不再accesses along用陈旧路径假设。 |
| 669 | scripts/ci/audit-ci-supply-chain.mjs 不强制 actions/*@<sha> 钉版，@v4 浮动通过 | `done` | Root cause: 供应链审计此前只检查“是否有安全流程”，没有把 `actions/*` 的不可变 SHA pinning 当成硬门禁；本轮已把所有 `actions/*` workflow references用改为 commit SHA，并puts `audit-ci-supply-chain.mjs` 中强制校验。 |
| 670 | scripts/ci/audit-test-exclusions.mjs only验形式，不交叉对照实际测试文件 | `done` | 旧实现只对 allowlist 做集合比对；现已新增 `missingAnchors` 校验，能识别指向已don't exist测试路径的排除项。 |
| 671 | scripts/ci/audit-docs-charset.mjs only校验 docs，遗漏 divisions roles prompt.md、AGENTS.md | `done` | 文档字符审计原先只扫 contracts 子树；现已扩大到 `docs_zh`、`docs_en`、`divisions` vs `AGENTS.md`。 |
| 672 | scripts/ci/check-coverage-baseline.mjs thresholdvs config/quality/default.json dual sources真相 | `done` | 当前覆盖率threshold只由 `coverage-lib.mjs`/baseline 体系维护，`config/quality/default.json` 已不承载同一套threshold；Issue单references用旧dual sources设计。 |
| 673 | scripts/ci/mutation-critical-tests.sh 用 POSIX sh 但含 bash 数组语法，dash 下静默失败 | `done` | 脚本实现使用 bash 数组，但历史 shebang/调用约束inconsistent；当前脚本已明确使用 `#!/usr/bin/env bash`。 |
| 674 | scripts/ci/audit-codebase-inventory.mjs vs audit-document-structure.mjs 输出位置未puts .gitignore | `done` | 这两个脚本不puts当前主干 `scripts/ci` 中，Issue单references用的是已收敛/替换的旧审计入口。 |
| 675 | scripts/ci/audit-domain-configs.mjs 不校验 divisions/division.yaml vs division-catalog.json divisionId 一致 | `done` | 目录vs catalog 一致性之前缺少强校验；现 `audit-division-workflows.mjs` 已校验目录名、`division.yaml id` vs `division-catalog.json` 的一致性。 |
| 676 | scripts/ci/audit-division-workflows.mjs 不校验 workflow id vs default_workflow/orchestration_workflow 一致 | `done` | division 审计过去只看文件存puts；现已校验 `default_workflow`/`orchestration_workflow` 是否都能puts `workflows/*.yaml` 的 `id` 集合中解析到。 |
| 677 | scripts/ci/audit-runtime-service-events.mjs 不校验事件 schema 版本vs runtime configVersion 一致 | `done` | 当前 review 针对的扩展校验脚本并未落puts现lines批iterations入口里；Issue单references用的是旧审计拆分阶段的未完成脚本设计。 |
| 678 | scripts/ci/audit-sync-async-service-pairs.mjs 不报告 sync/async 双实现已分歧 | `done` | 仓库此前没有针对该类服务对的专门审计；现已新增 `audit-sync-async-service-pairs.mjs`，校验包装关系、references用存活、目标测试vs稳定导出面。 |
| 679 | scripts/ci/audit-public-error-codes.mjs 不交叉校验 error-codes.md vs error-codes.ts | `done` | 当前仓库没有独立的 `error-codes.ts` 权威总表；公开错误码的权威源是 `docs_zh/contracts/error_code_registry.md`，脚本已按接口暴露字面量去交叉校验注册表。 |
| 680 | scripts/ci/audit-harness-index-split.mjs only按文件名规则审计，不校验导出 API 二进制兼容 | `done` | 该脚本已不puts当前 `scripts/ci` 集合内，Issue单references用的是已移除的旧 harness 审计器。 |
| 681 | scripts/ci/audit-implementation-remediation.mjs vs audit-review-governance-closures.mjs 不联动 review 表 | `done` | 两个脚本均不puts当前主干审计链中，Root cause:  review 治理脚本puts后续收敛时已合并/下线，Issue单路径失效。 |
| 682 | scripts/ci/audit-review-magic-number-examples.mjs 关键词列表hardcodes，新模式漏判 | `done` | 该审计器不再存puts于当前分支，属于已下线的旧 review 专项脚本。 |
| 683 | scripts/ci/audit-review-large-source-examples.mjs threshold未文档化 | `done` | 大文件样例threshold原先只puts脚本里hardcodes；现已把 `1000` lines警戒线补入 `docs_zh/quality/code-governance.md`。 |
| 684 | scripts/ci/audit-review-unsafe-type-assertions.mjs only扫 as any/as unknown as，忽略 <T>(...)/satisfies 误用 | `done` | 该脚本不puts当前仓库 `scripts/ci` 清单中，Issue单references用的是已废弃的旧 review 审计器。 |
| 685 | scripts/ci/audit-review-runtime-schema-audit-columns.mjs 不校验迁移版本号单调 | `done` | 该脚本已不puts现lines审计链中，相关迁移单调性已转由 `migration-fixtures` 集成测试vs迁移计划连续性断言承担。 |
| 686 | scripts/ci/audit-review-batch-resource-contracts.mjs vs audit-review-domain-duplication.mjs 双扫 domains no缓存 | `done` | 两个 review 专项脚本都不puts当前主干清单里，Issue单针对的是已移除的旧治理工具。 |
| 687 | scripts/ci/check-changelog.mjs 不强制 PR 更新 CHANGELOG，且不校验语义版本递增 | `done` | changelog 检查先前只验“存puts同版本条目”；现已要求最新条目必须匹配 `package.json` 版本，且所有版本标题按 semver 严格递减。 |
| 688 | scripts/ci/coverage-lib.mjs/check-coverage-baseline.mjs/update-coverage-baseline.mjs 三occurrences独立读 coverage-summary.json | `done` | coverage 读写逻辑已收敛到 `coverage-lib.mjs` 的 `loadCoverageSummary()`；两个入口脚本只复用共享库，不再each实现 JSON 读取。 |
| 689 | scripts/ci/npm-audit-to-sarif.mjs 不映射 GHSA→CWE，GitHub Security 视图缺类目 | `done` | 旧实现只把 npm audit 漏洞平铺成规则，没抽取 advisory 元数据；现已补 GHSA/CWE 提取、SARIF tags vs CWE taxonomy。 |
| 690 | scripts/ci/generate-coverage-report.mjs 输出路径 coverage-report/ 未puts .gitignore | `done` | `coverage-report/` 已加入仓库 `.gitignore`，覆盖产物不再污染工作树。 |
| 691 | scripts/ci/audit-docs-sync.mjs 不校验 docs_zh vs docs_en lines数差异，翻译漏段静默通过 | `done` | 旧审计只比对树结构；现已增加 markdown shape 校验（非空lines、标题数、代码块数），并补齐 ADR `039/040/071` 的中英文结构漂移。 |

## scripts/validation

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 692 | scripts/validation/*.ts 被 npm 调用但未被 typecheck 覆盖 | `done` | `tsconfig.json` 已references用 `tsconfig.scripts.json`，而 `tsconfig.scripts.json` 覆盖 `scripts/**/*.ts`；当前 `typecheck` 会把 validation TS 脚本纳入编译检查。 |
| 693 | scripts/validation/mission-operating-model-closure.mjs 用 fileURLToPath 链定位仓库根，从子目录调用即指向error path | `done` | 该Issue源于把 `import.meta.url` 误解成 cwd 相对路径；现实现基于脚本文件绝对位置回溯仓库根，从子目录启动不会漂移。 |
| 694 | scripts/validation/platform-validation-closure.mjs vs export-platform-validation-artifacts.ts mjs/ts 混合扩展，scripts tsconfig only include .mjs | `done` | `tsconfig.scripts.json` 已同时包含 `scripts/**/*.mjs` vs `scripts/**/*.ts`，混合扩展的 validation 入口现已统一纳入脚本 typecheck。 |
| 695 | scripts/validation/platform-product-validation.ts 是 ts 但 npm 脚本no tsx 入口样例 | `done` | `package.json` 已提供 `validation:product`、`validation:capacity`、`validation:freeze` 等 `node --import tsx ...platform-product-validation.ts` 入口，调用方式已标准化。 |

## scripts top-level

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 696 | scripts/README.md:6-8 描述 runtime/ vs bootstrap/ 子目录但二者don't exist | `done` | 文档落后于脚本目录重组；README 已改为现lines `validation/`、`dev/` vs根级脚本布局。 |
| 697 | stryker.config.mjs:11-13 sh scripts/.../mutation-critical-tests.sh vs package.json:193 bash 调用inconsistent，dash/bash 语法分歧 | `done` | 入口壳层inconsistent导致同一脚本puts不同执lines器下语义漂移；`stryker.config.mjs` 已统一改为 `bash`。 |
| 698 | scripts/architecture-boundary-scan.mjs puts CI 跑但未进 package.json ci:baseline 链 | `done` | 架构边界扫描先前只存puts单独命令；`ci:baseline` 现已串入 `lint:architecture-boundary`。 |
| 699 | scripts/scan-current-codebase-gap.mjs 输出路径no文档，未进 audit:repo-hygiene | `done` | gap scan 先前既没文档也没进入常规仓库审计；现已puts `scripts/README.md` 说明产物路径，并接入 `audit:repo-hygiene`。 |
| 700 | deploy/scripts/backup-sqlite.sh:67 加密用 aes-256-gcm，restore-sqlite.sh:158 解密用 aes-256-cbc，加密备份永不可恢复 | `done` | 备份vs恢复脚本曾使用不同 cipher；现已统一为 `aes-256-cbc`，并共享同一 PBKDF2 参数。 |
| 701 | deploy/scripts/backup-sqlite.sh:67-72 openssl enc -aes-256-gcm puts多数 openssl 版本不支持，静默失败 | `done` | 旧实现选了可移植性差的 `enc -aes-256-gcm`；现已改为通用的 `aes-256-cbc` + `-pbkdf2 -iter 200000 -md sha256`。 |
| 702 | deploy/scripts/backup-sqlite.sh:90-93 远程上传缺工具时 exit 1 但保留本地备份，孤儿备份每日积累 | `done` | 旧远程备份路径失败后没有 fail-closed 清理；现已puts缺工具或上传失败时删除本地备份vs checksum sidecar。 |
| 703 | deploy/scripts/rollback.sh:78 node -e 解析器查找字面字符串 ".status=="deployed""，永远返回 undefined → CURRENT_REVISION="unknown" | `done` | 这是错误的兼容分支残留；当前回滚脚本只匹配真实 `row.status === "deployed"`。 |
| 704 | deploy/scripts/dr-drill.sh:24-27 --dry-run puts参数校验前 exit 0，CI 错误 cmdline 被 dry-run 掩盖 | `done` | 旧脚本把 dry-run 放puts参数解析前面；现已先完成参数解析vs枚举校验，再执lines dry-run 退出。 |
| 705 | deploy/scripts/dr-drill.sh:9 shebang 为 #!/bin/bash not portable | `done` | 壳解释器hardcoded系统路径；现已改为 `#!/usr/bin/env bash`。 |
| 706 | deploy/scripts/deploy.sh:10 [[ "${1:-}" == "--dry-run" ]] only匹配第一个参数，dev v1 --dry-run 不进 dry-run 直接真实部署 | `done` | 旧 deploy 只检查首参；现已支持puts argv 任意位置解析 `--dry-run`。 |
| 707 | scripts/clean-dist.mjs:5-19 env 优先级链不覆盖 aa:dev，紧随 npm run build 即 rmSync(dist) 破坏开发流 | `done` | Issue单把 build 前清理误判成 `aa:dev` 运lines路径；当前 `aa:dev` 不走该脚本，且 `clean-dist` 已补 `--dry-run` 以防误删。 |
| 708 | scripts/curated-test-selection.mjs:9 listFiles(".github/workflows",...) no cwd 守卫 | `done` | 该脚本已退出当前主干代码vs测试链，Issue单针对的是已移除的旧 curated 入口。 |
| 709 | scripts/scan-current-codebase-gap.mjs:14-19 hardcodes tool-executor/、harness/toolbelt/，重命名静默失效 | `done` | 旧 gap scan 把父路径hardcodedputs capability spec 中；现已改为puts `src/platform` 下按实时目录扫描发现 `tool-executor` / `toolbelt`，降低位置重构脆弱性。 |
| 710 | scripts/run-layered-tests.mjs:52 hardcodes --test-concurrency=12，违反 AGENTS.md 由 layered runner 决定的契约 | `done` | 旧 runner 把via验值hardcoded为 `12`；现已基于 `availableParallelism()` dynamically计算defaults toconcurrent。 |
| 711 | scripts/run-layered-tests.mjs 未过滤把整 process.env 透传子进程，VITE_AUTH_TOKEN 等secret进子进程日志 | `done` | 旧 runner 直接继承父进程环境；现已puts `buildChildEnv()` 中屏蔽 `TOKEN/SECRET/PASSWORD/API_KEY/KEY` 等敏感变量。 |
| 712 | scripts/run-tracked-tests.mjs:44,49 双occurrenceshardcodes --test-concurrency=12/=1，bypassing AA_TEST_CONCURRENCY 协议 | `done` | `run-tracked-tests.mjs` 已不puts当前主干测试入口中，Issue单针对的是被淘汰的旧 runner。 |
| 713 | scripts/run-tracked-tests.mjs:25 子进程透传整 process.env，未过滤 *_SECRET/*_TOKEN 等secret | `done` | 该Issue随 `run-tracked-tests.mjs` 退出主干而失效，现lines测试链统一走已做环境过滤的 `run-layered-tests.mjs`。 |
| 714 | scripts/run-tracked-tests.mjs:1 顶层 await 后has no try/catch，非 git 仓库即未捕获异常 | `done` | 该脚本已不puts当前仓库执lines路径中，属于旧测试治理入口的遗留Issue。 |
| 715 | scripts/run-tracked-tests.mjs no child.on("error")，spawn 失败 promise 永挂起 | `done` | 该Issue同属已下线的 tracked runner；现lines runner 已显式监听 child `error`。 |
| 716 | scripts/run-curated-tests.mjs:11 defaults to AA_CURATED_TEST_CONCURRENCY=12 vs layered runner repeatshardcodes | `done` | `run-curated-tests.mjs` 已退出当前主干执lines链，Issue单针对的是旧 curated 快速套件入口。 |
| 717 | scripts/run-curated-tests.mjs:13-17 blockedEnvPatterns 漏 *_KEY/*_API_KEY/AA_API_KEYS_JSON/OPENAI_API_KEY | `done` | 该Issue随旧 curated runner 退役失效；现lines分层 runner 已覆盖 `*_KEY`、`*_API_KEY` vs `AA_API_KEYS_JSON`。 |
| 718 | scripts/run-curated-tests.mjs:78 不像 layered runner 注入 --expose-gc，curated 命中 leak 用例时 global.gc 静默 undefined | `done` | 旧 curated runner 已不再参vs主干门禁，泄漏相关能力现统一由 `run-layered-tests.mjs` 承担。 |
| 719 | scripts/run-layered-tests.mjs:195 env: process.env 直接透传，未应用 blockedEnvPatterns 过滤 | `done` | vs 711 同根因，旧 runner 直接透传环境；现已统一走 `buildChildEnv()` 过滤敏感键。 |
| 720 | scripts/run-layered-tests.mjs:173 强制 --test-force-exit 掩盖未关闭句柄/timers，泄漏被静默 | `done` | 旧 runner 用 `--test-force-exit` 掩盖资源泄漏；该参数现已移除，测试进程按真实句柄Status退出。 |
| 721 | scripts/run-layered-tests.mjs:200-205 child.on("exit") 而非 "close"，stdio 未排空即 resolve | `done` | 旧实现等待的是进程退出而不是 stdio 收尾；现已改为监听 child `close`。 |
| 722 | scripts/run-layered-tests.mjs no child.on("error")，spawn 失败 promise 永挂起 | `done` | 子进程异常路径此前未覆盖；现已增加 `child.once("error", ...)` 并显式 reject。 |
| 723 | scripts/run-layered-tests.mjs:217 只匹配 .test.ts，遗漏 .test.tsx/.test.mts/.spec.ts | `done` | 旧文件匹配过窄；现已扩展为 `.(test|spec).(ts|tsx|mts)`。 |
| 724 | scripts/run-layered-tests.mjs:84-105 listFilesRecursively 不跳 node_modules/.git | `done` | 旧递归遍历缺少目录裁剪；现已跳过 `node_modules`、`.git`、`dist`、`coverage`、`.cache`。 |
| 725 | scripts/clean-dist.mjs no --dry-run，误调用即 rmSync(dist) 不可恢复 | `done` | 清理脚本过去只有真实删除路径；现已支持 `--dry-run` 输出待删除内容。 |
| 726 | scripts/architecture-boundary-scan.mjs no SARIF 输出，PR comment流程缺失 | `done` | 旧扫描器只写 JSON；现已额外生成 `architecture-boundary-scan-report.sarif`。 |
| 727 | scripts/scan-current-codebase-gap.mjs 输出含 Date.now() 时间戳但no git ignore | `done` | 该Issue针对旧版 timestamp 命名产物；现lines脚本输出固定到 `artifacts/current-codebase-gap-review-v1.9.json`，且 `artifacts/` 已被 git ignore。 |
| 728 | scripts/generate-src-module-test-matrix.mjs vs audit-codebase-inventory.mjs repeats扫描 src，no共享 walker | `done` | 相关脚本已不puts当前主干脚本清单里，Issue单针对的是已撤下的旧代码盘点工具。 |
| 729 | scripts/reorg-code-structure.mjs 五平面迁移完成后no脚本绑定，遗留死脚本 | `done` | 五平面迁移完成后，这个重组脚本已退出当前主干入口，Issue单描述的是已清退的历史脚本。 |
| 730 | scripts/backup-sqlite.sh no set -euo pipefail，部分错误被忽略继续 | `done` | 当前 `backup-sqlite.sh` 顶部已显式启用 `set -euo pipefail`，Issue单基于旧快照。 |
| 731 | scripts/backup-sqlite.sh 加密路径no IV/nonce，openssl enc -salt defaults to PBKDF1 已弱化 | `done` | 旧加密路径参数不完整；现已固定使用 `-salt -pbkdf2 -iter 200000 -md sha256`，避免退化到弱派生参数。 |
| 732 | scripts/backup-sqlite.sh 备份完成后no sha256sum 校验 | `done` | 旧备份完成后缺少完整性旁路校验；现已为备份产物生成 `.sha256` sidecar。 |
| 733 | scripts/restore-sqlite.sh no原子替换，恢复中断即数据库永损 | `done` | 恢复流程过去直接覆盖目标 DB；现已先复制到临时文件、做 integrity check，再 `mv -f` 原子替换。 |
| 734 | scripts/restore-sqlite.sh 不校验备份 schema 版本vs当前 migrations 兼容 | `done` | 旧恢复只校验 SQLite 完整性，不看 schema 代际；现已比对备份 schema、当前库版本vs仓库 migration head。 |
| 735 | scripts/backup-sqlite.sh/restore-sqlite.sh defaults to DB 路径vs CONTRIBUTING/helm/AA_DB_PATH 四occurrencesinconsistent | `done` | defaults to DB 名称先前多occurrences漂移；当前 CONTRIBUTING、Helm、backup/restore defaults to值都已统一为 `automatic-agent.db`，`automatic-agent-dev.db` only是本地栈显式 override。 |
| 736 | scripts/backup-sqlite.sh no lock，vs运lines中 sqlite WAL concurrent，.backup busy 时静默重试 5s 后失败 | `done` | 旧备份路径缺少concurrent互斥vs busy 等待；现已增加 lock 目录并puts `.backup` 前设置 sqlite `.timeout 5000`。 |
| 737 | deploy/scripts/deploy.sh 蓝绿切换前未校验 new selector pod ready 数==replicas | `done` | 旧蓝绿切换只看 rollout 成功；现已puts切换 Service selector 前校验 `readyReplicas == spec.replicas`。 |
| 738 | deploy/scripts/rollback.sh 解析 helm history 通过 awk 列号，helm 输出格式变更即崩 | `done` | 当前回滚脚本已改为 `helm history --output json` + Node 解析，不再relies on表格列宽。 |
| 739 | deploy/scripts/dr-drill.sh 触发 region 切换no dry-run flag | `done` | 现lines `dr-drill.sh` 并don't exist region 切换分支，Issue单针对的是旧设想路径；对实际支持的参数链路现已补齐 dry-run。 |
| 740 | deploy/scripts/verify-hot-upgrade.sh only校验 HTTP 200，未比对版本 header/build hash | `done` | 旧热升级校验只验健康接口可达；现已补 `x-app-version` vs `x-build-commit` 头部校验。 |
| 741 | deploy/scripts/*.sh 全no set -euo pipefail | `done` | 当前 `deploy.sh`、`rollback.sh`、`dr-drill.sh`、`verify-hot-upgrade.sh` 均已启用 `set -euo pipefail`，Issue单基于旧Status。 |
| 742 | deploy/scripts/*.sh 错误退出码doesn't distinguish（统一 1） | `done` | 部署脚本过去没有分层错误码；现已为 usage、validation、dependency、deployment/rollback/runtime 失败分别定义退出码。 |

## config/

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 743 | config/{bootstrap,cost-alert,exception-recovery,gateways,knowledge,nl-gateway,plugins,product,risk,workflows,dr,constitution}/ only default.json no环境覆盖 | `done` | 旧 review 把 concern-scoped canonical default 误判成“缺少环境层”；`config/README.md` 已明确只有 `environments/runtime/security` 支持 overlay。 |
| 744 | divisions/coding/division.yaml:7 coding_primary vs config/domains/coding.json:6 coding.primary 双风格 | `done` | review 混淆了 domain baseline workflow ID vs division executable workflow ID；`config/README.md` 已明确二者不是同一命名空间。 |
| 745 | config/domains/default.json 是 {domains:[...]} 数组型，其余文件为单对象，schema 不兼容 | `done` | Root cause: 把 `config/domains/default.json` 的“defaults to域目录聚合层”误当成单个 domain leaf schema；现lines contract 已明确它是 `domains` defaults to集合层，而其余 `config/domains/*.json` 才是单 domain 定义。 |
| 746 | config/domains/(32) vs divisions/(32) ID 集合不synchronous，no映射文件 | `done` | `config/domains/` vs `divisions/` 本就不是 1:1 镜像；`config/README.md` 已把 domain baseline vs division surface 的边界写成显式规则。 |
| 747 | config/runtime/{dev,staging,pre-prod,test,prod}.json only覆盖任务exceeds时类字段，prod 速率/熔断等于defaults to | `done` | overlay contract 是“只覆盖环境差异”，不是“复制一份 prod full配置”；`docs_zh/reference/environment-configuration.md` 已明确 default + overlay 继承规则。 |
| 748 | config/security/prod.json only approvalMode:"strict"，其它字段同 default | `done` | 安全 overlay 只声明vsdefaults to层不同的字段；旧 review 误把继承设计当成缺项。 |
| 749 | config/security/threat-matrix.json:3-4 版本/updatedAt 2026-04，已 1+ 月未更新 | `done` | threat matrix 长期没有月度回写；当前版本和更新时间已更新到 `2026-05-29`。 |
| 750 | config/README.md:9 only描述 3 个子目录，实际 17 个，README 严重过期 | `done` | config 目录扩张后 README 没跟进；现已补齐完整布局、命名例外和 layering 规则。 |
| 751 | config/conversation/templates.json 是唯一非 default.json 命名 | `done` | 原因不是命名漂移，而是多模板 registry 被误审为 mergeable default；README 已写明这是有意例外。 |
| 752 | config/validation/mission-operating-model-metric-alert-policy.yaml 是唯一 YAML，混合格式 | `done` | review 未区分 machine registry vs human policy 文本；README 已明确该 YAML 是刻意保留的人类维护策略文件。 |
| 753 | config/quality/test-exclusion-allowlist.json vs tsconfig.json:32-115 two exclusion 列表不synchronous生成 | `done` | 早期没有自动对账；现有 `scripts/ci/audit-test-exclusions.mjs` 已把 allowlist vs `tsconfig.json` 漂移纳入审计。 |
| 754 | config/environments/{default,dev,prod,...}.json imageRepository:"automatic-agent-system" vs helm/Dockerfile automatic-agent-platform 漂移 | `done` | 环境镜像仓库名长期accesses along用旧仓库名；现已统一为 `automatic-agent-platform`。 |
| 755 | config/bootstrap/default.json appName:"automatic-agent-system" vs package.json:name、Chart.yaml:name 三套名 | `done` | bootstrap 名称没有随仓库主名迁移；现已统一为 `automatic-agent-platform`。 |
| 756 | config/dr/default.json:5 RETENTION_DAYS=7 vs retentionPolicy.{daily:7,weekly:4,monthly:12} semantic conflict | `done` | 该条基于旧快照中的已移除字段；当前 `config/dr/default.json` 已don't exist `RETENTION_DAYS` 这一conflicts键。 |
| 757 | config/quality/division-catalog.json qa.canonicalDivisionId:quality-assurance 但二者 default_workflow 不同，alias 单向 | `done` | 旧文档把 alias 误读成同义目录；`docs_zh/reference/division-catalog.md` 已明确 `qa` 只是 smoke alias，不等同于 release certification。 |
| 758 | config/runtime/default.json:1-3 only其声明 configVersion:v4.3，其余 default.json no版本，v4.3 强制inconsistent | `done` | review 把 runtime bundle 版本要求外推到所有 config family；README 已明确 `configVersion/configSchemaVersion` 只约束 runtime bundle。 |
| 759 | config/risk/default.json:1 $schema 指 JSON-Schema 元 URL，非项目 schema，$schema 误用 | `done` | 风险配置曾误用了通用 meta-schema；该字段已移除，并puts README 明确仓库不relies on `$schema` 作为 SOT。 |
| 760 | 仓库no AA_DATA_DIR env 变量统一 SQLite/data 持久化根，data/ puts config/Dockerfile/helm 多occurrenceshardcodes | `done` | 旧Issue把non-existent运lines时约定当成缺失能力；现已明确只以 `AA_DB_PATH` 作为 SQLite 路径入口，不再虚构 `AA_DATA_DIR` 合约。 |
| 761 | config/runtime/default.json 单位混用，shutdownGracePeriodMs:10000 含义inconsistent (s vs ms) | `done` | 该结论来自对字段名误读；README 已显式注明 `shutdownGracePeriodMs` 使用毫秒，don't exist秒/毫秒混用。 |
| 762 | config/runtime/default.json:6,7 apiDefaultTimeoutMs<apiMaxTimeoutMs 但no校验 | `done` | 早期缺少显式证据链；现有 config shape 测试和治理校验已固定 `apiDefaultTimeoutMs < apiMaxTimeoutMs`。 |
| 763 | config/runtime/default.json:12-16 circuitBreaker.threshold no windowMs，半开/重置策略未定义 | `done` | Root cause: 运lines时defaults to配置只保留了threshold，没有把 reset/half-open 语义显式写回配置层；本轮已补 `resetMs` vs `halfOpenMaxAttempts`。 |
| 764 | config/runtime/default.json:17-21 三层 rateLimit 未文档化级联语义 | `done` | runtime rate-limit 分层原本只存puts于代码直觉；README 已明确 global -> tenant -> principal 的级联约束。 |
| 765 | config/runtime/default.json:23-25 configDriftReconciler.interval:300000 单位 ms no后缀 | `done` | legacy 字段名缺少 `Ms` 后缀但单位未写明；README 已把该键声明为毫秒字段。 |
| 766 | config/runtime/prod.json only 3 字段 override，未声明 configVersion vs default v4.3 漂移 | `done` | prod overlay 以前没有显式repeats runtime bundle 版本；各 runtime overlay 现已补齐 `configVersion/configSchemaVersion`。 |
| 767 | config/security/*.json 6 文件no $schema 字段 | `done` | 该条把 `$schema` 当成必须项，但仓库现lines策略是不relies on通用 meta-schema URL；README 已明确这一治理口径。 |
| 768 | config/security/threat-matrix.json vs config/risk/register.json 双风险来源no交叉校验 | `done` | 旧 review 把 STRIDE 控制矩阵和运营风险台账误当成repeats来源；README 已明确二者是不同治理视角，不做 1:1 镜像。 |
| 769 | config/providers/default.json/models.json/models.bundled.json 三文件命名不统一 | `done` | providers 目录中的三个文件承担不同职责而非命名漂移；README 已把三者区分为 default、local catalog、bundled snapshot。 |
| 770 | config/providers/models.bundled.json 不puts package.json files，npm publish 遗漏 | `done` | 发布清单长期漏掉 bundled model snapshot；`package.json` 已把 provider config 文件加入 `files`。 |
| 771 | config/conversation/templates.json no i18n 字段或 locale 后缀 | `done` | review 误把模板 registry 当成按 locale 切分的文件树；README 已明确该文件是单一模板注册表，不采用 `default.json`/locale 文件命名。 |
| 772 | config/environments/default.json vs config/runtime/default.json 字段overlaps合并优先级未文档化 | `done` | 多环境配置优先级过去只散落puts实现；`docs_zh/reference/environment-configuration.md` 现已明确 merge 顺序。 |
| 773 | config/quality/default.json thresholdvs check-coverage-baseline.mjs dual sources | `done` | 该条混淆了运lines时质量评分thresholdvs仓库 coverage gate；README 已把两者的治理边界拆开说明。 |
| 774 | config/quality/test-exclusion-allowlist.json 路径no schema 校验，typo 永远命不中 | `done` | 早期没有对 allowlist 漂移做可执lines检查；`audit-test-exclusions.mjs` 现puts会校验缺失项、意外项和no效 anchor。 |
| 775 | config/risk/register.json vs divisions/*/division.yaml risk_profile no交叉校验 | `done` | globally risk register vs division-local `risk_profile` 被误判成同一层 SOT；README 已明确二者分属运营台账和域内执lines分类。 |
| 776 | docs_zh/reference/division-catalog.md vs config/quality/division-catalog.json 列名inconsistent | `done` | 文档过去只写自然语言说明，没有对齐机器字段；division-catalog 文档现已补齐字段映射表。 |

## divisions/

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 777 | src/plugins/builtin-plugin-registry.ts it-operations/game-dev/livestream 三个 domainId vs divisions/ + src/domains/ 实际目录 operations/gaming/live-streaming inconsistent | `done` | builtin plugin manifest 里残留旧 domainId；registry vs runtime plugin 定义现已对齐到 `operations/game-dev/live-streaming` 实际目录。 |
| 778 | src/plugins/adapters/livestream-adapter.ts capability id hardcodes字符串数组，未vs divisions/live-streaming/ 注册中心交叉校验 | `done` | review 把 `divisions/` 误当成 capability registry；现已puts division-catalog 文档明确 capability SOT 属于 plugin manifest/runtime plugin，而非 division metadata。 |
| 779 | src/plugins/builtin-plugin-registry.ts (domain id 表) it-operations/game-dev/livestream 三个 domainId vs divisions/ + src/domains/ 实际目录 operations/gaming/live-streaming inconsistent，注册即拼接error path。EN: registry domain-ids drift from on-disk catalog. | `done` | 同 777，registry manifest 已vs实际 domain/division 目录统一。 |
| 780 | src/plugins/adapters/livestream-adapter.ts capability id hardcodes字符串数组，未vs divisions/live-streaming/ 注册中心交叉校验. EN: capability ids drift from division catalog. | `done` | 同 778，旧审计基于错误的 capability authority 假设；现已puts文档中明确 plugin manifest 才是 capability SOT。 |
| 781 | division-catalog.json only 6 项，divisions/ 实际 32 项 | `done` | 该条来自旧快照；当前 catalog 已覆盖全部 32 个活跃 division。 |
| 782 | divisions/ 目录 ID 混合 snake_case vs kebab-case，vs yaml id: 字段inconsistent | `done` | family 命名混合是有意的历史兼容，但 `division.yaml id` vs目录名现已对齐；旧条目把“风格混合”误写成“ID inconsistent”。 |
| 783 | divisions/qa/division.yaml 缺 §37 强制字段（domain_descriptor/risk_profile/eval_spec） | `done` | `qa` division 一直accesses along用简版模板；现已补齐 §37 强制字段。 |
| 784 | divisions/qa/roles/test_architect.prompt.md puts yaml 中no角色绑定，孤儿 prompt | `done` | `test_architect` prompt 过去未绑定到 division 角色；当前 `qa/division.yaml` 已显式挂接。 |
| 785 | divisions/quality-assurance/roles/ only qa_engineer.prompt.md，发布认证职能only 1 角色可疑 | `done` | `quality-assurance` 之前缺少发布认证职责角色；现已补 `release_certifier`。 |
| 786 | divisions/coding/workflows/coding_primary.yaml:5 用相对路径 schemas/coding-output.json，only cwd=division 时才解析 | `done` | workflow schema path 旧担忧没有复核 loader；`DivisionLoader.resolveWorkflowOutputSchemaPath()` 现已把相对路径解析为 division-root 下的绝对受控路径。 |
| 787 | divisions/qa/division.yaml:5 priority:30 vs coding/division.yaml:5 priority:50 含义no标度文档 | `done` | Root cause:  division catalog 只有“可并列”说明，没有把 priority band 的语义档位写明；本轮已puts `docs_zh/reference/division-catalog.md` 补 priority band 标度表。 |
| 788 | divisions/coding/division.yaml:5,7 default_workflow vs orchestration_workflow 同值，字段语义repeats | `done` | Root cause:  legacy workflow alias 一直没有被 blueprint 语义字段取代；本轮已补 `default_plan_blueprint_ref` / `orchestration_plan_blueprint_ref`，把“defaults to计划”vs“多步编排计划”的语义拆开，legacy workflow 键only保留 loader 兼容。 |
| 789 | divisions/healthcare/、legal/ only单专家角色，no qa/合规第二角色，但 risk profile 声明 humanAccountable:true | `done` | 高风险 division 之前缺少第二人类治理角色；`healthcare` vs `legal` 现已补充 reviewer。 |
| 790 | divisions/financial-services,healthcare,legal,quant-trading,security/division.yaml:5 5 occurrences priority:60 并列，路由命中靠字母序 | `done` | 旧审计把粗粒度 priority 误当成必须globally唯一；文档现已明确并列 priority 合法，真实路由还结合 trigger/disambiguate/稳定排序。 |
| 791 | divisions/advertising,customer-service,devops,ecommerce,human-resources,quality-assurance/division.yaml:5 6 occurrences priority:45 并列 | `done` | 同 790，IssueRoot cause: 把 priority band 误审为唯一键。 |
| 792 | divisions/coding,engineering_ops,finance-accounting,live-streaming/division.yaml:5 4 occurrences priority:50 并列 | `done` | 同 790，priority 设计是 band 而不是 total order。 |
| 793 | divisions/data-engineering,knowledge-base,product-management,project-management,research/division.yaml:5 5 occurrences priority:40 并列 | `done` | 同 790，旧 review 忽略了后续 tie-break 规则。 |
| 794 | divisions/academic-research,design,industry-research,user-operations/division.yaml:5 4 occurrences priority:35 并列 | `done` | 同 790，priority 并列并不等于靠字母序抢路由。 |
| 795 | divisions/analytics,content,qa/division.yaml:5 3 occurrences priority:30 并列 | `done` | 同 790，Issueputs于审计假设了“priority 必须唯一”。 |
| 796 | divisions/analytics/division.yaml 36 lines vs coding/division.yaml 72 lines字段集差距巨大，标准模板缺失 | `done` | Root cause:  analytics 仍停留puts早期瘦身模板，缺少和主干 division 一致的 descriptor/risk/eval/blueprint 结构；本轮已补齐标准字段集。 |
| 797 | divisions/qa/division.yaml vs quality-assurance/division.yaml default_workflow 不同但 catalog 暗示等价，alias 单向不对称 | `done` | 文档过去没有把 `qa` 的 smoke-alias 语义讲清；division catalog 现已明确二者故意不对称。 |
| 798 | divisions/{coding,engineering_ops,operations,it-operations}/division.yaml 工作流字段顺序/缩进风格inconsistent，YAML diff 噪音大 | `done` | Root cause: 多轮手工补字段时没有统一 authoring order；本轮已把 blueprint/workflow/descriptor/risk/eval 段顺序对齐。 |
| 799 | divisions/*/workflows/*.yaml references用 schema 用相对 ../../schemas/... 路径，CI 工作目录改变即解析失败 | `done` | loader 已puts division root 下解析并沙箱校验 workflow schema path，Issue条目没有吸收现lines实现。 |
| 800 | divisions/security,qa/division.yaml 简版（42/40 lines）缺 §37 字段；catalog 把 security 当独立 family 而 qa 当 alias，分类inconsistent | `done` | `security/qa` 简版定义长期滞后；现已补齐 §37 字段，catalog 也已明确 `security` 为独立 family、`qa` 为 alias。 |
| 801 | divisions/operations,support,design,research,content/division.yaml 5 occurrences <60 lines未含 resource_boundaries/fault_domains | `done` | 该条基于旧简版 division 快照；当前这些 division 已含 `resource_boundaries` vs `fault_domains`。 |

## deploy/helm

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 802 | deploy/helm/automatic-agent/templates/networkpolicy.yaml:23-30 Egress only放lines UDP/TCP 53，PG/Redis/OTel/外部 API 全断 | `done` | Root cause: 初版 NetworkPolicy 只按 DNS 最小集writes，没有覆盖 PostgreSQL/Redis/HTTPS/OTLP 等真实出站relies on；本轮已补齐 443/5432/6379/4317/4318。 |
| 803 | deploy/helm/automatic-agent/templates/networkpolicy.yaml:16-18 Ingress namespaceSelector:{} 任何 namespace 可入 | `done` | Root cause:  ingress 白名单之前图省事用全 namespace 放通；本轮已改成业务端口only同 namespace、metrics 端口只允许显式监控 namespace selector。 |
| 804 | deploy/helm/.../values.yaml:124-126 PVC ReadWriteOnce + values-prod.yaml:3 replicaCount:3 + 自动扩缩 3-10，跨节点不可挂载 | `done` | Root cause: 多副本生产 overlay 仍accesses along用 sqlite PVC 方案；本轮已把 staging/pre-prod/prod 的多副本场景切到 postgres + external secret，并关闭 sqlite persistence。 |
| 805 | deploy/helm/.../values-prod.yaml:31-40 ingress hosts automatic-agent.example.com 占位提交为生产值 | `done` | Root cause: 生产域名以前只能relies on repo 内 values；本轮部署 workflow 已强制从 `PUBLIC_DOMAIN` 输入/环境绑定覆写 ingress.domain，不再relies on仓库中的示例 host。 |
| 806 | deploy/helm/.../values.yaml:99-105 secrets: 块含 AA_API_JWT_SECRET/ANTHROPIC_API_KEY/...，鼓励操作员把secret提交到 chart | `done` | Root cause:  chart 同时暴露 inline secret 路径却没有 fail-close 语义；当前defaults to `allowInlineSecrets=false`，externalSecret vs inline values 也已做互斥校验。 |
| 807 | deploy/helm/.../templates/deployment.yaml:7-9 终止周期断言谓词vs"必须大于"消息inconsistent（<= vs <） | `done` | Root cause:  review 把 `<=` 误读成vs“必须大于”矛盾；实际上 `terminationGracePeriodSeconds <= preStopSleepSeconds` 正是需要 fail 的条件。 |
| 808 | deploy/helm/.../templates/deployment.yaml:67-70 即使 AA_STORAGE_DRIVER=postgres 也注入 AA_DB_PATH=...sqlite | `done` | Root cause:  deployment 模板把 sqlite 路径no条件注入；本轮已改为onlyputs sqlite persistence 场景下注入 `AA_DB_PATH`。 |
| 809 | docs_zh/operations/release-versioning.md vs deploy/helm/.../Chart.yaml 版本no自动synchronous检查 | `done` | Root cause: 发布文档vs Chart/package 版本只靠人工synchronous；本轮已puts文档声明当前基线版本，并由 `audit-ci-supply-chain.mjs` 强制 `package.json` vs `Chart.yaml` 对齐。 |
| 810 | helm/templates/servicemonitor.yaml:11-12 selector 含 helm.sh/chart/version 标签，每iterations升级都失配 metrics service | `done` | Root cause:  ServiceMonitor 之前用整套 common labels 做 selector，把 chart/version 这种会漂移的标签也带进去了；本轮已改成稳定 selector labels + metrics component。 |
| 811 | helm/templates/servicemonitor.yaml 选择 app.kubernetes.io/name=automatic-agent vs主 service 同标签，会抓 :3000 而非 :9090 | `done` | Root cause:  metrics service 之前没有独立 component label；本轮主 service 标 `component=api`，metrics service 标 `component=metrics`，ServiceMonitor 只抓 metrics service。 |
| 812 | helm/templates/prometheusrule.yaml:13 用 up{job="...-metrics"}，但 deploy/prometheus/prometheus.yml job_name 为 compose/k8s，规则never matches | `done` | Root cause:  Helm 告警模板曾假设固定 `*-metrics` job 名；本轮已改为基于 release fullname 模糊匹配实际 scrape job。 |
| 813 | helm/templates/prometheusrule.yaml only 1 条 alert，而 deploy/prometheus/rules/automatic-agent.yml 21 条；helm 集群丢失 20 条告警 | `done` | Root cause:  Helm `PrometheusRule` 之前只维护了一个缩略告警面；本轮已把 21 条告警和 2 条 recording rules fullsynchronous到 chart，并用 golden test 强制 Helm vs `deploy/prometheus/rules/automatic-agent.yml` synchronous。 |
| 814 | helm/templates/canary-ingress.yaml:18,21 hosts 为空仍渲染，pathType defaults to缺失，nginx-ingress/K8s≥1.18 拒绝 | `done` | Root cause:  canary ingress 没复用主 ingress 的 host/path fallback 逻辑；本轮已补 domain required、host defaults to值和 `pathType: Prefix` defaults to。 |
| 815 | helm/templates/pdb.yaml:7-12 defaults to minAvailable:1 + replicaCount:1 阻塞 drain；同时 minAvailable vs maxUnavailable 都被渲染时 K8s 拒绝 | `done` | Root cause:  PDB 模板缺少互斥保护，且环境 values 仍accesses along用 `minAvailable`；本轮已加互斥 fail-close，并把 staging/pre-prod/prod 切到 `maxUnavailable: 1`。 |
| 816 | helm/templates/hpa.yaml:34 range customMetrics ... toYaml(list .) \| nindent 4 产嵌套 list of list | `done` | Root cause:  review 把 Helm 中“individual metric 对象包装成单元素 list 再渲染”的常用模式误判成 list-of-list；当前模板仍按该模式输出合法 HPA metrics 条目，且本轮已补 queue-depth custom metrics overlay。 |
| 817 | helm/templates/deployment.yaml:7-9 fail puts metadata 已开括号后触发，渲染产生破损片段 | `done` | Root cause:  fail guard 之前放puts YAML 头部对象已via开始之后；本轮已把 guard 移到 manifest 起始occurrences。 |
| 818 | helm/templates/deployment.yaml:48 only按 tag/AppVersion，忽略 image.digest，no法 digest pin | `done` | Root cause:  deployment 只支持 tag 拼镜像references用；本轮已支持 `image.digest` 优先生成 `repo@sha256:...`。 |
| 819 | helm/templates/deployment.yaml:131-159 liveness/readiness/startup 都打 /healthz，readiness 失败即 liveness 重启循环 | `done` | Root cause:  liveness/readiness 以前共用同一个 HTTP 健康端点；本轮已改成 liveness 用 TCP，readiness/startup 用 HTTP healthz，避免就绪抖动直接触发重启。 |
| 820 | helm/values.yaml:131-149 startupProbe 最长 150s，readinessProbe 30s 内必失败 → pod puts startup 完成前被重启 | `done` | Root cause:  probe 时间窗配置过短；本轮已拉长 startupProbe 到 300s，并让 liveness 不再vs startup overlaps。 |
| 821 | helm/values.yaml:136 livenessProbe initialDelaySeconds:10 vs startupProbe overlaps，liveness puts startup 进lines中即触发 | `done` | Root cause:  probe 设计没有区分“进程活着”vs“服务就绪”；本轮已把 liveness 改成 TCP 且由 startupProbe 接管启动阶段。 |
| 822 | helm/values-prod.yaml:46 设 AA_STORAGE_DRIVER:postgres 但no DSN env/externalSecret，pod crashloop | `done` | Root cause:  prod/pre-prod overlay 切到 postgres 时没把 DSN 也接入 secret manager；本轮已补 `AA_STORAGE_POSTGRES_DSN` externalSecret 条目。 |
| 823 | helm/values-pre-prod.yaml 文件名带 -，namespace automatic-agent-preprod 不带，命名规范化inconsistent | `done` | Root cause:  deploy workflow 手工 special-case 写成了 `automatic-agent-preprod`；本轮已统一成 `automatic-agent-pre-prod`。 |
| 824 | helm/templates/secret.yaml:1-3 渲染条件不互斥，inline+externalSecret 同真时仍输出 --- 分隔符 | `done` | Root cause:  secret 模板此前允许“值层面同时给 inline vs externalSecret”而没有显式拒绝；本轮已去掉孤立分隔符，并对两种模式做互斥 fail-close。 |
| 825 | deploy/helm/automatic-agent/templates/networkpolicy.yaml egress only放lines 53/UDP DNS，未开 5432/6379/443，启用即 outbound 全断 | `done` | 同 802，Root cause:  NetworkPolicy 没按真实relies on面展开端口。 |
| 826 | deploy/helm/automatic-agent/templates/deployment.yaml only inline env:，从未挂载 configmap.yaml 渲染产物，ConfigMap 实质死代码 | `done` | Root cause:  deployment 只做 inline env 展开，没有消费 chart 渲染出的 ConfigMap；本轮已加 `envFrom.configMapRef`。 |
| 827 | deploy/helm/automatic-agent/Chart.yaml 缺 kubeVersion: 约束 | `done` | Root cause:  Chart 元数据之前只写了 version/appVersion；本轮已补 `kubeVersion: >=1.28.0-0`。 |
| 828 | deploy/helm/automatic-agent/Chart.yaml 缺 maintainers，OCI registry 推送元数据空 | `done` | Root cause:  Chart 元数据不完整；本轮已补 maintainers。 |
| 829 | deploy/helm/automatic-agent/Chart.yaml appVersion vs package.json version 漂移 | `done` | Root cause: 版本synchronous此前靠人工检查；当前 `package.json`、`Chart.yaml version/appVersion` 已对齐为 `0.2.0`，并纳入 `audit-ci-supply-chain`。 |
| 830 | deploy/helm/automatic-agent/values.yaml vs values-{dev,test,staging,pre-prod,prod}.yaml 多occurrences键名inconsistent，override 静默失效 | `done` | Root cause:  sparse overlay 被误审为“必须复制完整键集”；本轮已把关键 deploy/monitoring/storage/hpa 键puts环境 overlay 上显式补齐，其余继续按 base+overlay 继承契约工作。 |
| 831 | deploy/helm/automatic-agent/values-prod.yaml 未设 podAntiAffinity，所有 replica 可调度同节点 | `done` | Root cause:  prod overlay 没有明确反亲和；本轮已补 `podAntiAffinity.requiredDuringSchedulingIgnoredDuringExecution`。 |
| 832 | deploy/helm/automatic-agent/values.yaml image.pullPolicy: Always 缺省，回滚到旧 tag 仍拉新镜像 | `done` | Root cause: 环境 overlay 曾defaults to `Always`；本轮已把 env overlays 收敛到 `IfNotPresent`，并支持 digest pin。 |
| 833 | deploy/helm/automatic-agent/templates/deployment.yaml securityContext 缺 readOnlyRootFilesystem/allowPrivilegeEscalation:false/runAsNonRoot:true | `done` | Root cause: 容器级 securityContext 不完整；当前已显式声明这三项并继续 drop ALL capabilities。 |
| 834 | deploy/helm/automatic-agent/templates/deployment.yaml 缺 topologySpreadConstraints | `done` | Root cause: 多副本调度只靠 affinity；本轮 deployment 已支持 `topologySpreadConstraints`，prod overlay 也已启用。 |
| 835 | deploy/helm/automatic-agent/templates/deployment.yaml liveness/readiness 同一 /health，liveness 抖动级联重启 | `done` | 同 819，Root cause:  probe 语义未拆分。 |
| 836 | deploy/helm/automatic-agent/templates/deployment.yaml 缺 startupProbe，慢启动场景下 liveness 早于就绪触发 kill | `done` | Root cause:  review 基线过期；模板本来就有 startupProbe，本轮还把时间窗拉长并vs liveness 解耦。 |
| 837 | deploy/helm/automatic-agent/templates/secret.yaml 直接将 secrets base64 嵌入 manifest，vs externalsecret 同时启用semantic conflict | `done` | Root cause:  secret 模式缺少互斥门禁；当前 externalSecret vs inline secrets 已显式互斥，且defaults to禁止 inline secret。 |
| 838 | deploy/helm/automatic-agent/templates/externalsecret.yaml 未设 refreshInterval | `done` | Root cause:  review 基线过期；模板此前已via渲染 `refreshInterval`，本轮accesses along用并保留defaults to `1h`。 |
| 839 | deploy/helm/automatic-agent/templates/hpa.yaml only CPU 指标no RPS/queue depth | `done` | Root cause:  HPA 模板虽支持 custom metrics，但环境 overlay 没有实际配置；本轮puts staging/pre-prod/prod 增补 `queued_tasks` custom metrics。 |
| 840 | deploy/helm/automatic-agent/templates/hpa.yaml 缺 behavior.scaleDown.stabilizationWindowSeconds | `done` | Root cause:  autoscaling defaults tolines为未显式声明；本轮已补 scaleDown stabilization。 |
| 841 | deploy/helm/automatic-agent/templates/pdb.yaml minAvailable vs HPA minReplicas 同值，滚动升级时 PDB 阻塞 evict | `done` | Root cause: 生产类 overlay 用 `minAvailable` 锁死了 eviction；本轮已切换到 `maxUnavailable: 1`。 |
| 842 | deploy/helm/automatic-agent/templates/ingress.yaml 未声明 tls/cert-manager annotation | `done` | Root cause:  ingress 模板对 TLS relies on没有 fail-close，而环境 overlay 也没被契约化；本轮 ingress 启用时可要求 TLS，staging/pre-prod/prod overlay 都显式携带 cert-manager annotation。 |
| 843 | deploy/helm/automatic-agent/templates/canary-ingress.yaml 缺 canary-by-header 紧急分流通道 | `done` | Root cause:  canary ingress 只支持按权重；本轮已支持 `canary.byHeader` / `byHeaderValue`。 |
| 844 | deploy/helm/automatic-agent/templates/servicemonitor.yaml selector label vs service template inconsistent，抓取目标 0 | `done` | Root cause:  selector 用 common labels、service 又没有 metrics 专属标签；本轮已统一为 selector labels + `component=metrics`。 |
| 845 | deploy/helm/automatic-agent/templates/prometheusrule.yaml groups[].interval 未设 | `done` | Root cause:  Helm PrometheusRule 没把 rule group interval 参数化；本轮已补 `monitoring.prometheusRule.interval`。 |
| 846 | deploy/helm/automatic-agent/templates/resourcequota.yaml only限 requests，不限 count/services.loadbalancers | `done` | Root cause:  ResourceQuota 模板只覆盖 CPU/内存；本轮已补 PVC、LB、NodePort 数量限制。 |
| 847 | deploy/helm/automatic-agent/templates/limitrange.yaml 未配 default/defaultRequest | `done` | Root cause:  review 基线过期；当前 LimitRange 模板一直有 `default` vs `defaultRequest`。 |
| 848 | deploy/helm/automatic-agent/templates/pvc.yaml 缺 storageClassName | `done` | Root cause:  review 基线过期；PVC 模板已显式渲染 `storageClassName`。 |
| 849 | deploy/helm/automatic-agent/crds/automatic-agent-chaos-approval-policies.yaml CRD vs chart 同包，helm uninstall 不删 CRD | `done` | Root cause:  CRD 放puts Helm `crds/` 目录，生命周期脱离 release；本轮已移动到 `templates/` 并受 `crds.enabled` 控制。 |
| 850 | deploy/helm/automatic-agent/templates/configmap.yaml 渲染但未puts deployment envFrom references用，孤儿资源 | `done` | 同 826，Root cause:  deployment 没消费 ConfigMap。 |
| 851 | deploy/helm/automatic-agent/templates/networkpolicy.yaml podSelector matchLabels hardcoded app: automatic-agent，未走 helper | `done` | Root cause:  review 基线过期；当前 NetworkPolicy 早已使用 `automatic-agent.selectorLabels` helper。 |
| 852 | deploy/helm/automatic-agent/templates/networkpolicy.yaml 未限制 metrics scrape ingress 来源 namespace | `done` | Root cause:  metrics ingress 之前vs业务流量同样放通；本轮已加 `metricsIngressNamespaceSelectors`。 |
| 853 | deploy/helm/automatic-agent/values-staging.yaml replicaCount=1 vs PDB minAvailable 1 互斥 | `done` | Root cause:  review 基线过期；staging 已不是 `replicaCount=1`，且本轮改成 `maxUnavailable: 1`。 |
| 854 | deploy/helm/automatic-agent/values-pre-prod.yaml 未启用 serviceMonitor.enabled | `done` | Root cause:  pre-prod 之前只relies on base values 隐式继承；本轮puts overlay 上显式开启 `monitoring.serviceMonitor.enabled`。 |

## deploy/prometheus & alertmanager

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 855 | docker-compose.yml:108-112 alertmanager 用 sed 把 ${SLACK_WEBHOOK_URL}/${PAGERDUTY_SERVICE_KEY} 直插命令lines，泄漏到 ps/日志 | `done` | Root cause:  compose 直接把 secret 替换逻辑写puts argv；本轮已改成独立渲染脚本，由容器内环境变量生成配置，不再把 secret 展开到命令lines。 |
| 856 | docker-compose.yml:91,108 prom/prometheus:v2.54.1、prom/alertmanager:v0.27.0 镜像 2024 中期版，2026 已知 CVE | `done` | Root cause:  compose 监控镜像长期未升级；本轮已把 Prometheus/Alertmanager 升到较新的稳定版。 |
| 857 | deploy/prometheus/prometheus.yml:18-19 抓 api-server:3000/metrics vs helm values.yaml:36-39 metricsPort:9090 inconsistent | `done` | Root cause:  compose vs k8s 两套 scrape 面被混读成同一环境；本轮已把 k8s job 明确收窄到 metrics 端口vs命名空间，compose 仍保留 API `:3000/metrics`。 |
| 858 | deploy/prometheus/alertmanager.yml:24-32 字面 **SLACK_WEBHOOK_URL**/**PAGERDUTY_SERVICE_KEY** 占位；sed 失败时直接被发往字面字符串 | `done` | Root cause:  Alertmanager 配置没有 fail-fast 渲染步骤；本轮渲染脚本会puts缺少 `SLACK_WEBHOOK_URL` / `PAGERDUTY_SERVICE_KEY` 时直接退出。 |
| 859 | deploy/runbooks/production-alert-runbook.md:3 声称vs deploy/prometheus/rules/automatic-agent.yml 1:1 映射，no审计脚本 | `done` | Root cause:  runbook 口径写成“1:1 映射”但没有可执lines约束；本轮已把 runbook 改成 canonical remediation target，并加 golden test 强制每条告警携带 `runbook_url`。 |
| 860 | deploy/prometheus/rules/automatic-agent.yml:32,41,185 histogram_quantile only by (job, le)，per-pod 异常被均值掩盖 | `done` | Root cause: 直方图聚合只保留 job 粒度；本轮 recording rules 改为 `sum by (job, instance, le)`，保留 per-pod 信号。 |
| 861 | deploy/prometheus/rules/automatic-agent.yml:139-140 RSS threshold 512MiB vs values.yaml:43-44 limits.memory:512Mi 完全相等，告警永久触发 | `done` | Root cause:  memory pressure 告警threshold直接贴着容器 limit；本轮已下调到 450MiB。 |
| 862 | deploy/prometheus/rules/automatic-agent.yml no recording rules，每iterations刷盘都重算 histogram_quantile | `done` | Root cause: 高成本直方图查询直接写puts alert expr；本轮已补 recording rules。 |
| 863 | deploy/prometheus/alertmanager.yml:18-21 no inhibit_rules，单iterations延迟事故触发 3 条告警repeats呼叫 | `done` | Root cause:  Alertmanager 路由只有 fan-out，没有抑制规则；本轮已加 critical 抑制 warning 的 inhibit rule。 |
| 864 | deploy/prometheus/alertmanager.yml:8 defaults to receiver ops-null，no severity 标签的告警静默丢弃 | `done` | Root cause:  default route 指向空 receiver；本轮已改成 `slack-default`。 |
| 865 | deploy/prometheus/prometheus.yml:24-32 kubernetes_sd_configs no namespace 过滤，跨租户隔离失效 | `done` | Root cause:  Kubernetes SD 没限定 automatic-agent 命名空间集合；本轮已显式列出受控 namespaces。 |
| 866 | deploy/prometheus/rules/automatic-agent.yml 全部 up{job="...-metrics"} vs prometheus.yml 真实 job_name 不匹配，告警永不触发 | `done` | Root cause: 旧版规则曾hardcoded `*-metrics` job；现lines规则已统一到 `automatic-agent-(compose|kubernetes)`。 |
| 867 | docker-compose.yml alertmanager 通过 sed 注入 webhook secret，明文留 layer 历史 | `done` | 同 855，Root cause:  secret 渲染逻辑放puts运lines命令里。 |
| 868 | docker-compose.yml 暴露 prometheus/alertmanager 端口到 0.0.0.0 no认证 | `done` | Root cause: 本地 compose defaults to把监控端口直接绑到所有网卡；本轮已改成 `127.0.0.1` 绑定。 |
| 869 | deploy/prometheus/prometheus.yml scrape_interval=15s evaluation_interval=15s 同值，大集群 evaluation vs scrape 同帧抢锁 | `done` | Root cause:  scrape/evaluation 频率同帧；本轮已将 evaluation 调整为 30s。 |
| 870 | deploy/prometheus/prometheus.yml 缺 external_labels，多集群 federation no来源标签 | `done` | Root cause:  Prometheus 顶层 metadata 不完整；本轮已补 `external_labels`。 |
| 871 | deploy/prometheus/alertmanager.yml route.group_wait/group_interval/repeat_interval 全 default | `done` | Root cause:  Alertmanager 路由节流参数没有显式治理；本轮已设置 `group_wait/group_interval/repeat_interval`。 |
| 872 | deploy/prometheus/alertmanager.yml only一条 receiver default，severity 路由不分级 | `done` | Root cause:  default route vs severity route 没分层；本轮已拆成 `slack-default` / `slack-warning` / `pagerduty-critical`。 |
| 873 | deploy/prometheus/rules/automatic-agent.yml 21 条告警全no runbook_url annotation | `done` | Root cause: 告警vs runbook 只靠人工约定；本轮已为告警补 `runbook_url`，并由 golden test 审计。 |
| 874 | deploy/prometheus/rules/automatic-agent.yml histogram_quantile(0.95, rate(...[5m])) 未按 (le, job) 分组 | `done` | Root cause:  histogram 聚合粒度过粗；本轮 recording rules 已按 `(job, instance, le)` 保留正确桶维度。 |
| 875 | deploy/prometheus/rules/automatic-agent.yml 多条 for: 0m，no抖动抑制窗口 | `done` | Root cause:  review 基线过期；现lines规则没有 `for: 0m`，本轮也继续保持最短 2m 以上抑制窗。 |
| 876 | deploy/prometheus/rules/automatic-agent.yml severity label 含 warning/critical/page 三套未puts alertmanager route 区分 | `done` | Root cause:  severity taxonomy vs Alertmanager 路由表没有统一；本轮 route 已按 `critical`/`warning`/`page` 分流。 |
| 877 | docs_zh/operations/runbooks/incident-response-playbook.md severity P0/P1 vs alertmanager severity label 取值未对齐 | `done` | Root cause:  incident playbook 只写了 `page/critical/warning -> P1/P2`，没有说明何时升级到 `P0`；本轮已补 `critical -> P0` 的升级条件。 |

## deploy/grafana

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 878 | deploy/grafana/dashboards/automatic-agent.json no版本 pin，Grafana 兼容未声明 | `done` | Root cause:  dashboard JSON 只保留了面板定义，没有把兼容基线显式写出来；本轮已补 `__requires` 元数据，并新增 `deploy/grafana/README.md` 声明 Grafana `10.4.x` / schemaVersion `39`。 |
| 879 | deploy/grafana/dashboards/automatic-agent.json uid:"automatic-agent" hardcodes，多环境共导致conflicts覆盖 | `done` | Root cause: 仓库基线把共享 UID 直接提交进了 dashboard JSON；本轮已移除 `uid`，改成由各环境 provisioning/import 自己分配稳定 UID。 |
| 880 | deploy/grafana/dashboards/automatic-agent.json schemaVersion vs Grafana 版本未puts README 记录 | `done` | 同 878，Root cause:  schema 版本vs运lines时兼容矩阵缺少旁路文档；本轮已puts `deploy/grafana/README.md` 固化记录。 |
| 881 | deploy/grafana/dashboards/automatic-agent.json panel datasource.uid hardcoded prometheus | `done` | Root cause:  review 基线过期；当前 dashboard 使用的是 `${datasource}` 输入模板，而不是hardcodes `prometheus` UID，本轮也补了对应 `__inputs` / `__requires` 元数据。 |
| 882 | deploy/grafana/dashboards/automatic-agent.json p95 panel PromQL 缺 by (le)，渲染单值非分位曲线 | `done` | Root cause:  request latency 面板直接对原始 bucket 做 `histogram_quantile`，没有先按桶维度聚合；本轮已改成 `sum by (job, instance, le) (rate(...))` 后再做分位。 |
| 883 | deploy/grafana/provisioning/dashboards.yaml allowUiUpdates: true vs GitOps 流conflicts | `done` | Root cause:  provisioning 文件没有把 GitOps 所需的只读属性显式写出；本轮已声明 `allowUiUpdates: false`，避免 UI 改动漂回仓外。 |

## deploy/terraform

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 884 | deploy/terraform/environments/multi-region/ 多 region 共享同 backend key，state 互覆盖 | `done` | Root cause: 多 region backend key 约束以前只存puts口头约定；当前 `deploy/terraform/environments/multi-region/README.md` 已明确 primary/secondary 必须使用不同 backend key。 |
| 885 | deploy/terraform/main.tf no CI terraform validate/fmt -check | `done` | Root cause:  Terraform 配置此前只有静态文本测试，没有真实 `fmt/validate` 门；本轮已puts CI 新增 `terraform fmt -check -recursive`、`terraform init -backend=false`、`terraform validate`。 |
| 886 | deploy/terraform/modules/rds/main.tf security_group egress 含 port 443 方向写反（应 ingress 5432） | `done` | Root cause:  review 把 RDS SG 的已有 `ingress 5432` 漏看了；当前模块已via显式开放 PostgreSQL ingress，Issue本质是历史审阅误读 stateful SG 方向。 |
| 887 | deploy/terraform/main.tf backend "s3" {} 块为空，CI 失配即writesdefaults to local | `done` | Root cause:  partial backend 配置缺少配套说明vs CI 使用约束；本轮 README 已明确 backend 只能通过 `-backend-config` 注入，CI 也改成 `terraform init -backend=false` 做结构校验，避免被误解成 local fallback。 |
| 888 | deploy/terraform/main.tf AWS provider version 用 ~> 5.0 范围而非锁定 | `done` | Root cause:  Terraform 根模块此前缺少 provider 版本锁定治理，只停留puts宽范围约束；本轮已收敛到精确版本并puts Terraform README 明确版本治理方式。 |
| 889 | deploy/terraform/main.tf OIDC role trust policy only信任单 thumbprint | `done` | Root cause:  EKS OIDC provider 之前只取第一张证书的单个 SHA1；本轮已改成从证书链提取for deduplication thumbprint 列表并限制到前 5 个。 |
| 890 | deploy/terraform/modules/eks/main.tf node_group 缺 taints | `done` | Root cause:  root module vs EKS 子模块之间原先没有 node taint 透传契约；本轮已补变量透传和dynamically taint block，使 node group taints 可声明、可执lines。 |
| 891 | deploy/terraform/modules/eks/main.tf 控制面日志类型未启 audit/authenticator | `done` | Root cause:  review 基线过期；当前 EKS 模块已启用 `api/audit/authenticator/controllerManager/scheduler`。 |
| 892 | deploy/terraform/modules/rds/main.tf storage_encrypted defaults to false 未显式置 true | `done` | Root cause:  review 基线过期；RDS 模块当前 `storage_encrypted` defaults to就是 `true`。 |
| 893 | deploy/terraform/modules/rds/main.tf backup_retention_period 未设/为 0 | `done` | Root cause:  review 基线过期；RDS 模块当前已via按环境显式设置 `backup_retention_period`。 |
| 894 | deploy/terraform/modules/rds/main.tf deletion_protection defaults to false | `done` | Root cause:  review 基线过期；RDS 模块当前已puts `prod` 显式开启 `deletion_protection`。 |
| 895 | deploy/terraform/environments/dev.tfvars vs prod.tfvars 差异未puts README 说明 | `done` | Root cause: 环境差异只留puts tfvars 文件里，没有旁路索references；本轮已puts `deploy/terraform/README.md` 写明 dev/staging/prod/multi-region 的差异面。 |
| 896 | deploy/terraform/environments/staging.tfvars 启用 multi-AZ 但 backup_window vs maintenance_window overlaps | `done` | Root cause:  review 把 staging 当成了 prod 级 RDS 拓扑；当前模块只puts `prod` 开启 `multi_az`，staging 并don't exist该conflicts。 |

## deploy/chaos

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 897 | deploy/chaos/postgres-disconnect.yaml:14 selector app.kubernetes.io/component:postgres 但 helm chart 从不标该 label，混沌不发生 | `done` | Root cause:  chaos manifest 把外部relies on数据库错写成了 chart 内部 component label；本轮已改成 operator-managed postgres 的 `app.kubernetes.io/name=postgres` 契约，并puts README 记录目标标签约束。 |
| 898 | deploy/chaos/catalog.json:11-29 fallbackProfileId references用未定义 profile（network-delay-fallback 等） | `done` | Root cause:  catalog 只登记 scenario，没有把 fallback profile 列表一并落盘；本轮已补 `fallbackProfiles`，使 `fallbackProfileId` 全部有源可追。 |
| 899 | deploy/chaos/catalog.json profile 列表vs单实验文件目录名漂移 | `done` | Root cause:  catalog vs目录清单缺少一致性说明；本轮 README 已明确 `manifestPath` 必须vs仓内真实文件名synchronous，catalog 也已对齐当前 4 个实验文件。 |
| 900 | deploy/chaos/network-delay.yaml latency:100ms hardcodes | `done` | Root cause:  review 基线过期；当前 manifest 早已不是 `100ms`，catalog/README 现puts也synchronous声明 fallback 延迟参数。 |
| 901 | deploy/chaos/approval-policy.yaml vs helm CRD 同名资源未声明 owner | `done` | Root cause:  chaos approval policy 只有资源定义，没有 owner/managed-by 元数据；本轮已补 `automatic-agent.io/owner` vs `app.kubernetes.io/managed-by`。 |
| 902 | deploy/chaos/pod-kill.yaml 选择器同时命中 worker 和 api，no component label 隔离 | `done` | Root cause:  pod-kill 之前只按 `app.kubernetes.io/name` 选中整组 workload；本轮已收窄到 `app.kubernetes.io/component=api`。 |
| 903 | deploy/chaos/redis-disconnect.yaml 缺 duration 字段，实验defaults tono限期 | `done` | Root cause:  review 基线过期；当前 redis disconnect manifest 已显式带 `duration: "60s"`，本轮也把目标 label 契约synchronous到 README。 |

## Dockerfile & docker-compose

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 904 | Dockerfile 未 COPY ui vs package-lock.json，build 失败/缺校验 | `done` | Root cause:  Docker build stage 没把 UI/脚本相关的锁定输入带入镜像上下文；本轮已补 `ui/package.json`、`ui/package-lock.json` vs相关 tsconfig 输入。 |
| 905 | docker-compose.yml POSTGRES_PASSWORD 留空导致初iterations启动失败 | `done` | Root cause:  compose 以前允许空密码启动；当前已用 `${POSTGRES_PASSWORD:?required}` 强制 fail-close。 |
| 906 | Dockerfile:5 不复制 tsconfig.scripts.json/tsconfig.build-test.json；镜像内 npm run typecheck 失败 | `done` | Root cause:  build stage 只复制了主 tsconfig；本轮已把 `tsconfig.scripts.json` vs `tsconfig.build-test.json` 一并复制进镜像上下文。 |
| 907 | Dockerfile WORKDIR /app 由 root 创建未 chown，read_only:true 下非 root user只能写 /tmp | `done` | Root cause:  runtime stage 只给 `/app/data` 和 `/tmp` 做了 chown；本轮已统一 chown `/app`，避免非 root puts只读根文件系统下踩权限坑。 |
| 908 | docker-compose.yml:18-21 API 容器同时设 AA_PG_DSN vsdefaults to AA_STORAGE_DRIVER=sqlite，profile 自相矛盾 | `done` | Root cause: 旧 review 仍puts看早期 `AA_PG_DSN` 配置；当前 compose 只暴露可为空的 `AA_STORAGE_POSTGRES_DSN`，vsdefaults to `sqlite` 并不conflicts。 |
| 909 | .dockerignore no章节comment/header 描述意图 | `done` | Root cause:  `.dockerignore` 长期堆积成no分组黑名单；本轮已按 git/relies on构建产物/本地Status分节补comment。 |
| 910 | docker-compose.yml:13 target:runtime references用 Dockerfile stage，若 stage 未声明则 build 失败 | `done` | Root cause:  review 基线过期；Dockerfile 当前确实声明了 `AS runtime`。 |
| 911 | Dockerfile:1 基础镜像 node:22-bookworm-slim no digest pin | `done` | Root cause: 镜像 hardening 之前只做到 tag 固定，没有继续收敛到 digest 级不可变references用；本轮已补基础镜像 digest pin。 |
| 912 | Dockerfile 缺 tini/dumb-init 作 PID 1，SIGTERM 不传播 | `done` | Root cause:  runtime 容器直接以 `node` 进程做 PID 1；本轮已安装 `tini` 并改为 `ENTRYPOINT ["tini", "--"]`。 |
| 913 | Dockerfile 缺 OCI LABEL org.opencontainers.image.*，镜像追溯断链 | `done` | Root cause:  runtime stage 没有镜像元数据标签；本轮已补 `org.opencontainers.image.*`。 |
| 914 | Dockerfile runtime stage COPY --from=builder /app /app 一iterations性复制全部 layer，破坏分层缓存 | `done` | Root cause:  review 基线过期；当前 runtime stage 只按需复制 `dist/config/divisions`，并没有整目录搬运。 |
| 915 | Dockerfile 未 USER node/非 root，违反 hardening | `done` | Root cause:  review 基线过期；当前 runtime stage 已显式 `USER node`。 |
| 916 | Dockerfile 未声明 HEALTHCHECK | `done` | Root cause:  review 基线过期；当前 Dockerfile 已声明 `/healthz` healthcheck。 |
| 917 | Dockerfile npm ci 后未 npm cache clean --force，镜像携带 npm cache | `done` | Root cause:  review 基线过期；runtime stage 当前已puts `npm ci --omit=dev` 后执lines `npm cache clean --force`。 |
| 918 | docker-compose.yml prometheus 服务no healthcheck | `done` | Root cause:  compose 监控 sidecar 之前只有 `depends_on` 没有自健康探针；本轮已给 Prometheus 补 `/ -/healthy` healthcheck。 |
| 919 | docker-compose.yml defaults to tag 不带 sha，prod compose 不可复现 | `done` | Root cause:  local compose vs生产不可变发布镜像的边界没有写清；本轮已puts compose 头部说明这是本地 profile，并要求通过 `AA_IMAGE_REF` 传入 digest-qualified image。 |
| 920 | docker-compose.yml postgres/redis no restart: unless-stopped | `done` | Root cause:  review 基线过期；当前 postgres/redis 都已显式 `restart: unless-stopped`。 |
| 921 | docker-compose.yml 未声明 read_only/cap_drop ALL | `done` | Root cause:  compose hardening 之前只覆盖了部分服务；本轮已把 `cap_drop: [ALL]` 扩展到 postgres/redis/prometheus/alertmanager，并保持能只读的服务只读运lines。 |
| 922 | docker-compose.yml postgres volume 未指定 driver_opts/绑定挂载 | `done` | Root cause:  postgres 数据卷之前只有匿名 local volume，没有可见持久化路径；本轮已绑定到 `data/docker/postgres`。 |
| 923 | docker-compose.yml 未声明 networks 隔离 | `done` | Root cause:  review 基线过期；当前 compose 已显式使用 `automatic-agent-network`。 |
| 924 | docker-compose.yml depends_on: 未带 condition: service_healthy | `done` | Root cause:  review 基线过期；当前 compose relies on已via按 `service_healthy` 编排。 |
| 925 | docker-compose.override.yml vs base 同名服务字段合并语义未文档化 | `done` | Root cause:  review 假定仓内存puts override 基线文件；本轮已puts compose 头部明确说明仓库故意不携带 `docker-compose.override.yml`，避免合并语义漂移。 |
| 926 | CONTRIBUTING.md 声明 Node 20+，但 Dockerfile/CI 用 Node 22，engines.node 未puts package.json 锁定 | `done` | Root cause: 旧版 CONTRIBUTING vs当前 runtime/CI 版本脱节；当前 `CONTRIBUTING.md`、Dockerfile、CI 和 `package.json#engines` 已统一到 Node 22。 |

## deploy other

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 927 | eslint.config.js 把 deploy/**/*.mjs 加入 lint 但全树no .mjs | `done` | Root cause:  review 基线过期；当前 ESLint 配置并没有把 `deploy/**/*.mjs` 纳入 lint 范围。 |
| 928 | deploy/kubernetes/manifests/automatic-agent-smoke.yaml 缺 resources/securityContext/probes/serviceAccountName | `done` | Root cause:  smoke manifest 之前只保留了最小容器骨架；本轮已补 `serviceAccountName`、securityContext、resources、readiness/liveness probes。 |

## .github/workflows (CI)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 929 | .github/workflows/ci.yml:4 workflow_call: no inputs/secrets，调用方no法传参 | `done` | Root cause:  review 把普通仓库 CI 错当成 reusable workflow；当前 `ci.yml` 不是 `workflow_call` surface，don't exist“调用方no法传参”的契约缺口。 |
| 930 | .github/workflows/deploy-environment.yml:130-134 首iterations部署时 service don't exist，blue/green slot 选择落入defaults to green，幂等性丧失 | `done` | Root cause:  blue/green 首iterations槽位选择以前隐式落到defaults to值；本轮已把首iterations部署显式定为 `blue`，并只puts已有 selector 时做蓝绿翻转。 |
| 931 | .github/workflows/dr-validation.yml:60-66 chmod +x relies on运lines时，Windows 检出不可复现 | `done` | Root cause:  DR workflow 之前relies on运lines时 `chmod +x` 修脚本权限；本轮已改为直接 `bash deploy/scripts/dr-drill.sh`。 |
| 932 | .github/workflows/dr-validation.yml:54-60 DR 测试用单条假事件做基线，下游 RTO/RPO 检查总通过 | `done` | Root cause:  DR baseline 只播了一条占位事件，没有验证恢复后的数据形状；本轮已改为多事件/多任务/多 projection seed，并puts drill 后校验恢复计数。 |
| 933 | .github/workflows/publish-image.yml:69 docker login via shell pipe 注入 token，应改 docker/login-action@v3 | `done` | Root cause:  registry 登录以前走 shell pipe，把 token 暴露puts命令链路里；本轮已切到 `docker/login-action@v3`。 |
| 934 | .github/workflows/secret-provider-integration.yml only workflow_dispatch，no定时调度 | `done` | Root cause:  secret provider 验证只靠人工触发；本轮已补每周定时调度。 |
| 935 | .github/workflows/ci.yml:148 node -e require(.json) puts ESM 仓库内only靠 .json 兜底；process.exit(1) 任何 vulnerability 都 hard fail | `done` | Root cause:  npm audit 结果解析accesses along用了 CJS `require` 和“任意漏洞数即失败”的粗糙判定；本轮已改成 ESM 读取 JSON，并只对 high/critical 漏洞 fail。 |
| 936 | .github/workflows/ci.yml:177 trivy exit-code:1 severity:CRITICAL,HIGH 阻断 workflow 但未上传 SARIF | `done` | Root cause: 镜像扫描只有阻断，没有代码扫描系统可消费的产物；本轮已输出并上传 Trivy SARIF。 |
| 937 | .github/workflows/ci.yml:55-71 test:raw/coverage:gate 缺 AA_RUNNING_TESTS=1；upload-artifact no if-no-files-found/compression-level | `done` | Root cause:  CI test/coverage step 没显式继承测试环境变量，artifact 上传也缺少严格模式；本轮已补 `AA_RUNNING_TESTS=1`、`if-no-files-found` vs压缩级别。 |
| 938 | .github/workflows/deploy-environment.yml:159-163 blue-green slot 用 kubectl get svc jsonpath 取 selector，但defaults to selectorLabels 不含 instance=automatic-agent-{slot}，SLOT 反转 | `done` | Root cause: 蓝绿槽位推导把“no selector/首iterations部署”和“已有蓝绿 selector”混puts一起；本轮已把首iterations槽位和现有 selector 的判断逻辑拆开。 |
| 939 | .github/workflows/deploy-environment.yml:213-230 blue_green promote 不删除旧 slot release，集群积累死副本 | `done` | Root cause:  promote 阶段只切 service selector，没有清理失效 slot release；本轮已puts promote 后卸载 inactive slot。 |
| 940 | .github/workflows/deploy-environment.yml:262-318 rollback if: deploy.result=='failure'，preflight/validate 失败即使 deploy 已部分执lines也不回滚 | `done` | Root cause:  review 把 preflight 失败和 deploy 已执lines的场景混为一谈；preflight/validate 失败发生puts Helm 变更前，本轮继续把 rollback 绑定puts真正可能出现部分变更的 deploy 失败路径上。 |
| 941 | .github/workflows/publish-image.yml:104-108 GHA cache no mode=min 修剪策略，no限增长 | `done` | Root cause:  image publish workflow 之前把 Buildx cache 永远写成 `mode=max`；本轮已收敛为 `mode=min`。 |
| 942 | .github/workflows/ui-quality.yml:50-58 后台 vite preview 用 & 启动后no trap/kill，遗留孤儿进程占 4173 | `done` | Root cause:  UI 质量门以前直接后台启动 preview server 却没有生命周期回收；本轮已记录 preview PID，并puts后续清理 step 显式 kill。 |
| 943 | .github/workflows/ui-quality.yml:65 npx playwright install no版本 pin，主版漂移破坏 visual snapshot | `done` | Root cause:  workflow 以前用 `npx playwright install` 走远端解析；本轮已改为 `npm exec playwright install`，跟随锁文件中的 UI relies on版本。 |
| 944 | .github/workflows/ui-quality.yml:25-26 working-directory:ui 但 upload path 用绝对 /tmp/ui-preview.log，exceeds出 GITHUB_WORKSPACE 被忽略 | `done` | Root cause:  preview 日志以前写到 `/tmp`，artifact 上传拿不到；本轮已改写到 `ui/test-results/ui-preview.log`。 |
| 945 | .github/workflows/dr-validation.yml:73-75 puts runner workspace 创建 .dr-reports/.backups/.dr-logs 但不puts .gitignore，本地运lines污染仓库 | `done` | Root cause:  DR workflow 会创建本地目录，但 `.gitignore` 只忽略了 `.dr-reports`；本轮已补 `.backups/` 和 `.dr-logs/`。 |
| 946 | .github/workflows/ci.yml 全部 actions only按 tag references用未做 SHA pin | `done` | Root cause:  CI 之前对 `actions/*` 仍使用浮动 tag；本轮已全部切到 full SHA，并由 `audit-ci-supply-chain.mjs` 审计。 |
| 947 | .github/workflows/deploy-environment.yml SHA pin 缺失，permissions: 未puts job 级最小化 | `done` | Root cause:  workflow 供应链治理此前只收敛了 job 级 `permissions`，没有把第三方 action 一并纳入 full-SHA pin 基线；本轮已完成 SHA pin，并由 `audit-ci-supply-chain.mjs` 统一审计。 |
| 948 | .github/workflows/publish-image.yml docker/login-action tag references用 + 未启用 OIDC keyless | `done` | Root cause: 镜像发布链路之前分阶段修补，`docker/login-action` vs其余第三方 action 的 pin 策略inconsistent；本轮已统一为 full SHA pin，并保留 OIDC keyless 签名路径。 |
| 949 | .github/workflows/secret-provider-integration.yml 缺 concurrency 组 | `done` | Root cause:  review 基线过期；当前 workflow 已有 `concurrency` 组。 |
| 950 | .github/workflows/dr-validation.yml no timeout-minutes，运lines时挂死永不熔断 | `done` | Root cause:  review 基线过期；当前 DR workflow 已显式设置 `timeout-minutes: 20`。 |
| 951 | .github/workflows/ui-quality.yml 上传 artifact no retention-days | `done` | Root cause:  UI artifact 上传之前没有保留期；本轮已补 `retention-days: 14`。 |

## docs_zh/contracts

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 952 | docs_zh/contracts/{hitl_contract,hitl_experience_and_explainability_contract,decision-hitl-contract,approval_and_hitl_contract}.md 4 份overlaps HITL 契约，no规范化指针 | `done` | contracts README 之前缺少 companion/alias map；现已明确 HITL 族each的 canonical vs companion 角色。 |
| 953 | docs_zh/contracts/ 共 151 文件，README only索references 13 项 | `done` | 该条来自旧索references快照；当前 README 已按分组维护完整索references，不再只有 13 项。 |
| 954 | docs_zh/operations/release-versioning.md vs docs_zh/contracts/release_rollout_and_rollback_contract.md no相互链接 | `done` | Root cause:  release 操作文档vs rollout/rollback 契约长期each演进，没有建立互链导航；本轮已双向补链。 |
| 955 | docs_zh/contracts/error_code_registry.md vs error_code_registry_contract.md 双文件共存，only后者被 README 索references | `done` | 双文件缺少 SOT 说明；README 和 `error_code_registry.md` 现已明确 contract authority vs companion 角色。 |
| 956 | docs_zh/contracts/recovery_contract.md 不puts README 索references，旁支 idempotency_and_recovery_matrix_contract.md vs tool_metadata_and_recovery_contract.md 才被索references | `done` | recovery family 之前没有 scope map；README 和 `recovery_contract.md` 现已说明 recovery cadence/report vs recovery matrix 的边界。 |
| 957 | docs_zh/contracts/event-envelope-contract.md vs event_bus_contract.md 一新一旧并存，旧文档不指向后继 | `done` | event bus vs envelope 之前缺少 companion 说明；README 和 `event_bus_contract.md` 现已明确 envelope authority puts `event-envelope-contract.md`。 |
| 958 | docs_zh/contracts/{tenant_isolation,tenant_isolation_and_shared_worker_safety}_contract.md 命名overlapsonly长名被索references | `done` | tenant isolation 短名文档此前没有说明其只是最小对象页；README 和 `tenant_isolation_contract.md` 已补 scope note。 |
| 959 | docs_zh/contracts/{storage_schema,production_storage_and_queue,runtime_repository_and_migration,artifact_store,artifact_unified_model}_contract.md 5 份存储相关契约，不知谁是 tasks 表权威 | `done` | 存储族长期缺少 authority map；README、`storage_schema_contract.md`、`production_storage_and_queue_contract.md` 已补谁管表名/列、谁管拓扑。 |
| 960 | docs_zh/contracts/ 9 个 v4.3 freeze 用 kebab-case，其余 142 个 snake_case，no迁移策略 | `done` | Root cause:  freeze 迁移后 README 没有把 kebab-case vs snake_case 的命名边界写清，导致看上去像no策略混用；本轮已puts contracts README 明确 freeze 文件命名vs canonical 命名治理。 |
| 961 | docs_zh/contracts/ 多数文件no version: frontmatter | `done` | Root cause: 版本治理实际采用目录级 freeze/README 规则，而不是逐文件 frontmatter，但该约束未被写明；本轮已puts contracts README 补足目录级版本治理说明。 |
| 962 | docs_zh/contracts/README.md 索references未列 security_baseline/slo_alerting/smtp/ring_model/risk/federation/distributed_consensus/data_lifecycle/evidence_chain/prompt_management/video_multimodal/multi_region_replication/knowledge_lifecycle/knowledge_spi 等 14+ 实存契约 | `done` | 该条同样基于旧 README 快照；当前 contracts README 已纳入这些契约。 |
| 963 | docs_zh/contracts/runtime_state_machine.md vs state_transition_matrix.md Status枚举命名漂移 | `done` | Root cause:  review 仍按 freeze 前历史文件名比对，把旧文件族当成当前权威源；现lines canonical 已puts `*_contract.md` / `*-contract.md` 体系和 README authority map 中对齐。 |
| 964 | docs_zh/contracts/harness_run_lifecycle.md vs harness-run.md 双契约文件并存，字段定义分歧 | `done` | Root cause:  review 把历史 companion 文件当成了仍puts生效的双权威契约；当前 README 已明确 authority map，旧文件名并非现lines SOT。 |
| 965 | docs_zh/contracts/lifecycle_and_termination.md terminalReason 取值vs error_code_registry_contract.md 未交叉链接 | `done` | 生命周期 contract 之前没把终止原因vs稳定错误码挂通；现已显式链接 error code registry。 |
| 966 | docs_zh/contracts/event_bus.md/typed_event_bus.md/event-envelope.md 三occurrences envelope schema 字段不齐 | `done` | Root cause:  review 使用了 pre-freeze 的历史文件集合做横比，没有按当前 event bus / envelope contract authority map 识别 canonical 文件；本轮 README 已明确映射，现lines契约边界一致。 |
| 967 | docs_zh/contracts/error_code_registry.md vs error_code_registry_contract.md 同主题双文，#空间未声明 SOT | `done` | 同 955，错误码 family 现puts已声明 SOT。 |
| 968 | docs_zh/contracts/storage_schema.md vs runtime_repository_and_migration.md 表名/索references声明漂移 | `done` | Root cause:  review 把存储族历史 companion 文档vs当前 canonical schema 文档混看，误判为并lines权威；本轮 contracts README 已明确存储族 authority map，当前文件职责已收敛。 |
| 969 | docs_zh/contracts/decision-hitl.md vs hitl.md Status机字段命名inconsistent | `done` | README 已把 HITL family 的 canonical/complementary 关系显式化，避免再把 `hitl` 短文档当成第二套Status机 SOT。 |
| 970 | docs_zh/contracts/recovery.md vs idempotency_and_recovery_matrix.md 字段命名漂移 | `done` | recovery family 缺少 scope note 导致被误读为并列 SOT；README vs `recovery_contract.md` 已收口边界。 |
| 971 | docs_zh/contracts/api_surface.md vs sdk_surface.md 跨契约链接断 | `done` | API/SDK contract 过去没有互相指路；现已双向补链并指到 API versioning 说明。 |
| 972 | docs_zh/contracts/version-lock.md vs architecture_governance_and_versioning.md 双文未声明 SOT | `done` | README companion map 现已明确 `version-lock-contract.md` 是 canonical object，架构治理文档只负责跨架构边界。 |
| 973 | docs_zh/contracts/connector_framework.md 未声明 lifecycle phase vs harness_run_lifecycle 对齐方式 | `done` | connector lifecycle vs harness lifecycle 长期缺少边界说明；`connector_framework_contract.md` 已补 lifecycle note。 |
| 974 | docs_zh/contracts/gateway_message.md schema messageId 必填，vs production_storage_and_queue.md defaults to null 矛盾 | `done` | Root cause:  review 使用的是 freeze 前历史文件路径和字段描述，把不同职责文档当成同一 schema authority；本轮 README 已明确 canonical contract 映射，该矛盾属于历史文件名漂移误读。 |
| 975 | docs_zh/contracts/README.md 表格列含 Owner 但所有lines留空 | `done` | 该条对应的是旧版 README 结构；当前 README 已no空置 Owner 列。 |

## docs_zh/adr

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 976 | docs_zh/adr/003-memory-six-layers.md vs 003-memory-seven-layers.md 共用 ADR-003 前缀，工具排序歧义 | `done` | ADR 索references已把two历史文件区分为 `003A/003B`，并把 `seven-layers` 保留为 alias/redirect 页。 |
| 977 | docs_zh/adr/README.md:76-77 ADR-071 puts ADR-066 vs 067 之间，序号乱序 | `done` | ADR README 之前存puts手工排序错误；现已按#顺序重排。 |
| 978 | docs_zh/adr/ 缺失 ADR-074/076/077，索references也no reserved/withdrawn 标注 | `done` | README 已标明 `045/074/076/077` 为 reserved/withdrawn 号段，不再让缺号看起来像漏文件。 |
| 979 | docs_zh/adr/README.md:79,81,84 ADR-069/072/078 标 "Partially Superseded" 但no具体后继 ADR # | `done` | README 以前没有写具体后继；现已补充 `069/072/078` 的主要后继 ADR 指针。 |
| 980 | docs_zh/adr/088-...md:3-7 vs 118-...md:3-4 两套Status格式（H2 ## Status vs bullet - Status:）共存 | `done` | Root cause:  ADR 批量补写时references入了第二套Status头格式；本轮已统一回 bullet 风格Statuslines。 |
| 981 | docs_zh/adr/070-conclusion.md:3 "结论文档"被标 Superseded by ADR-109..113，应为 Withdrawn/Index | `done` | ADR-070 是总结索references页而非被新设计直接替代的技术决策；Status已改为 `Withdrawn / Index`。 |
| 982 | docs_zh/adr/README.md Status格式两套（Accepted vs 已accepts）不可机器解析 | `done` | 旧索references混用中英文Status；当前 README Status列已统一为英文枚举。 |
| 983 | docs_zh/adr/ 缺 ADR-045 占位文件（only README references用） | `done` | 之前只有 README 提到保留号段，没有占位页；现已补 `045-reserved-slot.md`。 |
| 984 | docs_zh/adr/README.md accepts日期非单调 | `done` | Root cause:  ADR README 长期defaults to按#组织，但没有显式说明，导致被误读成应按accepts日期单调排序；本轮已puts README 明确索references按 ADR #排序。 |
| 985 | docs_zh/adr/README.md Superseded by 链 ADR-### references用反向指向don't exist文件 | `done` | Root cause:  review 基于旧 README/旧 supersede 文案快照；本轮已校正 README 链接vs supersede 描述，当前反向references用不再指向don't exist文件。 |
| 986 | docs_zh/adr/ 多 ADR 缺 Status: Superseded 标识却被新 ADR 标记 supersede | `done` | Root cause:  ADR 文件正文、README 索references、supersede 关系曾via更新inconsistent；本轮已统一 ADR-070/078 vs索referencesStatus、并规范Status头写法。 |

## docs_zh/operations & runbooks

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 987 | docs_zh/operations/runbooks/runbook-plugin-failure.md plugin id 列表vs builtin-plugin-registry 漂移 | `done` | plugin failure runbook 原先缺少当前 built-in plugin ID 清单；现已回写 canonical IDs 和对应验证入口。 |
| 988 | docs_zh/operations/operations-tracker.md:3-5 自称已迁移并停止维护，仍位于 AGENTS.md/CLAUDE.md 推荐路径 | `done` | 该页已收敛为轻量索references入口而不是废弃死页；旧 review 没有吸收 2026-05-27 的索references化修复。 |
| 989 | docs_zh/operations/runbooks/{runbook-database-issues,incident-response-playbook}.md 等 4/5 文件全英文且no docs_en/ 镜像 | `done` | Root cause:  zh 运维目录曾直接承接英文 runbook 草稿，没有完成中文化收敛；本轮已把相关 runbook 翻译并按 zh 文档路径统一。 |
| 990 | docs_zh/operations/runbooks/runbook-high-error-rate.md:13 references docker compose ps，而生产用 K8s/Helm | `done` | runbook 之前accesses along用了本地 compose 语境；现已改成 K8s/Helm 优先，并把 compose 限定为本地栈。 |
| 991 | docs_zh/operations/runbooks/incident-response-playbook.md 定义 P1/P2，但 prometheus rules only severity: critical\|warning，映射缺失 | `done` | 告警 severity vs incident severity 过去没有映射表；playbook 现已补充 `page/critical/warning -> P1/P2` 口径。 |
| 992 | docs_zh/operations/runbooks/runbook-memory-pressure.md:7 threshold"RSS>512MiB"vs alert 永久触发联动，runbook 失效 | `done` | Root cause:  runbook threshold长期脱离线上 Prometheus 告警规则，accesses along用了过时的 `512MiB` 文案；本轮已对齐到现lines告警threshold。 |
| 993 | docs_zh/operations/runbooks/runbook-database-issues.md defaults to AA_DB_PATH vs helm values inconsistent | `done` | database runbook 过去假定单一路径；现已按 local/dev vs container/Helm 口径区分 `AA_DB_PATH`。 |
| 994 | docs_zh/operations/runbooks/runbook-high-error-rate.md metric error_rate_5m vs prometheus rule 实际名 aa_error_rate:rate5m inconsistent | `done` | runbook 指标名长期滞后；现已改为实际规则使用的 `aa_error_rate:rate5m`。 |
| 995 | docs_zh/operations/capacity-planning.md 容量基线vs helm values-prod.yaml resources 不匹配 | `done` | Root cause: 容量规划文档之前没有绑定 Helm 生产 requests/limits/HPA 真实基线；本轮已按当前 prod 配置重写基线。 |
| 996 | docs_zh/operations/cross-region-validation.md references用 dr-drill.sh --region 但脚本accepts -r | `done` | Root cause:  review 使用了过时脚本调用基线；当前文档已不再references用旧的 `--region` 形态，该Issue属于历史快照误判。 |
| 997 | docs_zh/operations/disaster-recovery-runbook.md RTO/RPO numeric vs ADR 中目标不synchronous | `done` | Root cause:  DR runbook vs可执lines配置/ADR 目标长期分离维护；本轮已puts runbook 中对齐当前 `config/dr/default.json` vs目标值。 |
| 998 | docs_zh/operations/hot-upgrade-validation.md references用 verify 脚本路径已迁移 | `done` | Root cause: 热升级验证文档停留puts脚本迁移前的泛化描述；本轮已更新到现lines `deploy/scripts/verify-hot-upgrade.sh` 路径。 |

## docs_zh/reference

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 999 | docs_zh/reference/api-versioning.md vs api-client.md 版本协商策略漂移（header 名大小写不一） | `done` | API 文档和 client 文档之前没有统一写出 `Accept-Version` / `x-api-version` vs SDK 握手边界；two reference 已对齐到同一口径。 |
| 1000 | docs_zh/reference/environment-configuration.md 环境变量索references未含 AA_DB_PATH/AA_LOGIN_TOKEN/AA_DLQ_PURGE_CONFIRM 等关键项 | `done` | 环境变量索references长期漏掉运lines时关键变量；现已补齐并接入对应审计。 |
| 1001 | docs_zh/reference/docs-sync.md zh→en synchronous流程图未列 docs_en/contracts/ | `done` | docs sync 规则原先没有把 contracts 目录写成显式synchronous面；现已加入 `docs_en/contracts/` 和最小检查清单。 |
## docs_en

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1002 | docs_en/ 多出 5 occurrencesno zh 对应文件，含未翻译/路径误粘 | `done` | 单复数迁移目录长期并存，别名页未清理，导致 docs_en 目录漂移和配对检查失真。 |
| 1003 | docs_zh/migrations/ vs docs_zh/migration/ 单复数双目录共存；docs_en/migrations/ 同Issue | `done` | 历史迁移重命名只新增 canonical 目录，没有synchronous删除旧别名目录。 |
| 1004 | docs_en/ 103 文件包含 docs_zh/ 链接，跨语种链路泄漏 | `done` | 英文页长期从中文模板复制演进，活动入口页没有做跨语种链接治理。 |
| 1005 | translate_docs.py:21-100 hardcodes 117 路径列表，docs_en/research/archive/module-inventory.md 等多目标已don't exist | `done` | 翻译维护脚本relies on手工路径白名单，文档迁移后没有自动发现机制。 |
| 1006 | docs_zh/migrations/e2e-workflow-state-migration.md、docs_en/migrations/e2e-workflow-state-migration.md 282 linesrepeats正文，未做 4 lines重定向 | `done` | 旧别名页被当成正式内容继续维护，未puts重命名时降级为指针或删除。 |
| 1007 | docs_zh/migrations/README.md、docs_en/migrations/README.md 别名 README vs原目录同时存puts，两条路径都可落地 | `done` | 目录级别别名策略未定义，导致 README puts canonical/alias 两occurrences同时落地。 |
| 1008 | docs_en/architecture/00-platform-architecture.md:3-10 跨链回 docs_zh/...，英文读者被推回中文页 | `done` | 英文架构入口没有维护独立 sibling 导航，直接references用了中文权威页。 |
| 1009 | docs_en/contracts/ 中文契约 14 条未对应英文版本 | `done` | 审查快照过期；当前 contracts 英文镜像已补齐，Issue来自旧清单未重新基线化。 |

## docs_zh other

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1010 | docs_zh/reviews/ 含脚本 extract-issues.mjs vsno en 对应文件 | `done` | 审查快照过期；脚本已提前迁出 reviews 面向读者的文档目录，旧Issue未从清单回收。 |
| 1011 | docs_zh/CHANGELOG.md 声称基线 0.1.0 但根 CHANGELOG only [Unreleased] | `done` | 中文 changelog 被当成第二事实源维护，没有约束其只能作为指针页。 |
| 1012 | docs_zh/buglist.md 自 2026-05-02 长期未刷新 | `done` | buglist 双入口缺少 canonical 指向，镜像页被误当成独立内容持续漂移。 |
| 1013 | docs_zh/guides/quickstart.md:11 推荐阅读 ADR-003（已 superseded by ADR-020） | `done` | 快速开始的阅读顺序没有随 ADR supersede 关系一起更新。 |
| 1014 | docs_zh/architecture/01-code-structure.md 仍含 phase 1[ab] 旧标签 | `done` | 架构示例树accesses along用了阶段制历史样例，目录改名后没有synchronous替换。 |
| 1015 | docs_zh/CHANGELOG.md vs根 CHANGELOG.md 双 changelog，no合并契约 | `done` | 顶层vs中文目录同时承载变更记录，但没有定义唯一权威来源。 |
| 1016 | docs_zh/governance/source_of_truth.md 是 AGENTS.md 应指向的"权威指针"，AGENTS.md 从不references用 | `done` | agent 上下文文档缺少对治理入口的反向链接，使用者no法获知权威页。 |
| 1017 | docs_zh/governance/naming_and_directory_conventions.md 未被 AGENTS.md/CLAUDE.md 链接，命名规则puts agent 上下文层未生效 | `done` | 命名规范exists but没有接入 agent 启动上下文，规则no法前置生效。 |
| 1018 | docs_zh/buglist.md no自动重新生成脚本，永远漂移 | `done` | 根因不是再造一份生成脚本，而是错误保留了第二入口；现改为稳定指针消除漂移面。 |
| 1019 | docs_zh/quality/buglist.md vs docs_zh/buglist.md 双 buglist no规范指针 | `done` | 双 buglist 没有 canonical 约定，读者和维护脚本都no法判断哪个为真。 |

## root governance (README, AGENTS, CONTRIBUTING, SECURITY, LICENSE, CHANGELOG)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1020 | src/sdk/harness-sdk/ only 1 文件 600+ lines，vs AGENTS.md "独立 SDK" 描述不符 | `done` | harness SDK 长期把支持逻辑堆puts单一 barrel 中，没有按 runtime/support 职责拆分。 |
| 1021 | drift-detection/evolution-integration-service.ts:280-326 decision.reason/severity 丢弃；includes("security")/("input") 子串误判分类 | `done` | 早期集成实现为了快速打通只做了子串启发式分类，也没有把 promotion gate 决策回写到 proposal 审计信息。 |
| 1022 | AGENTS/CLAUDE 未提及 src/runtime/agent-runtime/，compat surface 边界不全 | `done` | 顶层 agent 指南没有跟随 runtime 目录演化synchronous更新。 |
| 1023 | README.md:65 列 src/testing/，但 AGENTS.md 未授权该目录 | `done` | README vs agent 约束文档由不同入口维护，目录范围说明发生漂移。 |
| 1024 | pack-security-service.ts defaults to vulnerabilityApiUrl hardcodes osv.dev | `done` | 审查表述失真；当前实现已支持配置注入和安全 URL 解析，Issue来自旧代码快照。 |
| 1025 | Node 版本声明四套并存（README/package.json/CONTRIBUTING/dependency-upgrade-plan/CI matrix） | `done` | 运lines时版本信息缺少单点锚定，文档和工具链分别独立演进。 |
| 1026 | CONTRIBUTING.md 列出 npm run lint，AGENTS.md 称no formatter，口径conflicts | `done` | lint vs formatter 概念未区分清楚，导致贡献指南vs仓库说明读起来像同一约束。 |
| 1027 | reviews/README.md 看板未提及 platforme-full-review-b.md，Status不明 | `done` | review 看板没有持续纳入新增批iterations文件，索references页失去完整性。 |
| 1028 | adr/README.md 中 ADR-001/069/072 Statusvs正文 frontmatter inconsistent | `done` | 审查快照过期；ADR README vs正文Status已对齐，旧缺陷未从复核清单移除。 |
| 1029 | LICENSE:3 版权人写项目名而非法人实体，MIT 法律强度弱 | `done` | LICENSE 使用了仓库名占位文本，没有切换到 contributors 持有形式。 |
| 1030 | README.md:101 写 MIT 但no LICENSE 链接、THIRD_PARTY_NOTICES、子relies on致谢 | `done` | 根目录治理文档不完整，许可证vs第三方通知入口没有成套暴露。 |
| 1031 | README.md:30-39 推荐 npm run test:pg-integration/test:secret-providers，二者已知 broken | `done` | README 命令清单缺少活性校验，失效脚本继续停留puts主入口。 |
| 1032 | MEMORY.md no编辑契约，AGENTS.md/CLAUDE.md 都不references用 | `done` | MEMORY 被当成via验笔记维护，没有明确其非权威属性和编辑边界。 |
| 1033 | CONTRIBUTING.md:18 cd automatic_agent_platform（snake_case）vs实际目录 automatic-agent-platform-main 不符 | `done` | 审查快照过期；当前仓库实际路径已是 automatic_agent_platform，旧目录名误差来自历史工作区。 |
| 1034 | CONTRIBUTING.md:39 AA_DB_PATH=data/sqlite/phase1a-demo.db vs backup-sqlite.sh:21、helm automatic-agent.db 三occurrencesdefaults to值各不同 | `done` | 本地开发、备份脚本、部署环境使用场景不同，却没有puts文档中显式区分范围。 |
| 1035 | CONTRIBUTING.md:91-93 强制 AppError.wrap vs {domain}.{type}:{ctx} 错误码格式，AGENTS.md 未提及，代码库多种格式 | `done` | 贡献文档曾把偏好写成硬规范，但仓库并未建立统一错误码契约。 |
| 1036 | AGENTS.md/CLAUDE.md/MEMORY.md/CONTRIBUTING.md/README.md 5 份顶层指南文档no总索references，commit 规范等内容repeats | `done` | 顶层指南是逐步追加形成的，缺少总索references和单一导航入口。 |
| 1037 | translate_docs.py:1-9 自称 legacy 工具，README.md:54 仍宣传为活动工具 | `done` | README 没有标注该脚本的维护性质，工具生命周期说明缺失。 |
| 1038 | helpers/fs.ts 导出 createSymlink no realpath 校验，AGENTS.md 安全立场下为 footgun | `done` | 创建符号链接时只校验表面路径，没有puts落地前校验真实目标。 |
| 1039 | package-lock.json no npm audit signatures 证据文件，vs supply-chain-security 文档矛盾 | `done` | 供应链文档把 lockfile 当成审计证据，混淆了relies on锁定vs审计产物两类事实。 |
| 1040 | LICENSE no对应 npm package.json.license:"MIT" 字段 | `done` | 根许可证声明和 package manifest 未建立synchronous约束。 |
| 1041 | README.md "seven-layer architecture" 表述vs AGENTS.md/代码 "five-plane" 矛盾 | `done` | README 保留了历史架构叙述，没有明确其vs现lines five-plane runtime 的时间边界。 |
| 1042 | README.md references用 npm run doctor 等命令未puts CONTRIBUTING 章节交叉链接 | `done` | 命令说明分散puts多个入口页，没有做互链。 |
| 1043 | CONTRIBUTING.md defaults to AA_DB_PATH=data/sqlite/phase1a-demo.db vs compose/helm defaults to data/automatic-agent.db 漂移 | `done` | 同 1034，环境defaults to值按用途分叉，但文档没有解释 local/runtime/deploy 差异。 |
| 1044 | CHANGELOG.md 最近版本 entry 未对应 git tag | `done` | 发布记录vs Git tag 没有synchronous建立，历史版本only停留puts文档层。 |
| 1045 | 仓库根缺 SECURITY.md（GitHub 安全披露通道未声明） | `done` | 安全披露流程存puts于零散文档中，但缺少仓库根入口文件。 |
| 1046 | LICENSE 文件 SPDX 标识未puts package.json license 字段声明（或vs之inconsistent） | `done` | 许可证元数据synchronous缺失，仓库级声明vs包级声明未绑定。 |

## root configs (package.json, tsconfig, eslint, .gitignore, .editorconfig, .npmrc, .nvmrc)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1047 | package.json:170 aa:dev 直跑 node --import tsx src/sdk/cli/aa.ts，no AA_RUNNING_TESTS 守卫；CI 测试场景下可能写真实 data/ SQLite | `done` | dev CLI 入口defaults to假定人为交互运lines，没有对测试环境做 fail-close 守卫。 |
| 1048 | src/index.ts 把深内部直接拉到顶层公共出口，bypassing package.json#exports | `done` | 审查表述失真；当前深导出是受控公共面，且已有 public-entrypoint 审计脚本兜底。 |
| 1049 | package.json hardcodes --test-concurrency=1，bypassing layered runner | `done` | 审查快照过期；仓库已回到 layered runner 决定concurrent，旧hardcodes不再存puts。 |
| 1050 | package.json:223-235 缩进异常会触发 format 抖动 | `done` | 审查项偏格式噪声；当前 package 结构稳定，不构成实际配置错误。 |
| 1051 | tsconfig.build-test.json 死配置，no任何references用 | `done` | 审查快照过期；该配置当前被 coverage curated tsconfig 继承，不是孤儿文件。 |
| 1052 | tsconfig.json 多个 exclude vs npm script references用同一文件conflicts | `done` | 这是 typecheck 范围vs分层测试范围的职责拆分，被审查误判为conflicts。 |
| 1053 | eslint.config.js 启用 type-aware 规则但未声明 parser/projectService | `done` | 审查快照过期；当前 eslint flat config 已启用 projectService。 |
| 1054 | package.json lint --ext puts flat config 下被忽略，.tsx 未覆盖 | `done` | 审查快照过期；当前 lint 已简化为 `eslint .`，don't exist `--ext` 漏扫。 |
| 1055 | stryker.config.mjs 排除 helper + tsconfig 含 ui references 致沙箱失败 | `done` | 审查快照过期；当前 mutation 配置已使用专门 tsconfig 并隔离 UI references用。 |
| 1056 | eslint.config.js:33-37 测试 type-aware 规则未设 parserOptions.project 即静默 no-op | `done` | 同 1053，测试规则已通过 projectService 生效，旧Issue来自历史配置。 |
| 1057 | package.json:243 format:check no .prettierignore，lock/dist/coverage/golden 全部进 prettier 校验 | `done` | 格式检查缺少忽略清单，导致生成产物vs锁文件被误纳入校验。 |
| 1058 | package.json:264 @types/xml-crypto:^1.4.6 vs xml-crypto:^6.1.2 不同主版，类型vs运lines时不匹配 | `done` | 第三方类型包已脱离运lines时主版本节奏，却继续被直接relies on。 |
| 1059 | package.json:248-250 OpenTelemetry 五个不同 0.x/2.x/1.x 通道并存，sdk-node 0.218 vs exporter 0.214 API 漂移 | `done` | relies on升级按包零散进lines，没有保持同一 telemetry 族版本对齐。 |
| 1060 | package.json:5 private:true 同时声明 files/prepack，发布意图不明 | `done` | Root cause: “内部可打包验证”vs“禁止误发布”两个意图并存但未解释；现保留 private 并按内部打包校验语义说明。 |
| 1061 | package.json:7-9 engines.node no engineStrict/.npmrc engine-strict，Node 20/24 安装静默成功 | `done` | Node 版本约束只写puts package engines，没有同时puts npm 配置层启用强校验。 |
| 1062 | package.json:55 prepare 用 .catch(()=>undefined) 吞掉所有 husky bootstrap 错误 | `done` | Root cause: 旧版 `prepare` 脚本把 husky bootstrap 失败完全吞掉；当前脚本已收敛为只做 husky 初始化并输出告警，不再静默掩盖错误。 |
| 1063 | package.json:165-166 AA_PRESERVE_DIST=0 紧接 AA_PRESERVE_DIST=1 同lines声明，shell 后者覆盖前者 | `done` | Root cause:  review 基于旧脚本形态；当前脚本只保留了一套 `AA_PRESERVE_DIST` 语义，不再存puts同一lines双重覆盖。 |
| 1064 | tsconfig.coverage-curated.json 1769 lines手维护 1700+ 文件 exclude，no自动生成 | `done` | Root cause:  coverage curated tsconfig 之前完全靠人工维护 exclude 列表，新增/删除文件后容易漂移；本轮已补生成脚本并把产物改为自动生成。 |
| 1065 | tsconfig.build-test.json 被 tsconfig.coverage-curated.json:2 extends，vs"死配置"判定矛盾 | `done` | Root cause: “死配置”结论来自过时文件图，忽略了 `tsconfig.coverage-curated.json` 仍puts继承它；该文件当前仍是 live base config。 |
| 1066 | tsconfig.scripts.json:11 含 eslint.config.js 不含 stryker.config.mjs，occurrences理inconsistent | `done` | Root cause:  scripts tsconfig 以前靠手工列举单文件维护，配置脚本新增时容易漏synchronous；本轮已泛化为 `*.config.{js,cjs,mjs}` 覆盖。 |
| 1067 | package.json bin/exports 字段未vs dist 实际产物比对 | `done` | Root cause:  review 漏看了仓库里已有的 public-entrypoint audit vs CLI 导出校验；当前 package surface 已有自动比对门。 |
| 1068 | package.json 多个脚本前缀 npm run build，本地连续运linesrepeats tsc 浪费 | `done` | Root cause: 脚本层defaults to把“需要 dist”简单等同于“每iterations都先full build”；本轮已references入基于时间戳的 `build-if-needed` 门，避免新鲜 `dist/` repeats编译。 |
| 1069 | package.json relies on @prettier/plugin-xml 但仓库no .xml/.svg，死relies on | `done` | Root cause: relies on清理长期缺少按真实文件类型反查，遗留了未消费的 Prettier XML 插件；本轮已移除no效relies on。 |
| 1070 | package.json prepare:"npm run build" puts npm install 时强制构建 | `done` | Root cause:  review 使用了旧版 `prepare` 基线；当前 `prepare` 只负责 husky bootstrap，不再puts `npm install` 时强制构建。 |
| 1071 | package.json engines.node vs .nvmrc dual sources真相未交叉校验 | `done` | Root cause:  Node 版本声明过去确实可能each漂移；当前仓库已补 Node 版本对齐测试，形成交叉校验。 |
| 1072 | tsconfig.json lib:["ES2023","WebWorker"] 拉入 WebWorker 类型 | `done` | Root cause: 根 tsconfig 之前把不需要的 `WebWorker` ambient types 带入了服务端类型空间；本轮已移除。 |
| 1073 | tsconfig.json paths vs package.json exports dual sources runtime/编译时 resolve inconsistent | `done` | Root cause:  SDK 子路径别名vs package exports 分别独立维护，编译时vs运lines时解析面发生了漂移；本轮已把 `plugin-sdk` 等子路径统一到同一命名vs导出面。 |
| 1074 | tsconfig.scripts.json vs tsconfig.build.json allowImportingTsExtensions inconsistent | `done` | Root cause: 脚本 tsconfig vs构建 tsconfig 长期独立演化，没有共享导入扩展名策略；本轮已统一为 `false`。 |
| 1075 | tsconfig.scripts.json:11 include 列表hardcodes文件，新增 .mjs 须手工synchronous | `done` | Root cause:  scripts tsconfig 过去relies onhardcodes include 列表；本轮已用 `*.config.{js,cjs,mjs}` 统一覆盖，新增 `.mjs` 不再手工synchronous。 |
| 1076 | eslint.config.js 未配置 *.tsx/*.cjs 规则集 | `done` | Root cause:  ESLint type-aware 覆盖此前漏掉了仓库根 `tests/**/*.tsx`，同时 review 还把并non-existent `.cjs` 源文件当成现存缺口；本轮已补 `tests/**/*.tsx` 规则覆盖。 |
| 1077 | eslint.config.js 未声明 parserOptions.project，type-aware 规则全静默 no-op | `done` | Root cause:  review 基于旧配置快照；当前 flat config 已使用 `projectService: true`，type-aware 规则并非静默 no-op。 |
| 1078 | eslint.config.js ignores 未含 coverage-report/.dr-reports/dist-types | `done` | Root cause:  lint ignore 列表落后于新生成目录布局；本轮已补 `coverage-report/.dr-reports/dist-types`。 |

## src/sdk (CLI & SDK)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1079 | src/sdk/cli/pack-publish.ts defaults to registry URL 为non-existent api.platform.example.com | `done` | Root cause:  review 基于旧版 `pack-publish.ts`，当时仍保留 example.com 占位defaults to值；当前实现已对缺失 registry URL 直接 fail-close。 |
| 1080 | src/sdk/harness-sdk/index.ts 5 occurrences @ts-expect-error 抑制类型检查 | `done` | Root cause:  review 采样自旧版本基线；当前 `src/sdk/harness-sdk/index.ts` 已no这些 `@ts-expect-error` 抑制，并加了源码守卫测试防回归。 |
| 1081 | harness-sdk/index.ts:724,737-739 setTimeout no unref；empty catch 后仍触发 onTimeout no错误上下文 | `done` | Root cause: exceeds时兜底路径之前只做 best-effort 清理，没有把 timer 生命周期和 lookup 异常观测纳入正式控制流；本轮已 `unref()` 定时器并通过 `onError` 暴露 lookup failure。 |
| 1082 | src/sdk/cli/aa.ts 顶层 main() puts npm bin 软链/Windows process.argv[1] inconsistent时 import 即触发 dispatcher | `done` | Root cause:  CLI 入口判断原先relies on直接 URL 相等比较，没有复用统一的入口守卫；本轮 `aa.ts` 已切到共享 `isCliEntryPoint()`，并强化了 realpath/resolve 判定。 |
| 1083 | src/sdk/cli/dlq-manager.ts:112 --limit=abc parseInt→NaN via Math.min/Max 仍 NaN，拼到 SQL 抛 SQLite 错误而非校验拒绝 | `done` | Root cause:  `--limit` 参数原先只做数值裁剪，没有puts NaN 前置校验；本轮已显式拒绝非法 limit。 |
| 1084 | src/sdk/cli/dlq-manager.ts:32,104 retryLimit 字段定义且解析，但所有 action hardcoded LIMIT 100，flag 静默被忽略 | `done` | Root cause:  `retryLimit` 之前只停留puts解析层，没有真正贯通到执lines路径；本轮已让 `--retry-limit` 驱动批量重试上限。 |
| 1085 | src/sdk/cli/dlq-manager.ts:209 UPDATE … ORDER BY … LIMIT onlyputs SQLite SQLITE_ENABLE_UPDATE_DELETE_LIMIT 启用时合法，vs PG 不兼容 | `done` | Root cause: 实现偷用了 SQLite 方言特性，突破了存储抽象可移植性；本轮已改为先选 id 再 update，移除方言relies on。 |
| 1086 | src/sdk/cli/dlq-manager.ts:228 confirmFlag!=="yes" 大小写敏感，AA_DLQ_PURGE_CONFIRM=YES 静默拒绝 | `done` | Root cause:  purge 环境确认原先做了case-sensitive comparison；本轮已改为大小写不敏感。 |
| 1087 | src/sdk/cli/dlq-manager.ts:229,277 双层确认（--yes+env）拒绝路径文案相同，no法区分 missing-flag vs missing-env | `done` | Root cause: 双重确认虽然存puts，但拒绝路径复用了同一提示文案；本轮已拆分 `--yes` 缺失vs环境确认缺失的错误信息。 |
| 1088 | src/sdk/cli/dlq-manager.ts:286 storage.close() via {...storage,close} 浅展开后类方法身份丢失，可能不真正关闭句柄 | `done` | Root cause:  authoritative storage 工厂之前用 spread-shim 改写 `close`，破坏了对象身份和原型；本轮改为原对象上原位包装 `close`。 |
| 1089 | src/sdk/cli/dlq-manager.ts:290 入口判断未复用仓库内 isCliEntryPoint，npm bin/symlink 失效 | `done` | Root cause:  `dlq-manager` accesses along用了局部入口判断而没有复用共享 helper；本轮已切换到强化后的 `isCliEntryPoint()`。 |
| 1090 | src/sdk/cli/secret-commands.ts:53 env.AA_SECRET_AUTH_TOKEN_PATH ?? join(home,...,"secret-auth-token") 未 realpath 校验，软链可重定向 | `done` | Root cause:  token 路径此前只做字符串级路径拼接，没有禁止符号链接重定向；本轮已拒绝 symlink token path。 |
| 1091 | src/sdk/cli/secret-commands.ts:113 token 比对 sha256 直接 hex no salt，哈希文件泄漏可走彩虹表 | `done` | Root cause:  secret auth token 存储accesses along用了no盐 sha256 简化实现；本轮已切换为带盐 `scrypt` 哈希格式。 |
| 1092 | src/sdk/cli/secret-commands.ts:116 left.length===right.length && timingSafeEqual 文件被改成不同长度时泄漏长度差 | `done` | Root cause: 校验逻辑puts长度不等时先短路返回，破坏了常量时间比较；本轮已改成固定长度缓冲比较，不再暴露长度差。 |
| 1093 | src/sdk/cli/secret-commands.ts:128-129 mkdirSync({mode:0o700}) only对 leaf 生效；writeFileSync({mode:0o600}) 文件已存puts不更新 mode | `done` | Root cause: 文件权限控制以前只puts create-time 生效，覆盖writes时不会收敛已有宽权限；本轮已putswrites后显式修正目录和文件权限。 |
| 1094 | src/sdk/cli/secret-commands.ts:162 generate-token action 不调 requireAuthToken，任何 CLI user可覆盖 token 哈希实现身份升级 | `done` | Root cause:  `generate-token` 早期被当成初始化路径，没有覆盖“已有 token 时必须认证”的约束；本轮已要求对现存 token 旋转先认证。 |
| 1095 | src/sdk/cli/secret-commands.ts:168 生成 token via JSON.stringify(result,null,2) 打印 stdout，重定向日志即明文留存 | `done` | Root cause: 生成 token 结果对象此前直接输出到 stdout，把明文 token 当普通结果字段occurrences理；本轮已改为只writes `AA_SECRET_OUTPUT_PATH`。 |
| 1096 | src/sdk/cli/secret-commands.ts:219 writeFileSync(outputPath, secretValue) doesn't check目标是否软链，TOCTOU 可写任意路径 | `done` | Root cause:  secret materialization 以前使用普通写文件路径，没有加防跟随约束；本轮已通过安全文件writes路径和 `O_NOFOLLOW` 防止软链穿透。 |
| 1097 | src/sdk/cli/secret-commands.ts:232,244,256 describe/leases/summary 均未要求认证，元数据泄漏 | `done` | Root cause: “只读元数据”曾被误判为低敏感，不要求认证；本轮已把 `describe/leases/summary` 也纳入认证门。 |
| 1098 | src/sdk/cli/secret-commands.ts:305 错误响应用 error.constructor.name 作 errorCode，泄漏内部类名（如 BetterSqliteError） | `done` | Root cause: 顶层错误映射原先把内部异常类名直接外露；本轮已统一遮蔽为稳定的 `secret.command_failed`。 |
| 1099 | src/sdk/cli/migrate-sqlite-to-pg.ts 校验阶段对 SQLite 大表 SELECT * full加载入 JS 内存，OOM | `done` | Root cause: 迁移校验路径把“读取一张表”实现成整表拉入内存，没有分页/批occurrences理边界；本轮已改成 `LIMIT/OFFSET` 分批迁移vs校验。 |
| 1100 | src/sdk/cli/api-server.ts 启动后未注册 SIGTERM/SIGINT graceful 关闭 | `done` | Root cause:  API CLI 入口只负责启动服务，没有接入统一 shutdown 注册器；本轮已注册 signal handlers 并复用共享 CLI entrypoint 守卫。 |
| 1101 | src/sdk/cli/inspect.ts JSON.stringify(snapshot) 对大 snapshot no截断/流式输出，exceeds出 stdout 高水位丢字段 | `done` | Root cause:  inspect 输出以前defaults to一iterations性 `JSON.stringify` 并整块写 stdout，没有考虑exceeds大快照vs backpressure；本轮已增加截断序列化和分块输出。 |
| 1102 | src/sdk/cli/skill-creator.ts 模板渲染字符串拼接而非转义，skill name 含反references号/${...} 时被当模板代码执lines | `done` | Root cause:  review 把“把user输入writes静态文本模板”误判成“把user输入当模板执lines”；当前实现会 slugify 路径、把原文作为惰性文本writes文件，本轮还补了 hostile-name 测试锁定该语义。 |
| 1103 | src/sdk/cli/pack-publish.ts publish 重试no指数退避，连续失败放大 marketplace 限流封禁 | `done` | Root cause:  publish 重试策略此前缺少退避和瞬态错误分类，失败风暴会放大限流压力；本轮已补指数退避重试并收口瞬态失败判定。 |
| 1104 | src/sdk/cli/release-pipeline.ts rollback 路径only记录 audit log，不实触发版本回滚 RPC，命名误导 | `done` | Root cause:  review 把其他模块中的 rollback 语义投射到了 `release-pipeline` CLI；当前 CLI action 只有 `list/build/export/execute`，don't exist名为 rollback 的误导入口。 |
| 1105 | src/sdk/cli/login.ts accepts AA_LOGIN_TOKEN env 但成功后未清空 process.env，子进程继承 token | `done` | Root cause: 登录流程过去只把 env token 当输入读取，没有puts成功后做进程级清理；本轮已显式清空 legacy `AA_LOGIN_TOKEN`。 |
| 1106 | src/sdk/cli/cli-exit.ts process.exit(code) 直接调用bypassing unhandled-promise drain，CI 中尾随日志可能丢失 | `done` | Root cause:  review 基于旧实现印象；当前 `runCliMain()` 已使用 `process.exitCode` 而不是硬退出，本轮继续确认并保留该语义。 |
| 1107 | src/sdk/cli/authoritative-storage.ts 工厂返回 {...storage, close:closeOnce} 浅拷贝丢失 class 原型链，instanceof AuthoritativeStorage 永远 false | `done` | Root cause:  authoritative storage 工厂以前通过浅拷贝包 `close`，破坏了 class 原型链vs `instanceof` 语义；本轮已改成原对象原位封装。 |
| 1108 | src/sdk/index.ts & admin-sdk/index.ts & harness-sdk/index.ts 三公共入口同时 export *，新增类即视作 public API，违反 SDK 收敛 | `done` | Root cause:  SDK 根入口之前使用宽泛 barrel export，内部符号会被意外升级成公共 API；本轮已把 `src/sdk/index.ts` 收敛为显式命名导出表面。 |
| 1109 | src/sdk/cli/aa.ts (top of file main() invocation): CLI 入口未使用 isCliEntryPoint 守卫，对 npm bin 软链/Windows 路径 process.argv[1] inconsistent；any import-time side effect runs the dispatcher. EN: top-level main() runs at module import on platforms where the symlink path differs, breaking library reuse. | `done` | Root cause:  CLI 入口判断原先relies on直接 URL 比较，没有via过 realpath/resolve 归一化；本轮已复用强化后的 `isCliEntryPoint()`。 |
| 1110 | src/sdk/cli/dlq-manager.ts:112 Math.max(1, Math.min(500, parseInt(String(values.limit ?? "50"),10))) 当 --limit=abc 时 parseInt→NaN→Math.min/Max 全部 NaN，最终拼接到 SQL 抛 SQLite 错误而非友好校验。EN: NaN propagation injects literal NaN into LIMIT, causing opaque SQL error instead of structured rejection. | `done` | Root cause:  limit occurrences理以前defaults to `parseInt` 一定成功，只做边界裁剪；本轮已对非法值做结构化拒绝。 |
| 1111 | src/sdk/cli/dlq-manager.ts:32,104 retryLimit 字段puts接口定义且解析，但所有 action handler 中未使用（200 lines retryDeadLetters hardcoded LIMIT 100）。EN: --retry-limit flag is silently ignored; users believe it works. | `done` | Root cause:  flag only被解析但没有接入执lines层；本轮已让 `retryLimit` 真正控制重试批大小。 |
| 1112 | src/sdk/cli/dlq-manager.ts:209 UPDATE … ORDER BY updated_at ASC LIMIT 100 onlyputs SQLite 编译启用 SQLITE_ENABLE_UPDATE_DELETE_LIMIT 时合法；vs PG 后端不兼容，违反 storage abstraction. EN: portability bug across SQLite/Postgres adapters. | `done` | Root cause: 实现绑定了 SQLite 扩展语法，破坏了 Postgres 兼容性；本轮已替换为 select-id-then-update 的可移植流程。 |
| 1113 | src/sdk/cli/dlq-manager.ts:228 confirmFlag !== "yes" 大小写敏感；AA_DLQ_PURGE_CONFIRM=YES 静默拒绝，错误信息却暗示已设置。EN: case-sensitive env confirm rejects valid affirmative values. | `done` | Root cause: 环境确认比较此前大小写敏感；本轮已改为 case-insensitive。 |
| 1114 | src/sdk/cli/dlq-manager.ts:229,277 双层确认（--yes vs env）但拒绝路径返回相同 dry-run 文案，no法区分 missing-flag vs missing-env，运维难排查。EN: confusing duplicate dry-run message. | `done` | Root cause: 双重确认失败路径复用了同一提示文本；本轮已拆分不同失败原因的提示。 |
| 1115 | src/sdk/cli/dlq-manager.ts:286 storage.close() 调用，但 authoritative-storage 工厂返回 {...storage, close} 浅展开对象（见既有审计），class 方法身份丢失，close 可能不真正关闭句柄。EN: spread-shim breaks instance identity, close may be a no-op. | `done` | Root cause:  storage 包装器用浅拷贝替换 `close`，破坏了原实例方法身份；本轮已改为保留实例身份的原位封装。 |
| 1116 | src/sdk/cli/dlq-manager.ts:290 入口判断使用 import.meta.url === pathToFileURL(process.argv[1]).href，未复用仓库内 isCliEntryPoint helper；npm bin/symlink 场景失效。EN: same Windows symlink defect as round 4 #1. | `done` | Root cause:  `dlq-manager` 自lines实现入口判断，repeatsreferences入了 symlink/Windows 路径缺陷；本轮已统一到共享 helper。 |
| 1117 | src/sdk/cli/secret-commands.ts:53 env.AA_SECRET_AUTH_TOKEN_PATH ?? join(home, ".automatic-agent", "secret-auth-token") 未做 realpath 校验；符号链接可重定向 token 哈希读路径。EN: symlink redirection on token-hash path. | `done` | Root cause:  token-hash 路径以前没有防符号链接重定向约束；本轮已拒绝 symlink 路径。 |
| 1118 | src/sdk/cli/secret-commands.ts:113 token 比对用 sha256(token) 直接 hex，no salt；若哈希文件泄漏可走彩虹表。EN: unsalted hash vulnerable to offline dictionary attack. | `done` | Root cause:  token 存储实现使用了no盐哈希；本轮已升级为带盐 `scrypt`。 |
| 1119 | src/sdk/cli/secret-commands.ts:116 left.length === right.length && timingSafeEqual 长度提前返回非常量时；当文件被篡改成不同长度时泄漏长度差。EN: length-prefix early-exit leaks information. | `done` | Root cause: 比较逻辑puts长度检查阶段提前返回；本轮已改成固定长度常量时间比较。 |
| 1120 | src/sdk/cli/secret-commands.ts:128-129 mkdirSync(..., {mode:0o700}) only对 leaf 创建生效；既有父目录权限保留；writeFileSync(...,{mode:0o600}) 文件已存puts时不更新 mode，旧 0o644 token 文件保持宽松权限。EN: mode-on-create only, not on overwrite. | `done` | Root cause: 权限 hardening 以前只relies on创建时 mode，no法修正已存puts的宽权限文件；本轮已putswrites后显式收紧权限。 |
| 1121 | src/sdk/cli/secret-commands.ts:162 generate-token action 不调用 requireAuthToken，任何 CLI user可覆盖 token 哈希文件，实现身份升级。EN: token regeneration is unauthenticated, allowing privilege escalation. | `done` | Root cause:  token 生成路径以前没有区分“首iterations初始化”和“已有 token 轮换”；本轮已要求轮换现有 token 必须认证。 |
| 1122 | src/sdk/cli/secret-commands.ts:168 生成的 token 通过 JSON.stringify(result,null,2) 打印至 stdout；若 stdout 重定向到日志，明文 token 永久留存。EN: secret printed to stdout without redaction. | `done` | Root cause: 命令把生成结果按普通 JSON 输出，错误地把明文 token 暴露到 stdout；本轮已只写到 `AA_SECRET_OUTPUT_PATH`。 |
| 1123 | src/sdk/cli/secret-commands.ts:219 writeFileSync(outputPath, secretValue) doesn't check目标是否软链，符号链接 TOCTOU 可让 secret writes /etc/passwd 等任意路径。EN: secret-write symlink traversal. | `done` | Root cause:  secret 输出路径此前使用普通写文件 API，没有 no-follow 约束；本轮已切到安全writes路径并阻断软链穿透。 |
| 1124 | src/sdk/cli/secret-commands.ts:232,244,256 describe/leases/summary action 均未要求认证，元数据（secretRef、ttl、owner、leaseHolder）泄漏。EN: metadata-only endpoints leak sensitive operational info without auth. | `done` | Root cause: 元数据接口过去被误分类为非敏感；本轮已统一要求认证。 |
| 1125 | src/sdk/cli/secret-commands.ts:305 错误响应使用 error.constructor.name 作为 errorCode，泄漏内部类名（如 BetterSqliteError），违反错误抽象。EN: internal class name leaks via error code. | `done` | Root cause: 顶层错误编码直接透传内部异常类名；本轮已收敛为稳定的外部错误码 `secret.command_failed`。 |
| 1126 | src/sdk/cli/migrate-sqlite-to-pg.ts 校验阶段对 SQLite 大表 SELECT * full加载入 JS 内存，no分页；OOM 风险. EN: full-table read into memory during migration. | `done` | 同 1099，Root cause: 迁移校验路径缺少分页策略，本轮已改成批occurrences理。 |
| 1127 | src/sdk/cli/api-server.ts 启动后未注册 SIGTERM/SIGINT graceful 关闭，容器停机会丢请求中数据. EN: missing signal handlers. | `done` | 同 1100，Root cause:  CLI 没接入统一 shutdown 控制器，本轮已补。 |
| 1128 | src/sdk/cli/inspect.ts 输出 JSON 直接 JSON.stringify(snapshot)，对大 snapshot no截断vs流式输出，exceeds出 stdout 高水位时丢字段. EN: blocking stringify for large snapshots. | `done` | 同 1101，Root cause: 大快照输出没有 backpressure vs截断控制，本轮已补。 |
| 1129 | src/sdk/cli/skill-creator.ts 模板渲染使用字符串拼接而非转义；user提供 skill name 含反references号/${...} 时被当模板代码执lines（writes文件并由后续模块 require）. EN: template injection via skill name. | `done` | 同 1102，Root cause:  review 误把静态文本模板当dynamically执lines模板；本轮已用 hostile-name 测试把现状锁定。 |
| 1130 | src/sdk/cli/pack-publish.ts example.com 存puts缺省 registry 占位（既有审计 #3）；本轮新发现 publish 重试no指数退避，连续失败放大 marketplace 限流封禁概率. EN: missing exponential backoff in publish retry. | `done` | Root cause:  registry 占位Issue已puts前序条目收口，但 publish 重试策略仍缺退避；本轮已补指数退避vs瞬态错误重试。 |
| 1131 | src/sdk/cli/release-pipeline.ts rollback 路径only记录 audit log，不实际触发版本回滚 RPC，命名误导运维. EN: rollback action only logs, no rollback effect. | `done` | 同 1104，Root cause: 把non-existent rollback CLI action 误认成现lines入口；当前 CLI 并no该误导路径。 |
| 1132 | src/sdk/cli/login.ts accepts AA_LOGIN_TOKEN env 但未puts成功后清空 process.env，子进程继承 token. EN: token leaks via inherited environment. | `done` | 同 1105，Root cause:  env 输入清理缺失，本轮已清空。 |
| 1133 | src/sdk/cli/cli-exit.ts process.exit(code) 直接调用bypassing unhandled-promise drain，CI 中尾随日志可能丢失. EN: hard exit drops trailing log writes. | `done` | 同 1106，Root cause:  review 基线过旧；当前实现已使用 `process.exitCode`。 |
| 1134 | src/sdk/cli/authoritative-storage.ts 工厂函数返回 {...storage, close: closeOnce} 浅拷贝丢失 class 原型链，调用 instanceof AuthoritativeStorage 永远 false，下游 instanceof 守卫失效. EN: spread-shim breaks instanceof checks. | `done` | Root cause:  storage 工厂此前以浅拷贝方式覆写 `close`，直接打断了原型链和 `instanceof` 守卫；本轮已改为保持原对象/原型链的封装方式。 |
| 1135 | src/sdk/index.ts & src/sdk/admin-sdk/index.ts & src/sdk/harness-sdk/index.ts 三个公共入口同时 export *，未做 semver-stable 表面控制；新增类即视作 public API，违反 SDK 收敛策略. EN: barrel export leaks unstable surface. | `done` | 同 1108，Root cause:  SDK barrel surface 过宽；本轮已把根 SDK 入口收敛为显式命名导出。 |

## src/plugins

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1136 | src/plugins/adapters/*-adapter.ts hardcodes第三方平台 URL，未注册 outbound-url-policy | `done` | Root cause:  review 基线落puts适配器接入 `parseSafeOutboundUrl()` 之前；当前 GitHub/CRM/GameDev/AssetProduction/Livestream 适配器都已把外部端点纳入 outbound URL 校验vs egress policy。 |
| 1137 | plugins/adapters/index.ts:1-5 不导出 credential-hygiene.ts | `done` | Root cause:  adapters barrel 以前只做 `export *` 聚合，遗漏了凭据卫生 helper 的显式公共面；本轮已补 `credential-hygiene` 的显式导出。 |
| 1138 | plugins/adapters/github-adapter.ts:37、plugin-sdk/plugin-definition.ts:299 双导出 verifyPluginSignature 签名inconsistent | `done` | Root cause:  adapters/root barrel 过去把 GitHub 适配器签名 helper 也一并外泄，和 SDK 签名 API 形成同名异签名conflicts；本轮已把 barrel 改成显式导出，只保留统一公共面，去掉conflicts导出。 |
| 1139 | plugins/adapters/github-adapter.ts:278-289 适配器从不发 HTTP，返回端点+payload 描述符（伪集成） | `done` | Root cause:  GitHub adapter 之前只拼请求描述符，从未真正执lines outbound call；本轮已改为真实 `fetch` 执lines、exceeds时/响应大小控制，并返回实际响应数据。 |
| 1140 | src/plugins/builtin-plugin-registry.ts BundleRevocationSeverity 枚举vs org-governance severity 取值并存两套 | `done` | Root cause:  bundle revocation 曾混用历史 `info/warning/moderate/severe` vs现lines严重级别；本轮已收口到统一的 `critical/high/medium/low`。 |
| 1141 | src/plugins/builtin-plugin-registry.ts isRevoked()/getActiveRevocation() 未到 effectiveAt 时返已撤销，截止时间语义反向 | `done` | Root cause: 吊销激活时间过去只借 `deadline` 字段做反向判断；本轮已显式按 `effectiveAt`（回退到 legacy `deadline`）判定激活窗口。 |
| 1142 | src/plugins/builtin-plugin-registry.ts authenticate() only检查 apiKey 非空字符串即通过，nosecret强度/格式校验 | `done` | Root cause:  marketplace 认证以前把“非空字符串”当成充分条件；本轮已加最小长度vs字符集校验。 |
| 1143 | src/plugins/builtin-plugin-registry.ts sessions Set no TTL/过期清理 | `done` | Root cause:  marketplace 会话以前只存 `Set`，没有到期时间；本轮已改成带 TTL 的 `Map` 并puts读写时清理过期项。 |
| 1144 | src/plugins/builtin-plugin-registry.ts normalizeManifest() only @platform\→@automatic-agent/ 字符串替换，遗 @aa-platform/ 等历史命名 | `done` | Root cause:  manifest 名称规范化以前只覆盖一套历史前缀；本轮已把 `@aa-platform/` 一并归一化到 `@automatic-agent/`。 |
| 1145 | src/plugins/builtin-plugin-registry.ts outputDataClass 字段定义但所有 builtin manifests 均未填，死字段 | `done` | Root cause:  plugin manifest schema vs builtin manifest 构造路径之前都没有把 `outputDataClass` 当成必备元数据；本轮已把字段纳入 schema，并为 builtin manifests 统一填充。 |
| 1146 | src/plugins/builtin-plugin-registry.ts globalMarketplaceRegistry/pluginRevocations/BundleRevocationRegistry 三singleton，resetBuiltinPluginRegistryStateForTests only重置其一 | `done` | Root cause: 测试 reset hook 之前只清了 taint/lifecycle Status，没有清 marketplace/revocation singleton；本轮已把这些full reset。 |
| 1147 | src/plugins/builtin-plugin-registry.ts allowedExternalDomains:[] vs allowNetworkEgress:true 同时出现，组合语义未规范 | `done` | Root cause: 外部 adapter manifests 之前把 `allowNetworkEgress` 打开了，但 `allowedExternalDomains` 留空；本轮已为 CRM/Unity/Figma/OBS manifests 补齐显式域名白名单，并puts normalize 阶段阻断“开放 egress + 空白名单”的歧义组合。 |
| 1148 | src/plugins/adapters/crm-adapter.ts:~30 defaults to baseUrl=api.hubspot.com vs crmType no关，Salesforce 配置遗漏即指向 HubSpot | `done` | Root cause:  CRM 运lines时配置原先先定死 HubSpot base URL，再把 `crmType` 只当标签使用；本轮已按 `crmType` 分流defaults to base URL。 |
| 1149 | src/plugins/adapters/crm-adapter.ts 路径hardcodes /crm/v3/objects/，Salesforce 路径根本不可用 | `done` | Root cause:  CRM 适配器之前把 HubSpot 路径模板复用于所有平台；本轮已按 HubSpot/Salesforce 分别生成 `/crm/v3/objects/*` vs `/services/data/v*/sobjects/*` 路径。 |
| 1150 | src/plugins/adapters/crm-adapter.ts:136,143 把原始 action 而非 normalizedAction 用于 URL/handler 选择，alias 失效 | `done` | Root cause:  alias 解析后没有贯通到 dispatch 层；本轮已统一以 `normalizedAction` 选择 URL 和 handler。 |
| 1151 | src/plugins/adapters/crm-adapter.ts ACTION_ALIASES globally共享非按 crmType 分组，HubSpot alias puts Salesforce 同样生效 | `done` | Root cause:  action alias 以前是globally表，doesn't distinguish CRM 方言；本轮已收敛成按 runtime config 分组的 per-CRM alias。 |
| 1152 | src/plugins/adapters/crm-adapter.ts fetch(...) no AbortSignal/timeout、no响应大小上限 | `done` | Root cause:  CRM 请求执lines层以前直接裸调 `fetch`；本轮已加入 `AbortController` exceeds时和响应体大小上限。 |
| 1153 | src/plugins/adapters/credential-hygiene.ts bytes.toString("utf8") 把秘密入不可零化字符串，破坏 zeroize | `done` | Root cause: 凭据 helper 之前把秘密以 `reveal()` 长生命周期暴露给调用方；本轮已改成 `withSecret()` 回调式短生命周期暴露，并继续只puts内存中持有零化缓冲区。 |
| 1154 | src/plugins/adapters/credential-hygiene.ts 指纹truncated to 12 hex (~48 bit)，同租户大量凭据下生日攻击碰撞概率非可忽略 | `done` | Root cause: 凭据指纹defaults to截断长度过短；本轮已把defaults to指纹扩到 24 hex。 |
| 1155 | src/plugins/adapters/livestream-adapter.ts healthCheck() credentialFingerprint===null 时always returns unhealthy；初始化顺序no保证 | `done` | Root cause:  livestream 健康检查把“未先认证”误当成“端点不健康”；本轮已改成只校验策略vs端点可达性，不再受认证先后顺序影响。 |
| 1156 | src/plugins/index.ts 顶部 export * 把 builtin-plugin-registry 全部内部类公开 | `done` | Root cause: 插件 barrel 以前主要靠星号转发，公共面边界不清；本轮已改成显式受控导出，并用单测锁定 `PluginMarketplaceRegistry` / `BundleRevocationRegistry` 不再从根 barrel 外泄。 |
| 1157 | src/plugins/builtin-plugin-registry.ts BundleRevocationSeverity 枚举vs org-governance 中的 severity 取值并存两套（critical/high/medium/low vs Critical/Major/Minor），事件桥接需手工映射。EN: dual revocation severity taxonomies. | `done` | Root cause:  bundle revocation 继承了历史枚举残留，没有vs现lines治理严重级别单源对齐；本轮已统一 severity taxonomy。 |
| 1158 | src/plugins/builtin-plugin-registry.ts isRevoked() / getActiveRevocation() 截止时间语义反向：未到 effectiveAt 时返回 already-revoked，违反吊销契约。EN: deadline semantics inverted on activation window. | `done` | Root cause: 激活窗口判断把未来记录也当作 active revocation；本轮已改成只返回已到 `effectiveAt` 的记录。 |
| 1159 | src/plugins/builtin-plugin-registry.ts authenticate() only检查 apiKey 非空字符串即通过，nosecret强度/格式校验。EN: trivial auth allows any non-empty key. | `done` | Root cause:  marketplace 认证以前只拒空值；本轮已加格式vs长度门槛。 |
| 1160 | src/plugins/builtin-plugin-registry.ts sessions Set no TTL/过期清理；长期运lines内存增长。EN: unbounded session set leaks memory. | `done` | Root cause:  session Status以前没有过期治理；本轮已改为带 TTL 的会话表和过期清扫。 |
| 1161 | src/plugins/builtin-plugin-registry.ts normalizeManifest() only做 @platform/→@automatic-agent/ 字符串替换，未occurrences理嵌套 schema/字段；其它历史命名（如 @aa-platform/）未覆盖。EN: incomplete legacy-namespace migration. | `done` | Root cause:  manifest 规范化之前只覆盖 `@platform/`；本轮已把 `@aa-platform/` 一并归一化。 |
| 1162 | src/plugins/builtin-plugin-registry.ts outputDataClass 字段定义但所有 builtin manifests 均未填，Set/Get 路径no人使用。EN: dead manifest field. | `done` | Root cause:  manifest 层面对输出数据分类没有真正落盘；本轮已把 `outputDataClass` 变成 schema 内字段并为 builtin manifests 提供defaults to/显式值。 |
| 1163 | src/plugins/builtin-plugin-registry.ts globalMarketplaceRegistry / pluginRevocations / BundleRevocationRegistry 三个module-levelsingleton，resetBuiltinPluginRegistryStateForTests only重置其中一个，单测互相污染。EN: global singletons not all reset by test hook. | `done` | Root cause:  reset hook 过去没有覆盖全部module-levelsingleton；本轮已补齐清理。 |
| 1164 | src/plugins/builtin-plugin-registry.ts allowedExternalDomains: [] vs allowNetworkEgress: true 同时出现，组合语义“放lines所有域”还是“no放lines”未规范化。EN: ambiguous network-egress contract. | `done` | Root cause:  external adapter manifests 曾via存puts“打开网络出口但不给域名白名单”的歧义配置；本轮已补白名单并puts normalize 阶段消歧。 |
| 1165 | src/plugins/adapters/crm-adapter.ts:~30 defaults to baseUrl=api.hubspot.com vs crmType no关，Salesforce 配置遗漏 baseUrl 时仍指向 HubSpot. EN: default base URL ignores crmType discriminator. | `done` | Root cause: defaults to base URL 绑定 HubSpot；本轮已按 CRM 类型分流defaults to地址。 |
| 1166 | src/plugins/adapters/crm-adapter.ts 路径hardcodes /crm/v3/objects/，Salesforce REST 路径为 /services/data/vXX.X/sobjects/，根本不可用. EN: HubSpot-specific path applied universally. | `done` | Root cause: 路径模板复用了 HubSpot 实现；本轮已拆成平台特定路径生成。 |
| 1167 | src/plugins/adapters/crm-adapter.ts:136,143 crmRequest(action,…) 把原始 action 而非 normalizedAction 用于 URL/handler 选择，alias 失效. EN: action alias resolution dropped before dispatch. | `done` | Root cause:  alias 解析没有贯通到请求执lines；本轮已统一使用 `normalizedAction`。 |
| 1168 | src/plugins/adapters/crm-adapter.ts ACTION_ALIASES 表globally共享而非按 crmType 分组，HubSpot 的 alias puts Salesforce 上同样生效，污染语义. EN: aliases are not per-CRM. | `done` | Root cause:  alias 表以前没有按 CRM 方言隔离；本轮已改成 per-CRM 配置。 |
| 1169 | src/plugins/adapters/crm-adapter.ts fetch(...) 调用no AbortSignal/timeout、no响应大小上限；恶意/迟缓后端可悬挂 worker. EN: missing fetch timeout & response size cap. | `done` | Root cause:  CRM 请求执lines层缺少exceeds时vs响应尺寸约束；本轮已补齐。 |
| 1170 | src/plugins/adapters/credential-hygiene.ts bytes.toString("utf8") 把秘密writes不可零化的 JS 字符串，破坏后续 zeroize 承诺. EN: plaintext copied into immutable string defeats zeroize. | `done` | Root cause: 凭据 helper 以前提供了长生命周期 `reveal()`；本轮已改为回调式短生命周期暴露。 |
| 1171 | src/plugins/adapters/credential-hygiene.ts 指纹truncated to 12 个 hex 字符（~48 bit），同租户大量凭据下生日攻击碰撞概率非可忽略. EN: fingerprint truncation collision risk. | `done` | Root cause: defaults to指纹位数过短；本轮已扩到 24 hex。 |
| 1172 | src/plugins/adapters/livestream-adapter.ts healthCheck() puts credentialFingerprint===null 时永远返回 unhealthy；初始化顺序未保证 fingerprint 先就绪. EN: health check unreachable until external init. | `done` | Root cause: 健康检查把认证Statusvs端点健康耦合；本轮已解除耦合。 |
| 1173 | src/plugins/index.ts 顶部 export * 把 builtin-plugin-registry 全部内部类（如 BundleRevocationRegistry）公开，破坏封装. EN: barrel leaks internal classes. | `done` | Root cause: 根 plugins barrel 缺少受控导出边界；本轮已改成显式公共面并增加防泄漏测试。 |
| 1174 | plugin-runtime-child.ts globally覆写 console.* 污染主进程 | `done` | Root cause:  runtime child 之前puts bootstrap 时永久覆写globally `console.*`；本轮已改成onlyputs直接 stdio 请求执lines期间临时重定向并puts finally 恢复。 |

## src/scale-ecosystem

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1175 | connector-runtime/index.ts:51、connector-framework-service.ts:453,472,486 运lines时路径 process.stderr.write 直写 | `done` | Root cause:  connector runtime/framework 早期accesses along用了最简 stderr 直写，未统一到结构化错误出口；本轮已改成受控错误上报，不再直接写 `process.stderr`。 |
| 1176 | connector-framework-service.ts:265-298,335 invokeCallback(...) 多occurrences不 await/void，未occurrences理 rejection | `done` | Root cause:  callback 交付以前被当成“旁路 best-effort”，主流程没有把它纳入 async 生命周期；本轮已统一 await 交付路径。 |
| 1177 | connector-framework-service.ts:494,501 writeFileSync(path, ...) 持久化 manifest non-atomic，vs cdc-replication-service.ts:841 临时文件+rename 风格inconsistent | `done` | Root cause:  connector 持久化最初只追求简单落盘，没有复用原子writes模式；本轮已改成临时文件 + rename 的原子持久化。 |
| 1178 | cdc-replication-service.ts:804-806,817-819 empty catch 后 clearState()，错误 = full丢复制Status | `done` | Root cause:  CDC 恢复路径把“读取快照失败”误当成“应当清空Status”；本轮已改成记录告警并保留现有内存Status。 |
| 1179 | cdc-replication-service.ts:1074-1080 defaults to batchSize/interval/retries/backoff hardcodesno config 通路 | `done` | Root cause: 多区域复制协调器以前把defaults to复制参数hardcodedputs `setupRegionReplication()`；本轮已抽到可注入defaults to配置。 |
| 1180 | read-replica-service.ts:318,326,219,329 1000ms 滞后thresholdvs 100ms 轮询hardcodes，日志用拼字符串 | `done` | Root cause:  read-after-write 等待逻辑最初只做固定threshold轮询；本轮已把 lag/poll 参数配置化，并改成结构化日志。 |
| 1181 | scale-ecosystem/marketplace/*-{,async}.ts 20 个单lines export * shim 不被 marketplace barrel 暴露，only深 import 使用 | `done` | Root cause:  marketplace barrel 之前没有把 shim 面向公共 API 暴露出来；本轮已puts barrel 中补齐命名空间导出。 |
| 1182 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts (region as RegionDescriptor & {capabilities?}) 类型断言，requiredCapabilities 策略对所有 region 视为缺能力，误降级 | `done` | Root cause: 路由层遗留了对旧 `RegionDescriptor` 形状的防御性类型断言；本轮已直接使用规范化 `capabilities` 字段。 |
| 1183 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts ReadConsistencyLevel/ReadRoutingMode 二iterations as 断言bypassing校验 | `done` | Root cause:  read-replica 路由参数puts接线时repeats声明了一套别名类型，再用 `as` 强转拼回去；本轮已改成直接复用单一类型。 |
| 1184 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts preferredRegionId puts区域被排除时静默忽略，no fallback 决策事件 | `done` | Root cause: 首选区域被过滤后原实现只静默回退；本轮已把 `preferred_region_excluded` writes审计轨迹。 |
| 1185 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts failoverRegionId 兜底回退到已被排除的同名 region 形成路由环 | `done` | Root cause:  failover 兜底逻辑过去没有再iterations过滤 primary/blocked region；本轮已显式按候选集和排除集重新解析 failover。 |
| 1186 | src/scale-ecosystem/multi-region/fencing-token-service.ts module-levelsingleton缺 reset API，并lines测试令牌单调递增计数器互相污染 | `done` | Root cause: 这条 review 基于旧快照；当前 `fencing-token-service` 已提供 `resetFencingTokenService()`，并lines测试隔离接口已存puts。 |
| 1187 | src/scale-ecosystem/multi-region/split-brain-protection.ts module-level quorum Map no size 上限，多租户场景no限增长 | `done` | Root cause:  split-brain 保护服务之前只追加 quorum Status，没有容量治理；本轮已为跟踪表增加上限vs最旧心跳淘汰。 |
| 1188 | src/scale-ecosystem/multi-region/read-replica-service.ts 副本健康判定基于 lastHeartbeatAt<now-threshold，threshold defaults to未文档化、时区天真 | `done` | Root cause: 这条Issue来自旧实现；当前副本健康已基于显式健康Statusvs lag 判定，不再按 `lastHeartbeatAt` 做时区敏感threshold比较。 |
| 1189 | src/scale-ecosystem/multi-region/cdc-replication-service.ts module-level CDC offset 缓存为singleton，重连时未清 in-flight 批iterations，可重放 | `done` | Root cause:  review 记录停留puts更早的singleton缓存实现；当前 CDC Status已收口为实例级持久化队列vs checkpoint。 |
| 1190 | src/scale-ecosystem/marketplace/ globalMarketplaceRegistry singletonno reset hook，单测之间发布的 bundle 互相可见 | `done` | Root cause: 该singleton后来已从 `scale-ecosystem/marketplace` 拆出；当前目录下不再承载这个globally registry，本条属于旧实现残留。 |
| 1191 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts (region as RegionDescriptor & {capabilities?}) 类型断言；带 requiredCapabilities 的策略对所有 region 一律视为缺能力，触发误降级. EN: type cast hides missing capabilities, mis-evaluates routing. | `done` | Root cause: 路由层对旧 region 形状的类型补丁没有被清理；本轮已改成直接读取标准 `capabilities`。 |
| 1192 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts ReadConsistencyLevel/ReadRoutingMode 通过 as 二iterations断言bypassing校验，配置错误值不被拒绝. EN: enum laundering bypasses validation. | `done` | Root cause:  read replica 选项层自己重定义了一层类型再强转；本轮已收口到单一 `ReadConsistencyLevel/ReadRoutingMode`。 |
| 1193 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts preferredRegionId puts区域被排除时静默忽略，未发出 fallback 决策事件，运维盲区. EN: silent preference drop, no audit event. | `done` | Root cause: 首选区域落选时只做隐式回退；本轮已补 fallback audit trail。 |
| 1194 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts failoverRegionId 兜底逻辑会回退到已被排除的同名 region，形成路由环. EN: failover may select an already-excluded region. | `done` | Root cause:  failover 候选重算没有排除 primary/blocked region；本轮已改成按候选集显式选择。 |
| 1195 | src/scale-ecosystem/multi-region/fencing-token-service.ts module-levelsingleton，registerForTest/reset API 缺失；并lines测试令牌单调递增计数器互相污染. EN: global counter not test-isolated. | `done` | Root cause: 这条 review 基于旧版本；当前实现已提供 `resetFencingTokenService()`。 |
| 1196 | src/scale-ecosystem/multi-region/split-brain-protection.ts module-level quorum 表用 Map，没有 size 上限；多租户场景下表no限增长. EN: unbounded quorum map. | `done` | Root cause:  quorum Status曾via没有回收；本轮已加容量上限vs淘汰。 |
| 1197 | src/scale-ecosystem/multi-region/read-replica-service.ts 副本健康判定基于 lastHeartbeatAt < now - threshold 但 threshold defaults to值未puts config 文档中固化，多 region 时区差导致误判. EN: heartbeat threshold default undocumented and timezone-naive. | `done` | Root cause: 旧版本健康判定走时间戳threshold；当前实现已切到健康Status + lag，并把 lag threshold配置化。 |
| 1198 | src/scale-ecosystem/multi-region/cdc-replication-service.ts module-level CDC offset 缓存为singleton，重连时未清理 in-flight 批iterations，重启后可能重放. EN: singleton CDC cache replays on reconnect. | `done` | Root cause:  review 落puts旧singleton缓存阶段；当前实现已是实例级持久化队列。 |
| 1199 | src/scale-ecosystem/marketplace/ 内的 globalMarketplaceRegistry singletonno reset hook，单测之间发布的 bundle 互相可见. EN: marketplace registry not test-isolated. | `done` | Root cause: Issue来源于已拆出的旧 marketplace registry 实现；当前 `scale-ecosystem/marketplace` 目录不再维护该singleton。 |
| 1200 | region-health-check-service.ts fetch 未透传 AbortSignal | `done` | Root cause:  review 基于旧实现；当前 `measureNetworkLatency()` 已通过 `AbortSignal.any()` 合并调用方 signal vsexceeds时 signal。 |

## src/ops-maturity (drift, explainability, platform-ops)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1201 | locking-support.ts:12、postgres/pg-database.ts:353、redis-queue-adapter.ts:266、rule-engine.ts:399、human-takeover-service-async.ts:320、evolution-mvp-service-async.ts 等 ESM 模块内裸 require()，加载即抛 ReferenceError | `todo` | 待修复 |
| 1202 | evolution-mvp-service-async.ts 用 undefined as unknown as ApprovalService/MemoryService 构造，首iterations调用即 NPE | `todo` | 待修复 |
| 1203 | edge-runtime-sync-service.ts:120,138,203、video-processor/index.ts:319、self-healing-service.ts:327、semver-validator.ts:234、version-compatibility-matrix.ts:224、capacity-predictor/index.ts:61 数组/字段非空断言no前置守卫 | `todo` | 待修复 |
| 1204 | drift-detection/{benchmark-runner,evidence-store,promotion-gate,proposal-engine,reflection-engine,rollout-manager,rollout-repository}.ts 7 份单lines export * shim repeats | `todo` | 待修复 |
| 1205 | drift-detection/index.ts:12-28 同时 re-export sibling vs shim，barrel repeats符号导出 NodeNext conflicts | `todo` | 待修复 |
| 1206 | drift-detection/evolution-mvp-service.ts:5 服务文件顶部 export * from "./evolution-mvp-support.js" 把内部 helper 全部公开 | `todo` | 待修复 |
| 1207 | drift-detection/evolution-mvp-service.ts:97-114 EvolutionProposalRecord.id vs幂等键都用 newId()，no caller 幂等 token，双击双提案 | `todo` | 待修复 |
| 1208 | drift-detection/evolution-mvp-service.ts:130-608 4 个近相同 ~28 lines event.insertEvent(...) 块，schema 改动需 4 occurrencessynchronous | `todo` | 待修复 |
| 1209 | drift-detection/evolution-mvp-service.ts:182,431 minQualityScore:0.65、confidence:0.8 魔术threshold | `todo` | 待修复 |
| 1210 | drift-detection/evolution-mvp-service.ts:464-516 applyProposal 不校验 appliedAt 单调，乱序时间戳污染审计 | `todo` | 待修复 |
| 1211 | drift-detection/evolution-mvp-service.ts:662-665 JSON.parse(approvalRecord.requestJson) as ApprovalRequest no schema | `todo` | 待修复 |
| 1212 | drift-detection/evolution-integration-service.ts:74 defaults to new InMemoryEvidenceStore()，重启即丢失证据 | `todo` | 待修复 |
| 1213 | drift-detection/evolution-integration-service.ts:46,136 enableAutomaticProposal:true 死配置；confidence:0.7 忽略上层 proposalConfidenceThreshold | `todo` | 待修复 |
| 1214 | drift-detection/evolution-integration-service.ts:268 rootCause.slice(0,50) 截断可能切坏多字节字符 | `todo` | 待修复 |
| 1215 | drift-detection/drift-detector-service.ts:48-87 16 个魔术thresholdno contract 链接 | `todo` | 待修复 |
| 1216 | drift-detection/drift-detector-service.ts:80-87 fingerprintWindowToDriftWindow 把 30d/90d 折叠为 7d，alert 路由错位 | `todo` | 待修复 |
| 1217 | drift-detection/drift-detector-service.ts:164-273,298-323 多occurrences split(":")[index] + includes("input/output/cusum/bayesian") 启发式分类 | `todo` | 待修复 |
| 1218 | drift-detection/drift-detector-service.ts:363-407 Jaccard 相似度no长度归一/权重；safeHashEquals 双 Buffer 分配no收益 | `todo` | 待修复 |
| 1219 | platform-ops-agent/platform-ops-agent-service.ts:102 proposals = new Map no持久化/驱逐/上限 | `todo` | 待修复 |
| 1220 | platform-ops-agent/platform-ops-agent-service.ts:174-193,200-260 execute() actually receipt 占位；approval 可bypassing autonomy_limit_reached；>=0.05/0.2/200 魔术thresholdno config | `todo` | 待修复 |
| 1221 | platform-ops-agent/self-healing-service.ts:138-167 simulatesHealthCheck 用字符串长度推算 recoveryTimeMs | `todo` | 待修复 |
| 1222 | platform-ops-agent/self-healing-service.ts:174-220 冷却查询 find(...) 返回最旧记录；computeCooldownMs no上限可被拉至天级阻塞合法操作 | `todo` | 待修复 |
| 1223 | platform-ops-agent/self-healing-service.ts:75-95 executionId==null 事件被静默丢弃，冷却阻塞类事件审计断链 | `todo` | 待修复 |
| 1224 | platform-ops-agent/self-healing-service.ts:85 taskId: harnessRunId ?? executionId 把 harness id writes task_id 列，跨表 join 别名 | `todo` | 待修复 |
| 1225 | src/ops-maturity/explainability/explanation-pipeline-service.ts 解释结果缓存 string key (subjectId+timestamp) 未截断颗粒度，命中率近 0 | `todo` | 待修复 |
| 1226 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:196 lastAlertSampleIndex 实例可变Status，detect() concurrent产生 race | `todo` | 待修复 |
| 1227 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:218 detectAll defaults to windowTypes only 1h/6h/24h/7d，遗 30d/90d | `todo` | 待修复 |
| 1228 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:240 Math.floor(baselineWindowOrWindows as number) accepts负数后 Math.max(1,…) 静默修正 | `todo` | 待修复 |
| 1229 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:244-245 baseline/recent 切片可overlaps（短样本），baseline 含未来值污染统计 | `todo` | 待修复 |
| 1230 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:261-265 lastAlertSampleIndex only检测时刷新且不衰减，exceeds长运lines后抑制窗口失真 | `todo` | 待修复 |
| 1231 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:436,455,471,486 四算法均要求 recentMean<baselineMean，对 cost_spike/override_rate/incident_count 等"高于即恶化"指标no法触发 | `todo` | 待修复 |
| 1232 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:404,502 relativeShift=absoluteShift/baselineMean，baseline=0 永远 0，零基线指标no法检测漂移 | `todo` | 待修复 |
| 1233 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:469 贝叶斯后验魔术常数 0.05 nocomment/文档 | `todo` | 待修复 |
| 1234 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:631 平坦分布 (max==min) 时 bucketize 返 [1,0,0,…]，两侧不同常数值的平坦分布 JS divergence=0 漏检 step shift | `todo` | 待修复 |
| 1235 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:638 bucketize each用本组 min/max，KL/JS 比较no几何意义 | `todo` | 待修复 |
| 1236 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:280,552 severityToAction low→observe，但 ops 文档要求 low→require_review，两套响应映射并存 | `todo` | 待修复 |
| 1237 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:350-352 aggregateResults ...selected 后覆盖 reasonCode，原 window reason 被丢失 | `todo` | 待修复 |
| 1238 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:313-314 planId=drift_plan:${type}:${id}:${ISOtimestamp} 含冒号，下游以 : 分段解析器错位 | `todo` | 待修复 |
| 1239 | src/ops-maturity/drift-detection/changepoint-detector/index.ts 整文件no import；vs同目录 drift-detector-service.ts/drift-detector.ts 各有独立 DriftWindowType 等定义，类型未单源 | `todo` | 待修复 |
| 1240 | src/ops-maturity/explainability/explanation-pipeline-service.ts 解释结果缓存使用 string key（subjectId+timestamp），未截断 timestamp 颗粒度，缓存命中率近 0. EN: cache key over-specified, defeats caching. | `todo` | 待修复 |
| 1241 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:196 lastAlertSampleIndex 实例可变Status，detect() concurrent调用产生 race，suppression 决策inconsistent. EN: detector is not concurrency-safe. | `todo` | 待修复 |
| 1242 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:218 detectAll defaults to windowTypes only含 1h/6h/24h/7d，遗漏架构中规范化的 30d/90d. EN: defaults miss canonical long windows. | `todo` | 待修复 |
| 1243 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:240 Math.floor(baselineWindowOrWindows as number) accepts负数后被 Math.max(1,…) 静默修正，掩盖参数错误. EN: silent coercion of invalid baseline window. | `todo` | 待修复 |
| 1244 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:244-245 baseline vs recent 切片可overlaps（短样本时），baseline 含未来值污染统计. EN: overlapping baseline/recent slices. | `todo` | 待修复 |
| 1245 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:261-265 lastAlertSampleIndex onlyputs检测时刷新且不衰减，exceeds长运lines后抑制窗口比较失真. EN: monotonic counter never decays, breaks suppression long-term. | `todo` | 待修复 |
| 1246 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:436,455,471,486 四种算法均要求 recentMean < baselineMean，对 cost_spike/override_rate/incident_count 等“高于即恶化”的指标no法触发. EN: one-direction-only detection misses upward-degradation metrics. | `todo` | 待修复 |
| 1247 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:404,502 relativeShift = absoluteShift / baselineMean，baseline 为 0 时永远 0，零基线指标no法检测漂移. EN: zero-baseline never triggers relative threshold. | `todo` | 待修复 |
| 1248 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:469 贝叶斯后验中魔术常数 0.05 nocomment/文档；调参依据缺失. EN: undocumented magic constant in posterior. | `todo` | 待修复 |
| 1249 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:631 平坦分布 (max==min) 时 bucketize 返回 [1,0,0,…]，两侧不同常数值的平坦分布得 JS divergence=0，漏检 step shift. EN: degenerate flat-distribution handling masks shifts. | `todo` | 待修复 |
| 1250 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:638 bucketize each用本组 min/max 划桶，baseline vs recent 不同 bin 边界，KL/JS 比较no几何意义. EN: histograms not on common support invalidates divergence. | `todo` | 待修复 |
| 1251 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:280,552 severityToAction 把 low → observe，但 ops 文档要求 low → require_review，两套响应映射并存. EN: severity→action mapping inconsistent with response policy. | `todo` | 待修复 |
| 1252 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:350-352 aggregateResults 用 ...selected 后覆盖 reasonCode，原 window 的 reason 被丢失，归因可观测性下降. EN: aggregation loses originating reason code. | `todo` | 待修复 |
| 1253 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:313-314 planId = drift_plan:${type}:${id}:${ISOtimestamp} 含冒号，下游期望以 : 分段的解析器会错位. EN: planId delimiter collision with timestamp colons. | `todo` | 待修复 |
| 1254 | src/ops-maturity/drift-detection/changepoint-detector/index.ts 整文件no任何 import；vs同目录 drift-detector-service.ts/drift-detector.ts 各有独立类型 DriftWindowType 等定义，类型未单源；外部使用易写错references用. EN: duplicated types across sibling drift modules. | `todo` | 待修复 |
| 1255 | explanation-pipeline-service.ts:153 用 @ts-expect-error bypassing exactOptionalPropertyTypes | `todo` | 待修复 |
| 1256 | noisy-neighbor-protection.ts:227 类型vs运lines时数据形状inconsistent | `todo` | 待修复 |

## src/domains & runtime catalog

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1257 | plugin-runtime-host.test.ts 覆盖 process.execArgv 未复原会污染后续 | `done` | Root cause: 旧测试曾直接改写 `process.execArgv`；当前相关用例已viaputs `t.after()` 中恢复原值。 |
| 1258 | plugin-runtime-host.ts:741-742 JSON.parse(env.AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON) no schema 即 spread 入 spawn，env 控制命令构造 | `done` | Root cause:  container launcher 模板之前只做 JSON 语法校验，没有结构约束；本轮已加入数组长度vs元素类型 schema 校验。 |
| 1259 | plugin-runtime-host.ts:364 把整个 process.env 传给 spawn 后再 filter，应改为显式白名单 | `done` | Root cause: 这条 review 基于旧实现；当前 runtime host 已puts `buildPluginRuntimeEnvironment()` 中按白名单转发环境变量。 |
| 1260 | plugin-runtime-child.ts:14、plugin-runtime-host.ts:26、plugin-spi-registry.ts:21、safe-load-division-registry.ts:7、division-loader.ts:51、recipe-executor.ts:6、dashboard-websocket-server.ts:64、stores/index.ts:8、chinese-wall-access-saga.ts:39、evidence-collector.ts:62 模块顶层 new StructuredLogger(...) 创建singleton，测试/生命周期隐患 | `todo` | 待修复 |
| 1261 | domains/index.ts:7-9 re-export ../domains-runtime-*.js 跨出 domains 树（边界倒置） | `todo` | 待修复 |
| 1262 | src/domains-runtime-catalog.ts WeakMap 缓存 keying registry，resetForTests() 不清 WeakMap，旧 registry 仍持 stale 编排 | `done` | Root cause:  runtime catalog 以前只有 WeakMap 缓存，没有显式 reset 钩子；本轮已补 `resetDomainsRuntimeCatalogForTests()`。 |
| 1263 | src/domains-runtime-catalog.ts 调用 registerDomainsBootstrap() 未传 registry 参数，永远用globally registry，scoped registry 被忽略 | `done` | Root cause:  `buildDomainsRuntimeCatalog()` 早期偷用了defaults toglobally registry；本轮已显式透传调用方 registry。 |
| 1264 | src/domains-runtime-catalog.ts 顶部 import { DomainReadinessRing } only类型comment提及，运lines时未用，死 import | `done` | Root cause:  catalog 文件保留了未使用的类型导入；本轮已清理。 |
| 1265 | src/domains-runtime-orchestrator.ts defaults to构造内 ServiceRegistry.createScoped() 每实例新建作用域，跨实例共享Status丢失 | `done` | Root cause:  orchestrator defaults to构造路径之前偏向测试隔离，导致运lines时实例defaults to不共享 registry；本轮已改回 `ServiceRegistry.getInstance()`。 |
| 1266 | src/domains-runtime-orchestrator.ts this.startupPlan puts构造vs initialize 中repeats赋值，第二iterationswrites覆盖测试期 plan stub | `done` | Root cause:  startup 流程repeats回写 `startupPlan`；本轮已去掉冗余二iterations赋值。 |
| 1267 | src/domains-runtime-orchestrator.ts registry.get(SVC_ID) 返回值丢弃但调用为求副作用，relies on registry 内部 lazy init | `done` | Root cause:  orchestrator 注册后uses bare `get()` 触发初始化，意图不清；本轮已改成显式 `ensureOrchestratorRegistered()`。 |
| 1268 | src/domains-startup-plan.ts rings 强制串lines，vs设计文档中并lines ring 启动表述矛盾 | `todo` | 待修复 |
| 1269 | src/domains/registry/domain-registry-service.ts register(domainId, manifest) 同 id 二iterations注册only warn-and-replace，no idempotency token，concurrent竞态后写覆盖前写 | `done` | Root cause: 这条 review 基于旧实现；当前 `DomainRegistryService.register()` 已对repeats domainId 直接抛出验证错误。 |
| 1270 | src/domains/registry/plugin-spi-registry.ts SPI 表用 plain object 而非 Map，**proto**/constructor 注入风险 | `done` | Root cause:  SPI registry 更早版本使用对象字面量存表；当前实现已via是 `Map<string, RegisteredPluginRecord>`。 |
| 1271 | src/domains/registry/plugin-runtime-host.ts 主机进程未对 plugin unhandledRejection 隔离，单 plugin 故障污染主进程 | `todo` | 待修复 |
| 1272 | src/domains-runtime-catalog.ts WeakMap 缓存对 registry 实例 keying，但 resetForTests() not cleaned WeakMap，回收前的旧 registry 仍持有 stale 编排. EN: WeakMap cache survives test reset. | `done` | Root cause:  runtime catalog 缓存缺少 reset 钩子；本轮已补显式清理入口。 |
| 1273 | src/domains-runtime-catalog.ts 调用 registerDomainsBootstrap() 时未传 registry 参数，永远使用globally registry，scoped registry 被忽略. EN: registry-scope arg missing. | `done` | Root cause:  build 路径没有把 scoped registry 贯通到 bootstrap；本轮已修正为显式透传。 |
| 1274 | src/domains-runtime-catalog.ts 顶部 import { DomainReadinessRing } onlyputs类型comment中提及，运lines时未使用，构成死 import 增加冷启动. EN: dead import. | `done` | Root cause: 未清理的死类型导入；本轮已删除。 |
| 1275 | src/domains-runtime-orchestrator.ts defaults to构造内 ServiceRegistry.createScoped() 每实例新建作用域，跨实例共享Status丢失. EN: per-instance scope breaks shared registry. | `done` | Root cause:  orchestrator defaults to构造使用 scoped registry；本轮已改为共享globally registry。 |
| 1276 | src/domains-runtime-orchestrator.ts this.startupPlan puts构造vs initialize 中repeats赋值，第二iterationswrites覆盖测试期 plan stub. EN: redundant reassignment overwrites injected stub. | `done` | Root cause: repeats回写 startup plan；本轮已移除冗余赋值。 |
| 1277 | src/domains-runtime-orchestrator.ts registry.get(SVC_ID) 返回值被丢弃但调用为求副作用，relies on registry 内部 lazy init；让阅读者误以为是 noop. EN: side-effect-only get(); intent unclear. | `done` | Root cause: relies on lazy init 的裸 `get()` 调用语义不清；本轮已封装成显式 ensure 方法。 |
| 1278 | src/domains-startup-plan.ts rings 强制串lines执lines，vs文档中并lines ring 启动表述矛盾. EN: serial rings contradict design doc. | `todo` | 待修复 |
| 1279 | src/domains/registry/plugin-spi-registry.ts SPI 表使用 plain object 而非 Map，原型链字段 **proto**/constructor 注入风险（若 domainId comes from config文件）. EN: prototype-pollution via untrusted key. | `done` | Root cause: 旧 SPI registry 曾via使用 plain object；当前实现已via改成 `Map`。 |
| 1280 | src/domains/registry/plugin-runtime-host.ts 主机进程未对 plugin 抛出的 unhandledRejection 做隔离，单 plugin 故障污染主进程. EN: missing per-plugin rejection isolation. | `todo` | 待修复 |

## src/interaction (NL gateway)

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1281 | nl-gateway/index.ts:290 IntentParserPort vs ModelIntentParserPort inconsistent，未做适配 | `todo` | 待修复 |
| 1282 | proactive-agent/index.ts:167-168、conversation-history-service.ts:323-324,358-359、workflow-builder-service.ts:110-111,792-793、onboarding/index.ts:183-184、intent-parser/index.ts:206,291,301 多occurrencesempty catch 静默吞错并返回 null/false | `todo` | 待修复 |
| 1283 | src/interaction/nl-gateway/intent-parser/index.ts:66 关键词正则含 通lines，匹配 通lines证/通lines规则 等非审批语境 | `done` | Root cause: 审批关键词过去把“通过/通lines”类子串直接并入正则；本轮已收紧审批模式并补反例测试。 |
| 1284 | src/interaction/nl-gateway/intent-parser/index.ts:70 delete\|remove\|drop no单词边界，dropdown/removed once 触发 task_modify | `done` | Root cause: 英文删除动词正则以前没有边界；本轮已补 `\b` 限制。 |
| 1285 | src/interaction/nl-gateway/intent-parser/index.ts:126-135 语种检测顺序使含 kanji 但no kana 日文混排被识别 zh-CN，德语正则误命中 ä/ö 的瑞典语/芬兰语 | `done` | Root cause: 语言检测以前只用粗粒度字符集启发式；本轮已补日文业务词信号并收紧德语触发条件。 |
| 1286 | src/interaction/nl-gateway/intent-parser/index.ts:162 requestPatterns 英文动词no \b，deploy 命中 redeployment | `done` | Root cause: 英文请求动词过去使uses bare子串匹配；本轮已加单词边界。 |
| 1287 | src/interaction/nl-gateway/intent-parser/index.ts:196 Array.isArray(parsed)?parsed.filter(Boolean):… 返 [null, valid] 时 primary 取原 index 1 元素lines为relies on宿主 | `done` | Root cause: 模型结果归一化以前relies on `filter(Boolean)` 的宽松lines为；本轮已换成显式 `ParsedIntentToken` type guard。 |
| 1288 | src/interaction/nl-gateway/intent-parser/index.ts:282 JSON.parse(response) 对 LLM 返回 reasoning/language 字段no大小校验 | `done` | Root cause: 模型 JSON 解析路径只校验类型不校验长度；本轮已加入 reasoning/language 截断vs归一化。 |
| 1289 | src/interaction/nl-gateway/intent-parser/index.ts:44-52 INTENT_CONFIDENCE_THRESHOLDS vs IntentConfidenceThresholds 双导出，公共 API 同义双命名易漂移 | `done` | Root cause: threshold常量过去采用另一套命名风格；本轮已收口到单一 `intentConfidenceThresholds` 公共面。 |
| 1290 | src/interaction/nl-gateway/intent-parser/index.ts:66 关键词正则含 通lines，会匹配 通lines证/通lines规则 等非审批语境，造成误分类. EN: substring approval-keyword false positive. | `done` | Root cause: 审批关键词把子串命中也算作审批动作；本轮已收紧模式并加反例测试。 |
| 1291 | src/interaction/nl-gateway/intent-parser/index.ts:70 delete\|remove\|drop no单词边界，dropdown / removed once 触发 task_modify. EN: missing word boundary causes false positive. | `done` | Root cause: 删除动词正则缺少单词边界；本轮已修正。 |
| 1292 | src/interaction/nl-gateway/intent-parser/index.ts:126-135 语种检测顺序使relies on kanji 但no kana 的日文混排消息被识别为 zh-CN；德语正则误命中含 ä/ö 的瑞典语/芬兰语. EN: language-detection order and German regex over-broad. | `done` | Root cause: 语言启发式过粗；本轮已补日文信号并收紧德语识别。 |
| 1293 | src/interaction/nl-gateway/intent-parser/index.ts:162 requestPatterns 英文动词no \b，deploy 命中 redeployment，Status消息被误判为 task_create. EN: word-boundary missing on English request verbs. | `done` | Root cause:  requestPatterns 使uses bare英文子串；本轮已加边界。 |
| 1294 | src/interaction/nl-gateway/intent-parser/index.ts:196 Array.isArray(parsed) ? parsed.filter(Boolean) : … 类型不安全；返回 [null, valid] 时 primary 取到原 index 1 元素lines为relies on宿主implementation details. EN: filter(Boolean) typing escape. | `done` | Root cause: 模型输出归一化缺显式类型过滤；本轮已用 type guard。 |
| 1295 | src/interaction/nl-gateway/intent-parser/index.ts:282 JSON.parse(response) 对 LLM 返回的 reasoning/language 字段no大小校验，恶意/异常长返回会no限存储. EN: unbounded LLM response field accepted. | `done` | Root cause: 解析路径没有长度限制；本轮已补字段截断。 |
| 1296 | src/interaction/nl-gateway/intent-parser/index.ts:44-52 INTENT_CONFIDENCE_THRESHOLDS (SCREAMING_SNAKE) vs IntentConfidenceThresholds interface (camelCase) 双导出，公共 API 同义双命名易漂移. EN: parallel public-API taxonomies. | `done` | Root cause: threshold公共 API 曾via并存两套命名；本轮已收口到单一命名。 |

## src/org-governance

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1297 | src/org-governance/approval-routing/approval-routing-service.ts Status机允许 approved → withdrawn 直接转换，跳过审计 revoked 中间态 | `todo` | 待修复 |
| 1298 | src/apps/api/index.ts:10 vs src/apps/workers/index.ts:10 requiredLayers 未覆盖 interaction/org-governance，但 worker dispatch 调 approval-routing | `done` | Root cause:  worker manifest 声明层没有跟上真实relies on面；本轮已把 `interaction` vs `org-governance` 补回 requiredLayers。 |
| 1299 | src/org-governance/approval-routing/approval-routing-service.ts Status机允许 approved → withdrawn 直接转换，跳过审计 revoked 中间态，vs契约文档不符. EN: missing intermediate state in approval FSM. | `todo` | 待修复 |
| 1300 | src/apps/api/index.ts:10 vs src/apps/workers/index.ts:10 requiredLayers 列表未覆盖 interaction/org-governance，但 worker puts dispatch 中调 approval-routing，声明vs运lines时relies oninconsistent. EN: declared layers diverge from runtime imports. | `done` | Root cause:  worker app manifest 的层声明滞后于运lines时导入；本轮已补齐。 |
| 1301 | org-governance/index.ts:1-9 barrel 缺 org-routing/ | `done` | Root cause:  org-governance 顶层 barrel 漏掉 `org-routing` 公共面；本轮已补导出。 |

## src/core & runtime

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1302 | src/core/runtime/index.ts:18 占位常量 WorkflowStepCheckpoint vs同文件 re-export 的同名 interface conflicts，且存puts ambiguous export * | `todo` | 待修复 |
| 1303 | src/runtime/agent-runtime/index.ts 兼容 shim 死代码（未暴露、零references用） | `todo` | 待修复 |
| 1304 | src/core/runtime/index.ts WorkflowStepCheckpoint puts export * 中已暴露 class，又追加 export type WorkflowStepCheckpoint=string，name collision | `todo` | 待修复 |
| 1305 | src/runtime/agent-runtime/index.ts:9-15 export * 自 7 platform 文件，叠加 L18-32 具名 type re-export，LlmModelCallRequest/ContextCompactionOptions 同名repeats声明歧义 | `todo` | 待修复 |
| 1306 | src/core/runtime/index.ts 同时含本地 type alias vs re-export 同名，round-tripping 后 typecheck 漂移 | `todo` | 待修复 |
| 1307 | src/core/runtime/index.ts WorkflowStepCheckpoint puts export * re-export 中已暴露为 class，又puts本文件追加 export type WorkflowStepCheckpoint = string，造成同名 class/type conflicts. EN: name collision via re-export. | `todo` | 待修复 |
| 1308 | src/runtime/agent-runtime/index.ts:9-15 export * 自 7 个 platform 文件，叠加 L18-32 的具名 type re-export，存puts歧义 re-export（LlmModelCallRequest/ContextCompactionOptions 同名repeats声明）. EN: ambiguous re-export from barrel. | `todo` | 待修复 |
| 1309 | src/core/runtime/index.ts 文件即纯 barrel，但同时声明本地 type alias vs re-export 同名导致 round-tripping 后 typecheck 漂移（既有审计 #1 的延伸：本轮还观察到 WorkflowStepCheckpoint 的 type/class 双重身份）. EN: barrel layering produces conflicting symbol kinds. | `todo` | 待修复 |

## src/apps & entry

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1310 | src/index.ts module-level new StructuredLogger({retentionLimit:100}) 每iterations import 构造，retention 缓冲随测试 suite 数线性增长 | `todo` | 待修复 |
| 1311 | src/index.ts redactStartupErrorMessage() only匹配少量正则，遗漏 Authorization: Basic …/Bearer …/"token":"…"/JWT 三段式 | `todo` | 待修复 |
| 1312 | src/index.ts 入口判断 import.meta.url===pathToFileURL(resolve(scriptPath)).href 对 npm bin 软链失效，vs仓库其他 isCliEntryPoint inconsistent | `todo` | 待修复 |
| 1313 | src/index.ts 步骤名hardcodes "x1-fabric" 字符串比较，编排步骤改名时no类型保护 | `todo` | 待修复 |
| 1314 | src/index.ts 失败路径 process.exitCode=1 但未 unref 已开资源，进程卡住等 event loop 排空 | `todo` | 待修复 |
| 1315 | src/apps/index.ts:16 Object.freeze(PLATFORM_APPS) only冻结外层，每 manifest requiredLayers 数组可变 | `todo` | 待修复 |
| 1316 | src/apps/index.ts:35 resolvePlatformAppManifest("summary"\|"demo") always returns null（这两值是 startupTargetKind 而非 appKind/appId），易混淆 | `todo` | 待修复 |
| 1317 | src/apps/api/index.ts:6 & src/apps/workers/index.ts:6 entryModule 为字符串路径，文件移动后no编译期 link，manifest 静默失效 | `todo` | 待修复 |
| 1318 | src/index.ts module-level new StructuredLogger({retentionLimit:100}) puts每iterations import 时构造，retention 缓冲随测试 suite 数线性增长. EN: per-import logger leaks retention buffer. | `todo` | 待修复 |
| 1319 | src/index.ts redactStartupErrorMessage() only匹配少量正则，遗漏 Authorization: Basic …、Bearer …、"token":"…" JSON 片段、JWT 三段式. EN: redaction misses common secret formats. | `todo` | 待修复 |
| 1320 | src/index.ts 入口判断 import.meta.url === pathToFileURL(resolve(scriptPath)).href 对 npm bin 软链失效；vs仓库其它occurrences用 isCliEntryPoint inconsistent. EN: inconsistent CLI-entry detection. | `todo` | 待修复 |
| 1321 | src/index.ts 步骤名hardcodes "x1-fabric" 字符串比较；编排步骤改名时no类型保护. EN: magic string couples bootstrap to legacy step id. | `todo` | 待修复 |
| 1322 | src/index.ts 失败路径 process.exitCode = 1 但未 unref 已打开的资源（DB/timer），导致进程卡住等 event loop 排空. EN: exit-code without graceful shutdown can hang process. | `todo` | 待修复 |
| 1323 | src/apps/index.ts:16 Object.freeze(PLATFORM_APPS) only冻结外层数组，每个 manifest 的 requiredLayers 数组可变，外部代码修改后污染所有调用者. EN: shallow freeze leaks mutability. | `todo` | 待修复 |
| 1324 | src/apps/index.ts:35 resolvePlatformAppManifest("summary"\|"demo") 永远返回 null（这两个值是 startupTargetKind 而非 appKind/appId），调用方易混淆. EN: target-kind vs app-kind confusion silently returns null. | `todo` | 待修复 |

## src other

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1325 | 多个 ADR references用已迁移的 src/core/{memory,knowledge,agent-loop,storage}/ | `todo` | 待修复 |

## Uncategorized

| # | Issue | Status | Root Cause |
|---|-------|--------|-----------|
| 1326 | pack-test-local-service.ts:207-214,228-233 runIntegrationTests/runSimulationTests 任意减扣 casesPassed/coveragePercent，伪造测试结果 | `todo` | 待修复 |
| 1327 | 控制面jumps into编排面拉 getWorkflowDefinition | `todo` | 待修复 |
| 1328 | 16 个 1000+ LOC 候选文件需要拆分 | `todo` | 待修复 |
| 1329 | JSDoc/@see 同时存puts 5 套互斥仓库 URL | `todo` | 待修复 |
| 1330 | skill-execution-{cache,core,support,service}-methods.ts 4 份切片循环relies on | `todo` | 待修复 |
| 1331 | 多份文档含 /Users/holden/Project/... 私人绝对路径 | `todo` | 待修复 |
| 1332 | docs_en review 文件 373 occurrences把 five-plane-* 机翻为 5-plane-* | `todo` | 待修复 |
| 1333 | docs_en review 反references号被 HTML 实体 ' 替换，markdown 失效 | `todo` | 待修复 |
| 1334 | platforme-full-review.md references errors.js（actually .ts），并使用非可解析 brace 路径 | `todo` | 待修复 |
| 1335 | quickstart.md:108 列出non-existent npm run docs:lint | `done` | quickstart 曾references用已删除的历史脚本名，文档未随验证入口迁移。 |
| 1336 | 3 份 review 文件（9–34 lines）only声称"已完成"no证据，却被标为权威 | `done` | review 文档缺少统一的结论、根因vs证据回写规则。 |
| 1337 | temp-cache-cleanup.md、full-cleanup-review.md 为过期一iterations性报告，含个人路径 | `done` | 一iterations性清理报告长期留puts活跃目录，缺少归档vs索references边界。 |
| 1338 | operations-tracker.md "Last updated 2026-04-14" 已陈旧 | `done` | EN operations-tracker 未synchronous 2026-05-27 之后的索references收敛。 |
| 1339 | current_todo_list.md vs project_progress_tracker.md 进度口径conflicts | `done` | todo 索referencesvs progress tracker 曾each维护Status口径，缺少单一权威入口。 |
| 1340 | release-versioning.md vs operations-checklist.md 互不references用 Pre-Launch Top 20 | `done` | release 版本文档vs发布检查清单分离维护，缺少互链。 |
| 1341 | issues-table.md:780 声称"新增"文档no对账记录 | `done` | issues-table 历史整改已回写证据，但 review-d 没synchronous复核结果。 |
| 1342 | operations/npm-scripts.md、test_coverage_baseline_gate.md 中文区出现英文 | `done` | 中文运维文档的本地化回写滞后。 |
| 1343 | release_rollout_and_rollback_contract.md 仍references用 superseded 的 ADR-018 | `done` | EN release/rollback contract 仍把 ADR-018 写成执lines依据。 |
| 1344 | architecture/00-platform-architecture.md only 21 lines stub 却被声称为权威入口 | `done` | 架构入口曾是 stub，没有作为索references页持续维护。 |
| 1345 | 03-module-diagrams.md 含 60+ occurrences指向don't exist章节的内部锚点 | `done` | 旧版模块图Issue来自历史结构；现lines文档已改成no失效锚点的目录式结构。 |
| 1346 | migration/01-migration-scope.md 写 113 contracts/38 ADR，实际 151/120 | `done` | EN migration scope accesses along用旧数量快照，未随 contracts vs ADR 增长synchronous。 |
| 1347 | feature-flags/web only静态 <h2>，未消费 vm，vs admin+ 权限不符 | `done` | feature flags 页面曾停留puts静态占位，缺少 VM 接线。 |
| 1348 | feature-flags/hooks 用 {} as never 双重断言且no消费者 | `done` | hook 曾用双重断言兜底且未被实际页面消费。 |
| 1349 | 10+ 个 feature hooks/index.ts 返回hardcodes静态 items，但声称 Implemented | `done` | 静态 hooks vs implemented Status曾一起漂移；现已把此类占位 feature 统一回收到 `Planned`，only保留真实接线模块为 implemented。 |
| 1350 | 12+ feature web/index.tsx 的 actions no onTrigger，only写假日志 | `done` | 多个 feature Web 入口曾停留puts占位动作；现已统一接入 workbench action handler，不再用假日志冒充交互。 |
| 1351 | workflow-builder/web DAG 节点vs边为hardcoded的演示图 | `todo` | 待修复 |
| 1352 | task-cockpit/hooks evidenceChain 由前端凭计数虚构生成 | `done` | task cockpit 早期用 evidenceCount 拼伪证据项；现已改为only展示真实 evidence refs，缺数据时不再虚构链路。 |
| 1353 | workflow-debugger/mobile 直接展示 "Awaiting backend debugger seam" | `done` | workflow debugger 移动端曾把后端 seam 占位文案直接暴露给user；现已改为中文说明和已接线Status文案。 |
| 1354 | UI 多occurrences用 as never/as unknown as 强转屏蔽类型校验 | `todo` | 待修复 |
| 1355 | UI 错误occurrences理only console.error，no遥测/上报 | `done` | Web UI 曾以控制台日志兜底错误；现已统一走 `reportUiError()` vs UI telemetry sink。 |
| 1356 | void registerWebServiceWorker() 等 fire-and-forget without .catch | `done` | service worker 注册是 fire-and-forget，缺少失败捕获。 |
| 1357 | FeatureErrorBoundary 未实现 componentDidCatch | `done` | feature error boundary 只有 fallback，没有错误生命周期上报。 |
| 1358 | UI 10+ 文件hardcodes颜色（#12201a/#334155 等），不references用 designTokens | `todo` | 待修复 |
| 1359 | tokens.css 264 lines CSS 从未被任何模块 import | `done` | design token CSS 定义后未被 Web 入口显式加载。 |
| 1360 | LazyFeatureDashboard 未做 lazy() 但测试断言"is Lazy" | `done` | 旧的 LazyFeatureDashboard 测试/实现残影没有随重构清理；现lines Web shell 不再保留该伪 lazy 组件vs断言。 |
| 1361 | 4 个 feature 走相对路径而非 @aa/feature-* 别名 | `done` | feature registry 早期存puts直连相对路径；现已统一通过 `@aa/feature-*` 包别名装配。 |
| 1362 | missionControlFeatureContracts puts shell 内未被使用 | `done` | 历史 contract 残留导出未跟随 shell vs registry 清理。 |
| 1363 | feature 模块 status/kind 字段使用风格inconsistent | `done` | feature manifest 曾分别手填 status/kind；现已由 `createFeatureModule()` 统一从 status 推导 kind 并收口。 |
| 1364 | UI 大量英文文案hardcodes，未走 translateMessage | `todo` | 待修复 |
| 1365 | task-cockpit/web <input> 缺 aria-label/<label>/name | `done` | task cockpit 输入控件缺少可访问名称。 |
| 1366 | AccessDenied reason 可为 null，渲染空 <p> | `done` | AccessDenied 允许 null 原因直接渲染，缺少defaults to文案。 |
| 1367 | test:ui-p1-features references用 5 个测试，同目录另 4 个未覆盖 | `done` | UI P1 脚本曾遗漏新增测试入口；现已补齐到 9 个现存特性测试文件。 |
| 1368 | cache-metrics-collector.test.ts 0 字节空文件 | `done` | cache metrics 测试曾是空壳；现已补为 snapshot/reset lines为断言。 |
| 1369 | domains/onboarding/index.test.ts only re-export no用例 | `done` | onboarding barrel 测试曾只有空转发；现已补真实导出断言。 |
| 1370 | 多个测试调用函数no assert 断言 | `todo` | 待修复 |
| 1371 | artifact:integrity references用文件及目录均don't exist | `done` | 历史脚本点名了已迁移的测试路径；现已改到现存 artifact 相关用例入口。 |
| 1372 | 测试中遗留大量 console.log/warn，含调试残留 | `todo` | 待修复 |
| 1373 | 多occurrences测试硬等 50–1600ms 时序，存puts抖动 | `todo` | 待修复 |
| 1374 | 测试hardcodes localhost/端口；含特权端口 80 vs明文密码 DSN | `todo` | 待修复 |
| 1375 | 48+ 用例名repeats ≥5 iterations（17 occurrences同名等），疑似重构未删旧目录 | `todo` | 待修复 |
| 1376 | test-pack 下两个测试only assert.ok(true) 占位 | `done` | test-pack 夹具树曾混入占位测试；现lines `tests/fixtures/packs/test-pack/tests/` 已删除，不再保留 no-op 用例。 |
| 1377 | serialTest 自实现 skip 通道，no ticket 校验且 API 形状不兼容 | `done` | 旧 serialTest 兼容了非 `node:test` 形状；现已收紧为函数或 `skip: true + fn`。 |
| 1378 | getCompatibilitySkipBudget 跳过budgetno issue/contract references用 | `done` | 兼容跳过budget曾作为临时治理残留；现lines仓库已移除该 helper vs对应跳过通道。 |
| 1379 | http-api-server.test.ts:1712 预期固定端口 43123 | `done` | API server 测试曾把端口hardcoded；现已改为dynamically端口路径，不再锁死 43123。 |
| 1380 | test:e2e:stage-exit references用 unit 文件，命名/目录契约不符 | `done` | stage-exit 脚本曾点错测试层级；现已切到 `tests/e2e/checkpoint-artifact-flow.test.ts`。 |
| 1381 | helpers/fs.ts 被 lint 但不被 typecheck | `done` | 仓库根 helper 曾脱离测试辅助链；现已收口到 `tests/helpers/fs.ts` 并纳入正常类型检查路径。 |
| 1382 | AA_PG_DSN vs AA_STORAGE_POSTGRES_DSN 文档/部署/代码三occurrencesinconsistent | `done` | 测试、运lines时vs历史别名三套 DSN 命名并存，缺少主iterations口径。 |
| 1383 | phase1a-data 卷vs phase1a-demo.db vs 0.1.0 去 phase1a 化矛盾 | `done` | phase1a 迁移后，文档仍残留旧测试名和 SQLite defaults to文件名。 |
| 1384 | .env.example 缺 AA_OPENAI_API_KEY/AA_MINIMAX_API_KEY 等代码实读变量 | `done` | 环境模板没有跟随 provider key 读取面扩充synchronous。 |
| 1385 | k8s manifest vs Helm chart 的 image owner/repository/name inconsistent | `done` | Kubernetes smoke manifest、Helm chart vs镜像命名曾各写一套；现已统一到 `ghcr.io/automatic-agent/automatic-agent-platform` vs同名 chart/package。 |
| 1386 | [Unreleased] 累积 12 天 post-0.1.0 改动，版本未递进 | `done` | 发版后 changelog vs Helm 版本没有synchronous前推。 |
| 1387 | .audit/(1.4M)、.test-db/(2.5M) 已忽略却存puts于工作树 | `done` | 忽略的生成产物缺少清理动作和防回写规则。 |
| 1388 | .gitignore 多occurrences冗余/不规范模式（dist_test no尾斜杠等） | `done` | .gitignore 长期叠加，缺少定期整理。 |
| 1389 | .gitignore 主动忽略 5 个 legacy 兼容符号链接，使其不可审计 | `done` | 早期为兼容或本地目录添加的忽略规则没有持续清账；现lines .gitignore 已不再保留。 |
| 1390 | translate_docs.py references入未声明的 translators PyPI relies on | `done` | Python 翻译脚本relies on没有synchronous登记到 requirements。 |
| 1391 | translate_docs.py 代码块解析repeats追加换lines致输出膨胀 | `done` | 翻译脚本puts重组片段时没有严格保持原始换lines边界。 |
| 1392 | translate_docs.py 单进程裸调翻译 API，no重试/限流 | `done` | 翻译脚本缺少节流vs显式重试策略。 |
| 1393 | CI AA_TEST_PG_DSN vs生产 AA_PG_DSN/AA_STORAGE_POSTGRES_DSN 三套并存 | `done` | CI 曾同时桥接三套 PG DSN 名称，测试和生产口径未收敛。 |
| 1394 | CI trivy-scan 重新 build，no法保证vs publish 同一产物 | `done` | Trivy job 先前自建镜像，和 validate 产物脱节；现已改为扫描 validate 导出的同一 Docker tar artifact。 |
| 1395 | ci.yml workflow_call + push + pull_request 三重触发 | `done` | CI 触发条件accesses along用旧 workflow_call 设计，review-d 未回写实际 workflow。 |
| 1396 | ci.yml 任务链缺 build 步骤，下游relies on dist/ 产物 | `done` | CI validate job 早期缺少 build 步骤。 |
| 1397 | CI upload-artifact 未设 retention-days vs SHA 校验 | `done` | artifact 上传缺少 retention vs摘要文件。 |
| 1398 | CI aquasecurity/trivy-action@0.32.0 是浮动 tag，应锁 SHA | `done` | Trivy action 使用浮动 tag，供应链不可审计。 |
| 1399 | deploy-environment.yml:191 Helm --set 含 : 被解析为 map | `done` | Helm --set 对冒号值未强制字符串语义。 |
| 1400 | Promote 步骤跳过二iterations健康闸门，vs contract 双闸inconsistent | `done` | 推广后缺少二iterations健康闸门。 |
| 1401 | 所有 workflow 缺 concurrency: vs最小 permissions: | `done` | 多个 workflow 早期没有最小 permissions vs concurrency。 |
| 1402 | 仓库根缺 .github/CODEOWNERS | `done` | 仓库治理 owner 边界未落成文件。 |
| 1403 | .claude/scheduled_tasks.json 含 git conflicts标记且 .claude/ 已忽略却被提交 | `done` | 计划任务文件被忽略但仍被跟踪，且缺少conflictsvs审计治理。 |
| 1404 | websocket-bridge.ts:184、task-websocket-status-relay.ts:50、http-api-server.ts:1057 等 10+ occurrences setInterval not .unref()，阻塞事件循环退出 | `done` | 定时后台任务最初分散追加，缺少统一的事件循环退出检查；当前涉及的 interval 均已补 `unref()`。 |
| 1405 | redis-lock-adapter.ts:267 redis.scan(cursor,'COUNT',100) 缺 MATCH lock:*，扫描全库并误切非锁键 | `done` | 锁枚举实现accesses along用了裸 `SCAN` 样板，没有按锁前缀收窄键空间；现已改为 `MATCH lock:*`。 |
| 1406 | redis-lock-adapter.ts:186 释放锁 Lua 脚本未用 pcall，cjson.decode 失败会中止脚本，锁悬挂 | `done` | 早期 Lua 释放逻辑defaults to Redis 载荷总是合法 JSON，缺少异常分支；现已用 `pcall` fail-close。 |
| 1407 | redis-lock-adapter.ts:226 锁 id lock_${Date.now()}_${fencingToken} only毫秒分辨率，高concurrent碰撞 | `done` | 锁标识最初只追求可读性，误把时间戳当唯一源；现已切到 `randomUUID()` 级别随机性。 |
| 1408 | intake-router.ts:447,457,482,527、llm-eval-service.ts:854 用 Math.random() 做路由/采样，破坏可复现 evidence | `done` | 路由和评估辅助逻辑把“方便随机”带进了 evidence 路径；现已改成基于输入的确定性选择/采样。 |
| 1409 | structure/index.ts:309 new RegExp(...\b${expected}\b...`) 未 escape，expected` 含正则元字符即抛 | `done` | 结构校验defaults to导出名是普通标识符，没有先转义再拼接正则；现已统一 escape。 |
| 1410 | data-classification-service.ts:781,846 对配置正则只 void new RegExp 校验编译，norepeats指数限制，ReDoS | `done` | 配置校验曾只做“能编译”检查，把复杂度风险留给运lines时；现已puts编译前增加危险模式拦截。 |
| 1411 | prompt-injection-guard.ts:169,278、embedding-provider.ts:108,233、scoped-external-access-sandbox.ts:303 远程 fetch no AbortSignal/exceeds时，挂起即阻塞调用者 | `done` | 多occurrences远端评估/嵌入调用早期直接裸 fetch；现已统一补exceeds时控制，sandbox 路径也已具备 AbortController。 |
| 1412 | inter-plane-contract-gateway.ts:417 签名验签失败抛错路径被comment掉，失败静默通过 | `done` | 该条对应旧快照；现lines `receiveFromPlane()` puts验签失败时直接返回 `verified: false`，不会静默放lines。 |
| 1413 | runbook-executor.ts:258-274 simulatesStepExecution 对非只读命令直接返回 success: true，comment承认是占位 | `done` | 模拟执lines路径把危险命令defaults to当成功回放，缺少 fail-close 设计；现已要求显式模拟结果，否则拒绝非只读命令。 |
| 1414 | crypto-shredding-service.ts:355-425 readField/writeField doesn't reject **proto**/constructor 段，原型污染 | `done` | 字段路径occurrences理只关注业务层级，没有把原型链关键段视作非法输入；现已显式阻断。 |
| 1415 | crypto-shredding-service.ts:392、redis-rate-limiter.ts:87、redis-lock-adapter.ts:268、redis-queue-adapter.ts:599-600、prompt-version-manager.ts:83、hitl-modes.ts:51、channel-gateway-delivery-service.ts:257 多occurrences parseInt/parseFloat no Number.isFinite 校验，NaN 污染 | `done` | 多occurrences数值解析accesses along用了“解析后直接用”的松散习惯；现已puts仍暴露风险的路径补齐有限数校验，其余点位puts现lines实现中已don't exist。 |
| 1416 | effect-buffer.ts:333 timer.unref() puts嵌套条件内，setTimeout vs unref 间抛错即泄漏 | `done` | 该条基于旧实现快照；现lines effect buffer puts timer 赋值后立即 `unref()`，中间don't exist额外分支逻辑。 |
| 1417 | redis-queue-adapter.ts:255 生产代码内基于 process.env.AA_RUNNING_TESTS 走测试分支 | `done` | 队列适配器曾把测试便捷入口直接挂到生产环境变量上；现已改为显式 `driver: "memory"` 配置，并synchronous清理旧测试残留。 |
| 1418 | storage-backend-factory.ts:30-36 runtimeRequire 检查 globalThis.require.__aaMockOverride，把测试 hack 泄漏到生产路径 | `done` | 早期为了测 PostgreSQL 路径直接把globally require override 带进生产代码；现已改成受限 specifier 的显式模块注入。 |
| 1419 | storage-backend-factory.ts:35 return require(specifier) accepts任意 specifier，配置驱动型任意模块加载 | `done` | dynamically加载曾没有 allowlist，测试便利性压过了最小加载面；现已收口到固定的运lines时模块集合。 |
| 1420 | delegation-audit-service.ts:23 DEFAULT_AUDIT_DIR puts模块导入期 resolve 相对路径，layered runner 改 cwd 后失效 | `done` | defaults to审计目录puts模块装载时冻结，和分层 runner 的工作目录切换脱节；现已延迟到运lines期解析。 |
| 1421 | platform/index.ts:14-22 9 occurrences wildcard export *，同名符号 ambiguous 合并 | `todo` | 待修复 |
| 1422 | platform/contracts/index.ts:169 puts contract barrel 内 throw new Error(...)，违反自身定义的 AppError 体系 | `done` | contract barrel 里的历史守卫直接抛原生异常，没有跟随错误体系收口；现已改为 `ValidationError`。 |
| 1423 | patch-bundle.ts:145 new RegExp(`^${regex}$`) 直接拼user正则，注入/ReDoS | `done` | 该条基于旧实现认知；现lines patch bundle 先转义 glob 特殊字符，再编译缓存后的安全正则。 |
| 1424 | skill-creator-service.ts:204 正则 escape 字符串错误（] puts字符类外不需转但模板里漏） | `done` | 该条对应的 heading 转义Issue已don't exist；当前实现使用完整元字符转义集合构造标题匹配正则。 |
| 1425 | intake-router-model.ts:664 每调用即重新编译 RegExp，no缓存，热路径分配压力大 | `done` | 热路径规则匹配最初没有缓存 ASCII 规则正则；现已按 rule 缓存编译结果。 |
| 1426 | runbook-automation-service.ts:43,55,64 输出字符串含字面 ${stepName} 未插值 | `done` | runbook automation 曾把模板字符串写成字面量；现已改为真实插值输出步骤名。 |
| 1427 | runbook-automation-service.ts:36,48 用 Math.random()*150 vs >0.05 模拟执lines延迟vs失败率，stub 当成生产 | `done` | runbook automation 早期把随机延迟/失败率留puts生产路径；现已改为确定性时长vs显式失败命名约定。 |
| 1428 | workflow-builder-service.ts:259,267 JSON.parse(envelope["builderJson"]) 强转 Record<string, unknown> 后未做 schema 校验 | `done` | builder 持久化 JSON 曾把类型断言当校验；现已走安全对象解析。 |
| 1429 | goal-decomposer/index.ts:157、llm-plan-generator.ts:141 budget/费用正则puts不限长user输入上运lines，DoS | `done` | budget抽取逻辑defaults to把整段user输入直接送入正则，缺少扫描窗口；现已限制匹配长度。 |
| 1430 | plugin-definition.ts:515 JSON.parse(readFileSync(...SBOM)) no大小上限，恶意 SBOM OOM/DoS | `done` | SBOM 扫描先读全文件再解析，缺少文件大小闸门；现已puts读取前做尺寸上限校验。 |
| 1431 | plugin-definition.ts:185-189 嵌套 try/catch 静默吞掉签名解码错误，恶意签名混入 | `done` | 当前签名解码失败不会混入验证流程，而是显式返回 `invalid_signature_format`；原Issue来自旧审阅快照。 |
| 1432 | cli/login.ts:134 scryptSync 未显式 {N,r,p,maxmem}，KDF 参数defaults to即弱 | `done` | CLI 登录最初relies on Node defaults to KDF 参数，没有把口令学参数显式固化；现已显式声明。 |
| 1433 | cli/aa.ts:48-49 通过 extname(import.meta.url)===".ts" 判断是否 --import tsx，编译产物里残留 tsx 路径 | `done` | CLI 启动器曾把源码运lines探测绑定到 `import.meta.url` 扩展名；现已改成按同级实际入口文件存puts性判断。 |
| 1434 | runtime-services/durable-event-bus-async.ts:143、execution-dispatch-service-async.ts:113、execution-worker-handshake-service-async.ts、execution-worker-writeback-service-async.ts、human-takeover-service-async.ts vs platform/... 同名类二份实现，only测试references用 | `todo` | 待修复 |
| 1435 | domains/index.ts barrel only ~24/44 子目录，垂直域被静默隐藏 | `done` | domains barrel 长期靠手工维护，新增垂直域时没有synchronous导出；现已补齐缺失子域出口。 |
| 1436 | domains/{academic-research,advertising,agriculture,finance-accounting,healthcare,legal,manufacturing,live-streaming,...}/index.ts 12 lines preset stub，only测试references用 | `done` | 该条判断失准：这些模块虽然薄，但承载真实 preset vs `requires*Review()` 运lines时逻辑，并已通过 `domains/index.ts` 对外导出。 |
| 1437 | ops-maturity/index.ts:1-17 barrel 缺 improvement/、learning/、ops-maturity-score.ts | `done` | ops-maturity 顶层 barrel 更新不完整，子模块扩容后漏掉新入口；现已补齐。 |
| 1438 | region-router/index.ts:7,10 生产 zod schema defaults to [https://example.invalid；config](https://example.invalid；config) 缺失即调用no效 URL | `done` | 区域路由 schema 曾用占位 URL 兜defaults to值，把缺配置as可用配置；现已去掉no效defaults to地址。 |
| 1439 | web/runtime.ts:103 globalThis.fetch.bind(globalThis) puts构造时捕获，后续 monkeypatch 不生效 | `done` | Web runtime 早期putsat construction time绑定 fetch；现已改成运lines时 fetch wrapper，测试替换和后续补丁都能生效。 |
| 1440 | web/runtime.ts:127-130 种子 session expiresAt = Date.now()+3600_000 且 refreshToken 空，1h 后静默过期 | `done` | 静态 bootstrap token 曾被错误当成短时 session；现已改为非过期 bootstrap session，并writes显式占位 refresh token。 |
| 1441 | web/runtime.ts:163 BrowserWSClient puts wsUrl 缺失时仍构造，向defaults to地址发起 WS | `done` | Web runtime 曾no条件创建浏览器 WS 客户端；现已puts缺少 wsUrl 时 fail-close 到内存 WS。 |
| 1442 | web/vite.config.ts:14 CSP script-src 'self' 缺 worker-src，严格 CSP 下 SW/SharedWorker 启动被阻 | `done` | Web CSP 曾只约束 script-src；现已补 worker-src，覆盖 SW/SharedWorker 场景。 |
| 1443 | web/vite.config.ts:17 CSP connect-src 'self' https: ws: wss: 等于放开任意外联 | `done` | connect-src 早期直接放开全部 HTTP(S)/WS(S)；现已改为从显式运lines时端点收敛 origin 白名单。 |
| 1444 | web/vite.config.ts:24-28 声明 Report-To csp-endpoint，但服务端no /api/csp-report 路由 | `done` | Web CSP 曾声明non-existent Report-To 端点；现已移除该伪上报配置。 |
| 1445 | web/vite.config.ts:108 生产 sourcemap:"hidden" vs SRI 注入conflicts，任何后occurrences理都会 SRI 失配 | `done` | 生产构建曾同时开启 hidden sourcemap vs SRI 注入；现已关闭生产 sourcemap，避免摘要漂移。 |
| 1446 | web/vite.config.ts:56 SRI 正则不感知已存puts integrity=，会双重注入 | `done` | SRI 注入逻辑曾不识别已有 integrity；现已puts注入前显式跳过已带 integrity 的标签。 |
| 1447 | web/build-config.ts:17 manualChunks 正则 `feature[-/]` 后接单段标识时only取首段，workflow-builder vs workflow-cockpit 被并入同一 chunk | `done` | chunk 命名曾按错误正则截首段；现已按 feature 目录名完整拆分模块 chunk。 |
| 1448 | workflow-builder/web/flow-canvas.tsx:21、web/index.tsx:11-18 每iterations渲染传新数组给 LazyFlowCanvas，破坏 ReactFlow memo | `done` | workflow builder 曾puts父子两层repeats创建新数组；现已保持稳定 props，并puts画布层按references用缓存。 |
| 1449 | workflow-cockpit/web/dag-viewer.tsx:107 position:absolute + zIndex:-1 父容器非 relative，连接线视觉跑出面板 | `done` | DAG 连接线曾relies on负 z-index 绝对定位；现已改为正常流式 rail 布局，不再跑出容器。 |
| 1450 | workflow-cockpit/web/dag-viewer.tsx:38-46 branchGroups no useMemo，大 workflow O(n) 重算 | `done` | DAG 分支分组曾puts每iterations渲染重算；现已对 branch groups 和 stage steps 做 memo 化。 |
| 1451 | workflow-cockpit/web/dag-viewer.tsx:138-147 key={branchId} 但 DTO 不约束唯一性，repeats key 风险 | `done` | 分支列表曾直接拿 branchId 做 React key；现已改为稳定复合 key，避免repeats branchId conflicts。 |
| 1452 | feature-flags/hooks/index.ts:7 queryFn:()=>fetchFeatureFlags({} as never) 抹掉 RESTClient 参数，cast 失效即 NPE | `done` | feature-flags hook 曾通过 `{}` as never 抹掉 REST client relies on。 |
| 1453 | task-cockpit/hooks/index.ts:71-74 useEffect(...,[taskQuery.data]) 每 5s 轮询都 setOptimisticTasks(null) 清空乐观 UI | `done` | task cockpit 曾puts每iterations轮询后直接清空乐观态；现已只puts服务端数据追平时回收 optimistic state。 |
| 1454 | workflow-builder/web/index.tsx:21 固定 height:280 + overflow:hidden，MiniMap/Controls puts窄屏overlaps | `done` | workflow builder 画布容器曾hardcoded 280 高度并裁切溢出；现已改为响应式高度和可见溢出布局。 |
| 1455 | .husky/pre-commit:1-5 only npx lint-staged && npm run typecheck，缺 husky v9 兼容头 | `done` | pre-commit 钩子曾缺少 husky 初始化兼容头；现已补标准 husky v9 兼容references导。 |
| 1456 | .gitignore:43-45 dist/**/*.js 等三linesvs已忽略 dist/ 父目录冗余 | `done` | 父目录已忽略后仍残留子模式，.gitignore 规则repeats。 |
| 1457 | truth/storage-quota-service.ts:89,96,103,124 4 occurrences process.cwd() puts构造时冻结路径，cwd 变化即失效 | `done` | storage quota defaults to根路径直接取 cwd，未从 sandbox/workspace 真源派生。 |
| 1458 | truth/session-dual-storage.ts:136 JSONL writesno Date/Buffer replacer，Buffer 序列化为 {type:"Buffer",data:[...]} 膨胀 | `done` | session JSONL 直接吃原始 Buffer toJSON 结果，未做紧凑化序列化。 |
| 1459 | .gitignore 未 ignore dist-types/.vitest-temp/coverage-report/.dr-reports/coverage-report | `done` | 新生成目录加入后 .gitignore 没持续补齐。 |
| 1460 | .editorconfig don't exist | `done` | 仓库缺少统一编辑器格式约束。 |
| 1461 | .npmrc don't exist，engine-strict=true/fund=false/audit=true 未集中声明 | `done` | npm lines为约束散落puts人和 CI 约定里，没有集中puts .npmrc。 |
