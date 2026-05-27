# 测试覆盖率基线门禁

## 目的

本仓库把覆盖率视为持续跟踪的工程信号，而不是一次性的百分比截图。

当前覆盖率流程提供：

- `c8` 输出 HTML、LCOV、text、JSON summary
- 面向目录的聚合报告
- 忽略零可执行覆盖文件后的目录统计
- 版本化 baseline，防止覆盖率静默回退
- 在有意调整覆盖形状时可重复更新 baseline 的流程

## 命令

- `npm test`
  运行全量基线，生成覆盖率，并执行 baseline gate。
- `npm run test:raw`
  仅执行分层测试与覆盖采集。
- `npm run coverage:report`
  生成 `coverage/coverage-directory-summary.json` 与 `coverage/coverage-directory-summary.md`。
- `npm run coverage:gate`
  重新生成目录报告，并对比 `.coverage-baseline.json`。
- `npm run coverage:baseline:update`
  在确认变更合理后更新 baseline。

## 产物

- `coverage/index.html`：HTML 报告
- `coverage/lcov.info`：LCOV 输出
- `coverage/coverage-summary.json`：c8 文件级摘要
- `coverage/coverage-directory-summary.json`：目录聚合摘要
- `coverage/coverage-directory-summary.md`：人工可读目录报告
- `.coverage-baseline.json`：版本化门禁基线

## 更新规则

只有满足以下条件时才允许更新 `.coverage-baseline.json`：

1. 可信的全量基线测试通过
2. 覆盖率变化是有意行为，而不是未知退化
3. 已审查目录级报告，没有可疑下滑

不要用更新 baseline 来掩盖无法解释的覆盖率下降。
