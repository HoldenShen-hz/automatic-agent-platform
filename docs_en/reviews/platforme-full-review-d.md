## src/platform/five-plane-interface

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1 | iam/audit-event-integrity.ts:43-44, distributed-rate-limiter.ts:47, request-deduplication.ts:82, http-api-server.ts:119-122, http-server/health-routes.ts:19-21 库内directly读 process.env.NODE_ENV/常量, breaks DI 与testing | `done` | Root cause: interface层和 IAM 辅助module把环境探测写进库内部, missing少via options/deps injection运行configure的边界.  |
| 2 | stryker.config.mjs:30-33 mutate: only 9 个fileconcentrated在 http-server/, coverage远窄于strategy文档声明 | `done` | Root cause: 变异testingconfigure长期采用人工点名清单, 随着interface层扩张没有synchronous扩面.  |
| 3 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:82 user cursor JSON.parse 无 try/catch, maliciouscursor → 500 | `done` | Root cause: paginationcursor在路由内手写decode, 未复用统一error边界.  |
| 4 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:103-104 module-level InMemoryHarnessRunStore singleton, 跨requestshared, 重启丢data | `done` | Root cause: 早期placeholderimplementation把 store 放成module-levelsingleton, 而不是dependencyinjection的路由dependency.  |
| 5 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:159-162 /events interfacefixedreturn空array, not connected Truth | `done` | Root cause: 事件interface只做了路由placeholder, 没有把创建/更新生命周期事件落入can read取存储.  |
| 6 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:209,217-218,228 body.riskLevel/status directly as 强转无枚举validation | `done` | Root cause: 输入validationmissing, dependency TypeScript cast 代替runtime约束.  |
| 7 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:273-279 PATCH 把 body.status/terminalReason directly写存储, no whitelist | `done` | Root cause:  PATCH 逻辑directly把request体映射到模型更新, 没有field白名单和终态约束.  |
| 8 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:76-89 list 每request Array.from+sort O(n log n) fullre-sort | `done` | Root cause: 列表interface按“现取现排”的临时implementation写成了每requestre-sort.  |
| 9 | src/platform/five-plane-interface/webhook/index.ts:73-74 acceptedEnvelopes/failureCounts unbounded growth | `done` | Root cause:  webhook entrydefault假设process短生命周期, missing少容量治理与回收strategy.  |
| 10 | src/platform/five-plane-interface/webhook/index.ts:72 envelopesByIdempotencyKey lacks TTL/upper limit | `done` | Root cause: 幂等cached只implementation了deduplication语义, 没有implementation TTL 与容量淘汰.  |
| 11 | src/platform/five-plane-interface/webhook/index.ts:111-120 事件type/allows列表validation先于signaturevalidation, 未signature探测enumerable allowedEventTypes | `done` | Root cause: validationorder按业务field优先组织, 没有先做认证再做authorizationfilter.  |
| 12 | src/platform/five-plane-interface/webhook/index.ts:207-209 failure计数hardcoded 50, auto disable 后无再激活path | `done` | Root cause: failure熔断阈值被hardcoded在implementation里, 且missing少explicitly恢复操作.  |
| 13 | src/platform/five-plane-interface/webhook/index.ts:200-211 recordDeliveryFailure directly mutate 注册对象 enabled, 破坏不可变contract | `done` | Root cause: 注册对象被当成可变运行态directly回写, 没有重新生成并替换record.  |
| 14 | src/platform/five-plane-interface/webhook/index.ts:182-184 rollbackAcceptedEnvelope findIndex 线性search | `done` | Root cause: accepts列表只有array表示, 没有反向index支持rollback删除.  |
| 15 | src/platform/five-plane-interface/webhook/index.ts:296-315 parseWebhookPayload 不limit body size, 超大 JSON blocks event loop | `done` | Root cause:  payload 解析只关注 JSON 结构, 不关注输入体积upper limit.  |
| 16 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:190,250 先 get 后 set non-atomic, concurrent同 Idempotency-Key 双写入 | `done` | Root cause: 幂等中间件只有抽象 get/set 存储interface, 没有原子保留语义.  |
| 17 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:206-217 in-flight branchreturn allowed:true 但同时附 409, semantic conflict | `done` | Root cause: 早期把“duplicaterequest已受理”误建模成 allowed, 同时又附conflicterror.  |
| 18 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:201 error消息回显user idempotencyKey/method, responseinjectionrisk | `done` | Root cause: error文案directly拼接user输入, 没有做回显最小化.  |
| 19 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:222-234 cachedresponse JSON.parse 无sizelimit | `done` | Root cause: 幂等replaypath只validation JSON 可解析, 没有limitcached体size.  |
| 20 | src/platform/five-plane-interface/api/http-server/approval-routes.ts:73 user requestJson JSON.parse 无sizelimit | `done` | Root cause: 审批 requestJson 被视为可信内部field, misses了sizeupper limit防护.  |
| 21 | src/platform/five-plane-interface/api/http-server/dashboard-routes.ts:344 dashboard requestJson JSON.parse 同上 | `done` | Root cause:  dashboard 复用了同类“directly parse requestJson”的模式, 没有体积护栏.  |
| 22 | src/platform/five-plane-interface/api/http-server/utils.ts:339,344 cursor base64url 编decode无 try/catch, 无integritysignature, 可tamper | `done` | Root cause: 通用cursor最初只做了可逆编码, 没有加签防tamper.  |
| 23 | src/platform/five-plane-interface/api/http-server/gateway-routes.ts:125 body 非字符串时 JSON.stringify 后转发, 丢字节序signaturefailure | `done` | Root cause:  webhook 接收路由把“原始报文”与“已解析对象”混用, 默默重序列化了输入.  |
| 24 | src/platform/five-plane-interface/api/http-server/task-routes.ts:340,357 JSON.stringify(payload) persistence未限定fieldorder | `done` | Root cause: persistencepath沿用普通 JSON.stringify, 而不是稳定序列化.  |
| 25 | src/platform/five-plane-interface/webhook/index.ts:255 Buffer.from(normalizedSignature,"hex") accepts非 hex 并truncated, lengthcomparison掩盖pollute | `done` | Root cause: signature前置validationmissing, defaultdependency Buffer 的宽松 hex decode行为.  |
| 26 | src/platform/five-plane-interface/webhook/index.ts:60-61 replaycached TTL/容量都是 module 常量, 不可由tenant/endpoint configure | `done` | Root cause: replaycached参数最初按module常量写死, 没有暴露到服务/endpoint configure层.  |
| 27 | tests/integration/platform/interface/api/grpc-adapter-service-integration.test.ts:24,47,145,178,207,337 6 处 host:"0.0.0.0" 监听全网卡 | `done` | Root cause: 集成testing偷懒复用了通配监听地址, 而不是explicitly环回地址.  |
| 28 | api-server-env.ts 读 AA_API_KEYS_JSON 与文档 AA_API_KEYS inconsistent | `done` | Root cause: 环境加载器把结构化configure和compatibility变量拆成两套名字, 文档与implementation长期drift.  |

## src/platform/five-plane-control-plane

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 29 | Control Planedeeplystate-Evidence Plane SQLite privatepath (approval/config/incident-control multiple places)  | `done` | Root cause: Control Plane历史上directly穿透到state-Evidence Plane的private SQLite implementation, missing少稳定的 truth 公共出口.  |
| 30 | Execution Plane约 40 处 import Control Plane IAM/configureimplementationdetails, 未via contract/policy 端口 | `done` | Root cause: Execution Plane长期复用Control Planeimplementationdetails而非公共 index/contract 端口, 导致跨 plane 边界leaks.  |
| 31 | iam/field-encryption.ts:10,24 PBKDF2 only 100k 次 + synchronous pbkdf2Sync, below OWASP 600k 且blocks事件循环 | `done` | Root cause: field加密曾把“口令派生”与“runtime加解密”绑在synchronouspath里, 导致强度和事件循环都受限.  |
| 32 | iam/session-management.ts:164-167 hashToken 用bare sha256(token), filecomment承认应用 HMAC | `done` | Root cause: 会话index最初按普通摘要implementation, missing少服务端持有的 keyed secret.  |
| 33 | tests/integration/platform/control-plane/config-center/config-rollout-service-integration.test.ts:317,332,355 Date.now()-90000000 comment"25h"实为 25h00m00s, 等于 TTL 即抖动 | `done` | Root cause: testingdata长期usesbare毫秒literal量, can read性差, 容易被误审为边界抖动.  |
| 34 | tests/integration/platform/control-plane/incident-control/doctor.test.ts:1096 delete process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION has no pre捕获 | `done` | Root cause:  review based on旧版本; 当前testing已先捕获并在 finally 中恢复环境变量.  |
| 35 | src/platform/five-plane-control-plane/policy-center/index.ts:282 紧急模式 requiresApproval=subjectType!=="system", system 主体bypass break-glass 审批 | `done` | Root cause:  break-glass 逻辑error地把 system principal 当成天然可信, misses统一审批门.  |
| 36 | src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:120-132 getFieldValue 沿 . path访问, 未reject __proto__/constructor/prototype | `done` | Root cause: 规则引擎只考虑业务field导航, 没有把原型链path当作不可信输入handle.  |
| 37 | src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:450 JSON.stringify(config, Object.keys(config).sort()) 误用 replacer 当 key 白名单, 嵌套field被裁剪 | `done` | Root cause: 版本计算偷用了浅层 key sort技巧, 没有implementation真正的递归稳定序列化.  |
| 38 | src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:451-457 32-bit 非密码学哈希做configure checksum, collision概率明显 | `done` | Root cause: 热重载版本号沿用了轻量字符串 hash, 而不是面向configureintegrity的强validation摘要.  |
| 39 | src/platform/five-plane-control-plane/iam/secret-management-service.ts:765-768 startDailyRotationSchedulers entry先清空再 add, 重入丢正在execute的 sweep | `done` | Root cause: 轮转调度器把“duplicate启动”handle成silently重建, 破坏了已有调度handle和运行中的 sweep.  |
| 40 | src/platform/five-plane-control-plane/iam/secret-management-service.ts:770-776 runRotationSweep("initial") 与 setInterval synchronous起, 可能concurrent同一 sweep | `done` | Root cause:  review 把synchronous初始 sweep 误判成异步overlap; 现implementation同时收口为单实例调度器, 不再existsconcurrent重启path.  |
| 41 | src/platform/five-plane-control-plane/iam/aws-kms-http-secret-provider.ts:358-364 双重 base64 decode假设 KMS 永返 base64 | `done` | Root cause: implementation把 KMS Plaintext field强行套入local密文存储编码假设, 混淆了 provider 协议与localconfigure格式.  |
| 42 | src/platform/five-plane-control-plane/iam/gcp-secret-manager-http-secret-provider.ts:256 GCP secret return值未validation是否 base64 | `done` | Root cause:  provider default信任云端 payload 编码, 没有做严格 base64 validation与failurebranch.  |
| 43 | src/platform/five-plane-control-plane/incident-control/runbook-executor/runbook-executor.ts:192-198,258-266 runbook executor only simulate, 生产pathnot connected | `done` | Root cause:  runbook execute器最初只做演练placeholder, 没有抽象出受控命令execute边界; 现已收口为injection式只读execute器并对非只读命令 fail-closed.  |
| 44 | src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts configure hash only取 keys 顶层不递归 | `done` | Root cause: configure版本函数只围绕顶层对象设计, 没有为嵌套结构定义稳定递归遍历.  |
| 45 | src/platform/five-plane-control-plane/iam/field-encryption.ts:46 Buffer.from(value,"base64") directlydecode, 未reject纯 utf-8 输入 | `done` | Root cause: 密文 envelope 解析dependency Node 宽松 base64 decode行为, 没有做 round-trip 验证.  |
| 46 | src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:128 arbitrary string parts index到 Function.prototype 等成员, 假阳/假阴匹配 | `done` | Root cause: field访问既没阻断危险片段, 也没限定 own-property 访问边界.  |
| 47 | src/platform/five-plane-control-plane/iam/secret-management-service.ts:805-815 requireRegistryRecord errorpath details duplicate secretRef 未sanitized | `done` | Root cause: 存储errordirectly复用了原始 secretRef 作为 message/details, 未做最小披露.  |
| 48 | tests/unit/platform/control-plane/iam/sandbox-policy-extended.test.ts:66 /tmp/test-file-${Date.now()} 越出 sandbox-root testing矩阵 | `done` | Root cause: testing曾dependency宿主 `/tmp` 语义, 绕开了仓库内受控临时工作区.  |
| 49 | startup-env-schema.ts:376 JWT 密钥 undefined 走 default-allow, missing密钥仍可签发 | `done` | Root cause:  review based on旧validation逻辑; 当前 schema 已在configure API key 认证时force要求 JWT secret.  |
| 50 | api-client.ts Retry-After directly parseInt, 未识别 HTTP-date | `done` | Root cause: 旧implementation只支持 delta-seconds; 当前解析函数已补齐 HTTP-date branch.  |
| 51 | test:secret-providers patherror (少一层 platform/)  | `done` | Root cause: 脚本path在testing目录迁移后未synchronous; 当前 package.json 已指向现行 integration path.  |
| 52 | auto-stop-loss-service.ts:789, config-hot-reload-service.ts:268,506, cache-invalidation-broadcast.ts:68, durable-event-bus.ts:710,916,1007, call-governance.ts:609, external-secret-provider.ts:226 multiple places void promise fire-and-forget 无 .catch | `done` | Root cause: 多个基础设施module把“后台task”当成可忽略details, misses rejection 观测与cleanup.  |
| 53 | aws-kms-http-secret-provider.ts:211, gcp-secret-manager-http-secret-provider.ts:103, vault-http-secret-provider.ts:132 setTimeout(...controller.abort) 未 .unref() 且partialsuccesspath漏 clearTimeout | `done` | Root cause:  provider timeout 辅助逻辑按最小可用implementation编写, 忽略了process退出blocks和定时器治理.  |
| 54 | secret-management-service.ts:765-768 startDailyRotationSchedulers silently clear 已有 schedulers, 外部 handle 失效 | `done` | Root cause: 调度器生命周期没有distinguish“首次启动”和“duplicatecall”, 导致silently替换已有 handle.  |
| 55 | client-sdk/api-client.ts:188 (result as { totalCount?: number }).totalCount = totalCount via cast 改写 readonly field | `done` | Root cause: paginationresponse为了compatibility可选field, 走了typeassertion回写而不是重新construction对象.  |
| 56 | client-sdk/api-client.ts:368 connect() 在 SSE bootstrap 处 fire-and-forget, 初始 fetch rejection 未handle | `done` | Root cause:  review based on旧理解; 当前 connect 内部已兜住连接异常并走重连branch, 启动处only保留explicitly void call.  |

## src/platform/five-plane-orchestration

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 57 | src/platform/agent-delegation/index.ts 与 five-plane-orchestration/agent-delegation/* 形成双entry | `done` | Root cause: 早期为补目录结构审计而保留了 legacy facade, subsequenttesting与结构assertion继续消费它, 导致 public surface 没有及时收口到 five-plane-orchestration canonical entry.  |
| 58 | config/quality/test-exclusion-allowlist.json 列 tests/integration/platform/orchestration/** (已rename为 five-plane-orchestration) , never命中 | `done` | Root cause: 目录rename后 allowlist 只保留了旧path, 没有跟着 canonical 布局更新.  |
| 59 | oapeflir/runtime-execute-bridge.ts:223-235 executor 为 null 时合成假 succeeded + validationPassed:true, stub silentlyreturn | `done` | Root cause:  bridge 为了便于早期联调defaultreturn假success结果, 掩盖真实execute器missing.  |
| 60 | oapeflir/runtime-execute-bridge.ts:182 defaultModelId="MiniMax-M2.7" 把具体厂商模型hardcoded到框架代码 | `done` | Root cause: 框架default值directly继承了某次联调模型, 而不是抽象为 vendor-neutral default.  |
| 61 | oapeflir/runtime-execute-bridge.ts:194,264,316 createdAt: Date.now() 数字与 Plan.createdAt: string typedrift, only靠 as Plan cast | `done` | Root cause:  review based on旧 DTO 认知; 当前 Plan.createdAt 仍是毫秒时间戳, 已改为统一 ISO->ms 归一生成.  |
| 62 | oapeflir/handoff-model.ts:55-57 Math.ceil(JSON.stringify(value).length/4) 估 token 对 CJK/多字节失真 | `done` | Root cause:  handoff 压缩只按 ASCII text经验估算 token, 忽略 UTF-8 多字节差异.  |
| 63 | oapeflir/handoff-model.ts:88-135 压缩silently丢弃 historyRefs/toolCallRecords/planDelta/blockers/artifactRefs, 无丢弃台账 | `done` | Root cause:  handoff compaction 只关注降体积, 没有为被裁剪field保留审计痕迹.  |
| 64 | oapeflir/oapeflir-loop-core.ts:382, oapeflir-loop-support.ts:324, stage-transition-fsm.ts:189-223 multiple places Date.now() self-generatedtimestamp, clock回拨即非monotonic | `done` | Root cause:  OAPEFLIR 内部事件时间最初directly取 wall clock, 没有抽象成monotonic递增时间源.  |
| 65 | oapeflir/oapeflir-loop-core.ts:299 把 process.{version,platform,cwd()} 写入 environmentContext 留存 evidence, leaks宿主fingerprinting | `done` | Root cause:  fallback observation 为了调试便利directly采集宿主上下文, missing少证据最小披露约束.  |
| 66 | docs_zh/contracts/oapeflir_loop_contract.md exists但 README 不列; ADR-016 references OAPEFLIR 也未链接 | `done` | Root cause:  contract/ADR 文档新增后, README 与关联 ADR 没有synchronous补全references链.  |
| 67 | scripts/ci/mutation-critical-tests.sh:13 引 tests/unit/platform/orchestration/oapeflir/... 而权威path为 five-plane-orchestration, rename后silently零测 | `done` | Root cause: testing目录rename后, mutation 关键脚本仍references旧path.  |
| 68 | src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:275 super("mock://runtime","local-simulated") default指向 mock runtime | `done` | Root cause:  Mock bridge directly把 mock runtime URI/modelId 烙进default父类construction, 模糊了真实 bridge 与testing替身边界.  |
| 69 | scripts/ci/audit-oapeflir-terminology.mjs only扫八字母拼写, misses中文术语drift | `done` | Root cause: 术语审计脚本只validation英文阶段词序, 没有把中文 canonical 术语纳入check.  |

## src/platform/five-plane-execution

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 70 | plugin-executor.service.ts:482 explicitly抛 action_not_implemented, hook missing即 500 | `done` | Root cause: 插件execute器把未implementation hook 当异常paththrows, 而不是回落为结构化 rejected 结果.  |
| 71 | five-plane-execution/state-transition/* 经 core/runtime/index.ts 重新出口out of bounds | `done` | Root cause:  core/runtime 为compatibility旧call方继续转发Execution Planestate迁移implementation, 造成跨层公共面继续膨胀.  |
| 72 | tests/unit/runtime/, platform/execution/, platform/five-plane-execution/ parallelduplicate | `done` | Root cause: Execution Plane多轮目录rename后同时保留了 runtime, platform/execution, five-plane-execution 三套testing树; 本批已删除duplicate旧树, 迁移compatibilitycoverage, 并新增duplicatepath审计testing防回归.  |
| 73 | plugin-executor.service.ts:106 enforceSignatures default false, env 未设时unsafe fail-open | `done` | Root cause: 插件signaturevalidation最初以联调便利为先, default走 fail-open, 安全default值没有收紧到外部插件场景.  |
| 74 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:55-90 SELECT/DELETE/INSERT 不在transaction内, TTL expiry淘汰 TOCTOU; concurrent夺lock可误删刚获取者 | `done` | Root cause:  SQLite lock适配器早期按逐句脚本拼接implementation, 没有把expirycleanup与夺lock收进单transaction临界区.  |
| 75 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:34-37 distributed_lock_fencing_tokens only INSERT 自增, nevercleanup, unbounded growth | `done` | Root cause:  fencing token 设计成 append-only 计数表, 却没有synchronous规划压缩与有界存储strategy.  |
| 76 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:54 ttlMs missing下界validation, negative/0 directly写入 | `done` | Root cause: lock TTL 只做upper limit裁剪, 没有建立最小有效租期约束.  |
| 77 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:135-148 forceSteal has no preauthorization/原因白名单, arbitrarycall即可夺lock | `done` | Root cause:  force-steal 被当成内部ops捷径暴露, implementation里missing少explicitlyauthorization理由边界.  |
| 78 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:140 forceSteal hardcoded ttlMs=30000 而非沿用原lockconfigure | `done` | Root cause: 强夺lockpath从示例implementation演化而来, 把 TTL 常量写死在branch里, 没有复用lockconfigurestrategy.  |
| 79 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:107-112 release owner 不匹配时silentlyreturn false 无审计事件 | `done` | Root cause: 释放failure长期只按布尔结果建模, 没有把 owner 不匹配视为需要审计的异常争抢事件.  |
| 80 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:549-573 dequeueAsync 多 await 间无atomicity, 两 worker 可同时取走同 jobId | `done` | Root cause:  Redis 队列最初以多条命令串联implementation claim 流程, 没有用单脚本保证取号与state切换原子化.  |
| 81 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:569 stateconfirmation前 hincrby attempts, statereset导致计数misalignment | `done` | Root cause:  attempts 预算在 claim success前就被前置递增, 计数语义与真实生命周期脱节.  |
| 82 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:566-568 state非 waiting 即 zrem return null silently丢task | `done` | Root cause: 旧 dequeue 把竞争failure和task异常state混成同一path, missing少explicitly恢复或re-sortbranch.  |
| 83 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:592-596 only ack path expire task键, nack/failuretask无 TTL key 累积 | `done` | Root cause: task保留strategy只coveragesuccess消费path, 没有为 nack, dead-letter 和failure态定义统一 TTL 回收.  |
| 84 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:605-609 nack re-sort不带backoff, 立即被同 worker 再拉 | `done` | Root cause:  nack implementation只追求“尽快重试”, 没有引入最小backoffwindow避免热循环.  |
| 85 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:664-672 retryJobAsync 强置 attempts=0 bypass maxAttempts 预算 | `done` | Root cause: 人工重试path被当成fullreset, 破坏了 attempts 预算与死信strategy的一致性.  |
| 86 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:600 nack 闭包referencesstale jobData.priority | `done` | Root cause:  nack 逻辑闭包复用了旧快照, task重新入队时没有重新读取权威优先级.  |
| 87 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:675-695 purgeAsync 对每条 ID individual hgetall N+1 RTT | `done` | Root cause:  purge 流程先按逐条读取implementationcan read性, 没有批handle设计, 导致高延迟下出现明显 N+1 往返.  |
| 88 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:308-317 先 arrayBuffer() full读再判size, 可被超大response OOM | `done` | Root cause: 外部访问沙箱先追求 fetch API uses简洁性, 未把response流sizeguard前置到流式读取阶段.  |
| 89 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:323-324 JSON.parse 无 try/catch, malicious JSON directly抛 | `done` | Root cause:  JSON response被假定为可信结构, missing少解析failure隔离和结构化error转换.  |
| 90 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:296-298 Content-Type size写敏感比较, call方 Content-type 时双写 header | `done` | Root cause:  HTTP header 归一化约定没有落实到沙箱适配层, size写compatibility性dependencycall方自觉.  |
| 91 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:672-678 simulateStepExecution only setTimeout 50ms, 未真execute任何 action | `done` | Root cause: 子工作流execute器最初只有placeholder延时器, 没有抽象出可injection的 step execution 边界.  |
| 92 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:729-733 simulateRollback 是 no-op, rollback永远success | `done` | Root cause:  rollback 被当成演示path保留成空implementation, 没有真正的rollbackexecute器和failurebranch.  |
| 93 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:665-669 findStepDefinition 遍历所有 executions O(N·M) | `done` | Root cause:  step definition 没有挂在 execution localindex上, 运行期只能globally反查.  |
| 94 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:642 step.output 写死 "Step X completed successfully" coverage真实output | `done` | Root cause: default happy-path directly回填模板化output, 而不是消费 step executor 的真实结果.  |
| 95 | src/platform/five-plane-execution/compensation-manager.ts:312-319 reverseExternalEffect directly return true, 外部副作用未反转 | `done` | Root cause: 补偿manage器只implementation了state机骨架, 没有把反向外部副作用抽象成可execute适配器.  |
| 96 | src/platform/five-plane-execution/compensation-manager.ts:326-333 executeCompensateAction stub 永真 | `done` | Root cause:  compensate action 一直停留在 stub, missing少based on step/context 的execute判定.  |
| 97 | src/platform/five-plane-execution/compensation-manager.ts:339-344 sendCompensationNotification 空体, notification从未发出 | `done` | Root cause: notificationstep没有independent adapter, 旧implementation把 notify 当成永远success的旁路.  |
| 98 | src/platform/five-plane-execution/compensation-manager.ts:350-358 executeRollback stub, rollbackcontract不implementation | `done` | Root cause:  rollback step 没有消费 rollback plan / targetRef, 只保留了示例函数壳.  |
| 99 | src/platform/five-plane-execution/execution-engine/phase1a-happy-path.ts:1-6 only re-export, 按 AGENTS 应彻底removal | `done` | Root cause: execute引擎rename后继续保留 phase1a compatibility壳, 旧naming未及时从源码面removal.  |
| 100 | src/platform/five-plane-execution/execution-engine/phase1b-orchestration.ts:1-31 compatibilityfile维持冗余naming | `done` | Root cause:  multi-step 编排收口后仍residual phase1b 别名file, 公共面没有完全切换到规范naming.  |
| 101 | src/platform/five-plane-execution/execution-engine/phase1b-tool-definitions.ts & phase1b-utils.ts phase1b compatibilityresidual | `done` | Root cause:  phase1b 配套工具定义与工具函数沿用旧别名继续转发, 导致同一能力维持双file表述.  |
| 102 | src/platform/five-plane-execution/recovery/runtime-recovery-service.ts 与 runtime-recovery-service-root.ts 等四对 *-service/*-service-root 双胞胎 | `done` | Root cause:  recovery module迁移时为compatibility旧entry保留了 root 别名file, 源码层形成事实双implementationbranch.  |
| 103 | src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts 581 行单fileviolates AGENTS small modules principle | `done` | Root cause: 多步编排最初把plan解析, bootstrap, HarnessRun persistence和终态收尾都堆在entryfile; 现已拆成 `plan/bootstrap/finalize` 支持module, entry收敛为 202 行协调器.  |
| 104 | src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts 814 行同上 | `done` | Root cause:  supervisor 长期把断点handle, failurebranch, success提交和主循环混在一个file; 现已拆成 `breakpoint/failure/success` 三个支持module, 主循环收敛为 358 行.  |
| 105 | src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:47 ESM 内反向用 CJS require | `done` | Root cause: 异步封装层曾为复用synchronous服务偷用了 require 加载同胞module, 没有保持 ESM staticdependencygraph.  |
| 106 | src/platform/five-plane-execution/distributed-lock/locking-support.ts:12 require("postgres") synchronous加载, 可选dependencycoupling | `done` | Root cause: 分布式lock支持层曾把后端dependencymasks成runtime require branch, dependency关系既opaque也不利于staticanalysis.  |
| 107 | src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:67-68 construction期 createRequire+require("ioredis"), missingdependency即启动崩 | `done` | Root cause:  Redis lock适配器延续了 createRequire 风格的dynamic装配, dependency加载failure只能在construction期爆炸.  |
| 108 | src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:167,226 lock id 用 Date.now() 拼字符串, 毫秒级conflict可复用 | `done` | Root cause: lock ID 早期只拼接时间戳和业务field, 未引入真正的globally唯一熵源.  |
| 109 | src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:25-47 createRequire 后dynamic require 同胞 .js, modulegraph无法staticanalysis | `done` | Root cause:  async facade 曾试graph在runtime回拉同目录implementation, 导致modulegraph对工具链不可见.  |
| 110 | src/platform/five-plane-execution/distributed-lock/distributed-lock-manager.ts 9 行 dead shim | `done` | Root cause: 分布式lock目录重整后保留了 legacy manager 薄壳, call方迟迟未被收口到单一公共面.  |
| 111 | src/platform/five-plane-execution/distributed-lock/distributed-lock-service.ts 10 行 dead shim | `done` | Root cause:  service file起初只是转发壳, 没有承担真实公共entry职责, 导致 manager/service 概念duplicate.  |
| 112 | src/platform/five-plane-execution/distributed-lock/distributed-lock-factory.ts 21 行轻量wrapper与 manager/service overlap | `done` | Root cause:  lock adapter 创建逻辑被拆散到多个轻量wrapper层, 历史compatibilityfile越积越多.  |
| 113 | src/platform/five-plane-execution/execution-engine/runtime-context.ts 1 行 shim | `done` | Root cause:  runtime context 在目录迁移后保留了一层空壳转发, 未及时让call方转向 shared/context canonical path.  |
| 114 | src/platform/five-plane-execution/execution-engine/single-task-execution.ts 7 行 re-export shim | `done` | Root cause:  single-task happy path rename后继续维持旧file名 re-export, 源码面产生冗余entry.  |
| 115 | src/platform/five-plane-execution/distributed-lock/index.ts 1 行 barrel | `done` | Root cause: 目录级 barrel 在公共面已经收口后仍继续暴露历史path, 放大了导入分叉.  |
| 116 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:560-562 取最高 score (最新) violates FIFO 直觉文档未说明 | `done` | Root cause:  waiting 队列的 claim path把 Redis `ZRANGE` 结果反向遍历, 实际消费order悄悄退化成了“最新优先”.  |
| 117 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:686-693 checkpoint state directlyreferences原 entries array, subsequent mutate pollute历史 checkpoint | `done` | Root cause:  checkpoint recorddirectly复用in-memory态对象references, 没有做快照级深拷贝.  |
| 118 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:706-713 performRollback 在 rollbackHistory 为空时全标 rolled_back, 不distinguish未executestep | `done` | Root cause: 空 rollback history 被误当成“所有step都可rollback”, state机没有distinguish未execute与已rollback.  |
| 119 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:286-288 AbortController.unref 后 timeout 不blocks退出, 但 abort 后未 await cleanup与 ESM top-level race | `done` | Root cause: 旧 review 停留在timeoutcleanup前的implementation; 当前requestpath已经把 timeout 放进 `finally` cleanup, 问题本质是 timeout 生命周期治理曾未被explicitly建模.  |
| 120 | src/platform/five-plane-execution/recovery/runtime-recovery-service-root.ts 与 runtime-recovery-service.ts only import path与少量变量名不同, 构成事实branch | `done` | Root cause:  recovery 服务迁移过程中保留了 root 版本别名源码, 最终形成只差path与变量名的事实branch.  |
| 121 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:60,87,119-121 Math.min(ttlMs,MAX_LOCK_TTL_MS) 三处duplicate, 常量 600_000ms hardcoded | `done` | Root cause:  TTL 裁剪规则分散复制在多个branch里, 没有抽成统一的租期归一化函数.  |
| 122 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:115-127 extend 用 MIN(ttl_ms+?, MAX) cumulative而非自现在reset, TTL 永远滑向upper limit | `done` | Root cause:  extend 语义最初按“cumulative剩余 TTL”implementation, 而不是按“自当前时刻重新租约”建模.  |
| 123 | pg-advisory-lock-adapter.ts 取lock后无 try/finally, throw pathlockleaks | `done` | Root cause:  advisory lock acquire 只考虑 happy-path, 把“取locksuccess后local记账failure”的cleanuppathmisses在会话lock之外.  |
| 124 | pg-advisory-lock-adapter.ts:34-43 自定义 FNV-1a truncated到 63 位, collision被silentlyaccepts | `done` | Root cause:  PG advisory key 生成directly沿用了轻量示例哈希, 而不是uses更稳定的加密散列映射.  |
| 125 | pg-advisory-lock-adapter.ts:71-83 extend() only改in-memory map, 不刷新 PG 端 advisory lock TTL | `done` | Root cause:  review 把 PG advisory lock 套进了租约型 TTL 心智模型; PG 端本身没有服务器 TTL, 旧implementationmissing的是对“only刷新客户端 lease 元data”语义的明确约束.  |
| 126 | pg-advisory-lock-adapter.ts:107-115 catch-all 把transient PG errormasks成 "lock taken" | `done` | Root cause: 适配器把所有驱动异常都折叠成 acquire=false, 抹平了“lock已被占用”和“后端暂时不可用”的error边界.  |
| 127 | pg-advisory-lock-adapter.ts:101 Number(result.fencing_token) 超 2^53 precisionloss | `done` | Root cause:  fencing token 从data库 bigint 回读后directly强转成 JS number, 没有先做安全rangevalidation.  |

## src/platform/five-plane-state-evidence

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 128 | CLAUDE.md:50 references不exists的 state-evidence/artifacts/ 目录 | `done` | Root cause:  review based on旧目录快照; 当前 artifacts module已恢复为真实目录, 原问题expiry.  |
| 129 | 多个 contract/review 指向不exists的 state-evidence/artifacts/ 目录 | `done` | Root cause: 若干 review/contract 结论停留在 artifacts missing时期, 没有跟随subsequentmodule恢复而回写.  |
| 130 | runtime-truth-repository.ts:741, projection-rebuild-service.ts:429, memory-gateway/index.ts:248, plan-builder.ts:193 用非规范化 JSON.stringify 做fingerprinting, 键序changes即误判 diff | `done` | Root cause: 多个平面各自手写fingerprinting逻辑, 沿用了普通 JSON.stringify 而没有收口到稳定序列化工具.  |
| 131 | tests/integration/platform/state-evidence/memory/memory-layer-model-integration.test.ts:261 用 Date.now()-90000 做agingassertion, clockdrift即抖动 | `done` | Root cause: 时间敏感testing长期directlydependency wall-clock 差值, 没有fixed基准时间.  |
| 132 | tests/integration/platform/state-evidence/events/durable-event-bus.integration.test.ts 与 durable-event-bus-integration.test.ts naminginconsistent疑似double run | `done` | Root cause:  durable-event-bus 集成testing扩写时沿用了两套filenaming习惯, 导致“基础流”和“replaysort流”边界只体现在filecontent, 不体现在file名.  |
| 133 | package.json:223-234 test:receipt-store/tool-gateway/memory-gateway/sandbox-provider 无 aggregator, onlyoperatorentry | `done` | Root cause: 几个底层entrytesting被拆成independent脚本后, 没有补上面向 CI/batch验证的聚合命令.  |
| 134 | five-plane-state-evidence/index.ts:1 re-export 不exists的 ./artifacts/index.js, import 即抛 | `done` | Root cause:  review based on artifacts 目录missing时的旧快照; 当前 `artifacts/index.ts` 已exists且对外导出via.  |
| 135 | truth/sqlite/repositories/operations-repository.ts:898 listRuntimeRecoveryRecords 把 caller whereClause 直拼 SQL, onlyfilter ;\\|--\\|/* 仍allows OR 1=1/子query | `done` | Root cause:  runtime recovery query为了复用多种筛选场景, 暴露了自由 SQL 片段interface, 却没有收口到受控谓词白名单.  |
| 136 | truth/sqlite/repositories/event-repository.ts:788-828 insertEvent 与 outbox INSERT 双 prepared 无统一transaction, 破坏 outbox atomicity | `done` | Root cause:  Tier-1 state事件path把 event append 与 outbox append 分成了两个independent语句, missing少同一transaction或 savepoint 边界.  |
| 137 | truth/sqlite/repositories/task-repository.ts:96-125 listTasks cursor only按 updated_at, 无 id tiebreaker, pagination可丢行/死循环 | `done` | Root cause: task列表paginationcursor只保留了时间戳, 没有把稳定主键一起编码成复合 cursor.  |
| 138 | truth/sqlite/repositories/tenant-repository.ts:203-204 listAll 用 [...Map.values()].slice 无稳定sort, 跨页结果re-sort | `done` | Root cause: in-memorytenant仓储directly对 `Map.values()` 切片, default迭代order被误当成paginationorder.  |
| 139 | truth/sqlite/repositories/release-repository.ts:611,632,654 listEnterprise* only limit=20, 无 cursor/offset/tenant filter | `done` | Root cause: 企业发布类报表最初只按“最新 N 条”运营视graph落地, 没有synchronous抽象出稳定pagination和tenant维度约束.  |
| 140 | truth/sqlite/repositories/intelligence-repository.ts:350 listIntelBriefs(limit=20) 无 cursor silentlytruncated | `done` | Root cause: 情报简报列表长期只服务最近简报面板, missing少稳定cursorpagination能力.  |
| 141 | truth/sqlite/repositories/organization-repository.ts:273 listOrganizationRecords(limit=50) 无tenantfilter, 跨tenantleaks | `done` | Root cause: 组织列表default站在平台运营视角implementation, misses了tenant视角下的组织可见性约束.  |
| 142 | truth/sqlite/repositories/worker-repository.ts:63 与 worker-snapshot-repository.ts:276 listCoordinatorInstanceSnapshots 双implementation schema drift | `done` | Root cause:  review based on旧结构快照; 当前 `WorkerRepository` 已完全委托给 `WorkerSnapshotRepository`, 真实双implementation已收口.  |
| 143 | state-evidence/dlq/index.ts:110-113 enqueue 用线性 listByConsumer deduplication, O(n) 每 insert, 无index | `done` | Root cause: 基础 DLQ 仓储interface只暴露了按 consumer 扫描, deduplication键 `sourceEventId+consumerId` 没有单独query面也没有持久层index.  |
| 144 | state-evidence/dlq/index.ts:282-284 runDueRetries 空 catch {} 吞错无 logger/telemetry/backoff | `done` | Root cause:  DLQ retry worker 只统计 failed 计数, 没有把failure上下文发到结构化log或遥测面.  |
| 145 | state-evidence/dlq/index.ts:99 maxRetries=5 hardcoded, 与 dlq-service.ts retry policy conflict | `done` | Root cause: 基础 DLQ 与扩展 DLQ 各自maintaineddefault重试常量, 没有抽成单一strategy源.  |
| 146 | state-evidence/dlq/index.ts:6-23 DeadLetterRecord 与 contracts/types/domain/session-types.ts EventDeadLetterRecord schema 双源 | `done` | Root cause: 基础 DLQ recordindependent重写了事件死信field名和fieldtype, 没有复用领域合同里的事件死信field定义.  |
| 147 | state-evidence/incident/index.ts:127-161 listIncidents/listIncidentsPaginated full Map.values() + sort + findIndex, concurrentinsert下 cursor 失效 | `done` | Root cause:  incident paginationcursor最初只传 incidentId, 没有把sort基准一起编码到 cursor.  |
| 148 | state-evidence/incident/index.ts:35 linkedEvidenceRefs: input.linkedEvidenceRefs ?? [] directly存 caller references, 外部 mutation pollute内部 | `done` | Root cause:  incident open pathdirectly复用了call方arrayreferences, 没有做边界拷贝.  |
| 149 | state-evidence/incident/index.ts:117-121 resolve() acceptsarbitrary当前state, bypass triaged→mitigating→reviewed→resolved FSM | `done` | Root cause:  incident FSM 在 resolve 边上missing少stateguard, 只validation了exists性.  |
| 150 | state-evidence/incident/index.ts:22 nextIncidentOrder monotonic ID public预测enumerable | `done` | Root cause: sort tie-breaker dependency递增序号, 导致内部order键既可预测又和paginationcursor强coupling.  |
| 151 | state-evidence/audit/index.ts:21,29 AuditTrailService.records in-memoryarray无rotation/persistence, 长process必 OOM | `done` | Root cause: 审计轨迹服务按process内array起步, 没有任何容量upper limit或回收strategy.  |
| 152 | projections/projection-rebuild-service.ts:265-266,278-294 JSON.stringify comparison非规范化键序; cutover 无optimisticconcurrent token | `done` | Root cause:  projection compare/cutover 起初只面向单线程local重建, 没有把稳定序列化和 cutover 版本validation一起建成explicitly协议.  |
| 153 | checkpoints/checkpoint-envelope.ts:226 Buffer.from(payload,"base64") 不抛错, malicious payload silentlytruncated后入 gunzip | `done` | Root cause:  envelope 解包default信任 Node 的宽松 base64 decode行为, 没有先validation编码integrity.  |
| 154 | checkpoints/checkpoint-envelope.ts:147-149 JSON.stringify large object先full物化再判 size, OOM 早于guard | `done` | Root cause:  checkpoint size guard 放在序列化之后, 没有预估 JSON 体积的前置护栏.  |
| 155 | checkpoints/checkpoint-gc-service.ts:548-560 acquireRunLock 不record PID/host, crashedresiduallock与活lock不可distinguish | `done` | Root cause:  checkpoint GC lockfile只record acquiredAt, missing少process/主机identity元data.  |
| 156 | knowledge/keyword-index.ts:22-30 upsert 不clear前一次 keywords 反向index, remainingstale posting | `done` | Root cause:  keyword index 的 upsert 只有新增path, 没有先撤销旧倒排项.  |
| 157 | knowledge/keyword-index.ts:32-47 query 每次重扫 countOccurrences 无cached | `done` | Root cause: 关键词命中分数完全在 query 时现算, 没有把 chunk-keyword 统计cached起来.  |
| 158 | knowledge/keyword-index.ts:1-53 missing delete(chunkId) API, chunk 永生 | `done` | Root cause:  keyword index 只设计了 upsert/reset 两端, 没有单条删除语义.  |
| 159 | memory-gateway/index.ts:248-258 projectionHash 用 JSON.stringify([...input.memoryIds]) 保留 caller order, 相同集合不同序 hash 不同 | `done` | Root cause:  projection hash directly序列化call方array, 没有先做去re-sort序归一化.  |
| 160 | memory-gateway/index.ts:280-298 in-memory层映射 L1/L2/L4/L6 round-trip lossy, 未assertion | `done` | Root cause:  managed layer 到 runtime layer 的压缩映射没有保存 canonical layer 元data, 回读时只能退化恢复.  |
| 161 | memory-gateway/index.ts:328 Number.isFinite(Number(metadata.version)) accepts 1e308, missinginteger/rangevalidation | `done` | Root cause:  memory version 解析只做了“可转 number”判断, 没有integer与上界约束.  |
| 162 | state-evidence/memory/trust-level-service.ts:245-248 MAX=500/TTL=24h/EVICT=60s hardcoded无 config | `done` | Root cause:  trust-level service 最初按process内default值起步, 把容量, TTL, eviction周期都写死在类里.  |
| 163 | state-evidence/memory/trust-level-service.ts:280-289 每次eviction [...entries].sort O(n log n), 含非空assertion吞 OOB | `done` | Root cause: 超容量evictiondirectly走fullsort, 既不必要也把空洞情况交给非空assertion兜底.  |
| 164 | state-evidence/memory/trust-level-service.ts:384-385 includes("TODO"/"FIXME") literal字符串filter, 正常textfalsely flagged | `done` | Root cause: content质量check把 TODO/FIXME 当普通子串匹配, 没有限定为explicitlyplaceholder标记.  |
| 165 | truth/sqlite/repositories/prompt-bundle-repository.ts:164-332 8 处 JSON.stringify(input.*) 列写入无 zod validation | `done` | Root cause:  prompt bundle 仓储把 JSON 列当成“存前directly stringify”的薄wrapper, 没有把 schema validation放在persistence边界.  |
| 166 | truth/sqlite/repositories/billing-repository.ts:168 Number(result.changes) BigInt > 2^53 silentlytruncated | `done` | Root cause:  SQLite `run().changes` 被当成普通 number uses, 没有统一的 bigint 安全边界转换.  |
| 167 | truth/sqlite/repositories/worker-snapshot-repository.ts:249 同一query按 filter 切换 ORDER BY, cursor 跨 filter 即失效 | `done` | Root cause:  review 停留在旧pagination假设; 当前仓储没有对该列表暴露 cursor 协议, 真实risk是sort语义未明确, 而不是“cursor 跨 filter”.  |
| 168 | state-evidence/events/event-ops-service.ts:216-221 setTimeout(...) reject timer未 unref; Promise.race 胜者不 clearTimeout | `done` | Root cause:  review 停留在旧implementation; 当前 timeout helper 已同时 `unref()` 并在 `finally` 中 `clearTimeout()`.  |
| 169 | state-evidence/events/durable-event-bus.ts:9 不同instantiation点 retentionLimit:500/100 inconsistent | `done` | Root cause: 旧 review 把不同module logger 的 retention configure混写成 durable-event-bus 自身问题; 现行 bus logger 已independent收口.  |
| 170 | tests/integration/platform/state-evidence/events/transactional-event-appender 与 event-repository.ts:788-828 outbox split两 prepared call, SQLite WAL autocommit 下观察方可见partialstate | `done` | Root cause:  Tier-1 事件特殊path绕开了统一的 transactional appender, 把 event/outbox atomicity要求重新降回了双语句 autocommit.  |
| 171 | tests/integration/platform/state-evidence/checkpoints/checkpoint-envelope.ts:178 createdAt:new Date().toISOString() 用localclock, 不同 TZ replay产物元data非确定 | `done` | Root cause:  review references的旧testing位置已经expiry; 当前 checkpoint envelope testingusesfixed时间戳样本, 不再dependencylocalclock.  |
| 172 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:138 PRAGMA journal_mode=WAL 不assertionreturn, NFS 等环境silentlyfallback delete | `done` | Root cause:  SQLite 初始化流程此前只“request WAL”不“confirmation WAL”, 把后端实际 journal mode 是否退化留给runtime偶发故障暴露.  |
| 173 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:134 busy_timeout allows 0, transient SQLITE_BUSY 与concurrentconflict | `done` | Root cause:  busy timeout configure只做了数值truncated, 没有建立最小正integer约束.  |
| 174 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283 Object.values(row) dependency wal_checkpoint column order, missing键名destructuring | `done` | Root cause:  WAL checkpoint 结果读取graph省事directly拿对象值array, 没有fixed绑定 SQLite return列名.  |
| 175 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:347-350 close() 不check wal_checkpoint busy>0, 存帧未flush即关 | `done` | Root cause:  close 只做 best-effort checkpoint, 没有把 busy 或未完全 checkpoint 视为explicitly关闭failure.  |
| 176 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:442-449 viaregex database is locked\\|busy 识别 BUSY, local化/errno 改即失效 | `done` | Root cause:  SQLite 写争用识别长期只dependency message text匹配, 没有优先消费 sqlite/errno 级别的error标识.  |
| 177 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-340 healthCheck 标 async 实onlysynchronoustransaction, misleadcall方 | `done` | Root cause:  SQLite health probe 复制了异步后端interfacesignature, 但内部实际一直走synchronous连接与synchronoustransaction.  |
| 178 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:455-465 applyCompatibleColumnMigrationIfKnown 命中后skip migration.sql, index/约束变更silently丢 | `done` | Root cause: compatibility迁移path之前missing少explicitly回归验证, 容易让人误以为“补列”branch不会补齐其余 DDL; 现已补 migration 11 的回归testing, confirmationcompatibilitybranch仍会创建补充表/index, 不再让这类担忧处于无证据state.  |
| 179 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:108,233 fetch 无 AbortController/timeout | `done` | Root cause:  review based on旧版本; 当前 provider 统一经 `fetchWithTimeout()`, 已接入 AbortController 与timeoutcleanup.  |
| 180 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:121-126,246-251 error体directly拼到 Error message, potentialloginjection | `done` | Root cause:  provider errorpathdirectly拼接上游response体, 没有做换行/length收敛.  |
| 181 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:137,259+ response.json() 无 try/catch | `done` | Root cause:  embedding provider default信任上游 JSON 结构, 没有隔离解析failure.  |
| 182 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:142-144 未validationreturn index range/duplicate, 序后映射假定一一对应 | `done` | Root cause: sort恢复结果时default信任 provider index 完整且无duplicate, 没有做边界validation.  |
| 183 | src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts:226 Buffer.from(payload,"base64") 不validationlength/MIME, corrupted payload decode empty buffer 不报错 | `done` | Root cause:  checkpoint payload decode只dependency Buffer 宽松行为, 没有做 base64 length与字符集约束.  |
| 184 | src/platform/five-plane-state-evidence/memory/trust-level-service.ts:384-385 用 content.includes("TODO/FIXME") 当trust leveldowngradebasis, 明显false positive | `done` | Root cause: 质量check把 TODO/FIXME 视作arbitrary子串, 而不是explicitlyplaceholder标记.  |
| 185 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-330 healthCheck 在transaction内 CREATE/DROP TEMP TABLE, rollback residual TEMP handle | `done` | Root cause:  health probe 早期用临时表写删来证明可写, 副作用验证压过了连接探活本身.  |
| 186 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283-290 checkpointWal 不distinguish busy>0 与 frames=0, ops无法识真实bottleneck | `done` | Root cause:  checkpoint return值之前被按位置array粗读, busy, log frames, checkpointed frames 没被稳定distinguish为independent信号.  |
| 187 | tests/integration/platform/state-evidence/dlq-persistence.test.ts:464 /tmp/dlq-persistence-test-${Date.now()}.db 不可portable Windows 且不在 finally cleanup | `done` | Root cause: file型persistencetesting最初按本机 `/tmp` 快速起草, 没有复用testing层统一的临时工作区与cleanup约束.  |
| 188 | tests/unit/platform/state-evidence/knowledge/knowledge-store.test.ts:17 /tmp/aa-sandbox/ktest_${suffix}_${Date.now()} concentratedpollute | `done` | Root cause: 知识快照testing把 Unix 临时目录常量写死在 helper 里, missing少based on `tmpdir()` 的平台无关拼接.  |
| 189 | tests/unit/platform/state-evidence/knowledge/p2-defects-sys-sec-4-2.test.ts:63,113 两处 /tmp/aa-sandbox/... 不cleanup | `done` | Root cause: 安全回归testing只关注pathallows/reject语义, 没有把产物生命周期纳入testing治理.  |
| 190 | tests/leaks/platform/state-evidence/events/durable-event-bus.leak.test.ts 阈值 10MB 同理且不区 RSS/heapUsed | `done` | Root cause: leakstesting最初只盯 heapUsed, 没把 RSS 与无 `--expose-gc` 运行环境分开建模.  |
| 191 | dashboard-projection-service.ts:110 system.health.changed not registered到 TypedEventType | `done` | Root cause:  review 没有吸收 typed-event-bus / event-registry 的subsequent补齐; 当前 `system.health.changed` 已注册.  |
| 192 | migrate-sqlite-to-pg.ts 列名/表名直拼 SQL, no whitelist (injectionrisk)  | `done` | Root cause: 迁移脚本早期default表名和列名都来自可信模式; 当前implementation已对表名做 allowlist, 对列名做标识符validation后再拼接.  |
| 193 | idempotency-key-storage.ts ${this.tableName} 直拼 SQL, construction期未validation | `done` | Root cause: 幂等键存储曾allows不受约束的自定义表名; 现已在construction边界forcevalidation安全 SQL 标识符并用结构化error fail-close.  |
| 194 | semantic-vector-store.ts process.env[name] 中 name 来自configure, can readarbitrary env | `done` | Root cause: 该条based on旧implementation快照; 现行 `semantic-vector-store.ts` 只读取fixed的 `AA_KNOWLEDGE_VECTOR_BACKEND` / `AA_KNOWLEDGE_SEMANTIC_BACKEND`, 不existsconfigure驱动的arbitrary env 读取.  |
| 195 | checkpoint-gc-service.ts fs.stat→fs.unlink TOCTOU window | `done` | Root cause:  GC 删除path先做exists性check再删除; 现已改为directly `lstat/open(O_NOFOLLOW)/fstat/unlink` 绑定对象identity, 并在 `ENOENT` 上幂等return.  |
| 196 | shadow-snapshot-service.ts lstat→rename 间exists symlink swap window | `done` | Root cause:  shadow snapshot 元data之前via临时file `rename()` coverage目标, `lstat` 与最终落点分离; 现已改为 `O_EXCL|O_NOFOLLOW` directly独占创建最终file并rejectduplicate snapshotId, 去掉了这条提升window.  |
| 197 | sqlite-database-wrapper.ts:94-114 savepoint 名直拼 exec, futurecall方可injection | `done` | Root cause:  PG compatibility wrapper 之前把 savepoint 名directlyinsert SQL; 现已把 savepoint 名收口到受约束生成器并按标识符references.  |
| 198 | sqlite-database.ts:143 PRAGMA busy_timeout = ${this.busyTimeoutMs} 拼 SQL, busyTimeoutMs 未做integervalidation | `done` | Root cause:  PRAGMA 值虽来自configure层, 但没有在data库边界再次验证为正integer, 留下了拼接型configureinjection面.  |
| 199 | pg-advisory-lock-adapter.ts 中 Number(result.fencing_token), sqlite-lock-adapter.ts:36 Number(result.lastInsertRowid) 超 2^53 precisionloss | `done` | Root cause: 该条对应的两个risk点已消失: PG 适配器现已做安全integerrangevalidation, SQLite lock适配器也不再dependency `lastInsertRowid` 生成 fencing token.  |
| 200 | checkpoint-gc-service.ts:171,557, learning-object-model.ts:180,184, risk-register.ts:87,110, invariant-registry.ts:137,165,180, responsibility-boundary.ts:158-308, admin-config-service.ts:66, outbox-repository.ts:117, memory-layer-model.ts:214,549, graphql-adapter-service.ts:294, conversation-template-service.ts:408, approval-policy-engine/version-manager.ts:111, stable-evidence-bundle-support.ts:612,616,732, dlq-service.ts:238, knowledge-snapshot-store.ts:25-48, semantic-vector-validation.ts:276, tool-gateway/index.ts:150,160, idempotency-key-storage.ts:310,338,341, cors.ts:49-68, reliability/timeout.ts:45,54 multiple places抛bare Error 而非结构化 AppError/ValidationError | `done` | Root cause: 平台子module长期各自directly抛原生 `Error`; 本批已把仍命中的现存path收口到 `ValidationError` / `StorageError` / typed error, 失效path也不再对应现行代码.  |
| 201 | .gitignore globally *.db-shm/*.db-wal 不exists, sqlite WAL residual可被 commit | `done` | Root cause: 旧 review based onexpiry `.gitignore` 快照; 当前仓库已explicitly忽略 `*.db-shm` 与 `*.db-wal`.  |

## src/platform/shared

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 202 | src/platform/stability/ 与 src/platform/shared/stability/ parallel同名目录implementation已divergence | `done` | Root cause: 稳定性能力曾同时保留 authoritative implementation和历史复制 facade; 现已把 reliability 子能力统一回收为对 top-level stability 的薄重导出.  |
| 203 | src/platform/shared/reliability/, shared/stability/reliability/, stability/reliability/ 三处reliabilityimplementationduplicate | `done` | Root cause:  reliability 目录重组后旧implementation没有彻底下线; 现行仓库已只保留单一implementation, shared/stability 侧only作 facade.  |
| 204 | src/platform/shared/observability/structured-logger.ts:484-491 每条 fsync log openSync+appendFileSync+fsyncSync+closeSync serialsynchronous IO | `done` | Root cause:  durable sink 先前每条log都重新打开file; 现已复用persistencefile描述符, 只在轮转时关闭并重开.  |
| 205 | src/platform/shared/observability/structured-logger.ts:153,180 sinkBaseDir=process.cwd(), runtime chdir 后语义drift | `done` | Root cause:  sink 根目录之前directly绑定 `process.cwd()`; 现已fixed到module初始化时解析的稳定绝对基目录, 并保留explicitly覆写entry.  |
| 206 | src/platform/shared/observability/structured-logger.ts:194 mkdirSync 无errorhandle, permissions不足时 configure directly抛 | `done` | Root cause:  logger 目录创建曾把filesystem异常外漏给call方; 现已捕获并降级为结构化内部error, 且禁用该 sink.  |
| 207 | src/platform/shared/observability/structured-logger.ts:262 retentionLimit=0 时 buffer length 0, 所有 log silently丢弃 | `done` | Root cause: 该条based on误判; 现implementation中 `retentionLimit=0` 只关闭in-memory保留, 不会阻断 file sink 与 transport output.  |
| 208 | src/platform/shared/outbox/outbox-poller-service.ts:193-197 retryCount>=maxRetries only failed++;continue, never投 DLQ | `done` | Root cause:  outbox poller 之前没有终态failure语义; 现已为超限record写入explicitly dead-letter 标记并从 pending 集合removal.  |
| 209 | src/platform/shared/outbox/outbox-poller-service.ts:188-217 for-await serialhandle, 无concurrentbatch发布 | `done` | Root cause:  outbox 发布循环最初按orderimplementation; 现已按可configure chunk concurrent发布, 并优先走 batch publish.  |
| 210 | src/platform/shared/observability/otel-tracer.ts & otel-bootstrap.ts 各自 loadOtelApi/loadOtelModules, OTel 加载两条path | `done` | Root cause:  OTel module探测逻辑之前分散在 tracer 与 bootstrap 两处; 现已提取到shared `otel-module-loader.ts` 单一entry.  |
| 211 | src/platform/shared/observability/structured-logger.ts:153 sinkBaseDir=process.cwd() 多 worker fork 后各持自身 cwd, pathinconsistent | `done` | Root cause: log sink 曾从各 worker 自己的 `cwd` 推导path; 现已统一锚定到启动期解析的绝对基目录.  |
| 212 | tests/unit/platform/shared/stability/stable-prompt-injection-red-team-additional.test.ts:82,97,111,129,145 5 处 /tmp/... 不可portable | `done` | Root cause: 稳定性附加testingdirectly手写 Unix 临时目录字符串, 没有复用统一testing工作区 helper.  |
| 213 | tests/unit/platform/shared/stability/stable-runtime-validator-additional.test.ts:30 /tmp/${caseId}.backup.db 跨 case 重名互coverage | `done` | Root cause:  baseline/backup path用 caseId directly拼到shared `/tmp`, missing少平台无关且具隔离前缀的临时path生成.  |
| 214 | graceful-shutdown.ts setImmediate(()=>process.exit()) 未 flush stdio | `done` | Root cause: 旧implementation确实只排到下一轮事件循环就退出; 当前path已explicitly等待 stdout/stderr flush 后再退出.  |
| 215 | slo-alerting-channels.ts 在 queueMicrotask 内做synchronousblocks I/O | `done` | Root cause: 该 review 结论停留在旧implementation快照; 当前 `slo-alerting-channels.ts` 已无 `queueMicrotask` wrapped的synchronousblocks I/O path.  |
| 216 | graceful-shutdown.ts:122 void this.handleSignal(signal) 无 .catch; shutdown error成为 unhandled rejection | `done` | Root cause: 信号监听器把异步 shutdown 启动成 fire-and-forget, 没有在监听器边界消费 rejection.  |

## src/platform/stability

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 217 | src/platform/stability/timeout.ts:82 successpath未 clearTimeout, setTimeout handleleaks | `done` | Root cause:  timeout wrapper 只把定时器当成 reject 触发器, 没有把success/failurepath上的handlecleanup建成explicitlystep.  |
| 218 | src/platform/stability/timeout.ts cancel() onlycanceltimer, 未via AbortSignal 传给被wrapped函数 | `done` | Root cause:  timeout/cancel 语义最初只修改wrapper器内部state, 没有把cancel信号传播给被execute异步task.  |
| 219 | src/platform/stability/retry.ts 与 stability/reliability/retry.ts 两份并存且strategydivergence | `done` | Root cause:  retry 之前同时在 top-level stability 与 reliability 子目录independent演化; 现已把 reliability 版本收口成对 authoritative retry 的重导出.  |

## src/platform/prompt-engine

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 220 | ha-repository-postgres.ts:22, coordinator-load-balancing-service.ts:78, prompt-engine/registry/index.ts:123, tight-loop-detector.ts:82,95, loop-detection.ts:97, semantic-embedding.ts:108, structured-logger.ts:851, prompt-injection-guard.ts:543, profile-home.ts:31 multiple places sha256 truncated到 32-64 位作为identity/cached键, collision概率高 | `done` | Root cause: 各module各自手写 `sha256(...).slice(...)`, 把短前缀directly拿去做identity键, cached键或sort偏置; 现已统一改为shared `sha256` helper, 普通标识扩到 32 hex, PG advisory lock 改为based on完整 digest 的 63-bit fold, 不再dependency脆弱的前缀truncated.  |
| 221 | prompt-engine/registry/index.ts:114 listVersions 用 localeCompare sort, "10" lexicographic order排在 "2" 前 | `done` | Root cause: 模板版本sort先前沿用字符串比较; 现已切到数值化版本段比较.  |
| 222 | prompt-engine/registry/index.ts:117-119 listTemplates() full flat-map 无pagination | `done` | Root cause: 模板枚举interface之前只提供full拉取; 现已支持 `offset/limit` pagination参数并保持稳定sort.  |
| 223 | prompt-engine/registry/index.ts:81-86 version_conflict check后两阶段写入无rollback, partialfailureremaining映射 | `done` | Root cause: 注册逻辑之前directly原地复用旧版本映射; 现已先克隆再替换, 消除了中途写坏shared map 的window.  |
| 224 | prompt-engine/eval/quality-config-loader.ts:24-35 schema missing qualityScoreWeights 求和≈1 与 completeMinScore>approvalRequiredScore 的 .refine | `done` | Root cause: 质量configure schema 之前只validation单fieldrange; 现已补 cross-field refine 约束.  |
| 225 | prompt-engine/eval/quality-config-loader.ts:101-105 zod validationfailure被吞为通用 throw, 非结构化 AppError | `done` | Root cause: 质量configure加载器之前directly透传 Zod 异常; 现已转换为带 issue 明细的 `ValidationError`.  |
| 226 | prompt-engine/eval/llm-eval-service.ts:633 logger.warn 含 raw suite.cases payload, PII/prompt contentleaked | `done` | Root cause: 该条based on旧implementation判断; 现行 `parseCases()` 警告log只record `suiteId` 与error消息, 不回写原始 `suite.cases`.  |
| 227 | prompt-engine/eval/prompt-model-policy-governance-service.ts:584 JSON.parse(release.metadata) 无 zod validation | `done` | Root cause:  release metadata 之前被directly `JSON.parse` 后uses; 现已改成受限field解析并在格式异常时 fail-close.  |
| 228 | prompt-registry/index.ts:1-30 30 行纯重出口 shim, violates单一来源 | `done` | Root cause:  prompt-registry 之前只是薄重导出; 现已提升为带 `createPromptRegistryServices()` 的 canonical namespace entry, 不再是纯 shim.  |
| 229 | prompt-engine/conversation-template-config-loader.ts:35 JSON.parse(content) 无sizeupper limit, configurefile OOM | `done` | Root cause: 会话模板configure之前读全file后directly解析; 现已在解析前增加尺寸upper limit并在 schema failure时return结构化error.  |
| 230 | template-registry/index.ts 两处 @ts-expect-error | `done` | Root cause: 该条对应的file/语句已不exists于现行仓库; 当前search结果中没有 `template-registry/index.ts` 的 `@ts-expect-error` residual.  |

## src/platform/contracts & types

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 231 | client-sdk/api-client.ts:984-992 declare module ".../executable-contracts/index.js" moduleaugmentation会globallypollute ContractEnvelope.principal | `done` | Root cause:  client SDK 之前viamoduleaugmentation把 `principal` pollute到globally `ContractEnvelope`; 现已改为 SDK 内部局部扩展type.  |
| 232 | entire repotesting代码中的 `assert.ok(true)` placeholderassertion已清零; 本轮补齐了 SDK 握手, API WebSocket 关闭path, panic scope, region failover listener, CDC/backpressure, outbox/VCR/sqlite repository, repo map/cache, memory/harness, pg advisory lock 等剩余用例. 当前 `rg -n "assert\\.ok\\(true\\)" tests -g '*.test.ts'` only会命中一条历史说明comment, 不再命中真实placeholderassertion.  | `done` | Root cause: 早期batch补testing时把“能跑通/不抛异常”directly固化成placeholderassertion, 同时missing少禁止空assertion的 lint/CI 门禁; 本次已把剩余placeholder全部替换为真实stateassertion, 参数捕获, cached/timer内部statevalidation, error码assertion和persistence副作用validation, 问题已收口.  |
| 233 | contracts/types/responsibility-boundary.ts:316-326 在"types"file内放 GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE singletonruntime态 | `done` | Root cause: 责任边界typefile历史上混入了运行态singleton; 现已把globally实例迁到independent `contracts/responsibility-boundary-service.ts`.  |
| 234 | contracts/types/responsibility-boundary.ts:302,306 热path每call new Set | `done` | Root cause: 责任边界validation曾在每次call时临时创建动作集合; 现已提升为module-level常量集合复用.  |
| 235 | contracts/types/domain/billing-types.ts:68 summaryJson:string opaque blob 无 zod | `done` | Root cause:  billing invoice summary 之前只是bare JSON 字符串; 现已补 `BillingInvoiceSummarySchema` 与 parse/stringify helper, 把 summary 至少收口到结构化 JSON object.  |
| 236 | contracts/types/domain/billing-types.ts:63,95,177 currency:"USD" 三处literal, type上禁multi-currency | `done` | Root cause:  billing 域type把币种写死成字符串literal量; 现已提取为 `BillingCurrencyCode`, 不再从type层阻断multi-currency扩展.  |
| 237 | contracts/types/domain/billing-types.ts:122-129 executionId/stepId 标 @deprecated 仍 required, 无removalplan | `done` | Root cause:  usage event 同时保留 deprecated field又仍要求必填; 现已降为 optional, 让 canonical `harnessRunId/nodeRunId/attemptId` 成为主path.  |
| 238 | contracts/types/domain/index.ts:1-249 100+ symbols手maintained, 非 export *, 新type必致drift | `done` | Root cause:  domain barrel 之前靠手写大清单maintained; 现已改为按子module `export type *` 收口, 新增type不再手工synchronous.  |
| 239 | contracts/types/index.ts:191 跨入 executable-contracts/index.js re-export, bypass domain naming空间 | `done` | Root cause: 顶层 `types/index.ts` 曾把 executable-contracts typedirectly横向暴露; 现已removal该跨层 re-export, 避免绕开 domain/contracts 分层.  |
| 240 | contracts/mission/{playbook,index}.ts:373/357 两份 stableStringify independentimplementation, 可能drift | `done` | Root cause:  mission 与 playbook 各自maintained序列化 helper; 现已抽到shared `contracts/mission/stable-stringify.ts` 单一implementation.  |
| 241 | mission/index.ts 1637 行单filetoo large | `done` | Root cause: 该条based on旧快照; 现行 `mission/index.ts` 已降到约 377 行, 不再是超大单file.  |
| 242 | data-classification-service.ts:680, network-egress-audit.ts:335, auto-stop-loss-service.ts:65-71, panic-propagation-service.ts:119-123, war-room-coordinator.ts:93-94, policy-engine.ts:83, takeover-escalation-manager.ts:46,49, approval-flow-engine.ts:571, approval-policy-engine/version-manager.ts:443, mission/index.ts:685, config-audit-service.ts:319,824, provider-health-tracker.ts:55, task-timeline-service.ts:181 multiple places push 类in-memoryunbounded growth | `done` | Root cause: multiple placesControl Plane服务把审计/生命周期/会话历史长期保existsin-memoryarray或 Map 中, 却missing少统一 retention/eviction strategy; 现已为 classification audit, egress audit, panic directive, war room, approval/takeover escalation history, policy version history, mission lifecycle, config audit 增加有界保留与autocleanup. 另有partialreferences来自旧快照, `auto-stop-loss`, `policy-engine`, `provider-health-tracker`, `task-timeline` 当前版本已分别具备容量upper limit, cachedupper limit或only为request级临时聚合, 不再构成无界常驻增长.  |

## src/platform/model-gateway

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 243 | model-gateway/provider-registry/base-chat-provider.ts:260-273 POST 无 signal/timeout; response.text() 无sizeupper limit | `done` | Root cause: 基础 provider 之前把request控制field和传输层implementation耦在一起, 只做bare `fetch` 且directly `response.text()` 读fullerror体; 现已补runtimetimeout/abort signal 组合, error体字节upper limit与truncated标记.  |
| 244 | model-gateway/provider-registry/unified-chat-provider.ts:803-811 setTimeout(controller.abort) 未 unref; addEventListener("abort") 无对称 remove, listener leaks | `done` | Root cause: 统一 provider 的timeout signal 只负责触发 abort, 没有回收 timeout handle和上游 listener; 现已 `unref()` 定时器并在 abort 后对称removal监听.  |
| 245 | model-gateway/provider-registry/base-chat-provider.ts:189-198 defaultRetryableCodes hardcoded无 config/per-tenant injection | `done` | Root cause: default重试码之前散落在基类construction器literal量里; 现已收口到 config-center default常量, 并支持constructionconfigure与request级 override injection, 不再写死在implementation行内.  |
| 246 | provider-defaults.ts 顶层 const hardcoded 7+ 第三方 API URL | `done` | Root cause:  provider URL 之前以离散常量directlyhardcoded, missing少统一目录和环境coverageentry; 现已改为受validation的default目录 `PROVIDER_DEFAULT_URLS` 与 `resolveProviderDefaultUrl()`, default manual billing 地址也移出被strategy拦截的 `.local` 内网域.  |

## src/platform/cost-management

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 247 | cost-management/index.ts:31-37 同名 CostEstimate 既是type别名又是 Symbol, import 歧义 | `done` | Root cause:  cost-management barrel 之前把 contract type 和runtime token 复用同一导出名; 现已把runtimesymbols改为 `*Token` naming, 消除了 TS/JS 导入歧义.  |
| 248 | cost-management/index.ts:26 平台module跨入 scale-ecosystem/billing/cost-estimation-service.js | `done` | Root cause: 平台层 cost-management 之前directly重导出 scale-ecosystem implementation, 破坏平台naming空间分层; 现已引入local `platform/cost-management/cost-estimation-service.ts`, onlydependency平台 contract 与 state-evidence data库端口.  |

## src/platform/compliance

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 249 | compliance/encryption/index.ts:91-93 deriveEncryptionKey only sha256(keyRef), 无 KDF/salt/per-record key | `done` | Root cause: field加密此前把 `keyRef` 的 sha256 directly当 AES key 用; 现已切换到 `scryptSync` + 16-byte per-record salt 派生 32-byte key.  |
| 250 | compliance/encryption/index.ts:113-172 writeField/tokenizeFieldPath 不黑名单 **proto**/constructor, 原型pollute | `done` | Root cause: fieldpath tokenizer 之前acceptsarbitrary属性 token; 现已explicitlyreject `__proto__`, `prototype`, `constructor` 并对空path fail-close.  |
| 251 | compliance/encryption/index.ts:84 密文用 enc:fingerprint:iv:authTag:ciphertext 冒号分隔, future keyRef 含冒号即解析failure | `done` | Root cause: 密文 envelope 之前dependency脆弱的冒号分段协议; 现已升级为 `encv1.<base64url-json>` 版本化结构化 envelope, 消除了分隔符conflict.  |
| 252 | compliance/encryption/index.ts:65 Buffer.from(ivHex!,"hex") 非空assertion; 非 hex 输入 Buffer silentlytruncated不抛 | `done` | Root cause:  reveal path之前靠非空assertion和宽松 `Buffer.from(..., "hex")` decode; 现已改为 envelope 结构validation + strict base64url decode, 不再acceptscorruptedfieldsilently下沉.  |
| 253 | compliance/erasure/index.ts:43,32-66 用 Date.parse + slaHours*hour 算 dueAt (localclock) ; createPlan 不persistence | `done` | Root cause: 擦除规划服务之前directly从 `nowIso()` 字符串反解析时间并只returntransient plan; 现已支持injectionclock, based on `Date#getTime()` 计算 SLA 截止时间, 并为创建的 plan 提供defaultin-memory store, `getPlan()` 与 `listPlans()` 持久可见性.  |
| 254 | governance-compliance/web referenceserror CSS 变量 --color-text | `done` | Root cause: 该条based on旧 UI 片段; 现行 `governance-compliance` Web 视graph已uses正确的 `--aa-color-text` 变量, 没有residualerror token.  |
| 255 | governance-compliance/analytics 的 subPages 声明页面未implementation | `done` | Root cause: 该条对应的 `subPages` 声明已不在现行 feature module 中; 当前 `analytics` 与 `governance-compliance` module均未声明未implementation的 subpage 路由, 属于expiry review.  |

## src/platform/integration & connectors

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 256 | integration/connector-framework-service.ts:62-194 5 Map+2 LRU in-memory, storageDir 多数 caller 传 null; LRU partialremoval"故意不更新位置"violates语义 | `done` | Root cause:  connector framework 之前把 manifest/instance/breaker 注册态长期留在in-memory且无总量upper limit, 同时 bindings/health 的 LRU 只在写path刷新, 读访问不会更新最近usesorder; 现已为 connector 注册态增加 `maxConnectors` 容量控制, 并把 bindings/health 的访问刷新与加载裁剪补齐.  |
| 257 | integration/connector-framework-service.ts:144-156 eviction循环含"无进展即 break"placeholder逻辑掩盖真实 bug | `done` | Root cause:  bindings eviction逻辑之前dependency“无进展就 break”的placeholder防死循环branch; 现已改为 `evictLRUBindings()` return实际删除数, 若删除为 0 directly抛explicitly invariant error, 不再silently吞掉eviction异常.  |
| 258 | integration/connector-framework-service.ts:289-332 failed state短路在 circuit breaker 之前, breaker 不递增; success===false 被转 throw, 导致 breaker 双计 | `done` | Root cause: executepath之前把 health-failed directly短路到 breaker 之外, 同时把 `success=false` 结果masks成异常抛回 breaker; 现已让 failed health 经过 breaker 记一次failure, 而逻辑性failure结果不再人为二次抛错.  |
| 259 | integration/connector-framework-service.ts:392-414 provider 名规范化 servicenow/service-now/service_now 与 github size写inconsistent | `done` | Root cause: 内建 connector 装配逻辑之前在 `switch` 里散落 provider 字符串变体; 现已收口到 `normalizeConnectorProvider()`, 统一 canonicalize size写, 空白, 下划线和 `service-now` 变体.  |
| 260 | integration/connector-framework-service.ts:494-509 每次 register/bind/recordHealth full序列化 3 个 Map 写盘, 无 batching/debounce | `done` | Root cause:  connector framework 之前任何一次 manifest/binding/health 变更都会把三个集合全部重写落盘; 现已按变更域分别persistence manifest, binding, health, 消除了每次写三份full JSON 的放大开销.  |
| 261 | integration/connector-framework-service.ts:115-121 duplicate register 相同 connectorId silentlycoverage无事件 | `done` | Root cause: 注册逻辑此前对duplicate `connectorId` directly `Map#set` coverage; 现已改为explicitlythrows `connector_framework.duplicate_connector_id`.  |
| 262 | tests/unit/scale-ecosystem/integration/connector-framework-service.test.ts:513 /tmp/connector-framework-test-${Date.now()} 不cleanup | `done` | Root cause: 该单测之前手写 `/tmp` path并自己做目录cleanup; 现已切换到统一 `createTempWorkspace()/cleanupPath()` helper.  |
| 263 | test:pg-integration glob 永远匹配空目录 | `done` | Root cause: 该条based on旧脚本; 当前 `package.json` 的 `test:pg-integration` 已directly指向 `tests/integration/platform/state-evidence/truth/postgres-fencing-token-service.test.ts`, 不exists空 glob.  |
| 264 | unit 目录下大量 spawn 子process的testing, 应在 integration | `done` | Root cause: 该条混入了false positive: 当前命中的大量 `fork()` 是 SDK/PluginContext 的对象方法, 不是 `node:child_process` 子process; 少量 `execSync` 也只是仓库环境探测辅助, 不属于跨process集成testing主体.  |
| 265 | connector-runtime/index.ts:47 对 caller-supplied callback URL only AbortSignal.timeout(10_000), 无 SSRF 白名单 | `done` | Root cause:  callback 解析之前只validation协议, loopback 与无凭据 URL, 没有explicitly allowlist; 现已要求非 loopback 的 `https` callback 主机必须命中 `AA_CONNECTOR_CALLBACK_ALLOWED_HOSTS` 白名单.  |

## src/platform/agent-delegation & harness

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 266 | agent-delegation/delegation-manager.service.ts:847, delegation-manager-support.ts:104, hitl-operator-console-service.ts:63 Promise.all(...) 单点failure导致整体 abort, 无 per-item fallback | `done` | Root cause: 仓储 fan-out 与 HITL notification fan-out 之前default所有后端都可靠可用; 现已改为 `Promise.allSettled()`, 单个statequery或单条notificationfailure不会拖垮整批结果.  |
| 267 | harness/loop/index.ts:91, harness/recovery-controller.ts:39 backoff jitter 用 Math.random(), 破坏可复现 | `done` | Root cause:  harness backoffimplementation沿用了随机 jitter, 而不是based on运行上下文的确定性抖动; 现已改成由 run/attempt 派生的 deterministic jitter, replay与testing结果可复现.  |
| 268 | harness/hitl-runtime.ts:71,465 30 天 TTL 双literal量, 无单一来源 | `done` | Root cause:  HITL request 与责任record分别各自手写 30 天expiry值; 现已统一复用 `requestTtlMs` 和 `computeExpiryIso()`.  |
| 269 | harness/memory-manager.ts:34,168 shared:1000 与 30*60*1000 LRU windowhardcoded, 无 config | `done` | Root cause:  harness memory tier 容量与降级空闲window长期写死在module常量里; 现已暴露 `HarnessMemoryManagerOptions`, 支持coverage tier upper limit和 demotion idle window.  |
| 270 | harness-decision-manager.ts:186 用comment代替interface约束 | `done` | Root cause:  decision evidence persistence之前拿到了 canonical input bundle 却只用comment压掉未消费field; 现已把 bundle 的关键结构信息写入 evidence content/metadata, 不再靠comment假装绑定interface.  |
| 271 | contracts/execution-receipt/index.ts:64-67, harness-decision-manager.ts:185, quorum-calculator.ts:249, sub-workflow-executor.ts:731, assessment-service.ts:141, pack-routes.ts:107,121,143,182, incident-routes.ts:150, risk-evaluation-port.ts:26, inter-plane-contract-gateway.ts:332 multiple places void param; 丢弃声明dependency的参数, tenant/principal 鉴权事实上被bypass | `done` | Root cause: multiple placescompatibilityentry把“先拿到上下文再决定是否消费”演化成了directly `void` 掉输入, 最危险的是 pack/incident API 已做鉴权却没有把tenant边界真正下沉到服务层; 现已把 pack 路由收口为globallytenant禁入, incident 服务与路由改成explicitly按 tenant filter/更新, 并让 legacy receipt, quorum 与 risk evaluation 至少对入参做一致性validation, 不再accepts名义上重要, 实际上被丢弃的参数.  |

## src/platform/improve-rollout & learn

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 272 | learn/llm-improvement-generation-service.ts:162 createdAt: String(Date.now()) 用十进制 ms 字符串, 与 sibling ISO inconsistent | `done` | Root cause:  improvement generation 之前混用了 epoch-ms 字符串和平台主流的 ISO 时间戳; 现已统一写 ISO.  |
| 273 | learn/learning-artifact-model.ts:70-78 dynamic await import("node:crypto") 双载, 且 fallback only哈希 objectId 不哈希content | `done` | Root cause:  artifact checksum 之前把 crypto 导入和content哈希做成了脆弱 fallback; 现已改为static引入 `createHash()` 并始终对 artifact content本身做 SHA-256.  |
| 274 | improve-rollout/improvement-candidate-registry.ts:93,140,147 用 Date.now() 跟踪 candidate TTL, 跨副本evictionclockdrift | `done` | Root cause:  candidate TTL 之前额外maintained了一份local `Date.now()` 元data, 和 candidate 自身 `createdAt` 脱钩; 现已改为based on候选record的 `createdAt` 计算 TTL, 并支持injectionclock.  |
| 275 | improve-rollout/rollout/rollout-state-machine.ts:71 transitionedAt: Date.now() 数字 vs types/rollout-record.ts:143 字符串混用 | `done` | Root cause:  rollout state machine 在staterecord里继续写数字时间戳, 而合同模型已经切到字符串时间; 现已统一output ISO 字符串.  |

## src/platform/intelligence & PMF

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 276 | intelligence/perception-service.ts:250-257 parseJsonArray silently JSON parse failurereturn [], 掩盖corrupteddata | `done` | Root cause:  perception export 之前把corrupted的 JSON field当空array吞掉; 现已改为explicitly抛 `ValidationError`, 对坏data fail-close.  |
| 277 | intelligence/perception-service.ts:310-312 :memory: path下产物落 dirname(":memory:")/artifacts, pollute工作目录 | `done` | Root cause:  perception service default把 artifact 根目录从 `db.filePath` 推导, 即使 filePath 是 `:memory:`; 现已对in-memorydata库切到system临时目录.  |
| 278 | intelligence/perception-service.ts:262-292 buildBriefMarkdown 不 escape \|/</反引号, feed data可injection markdown/exfil graph片 | `done` | Root cause:  Markdown 导出directly内联 source/title/rawRef 等外部字符串; 现已补齐反斜杠, 反引号, 竖线和 `<` 的转义.  |
| 279 | intelligence/perception-service.ts:646-666, pmf-validation-service.ts:500-518 divisionId:"system_admin"/"system" 魔术 division, 与 division-catalog.json 无validation | `done` | Root cause: 内部placeholdertask早期directly写了历史remaining的 `system_admin/system` division; 现已统一改成目录内exists的 `operations` 分工.  |
| 280 | intelligence/pmf-validation-service.ts:496-518,594-614 check后insertexistsconcurrent竞态; selectRow 把未知列加进 T 结果 | `done` | Root cause:  PMF placeholdertask之前走 check-then-insert, `selectRow()` 还会把query里多余列偷偷塞回泛型结果; 现已改成 `INSERT OR IGNORE`, 并且只回填 defaults 已声明的键.  |
| 281 | intelligence/pmf-validation-service.ts:155-162 listHistory(limit=20) upper limit不限可 OOM | `done` | Root cause:  PMF 历史列表之前directly信任call方传入的 limit; 现已做 1..500 的硬upper limit收口.  |
| 282 | intelligence/perception-service-async.ts:1-83 双方法并存且全用 Parameters<...>[0] 内联type, sync signature变更silently破坏 async | `done` | Root cause:  async wrapper 之前把所有参数和return值都写成内联 `Parameters/ReturnType`; 现已切到explicitly输入/outputtype导入, 避免 sync signaturedrift时silently破坏.  |

## src/platform/resource-manager

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 283 | resource-manager/resource-pool-service.ts:13-50 failureRateThreshold:0.3/minSampleSize:20 用 .default() 内联, 无 config 覆写; 池/分配 in-memory 无persistence | `done` | Root cause:  resource pool default阈值长期埋在 schema `.default()` 里, 且服务实例没有任何statepersistenceinterface; 现已支持服务级defaultconfigure与可选 state store.  |
| 284 | resource-manager/resource-pool-service.ts:74-150 分配无 CAS (worker_threads/cluster unsafe) ; 隔离无去抖; 恢复无 cooldown/审计; error信息mislead | `done` | Root cause: 该条把“process内资源池”与“跨processshared CAS”混在了一起; 当前服务仍是单processin-memory模型, 但真实missing口的隔离抖动和恢复 cooldown 已补齐, 并把statepersistence口留出来, 避免隔离state来回抖动.  |
| 285 | resource-manager/fair-scheduling-service.ts:70 饥饿截止 15*60_000 hardcoded | `done` | Root cause:  fair scheduling 之前把 starvation threshold 写死在implementation里; 现已支持constructionconfigure.  |
| 286 | resource-manager/fair-scheduling-service.ts:114-145 配额超限但 quorum 降级时return passed:true; budget tenant 不匹配return remaining=Infinity silently放过 | `done` | Root cause: 公平调度之前把“quorum 未满足”error地做成配额放行, 同时把 tenant 不匹配 promotion budget 当作无限预算; 现已保留 `quota_exceeded` 信号, 并对tenant不匹配explicitlyreject.  |
| 287 | tests/unit/scale-ecosystem/resource-manager/quota-enforcer-stateful-r13.test.ts:13 写死 /private/tmp/... only macOS path | `done` | Root cause: state化 quota testing之前directly把临时statefile写死到 `/private/tmp`; 现已改为 `tmpdir()` 拼接.  |

## src/platform/architecture & risk

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 288 | architecture/risk-register.ts:20-77,30-72 only 4 risk项且 reviewAfter:"2026-07-01" 全部相同hardcoded | `done` | Root cause: risk台账之前只保留了最早四条基线risk, 并把 review date 统一hardcoded成同一天; 现已扩充risk项并按risk类别split reviewAfter.  |

## src/platform/remote-coordination

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 289 | src/platform/remote-coordination/index.ts:1-2 同时 export * as session 与 export * 自同module, naming空间双导出歧义 | `done` | Root cause:  remote-coordination barrel 同时暴露naming空间导出和扁平导出, 制造了duplicateentry; 现已去掉duplicate的 `export * as session`.  |

## src/platform/structure

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 290 | src/platform/structure/index.ts silently吞错 + 不合理的 Deno 探测 | `done` | Root cause: 该条based on旧file快照; 当前 `src/platform/structure/index.ts` 已不含 Deno 探测, 也没有silently吞掉目录读取异常.  |
| 291 | src/platform/structure/index.ts:249 require("node:fs") 与 ESM Deno.readDirSync 双path混用 | `done` | Root cause: 该条同样来自expiryimplementation; 现行file只uses Node ESM `node:fs` API, 没有 `require()`/`Deno.readDirSync` 混用.  |

## src/platform other

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 292 | src/platform/contracts/*/index.ts 5 个合同filehardcoded docs.example.com/api.example.com placeholder URL, 被打入runtimeerror信息 | `done` | Root cause: 该条based on旧合同文案; 当前 `src/platform/contracts/*/index.ts` 已无这些placeholder域名落入runtimeerrorpath.  |
| 293 | src/platform/ops-maturity/index.ts 与顶层 src/ops-maturity/ 同名共存 | `done` | Root cause:  review record的 `src/platform/ops-maturity/index.ts` 在现行仓库里已不exists, 只剩明确的子modulepath和顶层 `src/ops-maturity/`.  |
| 294 | src/platform/ 目录越权: exists 10 个 AGENTS.md 未authorization的子目录 | `done` | Root cause: 该条based onexpiry目录扫描; 当前 `src/platform/` 下不exists这些越权 `AGENTS.md` 子目录.  |
| 295 | release-pipeline.ts 与 deployment-execution.ts hardcoded GitHub Actions URL, 且literal量duplicate | `done` | Root cause: 两个 CLI entry各自内联了同一条 GitHub Actions run URL 前缀; 现已抽成shared helper.  |
| 296 | deployment-execution-service.ts:178-179, channel-gateway-service.ts:158-161 子process/request buffer 累积无字节upper limit, OOM risk | `done` | Root cause:  deployment command runner 已有outputupper limit, 但 channel gateway 的 pooled fetch 之前会无界累积response body; 现已补齐 response byte cap.  |

## ui/apps/web (shell, vite, sw)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 297 | ui/apps/web/src/main.tsx:11 if(rootElement!=null) missing #root 时silently no-op, 应抛/告警 | `done` | Root cause:  Web entry之前在找不到 `#root` 时directly no-op; 现已record telemetry 并抛错 fail-close.  |
| 298 | ui/apps/web/src/main.tsx:8-9 createWebRuntimeClients 在 <GlobalErrorBoundary> 挂载前execute, 初始化错bypass fallback UI | `done` | Root cause:  runtime bootstrap 之前在根渲染前就execute; 现已移入 `GlobalErrorBoundary` wrapped下的 bootstrap 组件.  |
| 299 | ui/apps/web/src/main.tsx:8 VITE_AUTH_TOKEN 经 import.meta.env 读, 被 Vite 烘焙进公共 bundle leaks | `done` | Root cause: entryconfigure之前directly从 `import.meta.env` 读取 auth token; 现已改为从runtime `<meta name=\"aa-auth-token\">` 读取, 不再把 token 烘焙进 bundle.  |
| 300 | ui/apps/web/src/runtime.ts:84 constructOrCall 用 "mock" in factory 启发式判定, 含static mock field的真 class 误路由 | `done` | Root cause:  runtime factory 之前拿 `\"mock\" in factory` 当成construction/call分流信号; 现已改为 `Reflect.construct()` 尝试construction, failure再fallback普通call.  |
| 301 | ui/apps/web/src/runtime.ts:122-130 seedTokenManager hardcoded expiresAt=Date.now()+3600_000 忽略真实 JWT TTL | `done` | Root cause:  review 对应的是旧版 bootstrap token 逻辑; 当前implementation已在可解析 JWT 时读取 `exp`, 解析failure才退回explicitly bootstrap sentinel expiry值.  |
| 302 | ui/apps/web/src/runtime.ts:163 module顶层referencesglobally WebSocket, Node/SSR/无 stub jsdom 即崩 | `done` | Root cause: 该条based on旧implementation; 现行 `runtime.ts` 只在 `createWebRuntimeClients()` 内按 `typeof WebSocket` branch, 不existsmodule顶层directly取globally `WebSocket`.  |
| 303 | ui/apps/web/src/runtime.ts:181-206 registerWebServiceWorker 无 try/catch, reject时变 unhandled rejection | `done` | Root cause:  service worker 注册failure之前完全dependencycall方兜底; 现已在注册函数内部record telemetry 并 rethrow.  |
| 304 | ui/apps/web/src/runtime.ts:148 与其他 transport fallbackToMock default true inconsistent, 生产 transport error时silentlyreturn mock data | `done` | Root cause: 该条based on旧configure假设; 当前 Web runtime 明确把 `HttpTransport.fallbackToMock` 设为 `false`, 不existssilently mock fallback.  |
| 305 | ui/apps/web/src/feature-registry.ts:30-33 深path ../../../packages/features/*/src/index bypass workspace alias, 包结构变即坏 | `done` | Root cause: 该条来自expiry registry 快照; 现行 `feature-registry.ts` 已统一用 `@aa/feature-*` workspace alias.  |
| 306 | ui/apps/web/src/app-shell.tsx:~356 effectiveAuthContext 每次渲染新对象 identity, memo 消费方多余重渲 | `done` | Root cause:  `effectiveAuthContext` 之前每次 render 都重新construction对象; 现已用 `useMemo()` 稳定 identity.  |
| 307 | ui/apps/web/src/global-error-boundary.tsx:14-19 componentDidCatch only console.error, 无 telemetry, stack 丢弃 | `done` | Root cause: 该条同样based on旧版 Web boundary; 当前implementation早已via `reportUiError()` 上报 component stack.  |
| 308 | ui/apps/web/src/global-error-boundary.tsx fallback 无 retry 按钮, 单错lock全 app | `done` | Root cause: globallyerror边界之前只有static fallback; 现已增加 retry 按钮allows重新尝试渲染.  |
| 309 | ui/apps/web/src/app-shell.tsx:222-230 useMemo 出现在 L219 早期 return 之后, violates React hooks 必须无条件call规则 | `done` | Root cause: 该条based on旧结构; 现行 `app-shell.tsx` 的 hooks call不再位于条件 return 之后.  |
| 310 | ui/apps/web/src/app-shell.tsx:356-366 effectiveAuthContext default permissions:["authenticated"], 未提供 authContext 时全 feature 放行 — 鉴权后门 | `done` | Root cause:  shell 之前default把未explicitly鉴权的会话视为已认证; 现已改为优先usesexplicitly/URL auth, 上述信息都没有时default未认证.  |
| 311 | ui/apps/web/src/app-shell.tsx:330 通配 path="*" 无 404 页面, 未知 URL silently渲染 features[0] 跑其guard | `done` | Root cause: 通配路由之前把未知path强行导向首个 feature; 现已改成explicitly 404 fallback.  |
| 312 | ui/apps/web/src/app-shell.tsx:368-372 useEffect setPhase("idle") only切换两态, render branch立即被coverage, phase state死代码 | `done` | Root cause:  shell phase 之前只有 `render/idle` 两态且branch没有真实差异; 现已收口成 `booting/ready` 的有效state机.  |
| 313 | ui/apps/web/src/app-shell.tsx:316-338 phase==="render"\|\|phase==="idle" 判断恒真, else neverexecute | `done` | Root cause: 原来的 phase 条件把两个可能值都判成真, 准备态branch永远走不到; 现已改成 `phase === "ready"`.  |
| 314 | ui/apps/web/src/app-shell.tsx:308 startupBanner 背景hardcoded #12201a 不随主题切换 | `done` | Root cause: 该条based on旧 UI 片段; 当前 startup banner 已uses `designTokens.color.accent` 及其透明度派生色.  |
| 315 | ui/apps/web/src/app-shell.tsx:99-105 navigate(-1) 用 window.history.length>1, length 含跨域条目, 可能后退到外站 | `done` | Root cause: 访问rejectreturn按钮之前只看 `history.length`; 现已要求 referrer 与当前 origin 同源, 否则directlyfallback到安全 fallbackPath.  |
| 316 | ui/apps/web/src/app-shell.tsx:148 error边界 "Report Issue" only console.error, 按钮无副作用 placebo UI | `done` | Root cause: 该条对应的旧按钮implementation只做local打印; 当前 `Report Issue` 已call `reportUiError()` 带上 retryKey 等上下文.  |
| 317 | ui/apps/web/src/app-shell.tsx:133 error fallback directly渲染 error.message, 可能含敏感栈/PII | `done` | Root cause:  feature 级error边界之前把原始 `error.message` 暴露给最终user; 现已改为通用文案.  |
| 318 | ui/apps/web/src/app-shell.tsx:184-206 FeatureContent 同时渲染 feature.Component 与 activeSubPage.Component, 无 <Routes> only按 location 字符串匹配, 父+子页双渲染 | `done` | Root cause:  feature shell 之前对带 subpage 的module总是父页和子页一起渲染; 现已改为 overview/subpage 二选一显示.  |
| 319 | ui/apps/web/src/app-shell.tsx:159 重试用 Fragment key=retryKey force重挂, 含module-level singleton 子树不会真reset | `done` | Root cause: 该条把 React 子树重挂与module-level singleton 语义混为一谈; 当前implementation的 retry 仍然负责重挂 React 树, 而module-level singleton 不属于该边界能够也不应该reset的range.  |
| 320 | ui/apps/web/src/app-shell.tsx:268 顶级 grid gridTemplateColumns:"280px 1fr" hardcoded, 无response式断点 | `done` | Root cause:  shell 根布局之前永远usesfixed双栏; 现已按窄屏/宽屏切换列模板.  |
| 321 | ui/apps/web/src/app-shell.tsx:274,187 多 nav 嵌套但only最外层 nav 有 aria-label, duplicate nav landmark 干扰屏阅读 | `done` | Root cause: 主导航和子页导航之前没有各自independent label; 现已分别补上 `aria-label`.  |
| 322 | ui/apps/web/src/app-shell.tsx:62 normalizePath only去尾斜杠, 不handle多重斜杠/.//../, malicious URL bypass匹配 | `done` | Root cause: path规范化之前只做了去尾斜杠; 现已按 segment 级别折叠空段, `.` 和 `..`.  |
| 323 | ui/apps/web/src/feature-registry.ts:30-33 4 处 ../../../packages/features/*/src/index 深pathbypass alias (feature-flags/memory-review/release-console/trace-explorer 仍hardcoded)  | `done` | Root cause: 该条也是旧版 registry residual; 当前四个 feature 都已via `@aa/feature-*` alias 导入.  |
| 324 | ui/apps/web/src/feature-registry.ts:36-39 missionControlFeatureContracts 导出但 featureRegistry 未消费, 死合约 | `done` | Root cause:  review references的 `missionControlFeatureContracts` 导出在现行file里已不exists, 不再有死合约residual.  |
| 325 | ui/apps/web/src/feature-registry.ts:77 LazyFeatureDashboard=dashboard naming "Lazy" 但synchronous导入, 并非 React.lazy | `done` | Root cause:  registry 早期把synchronous import 误naming为 lazy; 现已改为描述符驱动的 `React.lazy` feature wrapper.  |
| 326 | ui/apps/web/src/feature-registry.ts:41-75 32 feature 顶层 import 全 bundle 在主 chunk, violates代码分割 | `done` | Root cause:  feature registry 之前static导入所有 feature module; 现已改成dynamic import, 构建产物已拆出independent `feature-*` chunk.  |
| 327 | ui/apps/web/vite.config.ts:12-22 CSP missing worker-src/child-src/manifest-src/form-action/frame-src, 浏览器default放行 | `done` | Root cause:  web CSP 基线最初只coverage核心指令; 现已补齐 worker/child/manifest/form/frame 指令并统一injection dev/preview.  |
| 328 | app-shell.tsx 把 tenant/domain/permissions/roles 全部hardcoded | `done` | Root cause: 旧版 shell 曾在local开发环境回填 tenant/domain/permissions/roles; 现implementation只消费explicitly `authContext` 与 URL 参数, 已去掉local兜底hardcoded.  |
| 329 | app-shell.tsx useMemo 写在条件 return 之后violates Hooks 规则 | `done` | Root cause:  `FeatureContent` 之前先按 `subPages.length` 早退, 再声明subsequent hooks; 现已把 hooks 提前并removal条件 hook path.  |
| 330 | app-shell.tsx WebFeatureModule 强行coverage @aa/ui-core type | `done` | Root cause: 应用层此前用 `Omit` 重写 `FeatureModule.subPages` type; 现已directlyuses `FeatureModule` 并via解析函数收口 `subPages`.  |
| 331 | web/main.tsx:5-8 createWebRuntimeConfig output未被消费, startWebRuntimeTelemetry 从不call, OTLP/web-vitals 死代码 | `done` | Root cause: entryfile之前只创建 runtime config 没有驱动subsequent初始化; 现已用 config 初始化 client, 并在生命周期中启动/停止 telemetry.  |
| 332 | web/main.tsx:11 rootElement==null silently no-op 无任何告警 | `done` | Root cause: entryfile之前在找不到 `#root` 时silentlyreturn; 现已上报 `ui.root_element_missing` 并directly fail-fast.  |
| 333 | aa-sw.js:4 预cached /offline 但应用无该路由, install 必failure | `done` | Root cause:  SW 预cached清单沿用了expiry `/offline` 路由; 现已only预cached真实exists的 `/` app shell.  |
| 334 | aa-sw.js:10 install 内 self.skipWaiting() bypass runtime 的 notifyUpdateAvailable user提示 | `done` | Root cause:  SW install 阶段之前directly `skipWaiting()` 抢切版本; 现已removal并保留 runtime 更新notification机制.  |
| 335 | aa-sw.js:27-37 所有 GET (含 HTML) cache-first 无 TTL, 部署无法失效returnuser的 index.html | `done` | Root cause: 旧 SW 对文档request采用无 TTL 的 cache-first; 现已改成 document network-first + TTL cachedfallback.  |
| 336 | aa-sw.js:97-103 replayOfflineMutations 不带 idempotency-key/CSRF/auth, 与 runtime 拦截链矛盾 | `done` | Root cause: 离线replay之前directlybare发request; 现已要求并透传 auth/csrf/idempotency 头.  |
| 337 | aa-sw.js:96-107 replay循环无限速/backoff; 非 2xx (含 401/403/422) 每次 sync 永久重试 | `done` | Root cause: 离线replay最初没有concurrent, backoff和永久failure终止strategy; 现已加入concurrentupper limit, 指数backoff和 4xx 丢弃.  |
| 338 | aa-sw.js:44 bare catch {} 吞 fetch error无 telemetry | `done` | Root cause:  SW failurepath曾bare吞异常; 现已recorderror上下文, 不再silently吃掉 fetch failure.  |
| 339 | app-shell.tsx:330 通配路由 features[0]! 非空assertion; features 中途为空即崩 | `done` | Root cause: 旧通配fallbackdependency `features[0]!` 非空assertion; 现已在 guard/fallback path统一做空集合保护.  |
| 340 | app-shell.tsx:163-176 FeatureContent 每次渲染重算 subPages/activeSubPage 无 memo | `done` | Root cause:  `FeatureContent` 之前每次 render 现算子页state; 现已对 `subPages`, path归一和 `activeSubPage` 做 memo.  |
| 341 | app-shell.tsx:124,137-140 getDerivedStateFromError 总把 retryKey reset为 0, 连续errorloss计数 | `done` | Root cause: error边界派生state曾隐式把 `retryKey` 归零; 现已只设置 `error`, 重试计数only在explicitly retry 时递增.  |
| 342 | app-shell.tsx:65-77 withAlpha 无 memo; 每次渲染对每个 NavLink 解析十六进制 | `done` | Root cause: 导航配色之前在 render 中反复execute十六进制解析; 现已把派生背景色 memo 化复用.  |
| 343 | ui/tests/unit/.../approval/web.test.tsx, hitl/web.test.tsx missing afterEach(cleanup), jsdom 多 root 累积 | `done` | Root cause: 相关 jsdom 视graphtestingmissing统一清场; 现已在 suite `afterEach(cleanup)` 中回收多 root.  |
| 344 | ui/apps/web/public/aa-sw.js:97 replayOfflineMutations 重发不重附 Authorization/X-CSRF-Token/Idempotency-Key | `done` | Root cause: 离线 mutation 之前未validation和继承安全头; 现已directly从存储 headers replay, 并对受保护requestmissing头 fail-close.  |
| 345 | ui/apps/web/public/aa-sw.js /api/v1/* 无声明cachedstrategy, replay 与新 fetch 竞态返staledata | `done` | Root cause:  SW 之前把 API request混进通用cachedstrategy; 现已explicitly bypass `/api/*` runtimecached.  |
| 346 | ui/apps/web/vite.config.ts:18 CSP connect-src 含 wildcard https:/wss:, policy 形同虚设 | `done` | Root cause:  CSP `connect-src` 之前偷懒放开 `https:`/`wss:` 通配; 现已按 env 推导精确 origin 列表.  |
| 347 | ui/apps/web/vite.config.ts:~57 SRI injectionregexonly匹配单行 script 多行被silentlyskip | `done` | Root cause:  review based on旧单行假设; 当前 SRI injection按标签整体匹配, 构建产物已稳定injection `integrity/crossorigin`.  |
| 348 | ui/tests/apps/web.test.tsx:9 assertionhardcoded中文 "总览驾驶舱", 绑定default zh-CN locale, 切语言即破 | `done` | Root cause: testing把default中文标题写死; 现已从 registry 读取 dashboard 标题assertion.  |
| 349 | ui/tests/unit/ui/apps/web/runtime.test.tsx:534 点击 retry 按钮但对结果state不assertion任何东西, 零保护 | `done` | Root cause: error边界重试testing之前只点按钮不看恢复结果; 现已assertion retry 后实际恢复渲染.  |
| 350 | ui/tests/unit/ui/apps/web/runtime.test.tsx 用 mockReturnValueOnce 链, 前 expect failure后排队 mock 渗到下个testing | `done` | Root cause:  suite cleanup不足时 `mockReturnValueOnce` 队列可能串测; 现已在相关 suite `afterEach` 清空 mocks, 避免排队residual.  |
| 351 | ui/tests/unit/ui/packages/features/approval/web.test.tsx:43 用真 Date.now() 而非 vi.useFakeTimers, snapshot 跨次不稳 | `done` | Root cause: 审批视graphtestingdirectlydependency真实clock; 现已切到 fake timers 与fixedsystem时间.  |
| 352 | ui/tests/unit/ui/packages/features/approval/web.test.tsx:72-74 用 fireEvent.click 而非 userEvent.click, 错过 pointer-down/键盘语义 | `done` | Root cause: 审批交互testing只触发 `click`; 现已补 `pointerDown + click` 序列coverage更真实事件语义.  |
| 353 | ui/apps/web/vite.config.ts:14 CSP script-src 'self' 无 nonce/'strict-dynamic', 与 SRI injection并存但 inline script全被阻断 | `done` | Root cause:  review 把“无 nonce/strict-dynamic”误当成必须项; 当前页面只加载外链脚本且 SRI 同时生效, 不exists inline bootstrap 被误阻断的问题.  |
| 354 | ui/apps/web/vite.config.ts:71-95 configurePreviewServer 设 CSP, configureServer(dev) 未设, dev 与生产 CSP inconsistent | `done` | Root cause: 开发服务器之前没有injection同等 CSP; 现已在 dev/preview 两条服务器链路统一injection.  |
| 355 | ui/apps/web/vite.config.ts:101 react-native alias 用 new URL(...).pathname, Windows 下含前导 / + 盘符, alias failure | `done` | Root cause:  alias path解析之前directly取 `new URL().pathname`; 现已改为 `fileURLToPath()` compatibility Windows 盘符.  |
| 356 | ui/apps/web/vite.config.ts:108 sourcemap:"hidden" 生产仍生成 sourcemap file, 可被反推 | `done` | Root cause: 生产构建之前仍output hidden sourcemap; 现已在 production 关闭 sourcemap 产物.  |
| 357 | ui/apps/web/vite.config.ts 无 define: 排除 process.env, Node globally可能被烘焙 | `done` | Root cause:  Vite 之前未explicitly清空 `process.env`; 现已via `define` 阻断 Node globally被烘焙.  |
| 358 | ui/apps/web/public/aa-sw.js:9 cache.addAll(["/","/offline"]), /offline 资源 404 时整 install failure SW never激活 | `done` | Root cause:  SW 预cached里混入不exists的 `/offline`; 现已removal该资源, install 不再被 404 阻断.  |
| 359 | ui/apps/web/public/aa-sw.js:41 每个success GET 都 cache.put, 无 LRU/容量upper limit | `done` | Root cause: staticcached之前只有 `cache.put` 没有容量治理; 现已加入最大条目数裁剪.  |
| 360 | ui/apps/web/public/aa-sw.js:71-76 normalizeCacheRequest 删 search/hash, search结果页/不同 query 共用 cache pollute | `done` | Root cause: 旧cached key 归一化会抹掉 query/hash; 现implementationdirectly按原始 `Request` 建 key, 不再pollute不同query页.  |
| 361 | ui/apps/web/public/aa-sw.js:75 new Request(url,{method:"GET"}) 丢弃原 headers (Accept-Language), 多 locale shared同 entry | `done` | Root cause: 旧implementation重建 `Request` 时丢 header; 现已directlycached原始request, 保留 `Accept-Language` 等变体头.  |
| 362 | ui/apps/web/public/aa-sw.js:96-107 order await replay, 单条慢requestblocks所有; failureresponse不 ok 时不删除也不重试upper limit | `done` | Root cause: 离线 replay 之前serialexecute且无终止条件; 现已按批concurrentreplay并设置failureupper limit.  |
| 363 | ui/apps/web/public/aa-sw.js:18-22 activate only删 aa-ui-runtime- 前缀cached, 更名前缀后老cachedremaining | `done` | Root cause: 激活阶段之前只按单一前缀删除旧cached; 现已cleanup所有 `aa-ui-` 历史cached并保留当前 shell cache.  |
| 364 | ui/apps/web/public/aa-sw.js:141-145 transaction.oncomplete check恒为 undefined, 逻辑总走早 resolve branch, 未 await complete 即 resolve 竞态 | `done` | Root cause:  IndexedDB transaction等待之前error地提前 resolve; 现已统一等待 `transaction.oncomplete/onerror/onabort`.  |
| 365 | apps/web/package.json only 2 个 deps 但实际 import 30+ @aa/* | `done` | Root cause:  review based on早期最小 package 清单; 当前 web app 已explicitly声明 shared/react/router 等实际dependency, 不再是“only 2 个 deps”.  |
| 366 | apps/web/index.html missing meta description/icon/fallback文案 | `done` | Root cause: 旧 HTML 骨架missing少说明元信息与加载fallback; 现已补 `description`, icon 与加载文案.  |

## ui/apps/electron-win

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 367 | electron-win/package.json:9 smoke 直跑 node ./src/index.ts, 无 --import tsx/build, 纯 Node 22 必failure | `done` | Root cause:  smoke 脚本之前directly用bare Node execute TS; 现已改为 `node --import tsx ./src/index.ts`.  |
| 368 | ui/apps/electron-win/src/main.ts:103 window.open 外链无 origin allowlist | `done` | Root cause: 外链打开之前未做 URL allowlist; 现已limit到 `https:`/`mailto:` 与local开发 HTTP.  |
| 369 | ui/apps/electron-win/src/main.ts:~162 globalShortcut 注册后未在 quit 前 unregisterAll, 重启leaks | `done` | Root cause: globally快捷键生命周期之前没有 quit cleanup; 现已在 `will-quit` 统一 `unregisterAll()`.  |
| 370 | ui/apps/electron-win/src/preload.ts:34-35 桥同时暴露 AA_ELECTRON 与private **AA_ELECTRON**, 后者无integrityvalidation | `done` | Root cause:  preload 之前双名暴露公私 bridge; 现已只暴露冻结后的 `AA_ELECTRON` 单一对象.  |
| 371 | ui/apps/electron-win/src/preload.ts preload 暴露的 IPC 通道在 main.ts 未 wire, callsilentlyfailure而非 typed error | `done` | Root cause:  preload 与 main 的 IPC contract曾不synchronous; 现已为暴露的 channel 全部注册 `ipcMain.handle`.  |
| 372 | ui/apps/electron-win/package.json:7 main:"src/main.ts" 但 Electron 不解析 TS, 无 build:tsc step, electron . 启动failure | `done` | Root cause:  Electron 包此前把 `main` 指向 TS 源file且无编译step; 现已改为 `dist/main.js` 并补 `tsc` 构建.  |
| 373 | ui/apps/electron-win/src/main.ts module定义 bootstrapElectronShell 但全包entry未call, app.whenReady never触发 | `done` | Root cause: 主processmodule定义了 bootstrap 但没有directlyentry接线; 现已在 direct-entry branchautocall `bootstrapElectronShell()`.  |
| 374 | ui/apps/electron-win/src/main.ts:11,94 ALLOWED_SHELL_COMMANDS/isShellCommandAllowed 导出但无 IPC handler call, allowlist 死代码 | `done` | Root cause: 早期把诊断命令 allowlist 留成未消费导出; 现已删除这段死代码, 避免制造“受限 shell”假象.  |
| 375 | ui/apps/electron-win/src/main.ts missing app.requestSingleInstanceLock, 多次启动产生duplicateprocess | `done` | Root cause: 桌面壳之前missing少单实例lock; 现已在启动阶段request `app.requestSingleInstanceLock()`.  |
| 376 | ui/apps/electron-win/src/main.ts:103-106 setWindowOpenHandler shell.openExternal(url) acceptsarbitrary URL 未限 protocol, file:///javascript: 可injection | `done` | Root cause: window外链之前未limit协议; 现已只allows allowlist URL, 其余统一 deny.  |
| 377 | ui/apps/electron-win/src/main.ts webContents not registered will-navigate guard, 渲染层重定向到外域bypass沙箱 | `done` | Root cause:  webContents 之前missing少 `will-navigate` 防护; 现已拦截跨域导航并改走 allowlisted external open.  |
| 378 | ui/apps/electron-win/src/main.ts 无 session.defaultSession.webRequest CSP 头injection | `done` | Root cause:  Electron response头之前没有injection CSP; 现已via `session.defaultSession.webRequest.onHeadersReceived` injection.  |
| 379 | ui/apps/electron-win/src/main.ts missing autoUpdater 接线 (package.json dependency electron-updater 但更新无entry)  | `done` | Root cause:  `electron-updater` dependency已声明但未接线; 现已在壳启动时dynamic导入并execute `checkForUpdatesAndNotify()`.  |
| 380 | ui/apps/electron-win/src/main.ts missing app.on('window-all-closed') handle, macOS 退出语义错 | `done` | Root cause: 桌面壳之前漏掉 `window-all-closed` 平台语义; 现已补 darwin 例外与非 darwin 退出逻辑.  |
| 381 | ui/apps/electron-win/src/preload.ts:34-35 AA_ELECTRON 与 **AA_ELECTRON** 同对象references, 渲染层覆写其一即同时pollute另一 | `done` | Root cause: 旧 preload 双重暴露导致两个globally名shared同一references; 现已收口为单一冻结 bridge, 不再exists联动pollute面.  |
| 382 | ui/apps/electron-win/src/preload.ts:27 installElectronBridge(target,bridge) 第一参 target:Window onlyplaceholder (void target), API mislead | `done` | Root cause:  `installElectronBridge(target, ...)` 之前把 target 当placeholder参数; 现implementation已在无 `contextBridge` 时真正把 bridge 安装到传入 target.  |
| 383 | ui/apps/electron-win/src/renderer.js:1-43 桌面 splash 全英文hardcoded, 无 i18n/RTL, 与 web 主壳脱节 | `done` | Root cause:  Electron fallback 文案之前只有英文常量; 现已按 `document.lang` output中英text地化文案.  |
| 384 | electron-win/renderer.js 手写 DOM placeholder, 未加载 React 主应用 | `done` | Root cause:  review based ononly有 fallback shell 的旧state; 当前主window优先加载 `../../web/dist/index.html`, 手写 DOM only作为 web 构建missing时的fallback壳.  |
| 385 | electron-win/index.html "Electron Windows Shell Baseline" placeholder文案直交付 | `done` | Root cause: 交付页标题曾是 baseline placeholder; 现已改为正式产品标题与加载文案.  |
| 386 | electron-win/package.json electron@^42.1.0 不exists | `done` | Root cause:  review record停留在不exists的 `electron@^42.1.0`; 当前包版本已是可安装的 `^31.0.0`.  |
| 387 | electron-win/main.ts:9 rendererHtmlPath = "../dist/index.html", 但包无 build 脚本产生该file, 生产启动 404 | `done` | Root cause:  Electron build 之前只编译 TS, 不复制 fallback shell 资源; 现已在构建阶段生成 `dist/index.html` 与 `dist/renderer.js`, 主process fallback path不再悬空.  |
| 388 | electron-win/main.ts:118-126 globalShortcut.register return值丢弃; conflictsilently | `done` | Root cause: 快捷键注册之前只call `globalShortcut.register()` 不消费return值; 现已在注册failure时explicitlyrecorderror.  |
| 389 | electron-win/main.ts:159-164 无 will-quit/window-all-closed 与 globalShortcut.unregisterAll(), OS 级快捷键leaks | `done` | Root cause: 桌面壳早期没把快捷键注销纳入生命周期; 现已在 `will-quit` 注销并补齐 `window-all-closed` 退出语义.  |
| 390 | electron-win/preload.ts:34-35 同时以 AA_ELECTRON 和 **AA_ELECTRON** 两个名字暴露 bridge | `done` | Root cause:  preload 之前保留了 legacy private别名; 现已收口成单一冻结后的 `AA_ELECTRON` bridge.  |
| 391 | electron-win/preload.ts:27-28 installElectronBridge(target,...) 立即 void target; 丢弃参数 | `done` | Root cause:  preload 安装函数最初把 `target` only当placeholder参数; 现已在无 `contextBridge` 时真正把 bridge 安装到传入window对象.  |
| 392 | electron-win/index.html:8 Electron CSP missing worker-src 与 report-uri | `done` | Root cause:  Electron 壳的 CSP 只coverage了最基础指令; 现已补充 `worker-src` 与 `report-uri`, 并synchronous到主processresponse头injection.  |
| 393 | electron-win/package.json:15-19 build.win.signAndEditExecutable: true 但仓库无signatureconfigure, CI 必failure | `done` | Root cause:  Windows 打包configure沿用了需要signature物料的开关, 但仓库并未提供signature链路; 现已default关闭 `signAndEditExecutable`.  |
| 394 | ui/eslint.config.js:25 不 ignore apps/electron-win/dist/** 与 tauri 构建产物 | `done` | Root cause:  lint ignore 列表只coverage了 web dist, 未coverage Electron/Tauri 产物目录; 现已补齐桌面壳构建产物忽略规则.  |

## ui/apps/tauri-*

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 395 | ui/apps/tauri-linux/src/index.ts 同 mobile 的 adapter-per-render 反模式 | `done` | Root cause: 该条 review 误把 React 壳问题投到了纯适配器工厂file; `src/index.ts` only暴露适配器工厂与 manifest, 不exists render 时重建适配器path.  |
| 396 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:16 CSP img-src 'self' data: https: https: 通配等同arbitrary外站; missing worker-src/font-src/media-src | `done` | Root cause:  Linux Tauri CSP 之前graph省事放开了 `https:` 通配且漏了 worker/font/media; 现已收紧为local资源并补全missing指令.  |
| 397 | tauri-macos/src-tauri/tauri.conf.json:30 pubkey: "macos-demo-public-key" placeholder, updater accepts伪造更新 | `done` | Root cause:  macOS updater 一直处于“placeholder接线”state却仍default激活; 现已default关闭 updater, 避免带着假公钥上线.  |
| 398 | tauri-macos/src-tauri/tauri.conf.json:21, tauri-linux/src-tauri/tauri.conf.json:23 updater 端点 automatic-agent.example 假 TLD | `done` | Root cause: 桌面壳configure曾hardcoded示例域名作为发布端点; 现已关闭default updater 并removalplaceholder端点.  |
| 399 | tauri-linux/src-tauri/tauri.conf.json 无 pubkey field, signaturevalidation未配 | `done` | Root cause:  Linux updater 之前被default开启, 但没有任何signaturevalidationconfigure; 现已default停用 updater, 避免无验签通道暴露.  |
| 400 | tauri-macos/src-tauri/tauri.conf.json:33 plugins.shell.open: true 无 scope 白名单 | `done` | Root cause:  Tauri shell capability 之前directly全开; 现已default关闭 shell open.  |
| 401 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:26-34 shell.open:true os.all:true notification.all:true 过宽 capability | `done` | Root cause:  Linux Tauri capabilities 最初以“全部可用”placeholder; 现已把 shell/os/notification 全部default收紧.  |
| 402 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:20-25 updater 无 pubkey, Linux updater signature不validation | `done` | Root cause:  Linux updater configure处于半接线state, 只配 endpoint 不配 pubkey; 现已default关闭 updater.  |
| 403 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:23 updater endpoint .example placeholder指向死域名 | `done` | Root cause:  Linux updater uses了示例域名placeholder; 现已清空default端点并停用 updater.  |
| 404 | ui/apps/tauri-macos/src-tauri/tauri.conf.json:25 pubkey:"macos-demo-public-key" placeholder, 验签必 fail | `done` | Root cause:  macOS updater 之前保留了演示公钥; 现已default关闭 updater, 而不是带着假密钥发布.  |
| 405 | ui/apps/tauri-macos/src-tauri/tauri.conf.json:31-39 同 linux 的 os.all/shell.open/notification.all 过宽 | `done` | Root cause:  macOS Tauri configure与 Linux 一样沿用了广开 capability 的placeholder值; 现已synchronous收紧.  |

## ui/apps/mobile

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 406 | apps/mobile/src/App.tsx:13 createMobilePlatformAdapter(detectPlatform()) 无 useMemo, 每次渲染重建适配器 | `done` | Root cause:  mobile 壳之前在 render 阶段directly创建 adapter; 现已把平台探测和 adapter construction都收进 `useMemo`.  |
| 407 | apps/mobile/src/App.tsx:8 detectPlatform() dependency navigator.userAgent, 纯 RN 环境会 fall-through 到 android | `done` | Root cause: 平台探测最初只dependency浏览器 UA; 现已优先读取 React Native `Platform.OS`, 再fallback到 UA.  |
| 408 | apps/mobile/src/App.tsx:19,20 mobileNavigation.tabs[0]!, settingsSubRoutes[0]! 非空assertion无 fallback UI | `done` | Root cause:  mobile 壳之前default导航configurenever为空; 现已removal非空assertion并加入explicitly fallback UI.  |
| 409 | ui/apps/mobile/src/App.tsx:13 createMobilePlatformAdapter() 内联渲染无 useMemo, 每次重建 adapter | `done` | Root cause: 与 406 相同, 适配器创建逻辑directly内联在组件体; 现已 memo 化.  |
| 410 | apps/mobile/metro.config.js:1 CJS 写法但父 package.json:5 "type":"module" | `done` | Root cause:  Metro configure沿用了 CommonJS 模板, 但 workspace 已切到 ESM; 现已改为 ESM configurefile.  |
| 411 | apps/mobile/app.json:1-4 only name/displayName, missing expo/scheme/version/orientation | `done` | Root cause: 移动端 app manifest 只有最小placeholderfield; 现已补齐 Expo 基础元data.  |
| 412 | ui/apps/mobile/app.json:1-4 only name/displayName, missing expo/iOS bundleIdentifier/Android package/icons/permissions, 无法构建发布 | `done` | Root cause: 发布侧移动端元信息长期missing席; 现已补齐 iOS/Android 标识, graph标placeholder资源与permissions声明.  |
| 413 | ui/apps/mobile/package.json:11 only smoke 脚本, missing start/android/ios/build; react-native dependency却无 metro bundler dependency声明 | `done` | Root cause:  mobile workspace 只保留了 smoke placeholder脚本, 没有真实开发/打包命令; 现已补齐 start/android/ios/build 脚本与 Metro dependency.  |
| 414 | ui/apps/mobile/metro.config.js:11 unstable_enablePackageExports:true 但 monorepo packages 未声明 exports field, runtime解析failure | `done` | Root cause:  Metro 解析器曾过早启用 package exports 模式, 但 monorepo 并未全面声明 `exports`; 现已default关闭该开关.  |

## ui/packages/ui-core (components, charts, layouts)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 415 | ui/packages/ui-core/src/index.tsx:53-66 createFeatureModule Component only try/catch synchronous渲染error, hooks 内异步抛错不被捕获 | `done` | Root cause:  feature module 之前用函数级 `try/catch` 冒充error边界; 现已改成真正的 React error boundary wrapper feature 子树.  |
| 416 | ui/packages/ui-core/src/components/FeatureScaffold.stories.tsx only 1 个 Basic story, Card/Panel/Tabs/Drawer/Accordion/Stepper/PieChart 等 30+ 组件零故事 | `done` | Root cause:  Storybook 只保留了 `FeatureScaffold` 最小故事; 现已新增 extended 组件与graph表展示故事, coverage交互原语与data可视化基线.  |
| 417 | ui/packages/ui-core/src/components/extended.tsx:217-219 Tooltip only给 span 设 title+aria-label 无 keyboard focusable, 触发不了 hover 显示 | `done` | Root cause:  tooltip 容器之前不可聚焦; 现已让 wrapper 可聚焦, 键盘user也能触发提示.  |
| 418 | ui/packages/ui-core/src/components/extended.tsx:221-228 Drawer 无 focus trap/ESC 关闭/overlay/focus return, violates dialog WAI-ARIA | `done` | Root cause:  Drawer 早期只是fixed定位的侧栏容器; 现已补 focus trap, ESC, overlay 和焦点fallback.  |
| 419 | ui/packages/ui-core/src/components/extended.tsx:233-236 Toast role="status" 与 aria-live="assertive" 角色/活区双指令conflict | `done` | Root cause:  Toast 之前把危险态继续渲染成 `status`; 现已把危险态改为 `alert`, 其余保持 `status/polite`.  |
| 420 | ui/packages/ui-core/src/components/extended.tsx:166-173 Pagination directly渲染 totalPages 个按钮, 10⁴ 页 DOM 爆炸 | `done` | Root cause: pagination控件以前按页数full展开; 现已改为window化pagination与省略号.  |
| 421 | ui/packages/ui-core/src/components/extended.tsx:185-196 Tabs missing左右箭头键导航/aria-controls/tabindex manage | `done` | Root cause:  Tabs 之前只有点击切换; 现已补齐箭头键, `aria-controls` 与 roving tabindex.  |
| 422 | ui/packages/ui-core/src/components/extended.tsx:199-215 Accordion 按钮无 aria-controls 指向content, content div 无 id/role=region | `done` | Root cause:  Accordion 之前只切显示state, 不建语义关联; 现已为 trigger/panel 建立 id 与 region 关系.  |
| 423 | ui/packages/ui-core/src/components/extended.tsx:329-353 SegmentedControl role=radiogroup 但无方向键导航与 roving tabindex | `done` | Root cause: 分段控件之前只声明了 radiogroup 语义, 没implementation键盘行为; 现已补方向键与 roving tabindex.  |
| 424 | ui/packages/ui-core/src/components/extended.tsx:439-453 formatRemainingDuration new Date(deadline) 无效字符串得 NaN, output "NaNm remaining" | `done` | Root cause:  SLA 倒计时之前default任何字符串都能转成合法时间; 现已对非法时间return明确 fallback 文案.  |
| 425 | ui/packages/ui-core/src/components/extended.tsx:117-127 Skeleton 用 aria-hidden 但无 motion 动画, loading state对低视力user不可感知 | `done` | Root cause: 骨架屏之前只有static渐变块; 现已补 shimmer 动画.  |
| 426 | ui/packages/ui-core/src/components/extended.tsx:8-9,16 StatusPill 文字色hardcoded #04130a, 主题切换后对比度无法保证 WCAG AA | `done` | Root cause: state胶囊颜色之前hardcoded在组件里; 现已改用 design token text色, 而不是fixed十六进制.  |
| 427 | ui/packages/ui-core/src/components/extended.tsx:265-272 Stepper only活跃步显 aria-current="step", 其他步missing aria-disabled/aria-current="false" 且无 role="list" 关系 | `done` | Root cause:  Stepper 之前只是视觉列表; 现已补 list/listitem 关系和当前/禁用state语义.  |
| 428 | ui/packages/ui-core/src/components/index.ts:195 FeatureWorkbench onChange:(event:Event)=>... 用 DOM Event 而非 React.ChangeEvent | `done` | Root cause:  workbench 输入框事件type之前沿用了原生 DOM `Event`; 现已改为 React 合成事件type.  |
| 429 | ui/packages/ui-core/src/components/index.ts:238 onKeyDown:(event:KeyboardEvent)=> 用 DOM type而非 React 合成事件 | `done` | Root cause:  workbench 键盘事件type之前也写成了 DOM `KeyboardEvent`; 现已统一为 React 键盘事件.  |
| 430 | ui/packages/ui-core/src/components/index.ts:153-160 triggerAction await action.onTrigger?.(item) 无 try/catch, user回调抛错变 unhandled rejection | `done` | Root cause:  workbench action 之前directly await 外部回调; 现已补结构化failure捕获, 避免未handle rejection.  |
| 431 | ui/packages/ui-core/src/components/index.ts:46-52 KeyValueTable key:row.key 作 React key, 两行同 key 即conflict | `done` | Root cause:  KeyValueTable 之前假定业务 key globally唯一; 现已改成 key+index 复合键.  |
| 432 | ui/packages/ui-core/src/components/index.ts:138 filter.toLowerCase() 而非 toLocaleLowerCase, 土耳其 i/I locale 折叠failure | `done` | Root cause:  workbench filter逻辑之前只做 ASCII 小写化; 现已切到 locale-aware lowercasing.  |
| 433 | ui/packages/ui-core/src/components/index.ts:230-269 Workbench 列表 <button role=option>, listbox missing aria-activedescendant/单 tabstop | `done` | Root cause:  workbench 列表之前把每个 option 都做成independent button; 现已改成单 tabstop listbox + `aria-activedescendant` 模式.  |
| 434 | ui/packages/ui-core/src/components/index.ts:288 aria-relevant="additions text" missing removals, 活动log删除条目无通报 | `done` | Root cause: 活动log live region 之前只通报新增; 现已把 removals 纳入 `aria-relevant`.  |
| 435 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:99-101 "mock" in ResizeObserver 启发式判断, 含 mock field的真 class 误走 callable path | `done` | Root cause:  ResizeObserver constructionbranch之前dependency `mock` field启发式; 现已删掉该branch, 只保留受控 constructor fallback.  |
| 436 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:119,123 useMemo dependencyarray含 ...chartColorDeps 不定长, violates React hooks staticdependencycontract | `done` | Root cause: graph表 option memo 之前展开了不定长dependencyarray; 现已改成explicitlystaticdependency列表.  |
| 437 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:153 初始化 useEffect dependency [] 但闭包捕获 theme/buildChartOption, 主题runtime切换不重建 chart | `done` | Root cause:  review 关注的是graph表主题更新无法生效; 现implementation已把主题changes收进 option 更新 effect, runtime换肤会重新 setOption.  |
| 438 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:166-172 setOption 已替换data后再 appendData duplicate尾部, 序列出现重影 | `done` | Root cause:  append-only 更新之前先对fulldata `setOption`, 再 append 尾段; 现已在追加模式下只对旧序列 setOption, 再 append 新尾段.  |
| 439 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:128-129 userAgent.includes("jsdom") 字符串嗅探, 自定义 UA 即误判skip初始化 | `done` | Root cause: graph表初始化之前via UA 嗅探skip jsdom; 现已去掉该字符串嗅探.  |
| 440 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:138 addEventListener("resize") 绑到 mount 时 defaultView, 容器portable到新 window 不再触发 | `done` | Root cause: graph表尺寸更新之前同时dependency mount 时的 window resize 监听; 现已收口为容器级 ResizeObserver.  |
| 441 | ui/packages/ui-core/src/charts/index.tsx:160 HeatmapGrid 颜色hardcoded rgba(34,197,94,a), 无法跟随 theme changes | `done` | Root cause: 热力graph颜色之前写死为绿色 RGBA; 现已改用 design token accent 色并dynamicinjection透明度.  |
| 442 | ui/packages/ui-core/src/charts/index.tsx:80-81 ScatterPlot only取 maxX/maxY, negative与零基线散点跑出 viewBox | `done` | Root cause: 散点graph坐标映射之前只按最大值归一; 现已按 min/max 区间共同归一.  |
| 443 | ui/packages/ui-core/src/charts/index.tsx:63 BarChart directly将外部 point.tone 字符串塞 background, 未做 CSS 值白名单 | `done` | Root cause: 柱状graph之前把外部 `tone` 当arbitrary CSS 值直塞样式; 现已改为 allowlist 映射.  |
| 444 | ui/packages/ui-core/src/charts/index.tsx:55,83,111,140 chart 用 role="img" aria-label 隐藏data, 未提供 table 可展开 SR text | `done` | Root cause: 轻量graph表之前只暴露概要 aria-label; 现已为 bar/scatter/gauge/heatmap 加入可展开data表.  |
| 445 | ui/packages/ui-core/src/charts/index.tsx:142 <span /> 空 placeholder 无 aria-hidden, 屏读器读出空 cell | `done` | Root cause: 热力graph左上角空placeholder单元格之前没有 `aria-hidden`; 现已explicitly隐藏.  |
| 446 | ui/packages/ui-core/src/charts/echart-surface.tsx:11 lazy(()=>import(...)) 无error边界wrapped, Suspense fallback 不handle chunk load failure | `done` | Root cause:  EChart lazy runtime 之前只有 Suspense fallback, 没有 chunk load error boundary; 现已增加runtimeerror边界.  |
| 447 | ui/packages/ui-core/src/layouts/index.ts:26 ThreePaneLayout 接 viewportWidth prop 但 26-41 完全不uses, 死参 | `done` | Root cause: 三栏布局曾remaining未消费的 `viewportWidth` placeholder参数; 现已removal死参, 避免error API 暗示.  |
| 448 | ui/packages/ui-core/src/layouts/index.ts:25-41 三栏无 aside/main/aside landmark, 左中右皆 <div> 无 aria-label | `done` | Root cause: 早期布局只做视觉栅格, 没把信息架构映射到 landmark; 现已改为 `aside/main/aside` 并补 `aria-label`.  |
| 449 | ui/packages/ui-core/src/components/extended.tsx:401-408 PieChart gradientStops 累积 percent 浮点cumulative, 1000+ 切片precisiondrift产生裂缝 | `done` | Root cause: 饼graph渐变起止百分比之前反复切片求和, 累计浮点误差; 现改为单次cumulative并对末片收口到 `100%`.  |
| 450 | ui/packages/ui-core/src/components/extended.tsx:411-422 PieChart only aria-label="Pie chart" 未声明 role, screen reader 不读切片明细 | `done` | Root cause: 饼graph之前只有粗粒度标签; 现已补 `role="img"` 的标题/描述关联, 读屏can read取切片明细.  |
| 451 | ui/packages/ui-core/src/components/extended.tsx:524-541 DAGVisualization repeat(stages.length,1fr) 单行布局, 20+ stage 时列宽<阅读阈值且无横向滚动 | `done` | Root cause:  DAG 卡片宽度此前线性挤压在单行等分列中; 现改为最小列宽 + 横向滚动, 长流水线can read.  |
| 452 | ui/packages/ui-core/src/components/extended.tsx:265-272 Stepper 用 <ol> 但内部 <li> 无 role/链接, 键盘 tab skip整序列 | `done` | Root cause:  Stepper 之前只保留视觉序列, 没有稳定的可聚焦语义; 现已补列表项语义并放开已到达step的 tab 访问.  |
| 453 | ui/.storybook/main.ts:5 stories glob only扫 packages/ui-core/**, 所有 packages/features/* 与 packages/shared/ui/* 故事零coverage | `done` | Root cause:  Storybook configure只coverage `ui-core`; 现已扩展到 `features/*` 与 `shared/*` 的 stories.  |

## ui/packages/shared/api-client (rest, ws, interceptors)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 454 | ui/packages/shared/api-client/src/rest-client.ts:~398 fallbackTransport 在 401/403 重试failure后silentlyreturn mock, 遮蔽 auth failure | `done` | Root cause:  fallback 逻辑此前不distinguish HTTP 语义error与网络error; 现只在非 `RestHttpError` 场景allows fallback, 不再吞掉鉴权failure.  |
| 455 | ui/packages/shared/api-client/src/rest-client.ts:255-327 重试循环把 4xx 当 transient, 无效重试放大限流 | `done` | Root cause: 重试判定曾把客户端error也视作可恢复; 现only对 `429/5xx` 和allows重试的request放行.  |
| 456 | ui/packages/shared/api-client/src/rest-client.ts default credentials:"include" 跨域request, CSRF/cookie leaks | `done` | Root cause:  HTTP transport default值过宽; 现default收敛为 `same-origin`, 跨域 cookie 不再auto外带.  |
| 457 | ui/packages/shared/api-client/src/rest-client.ts directly crypto.randomUUID() 无 globalThis guard, jsdom/旧 Node failure | `done` | Root cause: request envelope id directlydependency `crypto.randomUUID()`; 现统一走带 fallback 的 `generateStableId()`.  |
| 458 | ui/packages/shared/api-client/src/interceptors.ts:49 createTraceInterceptor 同样 crypto.randomUUID() 无 fallback | `done` | Root cause:  trace id 生成与 transport 一样directly绑死浏览器 crypto; 现复用稳定 id 生成器, testing环境可运行.  |
| 459 | ui/packages/shared/api-client/src/interceptors.ts:243 createRetryInterceptor 重试一切错 (含 4xx/AbortError) , 无 status allowlist | `done` | Root cause: 拦截器级重试曾missing少errortype和幂等边界; 现已排除 `4xx/AbortError` 并要求request本身可安全重试.  |
| 460 | ui/packages/shared/api-client/src/interceptors.ts:274 createDedupeInterceptor module-levelsingletonstate, 跨 vitest fileleaks | `done` | Root cause:  dedupe 观测态曾设计得过宽; 现stateonly封装在 interceptor 实例内, 并在response后cleanup, 不跨实例leaks.  |
| 461 | ui/packages/shared/api-client/src/interceptors.ts:294 dedupe key 用 JSON.stringify(body), 对象键序不稳即cached失效 | `done` | Root cause:  dedupe key 之前directly `JSON.stringify`, 对象键序不同即视为不同request; 现改为稳定序列化.  |
| 462 | ui/packages/shared/api-client/src/interceptors.ts:188 createOfflineQueueInterceptor 把 HEAD/OPTIONS 也入队, replay 风暴 | `done` | Root cause: 离线入队条件此前only排除了 `GET`; 现explicitly排除 `HEAD/OPTIONS`, 避免无意义 replay.  |
| 463 | ui/packages/shared/api-client/src/interceptors.ts:294 vs 312 两站点 dedupe key 格式不同, 跨站点查找never命中 | `done` | Root cause: deduplication key 在 `onRequest` 与 `intercept` 两处各自拼接; 现统一复用同一个 `buildKey()`.  |
| 464 | ui/packages/shared/api-client/src/ws-client.ts:48 eventId regex ^evt[-_][A-Za-z0-9:-]{1,}$ 比 contract 窄, 合法 id 在 252 行被丢 | `done` | Root cause:  replay event id validation过窄; 现已放宽到contractallows的字符集, 不再误丢合法事件.  |
| 465 | ui/packages/shared/api-client/src/ws-client.ts:218 token 走 Sec-WebSocket-Protocol 子协议传输, 被代理/访问logrecord | `done` | Root cause: 早期 WS 鉴权设计曾混淆 token 与子协议; 当前implementation已fixed子协议名, token only在首条 auth message 中发送.  |
| 466 | ui/packages/shared/api-client/src/ws-client.ts:336 重连 jitter 用 Math.random() 无可injection种子, testing不可复现 | `done` | Root cause: 重连backoff此前硬绑 `Math.random()`; 现via options injection随机源, testing可复现.  |
| 467 | ui/packages/shared/api-client/src/shared-ws-worker.ts:207 self.onconnect=… module顶层execute, 被arbitrary import 即在error global 上挂 handler | `done` | Root cause:  SharedWorker runtime之前在module顶层directly安装 handler; 现改为explicitly安装函数并带运行环境 guard.  |
| 468 | ui/packages/shared/api-client/src/shared-ws-worker.ts:172 reconnectTimer 调度新 setTimeout 前未置空, 可叠多个定时器 | `done` | Root cause:  worker 重连 timer 在回调触发后未复位; 现先置空再重连, 避免timer叠加.  |
| 469 | ui/packages/shared/api-client/src/ws-event-router.ts:74 subscribe 不deduplication handler, duplicate注册触发两次 | `done` | Root cause: 事件路由器之前只追加 cleanup, 没有按 channel deduplication; 现以 channel 维度maintained订阅表.  |
| 470 | ui/packages/shared/api-client/src/ws-event-router.ts disconnect() 不清 listener registry, 重连后路由到上次 ghost handler | `done` | Root cause: 断开连接时过去只call dispose, 不清内部 registry; 现 disconnect 会一并清空 channel cleanup 表.  |
| 471 | 04-runtime-sequence.md:145 references需复核的 ui/packages/shared/api-client/... | `done` | Root cause: runtime时序文档只列了 endpoint 落点, 漏掉 `interceptors/rest/ws/router`; 现已synchronous补齐references.  |
| 472 | ui/vitest.config.ts jsdom 环境未 polyfill crypto.randomUUID/crypto.subtle, 导入即用的 interceptors/ws-client 在单测crashed | `done` | Root cause: testing启动file未补浏览器 crypto 能力; 现 `ui/tests/setup.ts` 已兜底 `webcrypto/randomUUID`.  |
| 473 | ui/tests/shared/api-client.test.ts:193 mutate document.head.innerHTML, QueryClient never释放, 跨 spec leaks定时器 | `done` | Root cause: shared API testing此前directlypollute `document.head` 且未统一清场; 现 suite 结束后explicitlycleanup DOM 侧state.  |
| 474 | ui/tests/unit/ui/shared/ws-client.test.ts:158 dependency setTimeout(…,10) 排assertion序, 慢 CI 即 flake | `done` | Root cause:  WS 单测曾靠真实时间片排order; 现改为 fake timers / tick 驱动, CI 不再脆弱.  |
| 475 | ui/tests/unit/ui/shared/ws-client.test.ts:269 单 it 内 vi.spyOn(Math,"random") 无 per-test mockRestore, subsequent it 继承 spy 至 afterEach | `done` | Root cause: testing之前directlyglobally spy `Math.random()`; 现改为给 `BrowserWSClient` injection随机源, 不再polluteglobally.  |
| 476 | shared/api-client interceptor 组合 createIdempotencyKeyInterceptor 注册早于 createRetryInterceptor, 重试时重新生成 idempotency key 击穿服务端deduplication | `done` | Root cause:  review based on旧重试假设; 当前 idempotency key 在 `onRequest` 阶段生成一次, 重试复用同一 request/header, 不会重生 key.  |

## ui/packages/shared/auth & token

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 477 | ui/packages/shared/auth/src/auth-service.ts:121-126 handleSsoCallback 永抛 "auth.redirecting", 文档 happy path 是死代码 | `done` | Root cause:  SSO callback entry之前只保留 fail-close redirect; 现 code/state 回调已委托到 PKCE token exchange, happy path 可达.  |
| 478 | ui/packages/shared/auth/src/auth-service.ts SSO callback 解析 fragment 后未从 window.history clear, token 留在浏览器历史/后退栈 | `done` | Root cause: 认证回调清场stepmissing; 现回调结束统一 `history.replaceState()` clear code/token/error 参数.  |
| 479 | ui/packages/shared/auth/src/token-manager.ts access/refresh token 明文写 localStorage, XSS 即泄露 | `done` | Root cause: 会话persistence边界曾与 token manage混淆; 当前 `TokenManager` 保持in-memory态, auth store persistence也已剔除 access/refresh token.  |
| 480 | api-auth-service.ts:228-231 verificationSecrets.some(...) 短路比较泄露 timing | `done` | Root cause:  review 指向了已下线的旧 `api-auth-service.ts` implementation; 当前 shared/auth path已无该短路比较risk面.  |
| 481 | shared/auth (AuthSession) vs shared/state/auth-store (AuthStoreState) 两套会话模型fieldoverlap, driftsilently | `done` | Root cause:  shared/auth 与 shared/state 之前各自maintained会话field; 现 auth store 会话typedirectly对齐 shared/auth 会话模型.  |

## ui/packages/shared/sync

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 482 | ui/packages/shared/sync/src/offline-queue.ts:82 trimToCapacity 溢出丢最旧无 telemetry/DLQ/caller 信号 | `done` | Root cause: 离线队列超容时此前directly `shift()` 丢弃; 现支持 `onEvict` 回调, 把丢弃事件暴露给call方/telemetry.  |
| 483 | ui/packages/shared/sync/src/sync-coordinator.ts:107 replay 漏附 Authorization/X-CSRF-Token/Idempotency-Key/tenant header, refresh 后 401/403 风暴 | `done` | Root cause: 离线 mutation type之前未保留受保护request头; 现入队时persistence必要 headers, flush 时完整回放.  |
| 484 | ui/packages/shared/sync/src/conflict-resolver.ts:137 preferMostRecent 在时间戳missing/相等时fallback localValue, 与文档 server_wins default相悖 | `done` | Root cause: missing元data时的兜底strategy之前偏向 local; 现改为only当 local 时间严格更新时才取 local, 其余回落 server.  |
| 485 | ui/packages/shared/sync/src/conflict-resolver.ts 不validation lastModified, 伪造future时间戳即每次胜 | `done` | Root cause: 时间戳比较之前无合理clockdriftupper limit; 现超前时间会被视为无效, 不再天然获胜.  |
| 486 | ui/tests/unit/ui/shared/sync-coordinator.test.ts:11 fixed真future日期 2026-05-01T00:00:00.000Z, 比 Date.now() 类assertion随clockdrift | `done` | Root cause: 相关 sync 回归用例曾dependency随日历drift的时间假设; 现改为fixed语义assertion, 不再绑定真实clock.  |

## ui/packages/shared/state (stores, query, mutations)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 487 | ui/packages/shared/state/src/stores/middleware.ts:19 cloneDraftValue 用 JSON 风格克隆, 丢 Map/Set/Symbol 键/类实例 | `done` | Root cause: 草稿克隆之前只coveragearray/普通对象; 现优先用 `structuredClone`, 并补 `Map/Set/Reflect.ownKeys` branch.  |
| 488 | ui/packages/shared/state/src/stores/auth-store.ts:90 logout() Object.assign(draft, DEFAULT_AUTH_STATE) 与default对象sharedarrayreferences, subsequent mutation 别名default | `done` | Root cause:  auth default态之前是shared对象常量; 现改为工厂生成default态, 每次 logout 都拿到新副本.  |
| 489 | ui/packages/shared/state/src/stores/auth-store.ts:60 persistence key aa-auth-store contains明文 access/refresh token | `done` | Root cause:  auth store persistence此前把完整会话directly落盘; 现via `partialize` 去掉 access/refresh token.  |
| 490 | ui/packages/shared/state/src/stores/sync-store.ts:54 setPendingMutations 计数归零仍保留 syncing/error state | `done` | Root cause:  pending 计数和 sync state之前没有统一收敛规则; 现 pending 归零时按conflict/error/空闲重新归并state.  |
| 491 | ui/packages/shared/state/src/stores/sync-store.ts:88 resolveConflict 的 "merge" branchsilently no-op | `done` | Root cause: 单conflict决议曾被error建模成globallystrategy副作用; 现 local/server/merge 都只消解当前conflict并cleanuperror态.  |
| 492 | ui/packages/shared/state/src/stores/sync-store.ts:94-99 单conflict解决会改写globally strategy, 跨无关conflict渗透strategy | `done` | Root cause:  per-conflict resolution 之前directly覆写globally strategy; 现已cancel该副作用, strategy只allowsexplicitly设置.  |
| 493 | ui/packages/shared/state/src/stores/notification-store.ts:33 generateId 用 Date.now()+Math.random(), 突发collision且testing不可复现 | `done` | Root cause: notification id 之前dependency时间戳 + 随机拼接; 现统一复用稳定 id 生成器, 减少collision并可testing.  |
| 494 | ui/packages/shared/state/src/stores/realtime-store.ts:55 triggerPanic 无逆操作且 store persistence, panic state过 reload 仍存活 | `done` | Root cause:  panic 之前既无clear动作也被persistence; 现新增 `clearPanic()` 并在persistence时force落 `false`.  |
| 495 | ui/packages/shared/state/src/query-client.ts:11 工厂naming误且default retry:3 让 TanStack Query 重试 4xx | `done` | Root cause: query客户端之前只有 `createQueryClientFactory()` 且default `retry:3`; 现补 `createQueryClient()` 别名, 并把重试收敛到 `429/5xx`.  |
| 496 | ui/packages/shared/state/src/query-cache-persistence.ts:163 flush 忽略 in-flight 写, 订阅突发 setTimeout reset但前次写仍 pending 互相coverage | `done` | Root cause:  query cache persistence之前没有写入serial化; 现via `writeChain` order落盘, 避免concurrentcoverage.  |
| 497 | ui/packages/shared/state/src/query-cache-persistence.ts:146 hydrate 无 try/catch, IndexedDB corrupted即崩而非fallback新cached | `done` | Root cause:  hydrate 之前default信任persistence快照永远can read; 现读取failure会 fail-close 并cleanup坏cached.  |
| 498 | ui/packages/shared/state/src/query-cache-persistence.ts arbitrary cache (含 PII) 落 IndexedDB 无sanitized/加密 | `done` | Root cause:  query cache 之前无persistence allowlist; 现只allows安全 query key 落盘, 敏感cacheddefault不persistence.  |
| 499 | ui/packages/shared/state/src/mutations/use-mutation.ts:81 calluser onMutate(variables, {} as QueryClient) 强转空对象, cache call即崩 | `done` | Root cause:  mutation hook 之前给 `onMutate` 传了伪造 QueryClient; 现改为via `useQueryClient()` 传真实实例.  |
| 500 | ui/packages/shared/state/src/mutations/use-mutation.ts:88-91 onError only当 context?.previousData 真值时触发, onMutate 返 undefined 时错被吞 | `done` | Root cause: error回调此前errordependency `previousData` 真值; 现无论 snapshot 是否为空都会转发 `onError`.  |
| 501 | ui/packages/shared/state/src/mutations/use-mutation.ts:62-66 client.post/put/patch(resolvedPath, variables) 把整 variables (含path参数 taskId 等) 作 body | `done` | Root cause:  mutation body 之前defaultdirectly透传 `variables`; 现支持explicitly `body`, 并default剔除已出现在path中的 `id/*Id` field.  |
| 502 | ui/packages/shared/state/src/mutations/optimistic-update.ts:54 snapshotCache 标 async 实无 awaited 工作, API mislead | `done` | Root cause:  `snapshotCache()` 之前error声明为 async; 现已收敛为synchronous API, 语义与implementation一致.  |
| 503 | ui/packages/shared/state/src/mutations/optimistic-update.ts:84 patchCache cancel query 但不auto snapshot, call者忘则 rollback 失效 | `done` | Root cause:  optimistic patch 之前不return前态快照; 现 `patchCache()` 会先抓取 snapshot 再更新cached.  |
| 504 | ui/packages/shared/state/src/mutations/optimistic-update.ts:129 同 use-mutation 的 previousData gating bug | `done` | Root cause:  optimistic mutation options 与 hook shared同类 gating 失误; 现两边都改成无条件转发 `onError`.  |
| 505 | ui/packages/shared/state/src/stores/* persistence store 无 schema migration, field变形即 hydrate 崩, 强迫user清 localStorage | `done` | Root cause:  persist middleware 长期未版本化; 现 middleware defaultinjection `version/migrate`, 关键 store 也补了explicitly迁移configure.  |
| 506 | ui/packages/shared/state/src/stores/auth-store.ts missing storage 事件监听跨 tab, 退出后另一 tab 仍持旧 token | `done` | Root cause:  auth store 之前只做本 tab persistence, 不监听跨 tab 变更; 现已接入 `storage` 事件synchronous登出与identity态.  |
| 507 | ui/packages/shared/state/src/query-client.ts 无 defaultOptions.queries.staleTime, 所有 query 立即 stale, 多 dashboard hook duplicaterequest风暴 | `done` | querycached分层default值missing; 已补 staleTime/gcTime 与重试边界, review 文档statesynchronous回写 |
| 508 | ui/packages/shared/state/src/stores/realtime-store.ts persistence+triggerPanic 无 panic 复位 API, 离线重连后 UI 仍 panic | `done` | panic state设计成单向触发且被persistence; 已补 clearPanic 并禁止把 panicActivated persistence |
| 509 | ui/packages/shared/state/src/stores/notification-store.ts:33 generateId=Date.now()+Math.random() 作 React key, collision致同帧notification DOM 复用misalignment | `done` | notification主键曾uses不稳定时间戳随机串; 已切到 generateStableId 并回写 review state |

## ui/packages/shared/i18n

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 510 | ui/packages/shared/i18n/src/index.ts:~185 setLocale 在module初始化时 mutate documentElement.lang/dir, 跨 jsdom testingfileleaks DOM | `done` | i18n default实例在construction期directly操作 document; 已removal初始化期 DOM mutate, 只在explicitly apply 时写 document |
| 511 | ui/packages/shared/i18n/src/index.ts sharedTranslationService 作singleton导出无 reset, testing需触module内部 | `done` | shared翻译服务missing少生命周期出口; 已补 resetSharedTranslationService/dispose used fortesting与重建 |
| 512 | ui/packages/shared/i18n/src/index.ts:142 翻译命中failure回 key, UI directly显示 ui.feature.xxx.title 无 telemetry 告警 | `done` | missing翻译被当作正常 fallback; 已补 diagnostics reporter, 在 miss/format error 时explicitly上报 |
| 513 | ui/packages/shared/i18n/src/index.ts:139 IntlMessageFormat.format(values) as string 强转, 含选择器(<b>{name}</b>)时返arraytype不匹配 | `done` | directly把 ICU format 结果assertion成 string; 已改成explicitly归一化格式化output, compatibilityarray片段 |
| 514 | ui/packages/shared/i18n/src/index.ts:139 每次 translate 都 new IntlMessageFormat(...), 无cached热点 GC 风暴 | `done` | ICU formatter 未做复用; 已引入按 locale+message 的 formatterCache |
| 515 | ui/packages/shared/i18n/src/index.ts:185 setLocale("zh-CN") defaultcallforce初始化 mutate document, defaultlock定 zh-CN 而非user偏好 | `done` | default locale 被hardcoded为 zh-CN; 已改为按 navigator 偏好探测, 不再forcelock中文 |
| 516 | ui/packages/shared/i18n/src/index.ts:128-131 fallback chain 不deduplication locale+catalog.fallbackLocales+fallbackLocale, duplicate值时同 catalog 多次访问 | `done` | fallback 链构建usesarray直推; 已改成 Set deduplication后再解析 |
| 517 | ui/packages/shared/i18n/src/index.ts:153 locale.split("-")[0] 空字符串时为 "", detectLocale 退化为前缀全等空串 | `done` | locale 基语言段未validation空串; 已在 detectLocale 中skip空 baseLanguage |
| 518 | ui/packages/shared/i18n/src/index.ts:206-218 translateFeatureCopy 对每个 featureId 调 translateMessage 两次, N feature 即 2N 次 IntlMessageFormat 创建 | `done` | feature 文案解析逐 key 走完整翻译链; 已改用 translateMany shared查找链并复用 formatter cache |
| 519 | ui/packages/shared/i18n/src/index.ts:111-118 applyLocaleToDocument mutate documentElement.lang/dir; 未在 dispose pathcleanup | `done` | document lang/dir 写入missing少rollback快照; 已record旧值并在 dispose 时恢复 |

## ui/packages/shared/platform adapter

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 520 | ui/packages/shared/platform/src/desktop-platform-adapter.ts:13 读 window.AA_ELECTRON 无integrityvalidation, XSS 可伪造桥 | `done` | Electron 桥原先directly信任globally对象; 已要求冻结对象+signature+方法validation后才接桥 |
| 521 | ui/packages/shared/platform/src/desktop-platform-adapter.ts:~86 runShell acceptsarbitrary命令无 allowlist, 渲染层被入即 RCE | `done` | shell 通道missing少最小permissions约束; 已收敛为 allowlist 命令并先走localvalidation再call桥 |
| 522 | ui/packages/shared/platform/src/web-platform-adapter.ts 写 localStorage 无 QuotaExceededError handle, 配额满即所有写抛 | `done` | 浏览器存储原本应是 best-effort; 现代码已对 localStorage 写入做 try/catch, review 文档state回写 |

## ui/packages/shared/telemetry

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 523 | ui/packages/shared/telemetry/src/index.ts:89 无 exporter 时 buffer 满silently丢只留最新 | `done` | buffer overflow 被当成无声淘汰; 已把被裁剪事件转入 dead letter 并保留原因 |
| 524 | ui/packages/shared/telemetry/src/index.ts:150 splice(0,length) 后 await 期间concurrent record() 与 unshift 幸存者竞态破序 | `done` | flush 批次与缓冲区无explicitly in-flight 边界; 已拆出 flushingEntries, 先synchronous摘批次再回插幸存者 |
| 525 | ui/packages/shared/telemetry/src/index.ts:233-235 OtlpHttpTelemetryExporter constructionsynchronous抛错, 且onlyvalidation小写 authorization 头 | `done` | OTLP 认证头validationsize写敏感; 已改为size写无关解析 authorization |
| 526 | ui/packages/shared/telemetry/src/index.ts:295-306 measureDuration 无 try/catch, fn() synchronous抛使起始 performance.mark 孤儿 | `done` | duration wrapper器只coverage Promise.finally; 已补synchronous异常path, 保证 end mark/measure 总会落下 |
| 527 | ui/packages/shared/telemetry/src/index.ts:399 PerformanceObserver.observe({type,buffered:true}) 旧 Safari/FF 不支持, try 吞错silently丢 vitals | `done` | 浏览器compatibility异常被bare吞; 已在 fallback 中explicitly warn/report 不再silently丢信号 |
| 528 | ui/packages/shared/telemetry/src/index.ts:141 dispose() 置 disposed 后异步 flush, 期间 record() no-op 但 in-flight 未必被 caller await | `done` | dispose 设计成 fire-and-forget; 已改为 async dispose, 可 await flush 完成 |

## ui/packages/features (approval, dashboard, conversation, alerts, etc.)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 529 | ui/packages/features/approval/src/web/index.tsx:25 选中按钮背景色 #12201a, 边框 #334155 hardcodedskip design-token | `done` | review 时based on旧implementation, 现网代码已改用 designTokens, 文档state回写 |
| 530 | ui/packages/features/approval/src/web/index.tsx:62 Delegate button aria-describedby={delegateInputId} 指向 <input> 而非描述text | `done` | 可访问性描述关系绑错目标元素; 已改为指向专用描述text节点 |
| 531 | ui/packages/features/approval/src/hooks/index.ts:50-62 approvalFeedVersion 用 : 拼接field, taskId 含 : 即版本键collision | `done` | 版本键由字符串拼接construction; 已改成结构化 JSON 序列化避免collision |
| 532 | ui/packages/features/approval/src/hooks/index.ts:146-158 delegate failure时无 rollback (与 approve/reject inconsistent) , UI 永久optimistic删除 | `done` | 委派path漏掉failurerollbackbranch; 已与 approve/reject 对齐恢复快照 |
| 533 | ui/packages/features/approval/src/hooks/index.ts:176-188 approveBatch/rejectBatch Promise.all 一条failure即拒整批 | `done` | 批handleerror模型error地uses all-or-nothing; 已改用 allSettled, onlyremovalsuccess项并抛聚合error |
| 534 | ui/packages/features/approval/src/hooks/index.ts:76 useEffect dependencyonly [approvalFeedVersion], eslint exhaustive-deps missing queryApprovals references | `done` | effect dependency表达与datasynchronous源inconsistent; 已引入based on版本键的稳定 approvals references再入dependency |
| 535 | ui/packages/features/dashboard/src/hooks/index.ts:120-318 buildPanelGroups 标题/描述全 zh-CN hardcoded | `done` | dashboard 面板文案directly写死在 hook; 已全部迁移到 shared i18n catalog |
| 536 | ui/packages/features/dashboard/src/hooks/index.ts:390-405 useDashboardVm 6 query hook 无门控parallel fire; mapDashboardSnapshotToVm 未 memo | `done` | dashboard 二级query在无主快照时也parallel触发且 VM 每次重算; 已为二级query加 enabled 门控并 memo VM 映射 |
| 537 | ui/packages/features/dashboard/src/hooks/index.ts:56-58 formatRatio(value) 不 clamp, agent.load<0 或>1 时output非法百分比 | `done` | 比例格式化default信任上游data; 已对 ratio 做 0..1 clamp |
| 538 | ui/packages/features/dashboard/src/hooks/index.ts:60-65 formatMetricValue String(metric.value) 在 value 为对象时变 [object Object] | `done` | 指标值格式化只做粗暴字符串化; 已改为 primitive 保留, 对象 JSON 序列化 |
| 539 | ui/packages/features/dashboard/src/hooks/index.ts:67-72 findMetric 按 label 字符串 "Queue Throughput" 等匹配, 后端翻译即查不到 | `done` | 指标查找把英文 label 当稳定主键; 已改成 id/label 归一化别名匹配 |
| 540 | ui/packages/features/dashboard/src/hooks/index.ts:352-362 trendValues 把百分比与原始计数混入同一序列, 趋势graph Y 轴含义崩坏 | `done` | 趋势序列混用不同量纲; 已统一改成百分比归一化序列 |
| 541 | ui/packages/features/conversation/src/hooks/index.ts:48 module顶层 new QueryClient() singleton, 跨testing/SSR 实例pollute且不 GC | `done` | 会话持久层error复用 TanStack Query globally实例; 已改为轻量local cache, 不再跨实例pollute |
| 542 | ui/packages/features/conversation/src/hooks/index.ts:58-60 module-level Set listeners + sharedConversationClient, 多消费者用首位创建实例的 persisted state | `done` | 会话 client/listener 被提升到module-levelshared; 已改成 hook 内independent client 与订阅生命周期 |
| 543 | ui/packages/features/conversation/src/hooks/index.ts:141 as never cast 屏蔽 ConversationClient constructiontype不匹配 | `done` | 旧implementationdependencytype逃逸掩盖 client 装配问题; 重写会话 hook 后已removal该类unsafeassertion |
| 544 | ui/packages/features/conversation/src/hooks/index.ts:165-167 dispose call未 try/catch, client.dispose 抛错破坏 unmount cleanup | `done` | cleanuppathdefault假定 dispose 不抛错; 已在 unmount cleanup 中做 best-effort try/catch |
| 545 | ui/packages/features/conversation/src/hooks/index.ts:172 loadPersistedState 在 useState 初始化期synchronous访问 sessionStorage, SSR 报错 | `done` | persistence读取放在初始化阶段; 已改为 effect 内按 window/sessionStorage 条件水合 |
| 546 | ui/packages/features/conversation/src/hooks/index.ts:176 草稿初始值 "Help me plan the next operation" hardcoded英文 | `done` | 初始草稿未接 i18n; 已迁到翻译 catalog 的 defaultDraft 文案 |
| 547 | ui/packages/features/conversation/src/hooks/index.ts:226-228 state合并把 snapshot.status==="idle" 当噪声丢弃, client 主动 reset 信号被吞 | `done` | 旧state合并把 idle 当异常噪声; 已改成explicitlyaccepts client snapshot/status coverage |
| 548 | ui/packages/features/conversation/src/hooks/index.ts:285-294 cleanup only clearTimeout, 最后一次 persist 未 flush | `done` | persistence debounce cleanup只清 timer 不刷尾包; 已在 unmount 前force flush 当前 state |
| 549 | ui/packages/features/conversation/src/hooks/index.ts:399,408,421 zh-CN hardcoded业务文案不可翻译 | `done` | 会话plan/澄清/execute提示写死中文; 已抽到 i18n catalog 键值 |
| 550 | ui/packages/features/conversation/src/hooks/index.ts:450-466 return vm 对象未 useMemo, 每渲染新references | `done` | hook return对象每次重建; 已改成 useMemo wrapper稳定 VM references |
| 551 | ui/packages/features/alerts/src/hooks/index.ts:118-122 const [filters]=useState(...) 无 setter, UI 改不了 filters, 死state | `done` | alerts VM 只暴露 filters 快照不暴露修改entry; 已补 setFilters 并接入 VM |
| 552 | ui/packages/features/alerts/src/hooks/index.ts:152-166 setLiveIncidents(merge) 无 TTL cleanup, 长会话in-memorymonotonic增长 | `done` | 实时告警cached只追加不淘汰; 已给 liveIncidents 增加 TTL 与定时清扫 |
| 553 | ui/packages/features/alerts/src/hooks/index.ts:161 setStreamStatus("live") 一旦设置neverreset, 连接断开仍显示 live | `done` | 流state只在事件到达时升高不随连接state回落; 已接 ws status change 做 live/idle 切换 |
| 554 | ui/packages/features/alerts/src/hooks/index.ts:229-265 onAcknowledge/onDismiss/onSnooze/onEscalate fire-and-forget mutate, failure history 已记success且 UI 不 rollback | `done` | 告警动作原先先写 UI 后异步提交; 已改为 await mutateAsync, failure时rollback dismissed/snoozed state |
| 555 | ui/packages/features/alerts/src/hooks/index.ts:267-269 pendingOperations only数 pending state, 4 mutation 串扰 | `done` | pending 数量从 mutation status 派生, 无法反映concurrent次数; 已改为independent计数器 withPending |
| 556 | ui/packages/features/alerts/src/hooks/index.ts:271-283 顶层 buildAlertsVm(...) call未 memo | `done` | alerts VM 顶层映射每次 render 重建; 已在 hook return处 useMemo |
| 557 | ui/packages/features/takeover/src/hooks/index.ts:40 JSON.parse(localStorage[...]) as TakeoverSnapshot[] 无 schema validation | `done` | 接管快照directly信任 localStorage 反序列化结果; 已补 isTakeoverSnapshot validationfilter |
| 558 | ui/packages/features/takeover/src/hooks/index.ts:75,94 [snapshot,...readSnapshots()] 读+写non-atomic, concurrent claim/transfer 丢条目 | `done` | 快照更新uses分离的读改写; 已收敛成 commitSnapshots 单写path |
| 559 | ui/packages/features/takeover/src/hooks/index.ts:123-140 useEffect dependency currentSnapshot?.taskId, 每次快照换 task 即重订阅 ws, 期间 history 双计 | `done` | 订阅生命周期error绑定到当前 taskId; 已改成单次订阅并在回调内按 snapshot.taskId filter |
| 560 | ui/packages/features/takeover/src/hooks/index.ts:131-138 ws 事件即使无变更也写 capturedAt:new Date() 引发 memo 失效 | `done` | ws 合并逻辑无差别更新时间戳; 已在 owner/status/steps 真changes时才刷新 capturedAt |
| 561 | ui/packages/features/takeover/src/hooks/index.ts:144-146 Manual Takeover/Override Actions/Resume Control 描述 zh-CN hardcoded | `done` | takeover 卡片说明文案directly写死; 已迁移到 shared i18n catalog |
| 562 | ui/packages/features/takeover/src/hooks/index.ts:62 ownershipHistory state无upper limit, 长会话累计 | `done` | ownershipHistory only追加不裁剪; 已加 MAX_HISTORY_ENTRIES upper limit |
| 563 | ui/packages/features/hitl/src/hooks/index.ts:45 倒计时 (deadline-Date.now())/1000 hook 不订阅时间, UI 不会auto刷新到 0 | `done` | 倒计时值只在 approvals changes时计算; 已补 1s tick 驱动重新映射 items |
| 564 | ui/packages/features/hitl/src/web/index.tsx:15 JSON.parse(editorValue) patch path无explicitlyvalidation/error反馈, user输入非 JSON 即整 view 抛 | `done` | 编辑器directly JSON.parse 且异常冒泡; 已补 JSON object validation与error提示 UI |
| 565 | ui/packages/features/hitl/src/hooks/index.ts:119,126 JSON.stringify({action:"patch",patch}) 把整 patch 序列化进 textInput, 无 size limit | `done` | HITL patch/override text输入未limit payload 体积; 已加 TextEncoder 字节upper limitvalidation |
| 566 | ui/packages/features/domain-wizard/src/hooks/index.ts:90 JSON.parse(raw) as Partial<...> missing schema validation | `done` | 领域向导草稿反序列化directly merge; 已补field级 validateStoredDraft/枚举validation与数值归一化 |
| 567 | ui/packages/features/domain-wizard/src/hooks/index.ts:140 localStorage.setItem 无 try/catch, 配额满directly抛打断 wizard | `done` | Root cause: 领域向导把浏览器persistence当成强dependency; 现已将 `localStorage.setItem()` 包进 try/catch, 存储failure时fallback到in-memory态.  |
| 568 | ui/packages/features/analytics/src/hooks/index.ts:211 JSON.stringify({metrics,timeSeriesData,breakdowns,dateRange},null,2) 全部data塞导出字符串, 无sizecheck | `done` | Root cause: analysis导出之前defaultfullserial化 payload; 现已增加导出负载construction与字节upper limitvalidation.  |
| 569 | ui/packages/features/conversation/src/web/index.tsx:59 border:"1px solid #334155" hardcoded design-token 外颜色 | `done` | Root cause: 会话消息卡片曾directly写死边框色; 现已切回 `designTokens.color.border`, review 文档state回写.  |
| 570 | ui/packages/features/*/src/web/index.tsx 普遍missing <form> wrapped与 <button type="submit">, 按 Enter 无default提交语义 | `done` | Root cause: multiple places交互视graph早期只做点击流, 未建表单语义; 现已在 conversation, approval 等输入动作视graph补齐 `form`/`submit` 语义.  |
| 571 | ui/packages/features/*/src/web/index.tsx multiple places inline style={{display:"grid",gap:..}} duplicate, 无统一 Stack/Inline primitive | `done` | Root cause:  feature 视graph长期内联布局样式复制粘贴; 现已抽出并落地 `Stack`/`Inline` primitive 统一复用.  |
| 572 | ui/package.json workspaces 不含 packages/features/* | `done` | Root cause:  UI workspace 清单曾漏掉 features 包族; 现 `ui/package.json` 已explicitly纳入 `packages/features/*`.  |

## ui/tools (codegen, mock-server, e2e)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 573 | ui/tools/mock-server/src/index.ts:84 server.listen(port,...,resolve) 不监听 error 事件, 端口failure即挂起 | `done` | Root cause:  mock server 启动 Promise 之前只等 listen callback, 不接 listen error; 现已对 `error/listening` 双事件收口并在failure时 reject.  |
| 574 | ui/tools/mock-server/src/index.ts:23-32 hardcoded apiVersion:"v1"/contractVersion:"1.0" 与 DEFAULT_ACCEPT_VERSIONS inconsistent | `done` | Root cause:  mock contract 元data曾手写常量, 未复用 shared accept-version contract; 现已对齐 `DEFAULT_ACCEPT_VERSIONS`.  |
| 575 | ui/tools/codegen/src/index.ts:56 generateEndpointBindingModule 不转义 endpoint.path, 含 "/反引号/\n 的path生成corrupted/可injection TS | `done` | Root cause: 代码生成器directly插值 endpoint path; 现已对生成的pathliteral量做转义.  |
| 576 | ui/tools/codegen/src/index.ts:138 propertyName 原样insert TS, 含连字符/空格/冒号的 OpenAPI 属性产生非法标识符 | `done` | Root cause:  schema property 名此前default假定为合法 TS identifier; 现已对非法标识符auto转为带引号属性.  |
| 577 | ui/tools/codegen/src/index.ts:122 isInterfaceLikeSchema 在 oneOf/anyOf/allOf 与 properties 共存时返 false, properties 被silently丢 | `done` | Root cause: interface型 schema 判定过于二元化, 组合 schema 与 properties 共存时被误判; 现已保留并合成对象属性.  |
| 578 | ui/tools/codegen/src/index.ts:273 operationId fallback ${method}-${path} + toTypeName 把only标点不同的path折叠成同名type | `done` | Root cause:  fallback operation 名只做粗粒度归一化, collision后无二级deduplication; 现已加入确定性collision后缀.  |
| 579 | ui/tools/codegen/src/index.ts:267 对 OpenAPI schema Object.entries order在 spec 重生成时changes, 产物 diff 噪声 | `done` | Root cause: 生成器遍历 schema/endpoint 时未sort; 现已统一稳定sort, 去掉无意义 diff.  |
| 580 | ui/tools/mock-server/src/index.ts:65-77 POST/PUT body never drain, 高负载下 socket 缓冲堆满processin-memoryleaks | `done` | Root cause:  mock handler 之前对写request体不消费; 现已对 `POST/PUT/PATCH` 主动 drain request body.  |
| 581 | ui/tools/mock-server/src/index.ts:80 default port=0 监听临时端口但无回调暴露真实端口给 env, call者需手 wire | `done` | Root cause: 旧 review based onreturn值过时认知; 当前 `createMockHttpServer()` 已return解析后的 `port/url`, 无需call方自行猜端口.  |
| 582 | ui/tools/e2e/src/smoke.spec.ts:3 baseURL hardcoded [http://127.0.0.1:4173, 忽略](http://127.0.0.1:4173, 忽略) PLAYWRIGHT_BASE_URL/PLAYWRIGHT_PORT | `done` | Root cause:  smoke suite 早期把 base URL 写死在file里; 现已优先读取 `PLAYWRIGHT_BASE_URL/PLAYWRIGHT_PORT`.  |
| 583 | ui/tools/e2e/src/smoke.spec.ts file不在 playwright.config.ts testMatch glob 内, CI neverexecute的死代码 | `done` | Root cause:  Playwright `testMatch` onlycoverage `ui/tests`; 现已把 `../tools/e2e/src/**/*.spec.ts` 纳入executerange.  |
| 584 | ui/tests/unit/ui/tools/mock-server-routing.test.ts only 2 条负向用例, 漏首/尾斜杠与size写敏感 | `done` | Root cause:  mock route 单测之前只coverage前缀相似path; 现已补 trailing slash, size写敏感和端口占用failure回归.  |

## ui/.storybook & playwright

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 585 | ui/packages/storybook/ only含 README, .storybook/main.ts:5 only ui-core/**/*.stories.tsx, 工作区死成员 | `done` | Root cause:  storybook package 过去只是placeholder目录, stories 也只扫 `ui-core`; 现已补实际包entry, 并扩展 story glob.  |
| 586 | ui/playwright.config.ts:24,28 webServer.command 带完整 vite build && vite preview, 与 reuseExistingServer:true conflict | `done` | Root cause:  Playwright 启动strategy之前把一次性 build/preview 流程塞进 `webServer.command`; 现已收敛为可复用的 `vite dev` 启动命令, 与 `reuseExistingServer` 语义一致.  |
| 587 | ui/playwright.config.ts PLAYWRIGHT_PORT=4173 hardcoded, concurrent跑测端口conflict | `done` | Root cause: 端口configure之前fixed写死; 现已统一从环境变量和 `test-target.json` 解析.  |
| 588 | ui/playwright.config.ts retries: CI?2:0 CI/local信号inconsistent, 掩盖真 flake | `done` | Root cause: 重试次数曾偷绑 CI 环境; 现改为explicitly `PLAYWRIGHT_RETRIES` 控制, default `0`.  |
| 589 | ui/tests/playwright/visual-regression.spec.ts:20 访问 /governance/approvals, 目录与路由实际为 /mission-control/approvals, baseline 截graph打 404 | `done` | Root cause: testing目标路由随目录调整后未synchronous; 现已改到真实路由 `/mission-control/approvals`.  |
| 590 | ui/.storybook/main.ts:7 addons:[] — missing a11y/controls/viewport/docs, UI 库无 a11y autocheck | `done` | Root cause:  Storybook configure长期停留在最小可跑state; 现已补上 essentials, a11y, viewport 等 addons.  |
| 591 | ui/.storybook/preview.ts:1-7 无 i18n/Theme/Router decorator, dependency context 的组件故事渲染state错乱 | `done` | Root cause:  story 渲染环境之前未injectionglobally上下文; 现已补 theme/locale/route globals 与 decorator.  |
| 592 | ui/playwright.config.ts 未声明 projects 多浏览器矩阵, 单浏览器跑测, 跨引擎回归无coverage | `done` | Root cause:  Playwright 以前只跑default浏览器; 现已explicitly声明 chromium/firefox/webkit projects.  |
| 593 | ui/.storybook/main.ts missing staticDirs/viteFinal 复用主 vite.config.ts 的 alias/CSP, story 构建管道与 web 偏移 | `done` | Root cause:  Storybook 与 web Vite 管道曾各配各的; 现已via `staticDirs/viteFinal` 复用主 alias/define/CSP 设定.  |

## ui/vite & tsconfig

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 594 | ui/eslint.config.js:14 tools/**/*.ts contains *.spec.ts, 与testing globals override conflict | `done` | Root cause:  tools 源码 glob 之前把 spec 也吞进了 production 规则集; 现已把源码range收敛到 `tools/**/src/**/*.ts`.  |
| 595 | ui/eslint.config.js:1-52 启用 type-aware 规则但未设 parserOptions.project/projectService, 规则降级 | `done` | Root cause:  UI ESLint 之前没打开 type-aware parser service; 现已启用 `projectService: true`.  |
| 596 | ui/vitest.config.ts:18 maxWorkers:1 forceserial 200+ file | `done` | Root cause: testingconcurrent度过去被hardcoded为 `1`; 现已removalforceserial, onlyallowsvia `VITEST_MAX_WORKERS` explicitlycoverage.  |
| 597 | ui/vitest.config.ts:21-27 coverage thresholds key "ui-core" path无效, 80% 阈值silently失效 | `done` | Root cause:  coverage 阈值path键写错, 不匹配真实目录; 现已修正为 `packages/ui-core/**`.  |
| 598 | tsconfig.json:2-4 references:[{path:"./ui/tsconfig.json"}] 装饰性, typecheck 实际跑 3 个independent tsc, 未用 tsc -b | `done` | Root cause:  solution references 过去只挂名不用; 现根 `typecheck` 已引入 `tsc -b tsconfig.json`, 并把 `tsconfig.scripts.json`/`ui/tsconfig.json` 接入 solution graph, 不再是纯装饰.  |
| 599 | ui/vitest.config.ts maxWorkers:1 hardcodedserial, violates AGENTS.md "raw concurrency by layered runner", 掩盖concurrent bug | `done` | Root Cause与 596 相同, 都是把 runner concurrentlock死在configure层; 现已去掉hardcodedserial.  |
| 600 | scripts/ci/audit-lint-guardrails.mjs 不force eslint.config.js 与 ui/eslint.config.js synchronous | `done` | Root cause:  guardrail audit 之前只审源码与 secrets, 不审 ESLint configuredrift; 现已forcevalidation root/ui 两份 config 都保留 `projectService` 和 `scripts/**/*.mjs` coverage.  |

## ui other

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 601 | UI/E2E multiple placeshardcoded 127.0.0.1:4173 端口 | `done` | Root cause:  UI testingentry各自hardcoded host/port; 现已统一收口到 env 与 `ui/test-target.json`.  |
| 602 | ui/package.json lint 排除 *.mjs, bundle-analysis.mjs 不被check | `done` | Root cause: 旧 lint 命令只扫 TS/TSX; 现 `ui/package.json` 已把 `tools/**/*.{ts,mjs}` 与 `scripts/**/*.mjs` 纳入.  |
| 603 | ui/package.json:15 tools/* 在 workspaces, 但 tools/{e2e,codegen,mock-server} 无 deps 声明, only tsconfig paths 解析 | `done` | Root cause: 工具工作区之前只靠path映射跑通, 没有补 package 级dependency; 现相关 tools package 已补dependency声明.  |
| 604 | ui/package.json:30 lint 不coverage *.mjs (如 bundle-analysis.mjs, perf-budget.mjs)  | `done` | Root Cause与 602 相同, 属于 UI lint 输入集合过窄; 现 `.mjs` 脚本已纳入 lint.  |
| 605 | ui/lighthouserc.json:36 interaction-to-next-paint <= 200ms 在 simulate throttling 下必抖动 | `done` | Root cause:  Lighthouse INP 门槛定得脱离模拟节流现实; 现已放宽为 warning/500ms, 避免必然抖动.  |
| 606 | ui/tests/setup.ts patch matchMedia 无 afterAll cleanup; 不 stub IntersectionObserver/ResizeObserver/crypto.subtle | `done` | Root cause: globallytesting垫片只补了最小 `matchMedia`, 且cleanup不完整; 现已补 `afterAll` 恢复与 `IntersectionObserver/ResizeObserver/crypto.subtle` stubs.  |
| 607 | ui/tests/docs/architecture-phase-alignment.test.ts:8-11, directory-panorama.test.ts:7 用 process.cwd()+"../docs_zh", only ui 工作区可解析 | `done` | Root cause:  UI 文档testingpath之前dependency运行目录; 现已改为based on稳定file定位解析文档path.  |
| 608 | ui/.turbo/tasks/test.json cached JSON 被提交, 未在 .gitignore | `done` | Root cause:  Turbo taskcached产物没有被忽略; 现 `.turbo/tasks/*.json` 已加入 `ui/.gitignore`.  |
| 609 | package.json 与 ui/package.json 均无 repository.url, npm 元dataloss源码链接 | `done` | Root cause: 仓库元data长期未补齐; 现 root 与 UI package 都已声明 `repository.url`.  |
| 610 | ui/packages/*/package.json, ui/apps/*/package.json 多数无 license: field | `done` | Root cause: 工作区包清单只maintained运行元data, misses license; 现已为多array件, 应用, 工具包补齐 `license`.  |
| 611 | ui/tests/setup.ts only stub matchMedia, 无 afterEach 清 body/localStorage/sessionStorage/fetch mock, state跨测leaks | `done` | Root cause:  UI testingglobally清场不完整; 现已在 `afterEach` cleanup body, storage 与 fetch mock.  |
| 612 | tests/fixtures/migration/migration-fixtures.test.ts dependency process.cwd() 而非 import.meta.url, 从仓库根/ui/ 下跑结果不同 | `done` | Root cause: 迁移 fixture testingpath解析曾绑当前工作目录; 现已改成based onmodule位置的稳定path解析.  |
| 613 | ui/tests/shared/web-platform-security-regressions.test.ts:7,18 mutate window.localStorage 无 afterEach 还原, 下个testing见leaks条目 | `done` | Root cause: 该 suite 自身dependencyglobally storage pollute; 现已与统一 test setup 清场对齐, testing间不再leaks.  |

## tests/integration

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 614 | tests/integration/sdk/{admin,client,billing,channel-gateway}-* 5+ file monkey-patch globalThis.fetch 无 try/finally, assertionthrows即跨用例leaks | `done` | Root cause: 这批 SDK integration tests 早期确实有globally fetch cleanup不稳的问题; 当前相关file已统一用 `try/finally` 还原 `globalThis.fetch`, review 项已stale.  |
| 615 | tests/integration/org-governance/{oidc-service,sso-scim/sso-scim.integration}.test.ts 多次 process.env.NODE_ENV 切换, concurrent即竞态 | `done` | Root cause: 环境变量切换曾directly改globally `NODE_ENV`; 现已removal/收口竞态修改path, `sso-scim` 回归已coverage.  |
| 616 | tests/integration/platform/shared/cache/cache-invalidation-broadcast.test.ts:47,147, tests/integration/platform/execution/queue/queue-adapter.integration.test.ts:304 Redis localhost:6379 hardcoded | `done` | Root cause:  Redis integration testing过去把宿主机端口写死; 现统一改成 `AA_REDIS_HOST/AA_REDIS_PORT` 可configure.  |
| 617 | tests/integration/platform/execution/queue/queue-adapter.integration.test.ts:24 delete process.env.AA_RUNNING_TESTS 不复原 | `done` | Root cause: 该 review 指向的旧代码path已不exists; 当前file已无该 env 删除逻辑, 属于stale问题单.  |
| 618 | tests/integration/platform/security/enterprise-capability-boundary.test.ts:108-110 循环内 delete + 设置 env 无原值捕获, failure即loss key | `done` | Root cause: 环境变量coverage/恢复曾missingexplicitly快照; 现testing已在 `previousEnv` 快照基础上统一恢复.  |
| 619 | tests/integration/platform/interface/api/api-server.test.ts:156-161 用 Date.now() 测时延, CI 抖动即抖 | `done` | Root cause:  API server 回归曾dependency真实clock延迟assertion; 现已removal该脆弱时延check.  |
| 620 | tests/integration/domains/governance/hr-role-governance-integration.test.ts:26 rootPath:"/tmp/${overrides.id}" injection → 越权写 /tmp | `done` | Root cause:  HR integration testing曾拿 `/tmp/${id}` 拼接伪工作区; 现已改成受控的虚拟化安全path.  |

## tests/unit

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 621 | tests/unit/platform/source-integrations-risk.test.ts:20 用 Math.random().toString(36) 生成 dlg-id, 破坏 golden replay | `done` | Root cause: testingdata id 生成以前dependency非确定性随机数; 现已改成确定性计数器.  |
| 622 | tests/unit/platform/stability/stable-release-package.test.ts:167-184 18 处 /tmp/${profile}/... 报告path无 mkdtemp/tmpdir() | `done` | Root cause: 稳定性单测长期把 `/tmp` 当通用沙盒; 现已改成 `tmpdir()`/受控 helper 生成临时path.  |
| 623 | tests/unit/platform/security-field-encryption.test.ts:183,194 /tmp/${i}.ts 当 ID uses与 sandbox-root validationpathconflict | `done` | Root cause: 加密testing把pathliteral量混作业务 ID; 现已改成安全工作区样式path, 并synchronousassertion当前 `encv1.` envelope.  |
| 624 | tests/unit/domains/governance/hr/hr-role-governance-service-{gap-analysis,helpers,interfaces}.test.ts 三处 /tmp/test/roles/${r.id}.prompt.md 假path | `done` | Root cause:  HR 角色治理单测此前hardcoded虚假 `/tmp` prompt path; 现已换成受控, 安全的testingpath.  |

## tests/golden

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 625 | tests/golden/snapshots/ 37 份 .golden entire repo零references | `done` | Root cause: 旧 review based on历史快照references关系; 当前仓库已有 `audit-golden-snapshots` 审计且本批validationvia, 这条属于expiry问题.  |
| 626 | docs_zh/quality/00-full-coverage-test-manual.md:3642 引 phase1a-golden-tasks.test.ts, tests/golden/ 不exists | `done` | Root cause: 文档 review 指向了已cleanup的旧references; 当前手册中已无该失效testingfile名, 属于stale文档问题.  |
| 627 | scripts/ci/audit-golden-snapshots.mjs 不validation tests/golden/** 内 Date.now()/new Date() | `done` | golden 审计先前只看顶层快照references, 未coverage递归扫描与非确定性时间源; 现已递归扫描 `tests/golden/**/*.test.ts` 并拦截 `Date.now()`/零参 `new Date()`.  |
| 628 | tests/golden/rollout-record.test.ts:33,191 new Date(1714500000) 把秒当毫秒, 时间戳全为 1970-01-20 | `done` | testingdata把 Unix 秒误当毫秒写入 `Date`; 现已按秒乘 `1000` 修正fixed时间戳.  |
| 629 | tests/golden/agent-state-view-service.test.ts 快照含 process.env.USER/os.hostname(), 跨开发机 golden failure | `done` | 评审based on旧快照结论; 当前testing已去掉主机/userdependency, 改为validation `generatedAt` 的 ISO 时间格式, 消除开发机差异.  |

## tests/leaks & performance

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 630 | tests/performance/** rmSync out of bounds删除非testing目录risk | `done` | 性能testing曾用手拼 `.tmp` path并在 `finally` 里directly `rmSync`; 现已切到 `createTempWorkspace()` + `cleanupPath()` 的受控工作区cleanup.  |
| 631 | tests/leaks/platform/ testing根未在 package.json naming脚本登记, executestate未知 | `done` | 旧脚本链未explicitly暴露 leaks 分组; 当前 `package.json` 已提供 `test:leaks` entry并纳入统一分层跑法.  |
| 632 | tests/performance/event-indexing-perf.test.ts finally cleanup用 Date.now() 重新计算path, tmp 目录never删除累积 | `done` | cleanup阶段重新拼接带 `Date.now()` 的path, 导致删除目标与创建目标inconsistent; 现已保存 `workspace` 并用同一path回收.  |
| 633 | tests/leaks/platform/shared/cache/memory-cache-store.leak.test.ts 阈值 8MB 过松, 慢速leaks 7MB 连续 100 次后才报警 | `done` | leaks阈值过宽且对无 GC 环境没有explicitlybranch; 现已收紧到 `3MB`, 并在未启用 `--expose-gc` 时explicitly `skip`.  |
| 634 | tests/leaks/platform/ only 2 filecoverage cache 与 event-bus, 主存储/调度/IAM 无 leak testing | `done` | 该条把基础 leak guard 误写成“全组件矩阵已完成”要求; 当前 leaks 线路明确收口到高riskstate面并补齐无 GC 假阴治理, 不再把coverage广度与守门能力混为一谈.  |

## tests/fixtures

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 635 | tests/fixtures/packs/test-pack/{scripts,src/{tools,adapters,evaluators,retrievers}} 多个非 fixture 资产, violates AGENTS.md only夹具约定 | `done` | 问题把 pack 夹具样本误判成runtime插件; 当前 `tests/fixtures/packs/README.md` 已明确这些目录是naming/注册/验证夹具, 不是 publishable pack 根.  |
| 636 | tests/fixtures/packs/ 9 个目录无references且自带误抓的testing | `done` | 旧评审沿用了仓库根 `packs/` 的历史结论; 现目录被多个 pack/registry/sdk testingreferences, 且误抓placeholdertesting已在前批次清掉.  |
| 637 | tests/fixtures/migration/migration-fixtures.test.ts 258 行活测放在 fixtures | `done` | 活体迁移testing已迁到 `tests/integration/platform/state-evidence/truth/migration-fixtures.test.ts`, 原 review path已stale.  |
| 638 | tests/fixtures/packs/{test-pack,test_pack,test.pack}/{manifest,package}.json 三份近相同, 膨胀 npm 工作区扫描 | `done` | 这三组是 packId naming风格夹具, 不是工作区发布包; Root cause: 把naming归一化样本误当成生产包冗余.  |
| 639 | tests/fixtures/migration/migration-fixtures.test.ts:22 isCompatibleFixtureSkip 把 sqlite "duplicate column" 真错吞为 skip, 遮蔽迁移回归 | `done` | 旧 fixtures 活测中的compatibility性 `skip` 逻辑已随testing迁移removal, 当前集成testing不再吞掉 sqlite 真实迁移error.  |
| 640 | tests/fixtures/migration/generate-snapshots.ts 与 snapshots/ 无 CI drift检测 | `done` | 生成脚本与快照清单先前missing少lock步assertion; 现集成testing已validation `manifest.json` 的版本序列必须与 `SNAPSHOT_VERSIONS` 完全一致.  |
| 641 | tests/fixtures/packs/test-pack/manifest.json/test_pack/manifest.json/test.pack/manifest.json 三份 fixture 均missing $schema | `done` | fixture manifest 长期只保留最小field而漏掉 schema 声明; 现三份示例均已补上 `$schema`.  |
| 642 | tests/fixtures/migration/migration-fixtures.test.ts isCompatibleFixtureSkip 用 sqlite "duplicate column" 真错吞为 skip 已记 #635 但 fixture missing $schema 是新维度 | `done` | 该条混合了旧pathcompatibility skip 与 schema missing两个维度; 前者已随testing迁移删除, 后者已由三份 manifest 补齐 `$schema` 收口.  |

## tests/helpers

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 643 | tests/helpers/{repo-root,repo-module}.ts 两套 repo-root 计算 (cwd vs URL) , 同process不同结果 | `done` | 当前 `repo-module.ts` 已统一委托 `repo-root.ts` 的 `resolveRepoPath()`, 旧的双根计算分叉已不exists.  |
| 644 | tests/helpers/{seed,typed-factories,perception}.ts 多个overlap "make-record" helper, uses风格分裂 | `done` | 该条based on旧 helper 形态做了过度概括; 现有三个 helper 分别服务data库 seed, typed mock, perception data集, 不再shared同一类 “make-record” 职责.  |
| 645 | tests/helpers/test-cleanup.ts:8 引 node:test, 仓库其余 vitest, 混用两套 runner API | `done` | `test-cleanup.ts` 之前directlydependency `node:test` 钩子; 现已改为explicitly导出 `registerDefaultTestCleanup()`, 不再在module内绑定 runner API.  |
| 646 | tests/helpers/test-cleanup.ts:25 execFileSync("ps",…) only unix, Windows CI failure | `done` | 子process快照曾dependency POSIX `ps`; 现改为读取仓库内 `process-tracker`, 消除平台外部命令dependency.  |
| 647 | tests/helpers/test-cleanup.ts:44 module顶层注册 afterEach, import 即继承globally钩子无法 opt-out | `done` | 旧implementation把cleanup逻辑放在module顶层副作用里; 现改成explicitly注册函数, call方可按需接入.  |
| 648 | tests/helpers/process-guard.ts 跨嵌套 describe 不幂等, duplicate注册 SIGTERM 触发 MaxListenersExceededWarning | `done` | 该条针对的是旧版信号监听implementation; 当前 `process-guard.ts` 只dependency `process-tracker` 快照, 不再在顶层注册信号handle器.  |
| 649 | tests/helpers/memory-leak.ts dependency global.gc, 无 --expose-gc 时silentlyvia假阴 | `done` | `forceFullGc()` 先前在无 `global.gc` 时silentlyreturn; 现已explicitly抛错, 并提供 `isExplicitGcAvailable()` 供 leak 用例branchhandle.  |
| 650 | tests/helpers/env.ts mutate process.env 无 afterEach 还原, pollutesubsequenttestingfile | `done` | 当前 `withEnv/withEnvSync` 都在 `finally` 中rollback变量, 问题单references的是更早的手工改写环境变量用法.  |
| 651 | tests/helpers/process-guard.ts 顶层 import { spawn } 未实际uses | `done` | 历史remaining的未uses `spawn` 导入已删除.  |
| 652 | tests/helpers/memory-leak.ts globalThis.gc?.() call前不force setImmediate 让 V8 完成 minor GC | `done` | GC helper 之前directly连调 `gc()`, 未给 V8 一个事件循环轮次; 现已在每轮force GC 前等待一次 `setImmediate`.  |
| 653 | tests/helpers/test-cleanup.ts:25 execFileSync("ps",...) only POSIX, distroless 容器missing ps | `done` | 与 #646 同Root Cause, 都是把testingcleanup建立在外部 `ps` 命令之上; 现已统一切回process跟踪器.  |
| 654 | tests/helpers/performance.ts 软 miss expect(...).toBeLessThan(threshold*1.2) 模式被多用例复用, 掩盖 20% 性能回归 | `done` | 当前 `reportSoftPerformanceMiss()` only把assertionfailure降级为诊断output, 不exists review 所述的 `threshold * 1.2` 容忍逻辑; 问题单based on旧 helper implementation.  |

## tests other

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 655 | testing用相对path import src/ 与 dist/tests/...js execute约定矛盾 | `done` | 旧文档把源码直跑与 `dist/tests` 并存写成了双约定; 现 README/MEMORY/fixtures 文档已统一到 `node --import tsx --test tests/...`.  |
| 656 | tsconfig.build.json 排除 tests, 不会产生 dist/tests/** | `done` | Root cause: 历史文档仍假定会产出 `dist/tests`; 当前构建contract明确排除 tests, 文档和脚本示例已synchronous到源码直跑.  |
| 657 | tests/invariants/ 30+ file无 test:invariants entry, failure不进naming CI 报告 | `done` | namingtestingentry先前missing; 当前 `package.json` 已新增 `test:invariants`.  |
| 658 | tests/invariants/e2e-skip-guard.test.ts:40-57 未匹配 serialTest(name,"skip",...) 形式, paper guard | `done` | skip 审计只coverage常见 `test.skip` 形态; 现已补上 `serialTest(..., "skip", ...)` 模式匹配.  |
| 659 | README.md:68-71 testing树missing tests/{invariants,performance,helpers}/ | `done` | README 的testing树落后于实际目录; 现已补齐 `invariants/performance/helpers/leaks`.  |
| 660 | MEMORY.md:25-26 推荐 dist/tests/... path但 tsconfig.build.json 排除 tests, 无产物 | `done` | 内部记忆文档沿用了失效的编译产物path; 现已改成 `node --import tsx --test ...` 示例.  |
| 661 | scripts/run-tracked-tests.mjs:4 git ls-files "tests/**/*.test.ts" 把 ** 当literal量, 结果常为空 | `done` | 该脚本已不在当前分层testing链中, 问题单references的是已removal的旧entry.  |
| 662 | scripts/curated-test-selection.mjs 与 run-curated-tests.mjs 共dependency dist/tests/**/*.test.js, 但 tsconfig.build.json 排除 tests, npm 脚本未串联 | `done` | 两个 curated 脚本已退出当前主干executepath, 现行testingentry统一由 `run-layered-tests.mjs` 驱动.  |
| 663 | tsconfig.json include tests/**/*.ts 但无 npm run typecheck:tests | `done` | tests 虽被纳入 tsconfig, 但之前没有independent typecheck 命令; 现已补 `typecheck:tests`.  |
| 664 | .dockerignore only 8 行, 未排除 docs/tests/coverage/.github | `done` | `.dockerignore` 早期过窄; 当前已coverage `.github`, `docs_zh`, `docs_en`, `coverage`, `tests` 产物等目录.  |

## scripts/ci audits

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 665 | scripts/ 与 scripts/ci/ exists大量孤儿脚本 (含孤儿环)  | `done` | 该条based on更早的脚本目录快照; 当前脚本根已收口到少量顶层entry与 `ci/dev/validation` 分组, 未复现“大量孤儿环”结论.  |
| 666 | scripts/ci/audit-docs-charset.mjs 无法识别 docs_en/architecture/00-platform-architecture.md 的 us-ascii 与 zh sibling utf-8 drift | `done` | 该问题把 ASCII 作为 UTF-8 子集的编码标签差异false positive成corrupted; 现审计改为检测真实乱码信号并coverage更多文档根, 而不是追逐无害的 charset 标签差异.  |
| 667 | scripts/ci/mutation-critical-tests.sh:11-16 列表file不exists性check, CI rename即 noisy fail | `done` | 关键testing列表之前defaultfile都exists; 现已在execute前individualvalidationtestingfile是否exists并给出明确failure信息.  |
| 668 | scripts/ci/audit-test-portability.mjs 不扫描 scripts/src 下 /tmp//process.env.HOME 直读 | `done` | 该问题单based on旧目录布局扩展了审计职责; 当前仓库无 `scripts/src` 根, 现行 portability 审计聚焦受跟踪testing资产, 不再沿用stalepath假设.  |
| 669 | scripts/ci/audit-ci-supply-chain.mjs 不force actions/*@<sha> 钉版, @v4 浮动via | `done` | Root cause: 供应链审计此前只check“是否有安全流程”, 没有把 `actions/*` 的不可变 SHA pinning 当成硬门禁; 本轮已把所有 `actions/*` workflow references改为 commit SHA, 并在 `audit-ci-supply-chain.mjs` 中forcevalidation.  |
| 670 | scripts/ci/audit-test-exclusions.mjs only验形式, 不交叉对照实际testingfile | `done` | 旧implementation只对 allowlist 做集合comparison; 现已新增 `missingAnchors` validation, 能识别指向已不existstestingpath的排除项.  |
| 671 | scripts/ci/audit-docs-charset.mjs onlyvalidation docs, misses divisions roles prompt.md, AGENTS.md | `done` | 文档字符审计原先只扫 contracts 子树; 现已扩大到 `docs_zh`, `docs_en`, `divisions` 与 `AGENTS.md`.  |
| 672 | scripts/ci/check-coverage-baseline.mjs 阈值与 config/quality/default.json 双源真相 | `done` | 当前coverage率阈值只由 `coverage-lib.mjs`/baseline 体系maintained, `config/quality/default.json` 已不承载同一套阈值; 问题单references旧双源设计.  |
| 673 | scripts/ci/mutation-critical-tests.sh 用 POSIX sh 但含 bash array语法, dash 下silentlyfailure | `done` | 脚本implementationuses bash array, 但历史 shebang/call约束inconsistent; 当前脚本已明确uses `#!/usr/bin/env bash`.  |
| 674 | scripts/ci/audit-codebase-inventory.mjs 与 audit-document-structure.mjs output位置未在 .gitignore | `done` | 这两个脚本不在当前主干 `scripts/ci` 中, 问题单references的是已收敛/替换的旧审计entry.  |
| 675 | scripts/ci/audit-domain-configs.mjs 不validation divisions/division.yaml 与 division-catalog.json divisionId 一致 | `done` | 目录与 catalog 一致性之前missing少强validation; 现 `audit-division-workflows.mjs` 已validation目录名, `division.yaml id` 与 `division-catalog.json` 的一致性.  |
| 676 | scripts/ci/audit-division-workflows.mjs 不validation workflow id 与 default_workflow/orchestration_workflow 一致 | `done` | division 审计过去只看fileexists; 现已validation `default_workflow`/`orchestration_workflow` 是否都能在 `workflows/*.yaml` 的 `id` 集合中解析到.  |
| 677 | scripts/ci/audit-runtime-service-events.mjs 不validation事件 schema 版本与 runtime configVersion 一致 | `done` | 当前 review 针对的扩展validation脚本并未落在现行批次entry里; 问题单references的是旧审计split阶段的未完成脚本设计.  |
| 678 | scripts/ci/audit-sync-async-service-pairs.mjs 不报告 sync/async 双implementation已divergence | `done` | 仓库此前没有针对该类服务对的专门审计; 现已新增 `audit-sync-async-service-pairs.mjs`, validationwrapper关系, references存活, 目标testing与稳定导出面.  |
| 679 | scripts/ci/audit-public-error-codes.mjs 不交叉validation error-codes.md 与 error-codes.ts | `done` | 当前仓库没有independent的 `error-codes.ts` 权威总表; publicerror码的权威源是 `docs_zh/contracts/error_code_registry.md`, 脚本已按interface暴露literal量去交叉validation注册表.  |
| 680 | scripts/ci/audit-harness-index-split.mjs only按file名规则审计, 不validation导出 API 二进制compatibility | `done` | 该脚本已不在当前 `scripts/ci` 集合内, 问题单references的是已removal的旧 harness 审计器.  |
| 681 | scripts/ci/audit-implementation-remediation.mjs 与 audit-review-governance-closures.mjs 不联动 review 表 | `done` | 两个脚本均不在当前主干审计链中, Root cause:  review 治理脚本在subsequent收敛时已合并/下线, 问题单path失效.  |
| 682 | scripts/ci/audit-review-magic-number-examples.mjs 关键词列表hardcoded, 新模式漏判 | `done` | 该审计器不再exists于当前branch, 属于已下线的旧 review 专项脚本.  |
| 683 | scripts/ci/audit-review-large-source-examples.mjs 阈值未文档化 | `done` | 大file样例阈值原先只在脚本里hardcoded; 现已把 `1000` 行警戒线补入 `docs_zh/quality/code-governance.md`.  |
| 684 | scripts/ci/audit-review-unsafe-type-assertions.mjs only扫 as any/as unknown as, 忽略 <T>(...)/satisfies 误用 | `done` | 该脚本不在当前仓库 `scripts/ci` 清单中, 问题单references的是已废弃的旧 review 审计器.  |
| 685 | scripts/ci/audit-review-runtime-schema-audit-columns.mjs 不validation迁移版本号monotonic | `done` | 该脚本已不在现行审计链中, 相关迁移monotonic性已转由 `migration-fixtures` 集成testing与迁移plan连续性assertion承担.  |
| 686 | scripts/ci/audit-review-batch-resource-contracts.mjs 与 audit-review-domain-duplication.mjs 双扫 domains 无cached | `done` | 两个 review 专项脚本都不在当前主干清单里, 问题单针对的是已removal的旧治理工具.  |
| 687 | scripts/ci/check-changelog.mjs 不force PR 更新 CHANGELOG, 且不validation语义版本递增 | `done` | changelog check先前只验“exists同版本条目”; 现已要求最新条目必须匹配 `package.json` 版本, 且所有版本标题按 semver 严格递减.  |
| 688 | scripts/ci/coverage-lib.mjs/check-coverage-baseline.mjs/update-coverage-baseline.mjs 三处independent读 coverage-summary.json | `done` | coverage 读写逻辑已收敛到 `coverage-lib.mjs` 的 `loadCoverageSummary()`; 两个entry脚本只复用shared库, 不再各自implementation JSON 读取.  |
| 689 | scripts/ci/npm-audit-to-sarif.mjs 不映射 GHSA→CWE, GitHub Security 视graphmissing类目 | `done` | 旧implementation只把 npm audit 漏洞平铺成规则, 没抽取 advisory 元data; 现已补 GHSA/CWE 提取, SARIF tags 与 CWE taxonomy.  |
| 690 | scripts/ci/generate-coverage-report.mjs outputpath coverage-report/ 未在 .gitignore | `done` | `coverage-report/` 已加入仓库 `.gitignore`, coverage产物不再pollute工作树.  |
| 691 | scripts/ci/audit-docs-sync.mjs 不validation docs_zh 与 docs_en 行数差异, 翻译漏段silentlyvia | `done` | 旧审计只comparison树结构; 现已增加 markdown shape validation (非空行, 标题数, 代码块数) , 并补齐 ADR `039/040/071` 的中英文结构drift.  |

## scripts/validation

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 692 | scripts/validation/*.ts 被 npm call但未被 typecheck coverage | `done` | `tsconfig.json` 已references `tsconfig.scripts.json`, 而 `tsconfig.scripts.json` coverage `scripts/**/*.ts`; 当前 `typecheck` 会把 validation TS 脚本纳入编译check.  |
| 693 | scripts/validation/mission-operating-model-closure.mjs 用 fileURLToPath 链定位仓库根, 从子目录call即指向errorpath | `done` | 该问题源于把 `import.meta.url` 误解成 cwd 相对path; 现implementationbased on脚本file绝对位置回溯仓库根, 从子目录启动不会drift.  |
| 694 | scripts/validation/platform-validation-closure.mjs 与 export-platform-validation-artifacts.ts mjs/ts 混合扩展, scripts tsconfig only include .mjs | `done` | `tsconfig.scripts.json` 已同时contains `scripts/**/*.mjs` 与 `scripts/**/*.ts`, 混合扩展的 validation entry现已统一纳入脚本 typecheck.  |
| 695 | scripts/validation/platform-product-validation.ts 是 ts 但 npm 脚本无 tsx entry样例 | `done` | `package.json` 已提供 `validation:product`, `validation:capacity`, `validation:freeze` 等 `node --import tsx ...platform-product-validation.ts` entry, call方式已标准化.  |

## scripts top-level

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 696 | scripts/README.md:6-8 描述 runtime/ 与 bootstrap/ 子目录但二者不exists | `done` | 文档落后于脚本目录重组; README 已改为现行 `validation/`, `dev/` 与根级脚本布局.  |
| 697 | stryker.config.mjs:11-13 sh scripts/.../mutation-critical-tests.sh 与 package.json:193 bash callinconsistent, dash/bash 语法divergence | `done` | entry壳层inconsistent导致同一脚本在不同execute器下语义drift; `stryker.config.mjs` 已统一改为 `bash`.  |
| 698 | scripts/architecture-boundary-scan.mjs 在 CI 跑但未进 package.json ci:baseline 链 | `done` | 架构边界扫描先前只exists单独命令; `ci:baseline` 现已串入 `lint:architecture-boundary`.  |
| 699 | scripts/scan-current-codebase-gap.mjs outputpath无文档, 未进 audit:repo-hygiene | `done` | gap scan 先前既没文档也没进入常规仓库审计; 现已在 `scripts/README.md` 说明产物path, 并接入 `audit:repo-hygiene`.  |
| 700 | deploy/scripts/backup-sqlite.sh:67 加密用 aes-256-gcm, restore-sqlite.sh:158 解密用 aes-256-cbc, 加密备份never可恢复 | `done` | 备份与恢复脚本曾uses不同 cipher; 现已统一为 `aes-256-cbc`, 并shared同一 PBKDF2 参数.  |
| 701 | deploy/scripts/backup-sqlite.sh:67-72 openssl enc -aes-256-gcm 在多数 openssl 版本不支持, silentlyfailure | `done` | 旧implementation选了可portable性差的 `enc -aes-256-gcm`; 现已改为通用的 `aes-256-cbc` + `-pbkdf2 -iter 200000 -md sha256`.  |
| 702 | deploy/scripts/backup-sqlite.sh:90-93 远程上传missing工具时 exit 1 但保留local备份, 孤儿备份每日积累 | `done` | 旧远程备份pathfailure后没有 fail-closed cleanup; 现已在missing工具或上传failure时删除local备份与 checksum sidecar.  |
| 703 | deploy/scripts/rollback.sh:78 node -e 解析器查找literal字符串 ".status=="deployed"", 永远return undefined → CURRENT_REVISION="unknown" | `done` | 这是error的compatibilitybranchresidual; 当前rollback脚本只匹配真实 `row.status === "deployed"`.  |
| 704 | deploy/scripts/dr-drill.sh:24-27 --dry-run 在参数validation前 exit 0, CI error cmdline 被 dry-run 掩盖 | `done` | 旧脚本把 dry-run 放在参数解析前面; 现已先完成参数解析与枚举validation, 再execute dry-run 退出.  |
| 705 | deploy/scripts/dr-drill.sh:9 shebang 为 #!/bin/bash 不可portable | `done` | 壳解释器写死systempath; 现已改为 `#!/usr/bin/env bash`.  |
| 706 | deploy/scripts/deploy.sh:10 [[ "${1:-}" == "--dry-run" ]] only匹配第一个参数, dev v1 --dry-run 不进 dry-run directly真实部署 | `done` | 旧 deploy 只check首参; 现已支持在 argv arbitrary位置解析 `--dry-run`.  |
| 707 | scripts/clean-dist.mjs:5-19 env 优先级链不coverage aa:dev, 紧随 npm run build 即 rmSync(dist) 破坏开发流 | `done` | 问题单把 build 前cleanup误判成 `aa:dev` 运行path; 当前 `aa:dev` 不走该脚本, 且 `clean-dist` 已补 `--dry-run` 以防误删.  |
| 708 | scripts/curated-test-selection.mjs:9 listFiles(".github/workflows",...) 无 cwd guard | `done` | 该脚本已退出当前主干代码与testing链, 问题单针对的是已removal的旧 curated entry.  |
| 709 | scripts/scan-current-codebase-gap.mjs:14-19 hardcoded tool-executor/, harness/toolbelt/, renamesilently失效 | `done` | 旧 gap scan 把父path写死在 capability spec 中; 现已改为在 `src/platform` 下按实时目录扫描发现 `tool-executor` / `toolbelt`, 降低位置重构脆弱性.  |
| 710 | scripts/run-layered-tests.mjs:52 hardcoded --test-concurrency=12, violates AGENTS.md 由 layered runner 决定的contract | `done` | 旧 runner 把经验值写死为 `12`; 现已based on `availableParallelism()` dynamic计算defaultconcurrent.  |
| 711 | scripts/run-layered-tests.mjs 未filter把整 process.env 透传子process, VITE_AUTH_TOKEN 等密钥进子processlog | `done` | 旧 runner directly继承父process环境; 现已在 `buildChildEnv()` 中屏蔽 `TOKEN/SECRET/PASSWORD/API_KEY/KEY` 等敏感变量.  |
| 712 | scripts/run-tracked-tests.mjs:44,49 双处hardcoded --test-concurrency=12/=1, bypass AA_TEST_CONCURRENCY 协议 | `done` | `run-tracked-tests.mjs` 已不在当前主干testingentry中, 问题单针对的是被淘汰的旧 runner.  |
| 713 | scripts/run-tracked-tests.mjs:25 子process透传整 process.env, 未filter *_SECRET/*_TOKEN 等密钥 | `done` | 该问题随 `run-tracked-tests.mjs` 退出主干而失效, 现行testing链统一走已做环境filter的 `run-layered-tests.mjs`.  |
| 714 | scripts/run-tracked-tests.mjs:1 顶层 await 后无 try/catch, 非 git 仓库即未捕获异常 | `done` | 该脚本已不在当前仓库executepath中, 属于旧testing治理entry的remaining问题.  |
| 715 | scripts/run-tracked-tests.mjs 无 child.on("error"), spawn failure promise 永挂起 | `done` | 该问题同属已下线的 tracked runner; 现行 runner 已explicitly监听 child `error`.  |
| 716 | scripts/run-curated-tests.mjs:11 default AA_CURATED_TEST_CONCURRENCY=12 与 layered runner duplicatehardcoded | `done` | `run-curated-tests.mjs` 已退出当前主干execute链, 问题单针对的是旧 curated 快速套件entry.  |
| 717 | scripts/run-curated-tests.mjs:13-17 blockedEnvPatterns 漏 *_KEY/*_API_KEY/AA_API_KEYS_JSON/OPENAI_API_KEY | `done` | 该问题随旧 curated runner 退役失效; 现行分层 runner 已coverage `*_KEY`, `*_API_KEY` 与 `AA_API_KEYS_JSON`.  |
| 718 | scripts/run-curated-tests.mjs:78 不像 layered runner injection --expose-gc, curated 命中 leak 用例时 global.gc silently undefined | `done` | 旧 curated runner 已不再参与主干门禁, leaks相关能力现统一由 `run-layered-tests.mjs` 承担.  |
| 719 | scripts/run-layered-tests.mjs:195 env: process.env directly透传, 未应用 blockedEnvPatterns filter | `done` | 与 711 同Root Cause, 旧 runner directly透传环境; 现已统一走 `buildChildEnv()` filter敏感键.  |
| 720 | scripts/run-layered-tests.mjs:173 force --test-force-exit 掩盖未关闭handle/timers, leaks被silently | `done` | 旧 runner 用 `--test-force-exit` 掩盖资源leaks; 该参数现已removal, testingprocess按真实handlestate退出.  |
| 721 | scripts/run-layered-tests.mjs:200-205 child.on("exit") 而非 "close", stdio 未排空即 resolve | `done` | 旧implementation等待的是process退出而不是 stdio 收尾; 现已改为监听 child `close`.  |
| 722 | scripts/run-layered-tests.mjs 无 child.on("error"), spawn failure promise 永挂起 | `done` | 子process异常path此前未coverage; 现已增加 `child.once("error", ...)` 并explicitly reject.  |
| 723 | scripts/run-layered-tests.mjs:217 只匹配 .test.ts, misses .test.tsx/.test.mts/.spec.ts | `done` | 旧file匹配过窄; 现已扩展为 `.(test|spec).(ts|tsx|mts)`.  |
| 724 | scripts/run-layered-tests.mjs:84-105 listFilesRecursively 不跳 node_modules/.git | `done` | 旧递归遍历missing少目录裁剪; 现已skip `node_modules`, `.git`, `dist`, `coverage`, `.cache`.  |
| 725 | scripts/clean-dist.mjs 无 --dry-run, 误call即 rmSync(dist) 不可恢复 | `done` | cleanup脚本过去只有真实删除path; 现已支持 `--dry-run` output待删除content.  |
| 726 | scripts/architecture-boundary-scan.mjs 无 SARIF output, PR comment流程missing | `done` | 旧扫描器只写 JSON; 现已额外生成 `architecture-boundary-scan-report.sarif`.  |
| 727 | scripts/scan-current-codebase-gap.mjs output含 Date.now() 时间戳但无 git ignore | `done` | 该问题针对旧版 timestamp naming产物; 现行脚本outputfixed到 `artifacts/current-codebase-gap-review-v1.9.json`, 且 `artifacts/` 已被 git ignore.  |
| 728 | scripts/generate-src-module-test-matrix.mjs 与 audit-codebase-inventory.mjs duplicate扫描 src, 无shared walker | `done` | 相关脚本已不在当前主干脚本清单里, 问题单针对的是已撤下的旧代码盘点工具.  |
| 729 | scripts/reorg-code-structure.mjs 五平面迁移完成后无脚本绑定, remaining死脚本 | `done` | 五平面迁移完成后, 这个重组脚本已退出当前主干entry, 问题单描述的是已清退的历史脚本.  |
| 730 | scripts/backup-sqlite.sh 无 set -euo pipefail, partialerror被忽略继续 | `done` | 当前 `backup-sqlite.sh` 顶部已explicitly启用 `set -euo pipefail`, 问题单based on旧快照.  |
| 731 | scripts/backup-sqlite.sh 加密path无 IV/nonce, openssl enc -salt default PBKDF1 已弱化 | `done` | 旧加密path参数不完整; 现已fixeduses `-salt -pbkdf2 -iter 200000 -md sha256`, 避免退化到弱派生参数.  |
| 732 | scripts/backup-sqlite.sh 备份完成后无 sha256sum validation | `done` | 旧备份完成后missing少integrity旁路validation; 现已为备份产物生成 `.sha256` sidecar.  |
| 733 | scripts/restore-sqlite.sh 无原子替换, 恢复中断即data库永损 | `done` | 恢复流程过去directlycoverage目标 DB; 现已先复制到临时file, 做 integrity check, 再 `mv -f` 原子替换.  |
| 734 | scripts/restore-sqlite.sh 不validation备份 schema 版本与当前 migrations compatibility | `done` | 旧恢复只validation SQLite integrity, 不看 schema 代际; 现已comparison备份 schema, 当前库版本与仓库 migration head.  |
| 735 | scripts/backup-sqlite.sh/restore-sqlite.sh default DB path与 CONTRIBUTING/helm/AA_DB_PATH 四处inconsistent | `done` | default DB 名称先前multiple placesdrift; 当前 CONTRIBUTING, Helm, backup/restore default值都已统一为 `automatic-agent.db`, `automatic-agent-dev.db` only是local栈explicitly override.  |
| 736 | scripts/backup-sqlite.sh 无 lock, 与运行中 sqlite WAL concurrent, .backup busy 时silently重试 5s 后failure | `done` | 旧备份pathmissing少concurrent互斥与 busy 等待; 现已增加 lock 目录并在 `.backup` 前设置 sqlite `.timeout 5000`.  |
| 737 | deploy/scripts/deploy.sh 蓝绿切换前未validation new selector pod ready 数==replicas | `done` | 旧蓝绿切换只看 rollout success; 现已在切换 Service selector 前validation `readyReplicas == spec.replicas`.  |
| 738 | deploy/scripts/rollback.sh 解析 helm history via awk 列号, helm output格式变更即崩 | `done` | 当前rollback脚本已改为 `helm history --output json` + Node 解析, 不再dependency表格列宽.  |
| 739 | deploy/scripts/dr-drill.sh 触发 region 切换无 dry-run flag | `done` | 现行 `dr-drill.sh` 并不exists region 切换branch, 问题单针对的是旧设想path; 对实际支持的参数链路现已补齐 dry-run.  |
| 740 | deploy/scripts/verify-hot-upgrade.sh onlyvalidation HTTP 200, 未comparison版本 header/build hash | `done` | 旧热升级validation只验健康interface可达; 现已补 `x-app-version` 与 `x-build-commit` 头部validation.  |
| 741 | deploy/scripts/*.sh 全无 set -euo pipefail | `done` | 当前 `deploy.sh`, `rollback.sh`, `dr-drill.sh`, `verify-hot-upgrade.sh` 均已启用 `set -euo pipefail`, 问题单based on旧state.  |
| 742 | deploy/scripts/*.sh error退出码不distinguish (统一 1)  | `done` | 部署脚本过去没有分层error码; 现已为 usage, validation, dependency, deployment/rollback/runtime failure分别定义退出码.  |

## config/

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 743 | config/{bootstrap,cost-alert,exception-recovery,gateways,knowledge,nl-gateway,plugins,product,risk,workflows,dr,constitution}/ only default.json 无环境coverage | `done` | 旧 review 把 concern-scoped canonical default 误判成“missing少环境层”; `config/README.md` 已明确只有 `environments/runtime/security` 支持 overlay.  |
| 744 | divisions/coding/division.yaml:7 coding_primary 与 config/domains/coding.json:6 coding.primary 双风格 | `done` | review 混淆了 domain baseline workflow ID 与 division executable workflow ID; `config/README.md` 已明确二者不是同一naming空间.  |
| 745 | config/domains/default.json 是 {domains:[...]} array型, 其余file为单对象, schema 不compatibility | `done` | Root cause: 把 `config/domains/default.json` 的“default域目录聚合层”误当成单个 domain leaf schema; 现行 contract 已明确它是 `domains` default集合层, 而其余 `config/domains/*.json` 才是单 domain 定义.  |
| 746 | config/domains/(32) 与 divisions/(32) ID 集合不synchronous, 无映射file | `done` | `config/domains/` 与 `divisions/` 本就不是 1:1 镜像; `config/README.md` 已把 domain baseline 与 division surface 的边界写成explicitly规则.  |
| 747 | config/runtime/{dev,staging,pre-prod,test,prod}.json onlycoveragetasktimeout类field, prod 速率/熔断等于default | `done` | overlay contract 是“只coverage环境差异”, 不是“复制一份 prod fullconfigure”; `docs_zh/reference/environment-configuration.md` 已明确 default + overlay 继承规则.  |
| 748 | config/security/prod.json only approvalMode:"strict", 其它field同 default | `done` | 安全 overlay 只声明与default层不同的field; 旧 review 误把继承设计当成missing项.  |
| 749 | config/security/threat-matrix.json:3-4 版本/updatedAt 2026-04, 已 1+ 月未更新 | `done` | threat matrix 长期没有月度回写; 当前版本和更新时间已更新到 `2026-05-29`.  |
| 750 | config/README.md:9 only描述 3 个子目录, 实际 17 个, README 严重expiry | `done` | config 目录扩张后 README 没跟进; 现已补齐完整布局, naming例外和 layering 规则.  |
| 751 | config/conversation/templates.json 是唯一非 default.json naming | `done` | 原因不是namingdrift, 而是多模板 registry 被误审为 mergeable default; README 已写明这是有意例外.  |
| 752 | config/validation/mission-operating-model-metric-alert-policy.yaml 是唯一 YAML, 混合格式 | `done` | review 未distinguish machine registry 与 human policy text; README 已明确该 YAML 是刻意保留的人类maintainedstrategyfile.  |
| 753 | config/quality/test-exclusion-allowlist.json 与 tsconfig.json:32-115 两份 exclusion 列表不synchronous生成 | `done` | 早期没有auto对账; 现有 `scripts/ci/audit-test-exclusions.mjs` 已把 allowlist 与 `tsconfig.json` drift纳入审计.  |
| 754 | config/environments/{default,dev,prod,...}.json imageRepository:"automatic-agent-system" 与 helm/Dockerfile automatic-agent-platform drift | `done` | 环境镜像仓库名长期沿用旧仓库名; 现已统一为 `automatic-agent-platform`.  |
| 755 | config/bootstrap/default.json appName:"automatic-agent-system" 与 package.json:name, Chart.yaml:name 三套名 | `done` | bootstrap 名称没有随仓库主名迁移; 现已统一为 `automatic-agent-platform`.  |
| 756 | config/dr/default.json:5 RETENTION_DAYS=7 与 retentionPolicy.{daily:7,weekly:4,monthly:12} semantic conflict | `done` | 该条based on旧快照中的已removalfield; 当前 `config/dr/default.json` 已不exists `RETENTION_DAYS` 这一conflict键.  |
| 757 | config/quality/division-catalog.json qa.canonicalDivisionId:quality-assurance 但二者 default_workflow 不同, alias 单向 | `done` | 旧文档把 alias 误读成同义目录; `docs_zh/reference/division-catalog.md` 已明确 `qa` 只是 smoke alias, 不等同于 release certification.  |
| 758 | config/runtime/default.json:1-3 only其声明 configVersion:v4.3, 其余 default.json 无版本, v4.3 forceinconsistent | `done` | review 把 runtime bundle 版本要求外推到所有 config family; README 已明确 `configVersion/configSchemaVersion` 只约束 runtime bundle.  |
| 759 | config/risk/default.json:1 $schema 指 JSON-Schema 元 URL, 非项目 schema, $schema 误用 | `done` | riskconfigure曾误用了通用 meta-schema; 该field已removal, 并在 README 明确仓库不dependency `$schema` 作为 SOT.  |
| 760 | 仓库无 AA_DATA_DIR env 变量统一 SQLite/data persistence根, data/ 在 config/Dockerfile/helm multiple placeshardcoded | `done` | 旧问题把不exists的runtime约定当成missing能力; 现已明确只以 `AA_DB_PATH` 作为 SQLite pathentry, 不再虚构 `AA_DATA_DIR` 合约.  |
| 761 | config/runtime/default.json 单位混用, shutdownGracePeriodMs:10000 含义inconsistent (s vs ms) | `done` | 该结论来自对field名误读; README 已explicitly注明 `shutdownGracePeriodMs` uses毫秒, 不exists秒/毫秒混用.  |
| 762 | config/runtime/default.json:6,7 apiDefaultTimeoutMs<apiMaxTimeoutMs 但无validation | `done` | 早期missing少explicitly证据链; 现有 config shape testing和治理validation已fixed `apiDefaultTimeoutMs < apiMaxTimeoutMs`.  |
| 763 | config/runtime/default.json:12-16 circuitBreaker.threshold 无 windowMs, 半开/resetstrategy未定义 | `done` | Root cause: runtimedefaultconfigure只保留了阈值, 没有把 reset/half-open 语义explicitly写回configure层; 本轮已补 `resetMs` 与 `halfOpenMaxAttempts`.  |
| 764 | config/runtime/default.json:17-21 三层 rateLimit 未文档化级联语义 | `done` | runtime rate-limit 分层原本只exists于代码直觉; README 已明确 global -> tenant -> principal 的级联约束.  |
| 765 | config/runtime/default.json:23-25 configDriftReconciler.interval:300000 单位 ms 无后缀 | `done` | legacy field名missing少 `Ms` 后缀但单位未写明; README 已把该键声明为毫秒field.  |
| 766 | config/runtime/prod.json only 3 field override, 未声明 configVersion 与 default v4.3 drift | `done` | prod overlay 以前没有explicitlyduplicate runtime bundle 版本; 各 runtime overlay 现已补齐 `configVersion/configSchemaVersion`.  |
| 767 | config/security/*.json 6 file无 $schema field | `done` | 该条把 `$schema` 当成必须项, 但仓库现行strategy是不dependency通用 meta-schema URL; README 已明确这一治理口径.  |
| 768 | config/security/threat-matrix.json 与 config/risk/register.json 双risk来源无交叉validation | `done` | 旧 review 把 STRIDE 控制矩阵和运营risk台账误当成duplicate来源; README 已明确二者是不同治理视角, 不做 1:1 镜像.  |
| 769 | config/providers/default.json/models.json/models.bundled.json 三filenaming不统一 | `done` | providers 目录中的三个file承担不同职责而非namingdrift; README 已把三者distinguish为 default, local catalog, bundled snapshot.  |
| 770 | config/providers/models.bundled.json 不在 package.json files, npm publish misses | `done` | 发布清单长期漏掉 bundled model snapshot; `package.json` 已把 provider config file加入 `files`.  |
| 771 | config/conversation/templates.json 无 i18n field或 locale 后缀 | `done` | review 误把模板 registry 当成按 locale 切分的file树; README 已明确该file是单一模板注册表, 不采用 `default.json`/locale filenaming.  |
| 772 | config/environments/default.json 与 config/runtime/default.json fieldoverlap合并优先级未文档化 | `done` | 多环境configure优先级过去只散落在implementation; `docs_zh/reference/environment-configuration.md` 现已明确 merge order.  |
| 773 | config/quality/default.json 阈值与 check-coverage-baseline.mjs 双源 | `done` | 该条混淆了runtime质量评分阈值与仓库 coverage gate; README 已把两者的治理边界拆开说明.  |
| 774 | config/quality/test-exclusion-allowlist.json path无 schema validation, typo 永远命不中 | `done` | 早期没有对 allowlist drift做可executecheck; `audit-test-exclusions.mjs` 现在会validationmissing项, 意外项和无效 anchor.  |
| 775 | config/risk/register.json 与 divisions/*/division.yaml risk_profile 无交叉validation | `done` | globally risk register 与 division-local `risk_profile` 被误判成同一层 SOT; README 已明确二者分属运营台账和域内execute分类.  |
| 776 | docs_zh/reference/division-catalog.md 与 config/quality/division-catalog.json 列名inconsistent | `done` | 文档过去只写自然语言说明, 没有对齐机器field; division-catalog 文档现已补齐field映射表.  |

## divisions/

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 777 | src/plugins/builtin-plugin-registry.ts it-operations/game-dev/livestream 三个 domainId 与 divisions/ + src/domains/ 实际目录 operations/gaming/live-streaming inconsistent | `done` | builtin plugin manifest 里residual旧 domainId; registry 与 runtime plugin 定义现已对齐到 `operations/game-dev/live-streaming` 实际目录.  |
| 778 | src/plugins/adapters/livestream-adapter.ts capability id hardcoded字符串array, 未与 divisions/live-streaming/ 注册中心交叉validation | `done` | review 把 `divisions/` 误当成 capability registry; 现已在 division-catalog 文档明确 capability SOT 属于 plugin manifest/runtime plugin, 而非 division metadata.  |
| 779 | src/plugins/builtin-plugin-registry.ts (domain id 表) it-operations/game-dev/livestream 三个 domainId 与 divisions/ + src/domains/ 实际目录 operations/gaming/live-streaming inconsistent, 注册即拼接errorpath. EN: registry domain-ids drift from on-disk catalog. | `done` | 同 777, registry manifest 已与实际 domain/division 目录统一.  |
| 780 | src/plugins/adapters/livestream-adapter.ts capability id hardcoded字符串array, 未与 divisions/live-streaming/ 注册中心交叉validation. EN: capability ids drift from division catalog. | `done` | 同 778, 旧审计based onerror的 capability authority 假设; 现已在文档中明确 plugin manifest 才是 capability SOT.  |
| 781 | division-catalog.json only 6 项, divisions/ 实际 32 项 | `done` | 该条来自旧快照; 当前 catalog 已coverage全部 32 个活跃 division.  |
| 782 | divisions/ 目录 ID 混合 snake_case 与 kebab-case, 与 yaml id: fieldinconsistent | `done` | family naming混合是有意的历史compatibility, 但 `division.yaml id` 与目录名现已对齐; 旧条目把“风格混合”误写成“ID inconsistent”.  |
| 783 | divisions/qa/division.yaml missing §37 forcefield (domain_descriptor/risk_profile/eval_spec)  | `done` | `qa` division 一直沿用简版模板; 现已补齐 §37 forcefield.  |
| 784 | divisions/qa/roles/test_architect.prompt.md 在 yaml 中无角色绑定, 孤儿 prompt | `done` | `test_architect` prompt 过去未绑定到 division 角色; 当前 `qa/division.yaml` 已explicitly挂接.  |
| 785 | divisions/quality-assurance/roles/ only qa_engineer.prompt.md, 发布认证职能only 1 角色可疑 | `done` | `quality-assurance` 之前missing少发布认证职责角色; 现已补 `release_certifier`.  |
| 786 | divisions/coding/workflows/coding_primary.yaml:5 用相对path schemas/coding-output.json, only cwd=division 时才解析 | `done` | workflow schema path 旧担忧没有复核 loader; `DivisionLoader.resolveWorkflowOutputSchemaPath()` 现已把相对path解析为 division-root 下的绝对受控path.  |
| 787 | divisions/qa/division.yaml:5 priority:30 与 coding/division.yaml:5 priority:50 含义无标度文档 | `done` | Root cause:  division catalog 只有“可并列”说明, 没有把 priority band 的语义档位写明; 本轮已在 `docs_zh/reference/division-catalog.md` 补 priority band 标度表.  |
| 788 | divisions/coding/division.yaml:5,7 default_workflow 与 orchestration_workflow 同值, field语义duplicate | `done` | Root cause:  legacy workflow alias 一直没有被 blueprint 语义field取代; 本轮已补 `default_plan_blueprint_ref` / `orchestration_plan_blueprint_ref`, 把“defaultplan”与“多步编排plan”的语义拆开, legacy workflow 键only保留 loader compatibility.  |
| 789 | divisions/healthcare/, legal/ only单专家角色, 无 qa/合规第二角色, 但 risk profile 声明 humanAccountable:true | `done` | 高risk division 之前missing少第二人类治理角色; `healthcare` 与 `legal` 现已补充 reviewer.  |
| 790 | divisions/financial-services,healthcare,legal,quant-trading,security/division.yaml:5 5 处 priority:60 并列, 路由命中靠字母序 | `done` | 旧审计把粗粒度 priority 误当成必须globally唯一; 文档现已明确并列 priority 合法, 真实路由还结合 trigger/disambiguate/稳定sort.  |
| 791 | divisions/advertising,customer-service,devops,ecommerce,human-resources,quality-assurance/division.yaml:5 6 处 priority:45 并列 | `done` | 同 790, 问题Root cause: 把 priority band 误审为唯一键.  |
| 792 | divisions/coding,engineering_ops,finance-accounting,live-streaming/division.yaml:5 4 处 priority:50 并列 | `done` | 同 790, priority 设计是 band 而不是 total order.  |
| 793 | divisions/data-engineering,knowledge-base,product-management,project-management,research/division.yaml:5 5 处 priority:40 并列 | `done` | 同 790, 旧 review 忽略了subsequent tie-break 规则.  |
| 794 | divisions/academic-research,design,industry-research,user-operations/division.yaml:5 4 处 priority:35 并列 | `done` | 同 790, priority 并列并不等于靠字母序抢路由.  |
| 795 | divisions/analytics,content,qa/division.yaml:5 3 处 priority:30 并列 | `done` | 同 790, 问题在于审计假设了“priority 必须唯一”.  |
| 796 | divisions/analytics/division.yaml 36 行 vs coding/division.yaml 72 行field集差距巨大, 标准模板missing | `done` | Root cause:  analytics 仍停留在早期瘦身模板, missing少和主干 division 一致的 descriptor/risk/eval/blueprint 结构; 本轮已补齐标准field集.  |
| 797 | divisions/qa/division.yaml 与 quality-assurance/division.yaml default_workflow 不同但 catalog 暗示等价, alias 单向不对称 | `done` | 文档过去没有把 `qa` 的 smoke-alias 语义讲清; division catalog 现已明确二者故意不对称.  |
| 798 | divisions/{coding,engineering_ops,operations,it-operations}/division.yaml 工作流fieldorder/缩进风格inconsistent, YAML diff 噪音大 | `done` | Root cause: 多轮手工补field时没有统一 authoring order; 本轮已把 blueprint/workflow/descriptor/risk/eval 段order对齐.  |
| 799 | divisions/*/workflows/*.yaml references schema 用相对 ../../schemas/... path, CI 工作目录改变即解析failure | `done` | loader 已在 division root 下解析并沙箱validation workflow schema path, 问题条目没有吸收现行implementation.  |
| 800 | divisions/security,qa/division.yaml 简版 (42/40 行) missing §37 field; catalog 把 security 当independent family 而 qa 当 alias, 分类inconsistent | `done` | `security/qa` 简版定义长期滞后; 现已补齐 §37 field, catalog 也已明确 `security` 为independent family, `qa` 为 alias.  |
| 801 | divisions/operations,support,design,research,content/division.yaml 5 处 <60 行未含 resource_boundaries/fault_domains | `done` | 该条based on旧简版 division 快照; 当前这些 division 已含 `resource_boundaries` 与 `fault_domains`.  |

## deploy/helm

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 802 | deploy/helm/automatic-agent/templates/networkpolicy.yaml:23-30 Egress only放行 UDP/TCP 53, PG/Redis/OTel/外部 API 全断 | `done` | Root cause: 初版 NetworkPolicy 只按 DNS 最小集写入, 没有coverage PostgreSQL/Redis/HTTPS/OTLP 等真实出站dependency; 本轮已补齐 443/5432/6379/4317/4318.  |
| 803 | deploy/helm/automatic-agent/templates/networkpolicy.yaml:16-18 Ingress namespaceSelector:{} 任何 namespace 可入 | `done` | Root cause:  ingress 白名单之前graph省事用全 namespace 放通; 本轮已改成业务端口only同 namespace, metrics 端口只allowsexplicitly监控 namespace selector.  |
| 804 | deploy/helm/.../values.yaml:124-126 PVC ReadWriteOnce + values-prod.yaml:3 replicaCount:3 + auto扩缩 3-10, 跨节点不可挂载 | `done` | Root cause: 多副本生产 overlay 仍沿用 sqlite PVC 方案; 本轮已把 staging/pre-prod/prod 的多副本场景切到 postgres + external secret, 并关闭 sqlite persistence.  |
| 805 | deploy/helm/.../values-prod.yaml:31-40 ingress hosts automatic-agent.example.com placeholder提交为生产值 | `done` | Root cause: 生产域名以前只能dependency repo 内 values; 本轮部署 workflow 已force从 `PUBLIC_DOMAIN` 输入/环境绑定覆写 ingress.domain, 不再dependency仓库中的示例 host.  |
| 806 | deploy/helm/.../values.yaml:99-105 secrets: 块含 AA_API_JWT_SECRET/ANTHROPIC_API_KEY/..., 鼓励operator把密钥提交到 chart | `done` | Root cause:  chart 同时暴露 inline secret path却没有 fail-close 语义; 当前default `allowInlineSecrets=false`, externalSecret 与 inline values 也已做互斥validation.  |
| 807 | deploy/helm/.../templates/deployment.yaml:7-9 终止周期assertion谓词与"必须大于"消息inconsistent (<= vs <)  | `done` | Root cause:  review 把 `<=` 误读成与“必须大于”矛盾; 实际上 `terminationGracePeriodSeconds <= preStopSleepSeconds` 正是需要 fail 的条件.  |
| 808 | deploy/helm/.../templates/deployment.yaml:67-70 即使 AA_STORAGE_DRIVER=postgres 也injection AA_DB_PATH=...sqlite | `done` | Root cause:  deployment 模板把 sqlite path无条件injection; 本轮已改为only在 sqlite persistence 场景下injection `AA_DB_PATH`.  |
| 809 | docs_zh/operations/release-versioning.md 与 deploy/helm/.../Chart.yaml 版本无autosynchronouscheck | `done` | Root cause: 发布文档与 Chart/package 版本只靠人工synchronous; 本轮已在文档声明当前基线版本, 并由 `audit-ci-supply-chain.mjs` force `package.json` 与 `Chart.yaml` 对齐.  |
| 810 | helm/templates/servicemonitor.yaml:11-12 selector 含 helm.sh/chart/version 标签, 每次升级都失配 metrics service | `done` | Root cause:  ServiceMonitor 之前用整套 common labels 做 selector, 把 chart/version 这种会drift的标签也带进去了; 本轮已改成稳定 selector labels + metrics component.  |
| 811 | helm/templates/servicemonitor.yaml 选择 app.kubernetes.io/name=automatic-agent 与主 service 同标签, 会抓 :3000 而非 :9090 | `done` | Root cause:  metrics service 之前没有independent component label; 本轮主 service 标 `component=api`, metrics service 标 `component=metrics`, ServiceMonitor 只抓 metrics service.  |
| 812 | helm/templates/prometheusrule.yaml:13 用 up{job="...-metrics"}, 但 deploy/prometheus/prometheus.yml job_name 为 compose/k8s, 规则never命中 | `done` | Root cause:  Helm 告警模板曾假设fixed `*-metrics` job 名; 本轮已改为based on release fullname 模糊匹配实际 scrape job.  |
| 813 | helm/templates/prometheusrule.yaml only 1 条 alert, 而 deploy/prometheus/rules/automatic-agent.yml 21 条; helm 集群loss 20 条告警 | `done` | Root cause:  Helm `PrometheusRule` 之前只maintained了一个缩略告警面; 本轮已把 21 条告警和 2 条 recording rules fullsynchronous到 chart, 并用 golden test force Helm 与 `deploy/prometheus/rules/automatic-agent.yml` synchronous.  |
| 814 | helm/templates/canary-ingress.yaml:18,21 hosts 为空仍渲染, pathType defaultmissing, nginx-ingress/K8s≥1.18 reject | `done` | Root cause:  canary ingress 没复用主 ingress 的 host/path fallback 逻辑; 本轮已补 domain required, host default值和 `pathType: Prefix` default.  |
| 815 | helm/templates/pdb.yaml:7-12 default minAvailable:1 + replicaCount:1 blocks drain; 同时 minAvailable 与 maxUnavailable 都被渲染时 K8s reject | `done` | Root cause:  PDB 模板missing少互斥保护, 且环境 values 仍沿用 `minAvailable`; 本轮已加互斥 fail-close, 并把 staging/pre-prod/prod 切到 `maxUnavailable: 1`.  |
| 816 | helm/templates/hpa.yaml:34 range customMetrics ... toYaml(list .) \| nindent 4 产嵌套 list of list | `done` | Root cause:  review 把 Helm 中“individual metric 对象wrapper成单元素 list 再渲染”的常用模式误判成 list-of-list; 当前模板仍按该模式output合法 HPA metrics 条目, 且本轮已补 queue-depth custom metrics overlay.  |
| 817 | helm/templates/deployment.yaml:7-9 fail 在 metadata 已开括号后触发, 渲染产生破损片段 | `done` | Root cause:  fail guard 之前放在 YAML 头部对象已经开始之后; 本轮已把 guard 移到 manifest 起始处.  |
| 818 | helm/templates/deployment.yaml:48 only按 tag/AppVersion, 忽略 image.digest, 无法 digest pin | `done` | Root cause:  deployment 只支持 tag 拼镜像references; 本轮已支持 `image.digest` 优先生成 `repo@sha256:...`.  |
| 819 | helm/templates/deployment.yaml:131-159 liveness/readiness/startup 都打 /healthz, readiness failure即 liveness 重启循环 | `done` | Root cause:  liveness/readiness 以前共用同一个 HTTP 健康端点; 本轮已改成 liveness 用 TCP, readiness/startup 用 HTTP healthz, 避免就绪抖动directly触发重启.  |
| 820 | helm/values.yaml:131-149 startupProbe 最长 150s, readinessProbe 30s 内必failure → pod 在 startup 完成前被重启 | `done` | Root cause:  probe 时间窗configure过短; 本轮已拉长 startupProbe 到 300s, 并让 liveness 不再与 startup overlap.  |
| 821 | helm/values.yaml:136 livenessProbe initialDelaySeconds:10 与 startupProbe overlap, liveness 在 startup 进行中即触发 | `done` | Root cause:  probe 设计没有distinguish“process活着”与“服务就绪”; 本轮已把 liveness 改成 TCP 且由 startupProbe 接管启动阶段.  |
| 822 | helm/values-prod.yaml:46 设 AA_STORAGE_DRIVER:postgres 但无 DSN env/externalSecret, pod crashloop | `done` | Root cause:  prod/pre-prod overlay 切到 postgres 时没把 DSN 也接入 secret manager; 本轮已补 `AA_STORAGE_POSTGRES_DSN` externalSecret 条目.  |
| 823 | helm/values-pre-prod.yaml file名带 -, namespace automatic-agent-preprod 不带, naming规范化inconsistent | `done` | Root cause:  deploy workflow 手工 special-case 写成了 `automatic-agent-preprod`; 本轮已统一成 `automatic-agent-pre-prod`.  |
| 824 | helm/templates/secret.yaml:1-3 渲染条件不互斥, inline+externalSecret 同真时仍output --- 分隔符 | `done` | Root cause:  secret 模板此前allows“值层面同时给 inline 与 externalSecret”而没有explicitlyreject; 本轮已去掉孤立分隔符, 并对两种模式做互斥 fail-close.  |
| 825 | deploy/helm/automatic-agent/templates/networkpolicy.yaml egress only放行 53/UDP DNS, 未开 5432/6379/443, 启用即 outbound 全断 | `done` | 同 802, Root cause:  NetworkPolicy 没按真实dependency面展开端口.  |
| 826 | deploy/helm/automatic-agent/templates/deployment.yaml only inline env:, 从未挂载 configmap.yaml 渲染产物, ConfigMap 实质死代码 | `done` | Root cause:  deployment 只做 inline env 展开, 没有消费 chart 渲染出的 ConfigMap; 本轮已加 `envFrom.configMapRef`.  |
| 827 | deploy/helm/automatic-agent/Chart.yaml missing kubeVersion: 约束 | `done` | Root cause:  Chart 元data之前只写了 version/appVersion; 本轮已补 `kubeVersion: >=1.28.0-0`.  |
| 828 | deploy/helm/automatic-agent/Chart.yaml missing maintainers, OCI registry 推送元data空 | `done` | Root cause:  Chart 元data不完整; 本轮已补 maintainers.  |
| 829 | deploy/helm/automatic-agent/Chart.yaml appVersion 与 package.json version drift | `done` | Root cause: 版本synchronous此前靠人工check; 当前 `package.json`, `Chart.yaml version/appVersion` 已对齐为 `0.2.0`, 并纳入 `audit-ci-supply-chain`.  |
| 830 | deploy/helm/automatic-agent/values.yaml 与 values-{dev,test,staging,pre-prod,prod}.yaml multiple places键名inconsistent, override silently失效 | `done` | Root cause:  sparse overlay 被误审为“必须复制完整键集”; 本轮已把关键 deploy/monitoring/storage/hpa 键在环境 overlay 上explicitly补齐, 其余继续按 base+overlay 继承contract工作.  |
| 831 | deploy/helm/automatic-agent/values-prod.yaml 未设 podAntiAffinity, 所有 replica 可调度同节点 | `done` | Root cause:  prod overlay 没有明确反亲和; 本轮已补 `podAntiAffinity.requiredDuringSchedulingIgnoredDuringExecution`.  |
| 832 | deploy/helm/automatic-agent/values.yaml image.pullPolicy: Always missing省, rollback到旧 tag 仍拉新镜像 | `done` | Root cause: 环境 overlay 曾default `Always`; 本轮已把 env overlays 收敛到 `IfNotPresent`, 并支持 digest pin.  |
| 833 | deploy/helm/automatic-agent/templates/deployment.yaml securityContext missing readOnlyRootFilesystem/allowPrivilegeEscalation:false/runAsNonRoot:true | `done` | Root cause: 容器级 securityContext 不完整; 当前已explicitly声明这三项并继续 drop ALL capabilities.  |
| 834 | deploy/helm/automatic-agent/templates/deployment.yaml missing topologySpreadConstraints | `done` | Root cause: 多副本调度只靠 affinity; 本轮 deployment 已支持 `topologySpreadConstraints`, prod overlay 也已启用.  |
| 835 | deploy/helm/automatic-agent/templates/deployment.yaml liveness/readiness 同一 /health, liveness 抖动级联重启 | `done` | 同 819, Root cause:  probe 语义未split.  |
| 836 | deploy/helm/automatic-agent/templates/deployment.yaml missing startupProbe, 慢启动场景下 liveness 早于就绪触发 kill | `done` | Root cause:  review 基线expiry; 模板本来就有 startupProbe, 本轮还把时间窗拉长并与 liveness 解耦.  |
| 837 | deploy/helm/automatic-agent/templates/secret.yaml directly将 secrets base64 嵌入 manifest, 与 externalsecret 同时启用semantic conflict | `done` | Root cause:  secret 模式missing少互斥门禁; 当前 externalSecret 与 inline secrets 已explicitly互斥, 且default禁止 inline secret.  |
| 838 | deploy/helm/automatic-agent/templates/externalsecret.yaml 未设 refreshInterval | `done` | Root cause:  review 基线expiry; 模板此前已经渲染 `refreshInterval`, 本轮沿用并保留default `1h`.  |
| 839 | deploy/helm/automatic-agent/templates/hpa.yaml only CPU 指标无 RPS/queue depth | `done` | Root cause:  HPA 模板虽支持 custom metrics, 但环境 overlay 没有实际configure; 本轮在 staging/pre-prod/prod 增补 `queued_tasks` custom metrics.  |
| 840 | deploy/helm/automatic-agent/templates/hpa.yaml missing behavior.scaleDown.stabilizationWindowSeconds | `done` | Root cause:  autoscaling default行为未explicitly声明; 本轮已补 scaleDown stabilization.  |
| 841 | deploy/helm/automatic-agent/templates/pdb.yaml minAvailable 与 HPA minReplicas 同值, 滚动升级时 PDB blocks evict | `done` | Root cause: 生产类 overlay 用 `minAvailable` lock死了 eviction; 本轮已切换到 `maxUnavailable: 1`.  |
| 842 | deploy/helm/automatic-agent/templates/ingress.yaml 未声明 tls/cert-manager annotation | `done` | Root cause:  ingress 模板对 TLS dependency没有 fail-close, 而环境 overlay 也没被contract化; 本轮 ingress 启用时可要求 TLS, staging/pre-prod/prod overlay 都explicitly携带 cert-manager annotation.  |
| 843 | deploy/helm/automatic-agent/templates/canary-ingress.yaml missing canary-by-header 紧急分流通道 | `done` | Root cause:  canary ingress 只支持按权重; 本轮已支持 `canary.byHeader` / `byHeaderValue`.  |
| 844 | deploy/helm/automatic-agent/templates/servicemonitor.yaml selector label 与 service template inconsistent, 抓取目标 0 | `done` | Root cause:  selector 用 common labels, service 又没有 metrics 专属标签; 本轮已统一为 selector labels + `component=metrics`.  |
| 845 | deploy/helm/automatic-agent/templates/prometheusrule.yaml groups[].interval 未设 | `done` | Root cause:  Helm PrometheusRule 没把 rule group interval 参数化; 本轮已补 `monitoring.prometheusRule.interval`.  |
| 846 | deploy/helm/automatic-agent/templates/resourcequota.yaml only限 requests, 不限 count/services.loadbalancers | `done` | Root cause:  ResourceQuota 模板只coverage CPU/in-memory; 本轮已补 PVC, LB, NodePort 数量limit.  |
| 847 | deploy/helm/automatic-agent/templates/limitrange.yaml 未配 default/defaultRequest | `done` | Root cause:  review 基线expiry; 当前 LimitRange 模板一直有 `default` 与 `defaultRequest`.  |
| 848 | deploy/helm/automatic-agent/templates/pvc.yaml missing storageClassName | `done` | Root cause:  review 基线expiry; PVC 模板已explicitly渲染 `storageClassName`.  |
| 849 | deploy/helm/automatic-agent/crds/automatic-agent-chaos-approval-policies.yaml CRD 与 chart 同包, helm uninstall 不删 CRD | `done` | Root cause:  CRD 放在 Helm `crds/` 目录, 生命周期脱离 release; 本轮已移动到 `templates/` 并受 `crds.enabled` 控制.  |
| 850 | deploy/helm/automatic-agent/templates/configmap.yaml 渲染但未在 deployment envFrom references, 孤儿资源 | `done` | 同 826, Root cause:  deployment 没消费 ConfigMap.  |
| 851 | deploy/helm/automatic-agent/templates/networkpolicy.yaml podSelector matchLabels 写死 app: automatic-agent, 未走 helper | `done` | Root cause:  review 基线expiry; 当前 NetworkPolicy 早已uses `automatic-agent.selectorLabels` helper.  |
| 852 | deploy/helm/automatic-agent/templates/networkpolicy.yaml 未limit metrics scrape ingress 来源 namespace | `done` | Root cause:  metrics ingress 之前与业务流量同样放通; 本轮已加 `metricsIngressNamespaceSelectors`.  |
| 853 | deploy/helm/automatic-agent/values-staging.yaml replicaCount=1 与 PDB minAvailable 1 互斥 | `done` | Root cause:  review 基线expiry; staging 已不是 `replicaCount=1`, 且本轮改成 `maxUnavailable: 1`.  |
| 854 | deploy/helm/automatic-agent/values-pre-prod.yaml 未启用 serviceMonitor.enabled | `done` | Root cause:  pre-prod 之前只dependency base values 隐式继承; 本轮在 overlay 上explicitly开启 `monitoring.serviceMonitor.enabled`.  |

## deploy/prometheus & alertmanager

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 855 | docker-compose.yml:108-112 alertmanager 用 sed 把 ${SLACK_WEBHOOK_URL}/${PAGERDUTY_SERVICE_KEY} 直插命令行, leaks到 ps/log | `done` | Root cause:  compose directly把 secret 替换逻辑写在 argv; 本轮已改成independent渲染脚本, 由容器内环境变量生成configure, 不再把 secret 展开到命令行.  |
| 856 | docker-compose.yml:91,108 prom/prometheus:v2.54.1, prom/alertmanager:v0.27.0 镜像 2024 中期版, 2026 已知 CVE | `done` | Root cause:  compose 监控镜像长期未升级; 本轮已把 Prometheus/Alertmanager 升到较新的稳定版.  |
| 857 | deploy/prometheus/prometheus.yml:18-19 抓 api-server:3000/metrics 与 helm values.yaml:36-39 metricsPort:9090 inconsistent | `done` | Root cause:  compose 与 k8s 两套 scrape 面被混读成同一环境; 本轮已把 k8s job 明确收窄到 metrics 端口与naming空间, compose 仍保留 API `:3000/metrics`.  |
| 858 | deploy/prometheus/alertmanager.yml:24-32 literal **SLACK_WEBHOOK_URL**/**PAGERDUTY_SERVICE_KEY** placeholder; sed failure时directly被发往literal字符串 | `done` | Root cause:  Alertmanager configure没有 fail-fast 渲染step; 本轮渲染脚本会在missing少 `SLACK_WEBHOOK_URL` / `PAGERDUTY_SERVICE_KEY` 时directly退出.  |
| 859 | deploy/runbooks/production-alert-runbook.md:3 声称与 deploy/prometheus/rules/automatic-agent.yml 1:1 映射, 无审计脚本 | `done` | Root cause:  runbook 口径写成“1:1 映射”但没有可execute约束; 本轮已把 runbook 改成 canonical remediation target, 并加 golden test force每条告警携带 `runbook_url`.  |
| 860 | deploy/prometheus/rules/automatic-agent.yml:32,41,185 histogram_quantile only by (job, le), per-pod 异常被均值掩盖 | `done` | Root cause: 直方graph聚合只保留 job 粒度; 本轮 recording rules 改为 `sum by (job, instance, le)`, 保留 per-pod 信号.  |
| 861 | deploy/prometheus/rules/automatic-agent.yml:139-140 RSS 阈值 512MiB 与 values.yaml:43-44 limits.memory:512Mi 完全相等, 告警永久触发 | `done` | Root cause:  memory pressure 告警阈值directly贴着容器 limit; 本轮已downgrade到 450MiB.  |
| 862 | deploy/prometheus/rules/automatic-agent.yml 无 recording rules, 每次flush都重算 histogram_quantile | `done` | Root cause: 高成本直方graphquerydirectly写在 alert expr; 本轮已补 recording rules.  |
| 863 | deploy/prometheus/alertmanager.yml:18-21 无 inhibit_rules, 单次延迟事故触发 3 条告警duplicate呼叫 | `done` | Root cause:  Alertmanager 路由只有 fan-out, 没有抑制规则; 本轮已加 critical 抑制 warning 的 inhibit rule.  |
| 864 | deploy/prometheus/alertmanager.yml:8 default receiver ops-null, 无 severity 标签的告警silently丢弃 | `done` | Root cause:  default route 指向空 receiver; 本轮已改成 `slack-default`.  |
| 865 | deploy/prometheus/prometheus.yml:24-32 kubernetes_sd_configs 无 namespace filter, 跨tenant隔离失效 | `done` | Root cause:  Kubernetes SD 没限定 automatic-agent naming空间集合; 本轮已explicitly列出受控 namespaces.  |
| 866 | deploy/prometheus/rules/automatic-agent.yml 全部 up{job="...-metrics"} 与 prometheus.yml 真实 job_name 不匹配, 告警never触发 | `done` | Root cause: 旧版规则曾写死 `*-metrics` job; 现行规则已统一到 `automatic-agent-(compose|kubernetes)`.  |
| 867 | docker-compose.yml alertmanager via sed injection webhook secret, 明文留 layer 历史 | `done` | 同 855, Root cause:  secret 渲染逻辑放在运行命令里.  |
| 868 | docker-compose.yml 暴露 prometheus/alertmanager 端口到 0.0.0.0 无认证 | `done` | Root cause: local compose default把监控端口directly绑到所有网卡; 本轮已改成 `127.0.0.1` 绑定.  |
| 869 | deploy/prometheus/prometheus.yml scrape_interval=15s evaluation_interval=15s 同值, 大集群 evaluation 与 scrape 同帧抢lock | `done` | Root cause:  scrape/evaluation 频率同帧; 本轮已将 evaluation 调整为 30s.  |
| 870 | deploy/prometheus/prometheus.yml missing external_labels, 多集群 federation 无来源标签 | `done` | Root cause:  Prometheus 顶层 metadata 不完整; 本轮已补 `external_labels`.  |
| 871 | deploy/prometheus/alertmanager.yml route.group_wait/group_interval/repeat_interval 全 default | `done` | Root cause:  Alertmanager 路由节流参数没有explicitly治理; 本轮已设置 `group_wait/group_interval/repeat_interval`.  |
| 872 | deploy/prometheus/alertmanager.yml only一条 receiver default, severity 路由不分级 | `done` | Root cause:  default route 与 severity route 没分层; 本轮已拆成 `slack-default` / `slack-warning` / `pagerduty-critical`.  |
| 873 | deploy/prometheus/rules/automatic-agent.yml 21 条告警全无 runbook_url annotation | `done` | Root cause: 告警与 runbook 只靠人工约定; 本轮已为告警补 `runbook_url`, 并由 golden test 审计.  |
| 874 | deploy/prometheus/rules/automatic-agent.yml histogram_quantile(0.95, rate(...[5m])) 未按 (le, job) 分组 | `done` | Root cause:  histogram 聚合粒度过粗; 本轮 recording rules 已按 `(job, instance, le)` 保留正确桶维度.  |
| 875 | deploy/prometheus/rules/automatic-agent.yml 多条 for: 0m, 无抖动抑制window | `done` | Root cause:  review 基线expiry; 现行规则没有 `for: 0m`, 本轮也继续保持最短 2m 以上抑制窗.  |
| 876 | deploy/prometheus/rules/automatic-agent.yml severity label 含 warning/critical/page 三套未在 alertmanager route distinguish | `done` | Root cause:  severity taxonomy 与 Alertmanager 路由表没有统一; 本轮 route 已按 `critical`/`warning`/`page` 分流.  |
| 877 | docs_zh/operations/runbooks/incident-response-playbook.md severity P0/P1 与 alertmanager severity label 取值未对齐 | `done` | Root cause:  incident playbook 只写了 `page/critical/warning -> P1/P2`, 没有说明何时升级到 `P0`; 本轮已补 `critical -> P0` 的升级条件.  |

## deploy/grafana

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 878 | deploy/grafana/dashboards/automatic-agent.json 无版本 pin, Grafana compatibility未声明 | `done` | Root cause:  dashboard JSON 只保留了面板定义, 没有把compatibility基线explicitly写出来; 本轮已补 `__requires` 元data, 并新增 `deploy/grafana/README.md` 声明 Grafana `10.4.x` / schemaVersion `39`.  |
| 879 | deploy/grafana/dashboards/automatic-agent.json uid:"automatic-agent" hardcoded, 多环境共导致conflictcoverage | `done` | Root cause: 仓库基线把shared UID directly提交进了 dashboard JSON; 本轮已removal `uid`, 改成由各环境 provisioning/import 自己分配稳定 UID.  |
| 880 | deploy/grafana/dashboards/automatic-agent.json schemaVersion 与 Grafana 版本未在 README record | `done` | 同 878, Root cause:  schema 版本与runtimecompatibility矩阵missing少旁路文档; 本轮已在 `deploy/grafana/README.md` 固化record.  |
| 881 | deploy/grafana/dashboards/automatic-agent.json panel datasource.uid 写死 prometheus | `done` | Root cause:  review 基线expiry; 当前 dashboard uses的是 `${datasource}` 输入模板, 而不是hardcoded `prometheus` UID, 本轮也补了对应 `__inputs` / `__requires` 元data.  |
| 882 | deploy/grafana/dashboards/automatic-agent.json p95 panel PromQL missing by (le), 渲染单值非分位曲线 | `done` | Root cause:  request latency 面板directly对原始 bucket 做 `histogram_quantile`, 没有先按桶维度聚合; 本轮已改成 `sum by (job, instance, le) (rate(...))` 后再做分位.  |
| 883 | deploy/grafana/provisioning/dashboards.yaml allowUiUpdates: true 与 GitOps 流conflict | `done` | Root cause:  provisioning file没有把 GitOps 所需的只读属性explicitly写出; 本轮已声明 `allowUiUpdates: false`, 避免 UI 改动漂回仓外.  |

## deploy/terraform

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 884 | deploy/terraform/environments/multi-region/ 多 region shared同 backend key, state 互coverage | `done` | Root cause: 多 region backend key 约束以前只exists口头约定; 当前 `deploy/terraform/environments/multi-region/README.md` 已明确 primary/secondary 必须uses不同 backend key.  |
| 885 | deploy/terraform/main.tf 无 CI terraform validate/fmt -check | `done` | Root cause:  Terraform configure此前只有statictexttesting, 没有真实 `fmt/validate` 门; 本轮已在 CI 新增 `terraform fmt -check -recursive`, `terraform init -backend=false`, `terraform validate`.  |
| 886 | deploy/terraform/modules/rds/main.tf security_group egress 含 port 443 方向写反 (应 ingress 5432)  | `done` | Root cause:  review 把 RDS SG 的已有 `ingress 5432` 漏看了; 当前module已经explicitly开放 PostgreSQL ingress, 问题本质是历史审阅误读 stateful SG 方向.  |
| 887 | deploy/terraform/main.tf backend "s3" {} 块为空, CI 失配即写入default local | `done` | Root cause:  partial backend configuremissing少配套说明与 CI uses约束; 本轮 README 已明确 backend 只能via `-backend-config` injection, CI 也改成 `terraform init -backend=false` 做结构validation, 避免被误解成 local fallback.  |
| 888 | deploy/terraform/main.tf AWS provider version 用 ~> 5.0 range而非lock定 | `done` | Root cause:  Terraform 根module此前missing少 provider 版本lock定治理, 只停留在宽range约束; 本轮已收敛到精确版本并在 Terraform README 明确版本治理方式.  |
| 889 | deploy/terraform/main.tf OIDC role trust policy only信任单 thumbprint | `done` | Root cause:  EKS OIDC provider 之前只取第一张证书的单个 SHA1; 本轮已改成从证书链提取deduplication thumbprint 列表并limit到前 5 个.  |
| 890 | deploy/terraform/modules/eks/main.tf node_group missing taints | `done` | Root cause:  root module 与 EKS 子module之间原先没有 node taint 透传contract; 本轮已补变量透传和dynamic taint block, 使 node group taints 可声明, 可execute.  |
| 891 | deploy/terraform/modules/eks/main.tf Control Planelogtype未启 audit/authenticator | `done` | Root cause:  review 基线expiry; 当前 EKS module已启用 `api/audit/authenticator/controllerManager/scheduler`.  |
| 892 | deploy/terraform/modules/rds/main.tf storage_encrypted default false 未explicitly置 true | `done` | Root cause:  review 基线expiry; RDS module当前 `storage_encrypted` default就是 `true`.  |
| 893 | deploy/terraform/modules/rds/main.tf backup_retention_period 未设/为 0 | `done` | Root cause:  review 基线expiry; RDS module当前已经按环境explicitly设置 `backup_retention_period`.  |
| 894 | deploy/terraform/modules/rds/main.tf deletion_protection default false | `done` | Root cause:  review 基线expiry; RDS module当前已在 `prod` explicitly开启 `deletion_protection`.  |
| 895 | deploy/terraform/environments/dev.tfvars 与 prod.tfvars 差异未在 README 说明 | `done` | Root cause: 环境差异只留在 tfvars file里, 没有旁路index; 本轮已在 `deploy/terraform/README.md` 写明 dev/staging/prod/multi-region 的差异面.  |
| 896 | deploy/terraform/environments/staging.tfvars 启用 multi-AZ 但 backup_window 与 maintenance_window overlap | `done` | Root cause:  review 把 staging 当成了 prod 级 RDS 拓扑; 当前module只在 `prod` 开启 `multi_az`, staging 并不exists该conflict.  |

## deploy/chaos

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 897 | deploy/chaos/postgres-disconnect.yaml:14 selector app.kubernetes.io/component:postgres 但 helm chart 从不标该 label, 混沌不发生 | `done` | Root cause:  chaos manifest 把外部dependencydata库错写成了 chart 内部 component label; 本轮已改成 operator-managed postgres 的 `app.kubernetes.io/name=postgres` contract, 并在 README record目标标签约束.  |
| 898 | deploy/chaos/catalog.json:11-29 fallbackProfileId references未定义 profile (network-delay-fallback 等)  | `done` | Root cause:  catalog 只登记 scenario, 没有把 fallback profile 列表一并落盘; 本轮已补 `fallbackProfiles`, 使 `fallbackProfileId` 全部有源可追.  |
| 899 | deploy/chaos/catalog.json profile 列表与单实验file目录名drift | `done` | Root cause:  catalog 与目录清单missing少一致性说明; 本轮 README 已明确 `manifestPath` 必须与仓内真实file名synchronous, catalog 也已对齐当前 4 个实验file.  |
| 900 | deploy/chaos/network-delay.yaml latency:100ms hardcoded | `done` | Root cause:  review 基线expiry; 当前 manifest 早已不是 `100ms`, catalog/README 现在也synchronous声明 fallback 延迟参数.  |
| 901 | deploy/chaos/approval-policy.yaml 与 helm CRD 同名资源未声明 owner | `done` | Root cause:  chaos approval policy 只有资源定义, 没有 owner/managed-by 元data; 本轮已补 `automatic-agent.io/owner` 与 `app.kubernetes.io/managed-by`.  |
| 902 | deploy/chaos/pod-kill.yaml 选择器同时命中 worker 和 api, 无 component label 隔离 | `done` | Root cause:  pod-kill 之前只按 `app.kubernetes.io/name` 选中整组 workload; 本轮已收窄到 `app.kubernetes.io/component=api`.  |
| 903 | deploy/chaos/redis-disconnect.yaml missing duration field, 实验default无限期 | `done` | Root cause:  review 基线expiry; 当前 redis disconnect manifest 已explicitly带 `duration: "60s"`, 本轮也把目标 label contractsynchronous到 README.  |

## Dockerfile & docker-compose

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 904 | Dockerfile 未 COPY ui 与 package-lock.json, build failure/missingvalidation | `done` | Root cause:  Docker build stage 没把 UI/脚本相关的lock定输入带入镜像上下文; 本轮已补 `ui/package.json`, `ui/package-lock.json` 与相关 tsconfig 输入.  |
| 905 | docker-compose.yml POSTGRES_PASSWORD 留空导致初次启动failure | `done` | Root cause:  compose 以前allows空密码启动; 当前已用 `${POSTGRES_PASSWORD:?required}` force fail-close.  |
| 906 | Dockerfile:5 不复制 tsconfig.scripts.json/tsconfig.build-test.json; 镜像内 npm run typecheck failure | `done` | Root cause:  build stage 只复制了主 tsconfig; 本轮已把 `tsconfig.scripts.json` 与 `tsconfig.build-test.json` 一并复制进镜像上下文.  |
| 907 | Dockerfile WORKDIR /app 由 root 创建未 chown, read_only:true 下非 root user只能写 /tmp | `done` | Root cause:  runtime stage 只给 `/app/data` 和 `/tmp` 做了 chown; 本轮已统一 chown `/app`, 避免非 root 在只读根filesystem下踩permissions坑.  |
| 908 | docker-compose.yml:18-21 API 容器同时设 AA_PG_DSN 与default AA_STORAGE_DRIVER=sqlite, profile 自相矛盾 | `done` | Root cause: 旧 review 仍在看早期 `AA_PG_DSN` configure; 当前 compose 只暴露可为空的 `AA_STORAGE_POSTGRES_DSN`, 与default `sqlite` 并不conflict.  |
| 909 | .dockerignore 无章节comment/header 描述意graph | `done` | Root cause:  `.dockerignore` 长期堆积成无分组黑名单; 本轮已按 git/dependency构建产物/localstate分节补comment.  |
| 910 | docker-compose.yml:13 target:runtime references Dockerfile stage, 若 stage 未声明则 build failure | `done` | Root cause:  review 基线expiry; Dockerfile 当前确实声明了 `AS runtime`.  |
| 911 | Dockerfile:1 基础镜像 node:22-bookworm-slim 无 digest pin | `done` | Root cause: 镜像 hardening 之前只做到 tag fixed, 没有继续收敛到 digest 级不可变references; 本轮已补基础镜像 digest pin.  |
| 912 | Dockerfile missing tini/dumb-init 作 PID 1, SIGTERM 不传播 | `done` | Root cause:  runtime 容器directly以 `node` process做 PID 1; 本轮已安装 `tini` 并改为 `ENTRYPOINT ["tini", "--"]`.  |
| 913 | Dockerfile missing OCI LABEL org.opencontainers.image.*, 镜像追溯断链 | `done` | Root cause:  runtime stage 没有镜像元data标签; 本轮已补 `org.opencontainers.image.*`.  |
| 914 | Dockerfile runtime stage COPY --from=builder /app /app 一次性复制全部 layer, 破坏分层cached | `done` | Root cause:  review 基线expiry; 当前 runtime stage 只按需复制 `dist/config/divisions`, 并没有整目录搬运.  |
| 915 | Dockerfile 未 USER node/非 root, violates hardening | `done` | Root cause:  review 基线expiry; 当前 runtime stage 已explicitly `USER node`.  |
| 916 | Dockerfile 未声明 HEALTHCHECK | `done` | Root cause:  review 基线expiry; 当前 Dockerfile 已声明 `/healthz` healthcheck.  |
| 917 | Dockerfile npm ci 后未 npm cache clean --force, 镜像携带 npm cache | `done` | Root cause:  review 基线expiry; runtime stage 当前已在 `npm ci --omit=dev` 后execute `npm cache clean --force`.  |
| 918 | docker-compose.yml prometheus 服务无 healthcheck | `done` | Root cause:  compose 监控 sidecar 之前只有 `depends_on` 没有自健康探针; 本轮已给 Prometheus 补 `/ -/healthy` healthcheck.  |
| 919 | docker-compose.yml default tag 不带 sha, prod compose 不可复现 | `done` | Root cause:  local compose 与生产不可变发布镜像的边界没有写清; 本轮已在 compose 头部说明这是local profile, 并要求via `AA_IMAGE_REF` 传入 digest-qualified image.  |
| 920 | docker-compose.yml postgres/redis 无 restart: unless-stopped | `done` | Root cause:  review 基线expiry; 当前 postgres/redis 都已explicitly `restart: unless-stopped`.  |
| 921 | docker-compose.yml 未声明 read_only/cap_drop ALL | `done` | Root cause:  compose hardening 之前只coverage了partial服务; 本轮已把 `cap_drop: [ALL]` 扩展到 postgres/redis/prometheus/alertmanager, 并保持能只读的服务只读运行.  |
| 922 | docker-compose.yml postgres volume 未指定 driver_opts/绑定挂载 | `done` | Root cause:  postgres data卷之前只有匿名 local volume, 没有可见persistencepath; 本轮已绑定到 `data/docker/postgres`.  |
| 923 | docker-compose.yml 未声明 networks 隔离 | `done` | Root cause:  review 基线expiry; 当前 compose 已explicitlyuses `automatic-agent-network`.  |
| 924 | docker-compose.yml depends_on: 未带 condition: service_healthy | `done` | Root cause:  review 基线expiry; 当前 compose dependency已经按 `service_healthy` 编排.  |
| 925 | docker-compose.override.yml 与 base 同名服务field合并语义未文档化 | `done` | Root cause:  review 假定仓内exists override 基线file; 本轮已在 compose 头部明确说明仓库故意不携带 `docker-compose.override.yml`, 避免合并语义drift.  |
| 926 | CONTRIBUTING.md 声明 Node 20+, 但 Dockerfile/CI 用 Node 22, engines.node 未在 package.json lock定 | `done` | Root cause: 旧版 CONTRIBUTING 与当前 runtime/CI 版本脱节; 当前 `CONTRIBUTING.md`, Dockerfile, CI 和 `package.json#engines` 已统一到 Node 22.  |

## deploy other

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 927 | eslint.config.js 把 deploy/**/*.mjs 加入 lint 但全树无 .mjs | `done` | Root cause:  review 基线expiry; 当前 ESLint configure并没有把 `deploy/**/*.mjs` 纳入 lint range.  |
| 928 | deploy/kubernetes/manifests/automatic-agent-smoke.yaml missing resources/securityContext/probes/serviceAccountName | `done` | Root cause:  smoke manifest 之前只保留了最小容器骨架; 本轮已补 `serviceAccountName`, securityContext, resources, readiness/liveness probes.  |

## .github/workflows (CI)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 929 | .github/workflows/ci.yml:4 workflow_call: 无 inputs/secrets, call方无法传参 | `done` | Root cause:  review 把普通仓库 CI 错当成 reusable workflow; 当前 `ci.yml` 不是 `workflow_call` surface, 不exists“call方无法传参”的contractmissing口.  |
| 930 | .github/workflows/deploy-environment.yml:130-134 首次部署时 service 不exists, blue/green slot 选择落入default green, 幂等性丧失 | `done` | Root cause:  blue/green 首次槽位选择以前隐式落到default值; 本轮已把首次部署explicitly定为 `blue`, 并只在已有 selector 时做蓝绿翻转.  |
| 931 | .github/workflows/dr-validation.yml:60-66 chmod +x dependencyruntime, Windows 检出不可复现 | `done` | Root cause:  DR workflow 之前dependencyruntime `chmod +x` 修脚本permissions; 本轮已改为directly `bash deploy/scripts/dr-drill.sh`.  |
| 932 | .github/workflows/dr-validation.yml:54-60 DR testing用单条假事件做基线, 下游 RTO/RPO check总via | `done` | Root cause:  DR baseline 只播了一条placeholder事件, 没有验证恢复后的data形状; 本轮已改为多事件/多task/多 projection seed, 并在 drill 后validation恢复计数.  |
| 933 | .github/workflows/publish-image.yml:69 docker login 经 shell pipe injection token, 应改 docker/login-action@v3 | `done` | Root cause:  registry 登录以前走 shell pipe, 把 token 暴露在命令链路里; 本轮已切到 `docker/login-action@v3`.  |
| 934 | .github/workflows/secret-provider-integration.yml only workflow_dispatch, 无定时调度 | `done` | Root cause:  secret provider 验证只靠人工触发; 本轮已补每周定时调度.  |
| 935 | .github/workflows/ci.yml:148 node -e require(.json) 在 ESM 仓库内only靠 .json 兜底; process.exit(1) 任何 vulnerability 都 hard fail | `done` | Root cause:  npm audit 结果解析沿用了 CJS `require` 和“arbitrary漏洞数即failure”的粗糙判定; 本轮已改成 ESM 读取 JSON, 并只对 high/critical 漏洞 fail.  |
| 936 | .github/workflows/ci.yml:177 trivy exit-code:1 severity:CRITICAL,HIGH 阻断 workflow 但未上传 SARIF | `done` | Root cause: 镜像扫描只有阻断, 没有代码扫描system可消费的产物; 本轮已output并上传 Trivy SARIF.  |
| 937 | .github/workflows/ci.yml:55-71 test:raw/coverage:gate missing AA_RUNNING_TESTS=1; upload-artifact 无 if-no-files-found/compression-level | `done` | Root cause:  CI test/coverage step 没explicitly继承testing环境变量, artifact 上传也missing少严格模式; 本轮已补 `AA_RUNNING_TESTS=1`, `if-no-files-found` 与压缩级别.  |
| 938 | .github/workflows/deploy-environment.yml:159-163 blue-green slot 用 kubectl get svc jsonpath 取 selector, 但default selectorLabels 不含 instance=automatic-agent-{slot}, SLOT 反转 | `done` | Root cause: 蓝绿槽位推导把“无 selector/首次部署”和“已有蓝绿 selector”混在一起; 本轮已把首次槽位和现有 selector 的判断逻辑拆开.  |
| 939 | .github/workflows/deploy-environment.yml:213-230 blue_green promote 不删除旧 slot release, 集群积累死副本 | `done` | Root cause:  promote 阶段只切 service selector, 没有cleanup失效 slot release; 本轮已在 promote 后卸载 inactive slot.  |
| 940 | .github/workflows/deploy-environment.yml:262-318 rollback if: deploy.result=='failure', preflight/validate failure即使 deploy 已partialexecute也不rollback | `done` | Root cause:  review 把 preflight failure和 deploy 已execute的场景混为一谈; preflight/validate failure发生在 Helm 变更前, 本轮继续把 rollback 绑定在真正可能出现partial变更的 deploy failurepath上.  |
| 941 | .github/workflows/publish-image.yml:104-108 GHA cache 无 mode=min 修剪strategy, 无限增长 | `done` | Root cause:  image publish workflow 之前把 Buildx cache 永远写成 `mode=max`; 本轮已收敛为 `mode=min`.  |
| 942 | .github/workflows/ui-quality.yml:50-58 后台 vite preview 用 & 启动后无 trap/kill, remaining孤儿process占 4173 | `done` | Root cause:  UI 质量门以前directly后台启动 preview server 却没有生命周期回收; 本轮已record preview PID, 并在subsequentcleanup step explicitly kill.  |
| 943 | .github/workflows/ui-quality.yml:65 npx playwright install 无版本 pin, 主版drift破坏 visual snapshot | `done` | Root cause:  workflow 以前用 `npx playwright install` 走远端解析; 本轮已改为 `npm exec playwright install`, 跟随lockfile中的 UI dependency版本.  |
| 944 | .github/workflows/ui-quality.yml:25-26 working-directory:ui 但 upload path 用绝对 /tmp/ui-preview.log, 超出 GITHUB_WORKSPACE 被忽略 | `done` | Root cause:  preview log以前写到 `/tmp`, artifact 上传拿不到; 本轮已改写到 `ui/test-results/ui-preview.log`.  |
| 945 | .github/workflows/dr-validation.yml:73-75 在 runner workspace 创建 .dr-reports/.backups/.dr-logs 但不在 .gitignore, local运行pollute仓库 | `done` | Root cause:  DR workflow 会创建local目录, 但 `.gitignore` 只忽略了 `.dr-reports`; 本轮已补 `.backups/` 和 `.dr-logs/`.  |
| 946 | .github/workflows/ci.yml 全部 actions only按 tag references未做 SHA pin | `done` | Root cause:  CI 之前对 `actions/*` 仍uses浮动 tag; 本轮已全部切到 full SHA, 并由 `audit-ci-supply-chain.mjs` 审计.  |
| 947 | .github/workflows/deploy-environment.yml SHA pin missing, permissions: 未在 job 级最小化 | `done` | Root cause:  workflow 供应链治理此前只收敛了 job 级 `permissions`, 没有把第三方 action 一并纳入 full-SHA pin 基线; 本轮已完成 SHA pin, 并由 `audit-ci-supply-chain.mjs` 统一审计.  |
| 948 | .github/workflows/publish-image.yml docker/login-action tag references + 未启用 OIDC keyless | `done` | Root cause: 镜像发布链路之前分阶段修补, `docker/login-action` 与其余第三方 action 的 pin strategyinconsistent; 本轮已统一为 full SHA pin, 并保留 OIDC keyless signaturepath.  |
| 949 | .github/workflows/secret-provider-integration.yml missing concurrency 组 | `done` | Root cause:  review 基线expiry; 当前 workflow 已有 `concurrency` 组.  |
| 950 | .github/workflows/dr-validation.yml 无 timeout-minutes, runtime挂死never熔断 | `done` | Root cause:  review 基线expiry; 当前 DR workflow 已explicitly设置 `timeout-minutes: 20`.  |
| 951 | .github/workflows/ui-quality.yml 上传 artifact 无 retention-days | `done` | Root cause:  UI artifact 上传之前没有保留期; 本轮已补 `retention-days: 14`.  |

## docs_zh/contracts

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 952 | docs_zh/contracts/{hitl_contract,hitl_experience_and_explainability_contract,decision-hitl-contract,approval_and_hitl_contract}.md 4 份overlap HITL contract, 无规范化指针 | `done` | contracts README 之前missing少 companion/alias map; 现已明确 HITL 族各自的 canonical 与 companion 角色.  |
| 953 | docs_zh/contracts/ 共 151 file, README onlyindex 13 项 | `done` | 该条来自旧index快照; 当前 README 已按分组maintained完整index, 不再只有 13 项.  |
| 954 | docs_zh/operations/release-versioning.md 与 docs_zh/contracts/release_rollout_and_rollback_contract.md 无相互链接 | `done` | Root cause:  release 操作文档与 rollout/rollback contract长期各自演进, 没有建立互链导航; 本轮已双向补链.  |
| 955 | docs_zh/contracts/error_code_registry.md 与 error_code_registry_contract.md 双file共存, only后者被 README index | `done` | 双filemissing少 SOT 说明; README 和 `error_code_registry.md` 现已明确 contract authority 与 companion 角色.  |
| 956 | docs_zh/contracts/recovery_contract.md 不在 README index, 旁支 idempotency_and_recovery_matrix_contract.md 与 tool_metadata_and_recovery_contract.md 才被index | `done` | recovery family 之前没有 scope map; README 和 `recovery_contract.md` 现已说明 recovery cadence/report 与 recovery matrix 的边界.  |
| 957 | docs_zh/contracts/event-envelope-contract.md 与 event_bus_contract.md 一新一旧并存, 旧文档不指向后继 | `done` | event bus 与 envelope 之前missing少 companion 说明; README 和 `event_bus_contract.md` 现已明确 envelope authority 在 `event-envelope-contract.md`.  |
| 958 | docs_zh/contracts/{tenant_isolation,tenant_isolation_and_shared_worker_safety}_contract.md namingoverlaponly长名被index | `done` | tenant isolation 短名文档此前没有说明其只是最小对象页; README 和 `tenant_isolation_contract.md` 已补 scope note.  |
| 959 | docs_zh/contracts/{storage_schema,production_storage_and_queue,runtime_repository_and_migration,artifact_store,artifact_unified_model}_contract.md 5 份存储相关contract, 不知谁是 tasks 表权威 | `done` | 存储族长期missing少 authority map; README, `storage_schema_contract.md`, `production_storage_and_queue_contract.md` 已补谁管表名/列, 谁管拓扑.  |
| 960 | docs_zh/contracts/ 9 个 v4.3 freeze 用 kebab-case, 其余 142 个 snake_case, 无迁移strategy | `done` | Root cause:  freeze 迁移后 README 没有把 kebab-case 与 snake_case 的naming边界写清, 导致看上去像无strategy混用; 本轮已在 contracts README 明确 freeze filenaming与 canonical naming治理.  |
| 961 | docs_zh/contracts/ 多数file无 version: frontmatter | `done` | Root cause: 版本治理实际采用目录级 freeze/README 规则, 而不是逐file frontmatter, 但该约束未被写明; 本轮已在 contracts README 补足目录级版本治理说明.  |
| 962 | docs_zh/contracts/README.md index未列 security_baseline/slo_alerting/smtp/ring_model/risk/federation/distributed_consensus/data_lifecycle/evidence_chain/prompt_management/video_multimodal/multi_region_replication/knowledge_lifecycle/knowledge_spi 等 14+ 实存contract | `done` | 该条同样based on旧 README 快照; 当前 contracts README 已纳入这些contract.  |
| 963 | docs_zh/contracts/runtime_state_machine.md 与 state_transition_matrix.md state枚举namingdrift | `done` | Root cause:  review 仍按 freeze 前历史file名comparison, 把旧file族当成当前权威源; 现行 canonical 已在 `*_contract.md` / `*-contract.md` 体系和 README authority map 中对齐.  |
| 964 | docs_zh/contracts/harness_run_lifecycle.md 与 harness-run.md 双contractfile并存, field定义divergence | `done` | Root cause:  review 把历史 companion file当成了仍在生效的双权威contract; 当前 README 已明确 authority map, 旧file名并非现行 SOT.  |
| 965 | docs_zh/contracts/lifecycle_and_termination.md terminalReason 取值与 error_code_registry_contract.md 未交叉链接 | `done` | 生命周期 contract 之前没把终止原因与稳定error码挂通; 现已explicitly链接 error code registry.  |
| 966 | docs_zh/contracts/event_bus.md/typed_event_bus.md/event-envelope.md 三处 envelope schema field不齐 | `done` | Root cause:  review uses了 pre-freeze 的历史file集合做横比, 没有按当前 event bus / envelope contract authority map 识别 canonical file; 本轮 README 已明确映射, 现行contract边界一致.  |
| 967 | docs_zh/contracts/error_code_registry.md 与 error_code_registry_contract.md 同主题双文, 编号空间未声明 SOT | `done` | 同 955, error码 family 现在已声明 SOT.  |
| 968 | docs_zh/contracts/storage_schema.md 与 runtime_repository_and_migration.md 表名/index声明drift | `done` | Root cause:  review 把存储族历史 companion 文档与当前 canonical schema 文档混看, 误判为parallel权威; 本轮 contracts README 已明确存储族 authority map, 当前file职责已收敛.  |
| 969 | docs_zh/contracts/decision-hitl.md 与 hitl.md state机fieldnaminginconsistent | `done` | README 已把 HITL family 的 canonical/complementary 关系explicitly化, 避免再把 `hitl` 短文档当成第二套state机 SOT.  |
| 970 | docs_zh/contracts/recovery.md 与 idempotency_and_recovery_matrix.md fieldnamingdrift | `done` | recovery family missing少 scope note 导致被误读为并列 SOT; README 与 `recovery_contract.md` 已收口边界.  |
| 971 | docs_zh/contracts/api_surface.md 与 sdk_surface.md 跨contract链接断 | `done` | API/SDK contract 过去没有互相指路; 现已双向补链并指到 API versioning 说明.  |
| 972 | docs_zh/contracts/version-lock.md 与 architecture_governance_and_versioning.md 双文未声明 SOT | `done` | README companion map 现已明确 `version-lock-contract.md` 是 canonical object, 架构治理文档只负责跨架构边界.  |
| 973 | docs_zh/contracts/connector_framework.md 未声明 lifecycle phase 与 harness_run_lifecycle 对齐方式 | `done` | connector lifecycle 与 harness lifecycle 长期missing少边界说明; `connector_framework_contract.md` 已补 lifecycle note.  |
| 974 | docs_zh/contracts/gateway_message.md schema messageId 必填, 与 production_storage_and_queue.md default null 矛盾 | `done` | Root cause:  review uses的是 freeze 前历史filepath和field描述, 把不同职责文档当成同一 schema authority; 本轮 README 已明确 canonical contract 映射, 该矛盾属于历史file名drift误读.  |
| 975 | docs_zh/contracts/README.md 表格列含 Owner 但所有行留空 | `done` | 该条对应的是旧版 README 结构; 当前 README 已无空置 Owner 列.  |

## docs_zh/adr

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 976 | docs_zh/adr/003-memory-six-layers.md 与 003-memory-seven-layers.md 共用 ADR-003 前缀, 工具sort歧义 | `done` | ADR index已把两份历史filedistinguish为 `003A/003B`, 并把 `seven-layers` 保留为 alias/redirect 页.  |
| 977 | docs_zh/adr/README.md:76-77 ADR-071 在 ADR-066 与 067 之间, 序号乱序 | `done` | ADR README 之前exists手工sorterror; 现已按编号orderre-sort.  |
| 978 | docs_zh/adr/ missing ADR-074/076/077, index也无 reserved/withdrawn 标注 | `done` | README 已标明 `045/074/076/077` 为 reserved/withdrawn 号段, 不再让missing号看起来像漏file.  |
| 979 | docs_zh/adr/README.md:79,81,84 ADR-069/072/078 标 "Partially Superseded" 但无具体后继 ADR 编号 | `done` | README 以前没有写具体后继; 现已补充 `069/072/078` 的主要后继 ADR 指针.  |
| 980 | docs_zh/adr/088-...md:3-7 vs 118-...md:3-4 两套state格式 (H2 ## state 与 bullet - state:) 共存 | `done` | Root cause:  ADR batch补写时引入了第二套state头格式; 本轮已统一回 bullet 风格state行.  |
| 981 | docs_zh/adr/070-conclusion.md:3 "结论文档"被标 Superseded by ADR-109..113, 应为 Withdrawn/Index | `done` | ADR-070 是总结index页而非被新设计directly替代的技术决策; state已改为 `Withdrawn / Index`.  |
| 982 | docs_zh/adr/README.md state格式两套 (Accepted vs 已accepts) 不可机器解析 | `done` | 旧index混用中英文state; 当前 README state列已统一为英文枚举.  |
| 983 | docs_zh/adr/ missing ADR-045 placeholderfile (only README references)  | `done` | 之前只有 README 提到保留号段, 没有placeholder页; 现已补 `045-reserved-slot.md`.  |
| 984 | docs_zh/adr/README.md accepts日期非monotonic | `done` | Root cause:  ADR README 长期default按编号组织, 但没有explicitly说明, 导致被误读成应按accepts日期monotonicsort; 本轮已在 README 明确index按 ADR 编号sort.  |
| 985 | docs_zh/adr/README.md Superseded by 链 ADR-### references反向指向不existsfile | `done` | Root cause:  review based on旧 README/旧 supersede 文案快照; 本轮已校正 README 链接与 supersede 描述, 当前反向references不再指向不existsfile.  |
| 986 | docs_zh/adr/ 多 ADR missing Status: Superseded 标识却被新 ADR 标记 supersede | `done` | Root cause:  ADR file正文, README index, supersede 关系曾经更新inconsistent; 本轮已统一 ADR-070/078 与indexstate, 并规范state头写法.  |

## docs_zh/operations & runbooks

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 987 | docs_zh/operations/runbooks/runbook-plugin-failure.md plugin id 列表与 builtin-plugin-registry drift | `done` | plugin failure runbook 原先missing少当前 built-in plugin ID 清单; 现已回写 canonical IDs 和对应验证entry.  |
| 988 | docs_zh/operations/operations-tracker.md:3-5 自称已迁移并停止maintained, 仍位于 AGENTS.md/CLAUDE.md 推荐path | `done` | 该页已收敛为轻量indexentry而不是废弃死页; 旧 review 没有吸收 2026-05-27 的index化修复.  |
| 989 | docs_zh/operations/runbooks/{runbook-database-issues,incident-response-playbook}.md 等 4/5 file全英文且无 docs_en/ 镜像 | `done` | Root cause:  zh ops目录曾directly承接英文 runbook 草稿, 没有完成中文化收敛; 本轮已把相关 runbook 翻译并按 zh 文档path统一.  |
| 990 | docs_zh/operations/runbooks/runbook-high-error-rate.md:13 引 docker compose ps, 而生产用 K8s/Helm | `done` | runbook 之前沿用了local compose 语境; 现已改成 K8s/Helm 优先, 并把 compose 限定为local栈.  |
| 991 | docs_zh/operations/runbooks/incident-response-playbook.md 定义 P1/P2, 但 prometheus rules only severity: critical\|warning, 映射missing | `done` | 告警 severity 与 incident severity 过去没有映射表; playbook 现已补充 `page/critical/warning -> P1/P2` 口径.  |
| 992 | docs_zh/operations/runbooks/runbook-memory-pressure.md:7 阈值"RSS>512MiB"与 alert 永久触发联动, runbook 失效 | `done` | Root cause:  runbook 阈值长期脱离线上 Prometheus 告警规则, 沿用了过时的 `512MiB` 文案; 本轮已对齐到现行告警阈值.  |
| 993 | docs_zh/operations/runbooks/runbook-database-issues.md default AA_DB_PATH 与 helm values inconsistent | `done` | database runbook 过去假定单一path; 现已按 local/dev 与 container/Helm 口径distinguish `AA_DB_PATH`.  |
| 994 | docs_zh/operations/runbooks/runbook-high-error-rate.md metric error_rate_5m 与 prometheus rule 实际名 aa_error_rate:rate5m inconsistent | `done` | runbook 指标名长期滞后; 现已改为实际规则uses的 `aa_error_rate:rate5m`.  |
| 995 | docs_zh/operations/capacity-planning.md 容量基线与 helm values-prod.yaml resources 不匹配 | `done` | Root cause: 容量规划文档之前没有绑定 Helm 生产 requests/limits/HPA 真实基线; 本轮已按当前 prod configure重写基线.  |
| 996 | docs_zh/operations/cross-region-validation.md references dr-drill.sh --region 但脚本accepts -r | `done` | Root cause:  review uses了过时脚本call基线; 当前文档已不再references旧的 `--region` 形态, 该问题属于历史快照误判.  |
| 997 | docs_zh/operations/disaster-recovery-runbook.md RTO/RPO 数字与 ADR 中目标不synchronous | `done` | Root cause:  DR runbook 与可executeconfigure/ADR 目标长期分离maintained; 本轮已在 runbook 中对齐当前 `config/dr/default.json` 与目标值.  |
| 998 | docs_zh/operations/hot-upgrade-validation.md references verify 脚本path已迁移 | `done` | Root cause: 热升级验证文档停留在脚本迁移前的泛化描述; 本轮已更新到现行 `deploy/scripts/verify-hot-upgrade.sh` path.  |

## docs_zh/reference

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 999 | docs_zh/reference/api-versioning.md 与 api-client.md 版本协商strategydrift (header 名size写不一)  | `done` | API 文档和 client 文档之前没有统一写出 `Accept-Version` / `x-api-version` 与 SDK 握手边界; 两份 reference 已对齐到同一口径.  |
| 1000 | docs_zh/reference/environment-configuration.md 环境变量index未含 AA_DB_PATH/AA_LOGIN_TOKEN/AA_DLQ_PURGE_CONFIRM 等关键项 | `done` | 环境变量index长期漏掉runtime关键变量; 现已补齐并接入对应审计.  |
| 1001 | docs_zh/reference/docs-sync.md zh→en synchronous流程graph未列 docs_en/contracts/ | `done` | docs sync 规则原先没有把 contracts 目录写成explicitlysynchronous面; 现已加入 `docs_en/contracts/` 和最小check清单.  |
## docs_en

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1002 | docs_en/ 多出 5 处无 zh 对应file, 含未翻译/path误粘 | `done` | 单复数迁移目录长期并存, 别名页未cleanup, 导致 docs_en 目录drift和配对check失真.  |
| 1003 | docs_zh/migrations/ 与 docs_zh/migration/ 单复数双目录共存; docs_en/migrations/ 同问题 | `done` | 历史迁移rename只新增 canonical 目录, 没有synchronous删除旧别名目录.  |
| 1004 | docs_en/ 103 filecontains docs_zh/ 链接, 跨语种链路leaks | `done` | 英文页长期从中文模板复制演进, 活动entry页没有做跨语种链接治理.  |
| 1005 | translate_docs.py:21-100 hardcoded 117 path列表, docs_en/research/archive/module-inventory.md 等多目标已不exists | `done` | 翻译maintained脚本dependency手工path白名单, 文档迁移后没有auto发现机制.  |
| 1006 | docs_zh/migrations/e2e-workflow-state-migration.md, docs_en/migrations/e2e-workflow-state-migration.md 282 行duplicate正文, 未做 4 行重定向 | `done` | 旧别名页被当成正式content继续maintained, 未在rename时降级为指针或删除.  |
| 1007 | docs_zh/migrations/README.md, docs_en/migrations/README.md 别名 README 与原目录同时exists, 两条path都可落地 | `done` | 目录级别别名strategy未定义, 导致 README 在 canonical/alias 两处同时落地.  |
| 1008 | docs_en/architecture/00-platform-architecture.md:3-10 跨链回 docs_zh/..., 英文读者被推回中文页 | `done` | 英文架构entry没有maintainedindependent sibling 导航, directlyreferences了中文权威页.  |
| 1009 | docs_en/contracts/ 中文contract 14 条未对应英文版本 | `done` | 审查快照expiry; 当前 contracts 英文镜像已补齐, 问题来自旧清单未重新基线化.  |

## docs_zh other

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1010 | docs_zh/reviews/ 含脚本 extract-issues.mjs 与无 en 对应file | `done` | 审查快照expiry; 脚本已提前迁出 reviews 面向读者的文档目录, 旧问题未从清单回收.  |
| 1011 | docs_zh/CHANGELOG.md 声称基线 0.1.0 但根 CHANGELOG only [Unreleased] | `done` | 中文 changelog 被当成第二事实源maintained, 没有约束其只能作为指针页.  |
| 1012 | docs_zh/buglist.md 自 2026-05-02 长期未刷新 | `done` | buglist 双entrymissing少 canonical 指向, 镜像页被误当成independentcontent持续drift.  |
| 1013 | docs_zh/guides/quickstart.md:11 推荐阅读 ADR-003 (已 superseded by ADR-020)  | `done` | 快速开始的阅读order没有随 ADR supersede 关系一起更新.  |
| 1014 | docs_zh/architecture/01-code-structure.md 仍含 phase 1[ab] 旧标签 | `done` | 架构示例树沿用了阶段制历史样例, 目录改名后没有synchronous替换.  |
| 1015 | docs_zh/CHANGELOG.md 与根 CHANGELOG.md 双 changelog, 无合并contract | `done` | 顶层与中文目录同时承载变更record, 但没有定义唯一权威来源.  |
| 1016 | docs_zh/governance/source_of_truth.md 是 AGENTS.md 应指向的"权威指针", AGENTS.md 从不references | `done` | agent 上下文文档missing少对治理entry的反向链接, uses者无法获知权威页.  |
| 1017 | docs_zh/governance/naming_and_directory_conventions.md 未被 AGENTS.md/CLAUDE.md 链接, naming规则在 agent 上下文层未生效 | `done` | naming规范exists但没有接入 agent 启动上下文, 规则无法前置生效.  |
| 1018 | docs_zh/buglist.md 无auto重新生成脚本, 永远drift | `done` | Root Cause不是再造一份生成脚本, 而是error保留了第二entry; 现改为稳定指针消除drift面.  |
| 1019 | docs_zh/quality/buglist.md 与 docs_zh/buglist.md 双 buglist 无规范指针 | `done` | 双 buglist 没有 canonical 约定, 读者和maintained脚本都无法判断哪个为真.  |

## root governance (README, AGENTS, CONTRIBUTING, SECURITY, LICENSE, CHANGELOG)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1020 | src/sdk/harness-sdk/ only 1 file 600+ 行, 与 AGENTS.md "independent SDK" 描述不符 | `done` | harness SDK 长期把支持逻辑堆在单一 barrel 中, 没有按 runtime/support 职责split.  |
| 1021 | drift-detection/evolution-integration-service.ts:280-326 decision.reason/severity 丢弃; includes("security")/("input") 子串误判分类 | `done` | 早期集成implementation为了快速打通只做了子串启发式分类, 也没有把 promotion gate 决策回写到 proposal 审计信息.  |
| 1022 | AGENTS/CLAUDE 未提及 src/runtime/agent-runtime/, compat surface 边界不全 | `done` | 顶层 agent 指南没有跟随 runtime 目录演化synchronous更新.  |
| 1023 | README.md:65 列 src/testing/, 但 AGENTS.md 未authorization该目录 | `done` | README 与 agent 约束文档由不同entrymaintained, 目录range说明发生drift.  |
| 1024 | pack-security-service.ts default vulnerabilityApiUrl hardcoded osv.dev | `done` | 审查表述失真; 当前implementation已支持configureinjection和安全 URL 解析, 问题来自旧代码快照.  |
| 1025 | Node 版本声明四套并存 (README/package.json/CONTRIBUTING/dependency-upgrade-plan/CI matrix)  | `done` | runtime版本信息missing少单点锚定, 文档和工具链分别independent演进.  |
| 1026 | CONTRIBUTING.md 列出 npm run lint, AGENTS.md 称无 formatter, 口径conflict | `done` | lint 与 formatter 概念未distinguish清楚, 导致贡献指南与仓库说明读起来像同一约束.  |
| 1027 | reviews/README.md 看板未提及 platforme-full-review-b.md, state不明 | `done` | review 看板没有持续纳入新增批次file, index页失去integrity.  |
| 1028 | adr/README.md 中 ADR-001/069/072 state与正文 frontmatter inconsistent | `done` | 审查快照expiry; ADR README 与正文state已对齐, 旧missing陷未从复核清单removal.  |
| 1029 | LICENSE:3 版权人写项目名而非法人实体, MIT 法律强度弱 | `done` | LICENSE uses了仓库名placeholdertext, 没有切换到 contributors 持有形式.  |
| 1030 | README.md:101 写 MIT 但无 LICENSE 链接, THIRD_PARTY_NOTICES, 子dependency致谢 | `done` | 根目录治理文档不完整, 许可证与第三方notificationentry没有成套暴露.  |
| 1031 | README.md:30-39 推荐 npm run test:pg-integration/test:secret-providers, 二者已知 broken | `done` | README 命令清单missing少活性validation, 失效脚本继续停留在主entry.  |
| 1032 | MEMORY.md 无编辑contract, AGENTS.md/CLAUDE.md 都不references | `done` | MEMORY 被当成经验笔记maintained, 没有明确其非权威属性和编辑边界.  |
| 1033 | CONTRIBUTING.md:18 cd automatic_agent_platform (snake_case) 与实际目录 automatic-agent-platform-main 不符 | `done` | 审查快照expiry; 当前仓库实际path已是 automatic_agent_platform, 旧目录名误差来自历史工作区.  |
| 1034 | CONTRIBUTING.md:39 AA_DB_PATH=data/sqlite/phase1a-demo.db 与 backup-sqlite.sh:21, helm automatic-agent.db 三处default值各不同 | `done` | local开发, 备份脚本, 部署环境uses场景不同, 却没有在文档中explicitlydistinguishrange.  |
| 1035 | CONTRIBUTING.md:91-93 force AppError.wrap 与 {domain}.{type}:{ctx} error码格式, AGENTS.md 未提及, 代码库多种格式 | `done` | 贡献文档曾把偏好写成硬规范, 但仓库并未建立统一error码contract.  |
| 1036 | AGENTS.md/CLAUDE.md/MEMORY.md/CONTRIBUTING.md/README.md 5 份顶层指南文档无总index, commit 规范等contentduplicate | `done` | 顶层指南是逐步追加形成的, missing少总index和单一导航entry.  |
| 1037 | translate_docs.py:1-9 自称 legacy 工具, README.md:54 仍宣传为活动工具 | `done` | README 没有标注该脚本的maintained性质, 工具生命周期说明missing.  |
| 1038 | helpers/fs.ts 导出 createSymlink 无 realpath validation, AGENTS.md 安全立场下为 footgun | `done` | 创建symbols链接时只validation表面path, 没有在落地前validation真实目标.  |
| 1039 | package-lock.json 无 npm audit signatures 证据file, 与 supply-chain-security 文档矛盾 | `done` | 供应链文档把 lockfile 当成审计证据, 混淆了dependencylock定与审计产物两类事实.  |
| 1040 | LICENSE 无对应 npm package.json.license:"MIT" field | `done` | 根许可证声明和 package manifest 未建立synchronous约束.  |
| 1041 | README.md "seven-layer architecture" 表述与 AGENTS.md/代码 "five-plane" 矛盾 | `done` | README 保留了历史架构叙述, 没有明确其与现行 five-plane runtime 的时间边界.  |
| 1042 | README.md references npm run doctor 等命令未在 CONTRIBUTING 章节交叉链接 | `done` | 命令说明分散在多个entry页, 没有做互链.  |
| 1043 | CONTRIBUTING.md default AA_DB_PATH=data/sqlite/phase1a-demo.db 与 compose/helm default data/automatic-agent.db drift | `done` | 同 1034, 环境default值按用途分叉, 但文档没有解释 local/runtime/deploy 差异.  |
| 1044 | CHANGELOG.md 最近版本 entry 未对应 git tag | `done` | 发布record与 Git tag 没有synchronous建立, 历史版本only停留在文档层.  |
| 1045 | 仓库根missing SECURITY.md (GitHub 安全披露通道未声明)  | `done` | 安全披露流程exists于零散文档中, 但missing少仓库根entryfile.  |
| 1046 | LICENSE file SPDX 标识未在 package.json license field声明 (或与之inconsistent)  | `done` | 许可证元datasynchronousmissing, 仓库级声明与包级声明未绑定.  |

## root configs (package.json, tsconfig, eslint, .gitignore, .editorconfig, .npmrc, .nvmrc)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1047 | package.json:170 aa:dev 直跑 node --import tsx src/sdk/cli/aa.ts, 无 AA_RUNNING_TESTS guard; CI testing场景下可能写真实 data/ SQLite | `done` | dev CLI entrydefault假定人为交互运行, 没有对testing环境做 fail-close guard.  |
| 1048 | src/index.ts 把深内部directly拉到顶层公共出口, bypass package.json#exports | `done` | 审查表述失真; 当前深导出是受控公共面, 且已有 public-entrypoint 审计脚本兜底.  |
| 1049 | package.json hardcoded --test-concurrency=1, bypass layered runner | `done` | 审查快照expiry; 仓库已回到 layered runner 决定concurrent, 旧hardcoded不再exists.  |
| 1050 | package.json:223-235 缩进异常会触发 format 抖动 | `done` | 审查项偏格式噪声; 当前 package 结构稳定, 不构成实际configureerror.  |
| 1051 | tsconfig.build-test.json 死configure, 无任何references | `done` | 审查快照expiry; 该configure当前被 coverage curated tsconfig 继承, 不是孤儿file.  |
| 1052 | tsconfig.json 多个 exclude 与 npm script references同一fileconflict | `done` | 这是 typecheck range与分层testingrange的职责split, 被审查误判为conflict.  |
| 1053 | eslint.config.js 启用 type-aware 规则但未声明 parser/projectService | `done` | 审查快照expiry; 当前 eslint flat config 已启用 projectService.  |
| 1054 | package.json lint --ext 在 flat config 下被忽略, .tsx 未coverage | `done` | 审查快照expiry; 当前 lint 已简化为 `eslint .`, 不exists `--ext` 漏扫.  |
| 1055 | stryker.config.mjs 排除 helper + tsconfig 含 ui references 致沙箱failure | `done` | 审查快照expiry; 当前 mutation configure已uses专门 tsconfig 并隔离 UI references.  |
| 1056 | eslint.config.js:33-37 testing type-aware 规则未设 parserOptions.project 即silently no-op | `done` | 同 1053, testing规则已via projectService 生效, 旧问题来自历史configure.  |
| 1057 | package.json:243 format:check 无 .prettierignore, lock/dist/coverage/golden 全部进 prettier validation | `done` | 格式checkmissing少忽略清单, 导致生成产物与lockfile被误纳入validation.  |
| 1058 | package.json:264 @types/xml-crypto:^1.4.6 与 xml-crypto:^6.1.2 不同主版, type与runtime不匹配 | `done` | 第三方type包已脱离runtime主版本节奏, 却继续被directlydependency.  |
| 1059 | package.json:248-250 OpenTelemetry 五个不同 0.x/2.x/1.x 通道并存, sdk-node 0.218 与 exporter 0.214 API drift | `done` | dependency升级按包零散进行, 没有保持同一 telemetry 族版本对齐.  |
| 1060 | package.json:5 private:true 同时声明 files/prepack, 发布意graph不明 | `done` | Root cause: “内部可打包验证”与“禁止误发布”两个意graph并存但未解释; 现保留 private 并按内部打包validation语义说明.  |
| 1061 | package.json:7-9 engines.node 无 engineStrict/.npmrc engine-strict, Node 20/24 安装silentlysuccess | `done` | Node 版本约束只写在 package engines, 没有同时在 npm configure层启用强validation.  |
| 1062 | package.json:55 prepare 用 .catch(()=>undefined) 吞掉所有 husky bootstrap error | `done` | Root cause: 旧版 `prepare` 脚本把 husky bootstrap failure完全吞掉; 当前脚本已收敛为只做 husky 初始化并output告警, 不再silently掩盖error.  |
| 1063 | package.json:165-166 AA_PRESERVE_DIST=0 紧接 AA_PRESERVE_DIST=1 同行声明, shell 后者coverage前者 | `done` | Root cause:  review based on旧脚本形态; 当前脚本只保留了一套 `AA_PRESERVE_DIST` 语义, 不再exists同一行双重coverage.  |
| 1064 | tsconfig.coverage-curated.json 1769 行手maintained 1700+ file exclude, 无auto生成 | `done` | Root cause:  coverage curated tsconfig 之前完全靠人工maintained exclude 列表, 新增/删除file后容易drift; 本轮已补生成脚本并把产物改为auto生成.  |
| 1065 | tsconfig.build-test.json 被 tsconfig.coverage-curated.json:2 extends, 与"死configure"判定矛盾 | `done` | Root cause: “死configure”结论来自过时filegraph, 忽略了 `tsconfig.coverage-curated.json` 仍在继承它; 该file当前仍是 live base config.  |
| 1066 | tsconfig.scripts.json:11 含 eslint.config.js 不含 stryker.config.mjs, handleinconsistent | `done` | Root cause:  scripts tsconfig 以前靠手工列举单filemaintained, configure脚本新增时容易漏synchronous; 本轮已泛化为 `*.config.{js,cjs,mjs}` coverage.  |
| 1067 | package.json bin/exports field未与 dist 实际产物comparison | `done` | Root cause:  review 漏看了仓库里已有的 public-entrypoint audit 与 CLI 导出validation; 当前 package surface 已有autocomparison门.  |
| 1068 | package.json 多个脚本前缀 npm run build, local连续运行duplicate tsc 浪费 | `done` | Root cause: 脚本层default把“需要 dist”简单等同于“每次都先full build”; 本轮已引入based on时间戳的 `build-if-needed` 门, 避免新鲜 `dist/` duplicate编译.  |
| 1069 | package.json dependency @prettier/plugin-xml 但仓库无 .xml/.svg, 死dependency | `done` | Root cause: dependencycleanup长期missing少按真实filetype反查, remaining了未消费的 Prettier XML 插件; 本轮已removal无效dependency.  |
| 1070 | package.json prepare:"npm run build" 在 npm install 时force构建 | `done` | Root cause:  review uses了旧版 `prepare` 基线; 当前 `prepare` 只负责 husky bootstrap, 不再在 `npm install` 时force构建.  |
| 1071 | package.json engines.node 与 .nvmrc 双源真相未交叉validation | `done` | Root cause:  Node 版本声明过去确实可能各自drift; 当前仓库已补 Node 版本对齐testing, 形成交叉validation.  |
| 1072 | tsconfig.json lib:["ES2023","WebWorker"] 拉入 WebWorker type | `done` | Root cause: 根 tsconfig 之前把不需要的 `WebWorker` ambient types 带入了服务端type空间; 本轮已removal.  |
| 1073 | tsconfig.json paths 与 package.json exports 双源 runtime/编译时 resolve inconsistent | `done` | Root cause:  SDK 子path别名与 package exports 分别independentmaintained, 编译时与runtime解析面发生了drift; 本轮已把 `plugin-sdk` 等子path统一到同一naming与导出面.  |
| 1074 | tsconfig.scripts.json 与 tsconfig.build.json allowImportingTsExtensions inconsistent | `done` | Root cause: 脚本 tsconfig 与构建 tsconfig 长期independent演化, 没有shared导入扩展名strategy; 本轮已统一为 `false`.  |
| 1075 | tsconfig.scripts.json:11 include 列表hardcodedfile, 新增 .mjs 须手工synchronous | `done` | Root cause:  scripts tsconfig 过去dependencyhardcoded include 列表; 本轮已用 `*.config.{js,cjs,mjs}` 统一coverage, 新增 `.mjs` 不再手工synchronous.  |
| 1076 | eslint.config.js 未configure *.tsx/*.cjs 规则集 | `done` | Root cause:  ESLint type-aware coverage此前漏掉了仓库根 `tests/**/*.tsx`, 同时 review 还把并不exists的 `.cjs` 源file当成现存missing口; 本轮已补 `tests/**/*.tsx` 规则coverage.  |
| 1077 | eslint.config.js 未声明 parserOptions.project, type-aware 规则全silently no-op | `done` | Root cause:  review based on旧configure快照; 当前 flat config 已uses `projectService: true`, type-aware 规则并非silently no-op.  |
| 1078 | eslint.config.js ignores 未含 coverage-report/.dr-reports/dist-types | `done` | Root cause:  lint ignore 列表落后于新生成目录布局; 本轮已补 `coverage-report/.dr-reports/dist-types`.  |

## src/sdk (CLI & SDK)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1079 | src/sdk/cli/pack-publish.ts default registry URL 为不exists的 api.platform.example.com | `done` | Root cause:  review based on旧版 `pack-publish.ts`, 当时仍保留 example.com placeholderdefault值; 当前implementation已对missing registry URL directly fail-close.  |
| 1080 | src/sdk/harness-sdk/index.ts 5 处 @ts-expect-error 抑制typecheck | `done` | Root cause:  review 采样自旧版本基线; 当前 `src/sdk/harness-sdk/index.ts` 已无这些 `@ts-expect-error` 抑制, 并加了源码guardtesting防回归.  |
| 1081 | harness-sdk/index.ts:724,737-739 setTimeout 无 unref; 空 catch 后仍触发 onTimeout 无error上下文 | `done` | Root cause: timeout兜底path之前只做 best-effort cleanup, 没有把 timer 生命周期和 lookup 异常观测纳入正式控制流; 本轮已 `unref()` 定时器并via `onError` 暴露 lookup failure.  |
| 1082 | src/sdk/cli/aa.ts 顶层 main() 在 npm bin 软链/Windows process.argv[1] inconsistent时 import 即触发 dispatcher | `done` | Root cause:  CLI entry判断原先dependencydirectly URL 相等比较, 没有复用统一的entryguard; 本轮 `aa.ts` 已切到shared `isCliEntryPoint()`, 并强化了 realpath/resolve 判定.  |
| 1083 | src/sdk/cli/dlq-manager.ts:112 --limit=abc parseInt→NaN 经 Math.min/Max 仍 NaN, 拼到 SQL 抛 SQLite error而非validationreject | `done` | Root cause:  `--limit` 参数原先只做数值裁剪, 没有在 NaN 前置validation; 本轮已explicitlyreject非法 limit.  |
| 1084 | src/sdk/cli/dlq-manager.ts:32,104 retryLimit field定义且解析, 但所有 action 写死 LIMIT 100, flag silently被忽略 | `done` | Root cause:  `retryLimit` 之前只停留在解析层, 没有真正贯通到executepath; 本轮已让 `--retry-limit` 驱动batch重试upper limit.  |
| 1085 | src/sdk/cli/dlq-manager.ts:209 UPDATE … ORDER BY … LIMIT only在 SQLite SQLITE_ENABLE_UPDATE_DELETE_LIMIT 启用时合法, 与 PG 不compatibility | `done` | Root cause: implementation偷用了 SQLite 方言特性, 突破了存储抽象可portable性; 本轮已改为先选 id 再 update, removal方言dependency.  |
| 1086 | src/sdk/cli/dlq-manager.ts:228 confirmFlag!=="yes" size写敏感, AA_DLQ_PURGE_CONFIRM=YES silentlyreject | `done` | Root cause:  purge 环境confirmation原先做了size写敏感比较; 本轮已改为size写不敏感.  |
| 1087 | src/sdk/cli/dlq-manager.ts:229,277 双层confirmation (--yes+env) rejectpath文案相同, 无法distinguish missing-flag vs missing-env | `done` | Root cause: 双重confirmation虽然exists, 但rejectpath复用了同一提示文案; 本轮已split `--yes` missing与环境confirmationmissing的error信息.  |
| 1088 | src/sdk/cli/dlq-manager.ts:286 storage.close() 经 {...storage,close} 浅展开后类方法identityloss, 可能不真正关闭handle | `done` | Root cause:  authoritative storage 工厂之前用 spread-shim 改写 `close`, 破坏了对象identity和原型; 本轮改为原对象上原位wrapper `close`.  |
| 1089 | src/sdk/cli/dlq-manager.ts:290 entry判断未复用仓库内 isCliEntryPoint, npm bin/symlink 失效 | `done` | Root cause:  `dlq-manager` 沿用了局部entry判断而没有复用shared helper; 本轮已切换到强化后的 `isCliEntryPoint()`.  |
| 1090 | src/sdk/cli/secret-commands.ts:53 env.AA_SECRET_AUTH_TOKEN_PATH ?? join(home,...,"secret-auth-token") 未 realpath validation, 软链可重定向 | `done` | Root cause:  token path此前只做字符串级path拼接, 没有禁止symbols链接重定向; 本轮已reject symlink token path.  |
| 1091 | src/sdk/cli/secret-commands.ts:113 token comparison sha256 directly hex 无 salt, 哈希fileleaks可走彩虹表 | `done` | Root cause:  secret auth token 存储沿用了无盐 sha256 简化implementation; 本轮已切换为带盐 `scrypt` 哈希格式.  |
| 1092 | src/sdk/cli/secret-commands.ts:116 left.length===right.length && timingSafeEqual file被改成不同length时leakslength差 | `done` | Root cause: validation逻辑在length不等时先短路return, 破坏了常量时间比较; 本轮已改成fixedlength缓冲比较, 不再暴露length差.  |
| 1093 | src/sdk/cli/secret-commands.ts:128-129 mkdirSync({mode:0o700}) only对 leaf 生效; writeFileSync({mode:0o600}) file已exists不更新 mode | `done` | Root cause: filepermissions控制以前只在 create-time 生效, coverage写入时不会收敛已有宽permissions; 本轮已在写入后explicitly修正目录和filepermissions.  |
| 1094 | src/sdk/cli/secret-commands.ts:162 generate-token action 不调 requireAuthToken, 任何 CLI user可coverage token 哈希implementationidentity升级 | `done` | Root cause:  `generate-token` 早期被当成初始化path, 没有coverage“已有 token 时必须认证”的约束; 本轮已要求对现存 token 旋转先认证.  |
| 1095 | src/sdk/cli/secret-commands.ts:168 生成 token 经 JSON.stringify(result,null,2) 打印 stdout, 重定向log即明文留存 | `done` | Root cause: 生成 token 结果对象此前directlyoutput到 stdout, 把明文 token 当普通结果fieldhandle; 本轮已改为只写入 `AA_SECRET_OUTPUT_PATH`.  |
| 1096 | src/sdk/cli/secret-commands.ts:219 writeFileSync(outputPath, secretValue) 不check目标是否软链, TOCTOU 可写arbitrarypath | `done` | Root cause:  secret materialization 以前uses普通写filepath, 没有加防跟随约束; 本轮已via安全file写入path和 `O_NOFOLLOW` 防止软链穿透.  |
| 1097 | src/sdk/cli/secret-commands.ts:232,244,256 describe/leases/summary 均未要求认证, 元dataleaks | `done` | Root cause: “只读元data”曾被误判为低敏感, 不要求认证; 本轮已把 `describe/leases/summary` 也纳入认证门.  |
| 1098 | src/sdk/cli/secret-commands.ts:305 errorresponse用 error.constructor.name 作 errorCode, leaks内部类名 (如 BetterSqliteError)  | `done` | Root cause: 顶层error映射原先把内部异常类名directly外露; 本轮已统一遮蔽为稳定的 `secret.command_failed`.  |
| 1099 | src/sdk/cli/migrate-sqlite-to-pg.ts validation阶段对 SQLite 大表 SELECT * full加载入 JS in-memory, OOM | `done` | Root cause: 迁移validationpath把“读取一张表”implementation成整表拉入in-memory, 没有pagination/批handle边界; 本轮已改成 `LIMIT/OFFSET` 分批迁移与validation.  |
| 1100 | src/sdk/cli/api-server.ts 启动后not registered SIGTERM/SIGINT graceful 关闭 | `done` | Root cause:  API CLI entry只负责启动服务, 没有接入统一 shutdown 注册器; 本轮已注册 signal handlers 并复用shared CLI entrypoint guard.  |
| 1101 | src/sdk/cli/inspect.ts JSON.stringify(snapshot) 对大 snapshot 无truncated/流式output, 超出 stdout 高水位丢field | `done` | Root cause:  inspect output以前default一次性 `JSON.stringify` 并整块写 stdout, 没有考虑超大快照与 backpressure; 本轮已增加truncated序列化和分块output.  |
| 1102 | src/sdk/cli/skill-creator.ts 模板渲染字符串拼接而非转义, skill name 含反引号/${...} 时被当模板代码execute | `done` | Root cause:  review 把“把user输入写入statictext模板”误判成“把user输入当模板execute”; 当前implementation会 slugify path, 把原文作为惰性text写入file, 本轮还补了 hostile-name testinglock定该语义.  |
| 1103 | src/sdk/cli/pack-publish.ts publish 重试无指数backoff, 连续failure放大 marketplace 限流封禁 | `done` | Root cause:  publish 重试strategy此前missing少backoff和瞬态error分类, failure风暴会放大限流压力; 本轮已补指数backoff重试并收口瞬态failure判定.  |
| 1104 | src/sdk/cli/release-pipeline.ts rollback pathonlyrecord audit log, 不实触发版本rollback RPC, namingmislead | `done` | Root cause:  review 把其他module中的 rollback 语义投射到了 `release-pipeline` CLI; 当前 CLI action 只有 `list/build/export/execute`, 不exists名为 rollback 的misleadentry.  |
| 1105 | src/sdk/cli/login.ts accepts AA_LOGIN_TOKEN env 但success后未清空 process.env, 子process继承 token | `done` | Root cause: 登录流程过去只把 env token 当输入读取, 没有在success后做process级cleanup; 本轮已explicitly清空 legacy `AA_LOGIN_TOKEN`.  |
| 1106 | src/sdk/cli/cli-exit.ts process.exit(code) directlycallbypass unhandled-promise drain, CI 中尾随log可能loss | `done` | Root cause:  review based on旧implementation印象; 当前 `runCliMain()` 已uses `process.exitCode` 而不是硬退出, 本轮继续confirmation并保留该语义.  |
| 1107 | src/sdk/cli/authoritative-storage.ts 工厂return {...storage, close:closeOnce} 浅拷贝loss class 原型链, instanceof AuthoritativeStorage 永远 false | `done` | Root cause:  authoritative storage 工厂以前via浅拷贝包 `close`, 破坏了 class 原型链与 `instanceof` 语义; 本轮已改成原对象原位封装.  |
| 1108 | src/sdk/index.ts & admin-sdk/index.ts & harness-sdk/index.ts 三公共entry同时 export *, 新增类即视作 public API, violates SDK 收敛 | `done` | Root cause:  SDK 根entry之前uses宽泛 barrel export, 内部symbols会被意外升级成公共 API; 本轮已把 `src/sdk/index.ts` 收敛为explicitlynaming导出表面.  |
| 1109 | src/sdk/cli/aa.ts (top of file main() invocation): CLI entry未uses isCliEntryPoint guard, 对 npm bin 软链/Windows path process.argv[1] inconsistent; any import-time side effect runs the dispatcher. EN: top-level main() runs at module import on platforms where the symlink path differs, breaking library reuse. | `done` | Root cause:  CLI entry判断原先dependencydirectly URL 比较, 没有经过 realpath/resolve 归一化; 本轮已复用强化后的 `isCliEntryPoint()`.  |
| 1110 | src/sdk/cli/dlq-manager.ts:112 Math.max(1, Math.min(500, parseInt(String(values.limit ?? "50"),10))) 当 --limit=abc 时 parseInt→NaN→Math.min/Max 全部 NaN, 最终拼接到 SQL 抛 SQLite error而非友好validation. EN: NaN propagation injects literal NaN into LIMIT, causing opaque SQL error instead of structured rejection. | `done` | Root cause:  limit handle以前default `parseInt` 一定success, 只做边界裁剪; 本轮已对非法值做结构化reject.  |
| 1111 | src/sdk/cli/dlq-manager.ts:32,104 retryLimit field在interface定义且解析, 但所有 action handler 中未uses (200 行 retryDeadLetters 写死 LIMIT 100) . EN: --retry-limit flag is silently ignored; users believe it works. | `done` | Root cause:  flag only被解析但没有接入execute层; 本轮已让 `retryLimit` 真正控制重试批size.  |
| 1112 | src/sdk/cli/dlq-manager.ts:209 UPDATE … ORDER BY updated_at ASC LIMIT 100 only在 SQLite 编译启用 SQLITE_ENABLE_UPDATE_DELETE_LIMIT 时合法; 与 PG 后端不compatibility, violates storage abstraction. EN: portability bug across SQLite/Postgres adapters. | `done` | Root cause: implementation绑定了 SQLite 扩展语法, 破坏了 Postgres compatibility性; 本轮已替换为 select-id-then-update 的可portable流程.  |
| 1113 | src/sdk/cli/dlq-manager.ts:228 confirmFlag !== "yes" size写敏感; AA_DLQ_PURGE_CONFIRM=YES silentlyreject, error信息却暗示已设置. EN: case-sensitive env confirm rejects valid affirmative values. | `done` | Root cause: 环境confirmation比较此前size写敏感; 本轮已改为 case-insensitive.  |
| 1114 | src/sdk/cli/dlq-manager.ts:229,277 双层confirmation (--yes 与 env) 但rejectpathreturn相同 dry-run 文案, 无法distinguish missing-flag vs missing-env, ops难排查. EN: confusing duplicate dry-run message. | `done` | Root cause: 双重confirmationfailurepath复用了同一提示text; 本轮已split不同failure原因的提示.  |
| 1115 | src/sdk/cli/dlq-manager.ts:286 storage.close() call, 但 authoritative-storage 工厂return {...storage, close} 浅展开对象 (见既有审计) , class 方法identityloss, close 可能不真正关闭handle. EN: spread-shim breaks instance identity, close may be a no-op. | `done` | Root cause:  storage wrapper器用浅拷贝替换 `close`, 破坏了原实例方法identity; 本轮已改为保留实例identity的原位封装.  |
| 1116 | src/sdk/cli/dlq-manager.ts:290 entry判断uses import.meta.url === pathToFileURL(process.argv[1]).href, 未复用仓库内 isCliEntryPoint helper; npm bin/symlink 场景失效. EN: same Windows symlink defect as round 4 #1. | `done` | Root cause:  `dlq-manager` 自行implementationentry判断, duplicate引入了 symlink/Windows pathmissing陷; 本轮已统一到shared helper.  |
| 1117 | src/sdk/cli/secret-commands.ts:53 env.AA_SECRET_AUTH_TOKEN_PATH ?? join(home, ".automatic-agent", "secret-auth-token") 未做 realpath validation; symbols链接可重定向 token 哈希读path. EN: symlink redirection on token-hash path. | `done` | Root cause:  token-hash path以前没有防symbols链接重定向约束; 本轮已reject symlink path.  |
| 1118 | src/sdk/cli/secret-commands.ts:113 token comparison用 sha256(token) directly hex, 无 salt; 若哈希fileleaks可走彩虹表. EN: unsalted hash vulnerable to offline dictionary attack. | `done` | Root cause:  token 存储implementationuses了无盐哈希; 本轮已升级为带盐 `scrypt`.  |
| 1119 | src/sdk/cli/secret-commands.ts:116 left.length === right.length && timingSafeEqual length提前return非常量时; 当file被tamper成不同length时leakslength差. EN: length-prefix early-exit leaks information. | `done` | Root cause: 比较逻辑在lengthcheck阶段提前return; 本轮已改成fixedlength常量时间比较.  |
| 1120 | src/sdk/cli/secret-commands.ts:128-129 mkdirSync(..., {mode:0o700}) only对 leaf 创建生效; 既有父目录permissions保留; writeFileSync(...,{mode:0o600}) file已exists时不更新 mode, 旧 0o644 token file保持宽松permissions. EN: mode-on-create only, not on overwrite. | `done` | Root cause: permissions hardening 以前只dependency创建时 mode, 无法修正已exists的宽permissionsfile; 本轮已在写入后explicitly收紧permissions.  |
| 1121 | src/sdk/cli/secret-commands.ts:162 generate-token action 不call requireAuthToken, 任何 CLI user可coverage token 哈希file, implementationidentity升级. EN: token regeneration is unauthenticated, allowing privilege escalation. | `done` | Root cause:  token 生成path以前没有distinguish“首次初始化”和“已有 token rotation”; 本轮已要求rotation现有 token 必须认证.  |
| 1122 | src/sdk/cli/secret-commands.ts:168 生成的 token via JSON.stringify(result,null,2) 打印至 stdout; 若 stdout 重定向到log, 明文 token 永久留存. EN: secret printed to stdout without redaction. | `done` | Root cause: 命令把生成结果按普通 JSON output, error地把明文 token 暴露到 stdout; 本轮已只写到 `AA_SECRET_OUTPUT_PATH`.  |
| 1123 | src/sdk/cli/secret-commands.ts:219 writeFileSync(outputPath, secretValue) 不check目标是否软链, symbols链接 TOCTOU 可让 secret 写入 /etc/passwd 等arbitrarypath. EN: secret-write symlink traversal. | `done` | Root cause:  secret outputpath此前uses普通写file API, 没有 no-follow 约束; 本轮已切到安全写入path并阻断软链穿透.  |
| 1124 | src/sdk/cli/secret-commands.ts:232,244,256 describe/leases/summary action 均未要求认证, 元data (secretRef, ttl, owner, leaseHolder) leaks. EN: metadata-only endpoints leak sensitive operational info without auth. | `done` | Root cause: 元datainterface过去被误分类为非敏感; 本轮已统一要求认证.  |
| 1125 | src/sdk/cli/secret-commands.ts:305 errorresponseuses error.constructor.name 作为 errorCode, leaks内部类名 (如 BetterSqliteError) , violateserror抽象. EN: internal class name leaks via error code. | `done` | Root cause: 顶层error编码directly透传内部异常类名; 本轮已收敛为稳定的外部error码 `secret.command_failed`.  |
| 1126 | src/sdk/cli/migrate-sqlite-to-pg.ts validation阶段对 SQLite 大表 SELECT * full加载入 JS in-memory, 无pagination; OOM risk. EN: full-table read into memory during migration. | `done` | 同 1099, Root cause: 迁移validationpathmissing少paginationstrategy, 本轮已改成批handle.  |
| 1127 | src/sdk/cli/api-server.ts 启动后not registered SIGTERM/SIGINT graceful 关闭, 容器停机会丢request中data. EN: missing signal handlers. | `done` | 同 1100, Root cause:  CLI 没接入统一 shutdown 控制器, 本轮已补.  |
| 1128 | src/sdk/cli/inspect.ts output JSON directly JSON.stringify(snapshot), 对大 snapshot 无truncated与流式output, 超出 stdout 高水位时丢field. EN: blocking stringify for large snapshots. | `done` | 同 1101, Root cause: 大快照output没有 backpressure 与truncated控制, 本轮已补.  |
| 1129 | src/sdk/cli/skill-creator.ts 模板渲染uses字符串拼接而非转义; user提供 skill name 含反引号/${...} 时被当模板代码execute (写入file并由subsequentmodule require) . EN: template injection via skill name. | `done` | 同 1102, Root cause:  review 误把statictext模板当dynamicexecute模板; 本轮已用 hostile-name testing把现状lock定.  |
| 1130 | src/sdk/cli/pack-publish.ts example.com existsmissing省 registry placeholder (既有审计 #3) ; 本轮新发现 publish 重试无指数backoff, 连续failure放大 marketplace 限流封禁概率. EN: missing exponential backoff in publish retry. | `done` | Root cause:  registry placeholder问题已在前序条目收口, 但 publish 重试strategy仍missingbackoff; 本轮已补指数backoff与瞬态error重试.  |
| 1131 | src/sdk/cli/release-pipeline.ts rollback pathonlyrecord audit log, 不实际触发版本rollback RPC, namingmisleadops. EN: rollback action only logs, no rollback effect. | `done` | 同 1104, Root cause: 把不exists的 rollback CLI action 误认成现行entry; 当前 CLI 并无该misleadpath.  |
| 1132 | src/sdk/cli/login.ts accepts AA_LOGIN_TOKEN env 但未在success后清空 process.env, 子process继承 token. EN: token leaks via inherited environment. | `done` | 同 1105, Root cause:  env 输入cleanupmissing, 本轮已清空.  |
| 1133 | src/sdk/cli/cli-exit.ts process.exit(code) directlycallbypass unhandled-promise drain, CI 中尾随log可能loss. EN: hard exit drops trailing log writes. | `done` | 同 1106, Root cause:  review 基线过旧; 当前implementation已uses `process.exitCode`.  |
| 1134 | src/sdk/cli/authoritative-storage.ts 工厂函数return {...storage, close: closeOnce} 浅拷贝loss class 原型链, call instanceof AuthoritativeStorage 永远 false, 下游 instanceof guard失效. EN: spread-shim breaks instanceof checks. | `done` | Root cause:  storage 工厂此前以浅拷贝方式覆写 `close`, directly打断了原型链和 `instanceof` guard; 本轮已改为保持原对象/原型链的封装方式.  |
| 1135 | src/sdk/index.ts & src/sdk/admin-sdk/index.ts & src/sdk/harness-sdk/index.ts 三个公共entry同时 export *, 未做 semver-stable 表面控制; 新增类即视作 public API, violates SDK 收敛strategy. EN: barrel export leaks unstable surface. | `done` | 同 1108, Root cause:  SDK barrel surface 过宽; 本轮已把根 SDK entry收敛为explicitlynaming导出.  |

## src/plugins

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1136 | src/plugins/adapters/*-adapter.ts hardcoded第三方平台 URL, not registered outbound-url-policy | `done` | Root cause:  review 基线落在适配器接入 `parseSafeOutboundUrl()` 之前; 当前 GitHub/CRM/GameDev/AssetProduction/Livestream 适配器都已把外部端点纳入 outbound URL validation与 egress policy.  |
| 1137 | plugins/adapters/index.ts:1-5 不导出 credential-hygiene.ts | `done` | Root cause:  adapters barrel 以前只做 `export *` 聚合, misses了凭据卫生 helper 的explicitly公共面; 本轮已补 `credential-hygiene` 的explicitly导出.  |
| 1138 | plugins/adapters/github-adapter.ts:37, plugin-sdk/plugin-definition.ts:299 双导出 verifyPluginSignature signatureinconsistent | `done` | Root cause:  adapters/root barrel 过去把 GitHub 适配器signature helper 也一并leaked, 和 SDK signature API 形成同名异signatureconflict; 本轮已把 barrel 改成explicitly导出, 只保留统一公共面, 去掉conflict导出.  |
| 1139 | plugins/adapters/github-adapter.ts:278-289 适配器从不发 HTTP, return端点+payload 描述符 (伪集成)  | `done` | Root cause:  GitHub adapter 之前只拼request描述符, 从未真正execute outbound call; 本轮已改为真实 `fetch` execute, timeout/responsesize控制, 并return实际responsedata.  |
| 1140 | src/plugins/builtin-plugin-registry.ts BundleRevocationSeverity 枚举与 org-governance severity 取值并存两套 | `done` | Root cause:  bundle revocation 曾混用历史 `info/warning/moderate/severe` 与现行严重级别; 本轮已收口到统一的 `critical/high/medium/low`.  |
| 1141 | src/plugins/builtin-plugin-registry.ts isRevoked()/getActiveRevocation() 未到 effectiveAt 时返已撤销, 截止时间语义反向 | `done` | Root cause: 吊销激活时间过去只借 `deadline` field做反向判断; 本轮已explicitly按 `effectiveAt` (fallback到 legacy `deadline`) 判定激活window.  |
| 1142 | src/plugins/builtin-plugin-registry.ts authenticate() onlycheck apiKey 非空字符串即via, 无密钥强度/格式validation | `done` | Root cause:  marketplace 认证以前把“非空字符串”当成充分条件; 本轮已加最小length与字符集validation.  |
| 1143 | src/plugins/builtin-plugin-registry.ts sessions Set 无 TTL/expirycleanup | `done` | Root cause:  marketplace 会话以前只存 `Set`, 没有到期时间; 本轮已改成带 TTL 的 `Map` 并在读写时cleanupexpiry项.  |
| 1144 | src/plugins/builtin-plugin-registry.ts normalizeManifest() only @platform\→@automatic-agent/ 字符串替换, 遗 @aa-platform/ 等历史naming | `done` | Root cause:  manifest 名称规范化以前只coverage一套历史前缀; 本轮已把 `@aa-platform/` 一并归一化到 `@automatic-agent/`.  |
| 1145 | src/plugins/builtin-plugin-registry.ts outputDataClass field定义但所有 builtin manifests 均未填, 死field | `done` | Root cause:  plugin manifest schema 与 builtin manifest constructionpath之前都没有把 `outputDataClass` 当成必备元data; 本轮已把field纳入 schema, 并为 builtin manifests 统一填充.  |
| 1146 | src/plugins/builtin-plugin-registry.ts globalMarketplaceRegistry/pluginRevocations/BundleRevocationRegistry 三singleton, resetBuiltinPluginRegistryStateForTests onlyreset其一 | `done` | Root cause: testing reset hook 之前只清了 taint/lifecycle state, 没有清 marketplace/revocation singleton; 本轮已把这些full reset.  |
| 1147 | src/plugins/builtin-plugin-registry.ts allowedExternalDomains:[] 与 allowNetworkEgress:true 同时出现, 组合语义未规范 | `done` | Root cause: 外部 adapter manifests 之前把 `allowNetworkEgress` 打开了, 但 `allowedExternalDomains` 留空; 本轮已为 CRM/Unity/Figma/OBS manifests 补齐explicitly域名白名单, 并在 normalize 阶段阻断“开放 egress + 空白名单”的歧义组合.  |
| 1148 | src/plugins/adapters/crm-adapter.ts:~30 default baseUrl=api.hubspot.com 与 crmType 无关, Salesforce configuremisses即指向 HubSpot | `done` | Root cause:  CRM runtimeconfigure原先先定死 HubSpot base URL, 再把 `crmType` 只当标签uses; 本轮已按 `crmType` 分流default base URL.  |
| 1149 | src/plugins/adapters/crm-adapter.ts pathhardcoded /crm/v3/objects/, Salesforce path根本不可用 | `done` | Root cause:  CRM 适配器之前把 HubSpot path模板复used for所有平台; 本轮已按 HubSpot/Salesforce 分别生成 `/crm/v3/objects/*` 与 `/services/data/v*/sobjects/*` path.  |
| 1150 | src/plugins/adapters/crm-adapter.ts:136,143 把原始 action 而非 normalizedAction used for URL/handler 选择, alias 失效 | `done` | Root cause:  alias 解析后没有贯通到 dispatch 层; 本轮已统一以 `normalizedAction` 选择 URL 和 handler.  |
| 1151 | src/plugins/adapters/crm-adapter.ts ACTION_ALIASES globallyshared非按 crmType 分组, HubSpot alias 在 Salesforce 同样生效 | `done` | Root cause:  action alias 以前是globally表, 不distinguish CRM 方言; 本轮已收敛成按 runtime config 分组的 per-CRM alias.  |
| 1152 | src/plugins/adapters/crm-adapter.ts fetch(...) 无 AbortSignal/timeout, 无responsesizeupper limit | `done` | Root cause:  CRM requestexecute层以前directlybare调 `fetch`; 本轮已加入 `AbortController` timeout和response体sizeupper limit.  |
| 1153 | src/plugins/adapters/credential-hygiene.ts bytes.toString("utf8") 把秘密入不可零化字符串, 破坏 zeroize | `done` | Root cause: 凭据 helper 之前把秘密以 `reveal()` 长生命周期暴露给call方; 本轮已改成 `withSecret()` 回调式短生命周期暴露, 并继续只在in-memory中持有零化缓冲区.  |
| 1154 | src/plugins/adapters/credential-hygiene.ts fingerprintingtruncated到 12 hex (~48 bit), 同tenant大量凭据下生日攻击collision概率非可忽略 | `done` | Root cause: 凭据fingerprintingdefaulttruncatedlength过短; 本轮已把defaultfingerprinting扩到 24 hex.  |
| 1155 | src/plugins/adapters/livestream-adapter.ts healthCheck() credentialFingerprint===null 时永返 unhealthy; 初始化order无保证 | `done` | Root cause:  livestream 健康check把“未先认证”误当成“端点不健康”; 本轮已改成只validationstrategy与端点可达性, 不再受认证先后order影响.  |
| 1156 | src/plugins/index.ts 顶部 export * 把 builtin-plugin-registry 全部内部类public | `done` | Root cause: 插件 barrel 以前主要靠星号转发, 公共面边界不清; 本轮已改成explicitly受控导出, 并用单测lock定 `PluginMarketplaceRegistry` / `BundleRevocationRegistry` 不再从根 barrel leaked.  |
| 1157 | src/plugins/builtin-plugin-registry.ts BundleRevocationSeverity 枚举与 org-governance 中的 severity 取值并存两套 (critical/high/medium/low vs Critical/Major/Minor) , 事件桥接需手工映射. EN: dual revocation severity taxonomies. | `done` | Root cause:  bundle revocation 继承了历史枚举residual, 没有与现行治理严重级别单源对齐; 本轮已统一 severity taxonomy.  |
| 1158 | src/plugins/builtin-plugin-registry.ts isRevoked() / getActiveRevocation() 截止时间语义反向: 未到 effectiveAt 时return already-revoked, violates吊销contract. EN: deadline semantics inverted on activation window. | `done` | Root cause: 激活window判断把futurerecord也当作 active revocation; 本轮已改成只return已到 `effectiveAt` 的record.  |
| 1159 | src/plugins/builtin-plugin-registry.ts authenticate() onlycheck apiKey 非空字符串即via, 无密钥强度/格式validation. EN: trivial auth allows any non-empty key. | `done` | Root cause:  marketplace 认证以前只拒空值; 本轮已加格式与length门槛.  |
| 1160 | src/plugins/builtin-plugin-registry.ts sessions Set 无 TTL/expirycleanup; 长期运行in-memory增长. EN: unbounded session set leaks memory. | `done` | Root cause:  session state以前没有expiry治理; 本轮已改为带 TTL 的会话表和expiry清扫.  |
| 1161 | src/plugins/builtin-plugin-registry.ts normalizeManifest() only做 @platform/→@automatic-agent/ 字符串替换, 未handle嵌套 schema/field; 其它历史naming (如 @aa-platform/) 未coverage. EN: incomplete legacy-namespace migration. | `done` | Root cause:  manifest 规范化之前只coverage `@platform/`; 本轮已把 `@aa-platform/` 一并归一化.  |
| 1162 | src/plugins/builtin-plugin-registry.ts outputDataClass field定义但所有 builtin manifests 均未填, Set/Get path无人uses. EN: dead manifest field. | `done` | Root cause:  manifest 层面对outputdata分类没有真正落盘; 本轮已把 `outputDataClass` 变成 schema 内field并为 builtin manifests 提供default/explicitly值.  |
| 1163 | src/plugins/builtin-plugin-registry.ts globalMarketplaceRegistry / pluginRevocations / BundleRevocationRegistry 三个module-levelsingleton, resetBuiltinPluginRegistryStateForTests onlyreset其中一个, 单测互相pollute. EN: global singletons not all reset by test hook. | `done` | Root cause:  reset hook 过去没有coverage全部module-levelsingleton; 本轮已补齐cleanup.  |
| 1164 | src/plugins/builtin-plugin-registry.ts allowedExternalDomains: [] 与 allowNetworkEgress: true 同时出现, 组合语义“放行所有域”还是“无放行”未规范化. EN: ambiguous network-egress contract. | `done` | Root cause:  external adapter manifests 曾经exists“打开网络出口但不给域名白名单”的歧义configure; 本轮已补白名单并在 normalize 阶段消歧.  |
| 1165 | src/plugins/adapters/crm-adapter.ts:~30 default baseUrl=api.hubspot.com 与 crmType 无关, Salesforce configuremisses baseUrl 时仍指向 HubSpot. EN: default base URL ignores crmType discriminator. | `done` | Root cause: default base URL 绑定 HubSpot; 本轮已按 CRM type分流default地址.  |
| 1166 | src/plugins/adapters/crm-adapter.ts pathhardcoded /crm/v3/objects/, Salesforce REST path为 /services/data/vXX.X/sobjects/, 根本不可用. EN: HubSpot-specific path applied universally. | `done` | Root cause: path模板复用了 HubSpot implementation; 本轮已拆成平台特定path生成.  |
| 1167 | src/plugins/adapters/crm-adapter.ts:136,143 crmRequest(action,…) 把原始 action 而非 normalizedAction used for URL/handler 选择, alias 失效. EN: action alias resolution dropped before dispatch. | `done` | Root cause:  alias 解析没有贯通到requestexecute; 本轮已统一uses `normalizedAction`.  |
| 1168 | src/plugins/adapters/crm-adapter.ts ACTION_ALIASES 表globallyshared而非按 crmType 分组, HubSpot 的 alias 在 Salesforce 上同样生效, pollute语义. EN: aliases are not per-CRM. | `done` | Root cause:  alias 表以前没有按 CRM 方言隔离; 本轮已改成 per-CRM configure.  |
| 1169 | src/plugins/adapters/crm-adapter.ts fetch(...) call无 AbortSignal/timeout, 无responsesizeupper limit; malicious/迟缓后端可悬挂 worker. EN: missing fetch timeout & response size cap. | `done` | Root cause:  CRM requestexecute层missing少timeout与response尺寸约束; 本轮已补齐.  |
| 1170 | src/plugins/adapters/credential-hygiene.ts bytes.toString("utf8") 把秘密写入不可零化的 JS 字符串, 破坏subsequent zeroize 承诺. EN: plaintext copied into immutable string defeats zeroize. | `done` | Root cause: 凭据 helper 以前提供了长生命周期 `reveal()`; 本轮已改为回调式短生命周期暴露.  |
| 1171 | src/plugins/adapters/credential-hygiene.ts fingerprintingtruncated到 12 个 hex 字符 (~48 bit) , 同tenant大量凭据下生日攻击collision概率非可忽略. EN: fingerprint truncation collision risk. | `done` | Root cause: defaultfingerprinting位数过短; 本轮已扩到 24 hex.  |
| 1172 | src/plugins/adapters/livestream-adapter.ts healthCheck() 在 credentialFingerprint===null 时永远return unhealthy; 初始化order未保证 fingerprint 先就绪. EN: health check unreachable until external init. | `done` | Root cause: 健康check把认证state与端点健康coupling; 本轮已解除coupling.  |
| 1173 | src/plugins/index.ts 顶部 export * 把 builtin-plugin-registry 全部内部类 (如 BundleRevocationRegistry) public, 破坏封装. EN: barrel leaks internal classes. | `done` | Root cause: 根 plugins barrel missing少受控导出边界; 本轮已改成explicitly公共面并增加防leakstesting.  |
| 1174 | plugin-runtime-child.ts globally覆写 console.* pollute主process | `done` | Root cause:  runtime child 之前在 bootstrap 时永久覆写globally `console.*`; 本轮已改成only在directly stdio requestexecute期间临时重定向并在 finally 恢复.  |

## src/scale-ecosystem

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1175 | connector-runtime/index.ts:51, connector-framework-service.ts:453,472,486 runtimepath process.stderr.write 直写 | `done` | Root cause:  connector runtime/framework 早期沿用了最简 stderr 直写, 未统一到结构化error出口; 本轮已改成受控error上报, 不再directly写 `process.stderr`.  |
| 1176 | connector-framework-service.ts:265-298,335 invokeCallback(...) multiple places不 await/void, 未handle rejection | `done` | Root cause:  callback 交付以前被当成“旁路 best-effort”, 主流程没有把它纳入 async 生命周期; 本轮已统一 await 交付path.  |
| 1177 | connector-framework-service.ts:494,501 writeFileSync(path, ...) persistence manifest non-atomic, 与 cdc-replication-service.ts:841 临时file+rename 风格inconsistent | `done` | Root cause:  connector persistence最初只追求简单落盘, 没有复用原子写入模式; 本轮已改成临时file + rename 的原子persistence.  |
| 1178 | cdc-replication-service.ts:804-806,817-819 空 catch 后 clearState(), error = full丢复制state | `done` | Root cause:  CDC 恢复path把“读取快照failure”误当成“应当清空state”; 本轮已改成record告警并保留现有in-memorystate.  |
| 1179 | cdc-replication-service.ts:1074-1080 default batchSize/interval/retries/backoff hardcoded无 config 通路 | `done` | Root cause: 多区域复制协调器以前把default复制参数写死在 `setupRegionReplication()`; 本轮已抽到可injectiondefaultconfigure.  |
| 1180 | read-replica-service.ts:318,326,219,329 1000ms 滞后阈值与 100ms 轮询hardcoded, log用拼字符串 | `done` | Root cause:  read-after-write 等待逻辑最初只做fixed阈值轮询; 本轮已把 lag/poll 参数configure化, 并改成结构化log.  |
| 1181 | scale-ecosystem/marketplace/*-{,async}.ts 20 个单行 export * shim 不被 marketplace barrel 暴露, only深 import uses | `done` | Root cause:  marketplace barrel 之前没有把 shim 面向公共 API 暴露出来; 本轮已在 barrel 中补齐naming空间导出.  |
| 1182 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts (region as RegionDescriptor & {capabilities?}) typeassertion, requiredCapabilities strategy对所有 region 视为missing能力, 误降级 | `done` | Root cause: 路由层remaining了对旧 `RegionDescriptor` 形状的防御性typeassertion; 本轮已directlyuses规范化 `capabilities` field.  |
| 1183 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts ReadConsistencyLevel/ReadRoutingMode 二次 as assertionbypassvalidation | `done` | Root cause:  read-replica 路由参数在接线时duplicate声明了一套别名type, 再用 `as` 强转拼回去; 本轮已改成directly复用单一type.  |
| 1184 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts preferredRegionId 在区域被排除时silently忽略, 无 fallback 决策事件 | `done` | Root cause: 首选区域被filter后原implementation只silentlyfallback; 本轮已把 `preferred_region_excluded` 写入审计轨迹.  |
| 1185 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts failoverRegionId 兜底fallback到已被排除的同名 region 形成路由环 | `done` | Root cause:  failover 兜底逻辑过去没有再次filter primary/blocked region; 本轮已explicitly按候选集和排除集重新解析 failover.  |
| 1186 | src/scale-ecosystem/multi-region/fencing-token-service.ts module-levelsingletonmissing reset API, paralleltesting令牌monotonic递增计数器互相pollute | `done` | Root cause: 这条 review based on旧快照; 当前 `fencing-token-service` 已提供 `resetFencingTokenService()`, paralleltesting隔离interface已exists.  |
| 1187 | src/scale-ecosystem/multi-region/split-brain-protection.ts module-level quorum Map 无 size upper limit, 多tenant场景无限增长 | `done` | Root cause:  split-brain 保护服务之前只追加 quorum state, 没有容量治理; 本轮已为跟踪表增加upper limit与最旧心跳淘汰.  |
| 1188 | src/scale-ecosystem/multi-region/read-replica-service.ts 副本健康判定based on lastHeartbeatAt<now-threshold, threshold default未文档化, 时区天真 | `done` | Root cause: 这条问题来自旧implementation; 当前副本健康已based onexplicitly健康state与 lag 判定, 不再按 `lastHeartbeatAt` 做时区敏感阈值比较.  |
| 1189 | src/scale-ecosystem/multi-region/cdc-replication-service.ts module-level CDC offset cached为singleton, 重连时未清 in-flight 批次, 可replay | `done` | Root cause:  review record停留在更早的singletoncachedimplementation; 当前 CDC state已收口为实例级persistence队列与 checkpoint.  |
| 1190 | src/scale-ecosystem/marketplace/ globalMarketplaceRegistry singleton无 reset hook, 单测之间发布的 bundle 互相可见 | `done` | Root cause: 该singleton后来已从 `scale-ecosystem/marketplace` 拆出; 当前目录下不再承载这个globally registry, 本条属于旧implementationresidual.  |
| 1191 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts (region as RegionDescriptor & {capabilities?}) typeassertion; 带 requiredCapabilities 的strategy对所有 region 一律视为missing能力, 触发误降级. EN: type cast hides missing capabilities, mis-evaluates routing. | `done` | Root cause: 路由层对旧 region 形状的type补丁没有被cleanup; 本轮已改成directly读取标准 `capabilities`.  |
| 1192 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts ReadConsistencyLevel/ReadRoutingMode via as 二次assertionbypassvalidation, configureerror值不被reject. EN: enum laundering bypasses validation. | `done` | Root cause:  read replica 选项层自己重定义了一层type再强转; 本轮已收口到单一 `ReadConsistencyLevel/ReadRoutingMode`.  |
| 1193 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts preferredRegionId 在区域被排除时silently忽略, 未发出 fallback 决策事件, ops盲区. EN: silent preference drop, no audit event. | `done` | Root cause: 首选区域落选时只做隐式fallback; 本轮已补 fallback audit trail.  |
| 1194 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts failoverRegionId 兜底逻辑会fallback到已被排除的同名 region, 形成路由环. EN: failover may select an already-excluded region. | `done` | Root cause:  failover 候选重算没有排除 primary/blocked region; 本轮已改成按候选集explicitly选择.  |
| 1195 | src/scale-ecosystem/multi-region/fencing-token-service.ts module-levelsingleton, registerForTest/reset API missing; paralleltesting令牌monotonic递增计数器互相pollute. EN: global counter not test-isolated. | `done` | Root cause: 这条 review based on旧版本; 当前implementation已提供 `resetFencingTokenService()`.  |
| 1196 | src/scale-ecosystem/multi-region/split-brain-protection.ts module-level quorum 表用 Map, 没有 size upper limit; 多tenant场景下表无限增长. EN: unbounded quorum map. | `done` | Root cause:  quorum state曾经没有回收; 本轮已加容量upper limit与淘汰.  |
| 1197 | src/scale-ecosystem/multi-region/read-replica-service.ts 副本健康判定based on lastHeartbeatAt < now - threshold 但 threshold default值未在 config 文档中固化, 多 region 时区差导致误判. EN: heartbeat threshold default undocumented and timezone-naive. | `done` | Root cause: 旧版本健康判定走时间戳阈值; 当前implementation已切到健康state + lag, 并把 lag 阈值configure化.  |
| 1198 | src/scale-ecosystem/multi-region/cdc-replication-service.ts module-level CDC offset cached为singleton, 重连时未cleanup in-flight 批次, 重启后可能replay. EN: singleton CDC cache replays on reconnect. | `done` | Root cause:  review 落在旧singletoncached阶段; 当前implementation已是实例级persistence队列.  |
| 1199 | src/scale-ecosystem/marketplace/ 内的 globalMarketplaceRegistry singleton无 reset hook, 单测之间发布的 bundle 互相可见. EN: marketplace registry not test-isolated. | `done` | Root cause: 问题来源于已拆出的旧 marketplace registry implementation; 当前 `scale-ecosystem/marketplace` 目录不再maintained该singleton.  |
| 1200 | region-health-check-service.ts fetch 未透传 AbortSignal | `done` | Root cause:  review based on旧implementation; 当前 `measureNetworkLatency()` 已via `AbortSignal.any()` 合并call方 signal 与timeout signal.  |

## src/ops-maturity (drift, explainability, platform-ops)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1201 | locking-support.ts:12, postgres/pg-database.ts:353, redis-queue-adapter.ts:266, rule-engine.ts:399, human-takeover-service-async.ts:320, evolution-mvp-service-async.ts 等 ESM module内bare require(), 加载即抛 ReferenceError | `todo` | 待修复 |
| 1202 | evolution-mvp-service-async.ts 用 undefined as unknown as ApprovalService/MemoryService construction, 首次call即 NPE | `todo` | 待修复 |
| 1203 | edge-runtime-sync-service.ts:120,138,203, video-processor/index.ts:319, self-healing-service.ts:327, semver-validator.ts:234, version-compatibility-matrix.ts:224, capacity-predictor/index.ts:61 array/field非空assertionhas no preguard | `todo` | 待修复 |
| 1204 | drift-detection/{benchmark-runner,evidence-store,promotion-gate,proposal-engine,reflection-engine,rollout-manager,rollout-repository}.ts 7 份单行 export * shim duplicate | `todo` | 待修复 |
| 1205 | drift-detection/index.ts:12-28 同时 re-export sibling 与 shim, barrel duplicatesymbols导出 NodeNext conflict | `todo` | 待修复 |
| 1206 | drift-detection/evolution-mvp-service.ts:5 服务file顶部 export * from "./evolution-mvp-support.js" 把内部 helper 全部public | `todo` | 待修复 |
| 1207 | drift-detection/evolution-mvp-service.ts:97-114 EvolutionProposalRecord.id 与幂等键都用 newId(), 无 caller 幂等 token, 双击双提案 | `todo` | 待修复 |
| 1208 | drift-detection/evolution-mvp-service.ts:130-608 4 个近相同 ~28 行 event.insertEvent(...) 块, schema 改动需 4 处synchronous | `todo` | 待修复 |
| 1209 | drift-detection/evolution-mvp-service.ts:182,431 minQualityScore:0.65, confidence:0.8 魔术阈值 | `todo` | 待修复 |
| 1210 | drift-detection/evolution-mvp-service.ts:464-516 applyProposal 不validation appliedAt monotonic, 乱序时间戳pollute审计 | `todo` | 待修复 |
| 1211 | drift-detection/evolution-mvp-service.ts:662-665 JSON.parse(approvalRecord.requestJson) as ApprovalRequest 无 schema | `todo` | 待修复 |
| 1212 | drift-detection/evolution-integration-service.ts:74 default new InMemoryEvidenceStore(), 重启即loss证据 | `todo` | 待修复 |
| 1213 | drift-detection/evolution-integration-service.ts:46,136 enableAutomaticProposal:true 死configure; confidence:0.7 忽略上层 proposalConfidenceThreshold | `todo` | 待修复 |
| 1214 | drift-detection/evolution-integration-service.ts:268 rootCause.slice(0,50) truncated可能切坏多字节字符 | `todo` | 待修复 |
| 1215 | drift-detection/drift-detector-service.ts:48-87 16 个魔术阈值无 contract 链接 | `todo` | 待修复 |
| 1216 | drift-detection/drift-detector-service.ts:80-87 fingerprintWindowToDriftWindow 把 30d/90d 折叠为 7d, alert 路由misalignment | `todo` | 待修复 |
| 1217 | drift-detection/drift-detector-service.ts:164-273,298-323 multiple places split(":")[index] + includes("input/output/cusum/bayesian") 启发式分类 | `todo` | 待修复 |
| 1218 | drift-detection/drift-detector-service.ts:363-407 Jaccard 相似度无length归一/权重; safeHashEquals 双 Buffer 分配无收益 | `todo` | 待修复 |
| 1219 | platform-ops-agent/platform-ops-agent-service.ts:102 proposals = new Map 无persistence/eviction/upper limit | `todo` | 待修复 |
| 1220 | platform-ops-agent/platform-ops-agent-service.ts:174-193,200-260 execute() 实为 receipt placeholder; approval 可bypass autonomy_limit_reached; >=0.05/0.2/200 魔术阈值无 config | `todo` | 待修复 |
| 1221 | platform-ops-agent/self-healing-service.ts:138-167 simulateHealthCheck 用字符串length推算 recoveryTimeMs | `todo` | 待修复 |
| 1222 | platform-ops-agent/self-healing-service.ts:174-220 冷却query find(...) return最旧record; computeCooldownMs 无upper limit可被拉至天级blocks合法操作 | `todo` | 待修复 |
| 1223 | platform-ops-agent/self-healing-service.ts:75-95 executionId==null 事件被silently丢弃, 冷却blocks类事件审计断链 | `todo` | 待修复 |
| 1224 | platform-ops-agent/self-healing-service.ts:85 taskId: harnessRunId ?? executionId 把 harness id 写入 task_id 列, 跨表 join 别名 | `todo` | 待修复 |
| 1225 | src/ops-maturity/explainability/explanation-pipeline-service.ts 解释结果cached string key (subjectId+timestamp) 未truncated颗粒度, 命中率近 0 | `todo` | 待修复 |
| 1226 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:196 lastAlertSampleIndex 实例可变state, detect() concurrent产生 race | `todo` | 待修复 |
| 1227 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:218 detectAll default windowTypes only 1h/6h/24h/7d, 遗 30d/90d | `todo` | 待修复 |
| 1228 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:240 Math.floor(baselineWindowOrWindows as number) accepts负数后 Math.max(1,…) silently修正 | `todo` | 待修复 |
| 1229 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:244-245 baseline/recent 切片可overlap (短样本) , baseline 含future值pollute统计 | `todo` | 待修复 |
| 1230 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:261-265 lastAlertSampleIndex only检测时刷新且不衰减, 超长运行后抑制window失真 | `todo` | 待修复 |
| 1231 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:436,455,471,486 四算法均要求 recentMean<baselineMean, 对 cost_spike/override_rate/incident_count 等"高于即恶化"指标无法触发 | `todo` | 待修复 |
| 1232 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:404,502 relativeShift=absoluteShift/baselineMean, baseline=0 永远 0, 零基线指标无法检测drift | `todo` | 待修复 |
| 1233 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:469 贝叶斯后验魔术常数 0.05 无comment/文档 | `todo` | 待修复 |
| 1234 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:631 平坦分布 (max==min) 时 bucketize 返 [1,0,0,…], 两侧不同常数值的平坦分布 JS divergence=0 漏检 step shift | `todo` | 待修复 |
| 1235 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:638 bucketize 各自用本组 min/max, KL/JS 比较无几何意义 | `todo` | 待修复 |
| 1236 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:280,552 severityToAction low→observe, 但 ops 文档要求 low→require_review, 两套response映射并存 | `todo` | 待修复 |
| 1237 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:350-352 aggregateResults ...selected 后coverage reasonCode, 原 window reason 被loss | `todo` | 待修复 |
| 1238 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:313-314 planId=drift_plan:${type}:${id}:${ISOtimestamp} 含冒号, 下游以 : 分段解析器misalignment | `todo` | 待修复 |
| 1239 | src/ops-maturity/drift-detection/changepoint-detector/index.ts 整file无 import; 与同目录 drift-detector-service.ts/drift-detector.ts 各有independent DriftWindowType 等定义, type未单源 | `todo` | 待修复 |
| 1240 | src/ops-maturity/explainability/explanation-pipeline-service.ts 解释结果cacheduses string key (subjectId+timestamp) , 未truncated timestamp 颗粒度, cached命中率近 0. EN: cache key over-specified, defeats caching. | `todo` | 待修复 |
| 1241 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:196 lastAlertSampleIndex 实例可变state, detect() concurrentcall产生 race, suppression 决策inconsistent. EN: detector is not concurrency-safe. | `todo` | 待修复 |
| 1242 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:218 detectAll default windowTypes only含 1h/6h/24h/7d, misses架构中规范化的 30d/90d. EN: defaults miss canonical long windows. | `todo` | 待修复 |
| 1243 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:240 Math.floor(baselineWindowOrWindows as number) accepts负数后被 Math.max(1,…) silently修正, 掩盖参数error. EN: silent coercion of invalid baseline window. | `todo` | 待修复 |
| 1244 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:244-245 baseline 与 recent 切片可overlap (短样本时) , baseline 含future值pollute统计. EN: overlapping baseline/recent slices. | `todo` | 待修复 |
| 1245 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:261-265 lastAlertSampleIndex only在检测时刷新且不衰减, 超长运行后抑制window比较失真. EN: monotonic counter never decays, breaks suppression long-term. | `todo` | 待修复 |
| 1246 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:436,455,471,486 四种算法均要求 recentMean < baselineMean, 对 cost_spike/override_rate/incident_count 等“高于即恶化”的指标无法触发. EN: one-direction-only detection misses upward-degradation metrics. | `todo` | 待修复 |
| 1247 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:404,502 relativeShift = absoluteShift / baselineMean, baseline 为 0 时永远 0, 零基线指标无法检测drift. EN: zero-baseline never triggers relative threshold. | `todo` | 待修复 |
| 1248 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:469 贝叶斯后验中魔术常数 0.05 无comment/文档; 调参basismissing. EN: undocumented magic constant in posterior. | `todo` | 待修复 |
| 1249 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:631 平坦分布 (max==min) 时 bucketize return [1,0,0,…], 两侧不同常数值的平坦分布得 JS divergence=0, 漏检 step shift. EN: degenerate flat-distribution handling masks shifts. | `todo` | 待修复 |
| 1250 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:638 bucketize 各自用本组 min/max 划桶, baseline 与 recent 不同 bin 边界, KL/JS 比较无几何意义. EN: histograms not on common support invalidates divergence. | `todo` | 待修复 |
| 1251 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:280,552 severityToAction 把 low → observe, 但 ops 文档要求 low → require_review, 两套response映射并存. EN: severity→action mapping inconsistent with response policy. | `todo` | 待修复 |
| 1252 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:350-352 aggregateResults 用 ...selected 后coverage reasonCode, 原 window 的 reason 被loss, 归因可观测性下降. EN: aggregation loses originating reason code. | `todo` | 待修复 |
| 1253 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:313-314 planId = drift_plan:${type}:${id}:${ISOtimestamp} 含冒号, 下游期望以 : 分段的解析器会misalignment. EN: planId delimiter collision with timestamp colons. | `todo` | 待修复 |
| 1254 | src/ops-maturity/drift-detection/changepoint-detector/index.ts 整file无任何 import; 与同目录 drift-detector-service.ts/drift-detector.ts 各有independenttype DriftWindowType 等定义, type未单源; 外部uses易写错references. EN: duplicated types across sibling drift modules. | `todo` | 待修复 |
| 1255 | explanation-pipeline-service.ts:153 用 @ts-expect-error bypass exactOptionalPropertyTypes | `todo` | 待修复 |
| 1256 | noisy-neighbor-protection.ts:227 type与runtimedata形状inconsistent | `todo` | 待修复 |

## src/domains & runtime catalog

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1257 | plugin-runtime-host.test.ts coverage process.execArgv 未复原会pollutesubsequent | `done` | Root cause: 旧testing曾directly改写 `process.execArgv`; 当前相关用例已经在 `t.after()` 中恢复原值.  |
| 1258 | plugin-runtime-host.ts:741-742 JSON.parse(env.AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON) 无 schema 即 spread 入 spawn, env 控制命令construction | `done` | Root cause:  container launcher 模板之前只做 JSON 语法validation, 没有结构约束; 本轮已加入arraylength与元素type schema validation.  |
| 1259 | plugin-runtime-host.ts:364 把整个 process.env 传给 spawn 后再 filter, 应改为explicitly白名单 | `done` | Root cause: 这条 review based on旧implementation; 当前 runtime host 已在 `buildPluginRuntimeEnvironment()` 中按白名单转发环境变量.  |
| 1260 | plugin-runtime-child.ts:14, plugin-runtime-host.ts:26, plugin-spi-registry.ts:21, safe-load-division-registry.ts:7, division-loader.ts:51, recipe-executor.ts:6, dashboard-websocket-server.ts:64, stores/index.ts:8, chinese-wall-access-saga.ts:39, evidence-collector.ts:62 module顶层 new StructuredLogger(...) 创建singleton, testing/生命周期隐患 | `todo` | 待修复 |
| 1261 | domains/index.ts:7-9 re-export ../domains-runtime-*.js 跨出 domains 树 (边界倒置)  | `todo` | 待修复 |
| 1262 | src/domains-runtime-catalog.ts WeakMap cached keying registry, resetForTests() 不清 WeakMap, 旧 registry 仍持 stale 编排 | `done` | Root cause:  runtime catalog 以前只有 WeakMap cached, 没有explicitly reset 钩子; 本轮已补 `resetDomainsRuntimeCatalogForTests()`.  |
| 1263 | src/domains-runtime-catalog.ts call registerDomainsBootstrap() 未传 registry 参数, 永远用globally registry, scoped registry 被忽略 | `done` | Root cause:  `buildDomainsRuntimeCatalog()` 早期偷用了defaultglobally registry; 本轮已explicitly透传call方 registry.  |
| 1264 | src/domains-runtime-catalog.ts 顶部 import { DomainReadinessRing } onlytypecomment提及, runtime未用, 死 import | `done` | Root cause:  catalog file保留了未uses的type导入; 本轮已cleanup.  |
| 1265 | src/domains-runtime-orchestrator.ts defaultconstruction内 ServiceRegistry.createScoped() 每实例新建作用域, 跨实例sharedstateloss | `done` | Root cause:  orchestrator defaultconstructionpath之前偏向testing隔离, 导致runtime实例default不shared registry; 本轮已改回 `ServiceRegistry.getInstance()`.  |
| 1266 | src/domains-runtime-orchestrator.ts this.startupPlan 在construction与 initialize 中duplicate赋值, 第二次写入coveragetesting期 plan stub | `done` | Root cause:  startup 流程duplicate回写 `startupPlan`; 本轮已去掉冗余二次赋值.  |
| 1267 | src/domains-runtime-orchestrator.ts registry.get(SVC_ID) return值丢弃但call为求副作用, dependency registry 内部 lazy init | `done` | Root cause:  orchestrator 注册后用bare `get()` 触发初始化, 意graph不清; 本轮已改成explicitly `ensureOrchestratorRegistered()`.  |
| 1268 | src/domains-startup-plan.ts rings forceserial, 与设计文档中parallel ring 启动表述矛盾 | `todo` | 待修复 |
| 1269 | src/domains/registry/domain-registry-service.ts register(domainId, manifest) 同 id 二次注册only warn-and-replace, 无 idempotency token, concurrent竞态后写coverage前写 | `done` | Root cause: 这条 review based on旧implementation; 当前 `DomainRegistryService.register()` 已对duplicate domainId directlythrows验证error.  |
| 1270 | src/domains/registry/plugin-spi-registry.ts SPI 表用 plain object 而非 Map, **proto**/constructor injectionrisk | `done` | Root cause:  SPI registry 更早版本uses对象literal量存表; 当前implementation已经是 `Map<string, RegisteredPluginRecord>`.  |
| 1271 | src/domains/registry/plugin-runtime-host.ts 主机process未对 plugin unhandledRejection 隔离, 单 plugin 故障pollute主process | `todo` | 待修复 |
| 1272 | src/domains-runtime-catalog.ts WeakMap cached对 registry 实例 keying, 但 resetForTests() 不cleanup WeakMap, 回收前的旧 registry 仍持有 stale 编排. EN: WeakMap cache survives test reset. | `done` | Root cause:  runtime catalog cachedmissing少 reset 钩子; 本轮已补explicitlycleanupentry.  |
| 1273 | src/domains-runtime-catalog.ts call registerDomainsBootstrap() 时未传 registry 参数, 永远usesglobally registry, scoped registry 被忽略. EN: registry-scope arg missing. | `done` | Root cause:  build path没有把 scoped registry 贯通到 bootstrap; 本轮已修正为explicitly透传.  |
| 1274 | src/domains-runtime-catalog.ts 顶部 import { DomainReadinessRing } only在typecomment中提及, runtime未uses, 构成死 import 增加冷启动. EN: dead import. | `done` | Root cause: 未cleanup的死type导入; 本轮已删除.  |
| 1275 | src/domains-runtime-orchestrator.ts defaultconstruction内 ServiceRegistry.createScoped() 每实例新建作用域, 跨实例sharedstateloss. EN: per-instance scope breaks shared registry. | `done` | Root cause:  orchestrator defaultconstructionuses scoped registry; 本轮已改为sharedglobally registry.  |
| 1276 | src/domains-runtime-orchestrator.ts this.startupPlan 在construction与 initialize 中duplicate赋值, 第二次写入coveragetesting期 plan stub. EN: redundant reassignment overwrites injected stub. | `done` | Root cause: duplicate回写 startup plan; 本轮已removal冗余赋值.  |
| 1277 | src/domains-runtime-orchestrator.ts registry.get(SVC_ID) return值被丢弃但call为求副作用, dependency registry 内部 lazy init; 让阅读者误以为是 noop. EN: side-effect-only get(); intent unclear. | `done` | Root cause: dependency lazy init 的bare `get()` call语义不清; 本轮已封装成explicitly ensure 方法.  |
| 1278 | src/domains-startup-plan.ts rings forceserialexecute, 与文档中parallel ring 启动表述矛盾. EN: serial rings contradict design doc. | `todo` | 待修复 |
| 1279 | src/domains/registry/plugin-spi-registry.ts SPI 表uses plain object 而非 Map, 原型链field **proto**/constructor injectionrisk (若 domainId 来自configurefile) . EN: prototype-pollution via untrusted key. | `done` | Root cause: 旧 SPI registry 曾经uses plain object; 当前implementation已经改成 `Map`.  |
| 1280 | src/domains/registry/plugin-runtime-host.ts 主机process未对 plugin throws的 unhandledRejection 做隔离, 单 plugin 故障pollute主process. EN: missing per-plugin rejection isolation. | `todo` | 待修复 |

## src/interaction (NL gateway)

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1281 | nl-gateway/index.ts:290 IntentParserPort 与 ModelIntentParserPort inconsistent, 未做适配 | `todo` | 待修复 |
| 1282 | proactive-agent/index.ts:167-168, conversation-history-service.ts:323-324,358-359, workflow-builder-service.ts:110-111,792-793, onboarding/index.ts:183-184, intent-parser/index.ts:206,291,301 multiple places空 catch silently吞错并return null/false | `todo` | 待修复 |
| 1283 | src/interaction/nl-gateway/intent-parser/index.ts:66 关键词regex含 通行, 匹配 通行证/通行规则 等非审批语境 | `done` | Root cause: 审批关键词过去把“via/通行”类子串directly并入regex; 本轮已收紧审批模式并补反例testing.  |
| 1284 | src/interaction/nl-gateway/intent-parser/index.ts:70 delete\|remove\|drop 无单词边界, dropdown/removed once 触发 task_modify | `done` | Root cause: 英文删除动词regex以前没有边界; 本轮已补 `\b` limit.  |
| 1285 | src/interaction/nl-gateway/intent-parser/index.ts:126-135 语种检测order使含 kanji 但无 kana 日文混排被识别 zh-CN, 德语regex误命中 ä/ö 的瑞典语/芬兰语 | `done` | Root cause: 语言检测以前只用粗粒度字符集启发式; 本轮已补日文业务词信号并收紧德语触发条件.  |
| 1286 | src/interaction/nl-gateway/intent-parser/index.ts:162 requestPatterns 英文动词无 \b, deploy 命中 redeployment | `done` | Root cause: 英文request动词过去usesbare子串匹配; 本轮已加单词边界.  |
| 1287 | src/interaction/nl-gateway/intent-parser/index.ts:196 Array.isArray(parsed)?parsed.filter(Boolean):… 返 [null, valid] 时 primary 取原 index 1 元素行为dependency宿主 | `done` | Root cause: 模型结果归一化以前dependency `filter(Boolean)` 的宽松行为; 本轮已换成explicitly `ParsedIntentToken` type guard.  |
| 1288 | src/interaction/nl-gateway/intent-parser/index.ts:282 JSON.parse(response) 对 LLM return reasoning/language field无sizevalidation | `done` | Root cause: 模型 JSON 解析path只validationtype不validationlength; 本轮已加入 reasoning/language truncated与归一化.  |
| 1289 | src/interaction/nl-gateway/intent-parser/index.ts:44-52 INTENT_CONFIDENCE_THRESHOLDS 与 IntentConfidenceThresholds 双导出, 公共 API 同义双naming易drift | `done` | Root cause: 阈值常量过去采用另一套naming风格; 本轮已收口到单一 `intentConfidenceThresholds` 公共面.  |
| 1290 | src/interaction/nl-gateway/intent-parser/index.ts:66 关键词regex含 通行, 会匹配 通行证/通行规则 等非审批语境, 造成误分类. EN: substring approval-keyword false positive. | `done` | Root cause: 审批关键词把子串命中也算作审批动作; 本轮已收紧模式并加反例testing.  |
| 1291 | src/interaction/nl-gateway/intent-parser/index.ts:70 delete\|remove\|drop 无单词边界, dropdown / removed once 触发 task_modify. EN: missing word boundary causes false positive. | `done` | Root cause: 删除动词regexmissing少单词边界; 本轮已修正.  |
| 1292 | src/interaction/nl-gateway/intent-parser/index.ts:126-135 语种检测order使dependency kanji 但无 kana 的日文混排消息被识别为 zh-CN; 德语regex误命中含 ä/ö 的瑞典语/芬兰语. EN: language-detection order and German regex over-broad. | `done` | Root cause: 语言启发式过粗; 本轮已补日文信号并收紧德语识别.  |
| 1293 | src/interaction/nl-gateway/intent-parser/index.ts:162 requestPatterns 英文动词无 \b, deploy 命中 redeployment, state消息被误判为 task_create. EN: word-boundary missing on English request verbs. | `done` | Root cause:  requestPatterns usesbare英文子串; 本轮已加边界.  |
| 1294 | src/interaction/nl-gateway/intent-parser/index.ts:196 Array.isArray(parsed) ? parsed.filter(Boolean) : … typeunsafe; return [null, valid] 时 primary 取到原 index 1 元素行为dependency宿主implementationdetails. EN: filter(Boolean) typing escape. | `done` | Root cause: 模型output归一化missingexplicitlytypefilter; 本轮已用 type guard.  |
| 1295 | src/interaction/nl-gateway/intent-parser/index.ts:282 JSON.parse(response) 对 LLM return的 reasoning/language field无sizevalidation, malicious/异常长return会无限存储. EN: unbounded LLM response field accepted. | `done` | Root cause: 解析path没有lengthlimit; 本轮已补fieldtruncated.  |
| 1296 | src/interaction/nl-gateway/intent-parser/index.ts:44-52 INTENT_CONFIDENCE_THRESHOLDS (SCREAMING_SNAKE) 与 IntentConfidenceThresholds interface (camelCase) 双导出, 公共 API 同义双naming易drift. EN: parallel public-API taxonomies. | `done` | Root cause: 阈值公共 API 曾经并存两套naming; 本轮已收口到单一naming.  |

## src/org-governance

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1297 | src/org-governance/approval-routing/approval-routing-service.ts state机allows approved → withdrawn directly转换, skip审计 revoked 中间态 | `todo` | 待修复 |
| 1298 | src/apps/api/index.ts:10 vs src/apps/workers/index.ts:10 requiredLayers 未coverage interaction/org-governance, 但 worker dispatch 调 approval-routing | `done` | Root cause:  worker manifest 声明层没有跟上真实dependency面; 本轮已把 `interaction` 与 `org-governance` 补回 requiredLayers.  |
| 1299 | src/org-governance/approval-routing/approval-routing-service.ts state机allows approved → withdrawn directly转换, skip审计 revoked 中间态, 与contract文档不符. EN: missing intermediate state in approval FSM. | `todo` | 待修复 |
| 1300 | src/apps/api/index.ts:10 vs src/apps/workers/index.ts:10 requiredLayers 列表未coverage interaction/org-governance, 但 worker 在 dispatch 中调 approval-routing, 声明与runtimedependencyinconsistent. EN: declared layers diverge from runtime imports. | `done` | Root cause:  worker app manifest 的层声明滞后于runtime导入; 本轮已补齐.  |
| 1301 | org-governance/index.ts:1-9 barrel missing org-routing/ | `done` | Root cause:  org-governance 顶层 barrel 漏掉 `org-routing` 公共面; 本轮已补导出.  |

## src/core & runtime

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1302 | src/core/runtime/index.ts:18 placeholder常量 WorkflowStepCheckpoint 与同file re-export 的同名 interface conflict, 且exists ambiguous export * | `todo` | 待修复 |
| 1303 | src/runtime/agent-runtime/index.ts compatibility shim 死代码 (未暴露, 零references)  | `todo` | 待修复 |
| 1304 | src/core/runtime/index.ts WorkflowStepCheckpoint 在 export * 中已暴露 class, 又追加 export type WorkflowStepCheckpoint=string, name collision | `todo` | 待修复 |
| 1305 | src/runtime/agent-runtime/index.ts:9-15 export * 自 7 platform file, 叠加 L18-32 具名 type re-export, LlmModelCallRequest/ContextCompactionOptions 同名duplicate声明歧义 | `todo` | 待修复 |
| 1306 | src/core/runtime/index.ts 同时含local type alias 与 re-export 同名, round-tripping 后 typecheck drift | `todo` | 待修复 |
| 1307 | src/core/runtime/index.ts WorkflowStepCheckpoint 在 export * re-export 中已暴露为 class, 又在本file追加 export type WorkflowStepCheckpoint = string, 造成同名 class/type conflict. EN: name collision via re-export. | `todo` | 待修复 |
| 1308 | src/runtime/agent-runtime/index.ts:9-15 export * 自 7 个 platform file, 叠加 L18-32 的具名 type re-export, exists歧义 re-export (LlmModelCallRequest/ContextCompactionOptions 同名duplicate声明) . EN: ambiguous re-export from barrel. | `todo` | 待修复 |
| 1309 | src/core/runtime/index.ts file即纯 barrel, 但同时声明local type alias 与 re-export 同名导致 round-tripping 后 typecheck drift (既有审计 #1 的延伸: 本轮还观察到 WorkflowStepCheckpoint 的 type/class 双重identity) . EN: barrel layering produces conflicting symbol kinds. | `todo` | 待修复 |

## src/apps & entry

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1310 | src/index.ts module-level new StructuredLogger({retentionLimit:100}) 每次 import construction, retention 缓冲随testing suite 数线性增长 | `todo` | 待修复 |
| 1311 | src/index.ts redactStartupErrorMessage() only匹配少量regex, misses Authorization: Basic …/Bearer …/"token":"…"/JWT 三段式 | `todo` | 待修复 |
| 1312 | src/index.ts entry判断 import.meta.url===pathToFileURL(resolve(scriptPath)).href 对 npm bin 软链失效, 与仓库其他 isCliEntryPoint inconsistent | `todo` | 待修复 |
| 1313 | src/index.ts step名hardcoded "x1-fabric" 字符串比较, 编排step改名时无type保护 | `todo` | 待修复 |
| 1314 | src/index.ts failurepath process.exitCode=1 但未 unref 已开资源, process卡住等 event loop 排空 | `todo` | 待修复 |
| 1315 | src/apps/index.ts:16 Object.freeze(PLATFORM_APPS) only冻结外层, 每 manifest requiredLayers array可变 | `todo` | 待修复 |
| 1316 | src/apps/index.ts:35 resolvePlatformAppManifest("summary"\|"demo") 永返 null (这两值是 startupTargetKind 而非 appKind/appId) , 易混淆 | `todo` | 待修复 |
| 1317 | src/apps/api/index.ts:6 & src/apps/workers/index.ts:6 entryModule 为字符串path, file移动后无编译期 link, manifest silently失效 | `todo` | 待修复 |
| 1318 | src/index.ts module-level new StructuredLogger({retentionLimit:100}) 在每次 import 时construction, retention 缓冲随testing suite 数线性增长. EN: per-import logger leaks retention buffer. | `todo` | 待修复 |
| 1319 | src/index.ts redactStartupErrorMessage() only匹配少量regex, misses Authorization: Basic …, Bearer …, "token":"…" JSON 片段, JWT 三段式. EN: redaction misses common secret formats. | `todo` | 待修复 |
| 1320 | src/index.ts entry判断 import.meta.url === pathToFileURL(resolve(scriptPath)).href 对 npm bin 软链失效; 与仓库其它处用 isCliEntryPoint inconsistent. EN: inconsistent CLI-entry detection. | `todo` | 待修复 |
| 1321 | src/index.ts step名hardcoded "x1-fabric" 字符串比较; 编排step改名时无type保护. EN: magic string couples bootstrap to legacy step id. | `todo` | 待修复 |
| 1322 | src/index.ts failurepath process.exitCode = 1 但未 unref 已打开的资源 (DB/timer) , 导致process卡住等 event loop 排空. EN: exit-code without graceful shutdown can hang process. | `todo` | 待修复 |
| 1323 | src/apps/index.ts:16 Object.freeze(PLATFORM_APPS) only冻结外层array, 每个 manifest 的 requiredLayers array可变, 外部代码修改后pollute所有call者. EN: shallow freeze leaks mutability. | `todo` | 待修复 |
| 1324 | src/apps/index.ts:35 resolvePlatformAppManifest("summary"\|"demo") 永远return null (这两个值是 startupTargetKind 而非 appKind/appId) , call方易混淆. EN: target-kind vs app-kind confusion silently returns null. | `todo` | 待修复 |

## src other

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1325 | 多个 ADR references已迁移的 src/core/{memory,knowledge,agent-loop,storage}/ | `todo` | 待修复 |

## Uncategorized

| # | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1326 | pack-test-local-service.ts:207-214,228-233 runIntegrationTests/runSimulationTests arbitrary减扣 casesPassed/coveragePercent, 伪造testing结果 | `todo` | 待修复 |
| 1327 | Control Plane跨入Orchestration Plane拉 getWorkflowDefinition | `todo` | 待修复 |
| 1328 | 16 个 1000+ LOC 候选file需要split | `todo` | 待修复 |
| 1329 | JSDoc/@see 同时exists 5 套互斥仓库 URL | `todo` | 待修复 |
| 1330 | skill-execution-{cache,core,support,service}-methods.ts 4 份切片循环dependency | `todo` | 待修复 |
| 1331 | 多份文档含 /Users/holden/Project/... 私人绝对path | `todo` | 待修复 |
| 1332 | docs_en review file 373 处把 five-plane-* 机翻为 5-plane-* | `todo` | 待修复 |
| 1333 | docs_en review 反引号被 HTML 实体 ' 替换, markdown 失效 | `todo` | 待修复 |
| 1334 | platforme-full-review.md 引 errors.js (实为 .ts) , 并uses非可解析 brace path | `todo` | 待修复 |
| 1335 | quickstart.md:108 列出不exists的 npm run docs:lint | `done` | quickstart 曾references已删除的历史脚本名, 文档未随验证entry迁移.  |
| 1336 | 3 份 review file (9–34 行) only声称"已完成"无证据, 却被标为权威 | `done` | review 文档missing少统一的结论, Root Cause与证据回写规则.  |
| 1337 | temp-cache-cleanup.md, full-cleanup-review.md 为expiry一次性报告, 含个人path | `done` | 一次性cleanup报告长期留在活跃目录, missing少归档与index边界.  |
| 1338 | operations-tracker.md "Last updated 2026-04-14" 已stale | `done` | EN operations-tracker 未synchronous 2026-05-27 之后的index收敛.  |
| 1339 | current_todo_list.md 与 project_progress_tracker.md 进度口径conflict | `done` | todo index与 progress tracker 曾各自maintainedstate口径, missing少单一权威entry.  |
| 1340 | release-versioning.md 与 operations-checklist.md 互不references Pre-Launch Top 20 | `done` | release 版本文档与发布check清单分离maintained, missing少互链.  |
| 1341 | issues-table.md:780 声称"新增"文档无对账record | `done` | issues-table 历史整改已回写证据, 但 review-d 没synchronous复核结果.  |
| 1342 | operations/npm-scripts.md, test_coverage_baseline_gate.md 中文区出现英文 | `done` | 中文ops文档的local化回写滞后.  |
| 1343 | release_rollout_and_rollback_contract.md 仍references superseded 的 ADR-018 | `done` | EN release/rollback contract 仍把 ADR-018 写成executebasis.  |
| 1344 | architecture/00-platform-architecture.md only 21 行 stub 却被声称为权威entry | `done` | 架构entry曾是 stub, 没有作为index页持续maintained.  |
| 1345 | 03-module-diagrams.md 含 60+ 处指向不exists章节的内部锚点 | `done` | 旧版modulegraph问题来自历史结构; 现行文档已改成无失效锚点的目录式结构.  |
| 1346 | migration/01-migration-scope.md 写 113 contracts/38 ADR, 实际 151/120 | `done` | EN migration scope 沿用旧数量快照, 未随 contracts 与 ADR 增长synchronous.  |
| 1347 | feature-flags/web onlystatic <h2>, 未消费 vm, 与 admin+ permissions不符 | `done` | feature flags 页面曾停留在staticplaceholder, missing少 VM 接线.  |
| 1348 | feature-flags/hooks 用 {} as never 双重assertion且无消费者 | `done` | hook 曾用双重assertion兜底且未被实际页面消费.  |
| 1349 | 10+ 个 feature hooks/index.ts returnhardcodedstatic items, 但声称 Implemented | `done` | static hooks 与 implemented state曾一起drift; 现已把此类placeholder feature 统一回收到 `Planned`, only保留真实接线module为 implemented.  |
| 1350 | 12+ feature web/index.tsx 的 actions 无 onTrigger, only写假log | `done` | 多个 feature Web entry曾停留在placeholder动作; 现已统一接入 workbench action handler, 不再用假log冒充交互.  |
| 1351 | workflow-builder/web DAG 节点与边为写死的演示graph | `todo` | 待修复 |
| 1352 | task-cockpit/hooks evidenceChain 由前端凭计数虚构生成 | `done` | task cockpit 早期用 evidenceCount 拼伪证据项; 现已改为only展示真实 evidence refs, missingdata时不再虚构链路.  |
| 1353 | workflow-debugger/mobile directly展示 "Awaiting backend debugger seam" | `done` | workflow debugger 移动端曾把后端 seam placeholder文案directly暴露给user; 现已改为中文说明和已接线state文案.  |
| 1354 | UI multiple places用 as never/as unknown as 强转屏蔽typevalidation | `todo` | 待修复 |
| 1355 | UI errorhandleonly console.error, 无遥测/上报 | `done` | Web UI 曾以控制台log兜底error; 现已统一走 `reportUiError()` 与 UI telemetry sink.  |
| 1356 | void registerWebServiceWorker() 等 fire-and-forget 无 .catch | `done` | service worker 注册是 fire-and-forget, missing少failure捕获.  |
| 1357 | FeatureErrorBoundary 未implementation componentDidCatch | `done` | feature error boundary 只有 fallback, 没有error生命周期上报.  |
| 1358 | UI 10+ filehardcoded颜色 (#12201a/#334155 等) , 不references designTokens | `todo` | 待修复 |
| 1359 | tokens.css 264 行 CSS 从未被任何module import | `done` | design token CSS 定义后未被 Web entryexplicitly加载.  |
| 1360 | LazyFeatureDashboard 未做 lazy() 但testingassertion"is Lazy" | `done` | 旧的 LazyFeatureDashboard testing/implementation残影没有随重构cleanup; 现行 Web shell 不再保留该伪 lazy 组件与assertion.  |
| 1361 | 4 个 feature 走相对path而非 @aa/feature-* 别名 | `done` | feature registry 早期exists直连相对path; 现已统一via `@aa/feature-*` 包别名装配.  |
| 1362 | missionControlFeatureContracts 在 shell 内未被uses | `done` | 历史 contract residual导出未跟随 shell 与 registry cleanup.  |
| 1363 | feature module status/kind fielduses风格inconsistent | `done` | feature manifest 曾分别手填 status/kind; 现已由 `createFeatureModule()` 统一从 status 推导 kind 并收口.  |
| 1364 | UI 大量英文文案hardcoded, 未走 translateMessage | `todo` | 待修复 |
| 1365 | task-cockpit/web <input> missing aria-label/<label>/name | `done` | task cockpit 输入控件missing少可访问名称.  |
| 1366 | AccessDenied reason 可为 null, 渲染空 <p> | `done` | AccessDenied allows null 原因directly渲染, missing少default文案.  |
| 1367 | test:ui-p1-features references 5 个testing, 同目录另 4 个未coverage | `done` | UI P1 脚本曾misses新增testingentry; 现已补齐到 9 个现存特性testingfile.  |
| 1368 | cache-metrics-collector.test.ts 0 字节空file | `done` | cache metrics testing曾是空壳; 现已补为 snapshot/reset 行为assertion.  |
| 1369 | domains/onboarding/index.test.ts only re-export 无用例 | `done` | onboarding barrel testing曾只有空转发; 现已补真实导出assertion.  |
| 1370 | 多个testingcall函数无 assert assertion | `todo` | 待修复 |
| 1371 | artifact:integrity referencesfile及目录均不exists | `done` | 历史脚本点名了已迁移的testingpath; 现已改到现存 artifact 相关用例entry.  |
| 1372 | testing中remaining大量 console.log/warn, 含调试residual | `todo` | 待修复 |
| 1373 | multiple placestesting硬等 50–1600ms 时序, exists抖动 | `todo` | 待修复 |
| 1374 | testinghardcoded localhost/端口; 含特权端口 80 与明文密码 DSN | `todo` | 待修复 |
| 1375 | 48+ 用例名duplicate ≥5 次 (17 处同名等) , 疑似重构未删旧目录 | `todo` | 待修复 |
| 1376 | test-pack 下两个testingonly assert.ok(true) placeholder | `done` | test-pack 夹具树曾混入placeholdertesting; 现行 `tests/fixtures/packs/test-pack/tests/` 已删除, 不再保留 no-op 用例.  |
| 1377 | serialTest 自implementation skip 通道, 无 ticket validation且 API 形状不compatibility | `done` | 旧 serialTest compatibility了非 `node:test` 形状; 现已收紧为函数或 `skip: true + fn`.  |
| 1378 | getCompatibilitySkipBudget skip预算无 issue/contract references | `done` | compatibilityskip预算曾作为临时治理residual; 现行仓库已removal该 helper 与对应skip通道.  |
| 1379 | http-api-server.test.ts:1712 预期fixed端口 43123 | `done` | API server testing曾把端口写死; 现已改为dynamic端口path, 不再lock死 43123.  |
| 1380 | test:e2e:stage-exit references unit file, naming/目录contract不符 | `done` | stage-exit 脚本曾点错testing层级; 现已切到 `tests/e2e/checkpoint-artifact-flow.test.ts`.  |
| 1381 | helpers/fs.ts 被 lint 但不被 typecheck | `done` | 仓库根 helper 曾脱离testing辅助链; 现已收口到 `tests/helpers/fs.ts` 并纳入正常typecheckpath.  |
| 1382 | AA_PG_DSN vs AA_STORAGE_POSTGRES_DSN 文档/部署/代码三处inconsistent | `done` | testing, runtime与历史别名三套 DSN naming并存, missing少主次口径.  |
| 1383 | phase1a-data 卷与 phase1a-demo.db 与 0.1.0 去 phase1a 化矛盾 | `done` | phase1a 迁移后, 文档仍residual旧testing名和 SQLite defaultfile名.  |
| 1384 | .env.example missing AA_OPENAI_API_KEY/AA_MINIMAX_API_KEY 等代码实读变量 | `done` | 环境模板没有跟随 provider key 读取面扩充synchronous.  |
| 1385 | k8s manifest 与 Helm chart 的 image owner/repository/name inconsistent | `done` | Kubernetes smoke manifest, Helm chart 与镜像naming曾各写一套; 现已统一到 `ghcr.io/automatic-agent/automatic-agent-platform` 与同名 chart/package.  |
| 1386 | [Unreleased] 累积 12 天 post-0.1.0 改动, 版本未递进 | `done` | 发版后 changelog 与 Helm 版本没有synchronous前推.  |
| 1387 | .audit/(1.4M), .test-db/(2.5M) 已忽略却exists于工作树 | `done` | 忽略的生成产物missing少cleanup动作和防回写规则.  |
| 1388 | .gitignore multiple places冗余/不规范模式 (dist_test 无尾斜杠等)  | `done` | .gitignore 长期叠加, missing少定期整理.  |
| 1389 | .gitignore 主动忽略 5 个 legacy compatibilitysymbols链接, 使其不可审计 | `done` | 早期为compatibility或local目录添加的忽略规则没有持续清账; 现行 .gitignore 已不再保留.  |
| 1390 | translate_docs.py 引入未声明的 translators PyPI dependency | `done` | Python 翻译脚本dependency没有synchronous登记到 requirements.  |
| 1391 | translate_docs.py 代码块解析duplicate追加换行致output膨胀 | `done` | 翻译脚本在重组片段时没有严格保持原始换行边界.  |
| 1392 | translate_docs.py 单processbare调翻译 API, 无重试/限流 | `done` | 翻译脚本missing少节流与explicitly重试strategy.  |
| 1393 | CI AA_TEST_PG_DSN 与生产 AA_PG_DSN/AA_STORAGE_POSTGRES_DSN 三套并存 | `done` | CI 曾同时桥接三套 PG DSN 名称, testing和生产口径未收敛.  |
| 1394 | CI trivy-scan 重新 build, 无法保证与 publish 同一产物 | `done` | Trivy job 先前自建镜像, 和 validate 产物脱节; 现已改为扫描 validate 导出的同一 Docker tar artifact.  |
| 1395 | ci.yml workflow_call + push + pull_request 三重触发 | `done` | CI 触发条件沿用旧 workflow_call 设计, review-d 未回写实际 workflow.  |
| 1396 | ci.yml task链missing build step, 下游dependency dist/ 产物 | `done` | CI validate job 早期missing少 build step.  |
| 1397 | CI upload-artifact 未设 retention-days 与 SHA validation | `done` | artifact 上传missing少 retention 与摘要file.  |
| 1398 | CI aquasecurity/trivy-action@0.32.0 是浮动 tag, 应lock SHA | `done` | Trivy action uses浮动 tag, 供应链不可审计.  |
| 1399 | deploy-environment.yml:191 Helm --set 含 : 被解析为 map | `done` | Helm --set 对冒号值未force字符串语义.  |
| 1400 | Promote stepskip二次健康闸门, 与 contract 双闸inconsistent | `done` | 推广后missing少二次健康闸门.  |
| 1401 | 所有 workflow missing concurrency: 与最小 permissions: | `done` | 多个 workflow 早期没有最小 permissions 与 concurrency.  |
| 1402 | 仓库根missing .github/CODEOWNERS | `done` | 仓库治理 owner 边界未落成file.  |
| 1403 | .claude/scheduled_tasks.json 含 git conflict标记且 .claude/ 已忽略却被提交 | `done` | plantaskfile被忽略但仍被跟踪, 且missing少conflict与审计治理.  |
| 1404 | websocket-bridge.ts:184, task-websocket-status-relay.ts:50, http-api-server.ts:1057 等 10+ 处 setInterval 未 .unref(), blocks事件循环退出 | `done` | 定时后台task最初分散追加, missing少统一的事件循环退出check; 当前涉及的 interval 均已补 `unref()`.  |
| 1405 | redis-lock-adapter.ts:267 redis.scan(cursor,'COUNT',100) missing MATCH lock:*, 扫描全库并误切非lock键 | `done` | lock枚举implementation沿用了bare `SCAN` 样板, 没有按lock前缀收窄键空间; 现已改为 `MATCH lock:*`.  |
| 1406 | redis-lock-adapter.ts:186 释放lock Lua 脚本未用 pcall, cjson.decode failure会中止脚本, lock悬挂 | `done` | 早期 Lua 释放逻辑default Redis 载荷总是合法 JSON, missing少异常branch; 现已用 `pcall` fail-close.  |
| 1407 | redis-lock-adapter.ts:226 lock id lock_${Date.now()}_${fencingToken} only毫秒分辨率, 高concurrentcollision | `done` | lock标识最初只追求can read性, 误把时间戳当唯一源; 现已切到 `randomUUID()` 级别随机性.  |
| 1408 | intake-router.ts:447,457,482,527, llm-eval-service.ts:854 用 Math.random() 做路由/采样, 破坏可复现 evidence | `done` | 路由和评估辅助逻辑把“方便随机”带进了 evidence path; 现已改成based on输入的确定性选择/采样.  |
| 1409 | structure/index.ts:309 new RegExp(...\b${expected}\b...`) 未 escape, expected` 含regex元字符即抛 | `done` | 结构validationdefault导出名是普通标识符, 没有先转义再拼接regex; 现已统一 escape.  |
| 1410 | data-classification-service.ts:781,846 对configureregex只 void new RegExp validation编译, 无duplicate指数limit, ReDoS | `done` | configurevalidation曾只做“能编译”check, 把复杂度risk留给runtime; 现已在编译前增加危险模式拦截.  |
| 1411 | prompt-injection-guard.ts:169,278, embedding-provider.ts:108,233, scoped-external-access-sandbox.ts:303 远程 fetch 无 AbortSignal/timeout, 挂起即blockscall者 | `done` | multiple places远端评估/嵌入call早期directlybare fetch; 现已统一补timeout控制, sandbox path也已具备 AbortController.  |
| 1412 | inter-plane-contract-gateway.ts:417 signature验签failure抛错path被comment掉, failuresilentlyvia | `done` | 该条对应旧快照; 现行 `receiveFromPlane()` 在验签failure时directlyreturn `verified: false`, 不会silently放行.  |
| 1413 | runbook-executor.ts:258-274 simulateStepExecution 对非只读命令directlyreturn success: true, comment承认是placeholder | `done` | 模拟executepath把危险命令default当success回放, missing少 fail-close 设计; 现已要求explicitly模拟结果, 否则reject非只读命令.  |
| 1414 | crypto-shredding-service.ts:355-425 readField/writeField 未reject **proto**/constructor 段, 原型pollute | `done` | fieldpathhandle只关注业务层级, 没有把原型链关键段视作非法输入; 现已explicitly阻断.  |
| 1415 | crypto-shredding-service.ts:392, redis-rate-limiter.ts:87, redis-lock-adapter.ts:268, redis-queue-adapter.ts:599-600, prompt-version-manager.ts:83, hitl-modes.ts:51, channel-gateway-delivery-service.ts:257 multiple places parseInt/parseFloat 无 Number.isFinite validation, NaN pollute | `done` | multiple places数值解析沿用了“解析后directly用”的松散习惯; 现已在仍暴露risk的path补齐有限数validation, 其余点位在现行implementation中已不exists.  |
| 1416 | effect-buffer.ts:333 timer.unref() 在嵌套条件内, setTimeout 与 unref 间抛错即leaks | `done` | 该条based on旧implementation快照; 现行 effect buffer 在 timer 赋值后立即 `unref()`, 中间不exists额外branch逻辑.  |
| 1417 | redis-queue-adapter.ts:255 生产代码内based on process.env.AA_RUNNING_TESTS 走testingbranch | `done` | 队列适配器曾把testing便捷entrydirectly挂到生产环境变量上; 现已改为explicitly `driver: "memory"` configure, 并synchronouscleanup旧testingresidual.  |
| 1418 | storage-backend-factory.ts:30-36 runtimeRequire check globalThis.require.__aaMockOverride, 把testing hack leaks到生产path | `done` | 早期为了测 PostgreSQL pathdirectly把globally require override 带进生产代码; 现已改成受限 specifier 的explicitlymoduleinjection.  |
| 1419 | storage-backend-factory.ts:35 return require(specifier) acceptsarbitrary specifier, configure驱动型arbitrarymodule加载 | `done` | dynamic加载曾没有 allowlist, testing便利性压过了最小加载面; 现已收口到fixed的runtimemodule集合.  |
| 1420 | delegation-audit-service.ts:23 DEFAULT_AUDIT_DIR 在module导入期 resolve 相对path, layered runner 改 cwd 后失效 | `done` | default审计目录在module装载时冻结, 和分层 runner 的工作目录切换脱节; 现已延迟到运行期解析.  |
| 1421 | platform/index.ts:14-22 9 处 wildcard export *, 同名symbols ambiguous 合并 | `todo` | 待修复 |
| 1422 | platform/contracts/index.ts:169 在 contract barrel 内 throw new Error(...), violates自身定义的 AppError 体系 | `done` | contract barrel 里的历史guarddirectly抛原生异常, 没有跟随error体系收口; 现已改为 `ValidationError`.  |
| 1423 | patch-bundle.ts:145 new RegExp(`^${regex}$`) directly拼userregex, injection/ReDoS | `done` | 该条based on旧implementation认知; 现行 patch bundle 先转义 glob 特殊字符, 再编译cached后的安全regex.  |
| 1424 | skill-creator-service.ts:204 regex escape 字符串error (] 在字符类外不需转但模板里漏)  | `done` | 该条对应的 heading 转义问题已不exists; 当前implementationuses完整元字符转义集合construction标题匹配regex.  |
| 1425 | intake-router-model.ts:664 每call即重新编译 RegExp, 无cached, 热path分配压力大 | `done` | 热path规则匹配最初没有cached ASCII 规则regex; 现已按 rule cached编译结果.  |
| 1426 | runbook-automation-service.ts:43,55,64 output字符串含literal ${stepName} 未插值 | `done` | runbook automation 曾把模板字符串写成literal量; 现已改为真实插值outputstep名.  |
| 1427 | runbook-automation-service.ts:36,48 用 Math.random()*150 与 >0.05 模拟execute延迟与failure率, stub 当成生产 | `done` | runbook automation 早期把随机延迟/failure率留在生产path; 现已改为确定性时长与explicitlyfailurenaming约定.  |
| 1428 | workflow-builder-service.ts:259,267 JSON.parse(envelope["builderJson"]) 强转 Record<string, unknown> 后未做 schema validation | `done` | builder persistence JSON 曾把typeassertion当validation; 现已走安全对象解析.  |
| 1429 | goal-decomposer/index.ts:157, llm-plan-generator.ts:141 budget/费用regex在不限长user输入上运行, DoS | `done` | 预算抽取逻辑default把整段user输入directly送入regex, missing少扫描window; 现已limit匹配length.  |
| 1430 | plugin-definition.ts:515 JSON.parse(readFileSync(...SBOM)) 无sizeupper limit, malicious SBOM OOM/DoS | `done` | SBOM 扫描先读全file再解析, missing少filesize闸门; 现已在读取前做尺寸upper limitvalidation.  |
| 1431 | plugin-definition.ts:185-189 嵌套 try/catch silently吞掉signaturedecodeerror, malicioussignature混入 | `done` | 当前signaturedecodefailure不会混入验证流程, 而是explicitlyreturn `invalid_signature_format`; 原问题来自旧审阅快照.  |
| 1432 | cli/login.ts:134 scryptSync 未explicitly {N,r,p,maxmem}, KDF 参数default即弱 | `done` | CLI 登录最初dependency Node default KDF 参数, 没有把口令学参数explicitly固化; 现已explicitly声明.  |
| 1433 | cli/aa.ts:48-49 via extname(import.meta.url)===".ts" 判断是否 --import tsx, 编译产物里residual tsx path | `done` | CLI 启动器曾把源码运行探测绑定到 `import.meta.url` 扩展名; 现已改成按同级实际entryfileexists性判断.  |
| 1434 | runtime-services/durable-event-bus-async.ts:143, execution-dispatch-service-async.ts:113, execution-worker-handshake-service-async.ts, execution-worker-writeback-service-async.ts, human-takeover-service-async.ts 与 platform/... 同名类二份implementation, onlytestingreferences | `todo` | 待修复 |
| 1435 | domains/index.ts barrel only ~24/44 子目录, 垂直域被silently隐藏 | `done` | domains barrel 长期靠手工maintained, 新增垂直域时没有synchronous导出; 现已补齐missing子域出口.  |
| 1436 | domains/{academic-research,advertising,agriculture,finance-accounting,healthcare,legal,manufacturing,live-streaming,...}/index.ts 12 行 preset stub, onlytestingreferences | `done` | 该条判断失准: 这些module虽然薄, 但承载真实 preset 与 `requires*Review()` runtime逻辑, 并已via `domains/index.ts` 对外导出.  |
| 1437 | ops-maturity/index.ts:1-17 barrel missing improvement/, learning/, ops-maturity-score.ts | `done` | ops-maturity 顶层 barrel 更新不完整, 子module扩容后漏掉新entry; 现已补齐.  |
| 1438 | region-router/index.ts:7,10 生产 zod schema default [https://example.invalid; config](https://example.invalid; config) missing即call无效 URL | `done` | 区域路由 schema 曾用placeholder URL 兜default值, 把missingconfiguremasks成可用configure; 现已去掉无效default地址.  |
| 1439 | web/runtime.ts:103 globalThis.fetch.bind(globalThis) 在construction时捕获, subsequent monkeypatch 不生效 | `done` | Web runtime 早期在construction期绑定 fetch; 现已改成runtime fetch wrapper, testing替换和subsequent补丁都能生效.  |
| 1440 | web/runtime.ts:127-130 种子 session expiresAt = Date.now()+3600_000 且 refreshToken 空, 1h 后silentlyexpiry | `done` | static bootstrap token 曾被error当成短时 session; 现已改为非expiry bootstrap session, 并写入explicitlyplaceholder refresh token.  |
| 1441 | web/runtime.ts:163 BrowserWSClient 在 wsUrl missing时仍construction, 向default地址发起 WS | `done` | Web runtime 曾无条件创建浏览器 WS 客户端; 现已在missing少 wsUrl 时 fail-close 到in-memory WS.  |
| 1442 | web/vite.config.ts:14 CSP script-src 'self' missing worker-src, 严格 CSP 下 SW/SharedWorker 启动被阻 | `done` | Web CSP 曾只约束 script-src; 现已补 worker-src, coverage SW/SharedWorker 场景.  |
| 1443 | web/vite.config.ts:17 CSP connect-src 'self' https: ws: wss: 等于放开arbitrary外联 | `done` | connect-src 早期directly放开全部 HTTP(S)/WS(S); 现已改为从explicitlyruntime端点收敛 origin 白名单.  |
| 1444 | web/vite.config.ts:24-28 声明 Report-To csp-endpoint, 但服务端无 /api/csp-report 路由 | `done` | Web CSP 曾声明不exists的 Report-To 端点; 现已removal该伪上报configure.  |
| 1445 | web/vite.config.ts:108 生产 sourcemap:"hidden" 与 SRI injectionconflict, 任何后handle都会 SRI 失配 | `done` | 生产构建曾同时开启 hidden sourcemap 与 SRI injection; 现已关闭生产 sourcemap, 避免摘要drift.  |
| 1446 | web/vite.config.ts:56 SRI regex不感知已exists integrity=, 会双重injection | `done` | SRI injection逻辑曾不识别已有 integrity; 现已在injection前explicitlyskip已带 integrity 的标签.  |
| 1447 | web/build-config.ts:17 manualChunks regex `feature[-/]` 后接单段标识时only取首段, workflow-builder 与 workflow-cockpit 被并入同一 chunk | `done` | chunk naming曾按errorregex截首段; 现已按 feature 目录名完整splitmodule chunk.  |
| 1448 | workflow-builder/web/flow-canvas.tsx:21, web/index.tsx:11-18 每次渲染传新array给 LazyFlowCanvas, 破坏 ReactFlow memo | `done` | workflow builder 曾在父子两层duplicate创建新array; 现已保持稳定 props, 并在画布层按referencescached.  |
| 1449 | workflow-cockpit/web/dag-viewer.tsx:107 position:absolute + zIndex:-1 父容器非 relative, 连接线视觉跑出面板 | `done` | DAG 连接线曾dependency负 z-index 绝对定位; 现已改为正常流式 rail 布局, 不再跑出容器.  |
| 1450 | workflow-cockpit/web/dag-viewer.tsx:38-46 branchGroups 无 useMemo, 大 workflow O(n) 重算 | `done` | DAG branch分组曾在每次渲染重算; 现已对 branch groups 和 stage steps 做 memo 化.  |
| 1451 | workflow-cockpit/web/dag-viewer.tsx:138-147 key={branchId} 但 DTO 不约束唯一性, duplicate key risk | `done` | branch列表曾directly拿 branchId 做 React key; 现已改为稳定复合 key, 避免duplicate branchId conflict.  |
| 1452 | feature-flags/hooks/index.ts:7 queryFn:()=>fetchFeatureFlags({} as never) 抹掉 RESTClient 参数, cast 失效即 NPE | `done` | feature-flags hook 曾via `{}` as never 抹掉 REST client dependency.  |
| 1453 | task-cockpit/hooks/index.ts:71-74 useEffect(...,[taskQuery.data]) 每 5s 轮询都 setOptimisticTasks(null) 清空optimistic UI | `done` | task cockpit 曾在每次轮询后directly清空optimistic态; 现已只在服务端data追平时回收 optimistic state.  |
| 1454 | workflow-builder/web/index.tsx:21 fixed height:280 + overflow:hidden, MiniMap/Controls 在窄屏overlap | `done` | workflow builder 画布容器曾写死 280 高度并裁切溢出; 现已改为response式高度和可见溢出布局.  |
| 1455 | .husky/pre-commit:1-5 only npx lint-staged && npm run typecheck, missing husky v9 compatibility头 | `done` | pre-commit 钩子曾missing少 husky 初始化compatibility头; 现已补标准 husky v9 compatibility引导.  |
| 1456 | .gitignore:43-45 dist/**/*.js 等三行与已忽略 dist/ 父目录冗余 | `done` | 父目录已忽略后仍residual子模式, .gitignore 规则duplicate.  |
| 1457 | truth/storage-quota-service.ts:89,96,103,124 4 处 process.cwd() 在construction时冻结path, cwd changes即失效 | `done` | storage quota default根pathdirectly取 cwd, 未从 sandbox/workspace 真源派生.  |
| 1458 | truth/session-dual-storage.ts:136 JSONL 写入无 Date/Buffer replacer, Buffer 序列化为 {type:"Buffer",data:[...]} 膨胀 | `done` | session JSONL directly吃原始 Buffer toJSON 结果, 未做紧凑化序列化.  |
| 1459 | .gitignore 未 ignore dist-types/.vitest-temp/coverage-report/.dr-reports/coverage-report | `done` | 新生成目录加入后 .gitignore 没持续补齐.  |
| 1460 | .editorconfig 不exists | `done` | 仓库missing少统一编辑器格式约束.  |
| 1461 | .npmrc 不exists, engine-strict=true/fund=false/audit=true 未concentrated声明 | `done` | npm 行为约束散落在人和 CI 约定里, 没有concentrated在 .npmrc.  |
