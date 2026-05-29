# ADR-100 Domain Descriptor As Semantic Layer

---

## OAPEFLIR 关联

- **Observe**: 领域信号、术语、风险vs知识边界输入
- **Assess**: 领域Description完整度vs一致性校验
- **Plan**: 以 descriptor 驱动 workflow、prompt、eval
- **Execute**: 按 descriptor 暴露领域能力
- **Feedback**: 汇总领域table现vs治理反馈
- **Learn**: 迭代领域元模型
- **Improve**: 优化 descriptor completeness
- **Release**: descriptor 成为领域上线门

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

业务域不能只靠目录名或 pack 名字table达语义，必须有正式 semantic layer。

## Decision

- `DomainDescriptor` is业务域 authoritative 语义层
- 所有 workflow、tool bundle、prompt library、risk/eval 都要挂回 descriptor

## Consequences

- 领域元模型和领域注册主链有统一根对象
