# Tenant Isolation And Shared Worker Safety Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 release
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义多租户环境下，shared worker、shared cache 和 shared queue 的安全边界。

相关文档：

- `tenant_and_organization_contract.md`
- `enterprise_secret_management_contract.md`
- `data_classification_and_prompt_handling_contract.md`

## 2. 目标

- 防止跨租户数据污染。
- 防止共享 worker 复用过程中残留上下文泄露。
- 明确 shared infrastructure 与 tenant boundary 的交界处。

## 3. 关键隔离面

- identity
- storage
- artifacts
- cache
- execution workspace
- secret scope

## 4. 规则

- shared worker 每次执行前必须重建或清洗 tenant-scoped runtime context。
- cache key 必须显式带 tenant / workspace 边界。
- artifact download、debug snapshot、inspect API 都必须带 tenant-aware authz。
- worker 不得把上一个 tenant 的 secret、prompt context、artifact ref 带入下一次任务。
- worker 租约、临时目录、sandbox、repo cache 和 memory snapshot 都必须带 tenant / workspace 作用域标记。
- 任何 tenant scope 缺失、冲突或不可判定的执行，都应 fail-closed。

## 5. 共享与专用边界

- 允许共享：worker binary、基础镜像、模型连接池、公共只读 schema
- 不允许共享：tenant secret、tenant runtime context、tenant file workspace、tenant-scoped memory

补充规则：

- shared queue 可以共享，但队列消息必须显式携带 tenant / workspace 归属。
- shared cache 命中不得跨 tenant 复用，即使 payload 看起来相同。
- shared worker 回收或切换 tenant 前，必须完成上下文擦除与 secret 回收。

## 5A. 自动隔离触发器

当 shared worker 或共享基础设施出现跨 tenant 风险迹象时，系统必须自动进入隔离模式。

- 默认触发阈值：滚动窗口内 `failure_rate > 30%` 且 `sample_count >= min_sample_size`。
- `min_sample_size` 默认不得低于 `20`。
- 触发后必须自动执行：停止新调度、隔离 worker 池、提升审计等级、要求人工复核。
- 若为单 tenant 热点故障，隔离范围应最小化到 `tenant / workspace`；若无法判定归属，则提升到 shared worker 池级隔离并 fail-closed。
- 自动解除隔离前，必须看到故障率回落、样本量满足、并完成上下文擦除与 secret 回收检查。

## 6. 收口结论

多租户安全不是给表加 `tenant_id` 就结束，shared worker 的执行态隔离同样必须被正式建模。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-51: 本文原先只有定性隔离规则，根因是租户隔离合同强调边界原则，却没有把 shared worker 风险提升到可执行的自动触发器。修复：正文现新增自动隔离触发器，要求在 `failure_rate > 30%` 且达到 `min_sample_size` 时自动隔离并 fail-closed。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
