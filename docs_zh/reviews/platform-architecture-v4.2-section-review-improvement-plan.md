# 企业级 Agent 平台总体架构 v4.2 — 逐节深度 Review 与改善方案

> **审查对象**：`《企业级 Agent 平台总体技术架构设计文档》v4.2 Release Candidate`  
> **审查口径**：仅从方案设计本身审查架构合理性、完整性、一致性、可实现性、可运营性。  
> **审查重点**：不重复上一轮已经闭合的问题，重点识别 v4.2 仍未闭合、引入的新矛盾、实现落地风险和生产化缺口。  
> **结论摘要**：v4.2 已经从“宏大蓝图”明显收敛为“可实现规格”，但仍需要一次 v4.3 的**规格固化、MVP 剪裁、契约统一、运行时测试矩阵和域规范拆分**。

---

## 0. 总体判断

v4.2 的核心进步很明显：

1. **HarnessRuntime / HarnessRun 权威化**：OAPEFLIR 已收敛为认知语义、投影和审计视图，不再作为独立运行时。
2. **PlanGraph 作为执行计划**：已经明确复杂任务必须使用 Graph，而非线性 steps。
3. **Trace Replay 替代伪确定性 Replay**：不再假设 LLM 可重放。
4. **Budget atomic reserve**：已经修复并发预算 TOCTOU 的主要方向。
5. **SideEffect 状态机增强**：新增 ambiguous、reconciliation、compensation、revoked/expired 等关键状态。
6. **三环实施优先级**：MVP / Hardening / Enterprise 已比旧 Phase 1-9 更可落地。
7. **多 Region 单 leader 边界**：已避免直接承诺 active-active truth writes。
8. **24 域不再阻塞核心 milestone**：已改为独立 domain waves。

但是，v4.2 仍不是“可直接开工的冻结规格”。它更像 **Release Candidate 2**：方向对了，但仍有 10 类问题需要 v4.3 固化。

---

## 1. v4.2 仍存在的最高优先级问题

| 编号 | 严重级别 | 问题 | 影响 | v4.3 改善方向 |
|---|---:|---|---|---|
| C1 | Critical | **权威源声明仍有微妙冲突**：正文说 Core Architecture 是唯一权威源，但又声明 Executable Runtime Contract、Schema/Zod/OpenAPI/Event Registry 优先于 Core Architecture。 | 实现团队会疑惑：冲突时看文档还是 schema？ | 改成“运行时行为以 Executable Contract + Schema 为机器权威；本文档是人类架构权威；二者冲突必须开 ADR/PR，不允许静默覆盖”。 |
| C2 | Critical | **Contract 对象仍混有旧语义**：ExecutionReceipt 仍使用 `stepId`，API 仍保留 workflow-runs/tasks 主入口，PlanBundle 与 PlanGraphBundle 同时出现。 | 新旧执行模型可能分叉，P4 仍可能消费 step/legacy path。 | 全面改为 `nodeRunId / harnessRunId / planGraphId`；legacy endpoint 只读 projection；新增 `CanonicalContractMap`。 |
| C3 | Critical | **MVP 与 Phase 1 交付物仍不完全一致**：MVP 表集不含 `execution_lease`，但第一环要求 lease / fencing / CAS；Phase 1 又写 Group 1 表。 | 第一环实现范围仍可能膨胀，或缺少必需的 lease truth。 | MVP 表集增加 `lease_record` 或明确 lease 内嵌于 `node_run`；Phase 1 不再写 Group 1 全量表。 |
| C4 | Critical | **LLM stream partial response 仍用“≥80%长度”判定可用**。 | JSON、SQL、代码、PlanGraph、决策输出即使 95% 完成也可能不可用。 | 删除长度启发式；改为 format-aware completeness：JSON parse、schema valid、terminal marker、AST parse、plan terminal reachable。 |
| C5 | Critical | **调试器断点语义仍可能影响生产状态**：文档说生产 run 不支持断点，但 §65.3 仍描述 paused/resume/step_over。 | 生产运行和 replay sandbox 边界不清。 | 将断点 API 明确限定为 ReplaySandbox；生产仅支持 safe pause/abort，不支持 step_over/watchpoint。 |
| C6 | High | **OAPEFLIR / Harness 章节重复过多**：§13、§14、§25、§28、§45、§58 多处重复定义状态、事件、Replay、Graph、Decision。 | 长期维护容易不一致。 | v4.3 增加“Single Definition Table”：每个概念只有一个规范落点，其他章节只引用。 |
| C7 | High | **SLO 目标没有按部署阶段区分**：Event append P99 <10ms、Checkpoint <20ms 对 SQLite/跨事务/加密/审计场景过硬。 | MVP 无法稳定达标，测试会与架构冲突。 | 为 D1/D2/D3/S4 分别定义 SLO；MVP 用“功能正确 + 稳态阈值”，Enterprise 才用严格 P99。 |
| C8 | High | **Budget 分片账本可能破坏硬上限**：sub-ledger/shard 可缓解热点，但没有定义全局 hard cap 的原子边界。 | 多 shard 并发预留可能总额穿透 tenant limit。 | 引入 `BudgetAllocator`：先给 bucket 分配额度，再 bucket 内原子 reserve；周期 reconciliation 不可替代硬上限。 |
| C9 | High | **DomainDescriptor 仍承载过多语义**：领域、风险、知识、评测、Prompt、治理、交互、执行模式全部集中。 | schema 巨大、业务接入困难、版本迁移昂贵。 | 拆为 `DomainCoreDescriptor + DomainRiskSpec + DomainEvalSpec + DomainGovernanceSpec + DomainExecutionProfile`。 |
| C10 | High | **24 域主文档内容仍过重**。 | 主架构文档会持续膨胀，更新慢、责任不清。 | 主文档只保留域硬约束总表和 2-3 个示例；24 域移至 `docs_zh/domains/<domain>/domain-spec.md`。 |
| C11 | High | **Prompt Injection 防御仍过度依赖 classifier 阈值**，虽然有辅助信号声明，但表格仍写 `>0.7 拒绝`。 | 容易把未校准模型当强安全边界。 | 规则/权限/隔离为强边界，classifier 只能触发 escalate/sanitize，禁止单独作为 production hard deny。 |
| C12 | High | **多 Agent 协作协议的 offer/accept 时序不自然**：`task_offer child→parent` 在 parent 还未选 child 前如何触发未定义。 | 协作实现可能出现乱序或语义歧义。 | 拆成 discovery/bid/award/accept 四步，或简化为 parent request → child accept/reject。 |
| C13 | Medium | **P4 / P5 静态图的章节引用错误或过时**：如 P4 标注 §23-§24，但 §23 是合规、§24 是配置治理。 | 新读者和实现团队会按错章节找责任边界。 | 重画全书骨架图，P4 应指 §14/§45/P4 子系统，P5 应指 §25-§29。 |
| C14 | Medium | **自然语言入口与“不可猜测用户意图”缺少任务草稿态**。 | 用户体验与安全原则冲突：高风险不能猜，低风险不能总追问。 | 增加 `TaskDraft` / `ClarificationState`，只有确认后的 TaskSpec 才进入 RequestEnvelope。 |
| C15 | Medium | **合规报告、SOC2/PII/GDPR 等仍偏模板化**。 | 不能作为真实审计依据。 | 定义 evidence control mapping 的机器可验证字段：controlId、evidenceType、freshness、owner、exception。 |

---

## 2. 逐节 Review 与改善方案

> 说明：本节按文档的 top-level section 逐节审查。严重级别使用：Critical / High / Medium / Low。

### 前言与 §1-§3

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| 前言 / 目录 | 十一大 Part、70+ 章节、24 域、附录和版本历史都放在一个主文档中，虽然章节稳定，但阅读和维护成本仍然过高。 | v4.3 拆成 5 份权威文档：`00-core-architecture.md`、`01-runtime-contract.md`、`02-state-evidence.md`、`03-domain-framework.md`、`04-operations-governance.md`。主文档只保留核心链路和索引。 |
| §1 文档概述 | “目标态架构”和“MVP Slice”并置，但后续章节仍大量写目标态细节，容易被误认为都要一期实现。 | 每个章节标题下增加 `Maturity: MVP/Hardening/Enterprise/Future`，并要求每个表格行标注 phase。 |
| §2 根假设与设计目标 | ArchitectureInvariantRegistry 很好，但目前只有少数 invariant 示例；大量“设计宪法”仍未全部落到测试。 | 新增 `Invariant Coverage Matrix`：每个宪法原则至少有 enforcement point、test file、failure behavior、owner。未覆盖项不得算验收项。 |
| §3 平台定义与非目标 | 已明确不是医疗/法律/金融最终决策主体、不是超低延迟替代品，这是正确的；但 24 域章节中仍容易写成“域 Agent 可做业务动作”。 | 每个高风险域开头增加固定免责声明：`advisory_only / human_accountable / deterministic_hot_path_only`，并由 DomainDescriptor 机器校验。 |

---

### Part I — 基础设施层（§4-§14, §24-§32）

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| §4 总体架构 | 五平面清晰，但 X1 的落地形态仍偏抽象；哪些能力是 library/interceptor，哪些是 central service，只写了原则，没有列清单。 | 增加 `X1DeploymentMatrix`：AuthZ、Budget、Panic、RateLimit、CircuitBreaker、SecretLease、EgressControl 分别声明 library / sidecar / service、状态源和失败策略。 |
| §5 平面通信契约 | 契约矩阵方向正确，但 ExecutionReceipt 仍以 `stepId` 为核心；PlanBundle / PlanGraphBundle / HarnessStep / NodeRun 边界不够硬。 | 统一为 `ExecutionReceipt.nodeRunId`；`stepId` 只允许在 legacy projection 中出现。新增 `Canonical Runtime Object Glossary`。 |
| §6 API 契约 | API 已暴露 PlanGraph、NodeRun、SideEffect、BudgetReservation，这是进步；但 `/tasks`、`/workflow-runs`、`/harness-runs` 三套入口并存。 | 写明 canonical API：`POST /harness-runs` 或 `POST /tasks` 二选一；另一方降级为 compatibility layer。取消任务必须定义是 `abort request`、`pause request` 还是 `kill`。 |
| §7 服务通信 | Outbox Poller TTL/standby 已补齐，但单 poller 模型仍可能成为高吞吐瓶颈。 | 定义 partitioned outbox：按 aggregate/tenant shard；每 shard 一个 lease；全局 ordering 只在 aggregate 内保证。 |
| §8 可扩展性 | S4 支撑 5000+ 并发，但核心 truth / budget / event 的分区写入策略只写粗粒度。 | 增加 `PartitioningSpec`：partition key、hot partition detection、split/merge 协议、rebalancing 期间的 read/write 策略。 |
| §9 稳定性 | 稳定性七层完整；但阈值多为静态，缺少 per-domain/per-tier 覆写和最小样本量。 | 所有自动切换条件必须声明 `min_sample_size`、`window`、`cooldown`、`owner`、`manual_override`。 |
| §10 风险控制 | TrustScore 不降低 inherent risk 已修复；但风险公式的 factor_value 如何计算仍未定义，跨域校准仍偏主观。 | 增加 `RiskCalibrationGuide`：0/25/50/75/100 分锚点、示例、反例、校准评审流程。 |
| §11 安全可靠 | STRIDE、安全沙箱、插件供应链较完整；但 sandbox tier 的具体隔离能力和运行平台绑定不够。 | 每个 sandbox tier 声明 Linux/macOS/Windows/K8s 可实现方式、不可用时降级策略、逃逸测试用例。 |
| §12 异常处理 | E1-E6、SEV、DLQ、Incident 都有；但 Incident owner/team 与自动化动作矩阵还不够完整。 | 给每个 error namespace 绑定 `owner_team`、`pager_policy`、`auto_mitigation_allowed`、`runbook_url`。 |
| §13 OAPEFLIR | 定位已正确：语义框架，不是执行引擎；但 §13 同时定义 Graph、Patch、Validation，与 §14/§45 重复。 | §13 只保留阶段语义和投影关系；Graph 契约全部移到 Runtime Contract 文档。 |
| §14 Runtime Execution Plane | NodeRun、Scheduler、SideEffect、Reconciliation、Compensation 已很成熟；但 NodeRun 状态缺少 `skipped / cancelled / dependency_failed / blocked_by_policy`。 | 扩展 NodeRun 状态或定义 terminal reason code；不要把所有非成功都塞到 failed/aborted。 |
| §24 配置治理 | admission_locked / checkpoint_revalidated / hot_reloadable / emergency_override 很好；但配置影响分析缺失。 | 新增 `ConfigImpactAnalyzer`：变更前列出受影响 tenant/run/domain/pack，阻止高风险配置直接灰度。 |
| §25 数据与状态一致性 | read-after-write、single leader、RunVersionLock 等已补齐；但 CAS+Lease+Fencing 的事务 API 未写。 | 定义 `StateStore.transition(entity, expectedStatus, leaseId, fencingToken, event)` 的唯一写入口。 |
| §26 存储架构 | MVP 表集裁剪到 20 张是正确方向；但 `execution_lease` 没在 MVP 表集中，和第一环 lease 要求矛盾。 | MVP 表集加入 `lease_record`；或明确 lease 字段嵌入 `node_run`，并给唯一索引和过期扫描规则。 |
| §27 性能与 SLO | P95/P99 分层已修复；但内部 SLO 对不同部署形态没有差异。 | 建立 D1/D2/D3/S4 四档 SLO 表，避免 MVP 被 Enterprise SLO 卡死。 |
| §28 Event Registry | platform.* facts vs oapeflir.* projection 分层正确；但 run 内 sequence 在并发 NodeRun 下如何分配未写。 | 使用 aggregate-local sequence + causal ordering；跨 aggregate 只靠 timestamp/causationId，不承诺全序。 |
| §29 Knowledge / Memory / Artifact / Learning | 四类边界清晰；但 “working never drop” 对 token budget 不现实。 | 改为 “working facts cannot be silently dropped; may be compressed with loss report”。ContextAssembly 必须输出 truncation report。 |
| §30 Business Pack | Pack / Plugin / Connector 生命周期边界有了；但 Manifest schema 未完整给出。 | 新增 `BusinessPackManifest.v1` 完整字段和 Zod schema；禁止自由文本 capability。 |
| §31 容灾与高可用 | HA 分级和 failover 记录已增强；但 HA-3 RPO=0 与跨 Region 数据驻留/failover 仍需更细边界。 | 区分 `in-region multi-AZ RPO=0` 与 `cross-region RPO>0/metadata-only`，不要混写。 |
| §32 部署架构 | D1/D2/D3/S4 表很好；但 D1 “小规模生产”容易被误用到多租户或高风险场景。 | D1 标为 `single-tenant controlled production only`；所有 regulated/high-risk 域必须 D3+。 |

---

### Part II — AI 运营层（§15-§23）

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| §15 LLM Provider | 故障切换、ExactPromptCache、SemanticCache 限制已改善；但 streaming partial 仍用长度启发式。 | 删除“≥80%预期长度可用”；每种 output type 定义 completeness validator。 |
| §16 Prompt 管理 | PromptBundle、revocation、redaction 都有；但 Prompt Injection 表格里 classifier `>0.7 拒绝` 仍像硬安全边界。 | 分类器只作为 signal；强阻断必须来自规则、数据分级、egress、tool capability、sandbox。 |
| §17 模型评估 | LLM-as-Judge 独立性分级已经合理；但 eval dataset ≥50 对 critical 域太低。 | 按风险分级：low ≥50，medium ≥200，high ≥500，critical 必须领域专家集 + adversarial set + holdout。 |
| §18 成本管理 | Atomic reserve 和 max_context_tokens 拆分已修复；但多币种、内部 compute、人审成本与 provider 发票 reconciliation 还弱。 | 成本账本增加 currency、fx_snapshot、cost_source、provider_invoice_reconciliation_id。 |
| §19 Agent 委托协作 | 全局 call_depth=8 已修复；ACP 字段完整；但 task_offer/task_accept 流程不够自然。 | 改为 `task_request → task_accept/reject → progress → completion`；如果要竞标，则新增 `capability_discovery/bid/award`。 |
| §20 长时任务 | hibernation TTL/renewal 已较完整；但 provider/model/prompt/connector 在休眠期间被废弃时的兼容策略不足。 | 唤醒时运行 `ResumeCompatibilityCheck`：version lock、DomainDescriptor、connector auth、secret lease、policy diff。 |
| §21 HITL | 模式丰富；但 “知情确认自动通过” 容易被误解为不审批也可继续。 | 改名为 `notification_only`，并限制只能用于 no-side-effect 或 low-risk reversible action。 |
| §22 SDK/DX | MVP SDK 范围有裁剪；但 SDK compatibility contract 不足。 | 定义 SDK semver、platform min/max version、contract-test generator、plugin sandbox test harness。 |
| §23 合规与数据治理 | 生命周期、crypto-shredding、SOC2 mapping、数据血缘都有；但 legal hold / backup / erasure 三者关系仍要更硬。 | 定义 Erasure 状态机：requested→classified→payload_shredded→backup_expiry_wait→tombstoned→verified；legal hold 走单独例外。 |

---

### Part III — 业务域接入层（§37-§38）

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| §37 业务域建模 | DomainDescriptor 太大，包含执行模式、风险、知识、评估、Prompt、治理、交互，未来版本迁移成本高。 | 拆分描述符：Core / Execution / Risk / Knowledge / Eval / Governance / Interaction；保留统一 domainId 关联。 |
| §37.2 execution_mode | 已区分 LLM 离线规划与 deterministic hot path，这是关键进步；但 compiled artifact contract 未完整定义。 | 新增 `CompiledPlanArtifact`：source graph、compiler version、signature、policy proof、dry-run evidence、runtime limits。 |
| §37.11 元模型 | 12 问很好，但缺少三个生产关键问题：责任主体、失败补偿、红队场景。 | 扩展为 15 问：Q13 liability owner，Q14 compensation/rollback model，Q15 adversarial/red-team scenarios。 |
| §38 接入 Runbook | 四阶段门禁完整，但不少检查仍是人工会议/清单，不是机器可执行。 | 每个 Gate 拆成 `automated_check / human_signoff / evidence_required / waiver_policy`。 |
| §38 时间估算 | low-risk 可快速，critical 域 5-9 周仍偏乐观。 | 风险分层接入路径：low 1-2 周，medium 3-6 周，high 6-10 周，critical 3-6 个月。 |

---

### Part IV — 垂直业务域深化层（§71-§94）

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| Part IV 总体 | 24 域放在主文档导致架构文档过重，且每域内容模板化较强。 | 主文档只保留“域硬约束总表 + 示例域”；每个域拆到独立 Domain Spec。 |
| §71 量化交易 | 已声明热路径 deterministic_only；但 strategy artifact、风控 limit、market connectivity 的 machine contract 不足。 | 定义 `TradingStrategyArtifact`、`PreTradeRiskCheck`、`KillSwitchContract`，LLM 只能输出 candidate/research。 |
| §72 电商 | 定价、库存、退款作为 SideEffect 是正确方向；但库存预留/订单一致性仍需强 contract。 | 引入 `InventoryReservationContract`、`RefundApprovalPolicy`、`PriceFloorPolicy`。 |
| §73 广告推广 | ad_spend_ledger 已出现，但投放平台的异步状态/预算花费回执需细化。 | SideEffect 对接广告平台必须有 spend reconciliation、campaign pause fallback。 |
| §74 金融服务 | 公平性/监管证据有提，但模型风险管理流程不足。 | 增加 Model Risk Management：model card、validation owner、monitoring、adverse action reason audit。 |
| §75 数据处理 | 需强化数据 lineage 与 replay 的语义。 | Sink 必须声明 idempotency、upsert/delete semantics、schema compatibility、backfill replay policy。 |
| §76 代码开发 | branch-only/PR/CI/SAST 方向正确；还需 dependency/license 政策作为硬 gate。 | merge 前强制 CODEOWNER + tests + SAST + secret/license/dependency scan。 |
| §77 用户运营 | 触达频控、敏感属性代理变量需成为平台 hard constraint。 | 增加 `ContactFrequencyLedger` 和 `SensitiveProxyDetector`。 |
| §78 行业调研 | citation 要求正确，但来源许可/ToS 和版权不应只靠人工。 | SourceRegistry 中增加 license、crawl_permission、redistribution_policy。 |
| §79 学术调研 | DOI/复现性方向正确；需要防止代写/学术不端。 | 增加 authorship policy、plagiarism guardrail、statistical reproducibility artifact。 |
| §80 企业知识库 | ACL 实时检查必须是一等约束。 | Retrieval 每次必须执行 principal-aware ACL filter；禁止缓存越权 chunk。 |
| §81 财务 | 四眼审批/SoD 正确；多币种与 FX snapshot 应进入通用审批模型。 | 把 §47 base_currency + FX snapshot 上升为所有 monetary side effect 的基础字段。 |
| §82 法务 | legal information vs legal advice 的边界应机器可判定。 | 输出对象增加 `legal_advice_risk`，达到阈值必须 attorney signoff。 |
| §83 在线直播 | 实时审核必须 edge/deterministic；断流副作用应有申诉/恢复链。 | 定义 `StreamInterventionStateMachine`：detect→classify→action→appeal→reinstate。 |
| §84 广告素材 | C2PA/水印/版权扫描方向正确；还需品牌资产授权和相似性阈值。 | Asset provenance 增加 license scope、brand guideline version、similarity score evidence。 |
| §85 游戏开发 | IP similarity 和 QA gate 正确；还需资产生成的 provenance。 | 所有生成 asset 必须 artifact hash、prompt ref、license/provenance、review status。 |
| §86 游戏上架 | 平台合规矩阵应版本化。 | StorePolicyMatrix 按 platform/region/version 管理，提审时冻结。 |
| §87 人力资源 | recommendation-only 正确；但 protected attribute handling 要更硬。 | Resume/offer/绩效 Agent 必须输出 bias audit evidence，不得用敏感属性或代理变量直接决策。 |
| §88 供应链物流 | 离线 side effect 依赖图已修复；还需出口管制和危险品政策引擎。 | Connector action 加 `export_control_check`、`hazmat_policy`。 |
| §89 医疗健康 | clinical decision support 边界正确；但 PHI isolation、SaMD 边界需独立 spec。 | 医疗域拆独立合规子文档，默认 all clinical output requires physician signoff。 |
| §90 教育培训 | 未成年人和学术诚信方向正确；还需 guardian/school consent 状态。 | 增加 `LearnerConsentRecord` 和 age-appropriate content policy。 |
| §91 客户服务 | Promise checker 很关键；应绑定退款/补偿 SideEffect。 | 输出承诺、退款、补偿统一进入 `PromiseAndRemedyPolicy`。 |
| §92 内容审核 | CSAM/极端内容涉及高风险，应独立处理。 | 增加 jurisdiction-specific escalation，审核员保护和证据留存独立状态机。 |
| §93 IT 运维 | known-runbook-only 正确；但 emergency break-glass 和平台故障路径要 out-of-band。 | 所有 auto-remediation 绑定 blast radius、rollback plan、change window 和 CMDB scope。 |
| §94 市场营销 | 品牌/广告法/舆情方向正确；需要 claims evidence。 | 对外 claim 必须关联 evidence source，不得生成无证据绝对化声明。 |

---

### Part V — 智能交互层（§39-§44）

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| §39 NL 入口 | “不可猜测用户意图”正确，但缺少中间态；高风险任务不能直接从 NL 进入 RequestEnvelope。 | 增加 `TaskDraft`、`ClarificationState`、`UserConfirmationReceipt`，确认后再创建 RequestEnvelope。 |
| §40 目标分解 | 三层分解与 PlanGraph 存在潜在重复。 | Goal decomposition 只产出 `GoalGraphDraft`，必须经过 PlanGraph Normalization 才能执行。 |
| §41 主动式 Agent | trigger storm 已考虑，但 proactive 与用户任务的价值/预算优先级仍需更硬。 | 增加 `ProactiveBudgetPool` 和 `UserInitiatedReserveRatio`，触发器不得耗尽用户任务预算。 |
| §42 渐进式自主权 | 信任分连续衰减和防博弈已增强；但自动降级可能打断关键业务。 | 降级前输出 `AutonomyChangeImpactReport`，关键业务需 grace period 或手动确认。 |
| §43 运营看板 | 看板分层清楚；但 LLM 生成的状态摘要需要证据引用和敏感信息过滤。 | 每条 summary 必须带 evidence_refs、freshness、confidence、redaction policy。 |
| §44 非技术 UX | 可视化向导 1-3 天与 §38 接入周期冲突；风险滑块可能误导。 | UX 向导只用于 low-risk fast-track；high/critical 仅展示只读配置和待办门禁，不允许“滑块降低风险”。 |

---

### Part VI — Harness 权威运行时与横切关注面（§45, §58）

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| §45 总体 | Harness 已是正确权威运行时；但“Planner/Generator/Evaluator Agent”可能被误解为多个独立 Agent。 | 改名为 Runtime Roles：PlannerRole / GeneratorRole / EvaluatorRole；仅在多 Agent 场景才是独立 Agent。 |
| §45 Context | ContextAssemblyContract 应成为机器契约，但正文仍偏描述。 | 定义输入源优先级、token budget、eviction report、taint propagation、PII/secret redaction。 |
| §45 Prompt Execution | 需与 §16 PromptBundle、§15 ModelGateway、§17 Eval 完整打通。 | 新增 `PromptExecutionRecord`：promptVersion、modelRoute、inputHash、outputHash、guardrailResult、usage。 |
| §45 DecisionInputBundle | 很关键，但应纳入 §6 API 和 §26 表落点。 | 将 DecisionInputBundle 作为 HITL / Evaluator / Audit 的统一 evidence artifact。 |
| §45 Guardrails | 五层 guardrails 有了，但冲突解决和循环上限仍需更形式化。 | 固定冲突优先级：abort > deny > escalate > replan > filter > allow；每 run guardrail_action_count 上限。 |
| §58 Observability | 指标丰富，但部分 SLO 是“业务域定义”，仍不够可验收。 | 增加 default SLO fallback：无域定义时使用 platform tier 默认值。 |
| §58 Error Code | 需要成为唯一错误码命名空间，避免 PLATFORM/OAPEFLIR/HARNESS 混用。 | 统一 `PLATFORM.<plane>.<component>.<category>`；OAPEFLIR 仅作为 tag，不进 error namespace。 |
| §58 Runtime Test Matrix | 正确但要提高权威性。 | v4.3 将 Runtime Test Matrix 移入 executable contract，作为 CI 必跑。 |

---

### Part VII — 组织治理层（§46-§51）

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| §46 组织层次 | 组织模型需要区分 org、legal entity、tenant、workspace、department。 | 增加 `LegalEntityBoundary`，跨法人/跨国家默认按跨租户处理。 |
| §47 审批路由 | 多币种、SoD、利益冲突已经修复；但审批链变更期间 in-flight approval 如何处理不够。 | 审批创建时冻结 `ApprovalRouteSnapshot`；组织变更只影响新审批或 checkpoint revalidation。 |
| §48 SSO/SCIM | 用户生命周期自动化需要和 running sessions / secret lease / pending approvals 联动。 | 用户离职/禁用触发 revoke sessions、reassign approvals、cancel secret leases、freeze delegated authority。 |
| §49 合规策略 | 合规继承与 override 容易产生冲突。 | 增加 policy merge semantics：deny overrides allow；stricter wins 只用于安全/合规维度；结构冲突需人工 ADR。 |
| §50 知识隔离 | Chinese Wall 有机制，但解除/到期策略需要更细。 | WallExpiry 必须经合规官审批、cooling period、full audit、data residue scan。 |
| §51 治理委托 | super_admin 与不可降级护栏需要绝对边界。 | super_admin 只能修改 policy proposal；不可降级 invariant 必须通过 break-glass + dual control + post-review，不允许直接关闭。 |

---

### Part VIII — 规模化运行层与生态层（§52-§57）

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| §52 多 Region | single leader 边界正确；但 Global Control Plane 的元数据容灾和一致性没写。 | 定义 metadata quorum/backup、home-region mapping 恢复、routing policy version lock。 |
| §53 资源竞争 | WFQ、promotion budget、checkpoint-before-preempt 已很好；但 approval_capacity 被列入 resourceVector 后需要真实模型。 | 审批席位也要 reserve/release；无审批容量时高风险 run 不得 admission。 |
| §54 SLA | 99.95 默认、99.99 专用部署已合理；但 Platinum <2s E2E 对含 LLM 的工作流不现实。 | SLA 按 workflow class：deterministic / LLM-assisted / HITL-waiting 分开承诺。 |
| §55 Marketplace | 废弃生命周期有，但安装依赖和安全 patch 推送策略还弱。 | 引入 dependency graph、security advisory、forced patch、quarantine、tenant impact report。 |
| §56 反馈改进 | LearningCandidate 不直接上线已正确；但自动改进的样本偏差和污染防护需硬化。 | 每个 candidate 必须有 data quality score、diversity score、contamination scan、holdout check。 |
| §57 外部集成 | Connector 风险分层清晰；但 connector action 级 idempotency 与 reconciliation contract 需要成为必填。 | 每个 write action 必须声明 idempotency key semantics、external status query、compensation availability。 |

---

### Part IX — 运营成熟度层（§59-§69）

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| §59 可解释性 | StageRationale 解释很好，但要避免把 LLM 生成理由当事实。 | Explanation 分为 recorded facts / model rationale / inferred summary；界面必须区分。 |
| §60 Panic | 已从 TTL 自动解除改为安全恢复，这是正确方向；但跨 region panic 延迟和部分失败需演练指标。 | 增加 `PanicDrillReport`，每季度测试 ingress block、execution quiescence、egress block、credential revoke。 |
| §61 生命周期 | testing/staging 可回退已修复；但 AgentVersion 原子回滚需处理外部 connector schema 变化。 | CompatibilityMatrix 必须包含 connector action schema、Prompt schema、Eval schema、DomainDescriptor version。 |
| §62 Edge | signed append-only queue、dependency graph 已修复；但设备被盗/离线密钥吊销场景仍需更硬。 | 设备身份必须支持 attestation、remote wipe、key lease expiry、offline max duration。 |
| §63 漂移检测 | 高级算法已降级到 Hardening/Enterprise，方向正确；但自动降低 autonomy 可能造成业务突变。 | medium drift 默认先 require_review，不直接降级；high drift 才 paused。 |
| §64 成本优化 | What-if 仅 advisory 正确；但优化建议可能牺牲质量。 | 每条优化建议必须输出 quality risk、SLA impact、regression test requirement。 |
| §65 调试器 | Lite/Pro/IDE 分级正确；但 §65.3 仍像可暂停生产 run。 | 生产只允许 inspect/pause/abort；step_over/watchpoint 仅 ReplaySandbox。 |
| §66 合规报告 | HumanSignoff 和 EvidenceQualityScore 已很好；但模板变更和框架法律变更追踪需加强。 | ComplianceTemplateRegistry 增加 legal_version、change_source、effective_date、migration rule。 |
| §67 容量规划 | MVP 不依赖高级模型正确；但 failover capacity reserve 应成为硬约束。 | Enterprise SLA tenant admission 必须检查 N+1/failover reserve。 |
| §68 多模态 | ArtifactRef、provenance、modality-specific guardrails 已正确；但 image/video/audio safety 供应商差异要标准化。 | 定义 `ModalitySafetyResult` schema：labels、confidence、provider、policyDecision、appeal path。 |
| §69 平台自运维 | out-of-band recovery 已补齐，这是关键；但 PlatformOps 仍可能和平台故障共因失效。 | PlatformOps 只能作为辅助；所有 P0/P1 runbook 必须能在 Chat/Agent/ModelGateway 不可用时执行。 |

---

### Part X — 落地路线与汇总（§33-§36）

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| §33 三环路线 | 已大幅优于旧 Phase 1-9；但后面仍保留详细 Phase，读者可能误解为两套路标并行。 | `Ring` 是唯一权威路线；Phase 1-9 改为 Appendix “历史映射”，正文只保留 Ring backlog。 |
| §33 MVP | 第一环仍包含 ModelGateway / Prompt / Eval Gate，可能过重。 | MVP Eval Gate 可先做 deterministic contract tests + small golden set；完整 Prompt canary 进入 Hardening。 |
| §34 ADR | ADR 数量很大，冻结全部不现实。 | ADR 分三类：MVP-blocking、Hardening-before-production、Enterprise-before-scale；只冻结 MVP-blocking。 |
| §35 代码目录 | 目录可能比 MVP 实现复杂。 | 同步给出 MVP-only 目录、Hardening 增量目录、Enterprise 增量目录，避免空目录驱动开发。 |
| §36 风险/约束 | 风险清单如果平铺，仍难执行。 | 风险矩阵必须包含 severity、likelihood、owner、mitigation、trigger、linked invariant/test。 |
| §36 成功标准 | 24 域 GA、12 原型验证不应作为平台主成功标准。 | 平台成功标准与域成功标准拆开：平台核心只看 Harness/State/Evidence/Governance；域按 domain wave 验收。 |

---

### Part XI — 结论与附录

| 节 | 主要问题 | 改善方案 |
|---|---|---|
| §70 结论 | 结论应突出 v4.2 的“收敛边界”，而不是继续强调全量大平台能力。 | 增加一句：v4.2 的成功不是覆盖全部域，而是形成稳定的 Harness + State + Evidence 最小闭环。 |
| 附录 G 术语表 | 术语表需要成为“命名权威”。当前仍有 HarnessStep/NodeRun/WorkflowRun/TaskRun 交叉。 | 术语表增加 `canonical/deprecated/legacy projection` 三态。 |
| 附录 H | 附录 H 的冲突裁决顺序仍可能和正文“Core Architecture 唯一权威”冲突。 | 明确：Executable Contract 是机器权威，Core Architecture 是人类解释权威；冲突必须修 schema 或修文档。 |
| 版本历史 | 版本历史太长，容易淹没主线。 | 保留最近 3 个版本在正文，完整 changelog 独立文件。 |

---

## 3. v4.3 建议修订包

### WP1 — 权威源与命名收敛

**目标**：彻底关闭新旧模型分叉风险。

必须修改：

- `ExecutionReceipt.stepId` → `nodeRunId`
- `workflow_run_projection` 明确为 legacy / query projection
- `ExecutionPlan`、`ControlDirective`、`StateCommand` 只保留在 deprecated alias 表
- `PlanBundle` 与 `PlanGraphBundle` 关系明确：PlanBundle 是产品包装，PlanGraphBundle 是执行契约
- 附录 H 冲突规则与前言权威源规则统一

验收：

- 搜索全文：除术语表/迁移说明外，不再出现旧契约作为新实现入口。
- CI 中新增 `contract-naming-consistency.test.ts`。

---

### WP2 — MVP Slice 再裁剪

**目标**：8-12 周内真正能落地。

MVP 必留：

1. RequestEnvelope → HarnessRun
2. ConstraintPack
3. PlanGraphBundle 单节点 + DAG 基线
4. NodeRun + NodeAttempt
5. BudgetReservation atomic reserve
6. SideEffect proposed→approved→committing→confirmed / ambiguous→reconciling
7. Trace Replay without side effects
8. EventLog + Outbox + AuditRecord
9. CLI inspect / doctor
10. HITL basic approve/deny

MVP 延后：

- 完整 Prompt canary
- 完整 Evaluation Harness
- 24 Domain Packs
- Marketplace
- Multi-Region
- Edge
- PlatformOps Agent
- Debug IDE
- Compliance Report generator

---

### WP3 — Runtime Contract 可执行化

新增 `runtime-contracts/`：

```text
runtime-contracts/
  harness-run.schema.ts
  plan-graph-bundle.schema.ts
  node-run.schema.ts
  side-effect.schema.ts
  budget-reservation.schema.ts
  event-envelope.schema.ts
  decision-directive.schema.ts
  operational-directive.schema.ts
  replay-session.schema.ts
  invariants/
    truth-event-atomicity.test.ts
    no-side-effect-in-replay.test.ts
    budget-reserve-before-execute.test.ts
    node-terminal-closed.test.ts
```

文档中只描述 intent，schema 是机器验收入口。

---

### WP4 — AI Ops 安全硬化

必须修：

- 删除 partial response 长度启发式。
- Prompt Injection classifier 只作为辅助信号。
- Eval dataset 按风险分级。
- Prompt full logging 默认引用化/脱敏，不允许高敏 prompt 原文落普通 artifact。
- LLM-as-Judge 输出必须标记 non-regulatory evidence。

---

### WP5 — Domain Framework 拆分

主文档只保留：

- DomainDescriptor 核心接口
- 15 问元模型
- 域硬约束总表
- 3 个示例域：代码开发、客户服务、医疗健康或量化交易

其余迁移：

```text
docs_zh/domains/
  quant-trading/domain-spec.md
  healthcare/domain-spec.md
  finance/domain-spec.md
  legal/domain-spec.md
  customer-service/domain-spec.md
  ...
```

每个域 spec 必须有 owner、version、eval baseline、risk profile、HITL policy、connector list、release gate。

---

### WP6 — Operational Readiness Matrix

新增：

| 能力 | MVP | Hardening | Enterprise |
|---|---|---|---|
| Incident | 手动创建 + linked evidence | 自动检测 + routing | SLO/error budget 联动 |
| DLQ | inspect + discard | redrive + simulation | bulk remediation |
| Replay | trace replay | replay compare | simulation lab |
| Panic | local kill | plane ack | cross-region drill |
| Budget | run/node reserve | sub-ledger | cross-region reconciliation |
| Domain | 2 pilot | 6-12 domains | 24 domain waves |

---

## 4. v4.3 推荐新增章节

建议新增或重写以下小节：

1. **§0.3 Canonical Authority Model**  
   解释人类架构权威、机器 schema 权威、ADR 权威的关系。

2. **§5.5 Canonical Runtime Object Map**  
   列出 Task / HarnessRun / HarnessStep / NodeRun / NodeAttempt / SideEffect / Decision / Event 的唯一职责。

3. **§6.8 API Canonical vs Legacy Projection**  
   明确哪些端点是执行入口，哪些只是查询兼容。

4. **§14.15 NodeRun Terminal Reason Codes**  
   区分 failed、skipped、cancelled、dependency_failed、policy_blocked、budget_exhausted。

5. **§15.8 Output Completeness Validators**  
   取代 partial 80% 规则。

6. **§26.6 MVP Physical Schema**  
   给出首批 migration 的真实表结构和索引。

7. **§27.8 Deployment-tier SLO Matrix**  
   D1/D2/D3/S4 分档 SLO。

8. **§37.12 Domain Spec Decomposition**  
   将 DomainDescriptor 拆为多份 spec。

9. **§58.11 Runtime CI Test Matrix**  
   将不可降级条款绑定具体测试。

---

## 5. v4.3 最小验收标准

v4.3 不应以“文档更完整”为验收，而应以“实现团队不会走偏”为验收。

必须满足：

- [ ] 全文只存在一个可执行 Run 权威对象：HarnessRun。
- [ ] P4 只消费 PlanGraphBundle / NodeRun，不消费 legacy step。
- [ ] SideEffect ambiguous 进入 reconciliation，不进入 success。
- [ ] Replay 不会调用真实 LLM/Tool/Connector/外部写 API。
- [ ] Budget reserve 是所有 LLM/Tool/SideEffect/Eval 前置硬门。
- [ ] MVP 表集包含 lease 或明确 lease 嵌入 node_run。
- [ ] API 中 legacy workflow/task 语义被降级为 projection 或 compatibility。
- [ ] Prompt Injection classifier 不作为唯一 hard deny。
- [ ] Streaming partial 使用 schema validator，不使用长度阈值。
- [ ] 三环路线是唯一交付模型，Phase 1-9 只作为历史映射。
- [ ] 24 域从主架构拆到 domain specs，不阻塞平台核心 milestone。
- [ ] Runtime Test Matrix 进入 CI。

---

## 6. 最终建议

v4.2 的方向已经正确，下一版不应该继续“加能力”，而应该做四件事：

1. **冻结权威对象**：HarnessRun、PlanGraphBundle、NodeRun、SideEffectRecord、BudgetReservation、EventEnvelope。
2. **删除或降级旧入口**：ExecutionPlan、step-based execution、workflow-run as truth、ControlDirective。
3. **收敛 MVP**：只做能证明“可运行、可恢复、可审计、可停止、可 replay”的最小闭环。
4. **拆分域文档**：主架构不再承载 24 域细节，改为 Domain Spec 产品化。

如果 v4.3 继续增加能力，会重新膨胀；如果 v4.3 聚焦契约收敛和可测试 invariant，这套架构就可以进入实现冻结阶段。
