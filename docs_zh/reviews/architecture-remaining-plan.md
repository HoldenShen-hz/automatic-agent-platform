# 架构设计实现剩余工作计划

**版本**: v1.0
**日期**: 2026-04-22
**基于**: docs_zh/reviews/architecture-design-vs-implementation-review.md v4.2

---

## 一、已收口项确认（无需再处理）

| 类别 | 项目 | 状态 |
|------|------|------|
| P0 | Dockerfile入口、Redis错误日志、DLQ持久化、队列.catch清理 | ✅ 已完成 |
| P1 | CAS状态转换、Outbox集成、SLO告警、StructuredLogger异步、会话fdatasync | ✅ 已完成 |
| P2 | Prometheus规则(16条)、OTEL默认开启、KEYS→SCAN、spawnSync移除、Map TTL、启动校验、路径遍历、docker-compose凭证、部署脚本护栏、Helm域名、Fluentd退避 | ✅ 已完成 |
| P3 | 路由去重、Outbox批量、ServiceRegistry迁移、PagerDuty URL可配置 | ✅ 已完成 |

---

## 二、剩余长期演进项（ℹ️ 非紧急）

### 2.1 P3.26 巨类收敛（5天人天）

**现状**: 10文件>800行，但已有显著改善

**目标文件**:
1. `HumanTakeoverServiceAsync` - 已拆分出 TakeoverQueueManager/TakeoverEscalationManager
2. 其他待评估大文件

**方案**: 提取内聚方法组为小类，保持原接口兼容

---

### 2.2 P3.28 Record<string,unknown>类型改进（5-8天人天）

**现状**: 822处，但主要是开放JSON envelope建模

**高价值改进点**:
1. `delegation-types.ts` - 约束schema类型（已做部分）
2. 工具输入输出类型（tool input/output）
3. 事件payload类型（event payloads）

**方案**: 渐进式替换，优先高价值点

---

### 2.3 P3.29 Zod schema校验均衡（3天人天）

**现状**: 声明/校验3:1失衡

**改进点**:
1. API handlers接收外部数据处
2. Tool executor输入验证
3. Config loaders运行时校验

**方案**: 在关键入口添加z.parse()调用

---

### 2.4 P3.31 ops-maturity叶子工具增强（5-10天人天）

**现状**: 部分文件<50行但功能完整

**待增强**:
1. `incident-diagnoser/index.ts` (9行)
2. `config-optimizer/index.ts` (7行)
3. `dev-assistant/index.ts` (7行)

**方案**: 基于接口定义扩展功能

---

### 2.5 P3.32 limit-only查询优化（2天人天）

**现状**: 内部查询用LIMIT无游标

**改进点**:
1. 任务列表深度翻页
2. DLQ查询
3. Worker列表

**方案**: 添加cursor参数

---

## 三、执行方案

### 第一阶段：验证收口（1小时）
- 确认所有✅项确实已实现
- 验证构建通过

### 第二阶段：快速修复（2-3小时）
1. P3.32 limit-only查询 - cursor分页
2. P3.29 Zod验证 - 高风险入口添加校验

### 第三阶段：长期演进（按需）
- P3.26巨类 - 按优先级逐步重构
- P3.28类型 - 渐进式替换
- P3.31叶子工具 - 功能增强

---

## 四、验证清单

```
[ ] npm run build 通过
[ ] npm run test 通过
[ ] 无新增TypeScript错误
[ ] 所有章节状态与文档一致
```

---

**文档结束**
