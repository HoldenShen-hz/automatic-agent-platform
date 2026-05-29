# Quickstart

## 目标

这份文档帮助你在拆分后的文档体系里快速找到阅读路径，并把注意力聚焦到当前最应该实现的基建范围，而不是重新掉回超长文档里迷路。

## 推荐阅读顺序

1. 先读 [平台骨架](../architecture/00-platform-architecture.md)，建立全局心智模型。
2. 再读 [ADR-001](../adr/001-three-layer-architecture.md)、[ADR-004](../adr/004-workflow-routing.md)、[ADR-009](../adr/009-deployment-ops.md)，理解核心主链路。
3. 如果当前要实现记忆、成本或安全，再分别补读 [ADR-020](../adr/020-memory-six-plane-model.md)、[ADR-008](../adr/008-cost-model.md)、[ADR-005](../adr/005-security-model.md)。
4. 如果当前要新增业务能力，最后读 [Division Authoring](./division-authoring.md)。

## 当前建议实现范围

优先只做 Phase 1a 和 Phase 1b 的必需能力：

- 单 Agent 基建核心。
- VP 运营接入与路由。
- 基础工作流状态管理。
- 消息与事件持久化。
- 成本守卫和基础审批。
- 崩溃恢复。
- 多 Agent 编排的最小 happy path。

暂时不要提前做的内容：

- 多租户。
- Marketplace。
- 完整 8 维进化。
- 全量长期记忆/知识治理能力一次性铺开。
- 过多事业部铺设。
- 复杂 Web 体验和企业级合规能力。

## Phase 1a 落地顺序建议

1. 建立项目目录和配置骨架。
2. 实现任务、会话、事件和工作流状态的最小存储模型。
3. 打通单任务从接收、执行到返回的 happy path。
4. 加入成本守卫、基础审批和错误体系。

## Phase 1b 补强建议

1. 引入 VP 运营、VP 编排和基础任务看板。
2. 打通跨事业部拆分和结果聚合。
3. 增加恢复、自愈和流式输出。
4. 为后续记忆与监管预留埋点。

## 文档约定

- 总纲负责说明”平台是什么”。
- ADR 负责说明”为什么这么设计”。
- Guides 负责说明”具体怎么做”。
- 去重归档版只作为历史参考，不再作为首选入口。

## 故障排查

### 常见问题

#### 1. 构建失败（npm run build）

**症状**: TypeScript 编译错误或模块未找到

**排查步骤**:
1. 确认 Node.js 版本 ≥ 22（`node --version`）
2. 清除缓存：`rm -rf dist node_modules && npm install`
3. 重新构建：`npm run build`

#### 2. 测试失败（npm test）

**症状**: 单元测试或集成测试报错

**排查步骤**:
1. 确认构建产物最新：`npm run build:test`
2. 先跑快速分层回归：`npm run test:layers:smoke`
3. 按层定位：`npm run test:unit` / `npm run test:invariants` / `npm run test:integration` / `npm run test:e2e`
4. 检查是否有未提交的迁移文件冲突
5. 查看具体测试文件位置和错误信息
6. 运行单个测试文件定位问题：`node --import tsx --test tests/unit/xxx.test.ts`

#### 3. 类型检查失败（npm run typecheck）

**症状**: `tsc --noEmit` 报告类型错误

**排查步骤**:
1. 检查错误文件是否导入了不存在的模块
2. 确认所有 `.ts` 导入使用 `.js` 扩展名（ESM 规范）
3. 查看 `src/platform/` 目录结构是否与 `tests/` 镜像结构一致

#### 4. 文档链接失效

**症状**: 点击文档中的链接跳转到 404 页面

**排查步骤**:
1. 确认目标文件存在于当前语种目录树（中文文档在 `docs_zh/`，英文文档在 `docs_en/`）
2. 检查相对路径是否正确（上级目录用 `../`）
3. 确认文档编号与实际文件名匹配

### 调试工具

| 工具 | 命令 | 用途 |
|------|------|------|
| 类型检查 | `npm run typecheck` | 验证 TypeScript 类型 |
| 分层冒烟 | `npm run test:layers:smoke` | 先跑 unit + invariants |
| 分层开发回归 | `npm run test:layers:dev` | 跑 unit + invariants + golden |
| 单层测试 | `npm run test:unit` / `npm run test:integration` / `npm run test:e2e` | 按层定位问题 |
| 构建诊断 | `npm run build 2>&1 | grep error` | 过滤构建错误 |
| 文档验证 | `npm run docs:markdown-render` | 检查文档渲染与 Markdown 结构 |
