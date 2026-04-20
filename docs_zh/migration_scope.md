# 老系统到新平台的迁移范围

## 1. 依据文档

本范围只依据以下 3 份材料判定：

- `docs_zh/automatic_agent_patform_arthitecture_design.md`
- `docs_zh/migrate_guideline.md`
- 老系统 `automatic_agent_system/doc/18_code_architecture.md`

判定原则：

- 新平台设计以 `automatic_agent_patform_arthitecture_design.md` 为准
- 迁移顺序和等级以 `migrate_guideline.md` 为准
- 老系统 `18_code_architecture.md` 只用于识别现有模块、依赖和改造成本

## 2. 这次真正要迁移的内容

### 2.1 必须迁移的代码与配置基座

这些属于新平台的代码基线，应进入新仓库：

- `src/core/types`
- `src/core/errors.ts`
- `src/core/config`
- `src/core/storage`
- `src/core/events`
- `src/core/cache`
- `src/core/locking`
- `src/core/queue`
- `src/core/runtime`
- `src/core/tools`
- `src/core/providers`
- `src/core/workflow`
- `src/core/approvals`
- `src/core/security`
- `src/core/observability`
- `src/core/stability`
- `src/core/ops`
- `src/core/api`
- `src/core/artifacts`
- `src/core/orchestration`
- `src/core/agent-loop`
- `src/core/planning`
- `src/core/feedback`
- `src/core/learning`
- `src/core/improvement`
- `src/core/domain-registry`
- `src/core/knowledge`
- `src/core/memory`
- `src/core/messages`
- `src/core/reliability`
- `src/core/resource`
- `src/core/results`
- `src/cli`
- `src/gateway`
- `src/plugins`
- `config/`
- `divisions/`
- `deploy/`
- `scripts/`

说明：

- 上面这些不是“照搬老系统设计”，而是老系统里已经存在、并且能作为新平台七层架构实现基座的代码资产
- 其中 `runtime`、`storage`、`security`、`providers`、`workflow`、`observability`、`stability` 是迁移主链
- `agent-loop`、`planning`、`feedback`、`learning`、`improvement` 是 OAPEFLIR 闭环主链，必须保留

### 2.2 必须补出来的新平台模块

这些在老系统里没有完整对应实现，但在新平台架构里是明确要求的入口，不能缺位：

- `src/core/nl-entry`
- `src/core/goal-decomposition`
- `src/core/proactive-agent`
- `src/core/autonomy`
- `src/core/dashboard`
- `src/gateway/user-portal`

这些模块当前可以先保留为平台边界占位和 contract 入口，但不能继续缺省不建。

### 2.3 必须迁移的测试资产

这些测试不是旧项目噪音，而是新平台迁移后的行为保护网：

- `tests/unit/`
- `tests/integration/`
- `tests/contracts/`
- `tests/reliability/`
- `tests/performance/`
- 与 `runtime`、`storage`、`workflow`、`providers`、`security`、`ops` 相关的 fixture 与 helper

说明：

- 单元测试和契约测试需要整体迁入
- `storage`、`runtime`、`cli` 相关测试属于“改造迁移”，不是删除
- E2E 和历史演练类只保留仍能验证新平台主链的部分

## 3. 要迁移但不能原样照搬的内容

以下内容要保留，但必须按新平台语义改造：

### 3.1 主干文档

- 老 `doc/00` 到 `doc/07`
- `18_code_architecture.md`
- `19_full_coverage_test_manual.md`
- `runtime-sequence.md`
- `module-inventory.md`
- `release-checklist.md`

改造原则：

- 旧系统“三层/旧阶段”表述，改成新平台“七层架构”
- `reviews/`、`archive/`、历史 readiness 结论，不能再作为事实源引用
- 文档正式落点改到 `docs_zh/` 和 `docs_en/`

### 3.2 contracts / adr / guides / governance

这些目录整体有迁移价值，但要分类处理：

- `doc/contracts/`
  - 基础设施、状态机、存储、事件、安全、运行时、回滚、SLO 等 contract 要迁
  - 被 v2.7 完全替代的旧合约不迁
- `doc/adr/`
  - 架构决策本身大多保留
  - 与旧扩展市场、旧边界假设强绑定的 ADR 只保留参考结论
- `doc/guides/`
  - 贡献、division、skill 编写规范可迁
- `doc/governance/`
  - 命名规范、变更控制、术语表可迁
  - 以旧 `reviews/` 为事实源的治理规则要改写

## 4. 只做参考，不进入新平台正式文档集的内容

以下内容可以保留在原老系统仓库中查阅，但不应作为新平台正式文档复制进 `docs_zh/` 或 `docs_en/`：

- 老系统 `doc/reference/`
- 老系统 `doc/research/`
- 老系统 `doc/system-status-matrix.md`
- 老系统竞品对齐分析
- 一次性 gap analysis / reference alignment / special review

这些材料的作用只有两个：

- 帮助我们理解为什么老系统这样设计
- 在需要时补充某个模块的迁移背景

它们不应该反向定义新平台边界。

## 5. 明确不迁移的内容

以下内容不应该进入新平台正式仓库：

- 老系统 `doc/reviews/`
- 老系统 `doc/archive/`
- 老系统 `doc/operations/archive/`
- 历史 TODO、历史进度跟踪、历史 signoff、一次性评审结论
- 已经被新平台架构文档覆盖的旧版长文档

原因：

- 这些文件描述的是“某个时间点怎么评价老系统”
- 它们不是新平台设计输入，也不是运行时 contract
- 复制进新仓库只会制造错误事实源和误导性的入口

## 6. 迁移边界的最终结论

这次迁移不是“把老项目整个复制一份”，而是：

1. 迁移老系统里仍然有效的代码、配置、测试和正式工程资产
2. 按新平台七层架构补齐老系统缺失的入口模块
3. 只迁移仍然有效的规范文档
4. 明确排除 review、archive、历史评审和一次性参考材料

一句话总结：

- `src/`、`config/`、`divisions/`、`tests/`、`deploy/`、`scripts/` 是迁移主体
- `contracts/`、`adr/`、`guides/`、`governance/` 是选择性迁移并改造
- `reviews/`、`archive/`、历史跟踪文档是不迁移项
