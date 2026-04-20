# Operations Roadmap

> 本文件整合 `doc/operations/` 下 4 份路线图文档。
> 由 `research/reference-alignment/reference_cross_analysis_and_todolist.md` 的任务 9A 整合生成。
> 原始文件：development_sequence_roadmap.md、architecture_upgrade_roadmap.md、industrial_production_readiness_roadmap.md、system_improvement_roadmap.md

---

## 1. 开发顺序与依赖（Development Sequence Roadmap）

来源：`development_sequence_roadmap.md`

### 1.1 目标

将所有稳定化 backlog 从"问题清单"转换成"开发顺序"，回答：

- 现在开始实现，先做哪一批
- 哪些事情可以并行
- 哪些事情必须等前置项完成
- 每一批做到什么程度才算可以进入下一批

### 1.2 使用原则

- 优先级高不等于可以立刻做，必须服从依赖顺序
- 先做能降低系统不稳定源的底座，再做增强能力
- 若某一批的退出门槛未满足，不应进入下一批
- Stable Core 跑稳前，不扩面到远程 worker、marketplace、多租户或复杂进化

### 1.3 总体节奏

```
Week 1:  State / Event / Workflow
Week 2:  Runtime / Tool / Cancel
Week 3:  DB / Recovery / Reconcile
Week 4:  Observability / Ops / Takeover
Week 5:  Quality Gates / Golden Tasks / Rollback
Phase 1b Batch 1: Orchestration / Task Board
Phase 1b Batch 2: Compaction / Edit
Phase 1b Batch 3: Replay / Backpressure
Week 6+:  Remote / PG-Redis / Enterprise Prep
```

### 1.4 批次状态枚举

| 状态 | 含义 |
|------|------|
| `not_started` | 尚未进入该阶段或批次 |
| `ready` | 已通过 gate，可开始，但尚未开工 |
| `in_progress` | 已开工，正在推进 |
| `blocked` | 已开工但存在阻断 |
| `done` | 已达到当前阶段验收线 |

---

## 2. 架构升级路线（Architecture Upgrade Roadmap）

来源：`architecture_upgrade_roadmap.md`

### 2.1 目标

定义从当前 Phase 1a 基线，向最终平台目标推进时最优先的 4 条架构升级线。

### 2.2 当前优先级

1. `runtime → execution plane`
2. `transaction storage → data plane`
3. `approval/sandbox/budget → governance control plane`
4. `billing/tenant → tenant and monetization plane`

### 2.3 总体原则

- 先把平台层设计补清楚，再进入对应实现
- 每条升级线都必须有 contract、阶段目标和退出门槛
- 不允许在缺少上位 contract 的情况下直接做长期平台化实现

---

## 3. 工业级生产就绪路线（Industrial Production Readiness Roadmap）

来源：`industrial_production_readiness_roadmap.md`

### 3.1 目标

定义从"可运行框架"到"工业级生产系统"的推进路径。

补充说明：

- 本节描述的是工业级目标态路线，而不是当前 phase1-4 authoritative release level。
- 涉及 `蓝绿 / 灰度 / canary / staged / auto rollback` 的条目，在当前仓库口径中应视为工业级或 `M2` 扩展目标，不得反向解读为当前 `off / suggest / shadow` 之外的 release level 已完成。

### 3.2 核心原则

- 先补可靠性、运维、安全、回滚和人工接管
- 不以继续扩业务功能替代生产托底能力
- 任何"工业级"声明都必须有 contract、runbook、告警和回滚路径支撑

### 3.3 P0 路线（生产阻断项）

1. 任务租约 + fencing token
2. PostgreSQL / Redis 生产化路线
3. 分布式锁
4. 幂等与副作用体系
5. SLO / 告警 / Runbook
6. 蓝绿 / 灰度 / 回滚
7. 企业级 secret 管理
8. 审计链与保留策略
9. 管理员控制面与人工接管
10. Prompt / Model / Policy 治理
11. LLM 建议、代码裁决边界

### 3.4 P1 路线（企业治理与隔离强化）

- 多租户隔离强化
- 数据分类分级
- 合规证据链
- 资源池和租户配额隔离
- 值班与交接体系
- 环境分层与配置中心治理
- 架构治理与 schema 版本治理
- 供应链与依赖安全
- trace / RCA / 业务技术双 dashboard
- workflow 静态分析与补偿闭环

### 3.5 P2 路线（规模化与高可用增强）

- HA coordinator
- 热升级与无损迁移
- Anomaly detection
- 自动止损
- 跨区域部署
- 远程协调与异地容灾
- 记忆质量与衰减治理
- License / capability 工程化分层
- 更成熟的 HITL 体验与 explainability

### 3.6 路线图

```
Phase 1a/1b: 可运行底座
        ↓
P0: 生产托底能力
        ↓
P1: 企业治理与隔离强化
        ↓
P2: 规模化与高可用增强
```

---

## 4. 系统改进路线（System Improvement Roadmap）

来源：`system_improvement_roadmap.md`

### 4.1 目标

把当前系统级改善建议整理成正式推进路线，避免改善项只停留在聊天结论里。

### 4.2 执行原则

- 先收紧状态、错误、事件、恢复、安全这 5 个底座
- 先清掉最容易导致线上事故的不稳定源，再考虑扩功能
- 先把当前阶段真正需要的能力做稳，再进入下一阶段
- 任何超阶段能力若未进入正式阶段目标，默认不实现

### 4.3 改善优先级

**P0（必须先做）**：

- 状态机与转换审计
- 错误码规范化
- 事件可靠性（Tier-1/Tier-2）
- 恢复与回放完整性

**P1（高优先级支撑项）**：

- Session / Execution 统一模型
- 多租户隔离
- 资源限额与预算控制

**P2（跑稳后再做）**：

- 复杂编排与多 Agent
- 外部 Provider 扩展
- 跨地域部署

---

## 5. 统一状态枚举（跨文档一致）

| 规划状态 | 含义 |
|---------|------|
| `not_started` | 尚未进入该阶段或批次 |
| `ready` | 已通过 gate，可开始，但尚未开工 |
| `in_progress` | 已开工，正在推进 |
| `blocked` | 已开工但存在阻断 |
| `done` | 已达到当前阶段验收线 |

| 待办清单状态 | 含义 |
|------------|------|
| `[todo]` | 已排定但尚未开始 |
| `[doing]` | 正在实现 |
| `[blocked]` | 存在阻断项 |
| `[done]` | 已完成并回写进度 |

---

## 6. 规划文档维护规则

- 阶段边界、非目标、允许范围变化时 → 修改 `implementation_plan.md`
- 开发顺序、依赖、批次切换变化时 → 修改 `development_sequence_roadmap.md`（已整合到本文档）
- 实际状态变化后 → 更新 `project_progress_tracker.md`
- 当前 1~2 个迭代的活跃事项 → 仅在 `current_todo_list.md` 维护

---

## 7. 参考文档

- 完整实施任务清单（十大任务）: `doc/research/reference-alignment/reference_cross_analysis_and_todolist.md`
- 90 天工业级路线图: `doc/research/reference-alignment/reference_industrial_goal.md`
- 系统架构分析: `doc_en/18_code_architecture.md`
- 参考研究文档: `doc/reviews/`
