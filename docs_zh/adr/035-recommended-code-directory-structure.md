# ADR-035 推荐代码目录

- 状态：Accepted
- 决策日期：2026-04-17

## 背景

代码目录结构需要与五平面架构对应，便于开发者定位和理解代码。

## 决策

### 9 大顶层模块

```
src/
  platform/       # 五平面运行时核心
  domains/        # 领域描述符、接入、治理
  interaction/    # NL 入口、目标分解、看板
  org-governance/ # 组织层次、审批路由、SSO
  scale-ecosystem/# 多 Region、市场、集成
  ops-maturity/   # 可解释性、紧急制动、漂移检测
  plugins/        # 插件 SDK
  sdk/            # 开发者工具链
  apps/           # 应用示例
```

### platform/ 子目录

```
platform/
  interface/      # API、Webhook、Scheduler、Console、Ingress
  control-plane/  # IAM、Config-Center、Approval、Incident、Rollout
  orchestration/  # OAPEFLIR、Workflow、Planner、Routing
  execution/      # Dispatcher、Execution-Engine、Recovery、Worker-Pool
  state-evidence/ # Truth、Events、Artifacts、Memory、Knowledge
  shared/         # 横切服务
```

### 额外目录

- `core/` 兼容性层（不新增canonical runtime逻辑）
- `benchmarks/` 性能测试
- `testing/` 测试工具

## 后果

优点：

- 目录结构与架构映射清晰
- 便于开发者定位代码
- 支持大规模团队并行开发

代价：

- 重构现有代码需要较大成本
- 需要保持与文档同步

## 交叉引用

- [ADR-001 三层分权架构](./001-three-layer-architecture.md)

## 来源章节

- `§35` 推荐代码目录
