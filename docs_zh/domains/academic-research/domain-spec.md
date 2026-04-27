# 学术调研域 Domain Spec

| 字段 | 值 |
| --- | --- |
| architecture_section | §79 |
| implementation_module | `src/domains/academic-research/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | 学术研究负责人 |

## 硬约束

- 每条引用必须可解析到真实论文或可信数据库记录。
- 零容忍捏造引用。
- 综述、结论和推荐必须区分事实、推断和假设。

## 验收入口

- GA 前必须提供 DOI/数据库验证、引用准确率和人工复核证据。
