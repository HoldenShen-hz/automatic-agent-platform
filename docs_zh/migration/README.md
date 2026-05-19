# Migration

`migration/` 只回答两个问题：怎么迁、迁什么。

## 文件顺序

1. [00-migration-guideline.md](./00-migration-guideline.md)
   迁移原则、等级、吸收方式与判断标准。
2. [01-migration-scope.md](./01-migration-scope.md)
   新平台正式迁移边界与排除项。
3. [e2e-workflow-state-migration.md](./e2e-workflow-state-migration.md)
   E2E 工作流测试从 legacy `insertWorkflowState()` 迁移到 canonical `runMultiStepOrchestration()` 的示例。

## 使用原则

- 先按 guideline 判断，再按 scope 执行。
- 与平台骨架冲突时，以 `architecture/00-platform-architecture.md` 为准。
- `docs_zh/migrations/` 仅保留 legacy alias 页面；migration 单数目录是当前权威入口。
