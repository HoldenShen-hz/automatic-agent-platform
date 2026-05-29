# ADR-108 Legal Output Attorney Review Mandatory

---

## OAPEFLIR 关联

- **Observe**: 收集法律Issue、证据vs草稿输出
- **Assess**: 判断isno达到律师审核门槛
- **Plan**: 形成 review request vs审批路径
- **Execute**: 将外发前输出转入人工审核
- **Feedback**: record律师审核Conclusion
- **Learn**: 归档高风险法律场景
- **Improve**: 优化 legal 域护栏vs模板
- **Release**: legal 域必须保留律师审核闭环

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

法务域输出具有高风险，Agent 只能提供法律信息，不能directly形成未via审核的法律意见。

## Decision

- `legal` 域所有外发或可执lines输出必须via执业律师审核
- Agent 输出必须保留为草稿和信息supported材料

## Consequences

- legal 域的人机协作边界被正式writesArchitecture治理
