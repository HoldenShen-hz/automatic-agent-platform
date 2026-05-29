# ADR-106 Quant Trading Pre Trade Risk Mandatory

---

## OAPEFLIR 关联

- **Observe**: 读取订单、仓位vs风控threshold
- **Assess**: 做盘前风险评估
- **Plan**: 决定isno允许下单
- **Execute**: only在风控via后进入执lines链
- **Feedback**: record阻断原因vs风控证据
- **Learn**: 复盘异常订单模式
- **Improve**: 调整风控参数
- **Release**: trading 域必须via专属风险门

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

量化交易域的错误执lines成本极高，必须有独立于平台通用风险的前置风控。

## Decision

- 所有交易动作必须先via pre-trade risk
- 硬性仓位和损失限额不得由 Agent 覆盖

## Consequences

- `quant-trading` 域有不可bypassing的前置风控边界
