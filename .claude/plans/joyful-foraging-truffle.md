# 测试覆盖提升计划 - 2026-04-21 (续)

## Context

用户要求根据 `docs_zh/quality/00-full-coverage-test-manual.md` 将测试覆盖提升到 100%。

**当前状态**：
- ✅ Build 成功
- ⚠️ 1,705 测试失败 - SQLite schema migration bug (`organization_id` 列不存在)
- ✅ 已完成大量覆盖改善

---

## 已完成工作

| 改善项 | 之前 | 之后 |
|--------|------|------|
| `locking-support.ts` | 80% | 100% |
| `redis-lock-adapter.ts` | 81% | 91.73% |
| `queue-partitioner.ts` | 92.7% | 100% |
| `sqlite-queue-adapter.ts` | 36.08% | 99.48% |
| 新增测试文件 | - | 200+ tests |

---

## 剩余任务

### 1. 阻塞问题：SQLite schema migration bug
- **根因**: `organization_id` 列在 migration 24 中添加，但某些代码在更早迁移就查询
- **状态**: 预先存在的 infrastructure bug，需要调查迁移顺序
- **影响**: 1,705 个测试失败

### 2. 可继续的覆盖提升（不依赖 DB）

| 目录 | 当前 | 目标 | 行动 |
|------|------|------|------|
| `src/sdk/cli` | 84.9% | 85%+ | 聚焦 CLI 命令处理分支 |
| `src/core/evaluation` | 93.8% | 95%+ | 补充边界条件测试 |
| `src/core/compliance` | 98.3% | 98.5%+ | 小幅提升 |
| `src/core/deployment` | 99.6% | 99.8%+ | 小幅提升 |

### 3. src/sdk/cli 分支覆盖问题
- **当前**: lines 84.9%, branches **48%**
- **问题**: 81 个 CLI 文件，每个有多个条件分支
- **策略**: 聚焦核心 CLI 逻辑，不追求全文件覆盖

---

## 实施计划

### Phase 1: 调查并尝试修复 SQLite schema bug (如可能)

**Agent 1**: 分析 `organization_id` migration 问题
- 检查 migration 顺序和依赖
- 找出哪些表/查询在早期 migration 就引用 `organization_id`
- 尝试修复迁移顺序或添加缺失列

### Phase 2: 继续覆盖提升

**Agent 2**: 补充 `src/sdk/cli` 覆盖
- 检查 `tests/unit/sdk/cli/` 下的现有测试
- 补充命令处理分支测试
- 聚焦核心逻辑

**Agent 3**: 补充 evaluation 和 compliance 测试
- `src/core/evaluation` 边界条件
- `src/core/compliance` 小幅提升

### Phase 3: 验证

```bash
npm run build && npm run test:raw
```

---

## 约束

1. **不要全量测试** - 聚焦可行且有效的覆盖提升
2. **多个 agent 并行工作**
3. **优先修复阻塞问题** - SQLite schema bug
4. **可接受的低覆盖率**:
   - `src/core/types` - 纯类型定义
   - `src/core/runtime` - shim 文件
   - `src/sdk/cli` - 81 个独立入口，全覆盖需要大量工作

---

## 验证

运行测试并检查：
1. Build 是否成功
2. 测试通过数是否增加
3. 覆盖率是否提升