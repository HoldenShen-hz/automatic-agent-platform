# 测试覆盖率基线门禁

## 目的

本仓库把覆盖率视为持续跟踪的工程信号，而不is一iterations性的百分比截图。

当前覆盖率流程提供：

- `c8` 输出 HTML、LCOV、text、JSON summary
- 面向目录的聚合报告
- 忽略零可执lines覆盖文件后的目录统计
- 版本化 baseline，防止覆盖率静默回退
- 在有意调整覆盖形状时可repeats更新 baseline 的流程

## 命令

- `npm test`
  运linesfull基线，生成覆盖率，并执lines baseline gate。
- `npm run test:raw`
  only执lines分层测试vs覆盖采集。
- `npm run coverage:report`
  生成 `coverage/coverage-directory-summary.json` vs `coverage/coverage-directory-summary.md`。
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

1. 可信的full基线测试via
2. 覆盖率变化is有意lines为，而不is未知退化
3. 已审查目录级报告，没有可疑下滑

不要用更新 baseline 来掩盖no法解释的覆盖率下降。
