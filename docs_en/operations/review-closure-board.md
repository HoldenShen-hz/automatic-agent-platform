# Review Closure Board

## Statusdefines

| Status | 含义 |
| --- | --- |
| `已解决（本轮落地）` | 已有code或权威文档修复，并附定向验证 |
| `已复核关闭` | via过复核后确认belongs to边界澄清、风险accepts或历史兼容，不宣称code已改 |
| `治理项` | 需要后续拆分的大型治理，不在当前补丁中伪装关闭 |

## 当前看板入口

| 文档 | 用途 |
| --- | --- |
| `docs_zh/reviews/platforme-full-review-b.md` | 当前持续收口的大tablevsIssueStatus入口 |
| `docs_zh/operations/review-prevention-plan.md` | review 高频Issue的预防方案vs门禁落地顺序 |
| `docs_zh/reviews/platforme-full-review-a.md` | 当前批iterationsIssue总table |
| `docs_zh/reviews/platforme-full-review.md` | 历史大table，现已补充“已复核关闭”Status轴 |
| `docs_zh/operations/operations-tracker.md` | 运维/交付入口索references |

## 已门禁化

| class别 | Status | Description |
|---|-------|--------|
| class型压制回升 | `已解决（本轮落地）` | `audit-type-suppressions.mjs` 已接入 `audit:repo-hygiene`，按基线阻止回升 |
| 裸 URL 回升 | `已解决（本轮落地）` | `audit-outbound-urls.mjs` 已接入 `audit:repo-hygiene`，新例外必须显式 allowlist |
| 公共入口 deep import 漂移 | `已解决（本轮落地）` | `audit-public-entrypoints.mjs` 已接入 `audit:repo-hygiene`，`src/index.ts` 已回收至公开 barrel |
| repeats测试标题回升 | `已解决（本轮落地）` | `audit-duplicate-test-titles.mjs` 已接入 `audit:repo-hygiene`，按存量基线阻止继续恶化 |

## 维护规则

- 不能再把“复核收口”“设计取舍”“未来演进”写成 `已解决`。
- 每个 review 关闭动作都要给出Root Cause和验证/复核依据。
- review 文件vs operations 索references必须互相references用，避免孤岛式Conclusion。
- 每关闭一class高频Issue，都应回写 `review-prevention-plan.md`，明确isno已via门禁化。
