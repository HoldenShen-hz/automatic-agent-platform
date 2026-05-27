# UI 设计与实现一致性评审

> 维护日期：2026-05-27
> 范围：`ui/apps/web`、共享状态层、feature registry、多端 shell。

## 当前结论

| GAP | 结论 | 证据 |
| --- | --- | --- |
| GAP-01 路由与 feature registry 对齐 | 已闭环 | `ui/apps/web/src/feature-registry.ts`、`ui/tsconfig.json`、`tests/features/registry.test.ts` |
| GAP-02 状态层与 feature VM 对齐 | 已闭环 | `ui/packages/shared/state/src/index.ts`、`ui/packages/features/task-cockpit/src/hooks/index.ts`、`ui/packages/features/workflow-builder/src/hooks/index.ts` |
| GAP-03 UI 契约入口与版本化来源对齐 | 已闭环 | `ui/packages/shared/api-client/src/endpoints.ts`、`ui/apps/web/src/app-shell.tsx`、`docs_zh/contracts/ui_console_and_cockpit_contract.md` |

## 回归命令

```bash
npm --prefix ui run typecheck
npm --prefix ui run test -- tests/features/registry.test.ts tests/features/flows.test.tsx
```

## 维护规则

- 新增 UI GAP 时必须写明源码入口、测试命令、未闭环风险。
- 不再接受“已完成”但无文件和命令证据的回写方式。
