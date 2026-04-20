# Change Control

---

## OAPEFLIR 关联

本治理文档规范 OAPEFLIR 八阶段认知循环中的以下内容：

- **Observe**：信号采集与治理边界
- **Assess**：执行评估与权限治理
- **Plan**：规划约束与 R3 硬约束
- **Execute**：执行权限与安全边界
- **Feedback**：反馈信号治理与分类
- **Learn**：学习内容验证与推广边界
- **Improve**：改进候选审批与 Rollout 治理
- **Release**：发布权限与自动回滚规则

---

## 1. 目标

定义文档和设计变更的最小治理流程，避免未定稿就开始编码。

## 2. 适用范围

适用于：

- 新增核心 contract。
- 修改主架构边界。
- 调整 phase 范围。
- 引入高风险新能力。

## 3. 最小流程

1. 先更新主干文档或 contract。
2. 如涉及取舍，补 ADR。
3. 如影响当前实现顺序，更新 operations。
4. 如影响当前判断，更新 reviews。

## 4. 编码前要求

- 若 contract 未稳定，不应直接写对应核心代码。
- 若 reviews 中仍明确存在 P0 文档缺口，应优先补文档。

## 5. 变更请求模板

所有核心 contract、架构、主干文档的变更必须通过以下模板正式提交：

```markdown
## 变更标题
[简短描述变更意图]

## 变更类型
- [ ] 新增 contract
- [ ] 修改 contract
- [ ] 主架构边界调整
- [ ] Phase 范围调整
- [ ] 高风险新能力引入

## 影响范围
- 影响文件/模块：
- 影响系统：
- 回滚复杂度（低/中/高）：

## 变更理由
[为什么要做这个变更]

## 备选方案
[如有，列出至少一个替代方案及未选原因]

## 审批流程
| 步骤 | 审批人 | 状态 |
|------|--------|------|
| 1. 文档草案 | TBD | [ ] |
| 2. ADR 评审（如适用）| TBD | [ ] |
| 3. 代码审查 | TBD | [ ] |
| 4. 集成测试 | CI | [ ] |
| 5. 审批人签字 | TBD | [ ] |

## 相关链接
- 相关 ADR：
- 相关 contract：
- 相关 issue/PR：
```

## 6. 审批角色定义

| 角色 | 职责 | 适用变更 |
|------|------|---------|
| 架构师 | 审批主架构边界变更 | §4-§9 平台基础设施层 |
| 技术负责人 | 审批 contract 字段变更 | 所有 contract 文件 |
| 运维负责人 | 审批 operations 流程变更 | `docs_zh/operations/` |
| 安全评审 | 审批高风险新能力 | 含安全影响的新功能 |

## 7. 工具链引用

- **文档追踪**：通过 GitHub PR / Issues 管理变更请求
- **ADR 管理**：[`docs_zh/adr/README.md`](../adr/README.md)
- **Contract 注册**：[`docs_zh/contracts/README.md`](../contracts/README.md)
- **架构索引**：[`docs_zh/architecture/README.md`](../architecture/README.md)
- **现状追踪**：[`docs_zh/reviews/`](.docs_zh/reviews/) 下各 review 文档
