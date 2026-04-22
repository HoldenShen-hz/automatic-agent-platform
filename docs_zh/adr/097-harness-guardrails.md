# ADR-097 Harness Guardrails

---

## OAPEFLIR 关联

- **Observe**: 读取 input、plan、tool、memory、output 五层信号
- **Assess**: 形成 guardrail findings 与升级建议
- **Plan**: 为每轮执行设置阻断点
- **Execute**: 在运行中实施拦截或转人工
- **Feedback**: 输出 findings、codes、evidence
- **Learn**: 汇总高频违规模式
- **Improve**: 迭代 guardrail policy
- **Release**: Guardrail 通过率作为上线门

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

Guardrails 不能只是单一输出过滤器；Harness 需要全链路风险拦截。

## 决策

- Guardrails 固定为五层：input / planning / tool / memory / output
- 每层独立配置、独立拦截、独立审计
- 评估结果必须进入 timeline 与 feedback

## 后果

- Harness 风险控制从点状拦截升级为链路式控制
