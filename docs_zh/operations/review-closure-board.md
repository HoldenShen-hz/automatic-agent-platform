# Review Closure Board

## 状态定义

| 状态 | 含义 |
| --- | --- |
| `已解决（本轮落地）` | 已有代码或权威文档修复，并附定向验证 |
| `已复核关闭` | 经过复核后确认属于边界澄清、风险接受或历史兼容，不宣称代码已改 |
| `治理项` | 需要后续拆分的大型治理，不在当前补丁中伪装关闭 |

## 当前看板入口

| 文档 | 用途 |
| --- | --- |
| `docs_zh/reviews/platforme-full-review-a.md` | 当前批次问题总表 |
| `docs_zh/reviews/platforme-full-review.md` | 历史大表，现已补充“已复核关闭”状态轴 |
| `docs_zh/operations/operations-tracker.md` | 运维/交付入口索引 |

## 维护规则

- 不能再把“复核收口”“设计取舍”“未来演进”写成 `已解决`。
- 每个 review 关闭动作都要给出根因和验证/复核依据。
- review 文件与 operations 索引必须互相引用，避免孤岛式结论。
