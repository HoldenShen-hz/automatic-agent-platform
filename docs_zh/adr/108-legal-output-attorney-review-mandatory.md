# ADR-108 Legal Output Attorney Review Mandatory

---

## OAPEFLIR 关联

- **Observe**: 收集法律问题、证据与草稿输出
- **Assess**: 判断是否达到律师审核门槛
- **Plan**: 形成 review request 与审批路径
- **Execute**: 将外发前输出转入人工审核
- **Feedback**: 记录律师审核结论
- **Learn**: 归档高风险法律场景
- **Improve**: 优化 legal 域护栏与模板
- **Release**: legal 域必须保留律师审核闭环

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

法务域输出具有高风险，Agent 只能提供法律信息，不能直接形成未经审核的法律意见。

## 决策

- `legal` 域所有外发或可执行输出必须经执业律师审核
- Agent 输出必须保留为草稿和信息支持材料

## 后果

- legal 域的人机协作边界被正式写入架构治理
