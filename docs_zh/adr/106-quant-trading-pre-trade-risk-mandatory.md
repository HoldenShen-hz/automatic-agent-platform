# ADR-106 Quant Trading Pre Trade Risk Mandatory

---

## OAPEFLIR 关联

- **Observe**: 读取订单、仓位与风控阈值
- **Assess**: 做盘前风险评估
- **Plan**: 决定是否允许下单
- **Execute**: 仅在风控通过后进入执行链
- **Feedback**: 记录阻断原因与风控证据
- **Learn**: 复盘异常订单模式
- **Improve**: 调整风控参数
- **Release**: trading 域必须通过专属风险门

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

量化交易域的错误执行成本极高，必须有独立于平台通用风险的前置风控。

## 决策

- 所有交易动作必须先通过 pre-trade risk
- 硬性仓位和损失限额不得由 Agent 覆盖

## 后果

- `quant-trading` 域有不可绕过的前置风控边界
