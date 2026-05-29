# Tenant Isolation And Shared Worker Safety Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines多租户环境下，shared worker、shared cache 和 shared queue 的security边界。

相关文档：

- `tenant_and_organization_contract.md`
- `enterprise_secret_management_contract.md`
- `data_classification_and_prompt_handling_contract.md`

## 2. 目标

- 防止跨租户data污染。
- 防止共享 worker 复用过程中残留上下文泄露。
- 明确 shared infrastructure vs tenant boundary 的交界occurrences。

## 3. 关键隔离面

- identity
- storage
- artifacts
- cache
- execution workspace
- secret scope

## 4. 规则

- shared worker 每iterations执lines前必须重建或清洗 tenant-scoped runtime context。
- cache key 必须显式带 tenant / workspace 边界。
- artifact download、debug snapshot、inspect API 都必须带 tenant-aware authz。
- worker 不得把上一个 tenant 的 secret、prompt context、artifact ref 带入下一iterations任务。
- worker 租约、临时目录、sandbox、repo cache 和 memory snapshot 都必须带 tenant / workspace 作用域标记。
- 任何 tenant scope 缺失、conflicts或不可判定的执lines，都应 fail-closed。

## 5. 共享vs专用边界

- 允许共享：worker binary、基础镜像、模型connect池、公共只读 schema
- 不允许共享：tenant secret、tenant runtime context、tenant file workspace、tenant-scoped memory

补充规则：

- shared queue 可以共享，但队列消息必须显式携带 tenant / workspace 归属。
- shared cache 命中不得跨 tenant 复用，即使 payload 看起来相同。
- shared worker 回收或切换 tenant 前，必须完成上下文擦除vs secret 回收。
- `dedicated_pool` 租户必须实际落到 tenant-scoped worker pool / resource pool，而不只is把 `isolationMode` record在 metadata 里。
- `dedicated_pool` 的调度策略必须is `dedicated_pool_only`；shared queue 可以接单，但最终执lines不得回落到共享 worker 池。

## 5A. 自动隔离触发器

当 shared worker 或共享基础设施出现跨 tenant 风险迹象时，系统必须自动进入隔离模式。

- defaults to触发threshold：滚动窗口内 `failure_rate > 30%` 且 `sample_count >= min_sample_size`。
- `min_sample_size` defaults to不得低于 `20`。
- 触发后必须自动执lines：停止新调度、隔离 worker 池、提升审计等级、要求人工复核。
- 若为单 tenant 热点故障，隔离范围应最小化到 `tenant / workspace`；若no法判定归属，则提升到 shared worker 池级隔离并 fail-closed。
- 自动解除隔离前，必须看到故障率回落、样本量满足、并完成上下文擦除vs secret 回收检查。

## 6. 收口Conclusion

多租户security不is给table加 `tenant_id` 就结束，shared worker 的执lines态隔离同样必须被正式建模。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-51: 本文原先只有定性隔离规则，Root cause: 租户隔离合同强调边界principle，却没有把 shared worker 风险提升到可执lines的自动触发器。修复：正文现新增自动隔离触发器，要求在 `failure_rate > 30%` 且达到 `min_sample_size` 时自动隔离并 fail-closed。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
