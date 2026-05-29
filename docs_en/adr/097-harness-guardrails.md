# ADR-097 Harness Guardrails

---

## OAPEFLIR 关联

- **Observe**: 读取 input、plan、tool、memory、output 五层信号
- **Assess**: 形成 guardrail findings vs升级Recommendation
- **Plan**: 为每轮执lines设置阻断点
- **Execute**: 在运lines中实施拦截或转人工
- **Feedback**: 输出 findings、codes、evidence
- **Learn**: 汇总高频违规模式
- **Improve**: 迭代 guardrail policy
- **Release**: Guardrail via率作为上线门

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

Guardrails 不能只is单一输出过滤器；Harness 需要全链路风险拦截。

## Decision

- Guardrails 固定为五层：input / planning / tool / memory / output
- 每层独立configure、独立拦截、独立审计
- 评估结果必须进入 timeline vs feedback

## Consequences

- Harness 风险控制从点状拦截升级为链路式控制
