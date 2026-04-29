# ADR-101 Domain Risk Override Over Platform Default

---

## OAPEFLIR 关联

- **Observe**: 平台默认风险矩阵与领域特化风险输入
- **Assess**: 判断是否允许领域覆写
- **Plan**: 形成领域风险 profile
- **Execute**: 在任务运行前应用领域风险优先级
- **Feedback**: 记录覆写理由和审计证据
- **Learn**: 识别高风险领域共性
- **Improve**: 优化领域风险基线
- **Release**: 高风险域上线前必须完成覆写审查

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

平台默认风险矩阵不足以覆盖金融、法务、医疗等高敏感领域。

## 决策

- 领域风险画像优先于平台默认风险矩阵
- 任何覆写都必须留下审计理由
- 无显式领域风险 profile 时，禁止高风险自动化
- **DomainRiskSpec 必填字段**：high/critical 域必须显式声明 `advisory_only`、`human_accountable`、`deterministic_hot_path_only` 三选一（或等价责任边界），未声明时平台按更保守模式处理，默认不允许 full_auto（见 §10 风险控制、§37.3 DomainRiskProfile）

## 后果

- 高风险领域拥有清晰的治理边界
- DomainRiskSpec validator 强制校验必填字段，block domain release（见 INV-DOMAIN-001）
