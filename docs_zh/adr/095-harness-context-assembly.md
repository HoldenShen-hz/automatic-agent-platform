# ADR-095 Harness Context Assembly

---

## OAPEFLIR 关联

- **Observe**: 收集 task/domain/shared context sources
- **Assess**: 对 token budget 与敏感信息进行评估
- **Plan**: 组装 context block 与 snapshot 粒度
- **Execute**: 为 Harness node execution 提供上下文输入
- **Feedback**: 记录上下文缺失与压缩结果
- **Learn**: 识别最有价值的上下文来源
- **Improve**: 优化压缩和命名空间策略
- **Release**: 将 context quality 纳入 runtime 验收

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

上下文如果没有统一装配器，Harness 会在不同调用路径中重复拼接、无法审计，也无法压缩和重放。

## 决策

- `ContextAssembler` 作为 Harness 的 authoritative 上下文组装入口
- 必须支持 task / domain / shared source set
- 每轮 loop 生成 `ContextSnapshot`

## 后果

- 上下文装配变成可测试、可恢复、可治理的正式能力
