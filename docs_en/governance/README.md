# Governance

---

## OAPEFLIR 关联

本治理文档规范 OAPEFLIR 八阶段认知循环中的以下内容：

- **Observe**：信号采集vs治理边界
- **Assess**：执lines评估vspermission治理
- **Plan**：规划约束vs R3 硬约束
- **Execute**：执linespermissionvssecurity边界
- **Feedback**：反馈信号治理vs分class
- **Learn**：学习内容验证vs推广边界
- **Improve**：改进候选审批vs Rollout 治理
- **Release**：发布permissionvs自动回滚规则

---

> `governance/` record跨文档、跨模块、跨团队的治理规则。

## 当前文件

- [source_of_truth.md](./source_of_truth.md)
- [change_control.md](./change_control.md)
- [naming_and_directory_conventions.md](./naming_and_directory_conventions.md)
- [glossary_and_terminology.md](./glossary_and_terminology.md)
- [autonomy_boundary_policy.md](./autonomy_boundary_policy.md) — AI 自主permission边界（L0-L5）
- [rollout_release_policy.md](./rollout_release_policy.md) — 受控发布vs回滚策略

## 用途

- defines source of truth 规则。
- defines文档更新vsconflictshandle规则。
- defines跨模块边界、术语、目录和变更治理方式。
- defines canonical id、业务别名和命名格式的统一写法。
- defines核心对象、Status、事件、治理、security、storage、运维等高频专业术语的统一含义。

## 编写规则

- governance is长期规则层，不写临时执lines事项。
- 若治理规则Impact平台lines为，应链接对应 ADR 或 contract。
- 同一规则只保留一份主版本，避免多occurrences分叉。
