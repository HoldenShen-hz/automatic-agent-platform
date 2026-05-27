# 架构设计与实现剩余工作计划

**版本**: v1.0  
**日期**: 2026-04-22  
**依据**: `docs_zh/reviews/architecture-design-vs-implementation-review.md`

## 已关闭项

- P0：Dockerfile 入口、Redis 错误日志、DLQ 持久化、queue.catch 清理
- P1：CAS 状态迁移、Outbox 集成、SLO 告警、StructuredLogger async、session fdatasync
- P2：Prometheus 规则、OTEL 默认开启、KEYS→SCAN、spawnSync 移除、Map TTL、启动校验、路径穿越、docker-compose 凭据、部署脚本 guardrail、Helm 域配置、Fluentd backoff
- P3：路由去重、Outbox batch、ServiceRegistry 迁移、PagerDuty URL 配置化

## 长期演进项

### 1. 巨型类拆分

- 继续评估 `>800 LOC` 的高风险文件。
- 以保持原接口兼容为前提，拆出职责明确的子类。

### 2. `Record<string, unknown>` 收敛

- 优先约束 tool input/output、event payload、delegation schema。
- 按高价值入口渐进替换，不做一次性全仓重写。

### 3. Zod 运行时校验补齐

- 优先覆盖 API handler、tool executor、config loader。
- 目标是在关键外部输入边界显式调用 `z.parse()`。

### 4. ops-maturity 叶子工具增强

- 对当前仅保留薄入口的叶子模块补充真实行为。
- 先按接口定义和调用链判断是否值得继续产品化。

### 5. limit-only 查询优化

- 任务列表、DLQ、worker 列表等深分页查询优先补 cursor/分页语义。

## 说明

- 本文件是 `docs_en/reviews/architecture-remaining-plan.md` 的中文镜像。
- 这里只跟踪“剩余演进项”，不替代当前 active review/todo 清单。
