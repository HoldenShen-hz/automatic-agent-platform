# ADR-095 Harness Context Assembly

---

## OAPEFLIR 关联

- **Observe**: 收集 task/domain/shared context sources
- **Assess**: 对 token budget vs敏感信息进lines评估
- **Plan**: 组装 context block vs snapshot 粒度
- **Execute**: 为 `NodeRun / NodeAttempt` 提供上下文输入
- **Feedback**: record上下文缺失vs压缩结果
- **Learn**: 识别最有价值的上下文来源
- **Improve**: 优化压缩和命名空间策略
- **Release**: 将 context quality 纳入 runtime 验收

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

上下文如果没有统一装配器，Harness 会在不同call路径中repeats拼接、no法审计，也no法压缩和重放。

## Decision

- `ContextAssembler` 作为 Harness 的 authoritative 上下文组装入口
- 每iterations上下文装配必须带 `NodeRun` 级别的 scope / audit ref，避免 task 级大包裹失真
- 必须supported task / domain / shared source set
- 每轮 loop 生成 `ContextSnapshot`

## Consequences

- 上下文装配变成可测试、可恢复、可治理的正式能力
