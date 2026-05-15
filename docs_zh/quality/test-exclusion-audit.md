# 测试排除审计

`tsconfig.json` 的 `exclude` 可能包含历史不稳定测试、类型循环、构建性能规避或不应参与编译的 E2E/集成测试。不能只用“exclude 很长”判断测试失效，必须逐项分类。

## 审计命令

```bash
node scripts/ci/audit-test-exclusions.mjs
```

输出包含：

- `totalExcludeEntries`: tsconfig exclude 总数。
- `testExcludeEntries`: 命中 test/e2e/integration/golden 的排除项数量。
- `testExcludes`: 具体排除项列表。

## 分类规则

- 构建范围排除：不代表测试不运行，只表示不参与主 TypeScript 编译。
- 历史失败排除：必须有点名测试或修复计划。
- E2E/集成排除：应由独立 runner 或 CI job 覆盖。
- Golden 排除：应由 golden 定向测试覆盖。

## 复核要求

问题表中的“测试仍然失败”只能由点名测试结果关闭；“覆盖治理”可以由审计脚本和独立 runner 计划关闭。
