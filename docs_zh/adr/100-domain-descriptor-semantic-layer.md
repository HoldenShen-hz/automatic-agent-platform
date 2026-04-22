# ADR-100 Domain Descriptor As Semantic Layer

---

## OAPEFLIR 关联

- **Observe**: 领域信号、术语、风险与知识边界输入
- **Assess**: 领域描述完整度与一致性校验
- **Plan**: 以 descriptor 驱动 workflow、prompt、eval
- **Execute**: 按 descriptor 暴露领域能力
- **Feedback**: 汇总领域表现与治理反馈
- **Learn**: 迭代领域元模型
- **Improve**: 优化 descriptor completeness
- **Release**: descriptor 成为领域上线门

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

业务域不能只靠目录名或 pack 名字表达语义，必须有正式 semantic layer。

## 决策

- `DomainDescriptor` 是业务域 authoritative 语义层
- 所有 workflow、tool bundle、prompt library、risk/eval 都要挂回 descriptor

## 后果

- 领域元模型和领域注册主链有统一根对象
