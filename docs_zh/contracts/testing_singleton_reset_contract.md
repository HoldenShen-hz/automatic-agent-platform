# Testing Singleton Reset Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 release
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义测试环境下全局单例、缓存、注册表和长生命周期运行对象的 reset 规则。

相关文档：

- `project_structure_contract.md`
- `context_propagation_contract.md`
- `runtime_repository_and_migration_contract.md`

## 2. 目标

测试 reset 体系至少要保证：

- 单元测试、集成测试之间不会互相污染全局状态。
- 每个测试运行前都能回到可预测的最小干净环境。
- reset 能力是正式 API，而不是零散私有 hack。

## 3. 必须支持 reset 的对象

Phase 1a 最少包括：

- runtime registry / active execution map
- SQLite 连接与内存缓存
- provider client cache / health cache
- tool registry / plugin registry
- event bus listeners / in-memory queues
- config cache / feature flags
- cost tracker / quota counters
- AsyncLocalStorage test harness

## 4. 命名与暴露规则

建议命名：

- `_resetRuntimeForTesting()`
- `_resetStorageForTesting()`
- `_resetProviderForTesting()`
- `_resetEventBusForTesting()`
- `_resetToolRegistryForTesting()`
- `_resetConfigForTesting()`

规则：

- reset API 必须显式带 `ForTesting` 后缀。
- 默认仅允许在 `NODE_ENV=test` 下调用。
- reset 行为必须幂等，多次调用结果一致。

## 5. `TestResetReport`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `component` | `string` | 被 reset 的组件 |
| `reset_applied` | `boolean` | 是否成功 |
| `cleared_items` | `number?` | 清理数量 |
| `warnings` | `string[]` | 异常告警 |

## 6. 全局测试入口

```mermaid
flowchart TD
    A["beforeEach / setupFiles"] --> B["reset Config"]
    B --> C["reset Runtime / EventBus"]
    C --> D["reset Provider / Cost Tracker"]
    D --> E["reset Tool Registry / Plugins"]
    E --> F["recreate Temp Storage"]
    F --> G["run test"]
```

规则：

- 测试 setup 应统一调用总入口，而不是每个测试文件各自拼凑 reset 顺序。
- reset 失败应直接让测试失败，而不是静默忽略。

## 7. 临时资源规则

- 临时 SQLite 数据库每个 test file 或 test case 应可隔离创建。
- 临时 artifact 目录应在 teardown 清理。
- 临时 network mock / fake gateway state 也应纳入 reset 流程。

## 8. 与实现代码的边界

- reset 只服务测试，不得成为生产恢复机制的替代。
- 生产代码中的 shutdown / cleanup 与测试 reset 可共享底层逻辑，但对外入口应分开。

## 9. Phase 边界

Phase 1a 做：

- 关键单例 reset API
- 测试 setup 统一调用
- `NODE_ENV=test` 守卫

Phase 1b 做：

- 更多 integration / e2e 共享 harness
- gateway / orchestration 测试的额外 reset 入口

## 10. 收口结论

没有统一 reset 体系的测试，很快就会从“回归保护”退化成“偶尔通过的随机脚本”；这份 contract 就是把测试隔离边界正式冻结下来。
