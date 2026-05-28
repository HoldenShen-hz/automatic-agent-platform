## src/platform/five-plane-interface

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1 | iam/audit-event-integrity.ts:43-44、distributed-rate-limiter.ts:47、request-deduplication.ts:82、http-api-server.ts:119-122、http-server/health-routes.ts:19-21 库内直接读 process.env.NODE_ENV/常量，破坏 DI 与测试 | `done` | 根因是接口层和 IAM 辅助模块把环境探测写进库内部，缺少通过 options/deps 注入运行配置的边界。 |
| 2 | stryker.config.mjs:30-33 mutate: 仅 9 个文件集中在 http-server/，覆盖远窄于策略文档声明 | `done` | 根因是变异测试配置长期采用人工点名清单，随着接口层扩张没有同步扩面。 |
| 3 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:82 用户 cursor JSON.parse 无 try/catch，恶意游标 → 500 | `done` | 根因是分页游标在路由内手写解码，未复用统一错误边界。 |
| 4 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:103-104 模块级 InMemoryHarnessRunStore 单例，跨请求共享、重启丢数据 | `done` | 根因是早期占位实现把 store 放成模块级单例，而不是依赖注入的路由依赖。 |
| 5 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:159-162 /events 接口固定返回空数组，未对接 Truth | `done` | 根因是事件接口只做了路由占位，没有把创建/更新生命周期事件落入可读取存储。 |
| 6 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:209,217-218,228 body.riskLevel/status 直接 as 强转无枚举校验 | `done` | 根因是输入校验缺失，依赖 TypeScript cast 代替运行时约束。 |
| 7 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:273-279 PATCH 把 body.status/terminalReason 直接写存储，无白名单 | `done` | 根因是 PATCH 逻辑直接把请求体映射到模型更新，没有字段白名单和终态约束。 |
| 8 | src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:76-89 list 每请求 Array.from+sort O(n log n) 全量重排 | `done` | 根因是列表接口按“现取现排”的临时实现写成了每请求重排。 |
| 9 | src/platform/five-plane-interface/webhook/index.ts:73-74 acceptedEnvelopes/failureCounts 无界增长 | `done` | 根因是 webhook 入口默认假设进程短生命周期，缺少容量治理与回收策略。 |
| 10 | src/platform/five-plane-interface/webhook/index.ts:72 envelopesByIdempotencyKey 缺 TTL/上限 | `done` | 根因是幂等缓存只实现了去重语义，没有实现 TTL 与容量淘汰。 |
| 11 | src/platform/five-plane-interface/webhook/index.ts:111-120 事件类型/允许列表校验先于签名校验，未签名探测可枚举 allowedEventTypes | `done` | 根因是校验顺序按业务字段优先组织，没有先做认证再做授权过滤。 |
| 12 | src/platform/five-plane-interface/webhook/index.ts:207-209 失败计数硬编码 50，自动 disable 后无再激活路径 | `done` | 根因是失败熔断阈值被硬编码在实现里，且缺少显式恢复操作。 |
| 13 | src/platform/five-plane-interface/webhook/index.ts:200-211 recordDeliveryFailure 直接 mutate 注册对象 enabled，破坏不可变契约 | `done` | 根因是注册对象被当成可变运行态直接回写，没有重新生成并替换记录。 |
| 14 | src/platform/five-plane-interface/webhook/index.ts:182-184 rollbackAcceptedEnvelope findIndex 线性搜索 | `done` | 根因是接受列表只有数组表示，没有反向索引支持回滚删除。 |
| 15 | src/platform/five-plane-interface/webhook/index.ts:296-315 parseWebhookPayload 不限制 body 大小，超大 JSON 阻塞 event loop | `done` | 根因是 payload 解析只关注 JSON 结构，不关注输入体积上限。 |
| 16 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:190,250 先 get 后 set 非原子，并发同 Idempotency-Key 双写入 | `done` | 根因是幂等中间件只有抽象 get/set 存储接口，没有原子保留语义。 |
| 17 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:206-217 in-flight 分支返回 allowed:true 但同时附 409，语义冲突 | `done` | 根因是早期把“重复请求已受理”误建模成 allowed，同时又附冲突错误。 |
| 18 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:201 错误消息回显用户 idempotencyKey/method，响应注入风险 | `done` | 根因是错误文案直接拼接用户输入，没有做回显最小化。 |
| 19 | src/platform/five-plane-interface/api/middleware/idempotency-key.ts:222-234 缓存响应 JSON.parse 无大小限制 | `done` | 根因是幂等重放路径只校验 JSON 可解析，没有限制缓存体大小。 |
| 20 | src/platform/five-plane-interface/api/http-server/approval-routes.ts:73 用户 requestJson JSON.parse 无大小限制 | `done` | 根因是审批 requestJson 被视为可信内部字段，遗漏了大小上限防护。 |
| 21 | src/platform/five-plane-interface/api/http-server/dashboard-routes.ts:344 dashboard requestJson JSON.parse 同上 | `done` | 根因是 dashboard 复用了同类“直接 parse requestJson”的模式，没有体积护栏。 |
| 22 | src/platform/five-plane-interface/api/http-server/utils.ts:339,344 游标 base64url 编解码无 try/catch、无完整性签名，可篡改 | `done` | 根因是通用游标最初只做了可逆编码，没有加签防篡改。 |
| 23 | src/platform/five-plane-interface/api/http-server/gateway-routes.ts:125 body 非字符串时 JSON.stringify 后转发，丢字节序签名失败 | `done` | 根因是 webhook 接收路由把“原始报文”与“已解析对象”混用，默默重序列化了输入。 |
| 24 | src/platform/five-plane-interface/api/http-server/task-routes.ts:340,357 JSON.stringify(payload) 持久化未限定字段顺序 | `done` | 根因是持久化路径沿用普通 JSON.stringify，而不是稳定序列化。 |
| 25 | src/platform/five-plane-interface/webhook/index.ts:255 Buffer.from(normalizedSignature,"hex") 接受非 hex 并截断，长度比对掩盖污染 | `done` | 根因是签名前置校验缺失，默认依赖 Buffer 的宽松 hex 解码行为。 |
| 26 | src/platform/five-plane-interface/webhook/index.ts:60-61 重放缓存 TTL/容量都是 module 常量，不可由租户/endpoint 配置 | `done` | 根因是重放缓存参数最初按模块常量写死，没有暴露到服务/endpoint 配置层。 |
| 27 | tests/integration/platform/interface/api/grpc-adapter-service-integration.test.ts:24,47,145,178,207,337 6 处 host:"0.0.0.0" 监听全网卡 | `done` | 根因是集成测试偷懒复用了通配监听地址，而不是显式环回地址。 |
| 28 | api-server-env.ts 读 AA_API_KEYS_JSON 与文档 AA_API_KEYS 不一致 | `done` | 根因是环境加载器把结构化配置和兼容变量拆成两套名字，文档与实现长期漂移。 |

## src/platform/five-plane-control-plane

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 29 | 控制面深入状态-证据面 SQLite 私有路径（approval/config/incident-control 多处） | `done` | 根因是控制面历史上直接穿透到状态-证据面的私有 SQLite 实现，缺少稳定的 truth 公共出口。 |
| 30 | 执行面约 40 处 import 控制面 IAM/配置实现细节，未通过 contract/policy 端口 | `done` | 根因是执行面长期复用控制面实现细节而非公共 index/contract 端口，导致跨 plane 边界泄漏。 |
| 31 | iam/field-encryption.ts:10,24 PBKDF2 仅 100k 次 + 同步 pbkdf2Sync，低于 OWASP 600k 且阻塞事件循环 | `done` | 根因是字段加密曾把“口令派生”与“运行时加解密”绑在同步路径里，导致强度和事件循环都受限。 |
| 32 | iam/session-management.ts:164-167 hashToken 用裸 sha256(token)，文件注释承认应用 HMAC | `done` | 根因是会话索引最初按普通摘要实现，缺少服务端持有的 keyed secret。 |
| 33 | tests/integration/platform/control-plane/config-center/config-rollout-service-integration.test.ts:317,332,355 Date.now()-90000000 注释"25h"实为 25h00m00s，等于 TTL 即抖动 | `done` | 根因是测试数据长期使用裸毫秒字面量，可读性差，容易被误审为边界抖动。 |
| 34 | tests/integration/platform/control-plane/incident-control/doctor.test.ts:1096 delete process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION 无前置捕获 | `done` | 根因是 review 基于旧版本；当前测试已先捕获并在 finally 中恢复环境变量。 |
| 35 | src/platform/five-plane-control-plane/policy-center/index.ts:282 紧急模式 requiresApproval=subjectType!=="system"，system 主体绕过 break-glass 审批 | `done` | 根因是 break-glass 逻辑错误地把 system principal 当成天然可信，遗漏统一审批门。 |
| 36 | src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:120-132 getFieldValue 沿 . 路径访问，未拒绝 __proto__/constructor/prototype | `done` | 根因是规则引擎只考虑业务字段导航，没有把原型链路径当作不可信输入处理。 |
| 37 | src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:450 JSON.stringify(config, Object.keys(config).sort()) 误用 replacer 当 key 白名单，嵌套字段被裁剪 | `done` | 根因是版本计算偷用了浅层 key 排序技巧，没有实现真正的递归稳定序列化。 |
| 38 | src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:451-457 32-bit 非密码学哈希做配置 checksum，碰撞概率明显 | `done` | 根因是热重载版本号沿用了轻量字符串 hash，而不是面向配置完整性的强校验摘要。 |
| 39 | src/platform/five-plane-control-plane/iam/secret-management-service.ts:765-768 startDailyRotationSchedulers 入口先清空再 add，重入丢正在执行的 sweep | `done` | 根因是轮转调度器把“重复启动”处理成静默重建，破坏了已有调度句柄和运行中的 sweep。 |
| 40 | src/platform/five-plane-control-plane/iam/secret-management-service.ts:770-776 runRotationSweep("initial") 与 setInterval 同步起，可能并发同一 sweep | `done` | 根因是 review 把同步初始 sweep 误判成异步重叠；现实现同时收口为单实例调度器，不再存在并发重启路径。 |
| 41 | src/platform/five-plane-control-plane/iam/aws-kms-http-secret-provider.ts:358-364 双重 base64 解码假设 KMS 永返 base64 | `done` | 根因是实现把 KMS Plaintext 字段强行套入本地密文存储编码假设，混淆了 provider 协议与本地配置格式。 |
| 42 | src/platform/five-plane-control-plane/iam/gcp-secret-manager-http-secret-provider.ts:256 GCP secret 返回值未校验是否 base64 | `done` | 根因是 provider 默认信任云端 payload 编码，没有做严格 base64 校验与失败分支。 |
| 43 | src/platform/five-plane-control-plane/incident-control/runbook-executor/runbook-executor.ts:192-198,258-266 runbook executor 仅 simulate，生产路径未对接 | `done` | 根因是 runbook 执行器最初只做演练占位，没有抽象出受控命令执行边界；现已收口为注入式只读执行器并对非只读命令 fail-closed。 |
| 44 | src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts 配置 hash 仅取 keys 顶层不递归 | `done` | 根因是配置版本函数只围绕顶层对象设计，没有为嵌套结构定义稳定递归遍历。 |
| 45 | src/platform/five-plane-control-plane/iam/field-encryption.ts:46 Buffer.from(value,"base64") 直接解码，未拒绝纯 utf-8 输入 | `done` | 根因是密文 envelope 解析依赖 Node 宽松 base64 解码行为，没有做 round-trip 验证。 |
| 46 | src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:128 任意 string parts 索引到 Function.prototype 等成员，假阳/假阴匹配 | `done` | 根因是字段访问既没阻断危险片段，也没限定 own-property 访问边界。 |
| 47 | src/platform/five-plane-control-plane/iam/secret-management-service.ts:805-815 requireRegistryRecord 错误路径 details 重复 secretRef 未脱敏 | `done` | 根因是存储错误直接复用了原始 secretRef 作为 message/details，未做最小披露。 |
| 48 | tests/unit/platform/control-plane/iam/sandbox-policy-extended.test.ts:66 /tmp/test-file-${Date.now()} 越出 sandbox-root 测试矩阵 | `done` | 根因是测试曾依赖宿主 `/tmp` 语义，绕开了仓库内受控临时工作区。 |
| 49 | startup-env-schema.ts:376 JWT 密钥 undefined 走 default-allow，缺密钥仍可签发 | `done` | 根因是 review 基于旧校验逻辑；当前 schema 已在配置 API key 认证时强制要求 JWT secret。 |
| 50 | api-client.ts Retry-After 直接 parseInt，未识别 HTTP-date | `done` | 根因是旧实现只支持 delta-seconds；当前解析函数已补齐 HTTP-date 分支。 |
| 51 | test:secret-providers 路径错误（少一层 platform/） | `done` | 根因是脚本路径在测试目录迁移后未同步；当前 package.json 已指向现行 integration 路径。 |
| 52 | auto-stop-loss-service.ts:789、config-hot-reload-service.ts:268,506、cache-invalidation-broadcast.ts:68、durable-event-bus.ts:710,916,1007、call-governance.ts:609、external-secret-provider.ts:226 多处 void promise fire-and-forget 无 .catch | `done` | 根因是多个基础设施模块把“后台任务”当成可忽略细节，遗漏 rejection 观测与清理。 |
| 53 | aws-kms-http-secret-provider.ts:211、gcp-secret-manager-http-secret-provider.ts:103、vault-http-secret-provider.ts:132 setTimeout(...controller.abort) 未 .unref() 且部分成功路径漏 clearTimeout | `done` | 根因是 provider timeout 辅助逻辑按最小可用实现编写，忽略了进程退出阻塞和定时器治理。 |
| 54 | secret-management-service.ts:765-768 startDailyRotationSchedulers 静默 clear 已有 schedulers，外部 handle 失效 | `done` | 根因是调度器生命周期没有区分“首次启动”和“重复调用”，导致静默替换已有 handle。 |
| 55 | client-sdk/api-client.ts:188 (result as { totalCount?: number }).totalCount = totalCount 通过 cast 改写 readonly 字段 | `done` | 根因是分页响应为了兼容可选字段，走了类型断言回写而不是重新构造对象。 |
| 56 | client-sdk/api-client.ts:368 connect() 在 SSE bootstrap 处 fire-and-forget，初始 fetch rejection 未处理 | `done` | 根因是 review 基于旧理解；当前 connect 内部已兜住连接异常并走重连分支，启动处仅保留显式 void 调用。 |

## src/platform/five-plane-orchestration

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 57 | src/platform/agent-delegation/index.ts 与 five-plane-orchestration/agent-delegation/* 形成双入口 | `done` | 根因是早期为补目录结构审计而保留了 legacy facade，后续测试与结构断言继续消费它，导致 public surface 没有及时收口到 five-plane-orchestration canonical 入口。 |
| 58 | config/quality/test-exclusion-allowlist.json 列 tests/integration/platform/orchestration/**（已重命名为 five-plane-orchestration），永不命中 | `done` | 根因是目录重命名后 allowlist 只保留了旧路径，没有跟着 canonical 布局更新。 |
| 59 | oapeflir/runtime-execute-bridge.ts:223-235 executor 为 null 时合成假 succeeded + validationPassed:true，stub 静默返回 | `done` | 根因是 bridge 为了便于早期联调默认返回假成功结果，掩盖真实执行器缺失。 |
| 60 | oapeflir/runtime-execute-bridge.ts:182 defaultModelId="MiniMax-M2.7" 把具体厂商模型硬编码到框架代码 | `done` | 根因是框架默认值直接继承了某次联调模型，而不是抽象为 vendor-neutral 默认。 |
| 61 | oapeflir/runtime-execute-bridge.ts:194,264,316 createdAt: Date.now() 数字与 Plan.createdAt: string 类型漂移，仅靠 as Plan cast | `done` | 根因是 review 基于旧 DTO 认知；当前 Plan.createdAt 仍是毫秒时间戳，已改为统一 ISO->ms 归一生成。 |
| 62 | oapeflir/handoff-model.ts:55-57 Math.ceil(JSON.stringify(value).length/4) 估 token 对 CJK/多字节失真 | `done` | 根因是 handoff 压缩只按 ASCII 文本经验估算 token，忽略 UTF-8 多字节差异。 |
| 63 | oapeflir/handoff-model.ts:88-135 压缩静默丢弃 historyRefs/toolCallRecords/planDelta/blockers/artifactRefs，无丢弃台账 | `done` | 根因是 handoff compaction 只关注降体积，没有为被裁剪字段保留审计痕迹。 |
| 64 | oapeflir/oapeflir-loop-core.ts:382、oapeflir-loop-support.ts:324、stage-transition-fsm.ts:189-223 多处 Date.now() 自打时戳，时钟回拨即非单调 | `done` | 根因是 OAPEFLIR 内部事件时间最初直接取 wall clock，没有抽象成单调递增时间源。 |
| 65 | oapeflir/oapeflir-loop-core.ts:299 把 process.{version,platform,cwd()} 写入 environmentContext 留存 evidence，泄漏宿主指纹 | `done` | 根因是 fallback observation 为了调试便利直接采集宿主上下文，缺少证据最小披露约束。 |
| 66 | docs_zh/contracts/oapeflir_loop_contract.md 存在但 README 不列；ADR-016 引用 OAPEFLIR 也未链接 | `done` | 根因是 contract/ADR 文档新增后，README 与关联 ADR 没有同步补全引用链。 |
| 67 | scripts/ci/mutation-critical-tests.sh:13 引 tests/unit/platform/orchestration/oapeflir/... 而权威路径为 five-plane-orchestration，重命名后静默零测 | `done` | 根因是测试目录重命名后，mutation 关键脚本仍引用旧路径。 |
| 68 | src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:275 super("mock://runtime","local-simulated") 默认指向 mock 运行时 | `done` | 根因是 Mock bridge 直接把 mock runtime URI/modelId 烙进默认父类构造，模糊了真实 bridge 与测试替身边界。 |
| 69 | scripts/ci/audit-oapeflir-terminology.mjs 仅扫八字母拼写，遗漏中文术语漂移 | `done` | 根因是术语审计脚本只校验英文阶段词序，没有把中文 canonical 术语纳入检查。 |

## src/platform/five-plane-execution

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 70 | plugin-executor.service.ts:482 显式抛 action_not_implemented，hook 缺失即 500 | `done` | 根因是插件执行器把未实现 hook 当异常路径抛出，而不是回落为结构化 rejected 结果。 |
| 71 | five-plane-execution/state-transition/* 经 core/runtime/index.ts 重新出口越界 | `done` | 根因是 core/runtime 为兼容旧调用方继续转发执行面状态迁移实现，造成跨层公共面继续膨胀。 |
| 72 | tests/unit/runtime/、platform/execution/、platform/five-plane-execution/ 平行重复 | `todo` | 根因是执行面多轮目录重命名后同时保留了 runtime、platform/execution、five-plane-execution 三套测试树，旧目录没有随着 canonical 路径迁移而清退。 |
| 73 | plugin-executor.service.ts:106 enforceSignatures 默认 false，env 未设时不安全 fail-open | `done` | 根因是插件签名校验最初以联调便利为先，默认走 fail-open，安全默认值没有收紧到外部插件场景。 |
| 74 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:55-90 SELECT/DELETE/INSERT 不在事务内，TTL 过期淘汰 TOCTOU；并发夺锁可误删刚获取者 | `done` | 根因是 SQLite 锁适配器早期按逐句脚本拼接实现，没有把过期清理与夺锁收进单事务临界区。 |
| 75 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:34-37 distributed_lock_fencing_tokens 仅 INSERT 自增、永不清理，无界增长 | `done` | 根因是 fencing token 设计成 append-only 计数表，却没有同步规划压缩与有界存储策略。 |
| 76 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:54 ttlMs 缺下界校验，负值/0 直接写入 | `done` | 根因是锁 TTL 只做上限裁剪，没有建立最小有效租期约束。 |
| 77 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:135-148 forceSteal 无前置授权/原因白名单，任意调用即可夺锁 | `done` | 根因是 force-steal 被当成内部运维捷径暴露，实现里缺少显式授权理由边界。 |
| 78 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:140 forceSteal 硬编码 ttlMs=30000 而非沿用原锁配置 | `done` | 根因是强夺锁路径从示例实现演化而来，把 TTL 常量写死在分支里，没有复用锁配置策略。 |
| 79 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:107-112 release owner 不匹配时静默返回 false 无审计事件 | `done` | 根因是释放失败长期只按布尔结果建模，没有把 owner 不匹配视为需要审计的异常争抢事件。 |
| 80 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:549-573 dequeueAsync 多 await 间无原子性，两 worker 可同时取走同 jobId | `done` | 根因是 Redis 队列最初以多条命令串联实现 claim 流程，没有用单脚本保证取号与状态切换原子化。 |
| 81 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:569 状态确认前 hincrby attempts，状态重置导致计数错位 | `done` | 根因是 attempts 预算在 claim 成功前就被前置递增，计数语义与真实生命周期脱节。 |
| 82 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:566-568 状态非 waiting 即 zrem 返回 null 静默丢任务 | `done` | 根因是旧 dequeue 把竞争失败和任务异常状态混成同一路径，缺少显式恢复或重排分支。 |
| 83 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:592-596 仅 ack 路径 expire 任务键，nack/失败任务无 TTL key 累积 | `done` | 根因是任务保留策略只覆盖成功消费路径，没有为 nack、dead-letter 和失败态定义统一 TTL 回收。 |
| 84 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:605-609 nack 重排不带退避，立即被同 worker 再拉 | `done` | 根因是 nack 实现只追求“尽快重试”，没有引入最小退避窗口避免热循环。 |
| 85 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:664-672 retryJobAsync 强置 attempts=0 绕过 maxAttempts 预算 | `done` | 根因是人工重试路径被当成全量重置，破坏了 attempts 预算与死信策略的一致性。 |
| 86 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:600 nack 闭包引用陈旧 jobData.priority | `done` | 根因是 nack 逻辑闭包复用了旧快照，任务重新入队时没有重新读取权威优先级。 |
| 87 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:675-695 purgeAsync 对每条 ID 逐个 hgetall N+1 RTT | `done` | 根因是 purge 流程先按逐条读取实现可读性，没有批处理设计，导致高延迟下出现明显 N+1 往返。 |
| 88 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:308-317 先 arrayBuffer() 全量读再判大小，可被超大响应 OOM | `done` | 根因是外部访问沙箱先追求 fetch API 使用简洁性，未把响应流大小守卫前置到流式读取阶段。 |
| 89 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:323-324 JSON.parse 无 try/catch，恶意 JSON 直接抛 | `done` | 根因是 JSON 响应被假定为可信结构，缺少解析失败隔离和结构化错误转换。 |
| 90 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:296-298 Content-Type 大小写敏感比较，调用方 Content-type 时双写 header | `done` | 根因是 HTTP header 归一化约定没有落实到沙箱适配层，大小写兼容性依赖调用方自觉。 |
| 91 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:672-678 simulateStepExecution 仅 setTimeout 50ms，未真执行任何 action | `done` | 根因是子工作流执行器最初只有占位延时器，没有抽象出可注入的 step execution 边界。 |
| 92 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:729-733 simulateRollback 是 no-op，回滚永远成功 | `done` | 根因是 rollback 被当成演示路径保留成空实现，没有真正的回滚执行器和失败分支。 |
| 93 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:665-669 findStepDefinition 遍历所有 executions O(N·M) | `done` | 根因是 step definition 没有挂在 execution 本地索引上，运行期只能全局反查。 |
| 94 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:642 step.output 写死 "Step X completed successfully" 覆盖真实输出 | `done` | 根因是默认 happy-path 直接回填模板化输出，而不是消费 step executor 的真实结果。 |
| 95 | src/platform/five-plane-execution/compensation-manager.ts:312-319 reverseExternalEffect 直接 return true，外部副作用未反转 | `done` | 根因是补偿管理器只实现了状态机骨架，没有把反向外部副作用抽象成可执行适配器。 |
| 96 | src/platform/five-plane-execution/compensation-manager.ts:326-333 executeCompensateAction stub 永真 | `done` | 根因是 compensate action 一直停留在 stub，缺少基于 step/context 的执行判定。 |
| 97 | src/platform/five-plane-execution/compensation-manager.ts:339-344 sendCompensationNotification 空体，通知从未发出 | `done` | 根因是通知步骤没有独立 adapter，旧实现把 notify 当成永远成功的旁路。 |
| 98 | src/platform/five-plane-execution/compensation-manager.ts:350-358 executeRollback stub，回滚契约不实现 | `done` | 根因是 rollback step 没有消费 rollback plan / targetRef，只保留了示例函数壳。 |
| 99 | src/platform/five-plane-execution/execution-engine/phase1a-happy-path.ts:1-6 仅 re-export，按 AGENTS 应彻底移除 | `done` | 根因是执行引擎重命名后继续保留 phase1a 兼容壳，旧命名未及时从源码面移除。 |
| 100 | src/platform/five-plane-execution/execution-engine/phase1b-orchestration.ts:1-31 兼容文件维持冗余命名 | `done` | 根因是 multi-step 编排收口后仍残留 phase1b 别名文件，公共面没有完全切换到规范命名。 |
| 101 | src/platform/five-plane-execution/execution-engine/phase1b-tool-definitions.ts & phase1b-utils.ts phase1b 兼容残留 | `done` | 根因是 phase1b 配套工具定义与工具函数沿用旧别名继续转发，导致同一能力维持双文件表述。 |
| 102 | src/platform/five-plane-execution/recovery/runtime-recovery-service.ts 与 runtime-recovery-service-root.ts 等四对 *-service/*-service-root 双胞胎 | `done` | 根因是 recovery 模块迁移时为兼容旧入口保留了 root 别名文件，源码层形成事实双实现分支。 |
| 103 | src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts 581 行单文件违反 AGENTS small modules 原则 | `done` | 根因是多步编排最初把计划解析、bootstrap、HarnessRun 持久化和终态收尾都堆在入口文件；现已拆成 `plan/bootstrap/finalize` 支持模块，入口收敛为 202 行协调器。 |
| 104 | src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts 814 行同上 | `done` | 根因是 supervisor 长期把断点处理、失败分支、成功提交和主循环混在一个文件；现已拆成 `breakpoint/failure/success` 三个支持模块，主循环收敛为 358 行。 |
| 105 | src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:47 ESM 内反向用 CJS require | `done` | 根因是异步封装层曾为复用同步服务偷用了 require 加载同胞模块，没有保持 ESM 静态依赖图。 |
| 106 | src/platform/five-plane-execution/distributed-lock/locking-support.ts:12 require("postgres") 同步加载，可选依赖耦合 | `done` | 根因是分布式锁支持层曾把后端依赖伪装成运行时 require 分支，依赖关系既不透明也不利于静态分析。 |
| 107 | src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:67-68 构造期 createRequire+require("ioredis")，缺失依赖即启动崩 | `done` | 根因是 Redis 锁适配器延续了 createRequire 风格的动态装配，依赖加载失败只能在构造期爆炸。 |
| 108 | src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:167,226 lock id 用 Date.now() 拼字符串，毫秒级冲突可复用 | `done` | 根因是锁 ID 早期只拼接时间戳和业务字段，未引入真正的全局唯一熵源。 |
| 109 | src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:25-47 createRequire 后动态 require 同胞 .js，模块图无法静态分析 | `done` | 根因是 async facade 曾试图在运行时回拉同目录实现，导致模块图对工具链不可见。 |
| 110 | src/platform/five-plane-execution/distributed-lock/distributed-lock-manager.ts 9 行 dead shim | `done` | 根因是分布式锁目录重整后保留了 legacy manager 薄壳，调用方迟迟未被收口到单一公共面。 |
| 111 | src/platform/five-plane-execution/distributed-lock/distributed-lock-service.ts 10 行 dead shim | `done` | 根因是 service 文件起初只是转发壳，没有承担真实公共入口职责，导致 manager/service 概念重复。 |
| 112 | src/platform/five-plane-execution/distributed-lock/distributed-lock-factory.ts 21 行轻量包装与 manager/service 重叠 | `done` | 根因是 lock adapter 创建逻辑被拆散到多个轻量包装层，历史兼容文件越积越多。 |
| 113 | src/platform/five-plane-execution/execution-engine/runtime-context.ts 1 行 shim | `done` | 根因是 runtime context 在目录迁移后保留了一层空壳转发，未及时让调用方转向 shared/context canonical 路径。 |
| 114 | src/platform/five-plane-execution/execution-engine/single-task-execution.ts 7 行 re-export shim | `done` | 根因是 single-task happy path 重命名后继续维持旧文件名 re-export，源码面产生冗余入口。 |
| 115 | src/platform/five-plane-execution/distributed-lock/index.ts 1 行 barrel | `done` | 根因是目录级 barrel 在公共面已经收口后仍继续暴露历史路径，放大了导入分叉。 |
| 116 | src/platform/five-plane-execution/queue/redis-queue-adapter.ts:560-562 取最高 score（最新）违反 FIFO 直觉文档未说明 | `done` | 根因是 waiting 队列的 claim 路径把 Redis `ZRANGE` 结果反向遍历，实际消费顺序悄悄退化成了“最新优先”。 |
| 117 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:686-693 checkpoint state 直接引用原 entries 数组，后续 mutate 污染历史 checkpoint | `done` | 根因是 checkpoint 记录直接复用内存态对象引用，没有做快照级深拷贝。 |
| 118 | src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:706-713 performRollback 在 rollbackHistory 为空时全标 rolled_back，不区分未执行步骤 | `done` | 根因是空 rollback history 被误当成“所有步骤都可回滚”，状态机没有区分未执行与已回滚。 |
| 119 | src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:286-288 AbortController.unref 后 timeout 不阻塞退出，但 abort 后未 await 清理与 ESM top-level race | `done` | 根因是旧 review 停留在超时清理前的实现；当前请求路径已经把 timeout 放进 `finally` 清理，问题本质是 timeout 生命周期治理曾未被显式建模。 |
| 120 | src/platform/five-plane-execution/recovery/runtime-recovery-service-root.ts 与 runtime-recovery-service.ts 仅 import 路径与少量变量名不同，构成事实分支 | `done` | 根因是 recovery 服务迁移过程中保留了 root 版本别名源码，最终形成只差路径与变量名的事实分支。 |
| 121 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:60,87,119-121 Math.min(ttlMs,MAX_LOCK_TTL_MS) 三处重复，常量 600_000ms 硬编码 | `done` | 根因是 TTL 裁剪规则分散复制在多个分支里，没有抽成统一的租期归一化函数。 |
| 122 | src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:115-127 extend 用 MIN(ttl_ms+?, MAX) 累加而非自现在重置，TTL 永远滑向上限 | `done` | 根因是 extend 语义最初按“累加剩余 TTL”实现，而不是按“自当前时刻重新租约”建模。 |
| 123 | pg-advisory-lock-adapter.ts 取锁后无 try/finally，throw 路径锁泄漏 | `done` | 根因是 advisory lock acquire 只考虑 happy-path，把“取锁成功后本地记账失败”的清理路径遗漏在会话锁之外。 |
| 124 | pg-advisory-lock-adapter.ts:34-43 自定义 FNV-1a 截断到 63 位，碰撞被静默接受 | `done` | 根因是 PG advisory key 生成直接沿用了轻量示例哈希，而不是使用更稳定的加密散列映射。 |
| 125 | pg-advisory-lock-adapter.ts:71-83 extend() 仅改内存 map，不刷新 PG 端 advisory lock TTL | `done` | 根因是 review 把 PG advisory lock 套进了租约型 TTL 心智模型；PG 端本身没有服务器 TTL，旧实现缺的是对“仅刷新客户端 lease 元数据”语义的明确约束。 |
| 126 | pg-advisory-lock-adapter.ts:107-115 catch-all 把瞬时 PG 错误伪装成 "lock taken" | `done` | 根因是适配器把所有驱动异常都折叠成 acquire=false，抹平了“锁已被占用”和“后端暂时不可用”的错误边界。 |
| 127 | pg-advisory-lock-adapter.ts:101 Number(result.fencing_token) 超 2^53 精度丢失 | `done` | 根因是 fencing token 从数据库 bigint 回读后直接强转成 JS number，没有先做安全范围校验。 |

## src/platform/five-plane-state-evidence

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 128 | CLAUDE.md:50 引用不存在的 state-evidence/artifacts/ 目录 | `done` | 根因是 review 基于旧目录快照；当前 artifacts 模块已恢复为真实目录，原问题过期。 |
| 129 | 多个 contract/review 指向不存在的 state-evidence/artifacts/ 目录 | `done` | 根因是若干 review/contract 结论停留在 artifacts 缺失时期，没有跟随后续模块恢复而回写。 |
| 130 | runtime-truth-repository.ts:741、projection-rebuild-service.ts:429、memory-gateway/index.ts:248、plan-builder.ts:193 用非规范化 JSON.stringify 做指纹，键序变化即误判 diff | `done` | 根因是多个平面各自手写指纹逻辑，沿用了普通 JSON.stringify 而没有收口到稳定序列化工具。 |
| 131 | tests/integration/platform/state-evidence/memory/memory-layer-model-integration.test.ts:261 用 Date.now()-90000 做老化断言，时钟漂移即抖动 | `done` | 根因是时间敏感测试长期直接依赖 wall-clock 差值，没有固定基准时间。 |
| 132 | tests/integration/platform/state-evidence/events/durable-event-bus.integration.test.ts 与 durable-event-bus-integration.test.ts 命名不一致疑似双跑 | `done` | 根因是 durable-event-bus 集成测试扩写时沿用了两套文件命名习惯，导致“基础流”和“重放排序流”边界只体现在文件内容，不体现在文件名。 |
| 133 | package.json:223-234 test:receipt-store/tool-gateway/memory-gateway/sandbox-provider 无 aggregator，仅操作员入口 | `done` | 根因是几个底层入口测试被拆成独立脚本后，没有补上面向 CI/批量验证的聚合命令。 |
| 134 | five-plane-state-evidence/index.ts:1 re-export 不存在的 ./artifacts/index.js，import 即抛 | `done` | 根因是 review 基于 artifacts 目录缺失时的旧快照；当前 `artifacts/index.ts` 已存在且对外导出通过。 |
| 135 | truth/sqlite/repositories/operations-repository.ts:898 listRuntimeRecoveryRecords 把 caller whereClause 直拼 SQL，仅过滤 ;\\|--\\|/* 仍允许 OR 1=1/子查询 | `done` | 根因是 runtime recovery 查询为了复用多种筛选场景，暴露了自由 SQL 片段接口，却没有收口到受控谓词白名单。 |
| 136 | truth/sqlite/repositories/event-repository.ts:788-828 insertEvent 与 outbox INSERT 双 prepared 无统一事务，破坏 outbox 原子性 | `done` | 根因是 Tier-1 状态事件路径把 event append 与 outbox append 分成了两个独立语句，缺少同一事务或 savepoint 边界。 |
| 137 | truth/sqlite/repositories/task-repository.ts:96-125 listTasks cursor 仅按 updated_at，无 id tiebreaker，分页可丢行/死循环 | `done` | 根因是任务列表分页游标只保留了时间戳，没有把稳定主键一起编码成复合 cursor。 |
| 138 | truth/sqlite/repositories/tenant-repository.ts:203-204 listAll 用 [...Map.values()].slice 无稳定排序，跨页结果重排 | `done` | 根因是内存租户仓储直接对 `Map.values()` 切片，默认迭代顺序被误当成分页顺序。 |
| 139 | truth/sqlite/repositories/release-repository.ts:611,632,654 listEnterprise* 仅 limit=20，无 cursor/offset/tenant 过滤 | `done` | 根因是企业发布类报表最初只按“最新 N 条”运营视图落地，没有同步抽象出稳定分页和租户维度约束。 |
| 140 | truth/sqlite/repositories/intelligence-repository.ts:350 listIntelBriefs(limit=20) 无 cursor 静默截断 | `done` | 根因是情报简报列表长期只服务最近简报面板，缺少稳定游标分页能力。 |
| 141 | truth/sqlite/repositories/organization-repository.ts:273 listOrganizationRecords(limit=50) 无租户过滤，跨租户泄漏 | `done` | 根因是组织列表默认站在平台运营视角实现，遗漏了租户视角下的组织可见性约束。 |
| 142 | truth/sqlite/repositories/worker-repository.ts:63 与 worker-snapshot-repository.ts:276 listCoordinatorInstanceSnapshots 双实现 schema 漂移 | `done` | 根因是 review 基于旧结构快照；当前 `WorkerRepository` 已完全委托给 `WorkerSnapshotRepository`，真实双实现已收口。 |
| 143 | state-evidence/dlq/index.ts:110-113 enqueue 用线性 listByConsumer 去重，O(n) 每 insert，无索引 | `done` | 根因是基础 DLQ 仓储接口只暴露了按 consumer 扫描，去重键 `sourceEventId+consumerId` 没有单独查询面也没有持久层索引。 |
| 144 | state-evidence/dlq/index.ts:282-284 runDueRetries 空 catch {} 吞错无 logger/telemetry/退避 | `done` | 根因是 DLQ retry worker 只统计 failed 计数，没有把失败上下文发到结构化日志或遥测面。 |
| 145 | state-evidence/dlq/index.ts:99 maxRetries=5 硬编码，与 dlq-service.ts retry policy 冲突 | `done` | 根因是基础 DLQ 与扩展 DLQ 各自维护默认重试常量，没有抽成单一策略源。 |
| 146 | state-evidence/dlq/index.ts:6-23 DeadLetterRecord 与 contracts/types/domain/session-types.ts EventDeadLetterRecord schema 双源 | `done` | 根因是基础 DLQ 记录独立重写了事件死信字段名和字段类型，没有复用领域合同里的事件死信字段定义。 |
| 147 | state-evidence/incident/index.ts:127-161 listIncidents/listIncidentsPaginated 全量 Map.values() + sort + findIndex，并发插入下 cursor 失效 | `done` | 根因是 incident 分页游标最初只传 incidentId，没有把排序基准一起编码到 cursor。 |
| 148 | state-evidence/incident/index.ts:35 linkedEvidenceRefs: input.linkedEvidenceRefs ?? [] 直接存 caller 引用，外部 mutation 污染内部 | `done` | 根因是 incident open 路径直接复用了调用方数组引用，没有做边界拷贝。 |
| 149 | state-evidence/incident/index.ts:117-121 resolve() 接受任意当前状态，绕过 triaged→mitigating→reviewed→resolved FSM | `done` | 根因是 incident FSM 在 resolve 边上缺少状态守卫，只校验了存在性。 |
| 150 | state-evidence/incident/index.ts:22 nextIncidentOrder 单调 ID 公开预测可枚举 | `done` | 根因是排序 tie-breaker 依赖递增序号，导致内部顺序键既可预测又和分页游标强耦合。 |
| 151 | state-evidence/audit/index.ts:21,29 AuditTrailService.records 内存数组无轮换/持久化，长进程必 OOM | `done` | 根因是审计轨迹服务按进程内数组起步，没有任何容量上限或回收策略。 |
| 152 | projections/projection-rebuild-service.ts:265-266,278-294 JSON.stringify 比对非规范化键序；cutover 无乐观并发 token | `done` | 根因是 projection compare/cutover 起初只面向单线程本地重建，没有把稳定序列化和 cutover 版本校验一起建成显式协议。 |
| 153 | checkpoints/checkpoint-envelope.ts:226 Buffer.from(payload,"base64") 不抛错，恶意 payload 静默截断后入 gunzip | `done` | 根因是 envelope 解包默认信任 Node 的宽松 base64 解码行为，没有先校验编码完整性。 |
| 154 | checkpoints/checkpoint-envelope.ts:147-149 JSON.stringify 大对象先全量物化再判 size，OOM 早于守卫 | `done` | 根因是 checkpoint size guard 放在序列化之后，没有预估 JSON 体积的前置护栏。 |
| 155 | checkpoints/checkpoint-gc-service.ts:548-560 acquireRunLock 不记录 PID/host，崩溃残留锁与活锁不可区分 | `done` | 根因是 checkpoint GC 锁文件只记录 acquiredAt，缺少进程/主机身份元数据。 |
| 156 | knowledge/keyword-index.ts:22-30 upsert 不清除前一次 keywords 反向索引，遗留陈旧 posting | `done` | 根因是 keyword index 的 upsert 只有新增路径，没有先撤销旧倒排项。 |
| 157 | knowledge/keyword-index.ts:32-47 query 每次重扫 countOccurrences 无缓存 | `done` | 根因是关键词命中分数完全在 query 时现算，没有把 chunk-keyword 统计缓存起来。 |
| 158 | knowledge/keyword-index.ts:1-53 缺 delete(chunkId) API，chunk 永生 | `done` | 根因是 keyword index 只设计了 upsert/reset 两端，没有单条删除语义。 |
| 159 | memory-gateway/index.ts:248-258 projectionHash 用 JSON.stringify([...input.memoryIds]) 保留 caller 顺序，相同集合不同序 hash 不同 | `done` | 根因是 projection hash 直接序列化调用方数组，没有先做去重排序归一化。 |
| 160 | memory-gateway/index.ts:280-298 内存层映射 L1/L2/L4/L6 round-trip 有损，未断言 | `done` | 根因是 managed layer 到 runtime layer 的压缩映射没有保存 canonical layer 元数据，回读时只能退化恢复。 |
| 161 | memory-gateway/index.ts:328 Number.isFinite(Number(metadata.version)) 接受 1e308，缺整数/范围校验 | `done` | 根因是 memory version 解析只做了“可转 number”判断，没有整数与上界约束。 |
| 162 | state-evidence/memory/trust-level-service.ts:245-248 MAX=500/TTL=24h/EVICT=60s 硬编码无 config | `done` | 根因是 trust-level service 最初按进程内默认值起步，把容量、TTL、驱逐周期都写死在类里。 |
| 163 | state-evidence/memory/trust-level-service.ts:280-289 每次驱逐 [...entries].sort O(n log n)，含非空断言吞 OOB | `done` | 根因是超容量驱逐直接走全量排序，既不必要也把空洞情况交给非空断言兜底。 |
| 164 | state-evidence/memory/trust-level-service.ts:384-385 includes("TODO"/"FIXME") 字面字符串过滤，正常文本误伤 | `done` | 根因是内容质量检查把 TODO/FIXME 当普通子串匹配，没有限定为显式占位标记。 |
| 165 | truth/sqlite/repositories/prompt-bundle-repository.ts:164-332 8 处 JSON.stringify(input.*) 列写入无 zod 校验 | `done` | 根因是 prompt bundle 仓储把 JSON 列当成“存前直接 stringify”的薄包装，没有把 schema 校验放在持久化边界。 |
| 166 | truth/sqlite/repositories/billing-repository.ts:168 Number(result.changes) BigInt > 2^53 静默截断 | `done` | 根因是 SQLite `run().changes` 被当成普通 number 使用，没有统一的 bigint 安全边界转换。 |
| 167 | truth/sqlite/repositories/worker-snapshot-repository.ts:249 同一查询按 filter 切换 ORDER BY，cursor 跨 filter 即失效 | `done` | 根因是 review 停留在旧分页假设；当前仓储没有对该列表暴露 cursor 协议，真实风险是排序语义未明确，而不是“cursor 跨 filter”。 |
| 168 | state-evidence/events/event-ops-service.ts:216-221 setTimeout(...) reject 计时器未 unref；Promise.race 胜者不 clearTimeout | `done` | 根因是 review 停留在旧实现；当前 timeout helper 已同时 `unref()` 并在 `finally` 中 `clearTimeout()`。 |
| 169 | state-evidence/events/durable-event-bus.ts:9 不同实例化点 retentionLimit:500/100 不一致 | `done` | 根因是旧 review 把不同模块 logger 的 retention 配置混写成 durable-event-bus 自身问题；现行 bus logger 已独立收口。 |
| 170 | tests/integration/platform/state-evidence/events/transactional-event-appender 与 event-repository.ts:788-828 outbox 拆分两 prepared 调用，SQLite WAL autocommit 下观察方可见部分状态 | `done` | 根因是 Tier-1 事件特殊路径绕开了统一的 transactional appender，把 event/outbox 原子性要求重新降回了双语句 autocommit。 |
| 171 | tests/integration/platform/state-evidence/checkpoints/checkpoint-envelope.ts:178 createdAt:new Date().toISOString() 用本地时钟，不同 TZ 重放产物元数据非确定 | `done` | 根因是 review 引用的旧测试位置已经过期；当前 checkpoint envelope 测试使用固定时间戳样本，不再依赖本地时钟。 |
| 172 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:138 PRAGMA journal_mode=WAL 不断言返回，NFS 等环境静默回退 delete | `done` | 根因是 SQLite 初始化流程此前只“请求 WAL”不“确认 WAL”，把后端实际 journal mode 是否退化留给运行时偶发故障暴露。 |
| 173 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:134 busy_timeout 允许 0，瞬时 SQLITE_BUSY 与并发冲突 | `done` | 根因是 busy timeout 配置只做了数值截断，没有建立最小正整数约束。 |
| 174 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283 Object.values(row) 依赖 wal_checkpoint 列序，缺键名解构 | `done` | 根因是 WAL checkpoint 结果读取图省事直接拿对象值数组，没有固定绑定 SQLite 返回列名。 |
| 175 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:347-350 close() 不检查 wal_checkpoint busy>0，存帧未刷盘即关 | `done` | 根因是 close 只做 best-effort checkpoint，没有把 busy 或未完全 checkpoint 视为显式关闭失败。 |
| 176 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:442-449 通过正则 database is locked\\|busy 识别 BUSY，本地化/errno 改即失效 | `done` | 根因是 SQLite 写争用识别长期只依赖 message 文本匹配，没有优先消费 sqlite/errno 级别的错误标识。 |
| 177 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-340 healthCheck 标 async 实仅同步事务，误导调用方 | `done` | 根因是 SQLite health probe 复制了异步后端接口签名，但内部实际一直走同步连接与同步事务。 |
| 178 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:455-465 applyCompatibleColumnMigrationIfKnown 命中后跳过 migration.sql，索引/约束变更悄然丢 | `todo` | 根因是 SQLite 迁移兼容分支把“补列”当成“完成整个 migration”，导致列之外的索引、约束和其余 DDL 没有单独补齐策略。 |
| 179 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:108,233 fetch 无 AbortController/超时 | `done` | 根因是 review 基于旧版本；当前 provider 统一经 `fetchWithTimeout()`，已接入 AbortController 与超时清理。 |
| 180 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:121-126,246-251 错误体直接拼到 Error message，潜在日志注入 | `done` | 根因是 provider 错误路径直接拼接上游响应体，没有做换行/长度收敛。 |
| 181 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:137,259+ response.json() 无 try/catch | `done` | 根因是 embedding provider 默认信任上游 JSON 结构，没有隔离解析失败。 |
| 182 | src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:142-144 未校验返回 index 范围/重复，序后映射假定一一对应 | `done` | 根因是排序恢复结果时默认信任 provider index 完整且无重复，没有做边界校验。 |
| 183 | src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts:226 Buffer.from(payload,"base64") 不校验长度/MIME，损坏 payload 解空 buffer 不报错 | `done` | 根因是 checkpoint payload 解码只依赖 Buffer 宽松行为，没有做 base64 长度与字符集约束。 |
| 184 | src/platform/five-plane-state-evidence/memory/trust-level-service.ts:384-385 用 content.includes("TODO/FIXME") 当信任级别下调依据，明显误报 | `done` | 根因是质量检查把 TODO/FIXME 视作任意子串，而不是显式占位标记。 |
| 185 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-330 healthCheck 在事务内 CREATE/DROP TEMP TABLE，rollback 残留 TEMP 句柄 | `done` | 根因是 health probe 早期用临时表写删来证明可写，副作用验证压过了连接探活本身。 |
| 186 | src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283-290 checkpointWal 不区分 busy>0 与 frames=0，运维无法识真实瓶颈 | `done` | 根因是 checkpoint 返回值之前被按位置数组粗读，busy、log frames、checkpointed frames 没被稳定区分为独立信号。 |
| 187 | tests/integration/platform/state-evidence/dlq-persistence.test.ts:464 /tmp/dlq-persistence-test-${Date.now()}.db 不可移植 Windows 且不在 finally 清理 | `done` | 根因是文件型持久化测试最初按本机 `/tmp` 快速起草，没有复用测试层统一的临时工作区与清理约束。 |
| 188 | tests/unit/platform/state-evidence/knowledge/knowledge-store.test.ts:17 /tmp/aa-sandbox/ktest_${suffix}_${Date.now()} 集中污染 | `done` | 根因是知识快照测试把 Unix 临时目录常量写死在 helper 里，缺少基于 `tmpdir()` 的平台无关拼接。 |
| 189 | tests/unit/platform/state-evidence/knowledge/p2-defects-sys-sec-4-2.test.ts:63,113 两处 /tmp/aa-sandbox/... 不清理 | `done` | 根因是安全回归测试只关注路径允许/拒绝语义，没有把产物生命周期纳入测试治理。 |
| 190 | tests/leaks/platform/state-evidence/events/durable-event-bus.leak.test.ts 阈值 10MB 同理且不区 RSS/heapUsed | `done` | 根因是泄漏测试最初只盯 heapUsed，没把 RSS 与无 `--expose-gc` 运行环境分开建模。 |
| 191 | dashboard-projection-service.ts:110 system.health.changed 未注册到 TypedEventType | `done` | 根因是 review 没有吸收 typed-event-bus / event-registry 的后续补齐；当前 `system.health.changed` 已注册。 |
| 192 | migrate-sqlite-to-pg.ts 列名/表名直拼 SQL，无白名单（注入风险） | `done` | 根因是迁移脚本早期默认表名和列名都来自可信模式；当前实现已对表名做 allowlist、对列名做标识符校验后再拼接。 |
| 193 | idempotency-key-storage.ts ${this.tableName} 直拼 SQL，构造期未校验 | `done` | 根因是幂等键存储曾允许不受约束的自定义表名；现已在构造边界强制校验安全 SQL 标识符并用结构化错误 fail-close。 |
| 194 | semantic-vector-store.ts process.env[name] 中 name 来自配置，可读任意 env | `done` | 根因是该条基于旧实现快照；现行 `semantic-vector-store.ts` 只读取固定的 `AA_KNOWLEDGE_VECTOR_BACKEND` / `AA_KNOWLEDGE_SEMANTIC_BACKEND`，不存在配置驱动的任意 env 读取。 |
| 195 | checkpoint-gc-service.ts fs.stat→fs.unlink TOCTOU 窗口 | `done` | 根因是 GC 删除路径先做存在性检查再删除；现已改为直接 `lstat/open(O_NOFOLLOW)/fstat/unlink` 绑定对象身份，并在 `ENOENT` 上幂等返回。 |
| 196 | shadow-snapshot-service.ts lstat→rename 间存在 symlink swap 窗口 | `todo` | 根因是 shadow snapshot 提升路径把 `lstat` 和 `rename` 分开执行，没有把目标身份绑定到单个原子操作。 |
| 197 | sqlite-database-wrapper.ts:94-114 savepoint 名直拼 exec，未来调用方可注入 | `done` | 根因是 PG 兼容 wrapper 之前把 savepoint 名直接插入 SQL；现已把 savepoint 名收口到受约束生成器并按标识符引用。 |
| 198 | sqlite-database.ts:143 PRAGMA busy_timeout = ${this.busyTimeoutMs} 拼 SQL，busyTimeoutMs 未做整数校验 | `done` | 根因是 PRAGMA 值虽来自配置层，但没有在数据库边界再次验证为正整数，留下了拼接型配置注入面。 |
| 199 | pg-advisory-lock-adapter.ts 中 Number(result.fencing_token)、sqlite-lock-adapter.ts:36 Number(result.lastInsertRowid) 超 2^53 精度丢失 | `done` | 根因是该条对应的两个风险点已消失：PG 适配器现已做安全整数范围校验，SQLite 锁适配器也不再依赖 `lastInsertRowid` 生成 fencing token。 |
| 200 | checkpoint-gc-service.ts:171,557、learning-object-model.ts:180,184、risk-register.ts:87,110、invariant-registry.ts:137,165,180、responsibility-boundary.ts:158-308、admin-config-service.ts:66、outbox-repository.ts:117、memory-layer-model.ts:214,549、graphql-adapter-service.ts:294、conversation-template-service.ts:408、approval-policy-engine/version-manager.ts:111、stable-evidence-bundle-support.ts:612,616,732、dlq-service.ts:238、knowledge-snapshot-store.ts:25-48、semantic-vector-validation.ts:276、tool-gateway/index.ts:150,160、idempotency-key-storage.ts:310,338,341、cors.ts:49-68、reliability/timeout.ts:45,54 多处抛裸 Error 而非结构化 AppError/ValidationError | `done` | 根因是平台子模块长期各自直接抛原生 `Error`；本批已把仍命中的现存路径收口到 `ValidationError` / `StorageError` / typed error，失效路径也不再对应现行代码。 |
| 201 | .gitignore 全局 *.db-shm/*.db-wal 不存在，sqlite WAL 残留可被 commit | `done` | 根因是旧 review 基于过期 `.gitignore` 快照；当前仓库已显式忽略 `*.db-shm` 与 `*.db-wal`。 |

## src/platform/shared

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 202 | src/platform/stability/ 与 src/platform/shared/stability/ 平行同名目录实现已分歧 | `done` | 根因是稳定性能力曾同时保留 authoritative 实现和历史复制 facade；现已把 reliability 子能力统一回收为对 top-level stability 的薄重导出。 |
| 203 | src/platform/shared/reliability/、shared/stability/reliability/、stability/reliability/ 三处可靠性实现重复 | `done` | 根因是 reliability 目录重组后旧实现没有彻底下线；现行仓库已只保留单一实现，shared/stability 侧仅作 facade。 |
| 204 | src/platform/shared/observability/structured-logger.ts:484-491 每条 fsync 日志 openSync+appendFileSync+fsyncSync+closeSync 串行同步 IO | `done` | 根因是 durable sink 先前每条日志都重新打开文件；现已复用持久化文件描述符，只在轮转时关闭并重开。 |
| 205 | src/platform/shared/observability/structured-logger.ts:153,180 sinkBaseDir=process.cwd()，运行时 chdir 后语义漂移 | `done` | 根因是 sink 根目录之前直接绑定 `process.cwd()`；现已固定到模块初始化时解析的稳定绝对基目录，并保留显式覆写入口。 |
| 206 | src/platform/shared/observability/structured-logger.ts:194 mkdirSync 无错误处理，权限不足时 configure 直接抛 | `done` | 根因是 logger 目录创建曾把文件系统异常外漏给调用方；现已捕获并降级为结构化内部错误，且禁用该 sink。 |
| 207 | src/platform/shared/observability/structured-logger.ts:262 retentionLimit=0 时 buffer 长度 0，所有 log 静默丢弃 | `done` | 根因是该条基于误判；现实现中 `retentionLimit=0` 只关闭内存保留，不会阻断 file sink 与 transport 输出。 |
| 208 | src/platform/shared/outbox/outbox-poller-service.ts:193-197 retryCount>=maxRetries 仅 failed++;continue，永不投 DLQ | `done` | 根因是 outbox poller 之前没有终态失败语义；现已为超限记录写入显式 dead-letter 标记并从 pending 集合移除。 |
| 209 | src/platform/shared/outbox/outbox-poller-service.ts:188-217 for-await 串行处理，无并发批量发布 | `done` | 根因是 outbox 发布循环最初按顺序实现；现已按可配置 chunk 并发发布，并优先走 batch publish。 |
| 210 | src/platform/shared/observability/otel-tracer.ts & otel-bootstrap.ts 各自 loadOtelApi/loadOtelModules，OTel 加载两条路径 | `done` | 根因是 OTel 模块探测逻辑之前分散在 tracer 与 bootstrap 两处；现已提取到共享 `otel-module-loader.ts` 单一入口。 |
| 211 | src/platform/shared/observability/structured-logger.ts:153 sinkBaseDir=process.cwd() 多 worker fork 后各持自身 cwd，路径不一致 | `done` | 根因是日志 sink 曾从各 worker 自己的 `cwd` 推导路径；现已统一锚定到启动期解析的绝对基目录。 |
| 212 | tests/unit/platform/shared/stability/stable-prompt-injection-red-team-additional.test.ts:82,97,111,129,145 5 处 /tmp/... 不可移植 | `done` | 根因是稳定性附加测试直接手写 Unix 临时目录字符串，没有复用统一测试工作区 helper。 |
| 213 | tests/unit/platform/shared/stability/stable-runtime-validator-additional.test.ts:30 /tmp/${caseId}.backup.db 跨 case 重名互覆盖 | `done` | 根因是 baseline/backup 路径用 caseId 直接拼到共享 `/tmp`，缺少平台无关且具隔离前缀的临时路径生成。 |
| 214 | graceful-shutdown.ts setImmediate(()=>process.exit()) 未 flush stdio | `done` | 根因是旧实现确实只排到下一轮事件循环就退出；当前路径已显式等待 stdout/stderr flush 后再退出。 |
| 215 | slo-alerting-channels.ts 在 queueMicrotask 内做同步阻塞 I/O | `done` | 根因是该 review 结论停留在旧实现快照；当前 `slo-alerting-channels.ts` 已无 `queueMicrotask` 包裹的同步阻塞 I/O 路径。 |
| 216 | graceful-shutdown.ts:122 void this.handleSignal(signal) 无 .catch；shutdown 错误成为 unhandled rejection | `done` | 根因是信号监听器把异步 shutdown 启动成 fire-and-forget，没有在监听器边界消费 rejection。 |

## src/platform/stability

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 217 | src/platform/stability/timeout.ts:82 成功路径未 clearTimeout，setTimeout 句柄泄漏 | `done` | 根因是 timeout wrapper 只把定时器当成 reject 触发器，没有把成功/失败路径上的句柄清理建成显式步骤。 |
| 218 | src/platform/stability/timeout.ts cancel() 仅取消计时器，未通过 AbortSignal 传给被包裹函数 | `done` | 根因是 timeout/cancel 语义最初只修改包装器内部状态，没有把取消信号传播给被执行异步任务。 |
| 219 | src/platform/stability/retry.ts 与 stability/reliability/retry.ts 两份并存且策略分歧 | `done` | 根因是 retry 之前同时在 top-level stability 与 reliability 子目录独立演化；现已把 reliability 版本收口成对 authoritative retry 的重导出。 |

## src/platform/prompt-engine

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 220 | ha-repository-postgres.ts:22、coordinator-load-balancing-service.ts:78、prompt-engine/registry/index.ts:123、tight-loop-detector.ts:82,95、loop-detection.ts:97、semantic-embedding.ts:108、structured-logger.ts:851、prompt-injection-guard.ts:543、profile-home.ts:31 多处 sha256 截断到 32-64 位作为身份/缓存键，碰撞概率高 | `done` | 根因是各模块各自手写 `sha256(...).slice(...)`，把短前缀直接拿去做身份键、缓存键或排序偏置；现已统一改为共享 `sha256` helper，普通标识扩到 32 hex，PG advisory lock 改为基于完整 digest 的 63-bit fold，不再依赖脆弱的前缀截断。 |
| 221 | prompt-engine/registry/index.ts:114 listVersions 用 localeCompare 排序，"10" 字典序排在 "2" 前 | `done` | 根因是模板版本排序先前沿用字符串比较；现已切到数值化版本段比较。 |
| 222 | prompt-engine/registry/index.ts:117-119 listTemplates() 全量 flat-map 无分页 | `done` | 根因是模板枚举接口之前只提供全量拉取；现已支持 `offset/limit` 分页参数并保持稳定排序。 |
| 223 | prompt-engine/registry/index.ts:81-86 version_conflict 检查后两阶段写入无回滚，部分失败遗留映射 | `done` | 根因是注册逻辑之前直接原地复用旧版本映射；现已先克隆再替换，消除了中途写坏共享 map 的窗口。 |
| 224 | prompt-engine/eval/quality-config-loader.ts:24-35 schema 缺 qualityScoreWeights 求和≈1 与 completeMinScore>approvalRequiredScore 的 .refine | `done` | 根因是质量配置 schema 之前只校验单字段范围；现已补 cross-field refine 约束。 |
| 225 | prompt-engine/eval/quality-config-loader.ts:101-105 zod 校验失败被吞为通用 throw，非结构化 AppError | `done` | 根因是质量配置加载器之前直接透传 Zod 异常；现已转换为带 issue 明细的 `ValidationError`。 |
| 226 | prompt-engine/eval/llm-eval-service.ts:633 logger.warn 含 raw suite.cases payload，PII/prompt 内容外泄 | `done` | 根因是该条基于旧实现判断；现行 `parseCases()` 警告日志只记录 `suiteId` 与错误消息，不回写原始 `suite.cases`。 |
| 227 | prompt-engine/eval/prompt-model-policy-governance-service.ts:584 JSON.parse(release.metadata) 无 zod 校验 | `done` | 根因是 release metadata 之前被直接 `JSON.parse` 后使用；现已改成受限字段解析并在格式异常时 fail-close。 |
| 228 | prompt-registry/index.ts:1-30 30 行纯重出口 shim，违反单一来源 | `done` | 根因是 prompt-registry 之前只是薄重导出；现已提升为带 `createPromptRegistryServices()` 的 canonical namespace 入口，不再是纯 shim。 |
| 229 | prompt-engine/conversation-template-config-loader.ts:35 JSON.parse(content) 无大小上限，配置文件 OOM | `done` | 根因是会话模板配置之前读全文件后直接解析；现已在解析前增加尺寸上限并在 schema 失败时返回结构化错误。 |
| 230 | template-registry/index.ts 两处 @ts-expect-error | `done` | 根因是该条对应的文件/语句已不存在于现行仓库；当前搜索结果中没有 `template-registry/index.ts` 的 `@ts-expect-error` 残留。 |

## src/platform/contracts & types

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 231 | client-sdk/api-client.ts:984-992 declare module ".../executable-contracts/index.js" 模块增强会全局污染 ContractEnvelope.principal | `done` | 根因是 client SDK 之前通过模块增强把 `principal` 污染到全局 `ContractEnvelope`；现已改为 SDK 内部局部扩展类型。 |
| 232 | 全仓测试代码中的 `assert.ok(true)` 占位断言已清零；本轮补齐了 SDK 握手、API WebSocket 关闭路径、panic scope、region failover listener、CDC/backpressure、outbox/VCR/sqlite repository、repo map/cache、memory/harness、pg advisory lock 等剩余用例。当前 `rg -n "assert\\.ok\\(true\\)" tests -g '*.test.ts'` 仅会命中一条历史说明注释，不再命中真实占位断言。 | `done` | 根因是早期批量补测试时把“能跑通/不抛异常”直接固化成占位断言，同时缺少禁止空断言的 lint/CI 门禁；本次已把剩余占位全部替换为真实状态断言、参数捕获、缓存/计时器内部状态校验、错误码断言和持久化副作用校验，问题已收口。 |
| 233 | contracts/types/responsibility-boundary.ts:316-326 在"types"文件内放 GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE 单例运行时态 | `done` | 根因是责任边界类型文件历史上混入了运行态单例；现已把全局实例迁到独立 `contracts/responsibility-boundary-service.ts`。 |
| 234 | contracts/types/responsibility-boundary.ts:302,306 热路径每调用 new Set | `done` | 根因是责任边界校验曾在每次调用时临时创建动作集合；现已提升为模块级常量集合复用。 |
| 235 | contracts/types/domain/billing-types.ts:68 summaryJson:string 不透明 blob 无 zod | `done` | 根因是 billing invoice summary 之前只是裸 JSON 字符串；现已补 `BillingInvoiceSummarySchema` 与 parse/stringify helper，把 summary 至少收口到结构化 JSON object。 |
| 236 | contracts/types/domain/billing-types.ts:63,95,177 currency:"USD" 三处字面，类型上禁多币种 | `done` | 根因是 billing 域类型把币种写死成字符串字面量；现已提取为 `BillingCurrencyCode`，不再从类型层阻断多币种扩展。 |
| 237 | contracts/types/domain/billing-types.ts:122-129 executionId/stepId 标 @deprecated 仍 required，无移除计划 | `done` | 根因是 usage event 同时保留 deprecated 字段又仍要求必填；现已降为 optional，让 canonical `harnessRunId/nodeRunId/attemptId` 成为主路径。 |
| 238 | contracts/types/domain/index.ts:1-249 100+ 符号手维护，非 export *，新类型必致漂移 | `done` | 根因是 domain barrel 之前靠手写大清单维护；现已改为按子模块 `export type *` 收口，新增类型不再手工同步。 |
| 239 | contracts/types/index.ts:191 跨入 executable-contracts/index.js re-export，绕过 domain 命名空间 | `done` | 根因是顶层 `types/index.ts` 曾把 executable-contracts 类型直接横向暴露；现已移除该跨层 re-export，避免绕开 domain/contracts 分层。 |
| 240 | contracts/mission/{playbook,index}.ts:373/357 两份 stableStringify 独立实现，可能漂移 | `done` | 根因是 mission 与 playbook 各自维护序列化 helper；现已抽到共享 `contracts/mission/stable-stringify.ts` 单一实现。 |
| 241 | mission/index.ts 1637 行单文件过大 | `done` | 根因是该条基于旧快照；现行 `mission/index.ts` 已降到约 377 行，不再是超大单文件。 |
| 242 | data-classification-service.ts:680、network-egress-audit.ts:335、auto-stop-loss-service.ts:65-71、panic-propagation-service.ts:119-123、war-room-coordinator.ts:93-94、policy-engine.ts:83、takeover-escalation-manager.ts:46,49、approval-flow-engine.ts:571、approval-policy-engine/version-manager.ts:443、mission/index.ts:685、config-audit-service.ts:319,824、provider-health-tracker.ts:55、task-timeline-service.ts:181 多处 push 类内存无界增长 | `done` | 根因是多处控制面服务把审计/生命周期/会话历史长期保存在内存数组或 Map 中，却缺少统一 retention/eviction 策略；现已为 classification audit、egress audit、panic directive、war room、approval/takeover escalation history、policy version history、mission lifecycle、config audit 增加有界保留与自动清理。另有部分引用来自旧快照，`auto-stop-loss`、`policy-engine`、`provider-health-tracker`、`task-timeline` 当前版本已分别具备容量上限、缓存上限或仅为请求级临时聚合，不再构成无界常驻增长。 |

## src/platform/model-gateway

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 243 | model-gateway/provider-registry/base-chat-provider.ts:260-273 POST 无 signal/超时；response.text() 无大小上限 | `done` | 根因是基础 provider 之前把请求控制字段和传输层实现耦在一起，只做裸 `fetch` 且直接 `response.text()` 读全量错误体；现已补运行时超时/abort signal 组合、错误体字节上限与截断标记。 |
| 244 | model-gateway/provider-registry/unified-chat-provider.ts:803-811 setTimeout(controller.abort) 未 unref；addEventListener("abort") 无对称 remove，listener 泄漏 | `done` | 根因是统一 provider 的超时 signal 只负责触发 abort，没有回收 timeout 句柄和上游 listener；现已 `unref()` 定时器并在 abort 后对称移除监听。 |
| 245 | model-gateway/provider-registry/base-chat-provider.ts:189-198 defaultRetryableCodes 硬编码无 config/per-tenant 注入 | `done` | 根因是默认重试码之前散落在基类构造器字面量里；现已收口到 config-center 默认常量，并支持构造配置与请求级 override 注入，不再写死在实现行内。 |
| 246 | provider-defaults.ts 顶层 const 硬编码 7+ 第三方 API URL | `done` | 根因是 provider URL 之前以离散常量直接硬编码，缺少统一目录和环境覆盖入口；现已改为受校验的默认目录 `PROVIDER_DEFAULT_URLS` 与 `resolveProviderDefaultUrl()`，默认 manual billing 地址也移出被策略拦截的 `.local` 内网域。 |

## src/platform/cost-management

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 247 | cost-management/index.ts:31-37 同名 CostEstimate 既是类型别名又是 Symbol，import 歧义 | `done` | 根因是 cost-management barrel 之前把 contract type 和运行时 token 复用同一导出名；现已把运行时符号改为 `*Token` 命名，消除了 TS/JS 导入歧义。 |
| 248 | cost-management/index.ts:26 平台模块跨入 scale-ecosystem/billing/cost-estimation-service.js | `done` | 根因是平台层 cost-management 之前直接重导出 scale-ecosystem 实现，破坏平台命名空间分层；现已引入本地 `platform/cost-management/cost-estimation-service.ts`，仅依赖平台 contract 与 state-evidence 数据库端口。 |

## src/platform/compliance

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 249 | compliance/encryption/index.ts:91-93 deriveEncryptionKey 仅 sha256(keyRef)，无 KDF/salt/per-record key | `done` | 根因是字段加密此前把 `keyRef` 的 sha256 直接当 AES key 用；现已切换到 `scryptSync` + 16-byte per-record salt 派生 32-byte key。 |
| 250 | compliance/encryption/index.ts:113-172 writeField/tokenizeFieldPath 不黑名单 **proto**/constructor，原型污染 | `done` | 根因是字段路径 tokenizer 之前接受任意属性 token；现已显式拒绝 `__proto__`、`prototype`、`constructor` 并对空路径 fail-close。 |
| 251 | compliance/encryption/index.ts:84 密文用 enc:fingerprint:iv:authTag:ciphertext 冒号分隔，未来 keyRef 含冒号即解析失败 | `done` | 根因是密文 envelope 之前依赖脆弱的冒号分段协议；现已升级为 `encv1.<base64url-json>` 版本化结构化 envelope，消除了分隔符冲突。 |
| 252 | compliance/encryption/index.ts:65 Buffer.from(ivHex!,"hex") 非空断言；非 hex 输入 Buffer 静默截断不抛 | `done` | 根因是 reveal 路径之前靠非空断言和宽松 `Buffer.from(..., "hex")` 解码；现已改为 envelope 结构校验 + strict base64url 解码，不再接受损坏字段静默下沉。 |
| 253 | compliance/erasure/index.ts:43,32-66 用 Date.parse + slaHours*hour 算 dueAt（本地时钟）；createPlan 不持久化 | `done` | 根因是擦除规划服务之前直接从 `nowIso()` 字符串反解析时间并只返回瞬时 plan；现已支持注入时钟、基于 `Date#getTime()` 计算 SLA 截止时间，并为创建的 plan 提供默认内存 store、`getPlan()` 与 `listPlans()` 持久可见性。 |
| 254 | governance-compliance/web 引用错误 CSS 变量 --color-text | `done` | 根因是该条基于旧 UI 片段；现行 `governance-compliance` Web 视图已使用正确的 `--aa-color-text` 变量，没有残留错误 token。 |
| 255 | governance-compliance/analytics 的 subPages 声明页面未实现 | `done` | 根因是该条对应的 `subPages` 声明已不在现行 feature module 中；当前 `analytics` 与 `governance-compliance` 模块均未声明未实现的 subpage 路由，属于过期 review。 |

## src/platform/integration & connectors

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 256 | integration/connector-framework-service.ts:62-194 5 Map+2 LRU 内存，storageDir 多数 caller 传 null；LRU 部分移除"故意不更新位置"违反语义 | `todo` | 待修复 |
| 257 | integration/connector-framework-service.ts:144-156 驱逐循环含"无进展即 break"占位逻辑掩盖真实 bug | `done` | 根因是 bindings 驱逐逻辑之前依赖“无进展就 break”的占位防死循环分支；现已改为 `evictLRUBindings()` 返回实际删除数，若删除为 0 直接抛显式 invariant 错误，不再静默吞掉驱逐异常。 |
| 258 | integration/connector-framework-service.ts:289-332 failed 状态短路在 circuit breaker 之前，breaker 不递增；success===false 被转 throw，导致 breaker 双计 | `done` | 根因是执行路径之前把 health-failed 直接短路到 breaker 之外，同时把 `success=false` 结果伪装成异常抛回 breaker；现已让 failed health 经过 breaker 记一次失败，而逻辑性失败结果不再人为二次抛错。 |
| 259 | integration/connector-framework-service.ts:392-414 provider 名规范化 servicenow/service-now/service_now 与 github 大小写不一致 | `done` | 根因是内建 connector 装配逻辑之前在 `switch` 里散落 provider 字符串变体；现已收口到 `normalizeConnectorProvider()`，统一 canonicalize 大小写、空白、下划线和 `service-now` 变体。 |
| 260 | integration/connector-framework-service.ts:494-509 每次 register/bind/recordHealth 全量序列化 3 个 Map 写盘，无 batching/debounce | `done` | 根因是 connector framework 之前任何一次 manifest/binding/health 变更都会把三个集合全部重写落盘；现已按变更域分别持久化 manifest、binding、health，消除了每次写三份全量 JSON 的放大开销。 |
| 261 | integration/connector-framework-service.ts:115-121 重复 register 相同 connectorId 静默覆盖无事件 | `done` | 根因是注册逻辑此前对重复 `connectorId` 直接 `Map#set` 覆盖；现已改为显式抛出 `connector_framework.duplicate_connector_id`。 |
| 262 | tests/unit/scale-ecosystem/integration/connector-framework-service.test.ts:513 /tmp/connector-framework-test-${Date.now()} 不清理 | `done` | 根因是该单测之前手写 `/tmp` 路径并自己做目录清理；现已切换到统一 `createTempWorkspace()/cleanupPath()` helper。 |
| 263 | test:pg-integration glob 永远匹配空目录 | `done` | 根因是该条基于旧脚本；当前 `package.json` 的 `test:pg-integration` 已直接指向 `tests/integration/platform/state-evidence/truth/postgres-fencing-token-service.test.ts`，不存在空 glob。 |
| 264 | unit 目录下大量 spawn 子进程的测试，应在 integration | `done` | 根因是该条混入了误报：当前命中的大量 `fork()` 是 SDK/PluginContext 的对象方法，不是 `node:child_process` 子进程；少量 `execSync` 也只是仓库环境探测辅助，不属于跨进程集成测试主体。 |
| 265 | connector-runtime/index.ts:47 对 caller-supplied callback URL 仅 AbortSignal.timeout(10_000)，无 SSRF 白名单 | `done` | 根因是 callback 解析之前只校验协议、loopback 与无凭据 URL，没有显式 allowlist；现已要求非 loopback 的 `https` callback 主机必须命中 `AA_CONNECTOR_CALLBACK_ALLOWED_HOSTS` 白名单。 |

## src/platform/agent-delegation & harness

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 266 | agent-delegation/delegation-manager.service.ts:847、delegation-manager-support.ts:104、hitl-operator-console-service.ts:63 Promise.all(...) 单点失败导致整体 abort，无 per-item fallback | `todo` | 待修复 |
| 267 | harness/loop/index.ts:91、harness/recovery-controller.ts:39 退避 jitter 用 Math.random()，破坏可复现 | `todo` | 待修复 |
| 268 | harness/hitl-runtime.ts:71,465 30 天 TTL 双字面量，无单一来源 | `todo` | 待修复 |
| 269 | harness/memory-manager.ts:34,168 shared:1000 与 30*60*1000 LRU 窗口硬编码，无 config | `todo` | 待修复 |
| 270 | harness-decision-manager.ts:186 用注释代替接口约束 | `todo` | 待修复 |
| 271 | contracts/execution-receipt/index.ts:64-67、harness-decision-manager.ts:185、quorum-calculator.ts:249、sub-workflow-executor.ts:731、assessment-service.ts:141、pack-routes.ts:107,121,143,182、incident-routes.ts:150、risk-evaluation-port.ts:26、inter-plane-contract-gateway.ts:332 多处 void param; 丢弃声明依赖的参数，租户/principal 鉴权事实上被绕过 | `todo` | 待修复 |

## src/platform/improve-rollout & learn

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 272 | learn/llm-improvement-generation-service.ts:162 createdAt: String(Date.now()) 用十进制 ms 字符串，与 sibling ISO 不一致 | `todo` | 待修复 |
| 273 | learn/learning-artifact-model.ts:70-78 动态 await import("node:crypto") 双载，且 fallback 仅哈希 objectId 不哈希内容 | `todo` | 待修复 |
| 274 | improve-rollout/improvement-candidate-registry.ts:93,140,147 用 Date.now() 跟踪 candidate TTL，跨副本驱逐时钟漂移 | `todo` | 待修复 |
| 275 | improve-rollout/rollout/rollout-state-machine.ts:71 transitionedAt: Date.now() 数字 vs types/rollout-record.ts:143 字符串混用 | `todo` | 待修复 |

## src/platform/intelligence & PMF

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 276 | intelligence/perception-service.ts:250-257 parseJsonArray 静默 JSON parse 失败返回 []，掩盖损坏数据 | `todo` | 待修复 |
| 277 | intelligence/perception-service.ts:310-312 :memory: 路径下产物落 dirname(":memory:")/artifacts，污染工作目录 | `todo` | 待修复 |
| 278 | intelligence/perception-service.ts:262-292 buildBriefMarkdown 不 escape \|/</反引号，feed 数据可注入 markdown/exfil 图片 | `todo` | 待修复 |
| 279 | intelligence/perception-service.ts:646-666、pmf-validation-service.ts:500-518 divisionId:"system_admin"/"system" 魔术 division，与 division-catalog.json 无校验 | `todo` | 待修复 |
| 280 | intelligence/pmf-validation-service.ts:496-518,594-614 检查后插入存在并发竞态；selectRow 把未知列加进 T 结果 | `todo` | 待修复 |
| 281 | intelligence/pmf-validation-service.ts:155-162 listHistory(limit=20) 上限不限可 OOM | `todo` | 待修复 |
| 282 | intelligence/perception-service-async.ts:1-83 双方法并存且全用 Parameters<...>[0] 内联类型，sync 签名变更静默破坏 async | `todo` | 待修复 |

## src/platform/resource-manager

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 283 | resource-manager/resource-pool-service.ts:13-50 failureRateThreshold:0.3/minSampleSize:20 用 .default() 内联，无 config 覆写；池/分配 in-memory 无持久化 | `todo` | 待修复 |
| 284 | resource-manager/resource-pool-service.ts:74-150 分配无 CAS（worker_threads/cluster 不安全）；隔离无去抖；恢复无 cooldown/审计；错误信息误导 | `todo` | 待修复 |
| 285 | resource-manager/fair-scheduling-service.ts:70 饥饿截止 15*60_000 硬编码 | `todo` | 待修复 |
| 286 | resource-manager/fair-scheduling-service.ts:114-145 配额超限但 quorum 降级时返回 passed:true；budget tenant 不匹配返回 remaining=Infinity 静默放过 | `todo` | 待修复 |
| 287 | tests/unit/scale-ecosystem/resource-manager/quota-enforcer-stateful-r13.test.ts:13 写死 /private/tmp/... 仅 macOS 路径 | `todo` | 待修复 |

## src/platform/architecture & risk

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 288 | architecture/risk-register.ts:20-77,30-72 仅 4 风险项且 reviewAfter:"2026-07-01" 全部相同硬编码 | `todo` | 待修复 |

## src/platform/remote-coordination

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 289 | src/platform/remote-coordination/index.ts:1-2 同时 export * as session 与 export * 自同模块，命名空间双导出歧义 | `todo` | 待修复 |

## src/platform/structure

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 290 | src/platform/structure/index.ts 静默吞错 + 不合理的 Deno 探测 | `todo` | 待修复 |
| 291 | src/platform/structure/index.ts:249 require("node:fs") 与 ESM Deno.readDirSync 双路径混用 | `todo` | 待修复 |

## src/platform other

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 292 | src/platform/contracts/*/index.ts 5 个合同文件硬编码 docs.example.com/api.example.com 占位 URL，被打入运行时错误信息 | `todo` | 待修复 |
| 293 | src/platform/ops-maturity/index.ts 与顶层 src/ops-maturity/ 同名共存 | `todo` | 待修复 |
| 294 | src/platform/ 目录越权：存在 10 个 AGENTS.md 未授权的子目录 | `todo` | 待修复 |
| 295 | release-pipeline.ts 与 deployment-execution.ts 硬编码 GitHub Actions URL，且字面量重复 | `todo` | 待修复 |
| 296 | deployment-execution-service.ts:178-179、channel-gateway-service.ts:158-161 子进程/请求 buffer 累积无字节上限，OOM 风险 | `todo` | 待修复 |

## ui/apps/web (shell, vite, sw)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 297 | ui/apps/web/src/main.tsx:11 if(rootElement!=null) 缺失 #root 时静默 no-op，应抛/告警 | `todo` | 待修复 |
| 298 | ui/apps/web/src/main.tsx:8-9 createWebRuntimeClients 在 <GlobalErrorBoundary> 挂载前执行，初始化错绕过 fallback UI | `todo` | 待修复 |
| 299 | ui/apps/web/src/main.tsx:8 VITE_AUTH_TOKEN 经 import.meta.env 读，被 Vite 烘焙进公共 bundle 泄漏 | `todo` | 待修复 |
| 300 | ui/apps/web/src/runtime.ts:84 constructOrCall 用 "mock" in factory 启发式判定，含静态 mock 字段的真 class 误路由 | `todo` | 待修复 |
| 301 | ui/apps/web/src/runtime.ts:122-130 seedTokenManager 硬编码 expiresAt=Date.now()+3600_000 忽略真实 JWT TTL | `todo` | 待修复 |
| 302 | ui/apps/web/src/runtime.ts:163 模块顶层引用全局 WebSocket，Node/SSR/无 stub jsdom 即崩 | `todo` | 待修复 |
| 303 | ui/apps/web/src/runtime.ts:181-206 registerWebServiceWorker 无 try/catch，拒绝时变 unhandled rejection | `todo` | 待修复 |
| 304 | ui/apps/web/src/runtime.ts:148 与其他 transport fallbackToMock 默认 true 不一致，生产 transport 错误时悄然返回 mock 数据 | `todo` | 待修复 |
| 305 | ui/apps/web/src/feature-registry.ts:30-33 深路径 ../../../packages/features/*/src/index 绕过 workspace alias，包结构变即坏 | `todo` | 待修复 |
| 306 | ui/apps/web/src/app-shell.tsx:~356 effectiveAuthContext 每次渲染新对象 identity，memo 消费方多余重渲 | `todo` | 待修复 |
| 307 | ui/apps/web/src/global-error-boundary.tsx:14-19 componentDidCatch 仅 console.error，无 telemetry，stack 丢弃 | `todo` | 待修复 |
| 308 | ui/apps/web/src/global-error-boundary.tsx fallback 无 retry 按钮，单错锁全 app | `todo` | 待修复 |
| 309 | ui/apps/web/src/app-shell.tsx:222-230 useMemo 出现在 L219 早期 return 之后，违反 React hooks 必须无条件调用规则 | `todo` | 待修复 |
| 310 | ui/apps/web/src/app-shell.tsx:356-366 effectiveAuthContext 默认 permissions:["authenticated"]，未提供 authContext 时全 feature 放行 — 鉴权后门 | `todo` | 待修复 |
| 311 | ui/apps/web/src/app-shell.tsx:330 通配 path="*" 无 404 页面，未知 URL 静默渲染 features[0] 跑其守卫 | `todo` | 待修复 |
| 312 | ui/apps/web/src/app-shell.tsx:368-372 useEffect setPhase("idle") 仅切换两态，render 分支立即被覆盖，phase 状态死代码 | `todo` | 待修复 |
| 313 | ui/apps/web/src/app-shell.tsx:316-338 phase==="render"\|\|phase==="idle" 判断恒真，else 永不执行 | `todo` | 待修复 |
| 314 | ui/apps/web/src/app-shell.tsx:308 startupBanner 背景硬编码 #12201a 不随主题切换 | `todo` | 待修复 |
| 315 | ui/apps/web/src/app-shell.tsx:99-105 navigate(-1) 用 window.history.length>1，length 含跨域条目，可能后退到外站 | `todo` | 待修复 |
| 316 | ui/apps/web/src/app-shell.tsx:148 错误边界 "Report Issue" 仅 console.error，按钮无副作用 placebo UI | `todo` | 待修复 |
| 317 | ui/apps/web/src/app-shell.tsx:133 错误 fallback 直接渲染 error.message，可能含敏感栈/PII | `todo` | 待修复 |
| 318 | ui/apps/web/src/app-shell.tsx:184-206 FeatureContent 同时渲染 feature.Component 与 activeSubPage.Component，无 <Routes> 仅按 location 字符串匹配，父+子页双渲染 | `todo` | 待修复 |
| 319 | ui/apps/web/src/app-shell.tsx:159 重试用 Fragment key=retryKey 强制重挂，含模块级 singleton 子树不会真重置 | `todo` | 待修复 |
| 320 | ui/apps/web/src/app-shell.tsx:268 顶级 grid gridTemplateColumns:"280px 1fr" 硬编码，无响应式断点 | `todo` | 待修复 |
| 321 | ui/apps/web/src/app-shell.tsx:274,187 多 nav 嵌套但仅最外层 nav 有 aria-label，重复 nav landmark 干扰屏阅读 | `todo` | 待修复 |
| 322 | ui/apps/web/src/app-shell.tsx:62 normalizePath 仅去尾斜杠，不处理多重斜杠/.//../，恶意 URL 绕过匹配 | `todo` | 待修复 |
| 323 | ui/apps/web/src/feature-registry.ts:30-33 4 处 ../../../packages/features/*/src/index 深路径绕过 alias（feature-flags/memory-review/release-console/trace-explorer 仍硬编码） | `todo` | 待修复 |
| 324 | ui/apps/web/src/feature-registry.ts:36-39 missionControlFeatureContracts 导出但 featureRegistry 未消费，死合约 | `todo` | 待修复 |
| 325 | ui/apps/web/src/feature-registry.ts:77 LazyFeatureDashboard=dashboard 命名 "Lazy" 但同步导入，并非 React.lazy | `todo` | 待修复 |
| 326 | ui/apps/web/src/feature-registry.ts:41-75 32 feature 顶层 import 全 bundle 在主 chunk，违反代码分割 | `todo` | 待修复 |
| 327 | ui/apps/web/vite.config.ts:12-22 CSP 缺 worker-src/child-src/manifest-src/form-action/frame-src，浏览器默认放行 | `todo` | 待修复 |
| 328 | app-shell.tsx 把 tenant/domain/permissions/roles 全部硬编码 | `todo` | 待修复 |
| 329 | app-shell.tsx useMemo 写在条件 return 之后违反 Hooks 规则 | `todo` | 待修复 |
| 330 | app-shell.tsx WebFeatureModule 强行覆盖 @aa/ui-core 类型 | `todo` | 待修复 |
| 331 | web/main.tsx:5-8 createWebRuntimeConfig 输出未被消费，startWebRuntimeTelemetry 从不调用，OTLP/web-vitals 死代码 | `todo` | 待修复 |
| 332 | web/main.tsx:11 rootElement==null 静默 no-op 无任何告警 | `todo` | 待修复 |
| 333 | aa-sw.js:4 预缓存 /offline 但应用无该路由，install 必失败 | `todo` | 待修复 |
| 334 | aa-sw.js:10 install 内 self.skipWaiting() 绕过 runtime 的 notifyUpdateAvailable 用户提示 | `todo` | 待修复 |
| 335 | aa-sw.js:27-37 所有 GET（含 HTML）cache-first 无 TTL，部署无法失效返回用户的 index.html | `todo` | 待修复 |
| 336 | aa-sw.js:97-103 replayOfflineMutations 不带 idempotency-key/CSRF/auth，与 runtime 拦截链矛盾 | `todo` | 待修复 |
| 337 | aa-sw.js:96-107 重放循环无限速/退避；非 2xx（含 401/403/422）每次 sync 永久重试 | `todo` | 待修复 |
| 338 | aa-sw.js:44 裸 catch {} 吞 fetch 错误无 telemetry | `todo` | 待修复 |
| 339 | app-shell.tsx:330 通配路由 features[0]! 非空断言；features 中途为空即崩 | `todo` | 待修复 |
| 340 | app-shell.tsx:163-176 FeatureContent 每次渲染重算 subPages/activeSubPage 无 memo | `todo` | 待修复 |
| 341 | app-shell.tsx:124,137-140 getDerivedStateFromError 总把 retryKey 重置为 0，连续错误丢失计数 | `todo` | 待修复 |
| 342 | app-shell.tsx:65-77 withAlpha 无 memo；每次渲染对每个 NavLink 解析十六进制 | `todo` | 待修复 |
| 343 | ui/tests/unit/.../approval/web.test.tsx、hitl/web.test.tsx 缺 afterEach(cleanup)，jsdom 多 root 累积 | `todo` | 待修复 |
| 344 | ui/apps/web/public/aa-sw.js:97 replayOfflineMutations 重发不重附 Authorization/X-CSRF-Token/Idempotency-Key | `todo` | 待修复 |
| 345 | ui/apps/web/public/aa-sw.js /api/v1/* 无声明缓存策略，replay 与新 fetch 竞态返陈旧数据 | `todo` | 待修复 |
| 346 | ui/apps/web/vite.config.ts:18 CSP connect-src 含 wildcard https:/wss:，policy 形同虚设 | `todo` | 待修复 |
| 347 | ui/apps/web/vite.config.ts:~57 SRI 注入正则仅匹配单行 script 多行被静默跳过 | `todo` | 待修复 |
| 348 | ui/tests/apps/web.test.tsx:9 断言硬编码中文 "总览驾驶舱"，绑定默认 zh-CN locale，切语言即破 | `todo` | 待修复 |
| 349 | ui/tests/unit/ui/apps/web/runtime.test.tsx:534 点击 retry 按钮但对结果状态不断言任何东西，零保护 | `todo` | 待修复 |
| 350 | ui/tests/unit/ui/apps/web/runtime.test.tsx 用 mockReturnValueOnce 链，前 expect 失败后排队 mock 渗到下个测试 | `todo` | 待修复 |
| 351 | ui/tests/unit/ui/packages/features/approval/web.test.tsx:43 用真 Date.now() 而非 vi.useFakeTimers，snapshot 跨次不稳 | `todo` | 待修复 |
| 352 | ui/tests/unit/ui/packages/features/approval/web.test.tsx:72-74 用 fireEvent.click 而非 userEvent.click，错过 pointer-down/键盘语义 | `todo` | 待修复 |
| 353 | ui/apps/web/vite.config.ts:14 CSP script-src 'self' 无 nonce/'strict-dynamic'，与 SRI 注入并存但 inline script全被阻断 | `todo` | 待修复 |
| 354 | ui/apps/web/vite.config.ts:71-95 configurePreviewServer 设 CSP，configureServer(dev) 未设，dev 与生产 CSP 不一致 | `todo` | 待修复 |
| 355 | ui/apps/web/vite.config.ts:101 react-native alias 用 new URL(...).pathname，Windows 下含前导 / + 盘符，alias 失败 | `todo` | 待修复 |
| 356 | ui/apps/web/vite.config.ts:108 sourcemap:"hidden" 生产仍生成 sourcemap 文件，可被反推 | `todo` | 待修复 |
| 357 | ui/apps/web/vite.config.ts 无 define: 排除 process.env，Node 全局可能被烘焙 | `todo` | 待修复 |
| 358 | ui/apps/web/public/aa-sw.js:9 cache.addAll(["/","/offline"])，/offline 资源 404 时整 install 失败 SW 永不激活 | `todo` | 待修复 |
| 359 | ui/apps/web/public/aa-sw.js:41 每个成功 GET 都 cache.put，无 LRU/容量上限 | `todo` | 待修复 |
| 360 | ui/apps/web/public/aa-sw.js:71-76 normalizeCacheRequest 删 search/hash，搜索结果页/不同 query 共用 cache 污染 | `todo` | 待修复 |
| 361 | ui/apps/web/public/aa-sw.js:75 new Request(url,{method:"GET"}) 丢弃原 headers (Accept-Language)，多 locale 共享同 entry | `todo` | 待修复 |
| 362 | ui/apps/web/public/aa-sw.js:96-107 顺序 await replay，单条慢请求阻塞所有；失败响应不 ok 时不删除也不重试上限 | `todo` | 待修复 |
| 363 | ui/apps/web/public/aa-sw.js:18-22 activate 仅删 aa-ui-runtime- 前缀缓存，更名前缀后老缓存遗留 | `todo` | 待修复 |
| 364 | ui/apps/web/public/aa-sw.js:141-145 transaction.oncomplete 检查恒为 undefined，逻辑总走早 resolve 分支，未 await complete 即 resolve 竞态 | `todo` | 待修复 |
| 365 | apps/web/package.json 仅 2 个 deps 但实际 import 30+ @aa/* | `todo` | 待修复 |
| 366 | apps/web/index.html 缺 meta description/icon/回退文案 | `todo` | 待修复 |

## ui/apps/electron-win

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 367 | electron-win/package.json:9 smoke 直跑 node ./src/index.ts，无 --import tsx/build，纯 Node 22 必失败 | `todo` | 待修复 |
| 368 | ui/apps/electron-win/src/main.ts:103 window.open 外链无 origin allowlist | `todo` | 待修复 |
| 369 | ui/apps/electron-win/src/main.ts:~162 globalShortcut 注册后未在 quit 前 unregisterAll，重启泄漏 | `todo` | 待修复 |
| 370 | ui/apps/electron-win/src/preload.ts:34-35 桥同时暴露 AA_ELECTRON 与私有 **AA_ELECTRON**，后者无完整性校验 | `todo` | 待修复 |
| 371 | ui/apps/electron-win/src/preload.ts preload 暴露的 IPC 通道在 main.ts 未 wire，调用静默失败而非 typed error | `todo` | 待修复 |
| 372 | ui/apps/electron-win/package.json:7 main:"src/main.ts" 但 Electron 不解析 TS，无 build:tsc 步骤，electron . 启动失败 | `todo` | 待修复 |
| 373 | ui/apps/electron-win/src/main.ts 模块定义 bootstrapElectronShell 但全包入口未调用，app.whenReady 永不触发 | `todo` | 待修复 |
| 374 | ui/apps/electron-win/src/main.ts:11,94 ALLOWED_SHELL_COMMANDS/isShellCommandAllowed 导出但无 IPC handler 调用，allowlist 死代码 | `todo` | 待修复 |
| 375 | ui/apps/electron-win/src/main.ts 缺 app.requestSingleInstanceLock，多次启动产生重复进程 | `todo` | 待修复 |
| 376 | ui/apps/electron-win/src/main.ts:103-106 setWindowOpenHandler shell.openExternal(url) 接受任意 URL 未限 protocol，file:///javascript: 可注入 | `todo` | 待修复 |
| 377 | ui/apps/electron-win/src/main.ts webContents 未注册 will-navigate 守卫，渲染层重定向到外域绕过沙箱 | `todo` | 待修复 |
| 378 | ui/apps/electron-win/src/main.ts 无 session.defaultSession.webRequest CSP 头注入 | `todo` | 待修复 |
| 379 | ui/apps/electron-win/src/main.ts 缺 autoUpdater 接线（package.json 依赖 electron-updater 但更新无入口） | `todo` | 待修复 |
| 380 | ui/apps/electron-win/src/main.ts 缺 app.on('window-all-closed') 处理，macOS 退出语义错 | `todo` | 待修复 |
| 381 | ui/apps/electron-win/src/preload.ts:34-35 AA_ELECTRON 与 **AA_ELECTRON** 同对象引用，渲染层覆写其一即同时污染另一 | `todo` | 待修复 |
| 382 | ui/apps/electron-win/src/preload.ts:27 installElectronBridge(target,bridge) 第一参 target:Window 仅占位 (void target)，API 误导 | `todo` | 待修复 |
| 383 | ui/apps/electron-win/src/renderer.js:1-43 桌面 splash 全英文硬编码，无 i18n/RTL，与 web 主壳脱节 | `todo` | 待修复 |
| 384 | electron-win/renderer.js 手写 DOM 占位，未加载 React 主应用 | `todo` | 待修复 |
| 385 | electron-win/index.html "Electron Windows Shell Baseline" 占位文案直交付 | `todo` | 待修复 |
| 386 | electron-win/package.json electron@^42.1.0 不存在 | `todo` | 待修复 |
| 387 | electron-win/main.ts:9 rendererHtmlPath = "../dist/index.html"，但包无 build 脚本产生该文件，生产启动 404 | `todo` | 待修复 |
| 388 | electron-win/main.ts:118-126 globalShortcut.register 返回值丢弃；冲突静默 | `todo` | 待修复 |
| 389 | electron-win/main.ts:159-164 无 will-quit/window-all-closed 与 globalShortcut.unregisterAll()，OS 级快捷键泄漏 | `todo` | 待修复 |
| 390 | electron-win/preload.ts:34-35 同时以 AA_ELECTRON 和 **AA_ELECTRON** 两个名字暴露 bridge | `todo` | 待修复 |
| 391 | electron-win/preload.ts:27-28 installElectronBridge(target,...) 立即 void target; 丢弃参数 | `todo` | 待修复 |
| 392 | electron-win/index.html:8 Electron CSP 缺 worker-src 与 report-uri | `todo` | 待修复 |
| 393 | electron-win/package.json:15-19 build.win.signAndEditExecutable: true 但仓库无签名配置，CI 必失败 | `todo` | 待修复 |
| 394 | ui/eslint.config.js:25 不 ignore apps/electron-win/dist/** 与 tauri 构建产物 | `todo` | 待修复 |

## ui/apps/tauri-*

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 395 | ui/apps/tauri-linux/src/index.ts 同 mobile 的 adapter-per-render 反模式 | `todo` | 待修复 |
| 396 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:16 CSP img-src 'self' data: https: https: 通配等同任意外站；缺 worker-src/font-src/media-src | `todo` | 待修复 |
| 397 | tauri-macos/src-tauri/tauri.conf.json:30 pubkey: "macos-demo-public-key" 占位，updater 接受伪造更新 | `todo` | 待修复 |
| 398 | tauri-macos/src-tauri/tauri.conf.json:21、tauri-linux/src-tauri/tauri.conf.json:23 updater 端点 automatic-agent.example 假 TLD | `todo` | 待修复 |
| 399 | tauri-linux/src-tauri/tauri.conf.json 无 pubkey 字段，签名校验未配 | `todo` | 待修复 |
| 400 | tauri-macos/src-tauri/tauri.conf.json:33 plugins.shell.open: true 无 scope 白名单 | `todo` | 待修复 |
| 401 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:26-34 shell.open:true os.all:true notification.all:true 过宽 capability | `todo` | 待修复 |
| 402 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:20-25 updater 无 pubkey，Linux updater 签名不校验 | `todo` | 待修复 |
| 403 | ui/apps/tauri-linux/src-tauri/tauri.conf.json:23 updater endpoint .example 占位指向死域名 | `todo` | 待修复 |
| 404 | ui/apps/tauri-macos/src-tauri/tauri.conf.json:25 pubkey:"macos-demo-public-key" 占位，验签必 fail | `todo` | 待修复 |
| 405 | ui/apps/tauri-macos/src-tauri/tauri.conf.json:31-39 同 linux 的 os.all/shell.open/notification.all 过宽 | `todo` | 待修复 |

## ui/apps/mobile

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 406 | apps/mobile/src/App.tsx:13 createMobilePlatformAdapter(detectPlatform()) 无 useMemo，每次渲染重建适配器 | `todo` | 待修复 |
| 407 | apps/mobile/src/App.tsx:8 detectPlatform() 依赖 navigator.userAgent，纯 RN 环境会 fall-through 到 android | `todo` | 待修复 |
| 408 | apps/mobile/src/App.tsx:19,20 mobileNavigation.tabs[0]!、settingsSubRoutes[0]! 非空断言无 fallback UI | `todo` | 待修复 |
| 409 | ui/apps/mobile/src/App.tsx:13 createMobilePlatformAdapter() 内联渲染无 useMemo，每次重建 adapter | `todo` | 待修复 |
| 410 | apps/mobile/metro.config.js:1 CJS 写法但父 package.json:5 "type":"module" | `todo` | 待修复 |
| 411 | apps/mobile/app.json:1-4 仅 name/displayName，缺 expo/scheme/version/orientation | `todo` | 待修复 |
| 412 | ui/apps/mobile/app.json:1-4 仅 name/displayName，缺 expo/iOS bundleIdentifier/Android package/icons/permissions，无法构建发布 | `todo` | 待修复 |
| 413 | ui/apps/mobile/package.json:11 仅 smoke 脚本，缺 start/android/ios/build；react-native 依赖却无 metro bundler 依赖声明 | `todo` | 待修复 |
| 414 | ui/apps/mobile/metro.config.js:11 unstable_enablePackageExports:true 但 monorepo packages 未声明 exports 字段，运行时解析失败 | `todo` | 待修复 |

## ui/packages/ui-core (components, charts, layouts)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 415 | ui/packages/ui-core/src/index.tsx:53-66 createFeatureModule Component 仅 try/catch 同步渲染错误，hooks 内异步抛错不被捕获 | `todo` | 待修复 |
| 416 | ui/packages/ui-core/src/components/FeatureScaffold.stories.tsx 仅 1 个 Basic story，Card/Panel/Tabs/Drawer/Accordion/Stepper/PieChart 等 30+ 组件零故事 | `todo` | 待修复 |
| 417 | ui/packages/ui-core/src/components/extended.tsx:217-219 Tooltip 仅给 span 设 title+aria-label 无 keyboard focusable，触发不了 hover 显示 | `todo` | 待修复 |
| 418 | ui/packages/ui-core/src/components/extended.tsx:221-228 Drawer 无 focus trap/ESC 关闭/overlay/focus return，违反 dialog WAI-ARIA | `todo` | 待修复 |
| 419 | ui/packages/ui-core/src/components/extended.tsx:233-236 Toast role="status" 与 aria-live="assertive" 角色/活区双指令冲突 | `todo` | 待修复 |
| 420 | ui/packages/ui-core/src/components/extended.tsx:166-173 Pagination 直接渲染 totalPages 个按钮，10⁴ 页 DOM 爆炸 | `todo` | 待修复 |
| 421 | ui/packages/ui-core/src/components/extended.tsx:185-196 Tabs 缺左右箭头键导航/aria-controls/tabindex 管理 | `todo` | 待修复 |
| 422 | ui/packages/ui-core/src/components/extended.tsx:199-215 Accordion 按钮无 aria-controls 指向内容，内容 div 无 id/role=region | `todo` | 待修复 |
| 423 | ui/packages/ui-core/src/components/extended.tsx:329-353 SegmentedControl role=radiogroup 但无方向键导航与 roving tabindex | `todo` | 待修复 |
| 424 | ui/packages/ui-core/src/components/extended.tsx:439-453 formatRemainingDuration new Date(deadline) 无效字符串得 NaN，输出 "NaNm remaining" | `todo` | 待修复 |
| 425 | ui/packages/ui-core/src/components/extended.tsx:117-127 Skeleton 用 aria-hidden 但无 motion 动画，loading 状态对低视力用户不可感知 | `todo` | 待修复 |
| 426 | ui/packages/ui-core/src/components/extended.tsx:8-9,16 StatusPill 文字色硬编码 #04130a，主题切换后对比度无法保证 WCAG AA | `todo` | 待修复 |
| 427 | ui/packages/ui-core/src/components/extended.tsx:265-272 Stepper 仅活跃步显 aria-current="step"，其他步缺 aria-disabled/aria-current="false" 且无 role="list" 关系 | `todo` | 待修复 |
| 428 | ui/packages/ui-core/src/components/index.ts:195 FeatureWorkbench onChange:(event:Event)=>... 用 DOM Event 而非 React.ChangeEvent | `todo` | 待修复 |
| 429 | ui/packages/ui-core/src/components/index.ts:238 onKeyDown:(event:KeyboardEvent)=> 用 DOM 类型而非 React 合成事件 | `todo` | 待修复 |
| 430 | ui/packages/ui-core/src/components/index.ts:153-160 triggerAction await action.onTrigger?.(item) 无 try/catch，用户回调抛错变 unhandled rejection | `todo` | 待修复 |
| 431 | ui/packages/ui-core/src/components/index.ts:46-52 KeyValueTable key:row.key 作 React key，两行同 key 即冲突 | `todo` | 待修复 |
| 432 | ui/packages/ui-core/src/components/index.ts:138 filter.toLowerCase() 而非 toLocaleLowerCase，土耳其 i/I locale 折叠失败 | `todo` | 待修复 |
| 433 | ui/packages/ui-core/src/components/index.ts:230-269 Workbench 列表 <button role=option>，listbox 缺 aria-activedescendant/单 tabstop | `todo` | 待修复 |
| 434 | ui/packages/ui-core/src/components/index.ts:288 aria-relevant="additions text" 缺 removals，活动日志删除条目无通报 | `todo` | 待修复 |
| 435 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:99-101 "mock" in ResizeObserver 启发式判断，含 mock 字段的真 class 误走 callable 路径 | `todo` | 待修复 |
| 436 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:119,123 useMemo 依赖数组含 ...chartColorDeps 不定长，违反 React hooks 静态依赖契约 | `todo` | 待修复 |
| 437 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:153 初始化 useEffect 依赖 [] 但闭包捕获 theme/buildChartOption，主题运行时切换不重建 chart | `todo` | 待修复 |
| 438 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:166-172 setOption 已替换数据后再 appendData 重复尾部，序列出现重影 | `todo` | 待修复 |
| 439 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:128-129 userAgent.includes("jsdom") 字符串嗅探，自定义 UA 即误判跳过初始化 | `todo` | 待修复 |
| 440 | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:138 addEventListener("resize") 绑到 mount 时 defaultView，容器移植到新 window 不再触发 | `todo` | 待修复 |
| 441 | ui/packages/ui-core/src/charts/index.tsx:160 HeatmapGrid 颜色硬编码 rgba(34,197,94,a)，无法跟随 theme 变化 | `todo` | 待修复 |
| 442 | ui/packages/ui-core/src/charts/index.tsx:80-81 ScatterPlot 仅取 maxX/maxY，负值与零基线散点跑出 viewBox | `todo` | 待修复 |
| 443 | ui/packages/ui-core/src/charts/index.tsx:63 BarChart 直接将外部 point.tone 字符串塞 background，未做 CSS 值白名单 | `todo` | 待修复 |
| 444 | ui/packages/ui-core/src/charts/index.tsx:55,83,111,140 chart 用 role="img" aria-label 隐藏数据，未提供 table 可展开 SR 文本 | `todo` | 待修复 |
| 445 | ui/packages/ui-core/src/charts/index.tsx:142 <span /> 空 placeholder 无 aria-hidden，屏读器读出空 cell | `todo` | 待修复 |
| 446 | ui/packages/ui-core/src/charts/echart-surface.tsx:11 lazy(()=>import(...)) 无错误边界包裹，Suspense fallback 不处理 chunk load failure | `todo` | 待修复 |
| 447 | ui/packages/ui-core/src/layouts/index.ts:26 ThreePaneLayout 接 viewportWidth prop 但 26-41 完全不使用，死参 | `todo` | 待修复 |
| 448 | ui/packages/ui-core/src/layouts/index.ts:25-41 三栏无 aside/main/aside landmark，左中右皆 <div> 无 aria-label | `todo` | 待修复 |
| 449 | ui/packages/ui-core/src/components/extended.tsx:401-408 PieChart gradientStops 累积 percent 浮点累加，1000+ 切片精度漂移产生裂缝 | `todo` | 待修复 |
| 450 | ui/packages/ui-core/src/components/extended.tsx:411-422 PieChart 仅 aria-label="Pie chart" 未声明 role，screen reader 不读切片明细 | `todo` | 待修复 |
| 451 | ui/packages/ui-core/src/components/extended.tsx:524-541 DAGVisualization repeat(stages.length,1fr) 单行布局，20+ stage 时列宽<阅读阈值且无横向滚动 | `todo` | 待修复 |
| 452 | ui/packages/ui-core/src/components/extended.tsx:265-272 Stepper 用 <ol> 但内部 <li> 无 role/链接，键盘 tab 跳过整序列 | `todo` | 待修复 |
| 453 | ui/.storybook/main.ts:5 stories glob 仅扫 packages/ui-core/**，所有 packages/features/* 与 packages/shared/ui/* 故事零覆盖 | `todo` | 待修复 |

## ui/packages/shared/api-client (rest, ws, interceptors)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 454 | ui/packages/shared/api-client/src/rest-client.ts:~398 fallbackTransport 在 401/403 重试失败后悄然返回 mock，遮蔽 auth 失败 | `todo` | 待修复 |
| 455 | ui/packages/shared/api-client/src/rest-client.ts:255-327 重试循环把 4xx 当 transient，无效重试放大限流 | `todo` | 待修复 |
| 456 | ui/packages/shared/api-client/src/rest-client.ts 默认 credentials:"include" 跨域请求，CSRF/cookie 泄漏 | `todo` | 待修复 |
| 457 | ui/packages/shared/api-client/src/rest-client.ts 直接 crypto.randomUUID() 无 globalThis guard，jsdom/旧 Node 失败 | `todo` | 待修复 |
| 458 | ui/packages/shared/api-client/src/interceptors.ts:49 createTraceInterceptor 同样 crypto.randomUUID() 无 fallback | `todo` | 待修复 |
| 459 | ui/packages/shared/api-client/src/interceptors.ts:243 createRetryInterceptor 重试一切错（含 4xx/AbortError），无 status allowlist | `todo` | 待修复 |
| 460 | ui/packages/shared/api-client/src/interceptors.ts:274 createDedupeInterceptor 模块级单例状态，跨 vitest 文件泄漏 | `todo` | 待修复 |
| 461 | ui/packages/shared/api-client/src/interceptors.ts:294 dedupe key 用 JSON.stringify(body)，对象键序不稳即缓存失效 | `todo` | 待修复 |
| 462 | ui/packages/shared/api-client/src/interceptors.ts:188 createOfflineQueueInterceptor 把 HEAD/OPTIONS 也入队，replay 风暴 | `todo` | 待修复 |
| 463 | ui/packages/shared/api-client/src/interceptors.ts:294 vs 312 两站点 dedupe key 格式不同，跨站点查找永不命中 | `todo` | 待修复 |
| 464 | ui/packages/shared/api-client/src/ws-client.ts:48 eventId 正则 ^evt[-_][A-Za-z0-9:-]{1,}$ 比 contract 窄，合法 id 在 252 行被丢 | `todo` | 待修复 |
| 465 | ui/packages/shared/api-client/src/ws-client.ts:218 token 走 Sec-WebSocket-Protocol 子协议传输，被代理/访问日志记录 | `todo` | 待修复 |
| 466 | ui/packages/shared/api-client/src/ws-client.ts:336 重连 jitter 用 Math.random() 无可注入种子，测试不可复现 | `todo` | 待修复 |
| 467 | ui/packages/shared/api-client/src/shared-ws-worker.ts:207 self.onconnect=… 模块顶层执行，被任意 import 即在错误 global 上挂 handler | `todo` | 待修复 |
| 468 | ui/packages/shared/api-client/src/shared-ws-worker.ts:172 reconnectTimer 调度新 setTimeout 前未置空，可叠多个定时器 | `todo` | 待修复 |
| 469 | ui/packages/shared/api-client/src/ws-event-router.ts:74 subscribe 不去重 handler，重复注册触发两次 | `todo` | 待修复 |
| 470 | ui/packages/shared/api-client/src/ws-event-router.ts disconnect() 不清 listener registry，重连后路由到上次 ghost handler | `todo` | 待修复 |
| 471 | 04-runtime-sequence.md:145 引用需复核的 ui/packages/shared/api-client/... | `todo` | 待修复 |
| 472 | ui/vitest.config.ts jsdom 环境未 polyfill crypto.randomUUID/crypto.subtle，导入即用的 interceptors/ws-client 在单测崩溃 | `todo` | 待修复 |
| 473 | ui/tests/shared/api-client.test.ts:193 mutate document.head.innerHTML，QueryClient 永不释放，跨 spec 泄漏定时器 | `todo` | 待修复 |
| 474 | ui/tests/unit/ui/shared/ws-client.test.ts:158 依赖 setTimeout(…,10) 排断言序，慢 CI 即 flake | `todo` | 待修复 |
| 475 | ui/tests/unit/ui/shared/ws-client.test.ts:269 单 it 内 vi.spyOn(Math,"random") 无 per-test mockRestore，后续 it 继承 spy 至 afterEach | `todo` | 待修复 |
| 476 | shared/api-client interceptor 组合 createIdempotencyKeyInterceptor 注册早于 createRetryInterceptor，重试时重新生成 idempotency key 击穿服务端去重 | `todo` | 待修复 |

## ui/packages/shared/auth & token

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 477 | ui/packages/shared/auth/src/auth-service.ts:121-126 handleSsoCallback 永抛 "auth.redirecting"，文档 happy path 是死代码 | `todo` | 待修复 |
| 478 | ui/packages/shared/auth/src/auth-service.ts SSO callback 解析 fragment 后未从 window.history 清除，token 留在浏览器历史/后退栈 | `todo` | 待修复 |
| 479 | ui/packages/shared/auth/src/token-manager.ts access/refresh token 明文写 localStorage，XSS 即泄露 | `todo` | 待修复 |
| 480 | api-auth-service.ts:228-231 verificationSecrets.some(...) 短路比较泄露 timing | `todo` | 待修复 |
| 481 | shared/auth (AuthSession) vs shared/state/auth-store (AuthStoreState) 两套会话模型字段重叠，漂移静默 | `todo` | 待修复 |

## ui/packages/shared/sync

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 482 | ui/packages/shared/sync/src/offline-queue.ts:82 trimToCapacity 溢出丢最旧无 telemetry/DLQ/caller 信号 | `todo` | 待修复 |
| 483 | ui/packages/shared/sync/src/sync-coordinator.ts:107 replay 漏附 Authorization/X-CSRF-Token/Idempotency-Key/tenant header，refresh 后 401/403 风暴 | `todo` | 待修复 |
| 484 | ui/packages/shared/sync/src/conflict-resolver.ts:137 preferMostRecent 在时间戳缺/相等时回退 localValue，与文档 server_wins 默认相悖 | `todo` | 待修复 |
| 485 | ui/packages/shared/sync/src/conflict-resolver.ts 不校验 lastModified，伪造未来时间戳即每次胜 | `todo` | 待修复 |
| 486 | ui/tests/unit/ui/shared/sync-coordinator.test.ts:11 固定真未来日期 2026-05-01T00:00:00.000Z，比 Date.now() 类断言随时钟漂移 | `todo` | 待修复 |

## ui/packages/shared/state (stores, query, mutations)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 487 | ui/packages/shared/state/src/stores/middleware.ts:19 cloneDraftValue 用 JSON 风格克隆，丢 Map/Set/Symbol 键/类实例 | `todo` | 待修复 |
| 488 | ui/packages/shared/state/src/stores/auth-store.ts:90 logout() Object.assign(draft, DEFAULT_AUTH_STATE) 与默认对象共享数组引用，后续 mutation 别名默认 | `todo` | 待修复 |
| 489 | ui/packages/shared/state/src/stores/auth-store.ts:60 持久化 key aa-auth-store 包含明文 access/refresh token | `todo` | 待修复 |
| 490 | ui/packages/shared/state/src/stores/sync-store.ts:54 setPendingMutations 计数归零仍保留 syncing/error 状态 | `todo` | 待修复 |
| 491 | ui/packages/shared/state/src/stores/sync-store.ts:88 resolveConflict 的 "merge" 分支静默 no-op | `todo` | 待修复 |
| 492 | ui/packages/shared/state/src/stores/sync-store.ts:94-99 单冲突解决会改写全局 strategy，跨无关冲突渗透策略 | `todo` | 待修复 |
| 493 | ui/packages/shared/state/src/stores/notification-store.ts:33 generateId 用 Date.now()+Math.random()，突发碰撞且测试不可复现 | `todo` | 待修复 |
| 494 | ui/packages/shared/state/src/stores/realtime-store.ts:55 triggerPanic 无逆操作且 store 持久化，panic 状态过 reload 仍存活 | `todo` | 待修复 |
| 495 | ui/packages/shared/state/src/query-client.ts:11 工厂命名误且默认 retry:3 让 TanStack Query 重试 4xx | `todo` | 待修复 |
| 496 | ui/packages/shared/state/src/query-cache-persistence.ts:163 flush 忽略 in-flight 写，订阅突发 setTimeout 重置但前次写仍 pending 互相覆盖 | `todo` | 待修复 |
| 497 | ui/packages/shared/state/src/query-cache-persistence.ts:146 hydrate 无 try/catch，IndexedDB 损坏即崩而非回退新缓存 | `todo` | 待修复 |
| 498 | ui/packages/shared/state/src/query-cache-persistence.ts 任意 cache（含 PII）落 IndexedDB 无脱敏/加密 | `todo` | 待修复 |
| 499 | ui/packages/shared/state/src/mutations/use-mutation.ts:81 调用用户 onMutate(variables, {} as QueryClient) 强转空对象，cache 调用即崩 | `todo` | 待修复 |
| 500 | ui/packages/shared/state/src/mutations/use-mutation.ts:88-91 onError 仅当 context?.previousData 真值时触发，onMutate 返 undefined 时错被吞 | `todo` | 待修复 |
| 501 | ui/packages/shared/state/src/mutations/use-mutation.ts:62-66 client.post/put/patch(resolvedPath, variables) 把整 variables（含路径参数 taskId 等）作 body | `todo` | 待修复 |
| 502 | ui/packages/shared/state/src/mutations/optimistic-update.ts:54 snapshotCache 标 async 实无 awaited 工作，API 误导 | `todo` | 待修复 |
| 503 | ui/packages/shared/state/src/mutations/optimistic-update.ts:84 patchCache 取消 query 但不自动 snapshot，调用者忘则 rollback 失效 | `todo` | 待修复 |
| 504 | ui/packages/shared/state/src/mutations/optimistic-update.ts:129 同 use-mutation 的 previousData gating bug | `todo` | 待修复 |
| 505 | ui/packages/shared/state/src/stores/* 持久化 store 无 schema migration，字段变形即 hydrate 崩，强迫用户清 localStorage | `todo` | 待修复 |
| 506 | ui/packages/shared/state/src/stores/auth-store.ts 缺 storage 事件监听跨 tab，退出后另一 tab 仍持旧 token | `todo` | 待修复 |
| 507 | ui/packages/shared/state/src/query-client.ts 无 defaultOptions.queries.staleTime，所有 query 立即 stale，多 dashboard hook 重复请求风暴 | `todo` | 待修复 |
| 508 | ui/packages/shared/state/src/stores/realtime-store.ts 持久化+triggerPanic 无 panic 复位 API，离线重连后 UI 仍 panic | `todo` | 待修复 |
| 509 | ui/packages/shared/state/src/stores/notification-store.ts:33 generateId=Date.now()+Math.random() 作 React key，碰撞致同帧通知 DOM 复用错位 | `todo` | 待修复 |

## ui/packages/shared/i18n

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 510 | ui/packages/shared/i18n/src/index.ts:~185 setLocale 在模块初始化时 mutate documentElement.lang/dir，跨 jsdom 测试文件泄漏 DOM | `todo` | 待修复 |
| 511 | ui/packages/shared/i18n/src/index.ts sharedTranslationService 作单例导出无 reset，测试需触模块内部 | `todo` | 待修复 |
| 512 | ui/packages/shared/i18n/src/index.ts:142 翻译命中失败回 key，UI 直接显示 ui.feature.xxx.title 无 telemetry 告警 | `todo` | 待修复 |
| 513 | ui/packages/shared/i18n/src/index.ts:139 IntlMessageFormat.format(values) as string 强转，含选择器(<b>{name}</b>)时返数组类型不匹配 | `todo` | 待修复 |
| 514 | ui/packages/shared/i18n/src/index.ts:139 每次 translate 都 new IntlMessageFormat(...)，无缓存热点 GC 风暴 | `todo` | 待修复 |
| 515 | ui/packages/shared/i18n/src/index.ts:185 setLocale("zh-CN") 默认调用强制初始化 mutate document，默认锁定 zh-CN 而非用户偏好 | `todo` | 待修复 |
| 516 | ui/packages/shared/i18n/src/index.ts:128-131 fallback chain 不去重 locale+catalog.fallbackLocales+fallbackLocale，重复值时同 catalog 多次访问 | `todo` | 待修复 |
| 517 | ui/packages/shared/i18n/src/index.ts:153 locale.split("-")[0] 空字符串时为 ""，detectLocale 退化为前缀全等空串 | `todo` | 待修复 |
| 518 | ui/packages/shared/i18n/src/index.ts:206-218 translateFeatureCopy 对每个 featureId 调 translateMessage 两次，N feature 即 2N 次 IntlMessageFormat 创建 | `todo` | 待修复 |
| 519 | ui/packages/shared/i18n/src/index.ts:111-118 applyLocaleToDocument mutate documentElement.lang/dir；未在 dispose 路径清理 | `todo` | 待修复 |

## ui/packages/shared/platform adapter

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 520 | ui/packages/shared/platform/src/desktop-platform-adapter.ts:13 读 window.AA_ELECTRON 无完整性校验，XSS 可伪造桥 | `todo` | 待修复 |
| 521 | ui/packages/shared/platform/src/desktop-platform-adapter.ts:~86 runShell 接受任意命令无 allowlist，渲染层被入即 RCE | `todo` | 待修复 |
| 522 | ui/packages/shared/platform/src/web-platform-adapter.ts 写 localStorage 无 QuotaExceededError 处理，配额满即所有写抛 | `todo` | 待修复 |

## ui/packages/shared/telemetry

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 523 | ui/packages/shared/telemetry/src/index.ts:89 无 exporter 时 buffer 满静默丢只留最新 | `todo` | 待修复 |
| 524 | ui/packages/shared/telemetry/src/index.ts:150 splice(0,length) 后 await 期间并发 record() 与 unshift 幸存者竞态破序 | `todo` | 待修复 |
| 525 | ui/packages/shared/telemetry/src/index.ts:233-235 OtlpHttpTelemetryExporter 构造同步抛错，且仅校验小写 authorization 头 | `todo` | 待修复 |
| 526 | ui/packages/shared/telemetry/src/index.ts:295-306 measureDuration 无 try/catch，fn() 同步抛使起始 performance.mark 孤儿 | `todo` | 待修复 |
| 527 | ui/packages/shared/telemetry/src/index.ts:399 PerformanceObserver.observe({type,buffered:true}) 旧 Safari/FF 不支持，try 吞错静默丢 vitals | `todo` | 待修复 |
| 528 | ui/packages/shared/telemetry/src/index.ts:141 dispose() 置 disposed 后异步 flush，期间 record() no-op 但 in-flight 未必被 caller await | `todo` | 待修复 |

## ui/packages/features (approval, dashboard, conversation, alerts, etc.)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 529 | ui/packages/features/approval/src/web/index.tsx:25 选中按钮背景色 #12201a、边框 #334155 硬编码跳过 design-token | `todo` | 待修复 |
| 530 | ui/packages/features/approval/src/web/index.tsx:62 Delegate button aria-describedby={delegateInputId} 指向 <input> 而非描述文本 | `todo` | 待修复 |
| 531 | ui/packages/features/approval/src/hooks/index.ts:50-62 approvalFeedVersion 用 : 拼接字段，taskId 含 : 即版本键碰撞 | `todo` | 待修复 |
| 532 | ui/packages/features/approval/src/hooks/index.ts:146-158 delegate 失败时无 rollback（与 approve/reject 不一致），UI 永久乐观删除 | `todo` | 待修复 |
| 533 | ui/packages/features/approval/src/hooks/index.ts:176-188 approveBatch/rejectBatch Promise.all 一条失败即拒整批 | `todo` | 待修复 |
| 534 | ui/packages/features/approval/src/hooks/index.ts:76 useEffect 依赖仅 [approvalFeedVersion]，eslint exhaustive-deps 缺 queryApprovals 引用 | `todo` | 待修复 |
| 535 | ui/packages/features/dashboard/src/hooks/index.ts:120-318 buildPanelGroups 标题/描述全 zh-CN 硬编码 | `todo` | 待修复 |
| 536 | ui/packages/features/dashboard/src/hooks/index.ts:390-405 useDashboardVm 6 query hook 无门控并行 fire；mapDashboardSnapshotToVm 未 memo | `todo` | 待修复 |
| 537 | ui/packages/features/dashboard/src/hooks/index.ts:56-58 formatRatio(value) 不 clamp，agent.load<0 或>1 时输出非法百分比 | `todo` | 待修复 |
| 538 | ui/packages/features/dashboard/src/hooks/index.ts:60-65 formatMetricValue String(metric.value) 在 value 为对象时变 [object Object] | `todo` | 待修复 |
| 539 | ui/packages/features/dashboard/src/hooks/index.ts:67-72 findMetric 按 label 字符串 "Queue Throughput" 等匹配，后端翻译即查不到 | `todo` | 待修复 |
| 540 | ui/packages/features/dashboard/src/hooks/index.ts:352-362 trendValues 把百分比与原始计数混入同一序列，趋势图 Y 轴含义崩坏 | `todo` | 待修复 |
| 541 | ui/packages/features/conversation/src/hooks/index.ts:48 模块顶层 new QueryClient() 单例，跨测试/SSR 实例污染且不 GC | `todo` | 待修复 |
| 542 | ui/packages/features/conversation/src/hooks/index.ts:58-60 模块级 Set listeners + sharedConversationClient，多消费者用首位创建实例的 persisted state | `todo` | 待修复 |
| 543 | ui/packages/features/conversation/src/hooks/index.ts:141 as never cast 屏蔽 ConversationClient 构造类型不匹配 | `todo` | 待修复 |
| 544 | ui/packages/features/conversation/src/hooks/index.ts:165-167 dispose 调用未 try/catch，client.dispose 抛错破坏 unmount cleanup | `todo` | 待修复 |
| 545 | ui/packages/features/conversation/src/hooks/index.ts:172 loadPersistedState 在 useState 初始化期同步访问 sessionStorage，SSR 报错 | `todo` | 待修复 |
| 546 | ui/packages/features/conversation/src/hooks/index.ts:176 草稿初始值 "Help me plan the next operation" 硬编码英文 | `todo` | 待修复 |
| 547 | ui/packages/features/conversation/src/hooks/index.ts:226-228 状态合并把 snapshot.status==="idle" 当噪声丢弃，client 主动 reset 信号被吞 | `todo` | 待修复 |
| 548 | ui/packages/features/conversation/src/hooks/index.ts:285-294 cleanup 仅 clearTimeout，最后一次 persist 未 flush | `todo` | 待修复 |
| 549 | ui/packages/features/conversation/src/hooks/index.ts:399,408,421 zh-CN 硬编码业务文案不可翻译 | `todo` | 待修复 |
| 550 | ui/packages/features/conversation/src/hooks/index.ts:450-466 返回 vm 对象未 useMemo，每渲染新引用 | `todo` | 待修复 |
| 551 | ui/packages/features/alerts/src/hooks/index.ts:118-122 const [filters]=useState(...) 无 setter，UI 改不了 filters，死状态 | `todo` | 待修复 |
| 552 | ui/packages/features/alerts/src/hooks/index.ts:152-166 setLiveIncidents(merge) 无 TTL 清理，长会话内存单调增长 | `todo` | 待修复 |
| 553 | ui/packages/features/alerts/src/hooks/index.ts:161 setStreamStatus("live") 一旦设置永不重置，连接断开仍显示 live | `todo` | 待修复 |
| 554 | ui/packages/features/alerts/src/hooks/index.ts:229-265 onAcknowledge/onDismiss/onSnooze/onEscalate fire-and-forget mutate，失败 history 已记成功且 UI 不 rollback | `todo` | 待修复 |
| 555 | ui/packages/features/alerts/src/hooks/index.ts:267-269 pendingOperations 仅数 pending 状态，4 mutation 串扰 | `todo` | 待修复 |
| 556 | ui/packages/features/alerts/src/hooks/index.ts:271-283 顶层 buildAlertsVm(...) 调用未 memo | `todo` | 待修复 |
| 557 | ui/packages/features/takeover/src/hooks/index.ts:40 JSON.parse(localStorage[...]) as TakeoverSnapshot[] 无 schema 校验 | `todo` | 待修复 |
| 558 | ui/packages/features/takeover/src/hooks/index.ts:75,94 [snapshot,...readSnapshots()] 读+写非原子，并发 claim/transfer 丢条目 | `todo` | 待修复 |
| 559 | ui/packages/features/takeover/src/hooks/index.ts:123-140 useEffect 依赖 currentSnapshot?.taskId，每次快照换 task 即重订阅 ws，期间 history 双计 | `todo` | 待修复 |
| 560 | ui/packages/features/takeover/src/hooks/index.ts:131-138 ws 事件即使无变更也写 capturedAt:new Date() 引发 memo 失效 | `todo` | 待修复 |
| 561 | ui/packages/features/takeover/src/hooks/index.ts:144-146 Manual Takeover/Override Actions/Resume Control 描述 zh-CN 硬编码 | `todo` | 待修复 |
| 562 | ui/packages/features/takeover/src/hooks/index.ts:62 ownershipHistory 状态无上限，长会话累计 | `todo` | 待修复 |
| 563 | ui/packages/features/hitl/src/hooks/index.ts:45 倒计时 (deadline-Date.now())/1000 hook 不订阅时间，UI 不会自动刷新到 0 | `todo` | 待修复 |
| 564 | ui/packages/features/hitl/src/web/index.tsx:15 JSON.parse(editorValue) patch 路径无显式校验/错误反馈，用户输入非 JSON 即整 view 抛 | `todo` | 待修复 |
| 565 | ui/packages/features/hitl/src/hooks/index.ts:119,126 JSON.stringify({action:"patch",patch}) 把整 patch 序列化进 textInput，无 size 限制 | `todo` | 待修复 |
| 566 | ui/packages/features/domain-wizard/src/hooks/index.ts:90 JSON.parse(raw) as Partial<...> 缺 schema 校验 | `todo` | 待修复 |
| 567 | ui/packages/features/domain-wizard/src/hooks/index.ts:140 localStorage.setItem 无 try/catch，配额满直接抛打断 wizard | `todo` | 待修复 |
| 568 | ui/packages/features/analytics/src/hooks/index.ts:211 JSON.stringify({metrics,timeSeriesData,breakdowns,dateRange},null,2) 全部数据塞导出字符串，无大小检查 | `todo` | 待修复 |
| 569 | ui/packages/features/conversation/src/web/index.tsx:59 border:"1px solid #334155" 硬编码 design-token 外颜色 | `todo` | 待修复 |
| 570 | ui/packages/features/*/src/web/index.tsx 普遍缺 <form> 包裹与 <button type="submit">，按 Enter 无默认提交语义 | `todo` | 待修复 |
| 571 | ui/packages/features/*/src/web/index.tsx 多处 inline style={{display:"grid",gap:..}} 重复，无统一 Stack/Inline primitive | `todo` | 待修复 |
| 572 | ui/package.json workspaces 不含 packages/features/* | `todo` | 待修复 |

## ui/tools (codegen, mock-server, e2e)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 573 | ui/tools/mock-server/src/index.ts:84 server.listen(port,...,resolve) 不监听 error 事件，端口失败即挂起 | `todo` | 待修复 |
| 574 | ui/tools/mock-server/src/index.ts:23-32 硬编码 apiVersion:"v1"/contractVersion:"1.0" 与 DEFAULT_ACCEPT_VERSIONS 不一致 | `todo` | 待修复 |
| 575 | ui/tools/codegen/src/index.ts:56 generateEndpointBindingModule 不转义 endpoint.path，含 "/反引号/\n 的路径生成损坏/可注入 TS | `todo` | 待修复 |
| 576 | ui/tools/codegen/src/index.ts:138 propertyName 原样插入 TS，含连字符/空格/冒号的 OpenAPI 属性产生非法标识符 | `todo` | 待修复 |
| 577 | ui/tools/codegen/src/index.ts:122 isInterfaceLikeSchema 在 oneOf/anyOf/allOf 与 properties 共存时返 false，properties 被静默丢 | `todo` | 待修复 |
| 578 | ui/tools/codegen/src/index.ts:273 operationId fallback ${method}-${path} + toTypeName 把仅标点不同的路径折叠成同名类型 | `todo` | 待修复 |
| 579 | ui/tools/codegen/src/index.ts:267 对 OpenAPI schema Object.entries 顺序在 spec 重生成时变化，产物 diff 噪声 | `todo` | 待修复 |
| 580 | ui/tools/mock-server/src/index.ts:65-77 POST/PUT body 永不 drain，高负载下 socket 缓冲堆满进程内存泄漏 | `todo` | 待修复 |
| 581 | ui/tools/mock-server/src/index.ts:80 默认 port=0 监听临时端口但无回调暴露真实端口给 env，调用者需手 wire | `todo` | 待修复 |
| 582 | ui/tools/e2e/src/smoke.spec.ts:3 baseURL 硬编码 [http://127.0.0.1:4173，忽略](http://127.0.0.1:4173，忽略) PLAYWRIGHT_BASE_URL/PLAYWRIGHT_PORT | `todo` | 待修复 |
| 583 | ui/tools/e2e/src/smoke.spec.ts 文件不在 playwright.config.ts testMatch glob 内，CI 永不执行的死代码 | `todo` | 待修复 |
| 584 | ui/tests/unit/ui/tools/mock-server-routing.test.ts 仅 2 条负向用例，漏首/尾斜杠与大小写敏感 | `todo` | 待修复 |

## ui/.storybook & playwright

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 585 | ui/packages/storybook/ 仅含 README，.storybook/main.ts:5 仅 ui-core/**/*.stories.tsx，工作区死成员 | `todo` | 待修复 |
| 586 | ui/playwright.config.ts:24,28 webServer.command 带完整 vite build && vite preview，与 reuseExistingServer:true 冲突 | `todo` | 待修复 |
| 587 | ui/playwright.config.ts PLAYWRIGHT_PORT=4173 硬编码，并发跑测端口冲突 | `todo` | 待修复 |
| 588 | ui/playwright.config.ts retries: CI?2:0 CI/本地信号不一致，掩盖真 flake | `todo` | 待修复 |
| 589 | ui/tests/playwright/visual-regression.spec.ts:20 访问 /governance/approvals，目录与路由实际为 /mission-control/approvals，baseline 截图打 404 | `todo` | 待修复 |
| 590 | ui/.storybook/main.ts:7 addons:[] — 缺 a11y/controls/viewport/docs，UI 库无 a11y 自动检查 | `todo` | 待修复 |
| 591 | ui/.storybook/preview.ts:1-7 无 i18n/Theme/Router decorator，依赖 context 的组件故事渲染状态错乱 | `todo` | 待修复 |
| 592 | ui/playwright.config.ts 未声明 projects 多浏览器矩阵，单浏览器跑测，跨引擎回归无覆盖 | `todo` | 待修复 |
| 593 | ui/.storybook/main.ts 缺 staticDirs/viteFinal 复用主 vite.config.ts 的 alias/CSP，story 构建管道与 web 偏移 | `todo` | 待修复 |

## ui/vite & tsconfig

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 594 | ui/eslint.config.js:14 tools/**/*.ts 包含 *.spec.ts，与测试 globals override 冲突 | `todo` | 待修复 |
| 595 | ui/eslint.config.js:1-52 启用 type-aware 规则但未设 parserOptions.project/projectService，规则降级 | `todo` | 待修复 |
| 596 | ui/vitest.config.ts:18 maxWorkers:1 强制串行 200+ 文件 | `todo` | 待修复 |
| 597 | ui/vitest.config.ts:21-27 coverage thresholds key "ui-core" 路径无效，80% 阈值静默失效 | `todo` | 待修复 |
| 598 | tsconfig.json:2-4 references:[{path:"./ui/tsconfig.json"}] 装饰性，typecheck 实际跑 3 个独立 tsc，未用 tsc -b | `todo` | 待修复 |
| 599 | ui/vitest.config.ts maxWorkers:1 硬编码串行，违反 AGENTS.md "raw concurrency by layered runner"，掩盖并发 bug | `todo` | 待修复 |
| 600 | scripts/ci/audit-lint-guardrails.mjs 不强制 eslint.config.js 与 ui/eslint.config.js 同步 | `todo` | 待修复 |

## ui other

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 601 | UI/E2E 多处硬编码 127.0.0.1:4173 端口 | `todo` | 待修复 |
| 602 | ui/package.json lint 排除 *.mjs，bundle-analysis.mjs 不被检查 | `todo` | 待修复 |
| 603 | ui/package.json:15 tools/* 在 workspaces，但 tools/{e2e,codegen,mock-server} 无 deps 声明，仅 tsconfig paths 解析 | `todo` | 待修复 |
| 604 | ui/package.json:30 lint 不覆盖 *.mjs（如 bundle-analysis.mjs、perf-budget.mjs） | `todo` | 待修复 |
| 605 | ui/lighthouserc.json:36 interaction-to-next-paint <= 200ms 在 simulate throttling 下必抖动 | `todo` | 待修复 |
| 606 | ui/tests/setup.ts patch matchMedia 无 afterAll 清理；不 stub IntersectionObserver/ResizeObserver/crypto.subtle | `todo` | 待修复 |
| 607 | ui/tests/docs/architecture-phase-alignment.test.ts:8-11、directory-panorama.test.ts:7 用 process.cwd()+"../docs_zh"，仅 ui 工作区可解析 | `todo` | 待修复 |
| 608 | ui/.turbo/tasks/test.json 缓存 JSON 被提交，未在 .gitignore | `todo` | 待修复 |
| 609 | package.json 与 ui/package.json 均无 repository.url，npm 元数据丢失源码链接 | `todo` | 待修复 |
| 610 | ui/packages/*/package.json、ui/apps/*/package.json 多数无 license: 字段 | `todo` | 待修复 |
| 611 | ui/tests/setup.ts 仅 stub matchMedia，无 afterEach 清 body/localStorage/sessionStorage/fetch mock，状态跨测泄漏 | `todo` | 待修复 |
| 612 | tests/fixtures/migration/migration-fixtures.test.ts 依赖 process.cwd() 而非 import.meta.url，从仓库根/ui/ 下跑结果不同 | `todo` | 待修复 |
| 613 | ui/tests/shared/web-platform-security-regressions.test.ts:7,18 mutate window.localStorage 无 afterEach 还原，下个测试见泄漏条目 | `todo` | 待修复 |

## tests/integration

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 614 | tests/integration/sdk/{admin,client,billing,channel-gateway}-* 5+ 文件 monkey-patch globalThis.fetch 无 try/finally，断言抛出即跨用例泄漏 | `todo` | 待修复 |
| 615 | tests/integration/org-governance/{oidc-service,sso-scim/sso-scim.integration}.test.ts 多次 process.env.NODE_ENV 切换，并发即竞态 | `todo` | 待修复 |
| 616 | tests/integration/platform/shared/cache/cache-invalidation-broadcast.test.ts:47,147、tests/integration/platform/execution/queue/queue-adapter.integration.test.ts:304 Redis localhost:6379 硬编码 | `todo` | 待修复 |
| 617 | tests/integration/platform/execution/queue/queue-adapter.integration.test.ts:24 delete process.env.AA_RUNNING_TESTS 不复原 | `todo` | 待修复 |
| 618 | tests/integration/platform/security/enterprise-capability-boundary.test.ts:108-110 循环内 delete + 设置 env 无原值捕获，失败即丢失 key | `todo` | 待修复 |
| 619 | tests/integration/platform/interface/api/api-server.test.ts:156-161 用 Date.now() 测时延，CI 抖动即抖 | `todo` | 待修复 |
| 620 | tests/integration/domains/governance/hr-role-governance-integration.test.ts:26 rootPath:"/tmp/${overrides.id}" 注入 → 越权写 /tmp | `todo` | 待修复 |

## tests/unit

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 621 | tests/unit/platform/source-integrations-risk.test.ts:20 用 Math.random().toString(36) 生成 dlg-id，破坏 golden replay | `todo` | 待修复 |
| 622 | tests/unit/platform/stability/stable-release-package.test.ts:167-184 18 处 /tmp/${profile}/... 报告路径无 mkdtemp/tmpdir() | `todo` | 待修复 |
| 623 | tests/unit/platform/security-field-encryption.test.ts:183,194 /tmp/${i}.ts 当 ID 使用与 sandbox-root 校验路径冲突 | `todo` | 待修复 |
| 624 | tests/unit/domains/governance/hr/hr-role-governance-service-{gap-analysis,helpers,interfaces}.test.ts 三处 /tmp/test/roles/${r.id}.prompt.md 假路径 | `todo` | 待修复 |

## tests/golden

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 625 | tests/golden/snapshots/ 37 份 .golden 全仓零引用 | `todo` | 待修复 |
| 626 | docs_zh/quality/00-full-coverage-test-manual.md:3642 引 phase1a-golden-tasks.test.ts，tests/golden/ 不存在 | `todo` | 待修复 |
| 627 | scripts/ci/audit-golden-snapshots.mjs 不校验 tests/golden/** 内 Date.now()/new Date() | `todo` | 待修复 |
| 628 | tests/golden/rollout-record.test.ts:33,191 new Date(1714500000) 把秒当毫秒，时间戳全为 1970-01-20 | `todo` | 待修复 |
| 629 | tests/golden/agent-state-view-service.test.ts 快照含 process.env.USER/os.hostname()，跨开发机 golden 失败 | `todo` | 待修复 |

## tests/leaks & performance

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 630 | tests/performance/** rmSync 越界删除非测试目录风险 | `todo` | 待修复 |
| 631 | tests/leaks/platform/ 测试根未在 package.json 命名脚本登记，执行状态未知 | `todo` | 待修复 |
| 632 | tests/performance/event-indexing-perf.test.ts finally 清理用 Date.now() 重新计算路径，tmp 目录永不删除累积 | `todo` | 待修复 |
| 633 | tests/leaks/platform/shared/cache/memory-cache-store.leak.test.ts 阈值 8MB 过松，慢速泄漏 7MB 连续 100 次后才报警 | `todo` | 待修复 |
| 634 | tests/leaks/platform/ 仅 2 文件覆盖 cache 与 event-bus，主存储/调度/IAM 无 leak 测试 | `todo` | 待修复 |

## tests/fixtures

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 635 | tests/fixtures/packs/test-pack/{scripts,src/{tools,adapters,evaluators,retrievers}} 多个非 fixture 资产，违反 AGENTS.md 仅夹具约定 | `todo` | 待修复 |
| 636 | tests/fixtures/packs/ 9 个目录无引用且自带误抓的测试 | `todo` | 待修复 |
| 637 | tests/fixtures/migration/migration-fixtures.test.ts 258 行活测放在 fixtures | `todo` | 待修复 |
| 638 | tests/fixtures/packs/{test-pack,test_pack,test.pack}/{manifest,package}.json 三份近相同，膨胀 npm 工作区扫描 | `todo` | 待修复 |
| 639 | tests/fixtures/migration/migration-fixtures.test.ts:22 isCompatibleFixtureSkip 把 sqlite "duplicate column" 真错吞为 skip，遮蔽迁移回归 | `todo` | 待修复 |
| 640 | tests/fixtures/migration/generate-snapshots.ts 与 snapshots/ 无 CI 漂移检测 | `todo` | 待修复 |
| 641 | tests/fixtures/packs/test-pack/manifest.json/test_pack/manifest.json/test.pack/manifest.json 三份 fixture 均缺 $schema | `todo` | 待修复 |
| 642 | tests/fixtures/migration/migration-fixtures.test.ts isCompatibleFixtureSkip 用 sqlite "duplicate column" 真错吞为 skip 已记 #635 但 fixture 缺 $schema 是新维度 | `todo` | 待修复 |

## tests/helpers

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 643 | tests/helpers/{repo-root,repo-module}.ts 两套 repo-root 计算（cwd vs URL），同进程不同结果 | `todo` | 待修复 |
| 644 | tests/helpers/{seed,typed-factories,perception}.ts 多个重叠 "make-record" helper，使用风格分裂 | `todo` | 待修复 |
| 645 | tests/helpers/test-cleanup.ts:8 引 node:test，仓库其余 vitest，混用两套 runner API | `todo` | 待修复 |
| 646 | tests/helpers/test-cleanup.ts:25 execFileSync("ps",…) 仅 unix，Windows CI 失败 | `todo` | 待修复 |
| 647 | tests/helpers/test-cleanup.ts:44 模块顶层注册 afterEach，import 即继承全局钩子无法 opt-out | `todo` | 待修复 |
| 648 | tests/helpers/process-guard.ts 跨嵌套 describe 不幂等，重复注册 SIGTERM 触发 MaxListenersExceededWarning | `todo` | 待修复 |
| 649 | tests/helpers/memory-leak.ts 依赖 global.gc，无 --expose-gc 时静默通过假阴 | `todo` | 待修复 |
| 650 | tests/helpers/env.ts mutate process.env 无 afterEach 还原，污染后续测试文件 | `todo` | 待修复 |
| 651 | tests/helpers/process-guard.ts 顶层 import { spawn } 未实际使用 | `todo` | 待修复 |
| 652 | tests/helpers/memory-leak.ts globalThis.gc?.() 调用前不强制 setImmediate 让 V8 完成 minor GC | `todo` | 待修复 |
| 653 | tests/helpers/test-cleanup.ts:25 execFileSync("ps",...) 仅 POSIX，distroless 容器缺 ps | `todo` | 待修复 |
| 654 | tests/helpers/performance.ts 软 miss expect(...).toBeLessThan(threshold*1.2) 模式被多用例复用，掩盖 20% 性能回归 | `todo` | 待修复 |

## tests other

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 655 | 测试用相对路径 import src/ 与 dist/tests/...js 执行约定矛盾 | `todo` | 待修复 |
| 656 | tsconfig.build.json 排除 tests，不会产生 dist/tests/** | `todo` | 待修复 |
| 657 | tests/invariants/ 30+ 文件无 test:invariants 入口，失败不进命名 CI 报告 | `todo` | 待修复 |
| 658 | tests/invariants/e2e-skip-guard.test.ts:40-57 未匹配 serialTest(name,"skip",...) 形式，paper guard | `todo` | 待修复 |
| 659 | README.md:68-71 测试树缺 tests/{invariants,performance,helpers}/ | `todo` | 待修复 |
| 660 | MEMORY.md:25-26 推荐 dist/tests/... 路径但 tsconfig.build.json 排除 tests，无产物 | `todo` | 待修复 |
| 661 | scripts/run-tracked-tests.mjs:4 git ls-files "tests/**/*.test.ts" 把 ** 当字面量，结果常为空 | `todo` | 待修复 |
| 662 | scripts/curated-test-selection.mjs 与 run-curated-tests.mjs 共依赖 dist/tests/**/*.test.js，但 tsconfig.build.json 排除 tests，npm 脚本未串联 | `todo` | 待修复 |
| 663 | tsconfig.json include tests/**/*.ts 但无 npm run typecheck:tests | `todo` | 待修复 |
| 664 | .dockerignore 仅 8 行，未排除 docs/tests/coverage/.github | `todo` | 待修复 |

## scripts/ci audits

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 665 | scripts/ 与 scripts/ci/ 存在大量孤儿脚本（含孤儿环） | `todo` | 待修复 |
| 666 | scripts/ci/audit-docs-charset.mjs 无法识别 docs_en/architecture/00-platform-architecture.md 的 us-ascii 与 zh sibling utf-8 漂移 | `todo` | 待修复 |
| 667 | scripts/ci/mutation-critical-tests.sh:11-16 列表文件不存在性检查，CI 重命名即 noisy fail | `todo` | 待修复 |
| 668 | scripts/ci/audit-test-portability.mjs 不扫描 scripts/src 下 /tmp//process.env.HOME 直读 | `todo` | 待修复 |
| 669 | scripts/ci/audit-ci-supply-chain.mjs 不强制 actions/*@<sha> 钉版，@v4 浮动通过 | `todo` | 待修复 |
| 670 | scripts/ci/audit-test-exclusions.mjs 仅验形式，不交叉对照实际测试文件 | `todo` | 待修复 |
| 671 | scripts/ci/audit-docs-charset.mjs 仅校验 docs，遗漏 divisions roles prompt.md、AGENTS.md | `todo` | 待修复 |
| 672 | scripts/ci/check-coverage-baseline.mjs 阈值与 config/quality/default.json 双源真相 | `todo` | 待修复 |
| 673 | scripts/ci/mutation-critical-tests.sh 用 POSIX sh 但含 bash 数组语法，dash 下静默失败 | `todo` | 待修复 |
| 674 | scripts/ci/audit-codebase-inventory.mjs 与 audit-document-structure.mjs 输出位置未在 .gitignore | `todo` | 待修复 |
| 675 | scripts/ci/audit-domain-configs.mjs 不校验 divisions/division.yaml 与 division-catalog.json divisionId 一致 | `todo` | 待修复 |
| 676 | scripts/ci/audit-division-workflows.mjs 不校验 workflow id 与 default_workflow/orchestration_workflow 一致 | `todo` | 待修复 |
| 677 | scripts/ci/audit-runtime-service-events.mjs 不校验事件 schema 版本与 runtime configVersion 一致 | `todo` | 待修复 |
| 678 | scripts/ci/audit-sync-async-service-pairs.mjs 不报告 sync/async 双实现已分歧 | `todo` | 待修复 |
| 679 | scripts/ci/audit-public-error-codes.mjs 不交叉校验 error-codes.md 与 error-codes.ts | `todo` | 待修复 |
| 680 | scripts/ci/audit-harness-index-split.mjs 仅按文件名规则审计，不校验导出 API 二进制兼容 | `todo` | 待修复 |
| 681 | scripts/ci/audit-implementation-remediation.mjs 与 audit-review-governance-closures.mjs 不联动 review 表 | `todo` | 待修复 |
| 682 | scripts/ci/audit-review-magic-number-examples.mjs 关键词列表硬编码，新模式漏判 | `todo` | 待修复 |
| 683 | scripts/ci/audit-review-large-source-examples.mjs 阈值未文档化 | `todo` | 待修复 |
| 684 | scripts/ci/audit-review-unsafe-type-assertions.mjs 仅扫 as any/as unknown as，忽略 <T>(...)/satisfies 误用 | `todo` | 待修复 |
| 685 | scripts/ci/audit-review-runtime-schema-audit-columns.mjs 不校验迁移版本号单调 | `todo` | 待修复 |
| 686 | scripts/ci/audit-review-batch-resource-contracts.mjs 与 audit-review-domain-duplication.mjs 双扫 domains 无缓存 | `todo` | 待修复 |
| 687 | scripts/ci/check-changelog.mjs 不强制 PR 更新 CHANGELOG，且不校验语义版本递增 | `todo` | 待修复 |
| 688 | scripts/ci/coverage-lib.mjs/check-coverage-baseline.mjs/update-coverage-baseline.mjs 三处独立读 coverage-summary.json | `todo` | 待修复 |
| 689 | scripts/ci/npm-audit-to-sarif.mjs 不映射 GHSA→CWE，GitHub Security 视图缺类目 | `todo` | 待修复 |
| 690 | scripts/ci/generate-coverage-report.mjs 输出路径 coverage-report/ 未在 .gitignore | `todo` | 待修复 |
| 691 | scripts/ci/audit-docs-sync.mjs 不校验 docs_zh 与 docs_en 行数差异，翻译漏段静默通过 | `todo` | 待修复 |

## scripts/validation

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 692 | scripts/validation/*.ts 被 npm 调用但未被 typecheck 覆盖 | `todo` | 待修复 |
| 693 | scripts/validation/mission-operating-model-closure.mjs 用 fileURLToPath 链定位仓库根，从子目录调用即指向错误路径 | `todo` | 待修复 |
| 694 | scripts/validation/platform-validation-closure.mjs 与 export-platform-validation-artifacts.ts mjs/ts 混合扩展，scripts tsconfig 仅 include .mjs | `todo` | 待修复 |
| 695 | scripts/validation/platform-product-validation.ts 是 ts 但 npm 脚本无 tsx 入口样例 | `todo` | 待修复 |

## scripts top-level

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 696 | scripts/README.md:6-8 描述 runtime/ 与 bootstrap/ 子目录但二者不存在 | `todo` | 待修复 |
| 697 | stryker.config.mjs:11-13 sh scripts/.../mutation-critical-tests.sh 与 package.json:193 bash 调用不一致，dash/bash 语法分歧 | `todo` | 待修复 |
| 698 | scripts/architecture-boundary-scan.mjs 在 CI 跑但未进 package.json ci:baseline 链 | `todo` | 待修复 |
| 699 | scripts/scan-current-codebase-gap.mjs 输出路径无文档，未进 audit:repo-hygiene | `todo` | 待修复 |
| 700 | deploy/scripts/backup-sqlite.sh:67 加密用 aes-256-gcm，restore-sqlite.sh:158 解密用 aes-256-cbc，加密备份永不可恢复 | `todo` | 待修复 |
| 701 | deploy/scripts/backup-sqlite.sh:67-72 openssl enc -aes-256-gcm 在多数 openssl 版本不支持，静默失败 | `todo` | 待修复 |
| 702 | deploy/scripts/backup-sqlite.sh:90-93 远程上传缺工具时 exit 1 但保留本地备份，孤儿备份每日积累 | `todo` | 待修复 |
| 703 | deploy/scripts/rollback.sh:78 node -e 解析器查找字面字符串 ".status=="deployed""，永远返回 undefined → CURRENT_REVISION="unknown" | `todo` | 待修复 |
| 704 | deploy/scripts/dr-drill.sh:24-27 --dry-run 在参数校验前 exit 0，CI 错误 cmdline 被 dry-run 掩盖 | `todo` | 待修复 |
| 705 | deploy/scripts/dr-drill.sh:9 shebang 为 #!/bin/bash 不可移植 | `todo` | 待修复 |
| 706 | deploy/scripts/deploy.sh:10 [[ "${1:-}" == "--dry-run" ]] 仅匹配第一个参数，dev v1 --dry-run 不进 dry-run 直接真实部署 | `todo` | 待修复 |
| 707 | scripts/clean-dist.mjs:5-19 env 优先级链不覆盖 aa:dev，紧随 npm run build 即 rmSync(dist) 破坏开发流 | `todo` | 待修复 |
| 708 | scripts/curated-test-selection.mjs:9 listFiles(".github/workflows",...) 无 cwd 守卫 | `todo` | 待修复 |
| 709 | scripts/scan-current-codebase-gap.mjs:14-19 硬编码 tool-executor/、harness/toolbelt/，重命名静默失效 | `todo` | 待修复 |
| 710 | scripts/run-layered-tests.mjs:52 硬编码 --test-concurrency=12，违反 AGENTS.md 由 layered runner 决定的契约 | `todo` | 待修复 |
| 711 | scripts/run-layered-tests.mjs 未过滤把整 process.env 透传子进程，VITE_AUTH_TOKEN 等密钥进子进程日志 | `todo` | 待修复 |
| 712 | scripts/run-tracked-tests.mjs:44,49 双处硬编码 --test-concurrency=12/=1，绕过 AA_TEST_CONCURRENCY 协议 | `todo` | 待修复 |
| 713 | scripts/run-tracked-tests.mjs:25 子进程透传整 process.env，未过滤 *_SECRET/*_TOKEN 等密钥 | `todo` | 待修复 |
| 714 | scripts/run-tracked-tests.mjs:1 顶层 await 后无 try/catch，非 git 仓库即未捕获异常 | `todo` | 待修复 |
| 715 | scripts/run-tracked-tests.mjs 无 child.on("error")，spawn 失败 promise 永挂起 | `todo` | 待修复 |
| 716 | scripts/run-curated-tests.mjs:11 默认 AA_CURATED_TEST_CONCURRENCY=12 与 layered runner 重复硬编码 | `todo` | 待修复 |
| 717 | scripts/run-curated-tests.mjs:13-17 blockedEnvPatterns 漏 *_KEY/*_API_KEY/AA_API_KEYS_JSON/OPENAI_API_KEY | `todo` | 待修复 |
| 718 | scripts/run-curated-tests.mjs:78 不像 layered runner 注入 --expose-gc，curated 命中 leak 用例时 global.gc 静默 undefined | `todo` | 待修复 |
| 719 | scripts/run-layered-tests.mjs:195 env: process.env 直接透传，未应用 blockedEnvPatterns 过滤 | `todo` | 待修复 |
| 720 | scripts/run-layered-tests.mjs:173 强制 --test-force-exit 掩盖未关闭句柄/timers，泄漏被静默 | `todo` | 待修复 |
| 721 | scripts/run-layered-tests.mjs:200-205 child.on("exit") 而非 "close"，stdio 未排空即 resolve | `todo` | 待修复 |
| 722 | scripts/run-layered-tests.mjs 无 child.on("error")，spawn 失败 promise 永挂起 | `todo` | 待修复 |
| 723 | scripts/run-layered-tests.mjs:217 只匹配 .test.ts，遗漏 .test.tsx/.test.mts/.spec.ts | `todo` | 待修复 |
| 724 | scripts/run-layered-tests.mjs:84-105 listFilesRecursively 不跳 node_modules/.git | `todo` | 待修复 |
| 725 | scripts/clean-dist.mjs 无 --dry-run，误调用即 rmSync(dist) 不可恢复 | `todo` | 待修复 |
| 726 | scripts/architecture-boundary-scan.mjs 无 SARIF 输出，PR 注释流程缺失 | `todo` | 待修复 |
| 727 | scripts/scan-current-codebase-gap.mjs 输出含 Date.now() 时间戳但无 git ignore | `todo` | 待修复 |
| 728 | scripts/generate-src-module-test-matrix.mjs 与 audit-codebase-inventory.mjs 重复扫描 src，无共享 walker | `todo` | 待修复 |
| 729 | scripts/reorg-code-structure.mjs 五平面迁移完成后无脚本绑定，遗留死脚本 | `todo` | 待修复 |
| 730 | scripts/backup-sqlite.sh 无 set -euo pipefail，部分错误被忽略继续 | `todo` | 待修复 |
| 731 | scripts/backup-sqlite.sh 加密路径无 IV/nonce，openssl enc -salt 默认 PBKDF1 已弱化 | `todo` | 待修复 |
| 732 | scripts/backup-sqlite.sh 备份完成后无 sha256sum 校验 | `todo` | 待修复 |
| 733 | scripts/restore-sqlite.sh 无原子替换，恢复中断即数据库永损 | `todo` | 待修复 |
| 734 | scripts/restore-sqlite.sh 不校验备份 schema 版本与当前 migrations 兼容 | `todo` | 待修复 |
| 735 | scripts/backup-sqlite.sh/restore-sqlite.sh 默认 DB 路径与 CONTRIBUTING/helm/AA_DB_PATH 四处不一致 | `todo` | 待修复 |
| 736 | scripts/backup-sqlite.sh 无 lock，与运行中 sqlite WAL 并发，.backup busy 时静默重试 5s 后失败 | `todo` | 待修复 |
| 737 | deploy/scripts/deploy.sh 蓝绿切换前未校验 new selector pod ready 数==replicas | `todo` | 待修复 |
| 738 | deploy/scripts/rollback.sh 解析 helm history 通过 awk 列号，helm 输出格式变更即崩 | `todo` | 待修复 |
| 739 | deploy/scripts/dr-drill.sh 触发 region 切换无 dry-run flag | `todo` | 待修复 |
| 740 | deploy/scripts/verify-hot-upgrade.sh 仅校验 HTTP 200，未比对版本 header/build hash | `todo` | 待修复 |
| 741 | deploy/scripts/*.sh 全无 set -euo pipefail | `todo` | 待修复 |
| 742 | deploy/scripts/*.sh 错误退出码不区分（统一 1） | `todo` | 待修复 |

## docs_en

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1002 | docs_en/ 多出 5 处无 zh 对应文件，含未翻译/路径误粘 | `todo` | 待修复 |
| 1003 | docs_zh/migrations/ 与 docs_zh/migration/ 单复数双目录共存；docs_en/migrations/ 同问题 | `todo` | 待修复 |
| 1004 | docs_en/ 103 文件包含 docs_zh/ 链接，跨语种链路泄漏 | `todo` | 待修复 |
| 1005 | translate_docs.py:21-100 硬编码 117 路径列表，docs_en/research/archive/module-inventory.md 等多目标已不存在 | `todo` | 待修复 |
| 1006 | docs_zh/migrations/e2e-workflow-state-migration.md、docs_en/migrations/e2e-workflow-state-migration.md 282 行重复正文，未做 4 行重定向 | `todo` | 待修复 |
| 1007 | docs_zh/migrations/README.md、docs_en/migrations/README.md 别名 README 与原目录同时存在，两条路径都可落地 | `todo` | 待修复 |
| 1008 | docs_en/architecture/00-platform-architecture.md:3-10 跨链回 docs_zh/...，英文读者被推回中文页 | `todo` | 待修复 |
| 1009 | docs_en/contracts/ 中文契约 14 条未对应英文版本 | `todo` | 待修复 |

## docs_zh other

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1010 | docs_zh/reviews/ 含脚本 extract-issues.mjs 与无 en 对应文件 | `todo` | 待修复 |
| 1011 | docs_zh/CHANGELOG.md 声称基线 0.1.0 但根 CHANGELOG 仅 [Unreleased] | `todo` | 待修复 |
| 1012 | docs_zh/buglist.md 自 2026-05-02 长期未刷新 | `todo` | 待修复 |
| 1013 | docs_zh/guides/quickstart.md:11 推荐阅读 ADR-003（已 superseded by ADR-020） | `todo` | 待修复 |
| 1014 | docs_zh/architecture/01-code-structure.md 仍含 phase 1[ab] 旧标签 | `todo` | 待修复 |
| 1015 | docs_zh/CHANGELOG.md 与根 CHANGELOG.md 双 changelog，无合并契约 | `todo` | 待修复 |
| 1016 | docs_zh/governance/source_of_truth.md 是 AGENTS.md 应指向的"权威指针"，AGENTS.md 从不引用 | `todo` | 待修复 |
| 1017 | docs_zh/governance/naming_and_directory_conventions.md 未被 AGENTS.md/CLAUDE.md 链接，命名规则在 agent 上下文层未生效 | `todo` | 待修复 |
| 1018 | docs_zh/buglist.md 无自动重新生成脚本，永远漂移 | `todo` | 待修复 |
| 1019 | docs_zh/quality/buglist.md 与 docs_zh/buglist.md 双 buglist 无规范指针 | `todo` | 待修复 |

## root governance (README, AGENTS, CONTRIBUTING, SECURITY, LICENSE, CHANGELOG)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1020 | src/sdk/harness-sdk/ 仅 1 文件 600+ 行，与 AGENTS.md "独立 SDK" 描述不符 | `todo` | 待修复 |
| 1021 | drift-detection/evolution-integration-service.ts:280-326 decision.reason/severity 丢弃；includes("security")/("input") 子串误判分类 | `todo` | 待修复 |
| 1022 | AGENTS/CLAUDE 未提及 src/runtime/agent-runtime/，compat surface 边界不全 | `todo` | 待修复 |
| 1023 | README.md:65 列 src/testing/，但 AGENTS.md 未授权该目录 | `todo` | 待修复 |
| 1024 | pack-security-service.ts 默认 vulnerabilityApiUrl 硬编码 osv.dev | `todo` | 待修复 |
| 1025 | Node 版本声明四套并存（README/package.json/CONTRIBUTING/dependency-upgrade-plan/CI matrix） | `todo` | 待修复 |
| 1026 | CONTRIBUTING.md 列出 npm run lint，AGENTS.md 称无 formatter，口径冲突 | `todo` | 待修复 |
| 1027 | reviews/README.md 看板未提及 platforme-full-review-b.md，状态不明 | `todo` | 待修复 |
| 1028 | adr/README.md 中 ADR-001/069/072 状态与正文 frontmatter 不一致 | `todo` | 待修复 |
| 1029 | LICENSE:3 版权人写项目名而非法人实体，MIT 法律强度弱 | `todo` | 待修复 |
| 1030 | README.md:101 写 MIT 但无 LICENSE 链接、THIRD_PARTY_NOTICES、子依赖致谢 | `todo` | 待修复 |
| 1031 | README.md:30-39 推荐 npm run test:pg-integration/test:secret-providers，二者已知 broken | `todo` | 待修复 |
| 1032 | MEMORY.md 无编辑契约，AGENTS.md/CLAUDE.md 都不引用 | `todo` | 待修复 |
| 1033 | CONTRIBUTING.md:18 cd automatic_agent_platform（snake_case）与实际目录 automatic-agent-platform-main 不符 | `todo` | 待修复 |
| 1034 | CONTRIBUTING.md:39 AA_DB_PATH=data/sqlite/phase1a-demo.db 与 backup-sqlite.sh:21、helm automatic-agent.db 三处默认值各不同 | `todo` | 待修复 |
| 1035 | CONTRIBUTING.md:91-93 强制 AppError.wrap 与 {domain}.{type}:{ctx} 错误码格式，AGENTS.md 未提及，代码库多种格式 | `todo` | 待修复 |
| 1036 | AGENTS.md/CLAUDE.md/MEMORY.md/CONTRIBUTING.md/README.md 5 份顶层指南文档无总索引，commit 规范等内容重复 | `todo` | 待修复 |
| 1037 | translate_docs.py:1-9 自称 legacy 工具，README.md:54 仍宣传为活动工具 | `todo` | 待修复 |
| 1038 | helpers/fs.ts 导出 createSymlink 无 realpath 校验，AGENTS.md 安全立场下为 footgun | `todo` | 待修复 |
| 1039 | package-lock.json 无 npm audit signatures 证据文件，与 supply-chain-security 文档矛盾 | `todo` | 待修复 |
| 1040 | LICENSE 无对应 npm package.json.license:"MIT" 字段 | `todo` | 待修复 |
| 1041 | README.md "seven-layer architecture" 表述与 AGENTS.md/代码 "five-plane" 矛盾 | `todo` | 待修复 |
| 1042 | README.md 引用 npm run doctor 等命令未在 CONTRIBUTING 章节交叉链接 | `todo` | 待修复 |
| 1043 | CONTRIBUTING.md 默认 AA_DB_PATH=data/sqlite/phase1a-demo.db 与 compose/helm 默认 data/automatic-agent.db 漂移 | `todo` | 待修复 |
| 1044 | CHANGELOG.md 最近版本 entry 未对应 git tag | `todo` | 待修复 |
| 1045 | 仓库根缺 SECURITY.md（GitHub 安全披露通道未声明） | `todo` | 待修复 |
| 1046 | LICENSE 文件 SPDX 标识未在 package.json license 字段声明（或与之不一致） | `todo` | 待修复 |

## root configs (package.json, tsconfig, eslint, .gitignore, .editorconfig, .npmrc, .nvmrc)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1047 | package.json:170 aa:dev 直跑 node --import tsx src/sdk/cli/aa.ts，无 AA_RUNNING_TESTS 守卫；CI 测试场景下可能写真实 data/ SQLite | `todo` | 待修复 |
| 1048 | src/index.ts 把深内部直接拉到顶层公共出口，绕过 package.json#exports | `todo` | 待修复 |
| 1049 | package.json 硬编码 --test-concurrency=1，绕过 layered runner | `todo` | 待修复 |
| 1050 | package.json:223-235 缩进异常会触发 format 抖动 | `todo` | 待修复 |
| 1051 | tsconfig.build-test.json 死配置，无任何引用 | `todo` | 待修复 |
| 1052 | tsconfig.json 多个 exclude 与 npm script 引用同一文件冲突 | `todo` | 待修复 |
| 1053 | eslint.config.js 启用 type-aware 规则但未声明 parser/projectService | `todo` | 待修复 |
| 1054 | package.json lint --ext 在 flat config 下被忽略，.tsx 未覆盖 | `todo` | 待修复 |
| 1055 | stryker.config.mjs 排除 helper + tsconfig 含 ui references 致沙箱失败 | `todo` | 待修复 |
| 1056 | eslint.config.js:33-37 测试 type-aware 规则未设 parserOptions.project 即静默 no-op | `todo` | 待修复 |
| 1057 | package.json:243 format:check 无 .prettierignore，lock/dist/coverage/golden 全部进 prettier 校验 | `todo` | 待修复 |
| 1058 | package.json:264 @types/xml-crypto:^1.4.6 与 xml-crypto:^6.1.2 不同主版，类型与运行时不匹配 | `todo` | 待修复 |
| 1059 | package.json:248-250 OpenTelemetry 五个不同 0.x/2.x/1.x 通道并存，sdk-node 0.218 与 exporter 0.214 API 漂移 | `todo` | 待修复 |
| 1060 | package.json:5 private:true 同时声明 files/prepack，发布意图不明 | `todo` | 待修复 |
| 1061 | package.json:7-9 engines.node 无 engineStrict/.npmrc engine-strict，Node 20/24 安装静默成功 | `todo` | 待修复 |
| 1062 | package.json:55 prepare 用 .catch(()=>undefined) 吞掉所有 husky bootstrap 错误 | `todo` | 待修复 |
| 1063 | package.json:165-166 AA_PRESERVE_DIST=0 紧接 AA_PRESERVE_DIST=1 同行声明，shell 后者覆盖前者 | `todo` | 待修复 |
| 1064 | tsconfig.coverage-curated.json 1769 行手维护 1700+ 文件 exclude，无自动生成 | `todo` | 待修复 |
| 1065 | tsconfig.build-test.json 被 tsconfig.coverage-curated.json:2 extends，与"死配置"判定矛盾 | `todo` | 待修复 |
| 1066 | tsconfig.scripts.json:11 含 eslint.config.js 不含 stryker.config.mjs，处理不一致 | `todo` | 待修复 |
| 1067 | package.json bin/exports 字段未与 dist 实际产物比对 | `todo` | 待修复 |
| 1068 | package.json 多个脚本前缀 npm run build，本地连续运行重复 tsc 浪费 | `todo` | 待修复 |
| 1069 | package.json 依赖 @prettier/plugin-xml 但仓库无 .xml/.svg，死依赖 | `todo` | 待修复 |
| 1070 | package.json prepare:"npm run build" 在 npm install 时强制构建 | `todo` | 待修复 |
| 1071 | package.json engines.node 与 .nvmrc 双源真相未交叉校验 | `todo` | 待修复 |
| 1072 | tsconfig.json lib:["ES2023","WebWorker"] 拉入 WebWorker 类型 | `todo` | 待修复 |
| 1073 | tsconfig.json paths 与 package.json exports 双源 runtime/编译时 resolve 不一致 | `todo` | 待修复 |
| 1074 | tsconfig.scripts.json 与 tsconfig.build.json allowImportingTsExtensions 不一致 | `todo` | 待修复 |
| 1075 | tsconfig.scripts.json:11 include 列表硬编码文件，新增 .mjs 须手工同步 | `todo` | 待修复 |
| 1076 | eslint.config.js 未配置 *.tsx/*.cjs 规则集 | `todo` | 待修复 |
| 1077 | eslint.config.js 未声明 parserOptions.project，type-aware 规则全静默 no-op | `todo` | 待修复 |
| 1078 | eslint.config.js ignores 未含 coverage-report/.dr-reports/dist-types | `todo` | 待修复 |

## src/sdk (CLI & SDK)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1079 | src/sdk/cli/pack-publish.ts 默认 registry URL 为不存在的 api.platform.example.com | `todo` | 待修复 |
| 1080 | src/sdk/harness-sdk/index.ts 5 处 @ts-expect-error 抑制类型检查 | `todo` | 待修复 |
| 1081 | harness-sdk/index.ts:724,737-739 setTimeout 无 unref；空 catch 后仍触发 onTimeout 无错误上下文 | `todo` | 待修复 |
| 1082 | src/sdk/cli/aa.ts 顶层 main() 在 npm bin 软链/Windows process.argv[1] 不一致时 import 即触发 dispatcher | `todo` | 待修复 |
| 1083 | src/sdk/cli/dlq-manager.ts:112 --limit=abc parseInt→NaN 经 Math.min/Max 仍 NaN，拼到 SQL 抛 SQLite 错误而非校验拒绝 | `todo` | 待修复 |
| 1084 | src/sdk/cli/dlq-manager.ts:32,104 retryLimit 字段定义且解析，但所有 action 写死 LIMIT 100，flag 静默被忽略 | `todo` | 待修复 |
| 1085 | src/sdk/cli/dlq-manager.ts:209 UPDATE … ORDER BY … LIMIT 仅在 SQLite SQLITE_ENABLE_UPDATE_DELETE_LIMIT 启用时合法，与 PG 不兼容 | `todo` | 待修复 |
| 1086 | src/sdk/cli/dlq-manager.ts:228 confirmFlag!=="yes" 大小写敏感，AA_DLQ_PURGE_CONFIRM=YES 静默拒绝 | `todo` | 待修复 |
| 1087 | src/sdk/cli/dlq-manager.ts:229,277 双层确认（--yes+env）拒绝路径文案相同，无法区分 missing-flag vs missing-env | `todo` | 待修复 |
| 1088 | src/sdk/cli/dlq-manager.ts:286 storage.close() 经 {...storage,close} 浅展开后类方法身份丢失，可能不真正关闭句柄 | `todo` | 待修复 |
| 1089 | src/sdk/cli/dlq-manager.ts:290 入口判断未复用仓库内 isCliEntryPoint，npm bin/symlink 失效 | `todo` | 待修复 |
| 1090 | src/sdk/cli/secret-commands.ts:53 env.AA_SECRET_AUTH_TOKEN_PATH ?? join(home,...,"secret-auth-token") 未 realpath 校验，软链可重定向 | `todo` | 待修复 |
| 1091 | src/sdk/cli/secret-commands.ts:113 token 比对 sha256 直接 hex 无 salt，哈希文件泄漏可走彩虹表 | `todo` | 待修复 |
| 1092 | src/sdk/cli/secret-commands.ts:116 left.length===right.length && timingSafeEqual 文件被改成不同长度时泄漏长度差 | `todo` | 待修复 |
| 1093 | src/sdk/cli/secret-commands.ts:128-129 mkdirSync({mode:0o700}) 仅对 leaf 生效；writeFileSync({mode:0o600}) 文件已存在不更新 mode | `todo` | 待修复 |
| 1094 | src/sdk/cli/secret-commands.ts:162 generate-token action 不调 requireAuthToken，任何 CLI 用户可覆盖 token 哈希实现身份升级 | `todo` | 待修复 |
| 1095 | src/sdk/cli/secret-commands.ts:168 生成 token 经 JSON.stringify(result,null,2) 打印 stdout，重定向日志即明文留存 | `todo` | 待修复 |
| 1096 | src/sdk/cli/secret-commands.ts:219 writeFileSync(outputPath, secretValue) 不检查目标是否软链，TOCTOU 可写任意路径 | `todo` | 待修复 |
| 1097 | src/sdk/cli/secret-commands.ts:232,244,256 describe/leases/summary 均未要求认证，元数据泄漏 | `todo` | 待修复 |
| 1098 | src/sdk/cli/secret-commands.ts:305 错误响应用 error.constructor.name 作 errorCode，泄漏内部类名（如 BetterSqliteError） | `todo` | 待修复 |
| 1099 | src/sdk/cli/migrate-sqlite-to-pg.ts 校验阶段对 SQLite 大表 SELECT * 全量加载入 JS 内存，OOM | `todo` | 待修复 |
| 1100 | src/sdk/cli/api-server.ts 启动后未注册 SIGTERM/SIGINT graceful 关闭 | `todo` | 待修复 |
| 1101 | src/sdk/cli/inspect.ts JSON.stringify(snapshot) 对大 snapshot 无截断/流式输出，超出 stdout 高水位丢字段 | `todo` | 待修复 |
| 1102 | src/sdk/cli/skill-creator.ts 模板渲染字符串拼接而非转义，skill name 含反引号/${...} 时被当模板代码执行 | `todo` | 待修复 |
| 1103 | src/sdk/cli/pack-publish.ts publish 重试无指数退避，连续失败放大 marketplace 限流封禁 | `todo` | 待修复 |
| 1104 | src/sdk/cli/release-pipeline.ts rollback 路径仅记录 audit log，不实触发版本回滚 RPC，命名误导 | `todo` | 待修复 |
| 1105 | src/sdk/cli/login.ts 接受 AA_LOGIN_TOKEN env 但成功后未清空 process.env，子进程继承 token | `todo` | 待修复 |
| 1106 | src/sdk/cli/cli-exit.ts process.exit(code) 直接调用绕过 unhandled-promise drain，CI 中尾随日志可能丢失 | `todo` | 待修复 |
| 1107 | src/sdk/cli/authoritative-storage.ts 工厂返回 {...storage, close:closeOnce} 浅拷贝丢失 class 原型链，instanceof AuthoritativeStorage 永远 false | `todo` | 待修复 |
| 1108 | src/sdk/index.ts & admin-sdk/index.ts & harness-sdk/index.ts 三公共入口同时 export *，新增类即视作 public API，违反 SDK 收敛 | `todo` | 待修复 |
| 1109 | src/sdk/cli/aa.ts (top of file main() invocation): CLI 入口未使用 isCliEntryPoint 守卫，对 npm bin 软链/Windows 路径 process.argv[1] 不一致；any import-time side effect runs the dispatcher. EN: top-level main() runs at module import on platforms where the symlink path differs, breaking library reuse. | `todo` | 待修复 |
| 1110 | src/sdk/cli/dlq-manager.ts:112 Math.max(1, Math.min(500, parseInt(String(values.limit ?? "50"),10))) 当 --limit=abc 时 parseInt→NaN→Math.min/Max 全部 NaN，最终拼接到 SQL 抛 SQLite 错误而非友好校验。EN: NaN propagation injects literal NaN into LIMIT, causing opaque SQL error instead of structured rejection. | `todo` | 待修复 |
| 1111 | src/sdk/cli/dlq-manager.ts:32,104 retryLimit 字段在接口定义且解析，但所有 action handler 中未使用（200 行 retryDeadLetters 写死 LIMIT 100）。EN: --retry-limit flag is silently ignored; users believe it works. | `todo` | 待修复 |
| 1112 | src/sdk/cli/dlq-manager.ts:209 UPDATE … ORDER BY updated_at ASC LIMIT 100 仅在 SQLite 编译启用 SQLITE_ENABLE_UPDATE_DELETE_LIMIT 时合法；与 PG 后端不兼容，违反 storage abstraction. EN: portability bug across SQLite/Postgres adapters. | `todo` | 待修复 |
| 1113 | src/sdk/cli/dlq-manager.ts:228 confirmFlag !== "yes" 大小写敏感；AA_DLQ_PURGE_CONFIRM=YES 静默拒绝，错误信息却暗示已设置。EN: case-sensitive env confirm rejects valid affirmative values. | `todo` | 待修复 |
| 1114 | src/sdk/cli/dlq-manager.ts:229,277 双层确认（--yes 与 env）但拒绝路径返回相同 dry-run 文案，无法区分 missing-flag vs missing-env，运维难排查。EN: confusing duplicate dry-run message. | `todo` | 待修复 |
| 1115 | src/sdk/cli/dlq-manager.ts:286 storage.close() 调用，但 authoritative-storage 工厂返回 {...storage, close} 浅展开对象（见既有审计），class 方法身份丢失，close 可能不真正关闭句柄。EN: spread-shim breaks instance identity, close may be a no-op. | `todo` | 待修复 |
| 1116 | src/sdk/cli/dlq-manager.ts:290 入口判断使用 import.meta.url === pathToFileURL(process.argv[1]).href，未复用仓库内 isCliEntryPoint helper；npm bin/symlink 场景失效。EN: same Windows symlink defect as round 4 #1. | `todo` | 待修复 |
| 1117 | src/sdk/cli/secret-commands.ts:53 env.AA_SECRET_AUTH_TOKEN_PATH ?? join(home, ".automatic-agent", "secret-auth-token") 未做 realpath 校验；符号链接可重定向 token 哈希读路径。EN: symlink redirection on token-hash path. | `todo` | 待修复 |
| 1118 | src/sdk/cli/secret-commands.ts:113 token 比对用 sha256(token) 直接 hex，无 salt；若哈希文件泄漏可走彩虹表。EN: unsalted hash vulnerable to offline dictionary attack. | `todo` | 待修复 |
| 1119 | src/sdk/cli/secret-commands.ts:116 left.length === right.length && timingSafeEqual 长度提前返回非常量时；当文件被篡改成不同长度时泄漏长度差。EN: length-prefix early-exit leaks information. | `todo` | 待修复 |
| 1120 | src/sdk/cli/secret-commands.ts:128-129 mkdirSync(..., {mode:0o700}) 仅对 leaf 创建生效；既有父目录权限保留；writeFileSync(...,{mode:0o600}) 文件已存在时不更新 mode，旧 0o644 token 文件保持宽松权限。EN: mode-on-create only, not on overwrite. | `todo` | 待修复 |
| 1121 | src/sdk/cli/secret-commands.ts:162 generate-token action 不调用 requireAuthToken，任何 CLI 用户可覆盖 token 哈希文件，实现身份升级。EN: token regeneration is unauthenticated, allowing privilege escalation. | `todo` | 待修复 |
| 1122 | src/sdk/cli/secret-commands.ts:168 生成的 token 通过 JSON.stringify(result,null,2) 打印至 stdout；若 stdout 重定向到日志，明文 token 永久留存。EN: secret printed to stdout without redaction. | `todo` | 待修复 |
| 1123 | src/sdk/cli/secret-commands.ts:219 writeFileSync(outputPath, secretValue) 不检查目标是否软链，符号链接 TOCTOU 可让 secret 写入 /etc/passwd 等任意路径。EN: secret-write symlink traversal. | `todo` | 待修复 |
| 1124 | src/sdk/cli/secret-commands.ts:232,244,256 describe/leases/summary action 均未要求认证，元数据（secretRef、ttl、owner、leaseHolder）泄漏。EN: metadata-only endpoints leak sensitive operational info without auth. | `todo` | 待修复 |
| 1125 | src/sdk/cli/secret-commands.ts:305 错误响应使用 error.constructor.name 作为 errorCode，泄漏内部类名（如 BetterSqliteError），违反错误抽象。EN: internal class name leaks via error code. | `todo` | 待修复 |
| 1126 | src/sdk/cli/migrate-sqlite-to-pg.ts 校验阶段对 SQLite 大表 SELECT * 全量加载入 JS 内存，无分页；OOM 风险. EN: full-table read into memory during migration. | `todo` | 待修复 |
| 1127 | src/sdk/cli/api-server.ts 启动后未注册 SIGTERM/SIGINT graceful 关闭，容器停机会丢请求中数据. EN: missing signal handlers. | `todo` | 待修复 |
| 1128 | src/sdk/cli/inspect.ts 输出 JSON 直接 JSON.stringify(snapshot)，对大 snapshot 无截断与流式输出，超出 stdout 高水位时丢字段. EN: blocking stringify for large snapshots. | `todo` | 待修复 |
| 1129 | src/sdk/cli/skill-creator.ts 模板渲染使用字符串拼接而非转义；用户提供 skill name 含反引号/${...} 时被当模板代码执行（写入文件并由后续模块 require）. EN: template injection via skill name. | `todo` | 待修复 |
| 1130 | src/sdk/cli/pack-publish.ts example.com 存在缺省 registry 占位（既有审计 #3）；本轮新发现 publish 重试无指数退避，连续失败放大 marketplace 限流封禁概率. EN: missing exponential backoff in publish retry. | `todo` | 待修复 |
| 1131 | src/sdk/cli/release-pipeline.ts rollback 路径仅记录 audit log，不实际触发版本回滚 RPC，命名误导运维. EN: rollback action only logs, no rollback effect. | `todo` | 待修复 |
| 1132 | src/sdk/cli/login.ts 接受 AA_LOGIN_TOKEN env 但未在成功后清空 process.env，子进程继承 token. EN: token leaks via inherited environment. | `todo` | 待修复 |
| 1133 | src/sdk/cli/cli-exit.ts process.exit(code) 直接调用绕过 unhandled-promise drain，CI 中尾随日志可能丢失. EN: hard exit drops trailing log writes. | `todo` | 待修复 |
| 1134 | src/sdk/cli/authoritative-storage.ts 工厂函数返回 {...storage, close: closeOnce} 浅拷贝丢失 class 原型链，调用 instanceof AuthoritativeStorage 永远 false，下游 instanceof 守卫失效. EN: spread-shim breaks instanceof checks. | `todo` | 待修复 |
| 1135 | src/sdk/index.ts & src/sdk/admin-sdk/index.ts & src/sdk/harness-sdk/index.ts 三个公共入口同时 export *，未做 semver-stable 表面控制；新增类即视作 public API，违反 SDK 收敛策略. EN: barrel export leaks unstable surface. | `todo` | 待修复 |

## src/plugins

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1136 | src/plugins/adapters/*-adapter.ts 硬编码第三方平台 URL，未注册 outbound-url-policy | `todo` | 待修复 |
| 1137 | plugins/adapters/index.ts:1-5 不导出 credential-hygiene.ts | `todo` | 待修复 |
| 1138 | plugins/adapters/github-adapter.ts:37、plugin-sdk/plugin-definition.ts:299 双导出 verifyPluginSignature 签名不一致 | `todo` | 待修复 |
| 1139 | plugins/adapters/github-adapter.ts:278-289 适配器从不发 HTTP，返回端点+payload 描述符（伪集成） | `todo` | 待修复 |
| 1140 | src/plugins/builtin-plugin-registry.ts BundleRevocationSeverity 枚举与 org-governance severity 取值并存两套 | `todo` | 待修复 |
| 1141 | src/plugins/builtin-plugin-registry.ts isRevoked()/getActiveRevocation() 未到 effectiveAt 时返已撤销，截止时间语义反向 | `todo` | 待修复 |
| 1142 | src/plugins/builtin-plugin-registry.ts authenticate() 仅检查 apiKey 非空字符串即通过，无密钥强度/格式校验 | `todo` | 待修复 |
| 1143 | src/plugins/builtin-plugin-registry.ts sessions Set 无 TTL/过期清理 | `todo` | 待修复 |
| 1144 | src/plugins/builtin-plugin-registry.ts normalizeManifest() 仅 @platform/→@automatic-agent/ 字符串替换，遗 @aa-platform/ 等历史命名 | `todo` | 待修复 |
| 1145 | src/plugins/builtin-plugin-registry.ts outputDataClass 字段定义但所有 builtin manifests 均未填，死字段 | `todo` | 待修复 |
| 1146 | src/plugins/builtin-plugin-registry.ts globalMarketplaceRegistry/pluginRevocations/BundleRevocationRegistry 三单例，resetBuiltinPluginRegistryStateForTests 仅重置其一 | `todo` | 待修复 |
| 1147 | src/plugins/builtin-plugin-registry.ts allowedExternalDomains:[] 与 allowNetworkEgress:true 同时出现，组合语义未规范 | `todo` | 待修复 |
| 1148 | src/plugins/adapters/crm-adapter.ts:~30 默认 baseUrl=api.hubspot.com 与 crmType 无关，Salesforce 配置遗漏即指向 HubSpot | `todo` | 待修复 |
| 1149 | src/plugins/adapters/crm-adapter.ts 路径硬编码 /crm/v3/objects/，Salesforce 路径根本不可用 | `todo` | 待修复 |
| 1150 | src/plugins/adapters/crm-adapter.ts:136,143 把原始 action 而非 normalizedAction 用于 URL/handler 选择，alias 失效 | `todo` | 待修复 |
| 1151 | src/plugins/adapters/crm-adapter.ts ACTION_ALIASES 全局共享非按 crmType 分组，HubSpot alias 在 Salesforce 同样生效 | `todo` | 待修复 |
| 1152 | src/plugins/adapters/crm-adapter.ts fetch(...) 无 AbortSignal/timeout、无响应大小上限 | `todo` | 待修复 |
| 1153 | src/plugins/adapters/credential-hygiene.ts bytes.toString("utf8") 把秘密入不可零化字符串，破坏 zeroize | `todo` | 待修复 |
| 1154 | src/plugins/adapters/credential-hygiene.ts 指纹截断到 12 hex (~48 bit)，同租户大量凭据下生日攻击碰撞概率非可忽略 | `todo` | 待修复 |
| 1155 | src/plugins/adapters/livestream-adapter.ts healthCheck() credentialFingerprint===null 时永返 unhealthy；初始化顺序无保证 | `todo` | 待修复 |
| 1156 | src/plugins/index.ts 顶部 export * 把 builtin-plugin-registry 全部内部类公开 | `todo` | 待修复 |
| 1157 | src/plugins/builtin-plugin-registry.ts BundleRevocationSeverity 枚举与 org-governance 中的 severity 取值并存两套（critical/high/medium/low vs Critical/Major/Minor），事件桥接需手工映射。EN: dual revocation severity taxonomies. | `todo` | 待修复 |
| 1158 | src/plugins/builtin-plugin-registry.ts isRevoked() / getActiveRevocation() 截止时间语义反向：未到 effectiveAt 时返回 already-revoked，违反吊销契约。EN: deadline semantics inverted on activation window. | `todo` | 待修复 |
| 1159 | src/plugins/builtin-plugin-registry.ts authenticate() 仅检查 apiKey 非空字符串即通过，无密钥强度/格式校验。EN: trivial auth allows any non-empty key. | `todo` | 待修复 |
| 1160 | src/plugins/builtin-plugin-registry.ts sessions Set 无 TTL/过期清理；长期运行内存增长。EN: unbounded session set leaks memory. | `todo` | 待修复 |
| 1161 | src/plugins/builtin-plugin-registry.ts normalizeManifest() 仅做 @platform/→@automatic-agent/ 字符串替换，未处理嵌套 schema/字段；其它历史命名（如 @aa-platform/）未覆盖。EN: incomplete legacy-namespace migration. | `todo` | 待修复 |
| 1162 | src/plugins/builtin-plugin-registry.ts outputDataClass 字段定义但所有 builtin manifests 均未填，Set/Get 路径无人使用。EN: dead manifest field. | `todo` | 待修复 |
| 1163 | src/plugins/builtin-plugin-registry.ts globalMarketplaceRegistry / pluginRevocations / BundleRevocationRegistry 三个模块级单例，resetBuiltinPluginRegistryStateForTests 仅重置其中一个，单测互相污染。EN: global singletons not all reset by test hook. | `todo` | 待修复 |
| 1164 | src/plugins/builtin-plugin-registry.ts allowedExternalDomains: [] 与 allowNetworkEgress: true 同时出现，组合语义“放行所有域”还是“无放行”未规范化。EN: ambiguous network-egress contract. | `todo` | 待修复 |
| 1165 | src/plugins/adapters/crm-adapter.ts:~30 默认 baseUrl=api.hubspot.com 与 crmType 无关，Salesforce 配置遗漏 baseUrl 时仍指向 HubSpot. EN: default base URL ignores crmType discriminator. | `todo` | 待修复 |
| 1166 | src/plugins/adapters/crm-adapter.ts 路径硬编码 /crm/v3/objects/，Salesforce REST 路径为 /services/data/vXX.X/sobjects/，根本不可用. EN: HubSpot-specific path applied universally. | `todo` | 待修复 |
| 1167 | src/plugins/adapters/crm-adapter.ts:136,143 crmRequest(action,…) 把原始 action 而非 normalizedAction 用于 URL/handler 选择，alias 失效. EN: action alias resolution dropped before dispatch. | `todo` | 待修复 |
| 1168 | src/plugins/adapters/crm-adapter.ts ACTION_ALIASES 表全局共享而非按 crmType 分组，HubSpot 的 alias 在 Salesforce 上同样生效，污染语义. EN: aliases are not per-CRM. | `todo` | 待修复 |
| 1169 | src/plugins/adapters/crm-adapter.ts fetch(...) 调用无 AbortSignal/timeout、无响应大小上限；恶意/迟缓后端可悬挂 worker. EN: missing fetch timeout & response size cap. | `todo` | 待修复 |
| 1170 | src/plugins/adapters/credential-hygiene.ts bytes.toString("utf8") 把秘密写入不可零化的 JS 字符串，破坏后续 zeroize 承诺. EN: plaintext copied into immutable string defeats zeroize. | `todo` | 待修复 |
| 1171 | src/plugins/adapters/credential-hygiene.ts 指纹截断到 12 个 hex 字符（~48 bit），同租户大量凭据下生日攻击碰撞概率非可忽略. EN: fingerprint truncation collision risk. | `todo` | 待修复 |
| 1172 | src/plugins/adapters/livestream-adapter.ts healthCheck() 在 credentialFingerprint===null 时永远返回 unhealthy；初始化顺序未保证 fingerprint 先就绪. EN: health check unreachable until external init. | `todo` | 待修复 |
| 1173 | src/plugins/index.ts 顶部 export * 把 builtin-plugin-registry 全部内部类（如 BundleRevocationRegistry）公开，破坏封装. EN: barrel leaks internal classes. | `todo` | 待修复 |
| 1174 | plugin-runtime-child.ts 全局覆写 console.* 污染主进程 | `todo` | 待修复 |

## src/scale-ecosystem

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1175 | connector-runtime/index.ts:51、connector-framework-service.ts:453,472,486 运行时路径 process.stderr.write 直写 | `todo` | 待修复 |
| 1176 | connector-framework-service.ts:265-298,335 invokeCallback(...) 多处不 await/void，未处理 rejection | `todo` | 待修复 |
| 1177 | connector-framework-service.ts:494,501 writeFileSync(path, ...) 持久化 manifest 非原子，与 cdc-replication-service.ts:841 临时文件+rename 风格不一致 | `todo` | 待修复 |
| 1178 | cdc-replication-service.ts:804-806,817-819 空 catch 后 clearState()，错误 = 全量丢复制状态 | `todo` | 待修复 |
| 1179 | cdc-replication-service.ts:1074-1080 默认 batchSize/interval/retries/backoff 硬编码无 config 通路 | `todo` | 待修复 |
| 1180 | read-replica-service.ts:318,326,219,329 1000ms 滞后阈值与 100ms 轮询硬编码，日志用拼字符串 | `todo` | 待修复 |
| 1181 | scale-ecosystem/marketplace/*-{,async}.ts 20 个单行 export * shim 不被 marketplace barrel 暴露，仅深 import 使用 | `todo` | 待修复 |
| 1182 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts (region as RegionDescriptor & {capabilities?}) 类型断言，requiredCapabilities 策略对所有 region 视为缺能力，误降级 | `todo` | 待修复 |
| 1183 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts ReadConsistencyLevel/ReadRoutingMode 二次 as 断言绕过校验 | `todo` | 待修复 |
| 1184 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts preferredRegionId 在区域被排除时静默忽略，无 fallback 决策事件 | `todo` | 待修复 |
| 1185 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts failoverRegionId 兜底回退到已被排除的同名 region 形成路由环 | `todo` | 待修复 |
| 1186 | src/scale-ecosystem/multi-region/fencing-token-service.ts 模块级单例缺 reset API，并行测试令牌单调递增计数器互相污染 | `todo` | 待修复 |
| 1187 | src/scale-ecosystem/multi-region/split-brain-protection.ts 模块级 quorum Map 无 size 上限，多租户场景无限增长 | `todo` | 待修复 |
| 1188 | src/scale-ecosystem/multi-region/read-replica-service.ts 副本健康判定基于 lastHeartbeatAt<now-threshold，threshold 默认未文档化、时区天真 | `todo` | 待修复 |
| 1189 | src/scale-ecosystem/multi-region/cdc-replication-service.ts 模块级 CDC offset 缓存为单例，重连时未清 in-flight 批次，可重放 | `todo` | 待修复 |
| 1190 | src/scale-ecosystem/marketplace/ globalMarketplaceRegistry 单例无 reset hook，单测之间发布的 bundle 互相可见 | `todo` | 待修复 |
| 1191 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts (region as RegionDescriptor & {capabilities?}) 类型断言；带 requiredCapabilities 的策略对所有 region 一律视为缺能力，触发误降级. EN: type cast hides missing capabilities, mis-evaluates routing. | `todo` | 待修复 |
| 1192 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts ReadConsistencyLevel/ReadRoutingMode 通过 as 二次断言绕过校验，配置错误值不被拒绝. EN: enum laundering bypasses validation. | `todo` | 待修复 |
| 1193 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts preferredRegionId 在区域被排除时静默忽略，未发出 fallback 决策事件，运维盲区. EN: silent preference drop, no audit event. | `todo` | 待修复 |
| 1194 | src/scale-ecosystem/multi-region/cross-region-routing-service.ts failoverRegionId 兜底逻辑会回退到已被排除的同名 region，形成路由环. EN: failover may select an already-excluded region. | `todo` | 待修复 |
| 1195 | src/scale-ecosystem/multi-region/fencing-token-service.ts 模块级单例，registerForTest/reset API 缺失；并行测试令牌单调递增计数器互相污染. EN: global counter not test-isolated. | `todo` | 待修复 |
| 1196 | src/scale-ecosystem/multi-region/split-brain-protection.ts 模块级 quorum 表用 Map，没有 size 上限；多租户场景下表无限增长. EN: unbounded quorum map. | `todo` | 待修复 |
| 1197 | src/scale-ecosystem/multi-region/read-replica-service.ts 副本健康判定基于 lastHeartbeatAt < now - threshold 但 threshold 默认值未在 config 文档中固化，多 region 时区差导致误判. EN: heartbeat threshold default undocumented and timezone-naive. | `todo` | 待修复 |
| 1198 | src/scale-ecosystem/multi-region/cdc-replication-service.ts 模块级 CDC offset 缓存为单例，重连时未清理 in-flight 批次，重启后可能重放. EN: singleton CDC cache replays on reconnect. | `todo` | 待修复 |
| 1199 | src/scale-ecosystem/marketplace/ 内的 globalMarketplaceRegistry 单例无 reset hook，单测之间发布的 bundle 互相可见. EN: marketplace registry not test-isolated. | `todo` | 待修复 |
| 1200 | region-health-check-service.ts fetch 未透传 AbortSignal | `todo` | 待修复 |

## src/ops-maturity (drift, explainability, platform-ops)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1201 | locking-support.ts:12、postgres/pg-database.ts:353、redis-queue-adapter.ts:266、rule-engine.ts:399、human-takeover-service-async.ts:320、evolution-mvp-service-async.ts 等 ESM 模块内裸 require()，加载即抛 ReferenceError | `todo` | 待修复 |
| 1202 | evolution-mvp-service-async.ts 用 undefined as unknown as ApprovalService/MemoryService 构造，首次调用即 NPE | `todo` | 待修复 |
| 1203 | edge-runtime-sync-service.ts:120,138,203、video-processor/index.ts:319、self-healing-service.ts:327、semver-validator.ts:234、version-compatibility-matrix.ts:224、capacity-predictor/index.ts:61 数组/字段非空断言无前置守卫 | `todo` | 待修复 |
| 1204 | drift-detection/{benchmark-runner,evidence-store,promotion-gate,proposal-engine,reflection-engine,rollout-manager,rollout-repository}.ts 7 份单行 export * shim 重复 | `todo` | 待修复 |
| 1205 | drift-detection/index.ts:12-28 同时 re-export sibling 与 shim，barrel 重复符号导出 NodeNext 冲突 | `todo` | 待修复 |
| 1206 | drift-detection/evolution-mvp-service.ts:5 服务文件顶部 export * from "./evolution-mvp-support.js" 把内部 helper 全部公开 | `todo` | 待修复 |
| 1207 | drift-detection/evolution-mvp-service.ts:97-114 EvolutionProposalRecord.id 与幂等键都用 newId()，无 caller 幂等 token，双击双提案 | `todo` | 待修复 |
| 1208 | drift-detection/evolution-mvp-service.ts:130-608 4 个近相同 ~28 行 event.insertEvent(...) 块，schema 改动需 4 处同步 | `todo` | 待修复 |
| 1209 | drift-detection/evolution-mvp-service.ts:182,431 minQualityScore:0.65、confidence:0.8 魔术阈值 | `todo` | 待修复 |
| 1210 | drift-detection/evolution-mvp-service.ts:464-516 applyProposal 不校验 appliedAt 单调，乱序时间戳污染审计 | `todo` | 待修复 |
| 1211 | drift-detection/evolution-mvp-service.ts:662-665 JSON.parse(approvalRecord.requestJson) as ApprovalRequest 无 schema | `todo` | 待修复 |
| 1212 | drift-detection/evolution-integration-service.ts:74 默认 new InMemoryEvidenceStore()，重启即丢失证据 | `todo` | 待修复 |
| 1213 | drift-detection/evolution-integration-service.ts:46,136 enableAutomaticProposal:true 死配置；confidence:0.7 忽略上层 proposalConfidenceThreshold | `todo` | 待修复 |
| 1214 | drift-detection/evolution-integration-service.ts:268 rootCause.slice(0,50) 截断可能切坏多字节字符 | `todo` | 待修复 |
| 1215 | drift-detection/drift-detector-service.ts:48-87 16 个魔术阈值无 contract 链接 | `todo` | 待修复 |
| 1216 | drift-detection/drift-detector-service.ts:80-87 fingerprintWindowToDriftWindow 把 30d/90d 折叠为 7d，alert 路由错位 | `todo` | 待修复 |
| 1217 | drift-detection/drift-detector-service.ts:164-273,298-323 多处 split(":")[index] + includes("input/output/cusum/bayesian") 启发式分类 | `todo` | 待修复 |
| 1218 | drift-detection/drift-detector-service.ts:363-407 Jaccard 相似度无长度归一/权重；safeHashEquals 双 Buffer 分配无收益 | `todo` | 待修复 |
| 1219 | platform-ops-agent/platform-ops-agent-service.ts:102 proposals = new Map 无持久化/驱逐/上限 | `todo` | 待修复 |
| 1220 | platform-ops-agent/platform-ops-agent-service.ts:174-193,200-260 execute() 实为 receipt 占位；approval 可绕过 autonomy_limit_reached；>=0.05/0.2/200 魔术阈值无 config | `todo` | 待修复 |
| 1221 | platform-ops-agent/self-healing-service.ts:138-167 simulateHealthCheck 用字符串长度推算 recoveryTimeMs | `todo` | 待修复 |
| 1222 | platform-ops-agent/self-healing-service.ts:174-220 冷却查询 find(...) 返回最旧记录；computeCooldownMs 无上限可被拉至天级阻塞合法操作 | `todo` | 待修复 |
| 1223 | platform-ops-agent/self-healing-service.ts:75-95 executionId==null 事件被静默丢弃，冷却阻塞类事件审计断链 | `todo` | 待修复 |
| 1224 | platform-ops-agent/self-healing-service.ts:85 taskId: harnessRunId ?? executionId 把 harness id 写入 task_id 列，跨表 join 别名 | `todo` | 待修复 |
| 1225 | src/ops-maturity/explainability/explanation-pipeline-service.ts 解释结果缓存 string key (subjectId+timestamp) 未截断颗粒度，命中率近 0 | `todo` | 待修复 |
| 1226 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:196 lastAlertSampleIndex 实例可变状态，detect() 并发产生 race | `todo` | 待修复 |
| 1227 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:218 detectAll 默认 windowTypes 仅 1h/6h/24h/7d，遗 30d/90d | `todo` | 待修复 |
| 1228 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:240 Math.floor(baselineWindowOrWindows as number) 接受负数后 Math.max(1,…) 静默修正 | `todo` | 待修复 |
| 1229 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:244-245 baseline/recent 切片可重叠（短样本），baseline 含未来值污染统计 | `todo` | 待修复 |
| 1230 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:261-265 lastAlertSampleIndex 仅检测时刷新且不衰减，超长运行后抑制窗口失真 | `todo` | 待修复 |
| 1231 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:436,455,471,486 四算法均要求 recentMean<baselineMean，对 cost_spike/override_rate/incident_count 等"高于即恶化"指标无法触发 | `todo` | 待修复 |
| 1232 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:404,502 relativeShift=absoluteShift/baselineMean，baseline=0 永远 0，零基线指标无法检测漂移 | `todo` | 待修复 |
| 1233 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:469 贝叶斯后验魔术常数 0.05 无注释/文档 | `todo` | 待修复 |
| 1234 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:631 平坦分布 (max==min) 时 bucketize 返 [1,0,0,…]，两侧不同常数值的平坦分布 JS divergence=0 漏检 step shift | `todo` | 待修复 |
| 1235 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:638 bucketize 各自用本组 min/max，KL/JS 比较无几何意义 | `todo` | 待修复 |
| 1236 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:280,552 severityToAction low→observe，但 ops 文档要求 low→require_review，两套响应映射并存 | `todo` | 待修复 |
| 1237 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:350-352 aggregateResults ...selected 后覆盖 reasonCode，原 window reason 被丢失 | `todo` | 待修复 |
| 1238 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:313-314 planId=drift_plan:${type}:${id}:${ISOtimestamp} 含冒号，下游以 : 分段解析器错位 | `todo` | 待修复 |
| 1239 | src/ops-maturity/drift-detection/changepoint-detector/index.ts 整文件无 import；与同目录 drift-detector-service.ts/drift-detector.ts 各有独立 DriftWindowType 等定义，类型未单源 | `todo` | 待修复 |
| 1240 | src/ops-maturity/explainability/explanation-pipeline-service.ts 解释结果缓存使用 string key（subjectId+timestamp），未截断 timestamp 颗粒度，缓存命中率近 0. EN: cache key over-specified, defeats caching. | `todo` | 待修复 |
| 1241 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:196 lastAlertSampleIndex 实例可变状态，detect() 并发调用产生 race，suppression 决策不一致. EN: detector is not concurrency-safe. | `todo` | 待修复 |
| 1242 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:218 detectAll 默认 windowTypes 仅含 1h/6h/24h/7d，遗漏架构中规范化的 30d/90d. EN: defaults miss canonical long windows. | `todo` | 待修复 |
| 1243 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:240 Math.floor(baselineWindowOrWindows as number) 接受负数后被 Math.max(1,…) 静默修正，掩盖参数错误. EN: silent coercion of invalid baseline window. | `todo` | 待修复 |
| 1244 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:244-245 baseline 与 recent 切片可重叠（短样本时），baseline 含未来值污染统计. EN: overlapping baseline/recent slices. | `todo` | 待修复 |
| 1245 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:261-265 lastAlertSampleIndex 仅在检测时刷新且不衰减，超长运行后抑制窗口比较失真. EN: monotonic counter never decays, breaks suppression long-term. | `todo` | 待修复 |
| 1246 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:436,455,471,486 四种算法均要求 recentMean < baselineMean，对 cost_spike/override_rate/incident_count 等“高于即恶化”的指标无法触发. EN: one-direction-only detection misses upward-degradation metrics. | `todo` | 待修复 |
| 1247 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:404,502 relativeShift = absoluteShift / baselineMean，baseline 为 0 时永远 0，零基线指标无法检测漂移. EN: zero-baseline never triggers relative threshold. | `todo` | 待修复 |
| 1248 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:469 贝叶斯后验中魔术常数 0.05 无注释/文档；调参依据缺失. EN: undocumented magic constant in posterior. | `todo` | 待修复 |
| 1249 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:631 平坦分布 (max==min) 时 bucketize 返回 [1,0,0,…]，两侧不同常数值的平坦分布得 JS divergence=0，漏检 step shift. EN: degenerate flat-distribution handling masks shifts. | `todo` | 待修复 |
| 1250 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:638 bucketize 各自用本组 min/max 划桶，baseline 与 recent 不同 bin 边界，KL/JS 比较无几何意义. EN: histograms not on common support invalidates divergence. | `todo` | 待修复 |
| 1251 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:280,552 severityToAction 把 low → observe，但 ops 文档要求 low → require_review，两套响应映射并存. EN: severity→action mapping inconsistent with response policy. | `todo` | 待修复 |
| 1252 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:350-352 aggregateResults 用 ...selected 后覆盖 reasonCode，原 window 的 reason 被丢失，归因可观测性下降. EN: aggregation loses originating reason code. | `todo` | 待修复 |
| 1253 | src/ops-maturity/drift-detection/changepoint-detector/index.ts:313-314 planId = drift_plan:${type}:${id}:${ISOtimestamp} 含冒号，下游期望以 : 分段的解析器会错位. EN: planId delimiter collision with timestamp colons. | `todo` | 待修复 |
| 1254 | src/ops-maturity/drift-detection/changepoint-detector/index.ts 整文件无任何 import；与同目录 drift-detector-service.ts/drift-detector.ts 各有独立类型 DriftWindowType 等定义，类型未单源；外部使用易写错引用. EN: duplicated types across sibling drift modules. | `todo` | 待修复 |
| 1255 | explanation-pipeline-service.ts:153 用 @ts-expect-error 绕过 exactOptionalPropertyTypes | `todo` | 待修复 |
| 1256 | noisy-neighbor-protection.ts:227 类型与运行时数据形状不一致 | `todo` | 待修复 |

## src/domains & runtime catalog

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1257 | plugin-runtime-host.test.ts 覆盖 process.execArgv 未复原会污染后续 | `todo` | 待修复 |
| 1258 | plugin-runtime-host.ts:741-742 JSON.parse(env.AA_PLUGIN_RUNTIME_CONTAINER_COMMAND_JSON) 无 schema 即 spread 入 spawn，env 控制命令构造 | `todo` | 待修复 |
| 1259 | plugin-runtime-host.ts:364 把整个 process.env 传给 spawn 后再 filter，应改为显式白名单 | `todo` | 待修复 |
| 1260 | plugin-runtime-child.ts:14、plugin-runtime-host.ts:26、plugin-spi-registry.ts:21、safe-load-division-registry.ts:7、division-loader.ts:51、recipe-executor.ts:6、dashboard-websocket-server.ts:64、stores/index.ts:8、chinese-wall-access-saga.ts:39、evidence-collector.ts:62 模块顶层 new StructuredLogger(...) 创建单例，测试/生命周期隐患 | `todo` | 待修复 |
| 1261 | domains/index.ts:7-9 re-export ../domains-runtime-*.js 跨出 domains 树（边界倒置） | `todo` | 待修复 |
| 1262 | src/domains-runtime-catalog.ts WeakMap 缓存 keying registry，resetForTests() 不清 WeakMap，旧 registry 仍持 stale 编排 | `todo` | 待修复 |
| 1263 | src/domains-runtime-catalog.ts 调用 registerDomainsBootstrap() 未传 registry 参数，永远用全局 registry，scoped registry 被忽略 | `todo` | 待修复 |
| 1264 | src/domains-runtime-catalog.ts 顶部 import { DomainReadinessRing } 仅类型注释提及，运行时未用，死 import | `todo` | 待修复 |
| 1265 | src/domains-runtime-orchestrator.ts 默认构造内 ServiceRegistry.createScoped() 每实例新建作用域，跨实例共享状态丢失 | `todo` | 待修复 |
| 1266 | src/domains-runtime-orchestrator.ts this.startupPlan 在构造与 initialize 中重复赋值，第二次写入覆盖测试期 plan stub | `todo` | 待修复 |
| 1267 | src/domains-runtime-orchestrator.ts registry.get(SVC_ID) 返回值丢弃但调用为求副作用，依赖 registry 内部 lazy init | `todo` | 待修复 |
| 1268 | src/domains-startup-plan.ts rings 强制串行，与设计文档中并行 ring 启动表述矛盾 | `todo` | 待修复 |
| 1269 | src/domains/registry/domain-registry-service.ts register(domainId, manifest) 同 id 二次注册仅 warn-and-replace，无 idempotency token，并发竞态后写覆盖前写 | `todo` | 待修复 |
| 1270 | src/domains/registry/plugin-spi-registry.ts SPI 表用 plain object 而非 Map，**proto**/constructor 注入风险 | `todo` | 待修复 |
| 1271 | src/domains/registry/plugin-runtime-host.ts 主机进程未对 plugin unhandledRejection 隔离，单 plugin 故障污染主进程 | `todo` | 待修复 |
| 1272 | src/domains-runtime-catalog.ts WeakMap 缓存对 registry 实例 keying，但 resetForTests() 不清理 WeakMap，回收前的旧 registry 仍持有 stale 编排. EN: WeakMap cache survives test reset. | `todo` | 待修复 |
| 1273 | src/domains-runtime-catalog.ts 调用 registerDomainsBootstrap() 时未传 registry 参数，永远使用全局 registry，scoped registry 被忽略. EN: registry-scope arg missing. | `todo` | 待修复 |
| 1274 | src/domains-runtime-catalog.ts 顶部 import { DomainReadinessRing } 仅在类型注释中提及，运行时未使用，构成死 import 增加冷启动. EN: dead import. | `todo` | 待修复 |
| 1275 | src/domains-runtime-orchestrator.ts 默认构造内 ServiceRegistry.createScoped() 每实例新建作用域，跨实例共享状态丢失. EN: per-instance scope breaks shared registry. | `todo` | 待修复 |
| 1276 | src/domains-runtime-orchestrator.ts this.startupPlan 在构造与 initialize 中重复赋值，第二次写入覆盖测试期 plan stub. EN: redundant reassignment overwrites injected stub. | `todo` | 待修复 |
| 1277 | src/domains-runtime-orchestrator.ts registry.get(SVC_ID) 返回值被丢弃但调用为求副作用，依赖 registry 内部 lazy init；让阅读者误以为是 noop. EN: side-effect-only get(); intent unclear. | `todo` | 待修复 |
| 1278 | src/domains-startup-plan.ts rings 强制串行执行，与文档中并行 ring 启动表述矛盾. EN: serial rings contradict design doc. | `todo` | 待修复 |
| 1279 | src/domains/registry/plugin-spi-registry.ts SPI 表使用 plain object 而非 Map，原型链字段 **proto**/constructor 注入风险（若 domainId 来自配置文件）. EN: prototype-pollution via untrusted key. | `todo` | 待修复 |
| 1280 | src/domains/registry/plugin-runtime-host.ts 主机进程未对 plugin 抛出的 unhandledRejection 做隔离，单 plugin 故障污染主进程. EN: missing per-plugin rejection isolation. | `todo` | 待修复 |

## src/interaction (NL gateway)

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1281 | nl-gateway/index.ts:290 IntentParserPort 与 ModelIntentParserPort 不一致，未做适配 | `todo` | 待修复 |
| 1282 | proactive-agent/index.ts:167-168、conversation-history-service.ts:323-324,358-359、workflow-builder-service.ts:110-111,792-793、onboarding/index.ts:183-184、intent-parser/index.ts:206,291,301 多处空 catch 静默吞错并返回 null/false | `todo` | 待修复 |
| 1283 | src/interaction/nl-gateway/intent-parser/index.ts:66 关键词正则含 通行，匹配 通行证/通行规则 等非审批语境 | `todo` | 待修复 |
| 1284 | src/interaction/nl-gateway/intent-parser/index.ts:70 delete\|remove\|drop 无单词边界，dropdown/removed once 触发 task_modify | `todo` | 待修复 |
| 1285 | src/interaction/nl-gateway/intent-parser/index.ts:126-135 语种检测顺序使含 kanji 但无 kana 日文混排被识别 zh-CN，德语正则误命中 ä/ö 的瑞典语/芬兰语 | `todo` | 待修复 |
| 1286 | src/interaction/nl-gateway/intent-parser/index.ts:162 requestPatterns 英文动词无 \b，deploy 命中 redeployment | `todo` | 待修复 |
| 1287 | src/interaction/nl-gateway/intent-parser/index.ts:196 Array.isArray(parsed)?parsed.filter(Boolean):… 返 [null, valid] 时 primary 取原 index 1 元素行为依赖宿主 | `todo` | 待修复 |
| 1288 | src/interaction/nl-gateway/intent-parser/index.ts:282 JSON.parse(response) 对 LLM 返回 reasoning/language 字段无大小校验 | `todo` | 待修复 |
| 1289 | src/interaction/nl-gateway/intent-parser/index.ts:44-52 INTENT_CONFIDENCE_THRESHOLDS 与 IntentConfidenceThresholds 双导出，公共 API 同义双命名易漂移 | `todo` | 待修复 |
| 1290 | src/interaction/nl-gateway/intent-parser/index.ts:66 关键词正则含 通行，会匹配 通行证/通行规则 等非审批语境，造成误分类. EN: substring approval-keyword false positive. | `todo` | 待修复 |
| 1291 | src/interaction/nl-gateway/intent-parser/index.ts:70 delete\|remove\|drop 无单词边界，dropdown / removed once 触发 task_modify. EN: missing word boundary causes false positive. | `todo` | 待修复 |
| 1292 | src/interaction/nl-gateway/intent-parser/index.ts:126-135 语种检测顺序使依赖 kanji 但无 kana 的日文混排消息被识别为 zh-CN；德语正则误命中含 ä/ö 的瑞典语/芬兰语. EN: language-detection order and German regex over-broad. | `todo` | 待修复 |
| 1293 | src/interaction/nl-gateway/intent-parser/index.ts:162 requestPatterns 英文动词无 \b，deploy 命中 redeployment，状态消息被误判为 task_create. EN: word-boundary missing on English request verbs. | `todo` | 待修复 |
| 1294 | src/interaction/nl-gateway/intent-parser/index.ts:196 Array.isArray(parsed) ? parsed.filter(Boolean) : … 类型不安全；返回 [null, valid] 时 primary 取到原 index 1 元素行为依赖宿主实现细节. EN: filter(Boolean) typing escape. | `todo` | 待修复 |
| 1295 | src/interaction/nl-gateway/intent-parser/index.ts:282 JSON.parse(response) 对 LLM 返回的 reasoning/language 字段无大小校验，恶意/异常长返回会无限存储. EN: unbounded LLM response field accepted. | `todo` | 待修复 |
| 1296 | src/interaction/nl-gateway/intent-parser/index.ts:44-52 INTENT_CONFIDENCE_THRESHOLDS (SCREAMING_SNAKE) 与 IntentConfidenceThresholds interface (camelCase) 双导出，公共 API 同义双命名易漂移. EN: parallel public-API taxonomies. | `todo` | 待修复 |

## src/org-governance

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1297 | src/org-governance/approval-routing/approval-routing-service.ts 状态机允许 approved → withdrawn 直接转换，跳过审计 revoked 中间态 | `todo` | 待修复 |
| 1298 | src/apps/api/index.ts:10 vs src/apps/workers/index.ts:10 requiredLayers 未覆盖 interaction/org-governance，但 worker dispatch 调 approval-routing | `todo` | 待修复 |
| 1299 | src/org-governance/approval-routing/approval-routing-service.ts 状态机允许 approved → withdrawn 直接转换，跳过审计 revoked 中间态，与契约文档不符. EN: missing intermediate state in approval FSM. | `todo` | 待修复 |
| 1300 | src/apps/api/index.ts:10 vs src/apps/workers/index.ts:10 requiredLayers 列表未覆盖 interaction/org-governance，但 worker 在 dispatch 中调 approval-routing，声明与运行时依赖不一致. EN: declared layers diverge from runtime imports. | `todo` | 待修复 |
| 1301 | org-governance/index.ts:1-9 barrel 缺 org-routing/ | `todo` | 待修复 |

## src/core & runtime

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1302 | src/core/runtime/index.ts:18 占位常量 WorkflowStepCheckpoint 与同文件 re-export 的同名 interface 冲突，且存在 ambiguous export * | `todo` | 待修复 |
| 1303 | src/runtime/agent-runtime/index.ts 兼容 shim 死代码（未暴露、零引用） | `todo` | 待修复 |
| 1304 | src/core/runtime/index.ts WorkflowStepCheckpoint 在 export * 中已暴露 class，又追加 export type WorkflowStepCheckpoint=string，name collision | `todo` | 待修复 |
| 1305 | src/runtime/agent-runtime/index.ts:9-15 export * 自 7 platform 文件，叠加 L18-32 具名 type re-export，LlmModelCallRequest/ContextCompactionOptions 同名重复声明歧义 | `todo` | 待修复 |
| 1306 | src/core/runtime/index.ts 同时含本地 type alias 与 re-export 同名，round-tripping 后 typecheck 漂移 | `todo` | 待修复 |
| 1307 | src/core/runtime/index.ts WorkflowStepCheckpoint 在 export * re-export 中已暴露为 class，又在本文件追加 export type WorkflowStepCheckpoint = string，造成同名 class/type 冲突. EN: name collision via re-export. | `todo` | 待修复 |
| 1308 | src/runtime/agent-runtime/index.ts:9-15 export * 自 7 个 platform 文件，叠加 L18-32 的具名 type re-export，存在歧义 re-export（LlmModelCallRequest/ContextCompactionOptions 同名重复声明）. EN: ambiguous re-export from barrel. | `todo` | 待修复 |
| 1309 | src/core/runtime/index.ts 文件即纯 barrel，但同时声明本地 type alias 与 re-export 同名导致 round-tripping 后 typecheck 漂移（既有审计 #1 的延伸：本轮还观察到 WorkflowStepCheckpoint 的 type/class 双重身份）. EN: barrel layering produces conflicting symbol kinds. | `todo` | 待修复 |

## src/apps & entry

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1310 | src/index.ts 模块级 new StructuredLogger({retentionLimit:100}) 每次 import 构造，retention 缓冲随测试 suite 数线性增长 | `todo` | 待修复 |
| 1311 | src/index.ts redactStartupErrorMessage() 仅匹配少量正则，遗漏 Authorization: Basic …/Bearer …/"token":"…"/JWT 三段式 | `todo` | 待修复 |
| 1312 | src/index.ts 入口判断 import.meta.url===pathToFileURL(resolve(scriptPath)).href 对 npm bin 软链失效，与仓库其他 isCliEntryPoint 不一致 | `todo` | 待修复 |
| 1313 | src/index.ts 步骤名硬编码 "x1-fabric" 字符串比较，编排步骤改名时无类型保护 | `todo` | 待修复 |
| 1314 | src/index.ts 失败路径 process.exitCode=1 但未 unref 已开资源，进程卡住等 event loop 排空 | `todo` | 待修复 |
| 1315 | src/apps/index.ts:16 Object.freeze(PLATFORM_APPS) 仅冻结外层，每 manifest requiredLayers 数组可变 | `todo` | 待修复 |
| 1316 | src/apps/index.ts:35 resolvePlatformAppManifest("summary"\|"demo") 永返 null（这两值是 startupTargetKind 而非 appKind/appId），易混淆 | `todo` | 待修复 |
| 1317 | src/apps/api/index.ts:6 & src/apps/workers/index.ts:6 entryModule 为字符串路径，文件移动后无编译期 link，manifest 静默失效 | `todo` | 待修复 |
| 1318 | src/index.ts 模块级 new StructuredLogger({retentionLimit:100}) 在每次 import 时构造，retention 缓冲随测试 suite 数线性增长. EN: per-import logger leaks retention buffer. | `todo` | 待修复 |
| 1319 | src/index.ts redactStartupErrorMessage() 仅匹配少量正则，遗漏 Authorization: Basic …、Bearer …、"token":"…" JSON 片段、JWT 三段式. EN: redaction misses common secret formats. | `todo` | 待修复 |
| 1320 | src/index.ts 入口判断 import.meta.url === pathToFileURL(resolve(scriptPath)).href 对 npm bin 软链失效；与仓库其它处用 isCliEntryPoint 不一致. EN: inconsistent CLI-entry detection. | `todo` | 待修复 |
| 1321 | src/index.ts 步骤名硬编码 "x1-fabric" 字符串比较；编排步骤改名时无类型保护. EN: magic string couples bootstrap to legacy step id. | `todo` | 待修复 |
| 1322 | src/index.ts 失败路径 process.exitCode = 1 但未 unref 已打开的资源（DB/timer），导致进程卡住等 event loop 排空. EN: exit-code without graceful shutdown can hang process. | `todo` | 待修复 |
| 1323 | src/apps/index.ts:16 Object.freeze(PLATFORM_APPS) 仅冻结外层数组，每个 manifest 的 requiredLayers 数组可变，外部代码修改后污染所有调用者. EN: shallow freeze leaks mutability. | `todo` | 待修复 |
| 1324 | src/apps/index.ts:35 resolvePlatformAppManifest("summary"\|"demo") 永远返回 null（这两个值是 startupTargetKind 而非 appKind/appId），调用方易混淆. EN: target-kind vs app-kind confusion silently returns null. | `todo` | 待修复 |

## src other

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1325 | 多个 ADR 引用已迁移的 src/core/{memory,knowledge,agent-loop,storage}/ | `todo` | 待修复 |

## Uncategorized

| 编号 | 问题 | 状态 | 问题根因 |
| --- | --- | --- | --- |
| 1326 | pack-test-local-service.ts:207-214,228-233 runIntegrationTests/runSimulationTests 任意减扣 casesPassed/coveragePercent，伪造测试结果 | `todo` | 待修复 |
| 1327 | 控制面跨入编排面拉 getWorkflowDefinition | `todo` | 待修复 |
| 1328 | 16 个 1000+ LOC 候选文件需要拆分 | `todo` | 待修复 |
| 1329 | JSDoc/@see 同时存在 5 套互斥仓库 URL | `todo` | 待修复 |
| 1330 | skill-execution-{cache,core,support,service}-methods.ts 4 份切片循环依赖 | `todo` | 待修复 |
| 1331 | 多份文档含 /Users/holden/Project/... 私人绝对路径 | `todo` | 待修复 |
| 1332 | docs_en review 文件 373 处把 five-plane-* 机翻为 5-plane-* | `todo` | 待修复 |
| 1333 | docs_en review 反引号被 HTML 实体 ' 替换，markdown 失效 | `todo` | 待修复 |
| 1334 | platforme-full-review.md 引 errors.js（实为 .ts），并使用非可解析 brace 路径 | `todo` | 待修复 |
| 1335 | quickstart.md:108 列出不存在的 npm run docs:lint | `done` | quickstart 曾引用已删除的历史脚本名，文档未随验证入口迁移。 |
| 1336 | 3 份 review 文件（9–34 行）仅声称"已完成"无证据，却被标为权威 | `done` | review 文档缺少统一的结论、根因与证据回写规则。 |
| 1337 | temp-cache-cleanup.md、full-cleanup-review.md 为过期一次性报告，含个人路径 | `done` | 一次性清理报告长期留在活跃目录，缺少归档与索引边界。 |
| 1338 | operations-tracker.md "Last updated 2026-04-14" 已陈旧 | `done` | EN operations-tracker 未同步 2026-05-27 之后的索引收敛。 |
| 1339 | current_todo_list.md 与 project_progress_tracker.md 进度口径冲突 | `done` | todo 索引与 progress tracker 曾各自维护状态口径，缺少单一权威入口。 |
| 1340 | release-versioning.md 与 operations-checklist.md 互不引用 Pre-Launch Top 20 | `done` | release 版本文档与发布检查清单分离维护，缺少互链。 |
| 1341 | issues-table.md:780 声称"新增"文档无对账记录 | `done` | issues-table 历史整改已回写证据，但 review-d 没同步复核结果。 |
| 1342 | operations/npm-scripts.md、test_coverage_baseline_gate.md 中文区出现英文 | `done` | 中文运维文档的本地化回写滞后。 |
| 1343 | release_rollout_and_rollback_contract.md 仍引用 superseded 的 ADR-018 | `done` | EN release/rollback contract 仍把 ADR-018 写成执行依据。 |
| 1344 | architecture/00-platform-architecture.md 仅 21 行 stub 却被声称为权威入口 | `done` | 架构入口曾是 stub，没有作为索引页持续维护。 |
| 1345 | 03-module-diagrams.md 含 60+ 处指向不存在章节的内部锚点 | `done` | 旧版模块图问题来自历史结构；现行文档已改成无失效锚点的目录式结构。 |
| 1346 | migration/01-migration-scope.md 写 113 contracts/38 ADR，实际 151/120 | `done` | EN migration scope 沿用旧数量快照，未随 contracts 与 ADR 增长同步。 |
| 1347 | feature-flags/web 仅静态 <h2>，未消费 vm，与 admin+ 权限不符 | `done` | feature flags 页面曾停留在静态占位，缺少 VM 接线。 |
| 1348 | feature-flags/hooks 用 {} as never 双重断言且无消费者 | `done` | hook 曾用双重断言兜底且未被实际页面消费。 |
| 1349 | 10+ 个 feature hooks/index.ts 返回硬编码静态 items，但声称 Implemented | `done` | 静态 hooks 与 implemented 状态曾一起漂移；现已把此类占位 feature 统一回收到 `Planned`，仅保留真实接线模块为 implemented。 |
| 1350 | 12+ feature web/index.tsx 的 actions 无 onTrigger，仅写假日志 | `done` | 多个 feature Web 入口曾停留在占位动作；现已统一接入 workbench action handler，不再用假日志冒充交互。 |
| 1351 | workflow-builder/web DAG 节点与边为写死的演示图 | `todo` | 待修复 |
| 1352 | task-cockpit/hooks evidenceChain 由前端凭计数虚构生成 | `done` | task cockpit 早期用 evidenceCount 拼伪证据项；现已改为仅展示真实 evidence refs，缺数据时不再虚构链路。 |
| 1353 | workflow-debugger/mobile 直接展示 "Awaiting backend debugger seam" | `done` | workflow debugger 移动端曾把后端 seam 占位文案直接暴露给用户；现已改为中文说明和已接线状态文案。 |
| 1354 | UI 多处用 as never/as unknown as 强转屏蔽类型校验 | `todo` | 待修复 |
| 1355 | UI 错误处理仅 console.error，无遥测/上报 | `done` | Web UI 曾以控制台日志兜底错误；现已统一走 `reportUiError()` 与 UI telemetry sink。 |
| 1356 | void registerWebServiceWorker() 等 fire-and-forget 无 .catch | `done` | service worker 注册是 fire-and-forget，缺少失败捕获。 |
| 1357 | FeatureErrorBoundary 未实现 componentDidCatch | `done` | feature error boundary 只有 fallback，没有错误生命周期上报。 |
| 1358 | UI 10+ 文件硬编码颜色（#12201a/#334155 等），不引用 designTokens | `todo` | 待修复 |
| 1359 | tokens.css 264 行 CSS 从未被任何模块 import | `done` | design token CSS 定义后未被 Web 入口显式加载。 |
| 1360 | LazyFeatureDashboard 未做 lazy() 但测试断言"is Lazy" | `done` | 旧的 LazyFeatureDashboard 测试/实现残影没有随重构清理；现行 Web shell 不再保留该伪 lazy 组件与断言。 |
| 1361 | 4 个 feature 走相对路径而非 @aa/feature-* 别名 | `done` | feature registry 早期存在直连相对路径；现已统一通过 `@aa/feature-*` 包别名装配。 |
| 1362 | missionControlFeatureContracts 在 shell 内未被使用 | `done` | 历史 contract 残留导出未跟随 shell 与 registry 清理。 |
| 1363 | feature 模块 status/kind 字段使用风格不一致 | `done` | feature manifest 曾分别手填 status/kind；现已由 `createFeatureModule()` 统一从 status 推导 kind 并收口。 |
| 1364 | UI 大量英文文案硬编码，未走 translateMessage | `todo` | 待修复 |
| 1365 | task-cockpit/web <input> 缺 aria-label/<label>/name | `done` | task cockpit 输入控件缺少可访问名称。 |
| 1366 | AccessDenied reason 可为 null，渲染空 <p> | `done` | AccessDenied 允许 null 原因直接渲染，缺少默认文案。 |
| 1367 | test:ui-p1-features 引用 5 个测试，同目录另 4 个未覆盖 | `done` | UI P1 脚本曾遗漏新增测试入口；现已补齐到 9 个现存特性测试文件。 |
| 1368 | cache-metrics-collector.test.ts 0 字节空文件 | `done` | cache metrics 测试曾是空壳；现已补为 snapshot/reset 行为断言。 |
| 1369 | domains/onboarding/index.test.ts 仅 re-export 无用例 | `done` | onboarding barrel 测试曾只有空转发；现已补真实导出断言。 |
| 1370 | 多个测试调用函数无 assert 断言 | `todo` | 待修复 |
| 1371 | artifact:integrity 引用文件及目录均不存在 | `done` | 历史脚本点名了已迁移的测试路径；现已改到现存 artifact 相关用例入口。 |
| 1372 | 测试中遗留大量 console.log/warn，含调试残留 | `todo` | 待修复 |
| 1373 | 多处测试硬等 50–1600ms 时序，存在抖动 | `todo` | 待修复 |
| 1374 | 测试硬编码 localhost/端口；含特权端口 80 与明文密码 DSN | `todo` | 待修复 |
| 1375 | 48+ 用例名重复 ≥5 次（17 处同名等），疑似重构未删旧目录 | `todo` | 待修复 |
| 1376 | test-pack 下两个测试仅 assert.ok(true) 占位 | `done` | test-pack 夹具树曾混入占位测试；现行 `tests/fixtures/packs/test-pack/tests/` 已删除，不再保留 no-op 用例。 |
| 1377 | serialTest 自实现 skip 通道，无 ticket 校验且 API 形状不兼容 | `done` | 旧 serialTest 兼容了非 `node:test` 形状；现已收紧为函数或 `skip: true + fn`。 |
| 1378 | getCompatibilitySkipBudget 跳过预算无 issue/contract 引用 | `done` | 兼容跳过预算曾作为临时治理残留；现行仓库已移除该 helper 与对应跳过通道。 |
| 1379 | http-api-server.test.ts:1712 预期固定端口 43123 | `done` | API server 测试曾把端口写死；现已改为动态端口路径，不再锁死 43123。 |
| 1380 | test:e2e:stage-exit 引用 unit 文件，命名/目录契约不符 | `done` | stage-exit 脚本曾点错测试层级；现已切到 `tests/e2e/checkpoint-artifact-flow.test.ts`。 |
| 1381 | helpers/fs.ts 被 lint 但不被 typecheck | `done` | 仓库根 helper 曾脱离测试辅助链；现已收口到 `tests/helpers/fs.ts` 并纳入正常类型检查路径。 |
| 1382 | AA_PG_DSN vs AA_STORAGE_POSTGRES_DSN 文档/部署/代码三处不一致 | `done` | 测试、运行时与历史别名三套 DSN 命名并存，缺少主次口径。 |
| 1383 | phase1a-data 卷与 phase1a-demo.db 与 0.1.0 去 phase1a 化矛盾 | `done` | phase1a 迁移后，文档仍残留旧测试名和 SQLite 默认文件名。 |
| 1384 | .env.example 缺 AA_OPENAI_API_KEY/AA_MINIMAX_API_KEY 等代码实读变量 | `done` | 环境模板没有跟随 provider key 读取面扩充同步。 |
| 1385 | k8s manifest 与 Helm chart 的 image owner/repository/name 不一致 | `done` | Kubernetes smoke manifest、Helm chart 与镜像命名曾各写一套；现已统一到 `ghcr.io/automatic-agent/automatic-agent-platform` 与同名 chart/package。 |
| 1386 | [Unreleased] 累积 12 天 post-0.1.0 改动，版本未递进 | `done` | 发版后 changelog 与 Helm 版本没有同步前推。 |
| 1387 | .audit/(1.4M)、.test-db/(2.5M) 已忽略却存在于工作树 | `done` | 忽略的生成产物缺少清理动作和防回写规则。 |
| 1388 | .gitignore 多处冗余/不规范模式（dist_test 无尾斜杠等） | `done` | .gitignore 长期叠加，缺少定期整理。 |
| 1389 | .gitignore 主动忽略 5 个 legacy 兼容符号链接，使其不可审计 | `done` | 早期为兼容或本地目录添加的忽略规则没有持续清账；现行 .gitignore 已不再保留。 |
| 1390 | translate_docs.py 引入未声明的 translators PyPI 依赖 | `done` | Python 翻译脚本依赖没有同步登记到 requirements。 |
| 1391 | translate_docs.py 代码块解析重复追加换行致输出膨胀 | `done` | 翻译脚本在重组片段时没有严格保持原始换行边界。 |
| 1392 | translate_docs.py 单进程裸调翻译 API，无重试/限流 | `done` | 翻译脚本缺少节流与显式重试策略。 |
| 1393 | CI AA_TEST_PG_DSN 与生产 AA_PG_DSN/AA_STORAGE_POSTGRES_DSN 三套并存 | `done` | CI 曾同时桥接三套 PG DSN 名称，测试和生产口径未收敛。 |
| 1394 | CI trivy-scan 重新 build，无法保证与 publish 同一产物 | `done` | Trivy job 先前自建镜像，和 validate 产物脱节；现已改为扫描 validate 导出的同一 Docker tar artifact。 |
| 1395 | ci.yml workflow_call + push + pull_request 三重触发 | `done` | CI 触发条件沿用旧 workflow_call 设计，review-d 未回写实际 workflow。 |
| 1396 | ci.yml 任务链缺 build 步骤，下游依赖 dist/ 产物 | `done` | CI validate job 早期缺少 build 步骤。 |
| 1397 | CI upload-artifact 未设 retention-days 与 SHA 校验 | `done` | artifact 上传缺少 retention 与摘要文件。 |
| 1398 | CI aquasecurity/trivy-action@0.32.0 是浮动 tag，应锁 SHA | `done` | Trivy action 使用浮动 tag，供应链不可审计。 |
| 1399 | deploy-environment.yml:191 Helm --set 含 : 被解析为 map | `done` | Helm --set 对冒号值未强制字符串语义。 |
| 1400 | Promote 步骤跳过二次健康闸门，与 contract 双闸不一致 | `done` | 推广后缺少二次健康闸门。 |
| 1401 | 所有 workflow 缺 concurrency: 与最小 permissions: | `done` | 多个 workflow 早期没有最小 permissions 与 concurrency。 |
| 1402 | 仓库根缺 .github/CODEOWNERS | `done` | 仓库治理 owner 边界未落成文件。 |
| 1403 | .claude/scheduled_tasks.json 含 git 冲突标记且 .claude/ 已忽略却被提交 | `done` | 计划任务文件被忽略但仍被跟踪，且缺少冲突与审计治理。 |
| 1404 | websocket-bridge.ts:184、task-websocket-status-relay.ts:50、http-api-server.ts:1057 等 10+ 处 setInterval 未 .unref()，阻塞事件循环退出 | `done` | 定时后台任务最初分散追加，缺少统一的事件循环退出检查；当前涉及的 interval 均已补 `unref()`。 |
| 1405 | redis-lock-adapter.ts:267 redis.scan(cursor,'COUNT',100) 缺 MATCH lock:*，扫描全库并误切非锁键 | `done` | 锁枚举实现沿用了裸 `SCAN` 样板，没有按锁前缀收窄键空间；现已改为 `MATCH lock:*`。 |
| 1406 | redis-lock-adapter.ts:186 释放锁 Lua 脚本未用 pcall，cjson.decode 失败会中止脚本，锁悬挂 | `done` | 早期 Lua 释放逻辑默认 Redis 载荷总是合法 JSON，缺少异常分支；现已用 `pcall` fail-close。 |
| 1407 | redis-lock-adapter.ts:226 锁 id lock_${Date.now()}_${fencingToken} 仅毫秒分辨率，高并发碰撞 | `done` | 锁标识最初只追求可读性，误把时间戳当唯一源；现已切到 `randomUUID()` 级别随机性。 |
| 1408 | intake-router.ts:447,457,482,527、llm-eval-service.ts:854 用 Math.random() 做路由/采样，破坏可复现 evidence | `done` | 路由和评估辅助逻辑把“方便随机”带进了 evidence 路径；现已改成基于输入的确定性选择/采样。 |
| 1409 | structure/index.ts:309 new RegExp(...\b${expected}\b...`) 未 escape，expected` 含正则元字符即抛 | `done` | 结构校验默认导出名是普通标识符，没有先转义再拼接正则；现已统一 escape。 |
| 1410 | data-classification-service.ts:781,846 对配置正则只 void new RegExp 校验编译，无重复指数限制，ReDoS | `done` | 配置校验曾只做“能编译”检查，把复杂度风险留给运行时；现已在编译前增加危险模式拦截。 |
| 1411 | prompt-injection-guard.ts:169,278、embedding-provider.ts:108,233、scoped-external-access-sandbox.ts:303 远程 fetch 无 AbortSignal/超时，挂起即阻塞调用者 | `done` | 多处远端评估/嵌入调用早期直接裸 fetch；现已统一补超时控制，sandbox 路径也已具备 AbortController。 |
| 1412 | inter-plane-contract-gateway.ts:417 签名验签失败抛错路径被注释掉，失败静默通过 | `done` | 该条对应旧快照；现行 `receiveFromPlane()` 在验签失败时直接返回 `verified: false`，不会静默放行。 |
| 1413 | runbook-executor.ts:258-274 simulateStepExecution 对非只读命令直接返回 success: true，注释承认是占位 | `done` | 模拟执行路径把危险命令默认当成功回放，缺少 fail-close 设计；现已要求显式模拟结果，否则拒绝非只读命令。 |
| 1414 | crypto-shredding-service.ts:355-425 readField/writeField 未拒绝 **proto**/constructor 段，原型污染 | `done` | 字段路径处理只关注业务层级，没有把原型链关键段视作非法输入；现已显式阻断。 |
| 1415 | crypto-shredding-service.ts:392、redis-rate-limiter.ts:87、redis-lock-adapter.ts:268、redis-queue-adapter.ts:599-600、prompt-version-manager.ts:83、hitl-modes.ts:51、channel-gateway-delivery-service.ts:257 多处 parseInt/parseFloat 无 Number.isFinite 校验，NaN 污染 | `done` | 多处数值解析沿用了“解析后直接用”的松散习惯；现已在仍暴露风险的路径补齐有限数校验，其余点位在现行实现中已不存在。 |
| 1416 | effect-buffer.ts:333 timer.unref() 在嵌套条件内，setTimeout 与 unref 间抛错即泄漏 | `done` | 该条基于旧实现快照；现行 effect buffer 在 timer 赋值后立即 `unref()`，中间不存在额外分支逻辑。 |
| 1417 | redis-queue-adapter.ts:255 生产代码内基于 process.env.AA_RUNNING_TESTS 走测试分支 | `done` | 队列适配器曾把测试便捷入口直接挂到生产环境变量上；现已改为显式 `driver: "memory"` 配置，并同步清理旧测试残留。 |
| 1418 | storage-backend-factory.ts:30-36 runtimeRequire 检查 globalThis.require.__aaMockOverride，把测试 hack 泄漏到生产路径 | `done` | 早期为了测 PostgreSQL 路径直接把全局 require override 带进生产代码；现已改成受限 specifier 的显式模块注入。 |
| 1419 | storage-backend-factory.ts:35 return require(specifier) 接受任意 specifier，配置驱动型任意模块加载 | `done` | 动态加载曾没有 allowlist，测试便利性压过了最小加载面；现已收口到固定的运行时模块集合。 |
| 1420 | delegation-audit-service.ts:23 DEFAULT_AUDIT_DIR 在模块导入期 resolve 相对路径，layered runner 改 cwd 后失效 | `done` | 默认审计目录在模块装载时冻结，和分层 runner 的工作目录切换脱节；现已延迟到运行期解析。 |
| 1421 | platform/index.ts:14-22 9 处 wildcard export *，同名符号 ambiguous 合并 | `todo` | 待修复 |
| 1422 | platform/contracts/index.ts:169 在 contract barrel 内 throw new Error(...)，违反自身定义的 AppError 体系 | `done` | contract barrel 里的历史守卫直接抛原生异常，没有跟随错误体系收口；现已改为 `ValidationError`。 |
| 1423 | patch-bundle.ts:145 new RegExp(`^${regex}$`) 直接拼用户正则，注入/ReDoS | `done` | 该条基于旧实现认知；现行 patch bundle 先转义 glob 特殊字符，再编译缓存后的安全正则。 |
| 1424 | skill-creator-service.ts:204 正则 escape 字符串错误（] 在字符类外不需转但模板里漏） | `done` | 该条对应的 heading 转义问题已不存在；当前实现使用完整元字符转义集合构造标题匹配正则。 |
| 1425 | intake-router-model.ts:664 每调用即重新编译 RegExp，无缓存，热路径分配压力大 | `done` | 热路径规则匹配最初没有缓存 ASCII 规则正则；现已按 rule 缓存编译结果。 |
| 1426 | runbook-automation-service.ts:43,55,64 输出字符串含字面 ${stepName} 未插值 | `done` | runbook automation 曾把模板字符串写成字面量；现已改为真实插值输出步骤名。 |
| 1427 | runbook-automation-service.ts:36,48 用 Math.random()*150 与 >0.05 模拟执行延迟与失败率，stub 当成生产 | `done` | runbook automation 早期把随机延迟/失败率留在生产路径；现已改为确定性时长与显式失败命名约定。 |
| 1428 | workflow-builder-service.ts:259,267 JSON.parse(envelope["builderJson"]) 强转 Record<string, unknown> 后未做 schema 校验 | `done` | builder 持久化 JSON 曾把类型断言当校验；现已走安全对象解析。 |
| 1429 | goal-decomposer/index.ts:157、llm-plan-generator.ts:141 budget/费用正则在不限长用户输入上运行，DoS | `done` | 预算抽取逻辑默认把整段用户输入直接送入正则，缺少扫描窗口；现已限制匹配长度。 |
| 1430 | plugin-definition.ts:515 JSON.parse(readFileSync(...SBOM)) 无大小上限，恶意 SBOM OOM/DoS | `done` | SBOM 扫描先读全文件再解析，缺少文件大小闸门；现已在读取前做尺寸上限校验。 |
| 1431 | plugin-definition.ts:185-189 嵌套 try/catch 静默吞掉签名解码错误，恶意签名混入 | `done` | 当前签名解码失败不会混入验证流程，而是显式返回 `invalid_signature_format`；原问题来自旧审阅快照。 |
| 1432 | cli/login.ts:134 scryptSync 未显式 {N,r,p,maxmem}，KDF 参数默认即弱 | `done` | CLI 登录最初依赖 Node 默认 KDF 参数，没有把口令学参数显式固化；现已显式声明。 |
| 1433 | cli/aa.ts:48-49 通过 extname(import.meta.url)===".ts" 判断是否 --import tsx，编译产物里残留 tsx 路径 | `done` | CLI 启动器曾把源码运行探测绑定到 `import.meta.url` 扩展名；现已改成按同级实际入口文件存在性判断。 |
| 1434 | runtime-services/durable-event-bus-async.ts:143、execution-dispatch-service-async.ts:113、execution-worker-handshake-service-async.ts、execution-worker-writeback-service-async.ts、human-takeover-service-async.ts 与 platform/... 同名类二份实现，仅测试引用 | `todo` | 待修复 |
| 1435 | domains/index.ts barrel 仅 ~24/44 子目录，垂直域被静默隐藏 | `done` | domains barrel 长期靠手工维护，新增垂直域时没有同步导出；现已补齐缺失子域出口。 |
| 1436 | domains/{academic-research,advertising,agriculture,finance-accounting,healthcare,legal,manufacturing,live-streaming,...}/index.ts 12 行 preset stub，仅测试引用 | `done` | 该条判断失准：这些模块虽然薄，但承载真实 preset 与 `requires*Review()` 运行时逻辑，并已通过 `domains/index.ts` 对外导出。 |
| 1437 | ops-maturity/index.ts:1-17 barrel 缺 improvement/、learning/、ops-maturity-score.ts | `done` | ops-maturity 顶层 barrel 更新不完整，子模块扩容后漏掉新入口；现已补齐。 |
| 1438 | region-router/index.ts:7,10 生产 zod schema 默认 [https://example.invalid；config](https://example.invalid；config) 缺失即调用无效 URL | `done` | 区域路由 schema 曾用占位 URL 兜默认值，把缺配置伪装成可用配置；现已去掉无效默认地址。 |
| 1439 | web/runtime.ts:103 globalThis.fetch.bind(globalThis) 在构造时捕获，后续 monkeypatch 不生效 | `done` | Web runtime 早期在构造期绑定 fetch；现已改成运行时 fetch wrapper，测试替换和后续补丁都能生效。 |
| 1440 | web/runtime.ts:127-130 种子 session expiresAt = Date.now()+3600_000 且 refreshToken 空，1h 后静默过期 | `done` | 静态 bootstrap token 曾被错误当成短时 session；现已改为非过期 bootstrap session，并写入显式占位 refresh token。 |
| 1441 | web/runtime.ts:163 BrowserWSClient 在 wsUrl 缺失时仍构造，向默认地址发起 WS | `done` | Web runtime 曾无条件创建浏览器 WS 客户端；现已在缺少 wsUrl 时 fail-close 到内存 WS。 |
| 1442 | web/vite.config.ts:14 CSP script-src 'self' 缺 worker-src，严格 CSP 下 SW/SharedWorker 启动被阻 | `done` | Web CSP 曾只约束 script-src；现已补 worker-src，覆盖 SW/SharedWorker 场景。 |
| 1443 | web/vite.config.ts:17 CSP connect-src 'self' https: ws: wss: 等于放开任意外联 | `done` | connect-src 早期直接放开全部 HTTP(S)/WS(S)；现已改为从显式运行时端点收敛 origin 白名单。 |
| 1444 | web/vite.config.ts:24-28 声明 Report-To csp-endpoint，但服务端无 /api/csp-report 路由 | `done` | Web CSP 曾声明不存在的 Report-To 端点；现已移除该伪上报配置。 |
| 1445 | web/vite.config.ts:108 生产 sourcemap:"hidden" 与 SRI 注入冲突，任何后处理都会 SRI 失配 | `done` | 生产构建曾同时开启 hidden sourcemap 与 SRI 注入；现已关闭生产 sourcemap，避免摘要漂移。 |
| 1446 | web/vite.config.ts:56 SRI 正则不感知已存在 integrity=，会双重注入 | `done` | SRI 注入逻辑曾不识别已有 integrity；现已在注入前显式跳过已带 integrity 的标签。 |
| 1447 | web/build-config.ts:17 manualChunks 正则 feature[-/](\w+) 仅取首段，workflow-builder 与 workflow-cockpit 被并入同一 chunk | `done` | chunk 命名曾按错误正则截首段；现已按 feature 目录名完整拆分模块 chunk。 |
| 1448 | workflow-builder/web/flow-canvas.tsx:21、web/index.tsx:11-18 每次渲染传新数组给 LazyFlowCanvas，破坏 ReactFlow memo | `done` | workflow builder 曾在父子两层重复创建新数组；现已保持稳定 props，并在画布层按引用缓存。 |
| 1449 | workflow-cockpit/web/dag-viewer.tsx:107 position:absolute + zIndex:-1 父容器非 relative，连接线视觉跑出面板 | `done` | DAG 连接线曾依赖负 z-index 绝对定位；现已改为正常流式 rail 布局，不再跑出容器。 |
| 1450 | workflow-cockpit/web/dag-viewer.tsx:38-46 branchGroups 无 useMemo，大 workflow O(n) 重算 | `done` | DAG 分支分组曾在每次渲染重算；现已对 branch groups 和 stage steps 做 memo 化。 |
| 1451 | workflow-cockpit/web/dag-viewer.tsx:138-147 key={branchId} 但 DTO 不约束唯一性，重复 key 风险 | `done` | 分支列表曾直接拿 branchId 做 React key；现已改为稳定复合 key，避免重复 branchId 冲突。 |
| 1452 | feature-flags/hooks/index.ts:7 queryFn:()=>fetchFeatureFlags({} as never) 抹掉 RESTClient 参数，cast 失效即 NPE | `done` | feature-flags hook 曾通过 `{}` as never 抹掉 REST client 依赖。 |
| 1453 | task-cockpit/hooks/index.ts:71-74 useEffect(...,[taskQuery.data]) 每 5s 轮询都 setOptimisticTasks(null) 清空乐观 UI | `done` | task cockpit 曾在每次轮询后直接清空乐观态；现已只在服务端数据追平时回收 optimistic state。 |
| 1454 | workflow-builder/web/index.tsx:21 固定 height:280 + overflow:hidden，MiniMap/Controls 在窄屏重叠 | `done` | workflow builder 画布容器曾写死 280 高度并裁切溢出；现已改为响应式高度和可见溢出布局。 |
| 1455 | .husky/pre-commit:1-5 仅 npx lint-staged && npm run typecheck，缺 husky v9 兼容头 | `done` | pre-commit 钩子曾缺少 husky 初始化兼容头；现已补标准 husky v9 兼容引导。 |
| 1456 | .gitignore:43-45 dist/**/*.js 等三行与已忽略 dist/ 父目录冗余 | `done` | 父目录已忽略后仍残留子模式，.gitignore 规则重复。 |
| 1457 | truth/storage-quota-service.ts:89,96,103,124 4 处 process.cwd() 在构造时冻结路径，cwd 变化即失效 | `done` | storage quota 默认根路径直接取 cwd，未从 sandbox/workspace 真源派生。 |
| 1458 | truth/session-dual-storage.ts:136 JSONL 写入无 Date/Buffer replacer，Buffer 序列化为 {type:"Buffer",data:[...]} 膨胀 | `done` | session JSONL 直接吃原始 Buffer toJSON 结果，未做紧凑化序列化。 |
| 1459 | .gitignore 未 ignore dist-types/.vitest-temp/coverage-report/.dr-reports/coverage-report | `done` | 新生成目录加入后 .gitignore 没持续补齐。 |
| 1460 | .editorconfig 不存在 | `done` | 仓库缺少统一编辑器格式约束。 |
| 1461 | .npmrc 不存在，engine-strict=true/fund=false/audit=true 未集中声明 | `done` | npm 行为约束散落在人和 CI 约定里，没有集中在 .npmrc。 |
