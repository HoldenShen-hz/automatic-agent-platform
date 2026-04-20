# Source

> `src/` 包含 Automatic Agent Platform 的正式实现代码与迁移基线。

## 目录结构

```
src/
├── index.ts                    # Phase 1A 演示入口
├── cli/                        # CLI 操作入口 (71 个命令)
├── core/                       # 核心领域服务
│   ├── autonomy/              # 渐进式自主权边界（平台新建骨架）
│   ├── dashboard/             # 统一运营看板边界（平台新建骨架）
│   ├── goal-decomposition/    # 目标分解引擎边界（平台新建骨架）
│   ├── nl-entry/              # 自然语言入口边界（平台新建骨架）
│   ├── proactive-agent/       # 主动式 Agent 边界（平台新建骨架）
│   ├── types/                 # 类型定义
│   ├── storage/               # SQLite 存储层
│   ├── events/                # 耐久事件总线
│   ├── runtime/               # 运行时服务 (34+ 文件)
│   ├── security/              # 安全服务
│   ├── tools/                 # 工具服务
│   ├── approvals/             # 审批服务 (HITL)
│   ├── workflow/               # 工作流系统
│   ├── orchestration/         # 编排服务
│   ├── config/                # 配置治理
│   ├── divisions/             # 事业部加载器
│   ├── artifacts/             # 制品存储
│   ├── memory/                # 内存系统
│   ├── messages/              # 消息系统
│   ├── observability/         # 可观测性
│   ├── results/               # 结果封装
│   ├── cost/                  # 成本追踪
│   ├── ops/                   # 运维服务
│   └── testing/               # 稳定性排练 (30+ 模块)
└── gateway/                   # 网关适配器
    ├── stream-bridge.ts       # SSE 流桥接
    └── user-portal/           # 非技术用户入口边界（平台新建骨架）
```

## 核心模块

| 模块 | 说明 |
| --- | --- |
| `runtime/` | 执行调度、租约管理、状态转换、恢复服务 |
| `storage/` | SQLite 数据库封装、迁移管理、数据访问层 |
| `events/` | 三层事件总线 (Tier 1/2/3)、事件注册表 |
| `security/` | 沙箱策略、策略引擎、审计事件完整性 |
| `tools/` | 命令执行、Skill 执行、输出清理、路径范围 |
| `workflow/` | 最小工作流、工作流验证器、输出 Schema |
| `memory/` | 内存服务、整合、质量追踪 |
| `nl-entry/` | 自然语言任务入口契约与解析上下文 |
| `goal-decomposition/` | 目标图、子目标与 DAG 分解边界 |
| `proactive-agent/` | 主动唤醒、触发器和计划调度边界 |
| `autonomy/` | 渐进式自主权等级与信任策略边界 |
| `dashboard/` | 统一运营看板聚合边界 |

## CLI 命令

运行 `npm run doctor` 查看系统健康状态。

完整 CLI 列表请参考项目根目录下的迁移参考与代码架构文档。

## 测试

- `npm test` - 运行全部测试
- `npm run test:unit` - 单元测试
- `npm run test:integration` - 集成测试
- `npm run test:golden` - 黄金路径测试

## 文档

- [平台架构设计](../docs_zh/automatic_agent_patform_arthitecture_design.md)
- [迁移指南](../docs_zh/migrate_guideline.md)
- [治理术语表](../docs_zh/governance/glossary_and_terminology.md)
- [契约文档](../docs_zh/contracts/)
