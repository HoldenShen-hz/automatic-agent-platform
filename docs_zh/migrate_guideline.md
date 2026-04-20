# 老系统 → 新平台 移植评估文档

> **文档版本**：v1.1
> **文档状态**：Draft
> **评估范围**：`doc/`（不含 `doc/automatic_agent_platform/`）+ `src/` + `config/` + `divisions/` + `tests/`
> **目标系统**：《企业级 Agent 平台总体技术架构设计文档》v2.7（§1-§70，七层架构）
> **评估日期**：2026-04-19

---

## 一、评估目的

老系统（automatic-agent-system-main）已有 **797 源文件 / 174,585 行代码** 和 **200+ 文档文件**。新平台架构设计文档 v2.7 定义了七层企业级架构。本文档回答：

1. **哪些 doc 文件**可以直接移植、改造移植、或归档？
2. **哪些 code 模块**可以直接移植、改造移植、或需重写？
3. **移植优先级和建议执行顺序**是什么？

---

## 二、评估方法论

### 2.1 移植等级定义

| 等级 | 标记 | 含义 | 典型改造范围 |
|------|------|------|-------------|
| **A1 — 完全直接移植** | 🟢 | 零改造复制即用。接口、命名、依赖均与新架构兼容 | 0 — 仅复制 + import path 更新 |
| **A2 — 实现直接复用但需适配器** | 🟢🔧 | 核心实现不动，需增加 adapter/wrapper 对齐新架构扩展点 | ≤15% — 增加 adapter 层或补充缺失接口 |
| **B — 改造移植** | 🟡 | 核心逻辑可复用，但需适配新架构接口/命名/分层 | 15%-50% — 接口重构 + 依赖替换 |
| **C — 参考价值** | 🔵 | 不直接移植，但设计思路/测试用例/竞品分析有参考价值 | N/A — 仅参考，不搬代码 |
| **D — 归档淘汰** | ⚪ | 已过时或被新设计替代，仅做历史归档 | N/A — 归档 |

### 2.2 五维判定模板

每个模块/文档的等级判定须提供以下五维度评估证据：

| 维度 | 含义 | 评分标准 |
|------|------|---------|
| **架构契合度** | 与 v2.7 目标架构的接口/分层吻合程度 | 高=接口直接对齐 / 中=需 adapter / 低=需重写接口 |
| **依赖污染度** | 对外部模块的耦合程度，影响独立移植能力 | 低=≤2 个直接依赖 / 中=3-5 / 高=≥6 或循环依赖 |
| **接口稳定度** | 公共 API 在迁移过程中的变化预期 | 高=不变 / 中=扩展但兼容 / 低=破坏性变更 |
| **测试完备度** | 已有测试对核心行为的覆盖 | 高=行为全覆盖 / 中=主路径覆盖 / 低=覆盖不足 |
| **改造范围** | 需改动的代码占模块总量的比例 | 小=≤15% / 中=15%-50% / 大=≥50% |

**判定规则**：
- **A1**：五维度全部为"高/低/高/高/小"
- **A2**：架构契合度≥中，改造范围≤15%，但需新增 adapter/wrapper
- **B**：核心可复用但至少一维度为"低"或改造范围>15%
- **C**：架构契合度为"低"且改造范围≥50%
- **D**：被 v2.7 明确替代或已废弃

### 2.3 新架构七层映射

```
Layer 7 │ 运营成熟度层（可解释性·紧急制动·生命周期·边缘·漂移·成本·调试·合规·容量·多模态·自运维）
Layer 6 │ 规模化运行层 + 生态层（多Region·资源竞争·SLA·市场·反馈·集成）
Layer 5 │ 组织治理层（组织层次·审批路由·SSO·合规·知识隔离·委托）
Layer 4 │ 智能交互层（NL 入口·目标分解·主动 Agent·自主权·看板·UX）
Layer 3 │ 业务域接入层（DomainDescriptor·Recipe·Runbook）
Layer 2 │ AI 运营层（LLM 抽象·Prompt·Eval·Cost·HITL·SDK）
Layer 1 │ 基础设施层（五平面·稳定性·风险·安全·恢复·审计）
```

---

## 三、总览矩阵

### 3.1 文档移植总览

| 类别 | 文件数 | 🟢 直接 | 🟡 改造 | 🔵 参考 | ⚪ 归档 |
|------|--------|---------|---------|---------|---------|
| 主干文档 (doc/00-07) | 8 | 0 | 5 | 3 | 0 |
| 技术分析文档 (doc/18, 19) | 2 | 0 | 2 | 0 | 0 |
| 架构与序列图 | 4 | 0 | 3 | 1 | 0 |
| 合约文档 (doc/contracts/) | 90 | 22 | 38 | 20 | 10 |
| ADR (doc/adr/) | 28 | 15 | 8 | 3 | 2 |
| 运维文档 (doc/operations/) | 30+ | 5 | 10 | 8 | 7+ |
| 评审文档 (doc/reviews/) | 21 | 0 | 3 | 12 | 6 |
| 治理文档 (doc/governance/) | 8 | 4 | 3 | 1 | 0 |
| 指南文档 (doc/guides/) | 4 | 2 | 2 | 0 | 0 |
| 参考文档 (doc/reference/) | 17 | 0 | 0 | 8 | 9 |
| 研究文档 (doc/research/) | 28 | 0 | 0 | 28 | 0 |
| 归档文档 (doc/archive/) | 3 | 0 | 0 | 0 | 3 |
| **合计** | **~243** | **~48** | **~74** | **~84** | **~37** |

### 3.2 代码移植总览

| 架构层 | 模块 | 文件数 | 行数 | 🟢 | 🟡 | 🔵 | ⚪ |
|--------|------|--------|------|-----|-----|-----|-----|
| Layer 1 基础设施 | types, errors, storage, events, config, cache, locking, queue, api, lifecycle, constants, utils, resource, results | ~230 | ~50K | 8 模块 | 5 模块 | 1 模块 | 0 |
| Layer 2 AI 运营 | runtime, agent-loop, planning, tools, providers, workflow, orchestration, artifacts, feedback, learning, evaluation | ~230 | ~58K | 3 模块 | 7 模块 | 1 模块 | 0 |
| Layer 3 业务域 | domain-registry, divisions, plugins | ~38 | ~5.7K | 2 模块 | 1 模块 | 0 | 0 |
| Layer 4 智能交互 | memory, knowledge, messages, gateway | ~54 | ~10.7K | 1 模块 | 3 模块 | 0 | 0 |
| Layer 5 组织治理 | security, approvals, compliance, cost, hr | ~28 | ~8.6K | 2 模块 | 3 模块 | 0 | 0 |
| Layer 6 规模化 | deployment, improvement, product(部分) | ~35 | ~8.4K | 0 | 2 模块 | 1 模块 | 0 |
| Layer 7 运营成熟度 | observability, ops, stability, evolution, reliability | ~106 | ~32.6K | 2 模块 | 3 模块 | 0 | 0 |
| 跨层 CLI | cli | 78 | ~6.1K | 0 | 1 (整体) | 0 | 0 |
| **合计** | **43 模块** | **~799** | **~180K** | **18** | **25** | **3** | **0** |

---

## 四、文档移植详细评估

### 4.1 主干文档 (doc/00-07)

| 文件 | 行数 | 等级 | 目标架构层 | 移植说明 |
|------|------|------|-----------|---------|
| `00_document_architecture_and_source_of_truth.md` | 192 | 🟡 B | 跨层 | 文档分层治理模型（L0-L10）可复用，需更新为七层架构的文档体系 |
| `01_architecture_and_technical_design.md` | 153 | 🟡 B | Layer 1-2 | 三层平台架构 + control-plane 角色定义可复用，需与 v2.7 §1-§5 对齐 |
| `02_agents_governance_and_security.md` | 83 | 🟡 B | Layer 5 | Agent 分层、权限、安全模型与 v2.7 §11 安全体系兼容，需扩展组织治理部分 |
| `03_data_feedback_and_learning.md` | 107 | 🟡 B | Layer 2,4 | 6 层记忆 + 反馈循环与 v2.7 §56 反馈管线兼容，需更新 KV cache 对齐细节 |
| `04_product_growth_and_strategy.md` | 76 | 🔵 C | Layer 6 | 商业定位和增长策略作为新平台产品规划参考 |
| `05_delivery_scope_and_milestones.md` | 120 | 🟡 B | 跨层 | Phase 路线图（1a→4）需重新映射到 v2.7 §33 七阶段路线图 |
| `06_testing_release_and_operations.md` | 107 | 🔵 C | Layer 7 | 测试基线和发布门禁逻辑可参考，但需完全重写以适配 v2.7 §27/§32 |
| `07_constraints_roadmap_and_appendix.md` | 98 | 🔵 C | 跨层 | 约束和反模式列表作为新平台设计参考 |

### 4.2 技术分析文档

| 文件 | 行数 | 等级 | 移植说明 |
|------|------|------|---------|
| `18_code_architecture.md` | 1,541 | 🟡 B | v9 代码架构静态分析，模块清单/依赖图/质量矩阵可直接作为新平台代码架构基线，需更新以反映七层模块重组 |
| `19_full_coverage_test_manual.md` | 2,082 | 🟡 B | v1.2 测试方法论手册，OAPEFLIR 覆盖矩阵 / 金色测试 / 变异测试（Stryker）章节可直接复用，需补充 Layer 4-7 测试策略 |

### 4.3 架构与序列图文档

| 文件 | 行数 | 等级 | 移植说明 |
|------|------|------|---------|
| `automatic-agent-architecture.md` | 166 | 🟡 B | 主架构入口文档，SLO 定量指标（95%/90%/100%）可复用，需与 v2.7 §27 对齐 |
| `runtime-sequence.md` | 291 | 🟡 B | 4 组核心运行时序图（Intake/Dispatch/Writeback/Recovery）可直接移植，需补充 OAPEFLIR 全循环序列 |
| `module-inventory.md` | 317 | 🟡 B | 模块成熟度快照，需更新为七层分类 |
| `system-status-matrix.md` | 294 | 🔵 C | 能力状态矩阵作为参考，新平台需建立自己的状态追踪 |

### 4.4 合约文档 (doc/contracts/) — 90 文件

**直接移植（🟢 A）— 22 文件**：这些合约定义的接口与新架构完全兼容。

| 合约 | 目标架构章节 |
|------|-------------|
| `state_transition_matrix_contract.md` | §9 状态机 |
| `event_bus_contract.md` | §4 事件总线平面 |
| `storage_schema_contract.md` (748行) | §26 数据模型 |
| `sandbox_and_auth_contract.md` | §11 安全体系 |
| `tool_skill_plugin_contract.md` | §30 Business Pack |
| `slo_alerting_and_runbook_contract.md` | §27 性能 SLO |
| `memory_decay_and_quality_contract.md` | §3.5 记忆质量 |
| `release_rollout_and_rollback_contract.md` | §32 部署 |
| `runtime_execution_contract.md` | §13 OAPEFLIR |
| `plugin_spi_contract.md` | §30 Plugin |
| `knowledge_spi_contract.md` | §3.4 知识平面 |
| `ha_coordinator_and_leader_election_contract.md` | §31 容灾 |
| 其他 10 个基础合约 | Layer 1 各章节 |

**改造移植（🟡 B）— 38 文件**：核心约束可复用，需适配新的命名/分层/扩展点。

| 合约类别 | 文件数 | 改造要点 |
|----------|--------|---------|
| Agent 行为合约 | 8 | 需增加 v2.7 §42 渐进式自主权 + §41 主动式 Agent 约束 |
| OAPEFLIR 循环合约 | 5 | 需扩展 Plan/Learn/Improve/Rollout 阶段的合约细节 |
| API 合约 | 6 | 需增加 §39 NL 入口 + §44 非技术用户端点 |
| 计费/租户合约 | 4 | 需增加 §46 组织层次 + §54 SLA 分级 |
| 安全/合规合约 | 5 | 需增加 §49 分部门合规 + §52 GDPR 跨境 |
| 其他 | 10 | 命名和引用更新 |

**参考价值（🔵 C）— 20 文件**：设计思路可参考但接口已被新设计覆盖。

**归档淘汰（⚪ D）— 10 文件**：早期 v1.x 合约已被 v2.7 替代。

### 4.5 ADR (doc/adr/) — 28 文件

**直接移植（🟢 A）— 15 文件**：

| ADR | 决策主题 | 目标架构章节 |
|-----|---------|-------------|
| `001-three-layer-architecture.md` | 三层架构 | §1 总体架构 |
| `003-memory-seven-layers.md` | 记忆分层 | §3.5 记忆 |
| `005-security-model.md` | 安全模型 | §11 安全 |
| `006-llm-provider-strategy.md` | LLM 策略 | §15 Provider |
| `012-sqlite-phase-1-2-primary-store.md` | SQLite 选型 | §26 存储 |
| `016-oapeflir-loop-model.md` | OAPEFLIR 模型 | §13 OAPEFLIR |
| `018-rollout-eleven-state-machine.md` | Rollout 状态机 | §32 部署 |
| `019-agent-handoff-four-layer-protocol.md` | Agent 交接 | §19 委托 |
| `020-memory-six-plane-model.md` | 记忆六平面 | §3.5 |
| `060-explicit-planning-hub.md` | Planning Hub | §13 OAPEFLIR-P |
| `066-plugin-spi-framework.md` | Plugin SPI | §30 |
| `072-oapeflir-testing-strategy.md` | OAPEFLIR 测试 | §27 |
| `075-controlled-rollout-release.md` | 受控发布 | §32 |
| `078-knowledge-plane-architecture.md` | 知识架构 | §3.4 |
| `079-feedback-hub-signals.md` | 反馈信号 | §56 |

**改造移植（🟡 B）— 8 文件**：决策有效但需扩展适配七层架构。

| ADR | 改造要点 |
|-----|---------|
| `002-division-system.md` | 需增加 §46 组织层次对 Division 的影响 |
| `004-workflow-routing.md` | 需适配 §40 目标分解引擎的多级路由 |
| `007-evolution-engine.md` | 需对齐 v2.7 §65 行为漂移检测 |
| `008-cost-model.md` | 需扩展 §66 成本归因优化 |
| `009-deployment-ops.md` | 需增加 §64 边缘/离线部署 |
| `011-effect-ts-adoption.md` | 需重新评估 Effect-TS 在新平台中的采用决策 |
| `013-eventemitter-phase-2-boundary.md` | 需评估 Phase 2 是否沿用 EventEmitter |
| `017-knowledge-architecture-refactor.md` | 需对齐 v2.7 §50 知识域隔离 |

**参考价值（🔵 C）— 3 文件**：`010-commercial-model.md`、`014-org-model-code-boundary.md`、`080-learn-hub-pattern-detection.md`

**归档淘汰（⚪ D）— 2 文件**：`015-unified-extension-marketplace.md`（被 v2.7 §55 替代）、早期草案 ADR

### 4.6 治理文档 (doc/governance/) — 8 文件

| 文件 | 等级 | 移植说明 |
|------|------|---------|
| `source_of_truth.md` | 🟢 A | 数据源治理规则直接适用 |
| `change_control.md` | 🟢 A | 变更控制流程直接适用 |
| `naming_and_directory_conventions.md` | 🟢 A | 命名和目录约定直接适用 |
| `glossary_and_terminology.md` | 🟢 A | 术语表直接适用，需补充 v2.7 Appendix G 术语 |
| `autonomy_boundary_policy.md` | 🟡 B | 需对齐 v2.7 §42 渐进式自主权模型 |
| `rollout_release_policy.md` | 🟡 B | 需对齐 v2.7 §32 部署策略 |
| `phase1_scope_freeze.md` | 🟡 B | 需映射到新平台 Phase 定义 |
| `README.md` | 🔵 C | 导航文件参考 |

### 4.7 指南文档 (doc/guides/) — 4 文件

| 文件 | 等级 | 移植说明 |
|------|------|---------|
| `quickstart.md` | 🟢 A | 快速启动指南可直接复用，更新端口/配置 |
| `contributing.md` | 🟢 A | 贡献指南直接适用 |
| `division-authoring.md` | 🟡 B | 需更新以反映 v2.7 §37 DomainDescriptor |
| `skill-authoring.md` | 🟡 B | 需更新以反映 v2.7 §30 Pack 生命周期 |

### 4.8 运维文档 (doc/operations/) — 30+ 文件

**直接移植（🟢 A）— 5 文件**：

| 文件 | 移植说明 |
|------|---------|
| `runbooks/database-issues.md` | 数据库问题运维手册直接适用 |
| `runbooks/memory-pressure.md` | 内存压力处理直接适用 |
| `runbooks/incident-response-playbook.md` | 事故响应剧本直接适用 |
| `test_coverage_baseline_gate.md` | 覆盖率门禁规则直接适用 |
| `src_module_test_matrix.md` (1,455行) | 模块-测试映射矩阵，需更新模块列表但格式直接复用 |

**改造移植（🟡 B）— 10 文件**：Phase 计划、Roadmap、实施计划需重新映射到七阶段路线图。

**参考/归档 — 15+ 文件**：历史 TODO、旧 gap 分析、archive/ 下已归档计划。

### 4.9 评审文档 (doc/reviews/) — 21 文件

| 等级 | 文件 | 说明 |
|------|------|------|
| 🟡 B | `test_strategy_plan.md` (1,957行) | 测试策略可复用，需扩展 Layer 4-7 |
| 🟡 B | `authoritative_task_store_refactoring_plan.md` (1,233行) | TaskStore 重构计划对新平台存储层有指导价值 |
| 🟡 B | `opeli_detailed_design.md` (4,484行) | OAPEFLIR 详细设计与 v2.7 §13 直接对应 |
| 🔵 C | `production_gap_detailed_solutions.md` (2,590行) | 生产差距解决方案作为参考 |
| 🔵 C | `production_gap_solution_v2.md` (2,598行) | 同上 v2 |
| 🔵 C | `design_gap_analysis.md` (2,424行) | 设计差距分析作为新平台验证 checklist |
| 🔵 C | 其他 9 文件 | 历史评审记录作为参考 |
| ⚪ D | 6 文件 | 旧版评审已被替代 |

### 4.10 参考文档 (doc/reference/) — 17 文件

| 等级 | 说明 |
|------|------|
| 🔵 C（8 文件） | 从老 monolith 机械拆分出的架构/模块/安全/存储/通信章节，设计思路可参考 |
| ⚪ D（9 文件） | 已被 v2.7 完全覆盖的旧版内容，归档 |

### 4.11 研究文档 (doc/research/) — 28 文件

| 等级 | 说明 |
|------|------|
| 🔵 C（全部 28 文件） | 竞品分析（Claude Code/Codex/Goose/Aider/MetaGPT/LangGraph/Temporal/DeerFlow 等）和参考对齐评审。不直接移植但对新平台设计决策有高参考价值。建议保留 `doc/research/` 目录整体移入新项目 |

### 4.12 归档文档 (doc/archive/) — 3 文件

| 等级 | 说明 |
|------|------|
| ⚪ D（全部 3 文件） | `automatic-agent-architecture-monolith-dedup.md` (11,392行) 等为历史归档，仅保留供审计追溯 |

---

## 五、代码模块移植详细评估

### 5.1 Layer 1 — 基础设施层

#### 🟢 直接移植（8 模块）

| 模块 | 文件/行 | 目标章节 | 移植说明 |
|------|---------|---------|---------|
| `core/types/` | 21 / 2,887 | §5 契约 | Branded ID、状态枚举、15+ 领域记录类型。零外部依赖，TypeScript 严格模式。**原样移植** |
| `core/errors.ts` | 1 / 490 | §10 异常 | 14 分类 `AppError` 层次结构 + 序列化。零依赖。**原样移植** |
| `core/constants/` | 2 / 16 | 跨层 | 时间常量。**原样移植** |
| `core/utils/` | 2 / 109 | 跨层 | BoundedCache 工具类。**原样移植** |
| `core/results/` | 2 / 390 | §5 契约 | ResultEnvelope 模式。**原样移植** |
| `core/locking/` | 8 / 635 | §31 容灾 | 分布式锁抽象（SQLite/Redis/PG advisory）。干净 adapter 模式。**原样移植** |
| `core/queue/` | 6 / 771 | §4 事件 | 队列抽象（SQLite/Redis）+ factory。**原样移植** |
| `core/lifecycle/` | 3 / 276 | §8 扩展 | ServiceRegistry + teardown 排序。**原样移植** |

#### 🟡 改造移植（5 模块）

| 模块 | 文件/行 | 目标章节 | 改造要点 |
|------|---------|---------|---------|
| `core/storage/` | 101 / 26,102 | §26 数据模型 | `AuthoritativeTaskStore` 是全局数据访问门面（god object）。核心 SQL schema/migration 可复用，但需拆分为按领域的 Repository。PG async adapter 模式优秀可保留 |
| `core/events/` | 8 / 1,894 | §28 事件 | 3-tier DurableEventBus 设计精良。需增加 v2.7 §28 新增的 8 个事件命名空间（delegation.*/hibernation.*/prompt.*/eval.*/cost.*/approval_flow.*/agent_lifecycle.*/circuit_breaker.*） |
| `core/config/` | 27 / 6,776 | §24 配置 | Zod schema 验证 + 8 层配置治理可复用。需增加 §46 组织层次配置 + §64 边缘部署配置 |
| `core/cache/` | 27 / 2,518 | §26 缓存 | L1/L2/L3 多级缓存 + 域策略。需增加 §50 知识域隔离的缓存分区 |
| `core/api/` | 30 / 5,006 | §6 API | HTTP server + OIDC/OAuth + WebSocket。需增加 §39 NL 入口端点 + §44 非技术用户 API + §48 SSO/SCIM 端点 |

#### 🔵 参考价值（1 模块）

| 模块 | 说明 |
|------|------|
| `core/resource/` | 2 / 361 | ProcessTracker 进程追踪逻辑可参考，但新平台可能采用不同的进程管理模式 |

### 5.2 Layer 2 — AI 运营层

#### 🟢 直接移植（3 模块）

| 模块 | 文件/行 | 目标章节 | 移植说明 |
|------|---------|---------|---------|
| `core/providers/` | 10 / 4,436 | §15 LLM | UnifiedChatProvider（Anthropic/OpenAI/MiniMax）+ CircuitBreaker + CredentialPool + ModelRouting。干净 adapter 模式。**A2 移植**：核心实现不动，需增加 §15.6 流式错误处理 adapter（架构契合度=中，改造范围≤15%） |
| `core/workflow/` | 4 / 1,011 | §13 OAPEFLIR | MinimalWorkflow + Validator + OutputSchema + StepRetryPolicy。**原样移植** |
| `core/artifacts/` | 13 / 1,095 | §30 Pack | Artifact 模型/存储/版本/发布/治理/敏感内容扫描。**A2 移植**：需增加 evidence/compliance chain adapter + §69 多模态 artifact + §55 marketplace 发布接口（架构契合度=中，改造范围≤15%） |

#### 🟡 改造移植（7 模块）

| 模块 | 文件/行 | 目标章节 | 改造要点 |
|------|---------|---------|---------|
| `core/runtime/` | 114 / 30,348 | §9,§13,§31 | **最大模块，最高风险**。ExecutionDispatch/Lease/Worker/HA/Recovery/HotUpgrade 核心逻辑可复用。改造要点：(1) 拆分为 Dispatch/Lease/Worker/HA/Recovery 五个独立 bounded context；(2) 适配 §41 主动式 Agent 调度；(3) 增加 §52 多 Region dispatch；(4) 增加 §53 资源竞争管理 |
| `core/agent-loop/` | 31 / 2,562 | §13 OAPEFLIR | OapeflirLoopService + Assessment + Handoff + StageTimeline。核心循环逻辑完善。需增加 §42 自主权评估阶段 + §59 可解释性输出 |
| `core/planning/` | 9 / 314 | §13 OAPEFLIR-P | PlanBuilder/DAGValidator/StrategySelector。需扩展 §40 目标分解引擎的多级分解能力 |
| `core/tools/` | 36 / 13,500 | §30 工具 | CommandExecutor/SkillExecution/ToolSanitizer/PathScope/MCPGuard。安全边界完善。需增加 §69 多模态工具支持 + §37 领域工具注册 |
| `core/orchestration/` | 3 / 1,054 | §13 编排 | IntakeRouter/WorkflowPlanner/AgentTeamService。需适配 §39 NL 入口 + §40 目标分解 + §46 组织层次路由 |
| `core/feedback/` | 5 / 532 | §56 反馈 | FeedbackCollector/SignalPreprocessor。需扩展 §56 反馈驱动持续改进管线的完整信号类型 |
| `core/learning/` | 14 / 682 | §13 OAPEFLIR-L | FailurePatternMiner/ExperienceDistillation/StrategyLearning + 4 个 pattern detector。需增加 §65 行为漂移检测模式 |

#### 🔵 参考价值（1 模块）

| 模块 | 说明 |
|------|------|
| `core/evaluation/` | 6 / 1,429 | PostExecutionQualityGate/LlmEvalService 逻辑可参考，但 v2.7 §17 定义了更完整的模型评估框架，需重新设计 |

### 5.3 Layer 3 — 业务域接入层

#### 🟢 直接移植（2 模块）

| 模块 | 文件/行 | 目标章节 | 移植说明 |
|------|---------|---------|---------|
| `core/domain-registry/` | 14 / 2,456 | §37 领域建模 | DomainRegistryService/PluginSpiRegistry/ContractRegistry/ToolBundleRegistry/WorkflowRegistry/PluginRuntimeHost。SPI 模式干净。**原样移植**，需增加 DomainDescriptor 注册 |
| `core/divisions/` | 4 / 1,632 | §37 领域 | DivisionLoader + YAML 安全加载 + HrRoleGovernance。**原样移植** |

#### 🟡 改造移植（1 模块）

| 模块 | 文件/行 | 目标章节 | 改造要点 |
|------|---------|---------|---------|
| `plugins/` | 20 / 1,672 | §30,§55 | 16 个 builtin plugin（6 域：coding/ops/growth/game-dev/asset-production/livestream）。SPI adapter/presenter/retriever/validator/planner 模式可复用。需增加 §55 市场生态的打包/发布/废弃生命周期 |

### 5.4 Layer 4 — 智能交互层

#### 🟢 直接移植（1 模块）

| 模块 | 文件/行 | 目标章节 | 移植说明 |
|------|---------|---------|---------|
| `core/messages/` | 2 / 509 | §39 消息 | MessageParts + TokenEstimator。**原样移植** |

#### 🟡 改造移植（3 模块）

| 模块 | 文件/行 | 目标章节 | 改造要点 |
|------|---------|---------|---------|
| `core/memory/` | 16 / 3,335 | §3.5 记忆 | 分层记忆（session/project/user/global）+ 巩固/晋升/检索/质量。需增加 §50 知识域隔离的记忆分区 + §64 边缘部署的本地记忆缓存 |
| `core/knowledge/` | 23 / 3,443 | §3.4 知识 | KnowledgePlane/Ingestion/Embedding/VectorStore/Graph/Retrieval + governance。需增加 §50 知识域隔离 + §69 多模态知识索引 |
| `gateway/` | 13 / 3,471 | §6,§44 | ChannelGateway（Telegram/Slack/Webhook）+ WebSocket + SSE。需增加 §39 NL 通道 + §44 非技术用户前端 gateway + §57 外部系统集成网关 |

### 5.5 Layer 5 — 组织治理层

#### 🟢 直接移植（2 模块）

| 模块 | 文件/行 | 目标章节 | 移植说明 |
|------|---------|---------|---------|
| `core/security/` | 19 / 7,125 | §11 安全 | SandboxPolicy/PolicyEngine/SecretManagement/AuditIntegrity/FieldEncryption/NetworkEgress/CveIntelligence。**A2 移植**：核心安全机制不动，需增加 §49 分部门安全策略引擎 adapter（架构契合度=中，改造范围≤15%） |
| `core/cost/` | 2 / 64 | §18 成本 | BudgetGuard。轻量但完整。**原样移植**，需扩展 §66 成本归因优化 |

#### 🟡 改造移植（3 模块）

| 模块 | 文件/行 | 目标章节 | 改造要点 |
|------|---------|---------|---------|
| `core/approvals/` | 3 / 495 | §21 HITL | ApprovalService/TimeoutExecutor。需增加 §47 组织架构审批路由 + 多方审批/委托 |
| `core/compliance/` | 2 / 346 | §23,§68 | AuditExportService。需扩展 §68 合规报告自动生成 + §52 GDPR 跨境 |
| `core/hr/` | 2 / 572 | §46 组织 | HrRoleGovernanceService。需增加 §46 组织层次模型 + §51 分级治理委托 |

### 5.6 Layer 6 — 规模化运行层

#### 🟡 改造移植（2 模块）

| 模块 | 文件/行 | 目标章节 | 改造要点 |
|------|---------|---------|---------|
| `core/deployment/` | 2 / 502 | §32 部署 | TrafficRoutingService（blue-green/canary）。需扩展 §52 多 Region 部署 + §64 边缘部署 |
| `core/improvement/` | 11 / 770 | §13 OAPEFLIR-IR | StrategyVersioning/AutonomyBoundary/GuardrailEvaluator/AutoRollback/CanaryRouter/RolloutStateMachine。需对齐 §42 渐进式自主权 + §55 市场 Agent 的版本管理 |

#### 🔵 参考价值（1 模块）

| 模块 | 说明 |
|------|------|
| `core/product/` | 22 / 7,109 | BillingService/Marketplace/TenantPlatform/PMF/EnterpriseCapability。商业逻辑与老系统 Phase 1-2 耦合较深，需根据 v2.7 §54 SLA 分级 + §55 市场生态 重新设计 |

### 5.7 Layer 7 — 运营成熟度层

#### 🟢 直接移植（2 模块）

| 模块 | 文件/行 | 目标章节 | 移植说明 |
|------|---------|---------|---------|
| `core/observability/` | 36 / 8,172 | §12,§27 | StructuredLogger/HealthService/Prometheus/OpenTelemetry/SLO-Alerting/AnomalyDetection。**原样移植**，需增加 §67 可视化调试支持 |
| `core/reliability/` | 8 / 1,112 | §10 风险 | FailureClassification/RepairPipeline/PatchBundle/TaskCard。**原样移植** |

#### 🟡 改造移植（3 模块）

| 模块 | 文件/行 | 目标章节 | 改造要点 |
|------|---------|---------|---------|
| `core/ops/` | 19 / 8,308 | §12,§32 | DoctorService/OpsGovernance/EnterpriseGovernance/ReleasePipeline/HumanTakeover/AutoStopLoss。需增加 §60 紧急制动 + §70 平台自运维 Agent |
| `core/stability/` | 31 / 12,789 | §27,§32 | 20+ 稳定性排练场景 + evidence bundling。需增加 §64 边缘部署排练 + §65 漂移检测排练 |
| `core/evolution/` | 12 / 2,268 | §65 漂移 | EvolutionMVP/Reflection/Proposal/Benchmark/Rollout。需对齐 §65 行为漂移检测 + §61 统一生命周期管理 |

### 5.8 跨层 — CLI

#### 🟡 改造移植（整体）

| 模块 | 文件/行 | 改造要点 |
|------|---------|---------|
| `cli/` | 78 / 6,149 | 78 个 CLI 入口是薄包装层，依赖底层 service。移植策略：**随 service 移植而同步移植**。需增加 §39 NL CLI 入口 + §43 运营看板 CLI + §46 组织管理 CLI |

### 5.9 辅助资产

#### config/ — 🟢 直接移植

| 目录 | 文件数 | 移植说明 |
|------|--------|---------|
| `config/bootstrap/` | 1 | Phase 配置直接复用 |
| `config/runtime/` | 6 | 运行时配置（含 5 环境变体）直接复用 |
| `config/security/` | 6 | 安全配置直接复用 |
| `config/providers/` | 3 | Provider + 模型元数据直接复用 |
| `config/environments/` | 5 | 环境配置直接复用 |
| `config/plugins/` | 1 | 插件配置直接复用 |
| `config/domains/` | 1 | 域配置直接复用，需扩展 DomainDescriptor |
| `config/gateways/` | 1 | 网关配置直接复用 |
| `config/workflows/` | 1 | 工作流配置直接复用 |
| `config/knowledge/` | 1 | 知识配置直接复用 |
| `config/product/` | 1 | 产品配置直接复用 |

#### divisions/ — 🟡 改造移植

| 内容 | 移植说明 |
|------|---------|
| 11 个 division 定义（含 YAML + roles/ + workflows/ + schemas/） | 🟡 降级原因：v2.7 §37 DomainDescriptor 语义模型对 division YAML 结构有破坏性变更，需增加 descriptor 元数据字段、领域能力声明、SLA 绑定。YAML schema 变更影响所有 11 个定义文件 |

#### tests/ — 详见 §5.10 测试移植详细评估

#### 基础设施文件 — 🟢 直接移植

| 文件 | 移植说明 |
|------|---------|
| `package.json` | 依赖声明和 110+ npm scripts 直接复用，需清理不再需要的脚本 |
| `tsconfig.json` / `tsconfig.build.json` | TypeScript 严格配置直接复用 |
| `eslint.config.js` | ESLint 9 flat config 直接复用 |
| `.c8rc.json` | 覆盖率配置直接复用 |
| `Dockerfile` | 多阶段构建直接复用，需增加边缘部署变体 |
| `docker-compose.yml` | 三服务编排直接复用，需增加 Redis cluster 变体 |
| `.env.example` | 346 行环境变量模板直接复用，需增加 Layer 4-7 配置项 |
| `.github/workflows/` | 4 个 CI workflow 直接复用 |
| `scripts/` | CI/构建脚本直接复用 |
| `deploy/` | 部署清单直接复用 |

### 5.10 测试移植详细评估

> **测试总规模**：1,069 文件 / ~229,196 行

#### 测试基础设施依赖

| 依赖 | 说明 | 移植影响 |
|------|------|---------|
| Node.js 22 内置测试运行器 | `import test from "node:test"` + `assert/strict` | 🟢 无迁移成本，新平台继续使用 |
| SQLite (DatabaseSync) | 几乎所有测试都通过 `SqliteDatabase` 创建临时 DB | 🟡 需确保新平台保留 SQLite 测试后端 |
| TypeScript ESM | 全部使用 `.js` 扩展名 ESM 导入 | 🟢 新平台延续 ESM |
| 手写 Mock（无外部 mock 库） | `typed-factories.ts` + 确定性 bridge 模式 | 🟢 零外部依赖，直接移植 |
| PostgreSQL（可选） | 仅 `pg-test-helper.ts` 和少量 storage 测试，需 `AA_TEST_PG_DSN` 环境变量 | 🟢 可选依赖，不影响主流程 |
| 临时文件系统工作区 | `createTempWorkspace()` / `cleanupPath()` | 🟢 直接移植 |

#### 5.10.1 tests/helpers/ — 19 文件 / ~2,093 行

| 文件 | 行数 | 等级 | 用途 | 移植说明 |
|------|------|------|------|---------|
| `fs.ts` | 21 | 🟢 A | 临时工作区创建/清理 | 几乎所有测试依赖，**最先移植** |
| `seed.ts` | 100 | 🟢 A | 数据库种子数据（seedTaskAndExecution） | E2E/golden/integration 依赖 |
| `typed-factories.ts` | 143 | 🟢 A | 类型安全 mock 工厂（createPartial/unsafeCast） | 广泛使用 |
| `env.ts` | 53 | 🟢 A | 环境变量保存/恢复 | Config/CLI 测试依赖 |
| `golden.ts` | 80 | 🟢 A | Golden 快照断言（支持 UPDATE_GOLDEN=1） | Golden 测试依赖 |
| `e2e-harness.ts` | 131 | 🟢 A | E2E 测试夹具（SQLite + Store + Workspace） | E2E 测试依赖 |
| `integration-context.ts` | 131 | 🟢 A | 集成测试上下文 | Integration 测试依赖 |
| `repository-harness.ts` | 80 | 🟢 A | Repository 测试夹具 | Storage 单元测试依赖 |
| `concurrent-runner.ts` | 158 | 🟢 A | 并发操作运行器 + 不变量检查 | 并发测试依赖 |
| `test-cleanup.ts` | 27 | 🟢 A | 单例重置 + 进程清理 | 需隔离的测试依赖 |
| `process-guard.ts` | 90 | 🟢 A | 进程泄漏检测 | Runtime/Tool 测试依赖 |
| `fixtures/base.ts` | 99 | 🟢 A | 最小有效记录工厂 | 单元测试依赖 |
| `fixtures/composite.ts` | 227 | 🟢 A | 复杂多实体状态工厂 | 集成测试依赖 |
| `perception.ts` | 66 | 🟢 A | Perception 数据集种子 | Product 测试依赖 |
| `pmf.ts` | 251 | 🟢 A | PMF 验证数据集种子 | PMF 测试依赖 |
| `billing.ts` | 36 | 🟢 A | 计费数据集种子 | Billing 测试依赖 |
| `api.ts` | 362 | 🟡 B | HTTP API 全栈引导 | 需适配新 API 层 |
| `cli.ts` | 30 | 🟡 B | CLI 脚本运行器 | 需适配新 CLI 路径 |
| `pg-test-helper.ts` | 35 | 🟡 B | PostgreSQL 测试辅助 | 需适配新 PG 配置 |

#### 5.10.2 tests/unit/ — 758 文件 / ~169,943 行

按源模块分组的移植评估：

| 源模块 | 测试文件数 | 测试行数 | 等级 | 随 Phase 移植 |
|--------|-----------|---------|------|-------------|
| `types/` | 22 | 5,470 | 🟢 A | Phase 1 |
| `errors.ts` | 1 | 407 | 🟢 A | Phase 1 |
| `constants/` | 3 | 113 | 🟢 A | Phase 1 |
| `utils/` | 3 | 421 | 🟢 A | Phase 1 |
| `results/` | 3 | 806 | 🟢 A | Phase 1 |
| `lifecycle/` | 3 | 443 | 🟢 A | Phase 1 |
| `storage/` | 51 | 18,756 | 🟡 B | Phase 2 |
| `events/` | 10 | 1,729 | 🟢 A | Phase 2 |
| `config/` | 37 | 5,935 | 🟢 A | Phase 2 |
| `locking/` | 12 | 1,931 | 🟢 A | Phase 2 |
| `queue/` | 8 | 1,425 | 🟢 A | Phase 2 |
| `cache/` | 34 | 4,675 | 🟢 A | Phase 2 |
| `security/` | 30 | 6,986 | 🟢 A | Phase 3 |
| `approvals/` | 5 | 1,044 | 🟢 A | Phase 3 |
| `cost/` | 4 | 450 | 🟢 A | Phase 3 |
| `compliance/` | 3 | 479 | 🟢 A | Phase 3 |
| `hr/` | 3 | 350 | 🟢 A | Phase 3 |
| `providers/` | 16 | 5,694 | 🟢 A | Phase 4 |
| `tools/` | 48 | 9,959 | 🟢 A | Phase 4 |
| `workflow/` | 10 | 1,572 | 🟢 A | Phase 4 |
| `artifacts/` | 9 | 1,172 | 🟢 A | Phase 4 |
| `runtime/` | 92 | 22,531 | 🟡 B | Phase 5 |
| `agent-loop/` | 15 | 3,199 | 🟢 A | Phase 6 |
| `planning/` | 7 | 2,024 | 🟢 A | Phase 6 |
| `feedback/` | 4 | 1,301 | 🟢 A | Phase 6 |
| `learning/` | 12 | 1,928 | 🟢 A | Phase 6 |
| `evaluation/` | 7 | 936 | 🟢 A | Phase 6 |
| `improvement/` | 9 | 2,069 | 🟢 A | Phase 6 |
| `memory/` | 26 | 8,549 | 🟢 A | Phase 7 |
| `knowledge/` | 14 | 3,755 | 🟢 A | Phase 7 |
| `messages/` | 5 | 997 | 🟢 A | Phase 7 |
| `gateway/` | 16 | 3,754 | 🟢 A | Phase 7 |
| `domain-registry/` | 11 | 2,167 | 🟢 A | Phase 8 |
| `divisions/` | 8 | 1,939 | 🟢 A | Phase 8 |
| `plugins/` | 18 | 2,644 | 🟢 A | Phase 8 |
| `observability/` | 35 | 7,556 | 🟢 A | Phase 9 |
| `ops/` | 24 | 4,990 | 🟢 A | Phase 9 |
| `stability/` | 15 | 3,145 | 🟢 A | Phase 9 |
| `evolution/` | 19 | 4,199 | 🟢 A | Phase 9 |
| `reliability/` | 14 | 2,723 | 🟢 A | Phase 9 |
| `product/` | 29 | 7,162 | 🟢 A | Phase 9 |
| `deployment/` | 3 | 536 | 🟢 A | Phase 9 |
| `cli/` | 2 | 346 | 🟡 B | Phase 10 |

**小结**：758 个单元测试文件中 **~720 个可直接移植**（🟢），仅 storage/（51 文件）、runtime/（92 文件）和 cli/（2 文件）需改造适配（🟡）。

#### 5.10.3 tests/integration/ — 247 文件 / ~49,342 行

按测试类别分组：

| 类别 | 文件数 | 行数 | 等级 | 移植说明 |
|------|--------|------|------|---------|
| **安全边界** | 64 | 8,929 | 🟡 B | 命令注入/路径穿越/SSRF/数据泄漏/沙箱逃逸/JWT 算法降级/容器边界等。与沙箱实现耦合，需验证新平台兼容性 |
| **CLI 集成** | 32 | 8,998 | 🟡 B | 78 个 CLI 命令的集成测试。调用 `dist/` 编译脚本，需适配新 CLI 路径 |
| **Runtime 集成** | 53 | 9,498 | 🟡 B | Dispatch/Lease/Worker/Recovery/排练场景。与 SQLite 存储和运行时生命周期深度耦合 |
| **合约验证** | 5 | 1,459 | 🟢 A | OpenAPI/事件 schema/Gateway adapter/Provider 接口/Store facade 合约。**验证接口不验证实现，直接移植** |
| **数据完整性** | 3 | 1,227 | 🟡 B | 审批-执行一致性/事件列映射/记忆引用完整性。依赖 SQLite 列级验证 |
| **恢复** | 6 | 1,456 | 🟡 B | 审批超时恢复/调度补偿/事件重放/租约崩溃恢复/SQLite WAL 恢复/写回补偿。含 SQLite 特定测试 |
| **并发** | 5 | 1,401 | 🟡 B | 命令并发限制/DB busy 重试/调度竞态/事件并发/租约竞争。部分 SQLite 特定 |
| **可靠性** | 6 | 1,423 | 🟢 A | 降级行为/消息队列/数据无损/审计/终态保证。**验证不变量，直接移植** |
| **可观测性** | 6 | 2,011 | 🟢 A | 审批级联/健康检查/指标/SLI-SLO/任务面板/时间线诊断。直接移植 |
| **其他 36 子目录** | 67 | ~12,940 | 🟢 A / 🟡 B | API(2)/审批(2)/缓存(1)/合规(1)/配置(2)/成本(2)/部署(1)/Division(2)/评估(1)/事件(2)/演化(1)/网关(1)/HR(1)/生命周期(5🟡)/锁(1)/记忆(1)/消息(2)/迁移(3🟡)/运维(3🟡)/编排(1)/产品(3)/Provider(2)/队列(1)/资源(1)/结果(2)/会话(1)/冒烟(5)/浸泡(2🔵)/稳定性(1)/存储(5🟡)/工具(2)/类型(2)/工具集(1)/工作流(2) |

**小结**：247 个集成测试中 **~150 个可直接移植**（🟢），**~90 个需改造**（🟡，主要集中在安全/CLI/Runtime/Recovery/存储），**~7 个仅供参考**（🔵，浸泡测试）。

#### 5.10.4 tests/golden/ — 8 文件 / ~1,662 行

| 文件 | 行数 | 等级 | 移植说明 |
|------|------|------|---------|
| `diagnostics-bundle.test.ts` | 160 | 🟢 A | 诊断包结构快照 |
| `openapi-document.test.ts` | 187 | 🟢 A | OpenAPI 文档快照 |
| `release-plan-output.test.ts` | 202 | 🟢 A | 发布计划 Markdown 快照 |
| `session-summary.test.ts` | 148 | 🟢 A | 会话摘要快照 |
| `phase1a-golden-tasks.test.ts` | 30 | 🟢 A | Phase1a 金色任务 |
| `prompt-assembly.test.ts` | 220 | 🟢 A | Prompt 分区/缓存键快照 |
| `workflow-validation.test.ts` | 145 | 🟢 A | 工作流验证快照 |
| `cli-help-text.test.ts` | 238 | 🟡 B | CLI 帮助文本快照。需适配新 CLI 命令列表 |
| `snapshots/` (3 文件) | 332 | 🟢 A | 快照数据文件 |

#### 5.10.5 tests/e2e/ — 10 文件 / ~2,807 行

| 文件 | 行数 | 等级 | E2E 流程 |
|------|------|------|---------|
| `task-lifecycle.test.ts` | 371 | 🟡 B | 任务全生命周期：创建→调度→执行→完成。API/模型/运行时均有变更，需适配 |
| `multi-step-workflow.test.ts` | 406 | 🟡 B | 多步骤工作流：步骤依赖→输出传递→完成。工作流模型扩展影响断言 |
| `lease-recovery.test.ts` | 371 | 🟡 B | 租约生命周期：获取→过期→恢复→竞争。runtime 拆分后 lease 接口变更 |
| `operator-takeover.test.ts` | 306 | 🟡 B | 运维接管：运行→暂停→人工控制→恢复。§60 紧急制动引入新接管路径 |
| `error-propagation.test.ts` | 298 | 🟡 B | 错误传播：执行失败→终态→错误码→重试。状态机扩展影响终态判定 |
| `oapeflir-full-loop.test.ts` | 248 | 🟡 B | OAPEFLIR 8 阶段全循环。§42 自主权评估新增阶段 |
| `session-memory-flow.test.ts` | 237 | 🟡 B | 会话生命周期 + 记忆关联。§50 知识域隔离影响记忆访问 |
| `gateway-webhook-flow.test.ts` | 230 | 🟡 B | Webhook 触发→任务创建→生命周期转换。§39 NL 入口改变入口 API |
| `streaming-response.test.ts` | 208 | 🟡 B | 流式响应：会话流状态 + 背压。§15.6 流式错误处理扩展 |
| `approval-event-flow.test.ts` | 132 | 🟡 B | 审批事件流：阻塞→Tier1 事件→消费者确认。§47 组织审批路由变更 |

**降级说明**：v1.0 将全部 10 个 E2E 测试标记为 🟢，经复审降级为 🟡。E2E 测试贯穿 API→模型→运行时→存储全链路，runtime 拆分、API 扩展、状态机变更、组织治理等改造将导致测试夹具和断言需要适配。核心测试场景（lifecycle/workflow/recovery）可复用，但预计改造量 15%-30%。

#### 5.10.6 tests/performance/ — 6 文件 / ~874 行

| 文件 | 行数 | P99 目标 | 等级 |
|------|------|---------|------|
| `feedback-perf.test.ts` | 118 | <10ms | 🟢 A |
| `handoff-perf.test.ts` | 167 | <5ms | 🟢 A |
| `knowledge-perf.test.ts` | 127 | <100ms/<500ms | 🟢 A |
| `oapeflir-perf.test.ts` | 150 | <30s | 🟢 A |
| `planning-perf.test.ts` | 163 | <50ms | 🟢 A |
| `plugin-perf.test.ts` | 149 | <200ms | 🟢 A |
| `performance.bak/` (10 文件) | 2,016 | — | 🔵 C |

**全部 6 个性能测试可直接移植** 🟢。`.bak/` 下 10 个已废弃文件仅供参考。

#### 5.10.7 tests/fixtures/ — 4 文件 / ~459 行

| 文件 | 行数 | 等级 | 移植说明 |
|------|------|------|---------|
| `migration/generate-snapshots.ts` | 134 | 🟡 B | SQLite 快照生成脚本，需适配新迁移版本序列 |
| `migration/migration-fixtures.test.ts` | 235 | 🟡 B | 迁移账本完整性测试 |
| `migration/snapshots/manifest.json` | 41 | 🟡 B | 快照版本清单 |
| `migration/README.md` | 49 | 🟢 A | 使用说明 |

#### 5.10.8 测试移植汇总

| 测试层 | 总文件 | 总行数 | 🟢 直接 | 🟡 改造 | 🔵 参考 |
|--------|--------|--------|---------|---------|---------|
| helpers/ | 19 | 2,093 | 16 | 3 | 0 |
| unit/ | 758 | 169,943 | ~720 | ~38 | 0 |
| integration/ | 247 | 49,342 | ~150 | ~90 | ~7 |
| golden/ | 8+3 | 1,662 | 10 | 1 | 0 |
| e2e/ | 10 | 2,807 | 0 | 10 | 0 |
| performance/ | 6+10 | 2,890 | 6 | 0 | 10 |
| fixtures/ | 4 | 459 | 1 | 3 | 0 |
| **合计** | **1,069** | **~229,196** | **~903** | **~145** | **~17** |

#### 5.10.9 测试随代码 Phase 移植对照表

| 移植 Phase | 源模块 | 对应测试目录 | 测试文件数 | 测试行数 |
|-----------|--------|------------|-----------|---------|
| **P0 (先行)** | — | `tests/helpers/` 全部 | 19 | 2,093 |
| **P1 Shared Kernel** | types, errors, constants, utils, results, lifecycle | `unit/types/` `unit/core/types/` `unit/core/errors.test.ts` `unit/constants/` `unit/utils/` `unit/results/` `unit/lifecycle/` + integration 对应 | ~38 | ~8,500 |
| **P2 Infra Foundation** | storage, events, config, locking, queue, cache | `unit/storage/` `unit/core/storage/` `unit/events/` `unit/config/` `unit/locking/` `unit/queue/` `unit/cache/` + `integration/storage/` `integration/events/` `integration/config/` `integration/cache/` `integration/locking/` `integration/queue/` `integration/migration/` `integration/concurrency/` + `fixtures/migration/` | ~180 | ~42,000 |
| **P3 Security** | security, approvals, cost, compliance, hr | `unit/security/` `unit/approvals/` `unit/cost/` `unit/compliance/` `unit/hr/` + `integration/security/` (64 文件!) `integration/approvals/` `integration/compliance/` `integration/cost/` `integration/hr/` | ~115 | ~20,000 |
| **P4 AI Ops Primitives** | providers, tools, workflow, artifacts | `unit/providers/` `unit/tools/` `unit/workflow/` `unit/artifacts/` + `integration/providers/` `integration/tools/` `integration/workflow/` | ~100 | ~22,000 |
| **P5 Runtime** | runtime | `unit/runtime/` `unit/core/runtime/` + `integration/runtime/` `integration/recovery/` `integration/reliability/` `integration/data-integrity/` | ~150 | ~42,000 |
| **P6 OAPEFLIR** | agent-loop, planning, feedback, learning, evaluation, improvement | `unit/core/agent-loop/` `unit/core/planning/` `unit/core/feedback/` `unit/core/learning/` `unit/core/evaluation/` `unit/core/improvement/` | ~56 | ~11,400 |
| **P7 Interaction** | memory, knowledge, messages, gateway | `unit/memory/` `unit/core/memory/` `unit/knowledge/` `unit/core/knowledge/` `unit/messages/` `unit/gateway/` + `integration/memory/` `integration/gateway/` `integration/messages/` | ~70 | ~18,000 |
| **P8 Business Domain** | domain-registry, divisions, plugins | `unit/core/domain-registry/` `unit/divisions/` `unit/plugins/` + `integration/divisions/` | ~40 | ~7,700 |
| **P9 Maturity** | observability, ops, stability, evolution, reliability, product, deployment | `unit/observability/` `unit/ops/` `unit/stability/` `unit/evolution/` `unit/reliability/` `unit/product/` `unit/deployment/` + `integration/observability/` `integration/ops/` `integration/stability/` `integration/evolution/` `integration/product/` `integration/deployment/` | ~165 | ~40,000 |
| **P10 CLI + E2E + Golden** | cli, e2e flows | `unit/cli/` `integration/cli/` (32 文件) + `e2e/` (10 文件) + `golden/` (8 文件) + `performance/` (6 文件) + `integration/smoke/` (5 文件) + `integration/contract/` (5 文件) | ~68 | ~17,500 |

---

## 六、移植执行顺序

### 6.1 十阶段移植路线图

```
Phase │ 内容                          │ 文件数 │ 行数   │ 前置依赖  │ 预估工作量
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  P0  │ Test Helpers (先行)            │   19   │  ~2.1K │ 无       │ 0.5 人天
      │ tests/helpers/ 全部            │        │        │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  1   │ Shared Kernel + 测试           │  ~68   │ ~13.2K │ P0       │ 1.5 人天
      │ types/ + errors.ts +          │  src30 │  4.7K  │          │
      │ constants/ + utils/ +         │ test38 │  8.5K  │          │
      │ results/ + lifecycle/         │        │        │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  2   │ Infra Foundation + 测试        │ ~325   │ ~71.5K │ Phase 1  │ 7 人天
      │ storage/ + events/ + config/  │ src145 │ 29.5K  │          │
      │ + locking/ + queue/ + cache/  │ test180│ 42.0K  │          │
      │ + config/ 目录 + fixtures/    │        │        │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  3   │ Security & Governance + 测试   │ ~141   │ ~28.1K │ Phase 2  │ 3.5 人天
      │ security/ + approvals/ +      │  src26 │  8.1K  │          │
      │ cost/ + compliance/ + hr/     │ test115│ 20.0K  │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  4   │ AI Ops Primitives + 测试       │ ~163   │ ~41.5K │ Phase 2  │ 4.5 人天
      │ providers/ + tools/ +         │  src63 │ 19.5K  │          │
      │ workflow/ + artifacts/        │ test100│ 22.0K  │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  5   │ Runtime Core + 测试 (拆分后)    │ ~264   │ ~72.3K │ Phase 2-4│ 10 人天
      │ runtime/ → dispatch/lease/    │ src114 │ 30.3K  │          │
      │ worker/ha/recovery/           │ test150│ 42.0K  │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  6   │ OAPEFLIR Pipeline + 测试       │ ~119   │ ~15.5K │ Phase 4-5│ 3.5 人天
      │ agent-loop/ + planning/ +     │  src63 │  4.1K  │          │
      │ feedback/ + learning/ +       │ test56 │ 11.4K  │          │
      │ evaluation/ + improvement/    │        │        │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  7   │ Interaction Layer + 测试       │ ~124   │ ~28.8K │ Phase 5-6│ 4 人天
      │ memory/ + knowledge/ +        │  src54 │ 10.8K  │          │
      │ messages/ + gateway/          │ test70 │ 18.0K  │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  8   │ Business Domain + 测试         │  ~78   │ ~13.5K │ Phase 2,7│ 2.5 人天
      │ domain-registry/ + plugins/   │  src38 │  5.8K  │          │
      │ + divisions/ 目录             │ test40 │  7.7K  │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
  9   │ Operational Maturity + 测试    │ ~271   │ ~72.6K │ Phase 5  │ 7 人天
      │ observability/ + ops/ +       │ src106 │ 32.6K  │          │
      │ stability/ + evolution/ +     │ test165│ 40.0K  │          │
      │ reliability/ + product/       │        │        │          │
──────┼───────────────────────────────┼────────┼────────┼──────────┼─────────
 10   │ CLI + E2E + Golden + Perf     │ ~146   │ ~23.6K │ Phase 1-9│ 4 人天
      │ + Infra Files                 │  src78 │  6.1K  │          │
      │ cli/ + e2e/ + golden/ +       │ test68 │ 17.5K  │          │
      │ performance/ + smoke/ +       │        │        │          │
      │ contract/ + deploy/ + CI      │        │        │          │
```

**总计**：~1,868 文件（源码 799 + 测试 1,069）/ ~406K 行（源码 ~177K + 测试 ~229K）/ **~70-100 人天**（含 storage/runtime 拆分、adapter 编写、E2E 改造；不含 24 个新模块开发）

### 6.2 文档移植顺序

```
批次 │ 内容                           │ 文件数 │ 优先级
─────┼────────────────────────────────┼────────┼───────
 D1  │ 治理文档 + 指南文档（🟢 直接移植）  │   8   │ P0
 D2  │ 合约文档 22 个 🟢 + 15 个 ADR 🟢  │  37   │ P0
 D3  │ 运维手册 5 个 🟢 + 运维 runbooks  │  ~8   │ P1
 D4  │ 主干文档 5 个 🟡 + 技术分析 2 个   │   7   │ P1
 D5  │ 合约文档 38 个 🟡 + ADR 8 个 🟡   │  46   │ P2
 D6  │ 评审文档 3 个 🟡                  │   3   │ P2
 D7  │ 研究文档 28 个 🔵 整体搬移         │  28   │ P3
 D8  │ 参考/归档 清理标记                 │  29   │ P4
```

---

## 七、关键风险与缓解

### 7.1 高风险项

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `runtime/` 模块过大（114 文件 / 30K 行） | 移植时引入 regression，拆分时破坏接口 | Phase 5 之前先编写 boundary 集成测试，拆分后验证全部 stable-* 排练通过 |
| `storage/` AuthoritativeTaskStore 是 god object | 几乎所有模块依赖它，修改影响面极大 | 先抽象 Repository 接口层，再逐步将直接调用迁移到 Repository |
| 事件命名空间扩展（17→25） | 消费者未更新会丢事件 | 新增命名空间先以 Tier 3 (best-effort) 注册，确认消费者就绪后升级到 Tier 1 |
| 新平台需要但老系统完全缺失的模块 | §39 NL 入口/§40 目标分解/§41 主动 Agent/§46 组织层次/§64 边缘等需全新开发 | 移植与新功能开发并行，移植先行建立基座 |

### 7.2 老系统中完全缺失、新平台需新建的能力

| v2.7 章节 | 能力 | 所需新建模块 |
|-----------|------|-------------|
| §39 | 自然语言任务入口 | `core/nl-entry/` — NL 解析器、意图分类、实体提取、会话管理 |
| §40 | 目标分解引擎 | `core/goal-decomposition/` — 目标图、子目标生成、DAG 编排 |
| §41 | 主动式 Agent | `core/proactive-agent/` — 触发器引擎、定时调度、事件驱动唤醒 |
| §42 | 渐进式自主权 | `core/autonomy/` — 信任评分、自主权等级状态机、提升/降级规则 |
| §43 | 统一运营看板 | `core/dashboard/` — 业务视图聚合、多角色看板 |
| §44 | 非技术用户 UX | `gateway/user-portal/` — Web UI gateway、拖拽式编排、向导 |
| §46 | 组织层次模型 | `core/org-hierarchy/` — 组织树、部门/团队、层级继承 |
| §47 | 组织架构审批路由 | 扩展 `core/approvals/` — 动态路由引擎 |
| §48 | SSO/SCIM 集成 | `core/sso-scim/` — SAML/OIDC SSO、SCIM 用户同步 |
| §49 | 分部门合规策略 | 扩展 `core/compliance/` — 部门级策略引擎 |
| §50 | 知识域隔离 | 扩展 `core/knowledge/` — namespace 隔离、受控共享 |
| §52 | 多 Region 部署 | `core/multi-region/` — Region 路由、数据同步、故障切换 |
| §53 | 资源竞争管理 | `core/resource-scheduler/` — 优先级队列、公平调度 |
| §54 | SLA 分级保障 | `core/sla/` — SLA 等级定义、保障策略 |
| §59 | Agent 可解释性 | `core/explainability/` — 决策追踪、因果链 |
| §60 | 紧急制动 | `core/emergency-brake/` — 全局制动、分级制动 |
| §61 | 统一生命周期管理 | `core/agent-lifecycle/` — 创建→激活→休眠→退役 |
| §64 | 边缘/离线部署 | `core/edge-runtime/` — 离线缓存、同步 |
| §65 | 行为漂移检测 | `core/drift-detection/` — 基线对比、告警 |
| §66 | 成本归因优化 | 扩展 `core/cost/` — 多维归因、优化建议 |
| §67 | 可视化调试 | `core/debug-ui/` — 执行可视化、断点 |
| §68 | 合规报告自动生成 | 扩展 `core/compliance/` — 报告模板、自动生成 |
| §69 | 多模态能力 | `core/multimodal/` — 图像/音频/视频处理 |
| §70 | 平台自运维 Agent | `core/self-ops-agent/` — 自动巡检、自动修复 |

---

## 八、核心对象迁移矩阵

老系统定义了 ~84 个领域实体类型（`core/types/`），新平台 v2.7 在组织治理（§46-§51）、智能交互（§39-§44）、规模化运行（§52-§57）等层引入了大量新实体和实体分裂。本节映射老→新实体演化关系。

### 8.1 映射类型定义

| 映射类型 | 符号 | 含义 |
|----------|------|------|
| **1:1 直接** | → | 字段名/语义不变，直接改名或保留 |
| **1:1 富化** | →+ | 保留原字段，新增必填字段 |
| **1:N 分裂** | →⑴⑵… | 一个老实体拆分为多个新实体 |
| **N:1 合并** | ⇒ | 多个老实体合并为一个新实体 |
| **语义重定义** | ⇝ | 同名但语义/生命周期根本变化 |
| **全新** | ★ | 老系统无对应实体 |
| **退役** | ✕ | 不再需要 |

### 8.2 核心实体映射（按领域分组）

#### 任务与执行域

| 老实体 | 映射 | 新实体 | 风险 | 说明 |
|--------|------|--------|------|------|
| TaskRecord | →+ | task | 低 | 新增 org_node_id, autonomy_level, sla_tier 字段 |
| ExecutionRecord | →⑴⑵⑶⑷⑸ | execution + execution_step + execution_artifact + execution_metric + execution_decision_log | 高 | 从单行拆分为 5 表，需数据迁移脚本 |
| TransitionCommand | ⇝ | state_command + control_directive | 高 | 根本架构变更：命令不再直接操作状态机，通过 control_directive 间接路由 |
| SessionRecord | →+ | session | 低 | 新增 channel_type, nl_context 字段（§39） |
| WorkflowRecord | →+ | workflow_definition | 低 | 新增 goal_decomposition_tree 引用（§40） |
| WorkflowStepRecord | →+ | workflow_step | 低 | 新增 autonomy_gate, explainability_output 字段 |
| WorkflowStateRecord | →⑴⑵⑶⑷ | workflow_run + loop_cycle + checkpoint + hibernation_snapshot | 高 | 循环/检查点/休眠分离 |

#### 工作者与调度域

| 老实体 | 映射 | 新实体 | 风险 | 说明 |
|--------|------|--------|------|------|
| WorkerRecord | →+ | worker | 低 | 新增 region_id, capability_vector 字段 |
| LeaseRecord | →+ | lease | 低 | 新增 sla_priority 字段 |
| DispatchRecord | →+ | dispatch_assignment | 低 | 新增 resource_quota, region_affinity 字段（§52-§53） |
| AgentExecutionRecord | →⑴⑵⑶⑷⑸ | agent_run + agent_step + tool_invocation + llm_call + agent_decision | 高 | 可观测性需求驱动的细粒度拆分 |

#### 组织与治理域

| 老实体 | 映射 | 新实体 | 风险 | 说明 |
|--------|------|--------|------|------|
| ApprovalRecord | →⑴⑵⑶⑷ | decision_record + approval_route + approval_sla + decision_comment | 高 | 组织架构感知审批（§47），路由规则从硬编码改为动态 |
| OrganizationRecord + TenantRecord | ⇒ | org_node（层级树） | 高 | N:1 合并为递归组织树（§46），租户成为顶层 org_node |
| HrRoleRecord | →+ | role_assignment | 中 | 新增 delegation_scope, escalation_chain（§51） |
| ComplianceRecord | →+ | compliance_policy | 中 | 新增 department_scope, geo_region（§49, §52） |

#### 安全域

| 老实体 | 映射 | 新实体 | 风险 | 说明 |
|--------|------|--------|------|------|
| SandboxPolicy | →+ | sandbox_policy | 低 | 新增 department_override 字段（§49） |
| SecretRecord | → | secret_entry | 低 | 1:1 直接 |
| AuditRecord | →+ | audit_event | 低 | 新增 compliance_tag, retention_policy 字段 |

#### 记忆与知识域

| 老实体 | 映射 | 新实体 | 风险 | 说明 |
|--------|------|--------|------|------|
| MemoryRecord | →⑴⑵ | memory_entry + knowledge_document/chunk | 高 | 需内容分类器区分 episodic memory 和 knowledge artifact |
| KnowledgeDocument | →+ | knowledge_document | 中 | 新增 namespace_id（§50 域隔离）, modality 字段（§69） |
| EmbeddingRecord | → | embedding_vector | 低 | 1:1 直接 |

#### AI 运营域

| 老实体 | 映射 | 新实体 | 风险 | 说明 |
|--------|------|--------|------|------|
| ProviderConfig | →+ | provider_config | 低 | 新增 streaming_error_policy（§15.6） |
| ToolDefinition | →+ | tool_definition | 低 | 新增 modality_support, domain_binding 字段 |
| PluginManifest | →+ | pack_manifest | 低 | 改名 + 新增 marketplace_metadata（§55） |
| ArtifactRecord | →+ | artifact | 中 | 新增 evidence_chain, compliance_tag, modality 字段 |
| FeedbackSignal | →+ | feedback_signal | 低 | 新增 signal_source_type 枚举扩展 |
| EvalResult | ⇝ | eval_result | 中 | 评估框架从 post-hoc 改为 inline（§17） |

#### 运营成熟度域

| 老实体 | 映射 | 新实体 | 风险 | 说明 |
|--------|------|--------|------|------|
| SloDefinition | →+ | slo_definition | 低 | 新增 region_scope 字段 |
| AlertRule | → | alert_rule | 低 | 1:1 直接 |
| ReleaseRecord | →+ | release | 低 | 新增 canary_config, rollback_policy 扩展 |
| StabilityScenario | → | rehearsal_scenario | 低 | 改名，语义不变 |
| EvolutionProposal | →+ | evolution_proposal | 中 | 新增 drift_baseline, behavior_fingerprint（§65） |

### 8.3 全新实体清单（老系统无对应 — ★）

| 新实体 | v2.7 章节 | 所属域 |
|--------|-----------|--------|
| org_node | §46 | 组织治理 |
| delegation_scope | §51 | 组织治理 |
| sso_identity | §48 | 组织治理 |
| scim_sync_log | §48 | 组织治理 |
| nl_intent | §39 | 智能交互 |
| goal_tree | §40 | 智能交互 |
| proactive_trigger | §41 | 智能交互 |
| autonomy_level | §42 | 智能交互 |
| trust_score | §42 | 智能交互 |
| dashboard_view | §43 | 智能交互 |
| user_portal_session | §44 | 智能交互 |
| region_config | §52 | 规模化运行 |
| resource_quota | §53 | 规模化运行 |
| sla_tier | §54 | 规模化运行 |
| marketplace_listing | §55 | 规模化运行 |
| integration_connector | §57 | 规模化运行 |
| explainability_trace | §59 | 运营成熟度 |
| emergency_brake_event | §60 | 运营成熟度 |
| agent_lifecycle_state | §61 | 运营成熟度 |
| edge_deployment | §64 | 运营成熟度 |
| drift_baseline | §65 | 运营成熟度 |
| cost_attribution | §66 | 运营成熟度 |
| debug_session | §67 | 运营成熟度 |
| compliance_report | §68 | 运营成熟度 |
| multimodal_asset | §69 | 运营成熟度 |
| self_ops_task | §70 | 运营成熟度 |

### 8.4 迁移统计

| 映射类型 | 实体数 | 占比 |
|----------|--------|------|
| 1:1 直接（→） | ~12 | 14% |
| 1:1 富化（→+） | ~22 | 26% |
| 1:N 分裂（→⑴⑵…） | ~5 | 6% |
| N:1 合并（⇒） | ~2 | 2% |
| 语义重定义（⇝） | ~3 | 4% |
| 全新（★） | ~26 | 31% |
| 退役（✕） | ~14 | 17% |
| **合计** | **~84** | 100% |

### 8.5 数据迁移策略

对象迁移矩阵定义了"从什么变成什么"，本节定义"怎么变"。根据风险等级和数据量，采用三种迁移模式：

#### 迁移模式定义

| 模式 | 适用场景 | 执行方式 | 停机要求 |
|------|---------|---------|---------|
| **一次性离线迁移** | 低风险、1:1 直接/富化映射 | 编写迁移脚本，维护窗口内一次执行 | 短停机（分钟级） |
| **双写过渡** | 高风险对象分裂/合并，业务不可中断 | 写入时同时写老表+新表，读取逐步切到新表，验证一致后废弃老表 | 零停机 |
| **惰性迁移** | 长尾低频对象，全量迁移成本不合算 | 访问时检查版本，按需升级为新格式 | 零停机 |

#### 各实体迁移模式分配

| 实体 | 映射类型 | 迁移模式 | Phase | 说明 |
|------|---------|---------|-------|------|
| TaskRecord | →+ | 一次性离线 | P2 | 新增字段可设默认值，ALTER TABLE + backfill |
| SessionRecord | →+ | 一次性离线 | P2 | 同上 |
| WorkerRecord | →+ | 一次性离线 | P2 | 同上 |
| LeaseRecord | →+ | 一次性离线 | P2 | 同上 |
| ProviderConfig | →+ | 一次性离线 | P4 | 同上 |
| SecretRecord | → | 一次性离线 | P3 | 1:1 改名 |
| SloDefinition | →+ | 一次性离线 | P9 | 同上 |
| **ExecutionRecord** | →⑴⑵⑶⑷⑸ | **双写过渡** | P2→P5 | 1:5 分裂，需 P2 建新表开始双写，P5 验证一致后切读 |
| **WorkflowStateRecord** | →⑴⑵⑶⑷ | **双写过渡** | P2→P6 | 1:4 分裂，循环/检查点/休眠分离，OAPEFLIR 完成后切读 |
| **ApprovalRecord** | →⑴⑵⑶⑷ | **双写过渡** | P3→P5 | 1:4 分裂，组织审批路由变更，Runtime 完成后切读 |
| **AgentExecutionRecord** | →⑴⑵⑶⑷⑸ | **双写过渡** | P5 | 1:5 分裂，可观测性驱动 |
| **MemoryRecord** | →⑴⑵ | **双写过渡** | P7 | 需内容分类器区分 episodic memory 和 knowledge artifact |
| **OrganizationRecord + TenantRecord** | ⇒ | **双写过渡** | P3 | N:1 合并为 org_node 层级树，读写路径根本变化 |
| **TransitionCommand** | ⇝ | **双写过渡** | P5 | 语义重定义，命令路由根本变化 |
| EvalResult | ⇝ | 惰性迁移 | P6 | 评估记录访问频率低，访问时升级 |
| EvolutionProposal | →+ | 惰性迁移 | P9 | 历史提案访问时按需升级 |
| KnowledgeDocument | →+ | 惰性迁移 | P7 | 存量文档访问时补充 namespace_id |

#### 双写过渡执行流程

```
阶段 1: 建新表       → CREATE TABLE new_xxx（新 schema）
阶段 2: 开启双写     → 写入时同时写 old_xxx + new_xxx
阶段 3: 影子读取     → 读取时同时读两张表，比对结果，记录差异
阶段 4: 切换主读     → 主读切到 new_xxx，old_xxx 降为备读
阶段 5: 验证期       → 运行 ≥1 个完整 Phase 周期，确认零差异
阶段 6: 废弃老表     → DROP TABLE old_xxx
```

每个双写对象须指定负责人，并在 Phase 退出条件中加入"双写一致性验证通过"。

---

## 九、高风险专项：storage / AuthoritativeTaskStore 拆分

### 9.1 现状分析

`AuthoritativeTaskStore`（`src/core/storage/authoritative-task-store.ts`）是当前系统的全局数据访问门面：

| 指标 | 数值 |
|------|------|
| 公共方法数 | ~278 个领域方法 + 27 个结构属性 = ~305 公共表面 |
| 底层 Repository 数 | 21 个（task, workflow, execution, session, event, worker, approval, billing, lease, lock, memory, artifact, dispatch, division, secret, marketplace, release, organization, intelligence, evolution, operations） |
| 消费者文件数 | ~123 个源文件直接依赖（含测试 200+） |
| 代码行数 | 所在目录 101 文件 / 26,102 行 |

**核心问题**：god object 反模式 — 单一类承担 21 个领域的数据访问职责，导致任何存储层变更影响全系统。

### 9.2 拆分目标模块（7 个有界上下文）

| # | 有界上下文 | 方法数 | 包含 Repository | 拆分策略 |
|---|-----------|--------|-----------------|---------|
| 1 | **Core Task Engine** | ~73 | task, workflow, execution, session | 保留为核心 — 方法间耦合度高，不宜进一步拆分 |
| 2 | **Worker Infrastructure** | ~47 | worker, dispatch, lease, lock | 提取 — 调度/租约/工作者生命周期独立域 |
| 3 | **Event Infrastructure** | ~24 | event | 提取 — 事件总线已有清晰边界 |
| 4 | **Billing & Cost** | ~29 | billing | 提取 — 计费逻辑与核心执行解耦 |
| 5 | **Governance & Compliance** | ~50 | approval, organization, secret, compliance, operations | 提取 — 组织治理独立域（对齐 v2.7 Layer 5） |
| 6 | **Platform & Commerce** | ~47 | marketplace, release, division, intelligence, evolution | 提取 — 平台运营独立域（对齐 v2.7 Layer 6-7） |
| 7 | **Memory & Artifacts** | ~10 | memory, artifact | 提取 — 知识/记忆独立域（对齐 v2.7 Layer 4） |

### 9.3 拆分执行计划

**前提条件**：AuthoritativeTaskStore 内部已通过命名 Repository 委托实现，拆分的基础设施已就位，仅需迁移消费者。

| 步骤 | 动作 | 预估工作量 | 风险 |
|------|------|-----------|------|
| S1 | 为 7 个有界上下文定义 TypeScript interface（Repository 合约） | 2 人天 | 低 |
| S2 | 实现 facade adapter — AuthoritativeTaskStore 暂时委托到新 interface，保持向后兼容 | 3 人天 | 低 |
| S3 | 逐模块迁移消费者：将 `store.xxx()` 调用替换为对应 Repository interface 注入 | 8 人天 | 中 — 每个消费者需验证 |
| S4 | 移除 AuthoritativeTaskStore facade，各有界上下文独立注册到 ServiceRegistry | 2 人天 | 中 |
| S5 | 更新全部单元测试/集成测试中的 store mock | 3 人天 | 中 |
| S6 | 运行全量回归 + stable-* 排练验证 | 2 人天 | 低 |
| **合计** | | **~20 人天** | |

### 9.4 迁移顺序建议

```
Wave 1 (低风险提取): Event Infrastructure → Memory & Artifacts
  ↓ 验证点：event 相关测试全部通过
Wave 2 (中风险提取): Billing & Cost → Worker Infrastructure  
  ↓ 验证点：dispatch/lease 相关测试全部通过
Wave 3 (高风险提取): Governance & Compliance → Platform & Commerce
  ↓ 验证点：组织/审批/市场相关测试全部通过
Wave 4 (收尾): 移除 facade，Core Task Engine 成为独立模块
  ↓ 验证点：npm test 全量通过 + stable-* 排练通过
```

---

## 十、高风险专项：runtime/ 有界上下文拆分

### 10.1 现状分析

`src/core/runtime/` 是系统最大模块：

| 指标 | 数值 |
|------|------|
| 文件数 | 101 个 .ts 文件 |
| 代码行数 | 30,348 行 |
| 识别出的有界上下文 | 12 个 |

### 10.2 有界上下文分解

| BC# | 有界上下文 | 文件数 | 行数 | 内部依赖数 | 可独立提取 |
|-----|-----------|--------|------|-----------|-----------|
| BC1 | Execution Dispatch | 12 | 2,744 | 3 | 否 — 组合根 |
| BC2 | Lease Management | 8 | 1,807 | 1 | 是 — 干净 repo 模式 |
| BC3 | Worker Management | 10 | 1,434 | 0 | **是 — 零内部依赖，最佳提取目标** |
| BC4 | Handshake/Writeback | 10 | 2,058 | 2 | 否 — 依赖 BC1+BC2 |
| BC5 | HA Coordinator | 8 | 1,849 | 0 | **是 — 零内部依赖** |
| BC6 | Hot Upgrade | 6 | 1,952 | 0 | **是 — 零内部依赖** |
| BC7 | Recovery & Repair | 13 | 3,620 | 4 | 否 — 依赖多个 BC |
| BC8 | State Transition | 4 | 901 | 0 | **是 — 零内部依赖** |
| BC9 | Agent Execution Engine | 12 | 2,990 | 1 | 是 — 仅依赖 BC8 |
| BC10 | Multi-Step Orchestration | 13 | 2,427 | 5 | 否 — 组合根，留在 runtime/ |
| BC11 | Infrastructure | 13 | 2,498 | 0 | 是 — 工具类 |
| BC12 | HITL & Governance | 2 | 1,166 | 0 | **是 — 零内部依赖** |

### 10.3 提取波次计划

| 波次 | 提取目标 | 行数 | 占比 | 风险 | 验证点 |
|------|---------|------|------|------|--------|
| **Wave 1**（零风险） | BC3 Worker + BC5 HA + BC6 Hot Upgrade + BC8 State Transition | 6,136 | 20% | 低 — 零内部依赖 | 各 BC 单元测试独立通过 |
| **Wave 2**（低风险） | BC2 Lease + BC9 Agent Execution + BC12 HITL + BC11 Infrastructure | 6,461 | 21% | 低 — ≤1 依赖 | lease/agent 集成测试通过 |
| **Wave 3**（中风险） | BC4 Handshake/Writeback + BC7 Recovery | 5,678 | 19% | 中 — 多依赖 | recovery 排练场景通过 |
| **Wave 4**（收尾） | BC1 Dispatch + BC10 Orchestration 留为 runtime/ 核心 | 5,171 | 17% | 低 — 仅重组 | npm test 全量通过 |

### 10.4 预估工作量

| 动作 | 工作量 |
|------|--------|
| BC interface 定义（12 个） | 3 人天 |
| Wave 1 提取 + 测试 | 4 人天 |
| Wave 2 提取 + 测试 | 5 人天 |
| Wave 3 提取 + 测试 | 5 人天 |
| Wave 4 收尾 + 全量回归 | 3 人天 |
| **合计** | **~20 人天** |

### 10.5 与新架构对齐

| 提取后模块 | v2.7 目标章节 | 新增能力 |
|-----------|-------------|---------|
| Worker Management | §53 资源竞争 | 公平调度、优先级队列 |
| HA Coordinator | §31 容灾 | 多 Region leader election（§52） |
| State Transition | §9 状态机 | 扩展状态集（hibernation/delegation） |
| Agent Execution | §13 OAPEFLIR | §42 自主权评估阶段 |
| HITL & Governance | §21 HITL | §47 组织审批路由 |
| Lease Management | §31 租约 | §54 SLA 分级租约优先级 |

---

## 十一、新建模块优先级与依赖图

### 11.1 优先级分级

老系统完全缺失、新平台需全新开发的 24 个模块，按业务阻塞关系分为 P0/P1/P2：

| 优先级 | 含义 | 数量 |
|--------|------|------|
| **P0 — 基座能力** | 不具备则新平台无法与老系统区分，阻塞上层模块 | 6 |
| **P1 — 核心差异化** | 新平台关键能力，但不阻塞 P0 模块的移植 | 10 |
| **P2 — 运营增强** | 锦上添花，可在平台稳定后逐步交付 | 8 |

### 11.2 P0 基座能力（6 个）

| 模块 | v2.7 章节 | 依赖 | 说明 |
|------|-----------|------|------|
| `core/org-hierarchy/` | §46 | 无 | 组织层次模型是 §47-§51 的基础，最先开发 |
| `core/nl-entry/` | §39 | 无 | 自然语言入口是新平台核心交互模式 |
| `core/goal-decomposition/` | §40 | nl-entry | 目标分解引擎依赖 NL 意图解析 |
| `core/autonomy/` | §42 | org-hierarchy | 自主权模型依赖组织信任链 |
| `core/sso-scim/` | §48 | org-hierarchy | SSO/SCIM 依赖组织模型 |
| `core/emergency-brake/` | §60 | 无 | 紧急制动是安全基座，可独立开发 |

### 11.3 P1 核心差异化（10 个）

| 模块 | v2.7 章节 | 依赖 | 说明 |
|------|-----------|------|------|
| `core/proactive-agent/` | §41 | autonomy, nl-entry | 主动式 Agent 需自主权和 NL 能力 |
| `core/agent-lifecycle/` | §61 | autonomy | 统一生命周期依赖自主权等级 |
| `core/explainability/` | §59 | agent-lifecycle | 可解释性依赖生命周期事件 |
| `core/multi-region/` | §52 | org-hierarchy | 多 Region 依赖组织拓扑 |
| `core/resource-scheduler/` | §53 | multi-region | 资源调度依赖 Region 配置 |
| `core/sla/` | §54 | org-hierarchy, resource-scheduler | SLA 依赖组织+资源 |
| `core/drift-detection/` | §65 | agent-lifecycle | 漂移检测依赖行为基线 |
| `core/dashboard/` | §43 | org-hierarchy | 看板依赖组织视图 |
| 扩展 `core/approvals/` | §47 | org-hierarchy | 组织审批路由 |
| 扩展 `core/compliance/` | §49 | org-hierarchy | 分部门合规 |

### 11.4 P2 运营增强（8 个）

| 模块 | v2.7 章节 | 依赖 | 说明 |
|------|-----------|------|------|
| `gateway/user-portal/` | §44 | nl-entry, dashboard | 非技术用户 UX |
| `core/marketplace/` | §55 | agent-lifecycle | 市场生态 |
| `core/edge-runtime/` | §64 | multi-region | 边缘/离线部署 |
| `core/cost-attribution/` | §66 | sla, org-hierarchy | 成本归因优化 |
| `core/debug-ui/` | §67 | explainability | 可视化调试 |
| `core/compliance-report/` | §68 | compliance | 合规报告自动生成 |
| `core/multimodal/` | §69 | 无 | 多模态能力 |
| `core/self-ops-agent/` | §70 | agent-lifecycle, drift-detection | 平台自运维 |

### 11.5 依赖图

```
                    ┌─ org-hierarchy (P0) ─────────────────────────────────┐
                    │        │            │           │          │         │
                    │    sso-scim(P0)  autonomy(P0) multi-region(P1)  dashboard(P1)
                    │                     │    │         │          approvals(P1)
                    │               proactive(P1) agent-lifecycle(P1)  compliance(P1)
                    │                     │         │        │           sla(P1)
                    │                     │   explainability(P1)  drift-detection(P1)
                    │                     │         │                    │
                    │                     │    debug-ui(P2)    self-ops-agent(P2)
                    │                     │
 nl-entry (P0) ────┤                     │
      │            │               resource-scheduler(P1)
 goal-decomp(P0)   │                     │
      │            │              edge-runtime(P2)
 user-portal(P2)   │
                    │         marketplace(P2)  cost-attribution(P2)
                    │
 emergency-brake(P0) ── 独立，无依赖
 multimodal(P2) ──── 独立，无依赖
 compliance-report(P2) ── 依赖 compliance(P1)
```

---

## 十二、执行建议

### 12.1 移植原则

1. **先移植 🟢 直接移植项**：零改造成本，快速建立新平台代码基座
2. **按依赖序移植**：Shared Kernel → Infrastructure → Security → AI Ops → Runtime → OAPEFLIR → Interaction → Domain → Maturity → CLI
3. **每个 Phase 移植完成后运行对应测试**：确保不引入 regression
4. **文档与代码同步移植**：每个代码 Phase 对应的合约/ADR 同步搬入
5. **新功能开发与移植并行**：移植团队和新功能团队可同步工作

### 12.2 双轨迁移策略

"移植与新功能并行"需要明确的泳道划分和交汇规则，否则容易互相阻塞。

#### 泳道 A：迁移泳道

| 职责 | 内容 |
|------|------|
| P0-P10 代码迁移 | 按 §六 十阶段路线图执行 |
| storage 拆分 | §九 AuthoritativeTaskStore 4-wave 拆分 |
| runtime 拆分 | §十 runtime 4-wave 拆分 |
| 测试回归 | 每 Phase 退出门禁（§十三） |
| 契约/文档迁移 | 随代码 Phase 同步 |
| 数据迁移脚本 | §八 高风险实体的双写/离线迁移 |

#### 泳道 B：新能力泳道

| 职责 | 内容 |
|------|------|
| P0 基座 | org-hierarchy / nl-entry / goal-decomposition / autonomy / sso-scim / emergency-brake |
| P1 差异化 | proactive-agent / agent-lifecycle / explainability / multi-region / resource-scheduler / sla / drift-detection / dashboard / 审批路由扩展 / 分部门合规扩展 |
| P2 增强 | user-portal / marketplace / edge-runtime / cost-attribution / debug-ui / compliance-report / multimodal / self-ops-agent |

#### 交汇点与依赖规则

| 交汇点 | 迁移泳道前置 | 新能力泳道动作 | 策略 |
|--------|-------------|---------------|------|
| **org-hierarchy 接入** | P3 Security 完成（hr/approvals 已迁移） | org-hierarchy 模块通过 adapter 接入已迁移的 hr/approvals | 新能力泳道可先用 **stub interface** 开发，P3 完成后替换为真实实现 |
| **autonomy 接入** | P5 Runtime 完成（状态机已迁移） | autonomy 模块接入 state-transition BC | 新能力泳道先定义 StateTransition interface stub，P5 Wave 1 完成后接入 |
| **nl-entry 接入** | P4 AI Ops 完成（providers 已迁移） | nl-entry 使用已迁移的 LLM provider | 新能力泳道可先用 mock provider 开发，P4 完成后切换 |
| **agent-lifecycle 接入** | P6 OAPEFLIR 完成 | agent-lifecycle 扩展 OAPEFLIR 循环 | 必须等 P6 完成，不可 stub |
| **multi-region 接入** | P5 Runtime 完成（HA/dispatch 已提取） | multi-region 扩展已提取的 HA Coordinator | 必须等 P5 Wave 1 完成 |
| **知识域隔离** | P7 Interaction 完成（knowledge 已迁移） | §50 知识域隔离扩展 knowledge 模块 | 必须等 P7 完成 |

#### Stub 策略

可先 stub 后接入的模块（新能力泳道可提前启动）：
- `org-hierarchy` — stub `OrgNodeRepository` interface，返回单层组织
- `autonomy` — stub `AutonomyGate`，默认返回 LEVEL_1（最低自主权）
- `nl-entry` — stub `IntentClassifier`，透传原始文本
- `emergency-brake` — stub `BrakeService`，默认不制动

必须等迁移完成才能接入的模块（有硬依赖）：
- `agent-lifecycle` — 依赖完整 OAPEFLIR 循环（P6）
- `multi-region` — 依赖真实 HA Coordinator（P5）
- `drift-detection` — 依赖真实行为基线数据（P9）
- `self-ops-agent` — 依赖完整平台能力（P10 之后）

### 12.3 移植检查清单

每个模块移植时需完成：

- [ ] 复制源文件到新项目对应目录
- [ ] 更新 import path（如七层目录重组后 path 变化）
- [ ] 同步复制 `tests/unit/<module>/` 和 `tests/unit/core/<module>/` 到新项目
- [ ] 同步复制 `tests/integration/<module>/` 到新项目
- [ ] 运行该模块的 unit test，确认全部通过
- [ ] 运行相关 integration test，确认全部通过
- [ ] 如有 golden test 涉及该模块，更新快照并验证
- [ ] 如有 e2e test 涉及该模块，验证端到端流程通过
- [ ] 如有 performance test 涉及该模块，验证性能基线达标
- [ ] 更新模块的合约文档引用（§ 编号）
- [ ] 在新平台的 module-inventory 中登记
- [ ] 确认无 TypeScript 编译错误
- [ ] 运行 `npm run test:unit` 全量回归

### 12.4 不移植清单

以下内容**明确不移植**，仅归档：

| 内容 | 原因 |
|------|------|
| `doc/archive/` 全部 | 历史归档 |
| `doc/reference/` 中 9 个 ⚪ D 文件 | 被 v2.7 替代 |
| `doc/automatic_agent_platform/agent_platform.md` (92K行) | 未删节旧版，已被 v2.7 (6.7K行) 替代 |
| `doc/automatic_agent_platform/` 中间翻译碎片文件 | chunk_b-j、part1-6 为翻译中间产物 |
| `doc/reviews/` 中 6 个 ⚪ D 文件 | 旧版评审 |
| `doc/contracts/` 中 10 个 ⚪ D 合约 | 早期 v1.x 合约 |

---

## 十三、Phase 准入与退出标准

每个移植 Phase 须满足明确的准入条件（Definition of Ready）和退出条件（Definition of Done），未达标不得进入下一 Phase。

| Phase | 准入条件 | 退出条件（Definition of Done） |
|-------|---------|-------------------------------|
| **P0 Test Helpers** | 新项目 repo 已初始化，tsconfig/eslint/package.json 就位 | 19 个 helper 文件全部通过 `tsc --noEmit`；`createTempWorkspace()` 在新项目可用 |
| **P1 Shared Kernel** | P0 退出达标 | types/errors/constants/utils/results/lifecycle 全部编译通过；38 个单元测试全部绿色；零外部运行时依赖 |
| **P2 Infra Foundation** | P1 退出达标 | storage/events/config/locking/queue/cache 编译通过；180 个单元测试 + 相关集成测试全部绿色；SQLite migration 账本完整性验证通过；`npm run test:unit` 全量回归绿色 |
| **P3 Security** | P2 退出达标 | security/approvals/cost/compliance/hr 编译通过；115 个测试绿色；64 个安全边界集成测试全部通过（含沙箱逃逸/路径穿越/SSRF 拒绝路径） |
| **P4 AI Ops** | P2 退出达标 | providers/tools/workflow/artifacts 编译通过；100 个测试绿色；Provider CircuitBreaker 集成测试通过 |
| **P5 Runtime** | P2+P3+P4 退出达标 | runtime 12 个 BC 按波次提取完成；150 个测试绿色；stable-* 排练场景全部通过；dispatch/lease/recovery 集成测试通过 |
| **P6 OAPEFLIR** | P4+P5 退出达标 | agent-loop/planning/feedback/learning/evaluation/improvement 编译通过；56 个测试绿色；OAPEFLIR 8 阶段全循环 E2E 通过 |
| **P7 Interaction** | P5+P6 退出达标 | memory/knowledge/messages/gateway 编译通过；70 个测试绿色；会话→记忆→检索端到端通过 |
| **P8 Business Domain** | P2+P7 退出达标 | domain-registry/divisions/plugins 编译通过；40 个测试绿色；至少 1 个 division 端到端加载成功 |
| **P9 Maturity** | P5 退出达标 | observability/ops/stability/evolution/reliability/product/deployment 编译通过；165 个测试绿色；健康检查 + SLO 告警集成测试通过 |
| **P10 CLI + E2E** | P1-P9 全部退出达标 | CLI 78 个入口编译通过；10 个 E2E 测试绿色；8 个 golden 测试快照匹配；6 个性能测试达标；`npm test` 全量回归绿色；`npm run build` 生成 dist/ 成功 |

### 13.1 模块级交付物验收模板

Phase DoD 定义的是阶段整体门禁，但每个**模块**完成迁移后须交付以下 5 项，缺项不得标记为"已完成"：

| 交付物 | 内容 | 验收标准 |
|--------|------|---------|
| **代码** | 已迁移源码，放入新项目目标目录 | `tsc --noEmit` 零错误；import path 已更新；无对老项目的路径引用 |
| **契约** | interface/schema/合约文档更新 | 新增的 adapter interface 有 JSDoc；如涉及 DB schema 变更，migration 文件已创建 |
| **测试** | unit + integration + (如涉及) e2e 回归 | 该模块对应的全部测试绿色；新增 adapter 有对应单元测试 |
| **文档** | module-inventory 登记 + 合约引用（§ 编号）更新 | 新平台 module-inventory.md 中已登记模块名/文件数/行数/负责人 |
| **迁移说明** | 兼容性/破坏性变更记录 | 记录：(1) 接口变更清单 (2) 废弃的 API (3) 新增的依赖 (4) 配置项变化 |

**模板示例**（以 `core/events/` 为例）：

```
模块: core/events/
Phase: P2
交付物检查:
  [x] 代码: 8 文件迁移至 new-project/src/core/events/，tsc 通过
  [x] 契约: 新增 8 个事件命名空间 interface（delegation.*/hibernation.*/...）
  [x] 测试: 10 个单元测试 + 2 个集成测试全部绿色
  [x] 文档: module-inventory 已登记，合约引用更新至 v2.7 §28
  [x] 迁移说明: 破坏性变更 — EventBus.emit() 签名新增 namespace 参数
```

### 13.2 回归门禁

每个 Phase 退出时须运行：
1. `tsc --noEmit` — 零编译错误
2. `npm run test:unit` — 全量单元测试绿色
3. 该 Phase 涉及的 `npm run test:integration` 子集绿色
4. `npm run build` — dist/ 可生成

### 13.3 阻塞升级规则

- 任何 Phase 退出条件未满足时，该 Phase 标记为 **BLOCKED**
- BLOCKED Phase 的下游 Phase 不得开始
- 修复后需重新运行完整退出验证

---

## 十四、迁移冻结线

迁移期间以下技术栈**冻结不变**，避免引入额外不确定性：

| 冻结项 | 当前版本/选型 | 冻结原因 |
|--------|-------------|---------|
| **测试框架** | Node.js 22 内置 `node:test` + `assert/strict` | 1,069 个测试文件依赖，切换框架等于重写测试 |
| **模块系统** | TypeScript ESM（`.js` 扩展名导入） | 全量 ESM，切换 CJS 影响所有 import |
| **数据库后端** | SQLite (Phase 1-2) + PostgreSQL (可选) | storage 层 101 个文件 + 全部测试夹具基于 SQLite |
| **CLI 框架** | 直接 `process.argv` 解析 + 78 个薄脚本 | CLI 是 service 的薄包装，换框架无收益 |
| **可观测性栈** | OpenTelemetry + Prometheus + StructuredLogger | 36 个 observability 文件 + SLO 告警依赖 |
| **配置验证** | Zod schema | 27 个配置文件 + 8 层配置治理依赖 |
| **包管理器** | npm | CI workflow + scripts 依赖 |

### 14.1 冻结线变更流程

如确需变更冻结项：
1. 提交 ADR 说明变更原因和影响范围
2. 评估受影响的文件数和测试数
3. 获得架构负责人批准
4. 变更必须在独立分支完成，不与移植工作交叉

---

## 十五、工时估算与假设

### 15.1 工时分解

| 工作项 | 人天 | 说明 |
|--------|------|------|
| P0-P1 文件搬运 + 编译修复 | 2 | 零改造模块 |
| P2 Infra（含 storage 拆分 §九） | 27 | storage 拆分 20 人天 + 其余 infra 7 人天 |
| P3 Security | 4 | 安全测试验证为主 |
| P4 AI Ops | 5 | providers/tools adapter 编写 |
| P5 Runtime（含 runtime 拆分 §十） | 30 | runtime 拆分 20 人天 + 集成验证 10 人天 |
| P6-P8 OAPEFLIR + Interaction + Domain | 10 | 主要是适配工作 |
| P9 Maturity | 7 | observability/ops/stability |
| P10 CLI + E2E + 全量回归 | 8 | E2E 改造 + golden 更新 + 性能验证 |
| 缓冲（20%） | 7 | 未预见的兼容性问题 |
| **移植总计** | **~100 人天** | |

### 15.2 假设条件

1. 1 人天 = 8 小时有效开发时间
2. 团队具备 TypeScript ESM + Node.js 22 经验
3. storage/runtime 拆分可各分配 1 名专人
4. 移植与 24 个新模块开发**并行**，新模块开发工时不含在本估算内
5. 不含环境搭建、CI 配置、代码审查等管理开销
6. v1.0 的 48 人天为纯文件搬运口径（复制+import 修复），不含 god object 拆分、adapter 编写、E2E 测试改造

---

## 附录 A：移植量化统计

| 指标 | 数值 |
|------|------|
| **源代码** | |
| 源代码总文件数 | 799 |
| 源代码总行数 | ~174,585 |
| 🟢 直接移植代码模块 | 18 个（~27K 行） |
| 🟡 改造移植代码模块 | 25 个（~147K 行） |
| 🔵 仅参考代码模块 | 3 个（~8.9K 行） |
| **测试** | |
| 测试文件总数 | 1,069 |
| 测试总行数 | ~229,196 |
| 🟢 直接移植测试 | ~903 文件（~192K 行） |
| 🟡 改造移植测试 | ~145 文件（~34K 行）— storage/runtime/CLI/security/recovery/e2e |
| 🔵 仅供参考测试 | ~17 文件（~3K 行）— 浸泡测试 + performance.bak |
| 测试基础设施 (helpers) | 19 文件 / 2,093 行 — 16 🟢 + 3 🟡 |
| **文档** | |
| 文档总文件数 | ~243 |
| 🟢 直接移植文档 | ~48 文件 |
| 🟡 改造移植文档 | ~74 文件 |
| 🔵 参考价值文档 | ~84 文件 |
| ⚪ 归档淘汰文档 | ~37 文件 |
| **其他资产** | |
| config/ 目录 | 27 JSON 文件 — 全部直接移植 |
| divisions/ 目录 | 11 division 定义 — 🟡 改造移植（需适配 DomainDescriptor 语义模型） |
| **新建** | |
| 新平台需全新开发的模块 | 24 个（v2.7 §39-§70 中老系统缺失的） |
| **总计** | |
| 移植总文件数 | ~1,868（源码 799 + 测试 1,069） |
| 移植总行数 | ~406K（源码 ~177K + 测试 ~229K） |
| 预估移植总工作量 | **~70-100 人天**（含测试、含 storage/runtime 拆分改造、含 adapter 编写；不含 24 个新功能模块开发。v1.0 的 48 人天仅为文件搬运口径，未计入 god object 拆分、接口适配、E2E 测试改造） |
