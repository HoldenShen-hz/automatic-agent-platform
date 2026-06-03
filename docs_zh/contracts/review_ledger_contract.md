# Review Ledger Contract

## 目的

`review-ledger` 是把 `docs_zh/reviews/` 中的人工复核结果恢复为机器可消费台账的最小公共契约。

它服务于三类消费者：

- `assurance:review-import`
- `assurance:full`
- `rc:check`

## 产物

实现至少产出以下文件：

```text
artifacts/assurance/review-ledger.raw.jsonl
artifacts/assurance/review-ledger.normalized.jsonl
artifacts/assurance/review-source-coverage-report.json
artifacts/assurance/review-conflict-resolution-report.jsonl
artifacts/assurance/review-evidence-readiness-report.json
```

`assurance:full` 还必须额外产出：

```text
artifacts/assurance/assurance-full-report.json
```

该报告用于说明当前 assurance 总入口实际执行了哪些 required audit、哪些高层 audit 仍未接线，避免入口名称先于实现范围。

## 字段要求

最小 schema 以 [review-ledger.schema.json](/Users/holden/Project/automatic_agent/automatic_agent_platform/schemas/review-ledger.schema.json) 为准。

关键字段语义：

- `reviewSourceId`: 原始 review finding 唯一标识。
- `sourceFile`: finding 来源文件，例如 `docs_zh/reviews/platforme-full-review-e.md`。
- `rowId`: 来源文件内原始编号，例如 `1439`、`SYS-004`、`GAP-01`。
- `canonicalIssueId`: 归一化后 issue 标识；raw ledger 可为空，normalized ledger 必须稳定。
- `status`: 当前 finding 归一化状态。
- `category`: issue family，例如 `test_quality.hard_wait`。
- `sourceKind`: 来源类型，例如 `review_table`、`manual_sample`。
- `sourceRefs`: 反向追溯到原文的最小定位集合。
- `evidenceRefs`: 该 finding 对应的代码、测试、文档或命令证据。
- `freshness`: 当前 review 结论是否仍然新鲜。

`review-evidence-readiness-report.json` 额外按 review source 报告：

- checklist 是否覆盖 `reviewed files / reviewed contracts / reviewed tests / reviewed CI gates / unverified assumptions / found issues / missed areas / confidence score`
- blind spot declaration 是否显式声明
- P0 finding 是否满足双人独立审查要求
- 当前 review 是否可作为 release evidence

## 状态枚举

允许值：

```text
todo
fixed
done
partial
accepted_risk
stale
needs_revalidation
```

## 非目标

本契约不负责：

- 替代代码级 `issue-ledger`
- 决定最终 release 结论
- 把所有叙述性 review 自动变成完美结构化 finding

这些工作由 `assurance:full`、冲突裁决器和人工复核协同完成。
