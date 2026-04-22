# ADR-107 Financial Services Explainable Decisions

---

## OAPEFLIR 关联

- **Observe**: 收集客户、规则、特征与证据
- **Assess**: 形成金融决策与拒绝原因
- **Plan**: 生成 explanation payload
- **Execute**: 输出可解释结果
- **Feedback**: 接收公平性与合规反馈
- **Learn**: 识别不良决策模式
- **Improve**: 调整评分和 explanation 模板
- **Release**: 金融域解释义务纳入验收门

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

金融服务域的自动化决策必须满足可解释和公平借贷要求。

## 决策

- 不利决策必须附带结构化 explanation
- explanation 必须可追溯到 evidence 和规则

## 后果

- `financial-services` 域的输出不再只是结果，还必须携带理由
