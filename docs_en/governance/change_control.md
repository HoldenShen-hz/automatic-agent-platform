# Change Control

---

## OAPEFLIR 关联

本治理文档规范 OAPEFLIR 八阶段认知循环中的以下内容：

- **Observe**：信号采集vs治理边界
- **Assess**：执lines评估vspermission治理
- **Plan**：规划约束vs R3 硬约束
- **Execute**：执linespermissionvssecurity边界
- **Feedback**：反馈信号治理vs分class
- **Learn**：学习内容验证vs推广边界
- **Improve**：改进候选审批vs Rollout 治理
- **Release**：发布permissionvs自动回滚规则

---

## 1. 目标

defines文档和设计变更的最小治理流程，避免未定稿就开始编码。

## 2. 适用范围

适used for：

- 新增核心 contract。
- 修改主Architecture边界。
- 调整 phase 范围。
- references入高风险新能力。

## 3. 最小流程

1. 先更新主干文档或 contract。
2. 如涉及取舍，补 ADR。
3. 如Impact当前实现顺序，更新 operations。
4. 如Impact当前判断，更新 reviews。

## 4. 编码前要求

- 若 contract 未稳定，不应directly写对应核心code。
- 若 reviews 中仍明确存在 P0 文档缺口，应优先补文档。

## 5. 变更request模板

所有核心 contract、Architecture、主干文档的变更必须via以下模板正式提交：

```markdown
## 变更标题
[简短Description变更意图]

## 变更class型
- [ ] 新增 contract
- [ ] 修改 contract
- [ ] 主Architecture边界调整
- [ ] Phase 范围调整
- [ ] 高风险新能力references入

## Impact范围
- Impact文件/模块：
- Impact系统：
- 回滚复杂度（低/中/高）：

## 变更理由
[为什么要做这个变更]

## 备选方案
[如有，列出至少一个替代方案及未选原因]

## 审批流程
| 步骤 | 审批人 | Status |
|------|--------|------|
| 1. 文档草案 | TBD | [ ] |
| 2. ADR 评审（如适用）| TBD | [ ] |
| 3. code审查 | TBD | [ ] |
| 4. 集成测试 | CI | [ ] |
| 5. 审批人签字 | TBD | [ ] |

## 相关链接
- 相关 ADR：
- 相关 contract：
- 相关 issue/PR：
```

## 6. 审批角色defines

| 角色 | 职责 | 适用变更 |
|------|------|---------|
| Architecture师 | 审批主Architecture边界变更 | §4-§9 平台基础设施层 |
| 技术负责人 | 审批 contract 字段变更 | 所有 contract 文件 |
| 运维负责人 | 审批 operations 流程变更 | `docs_zh/operations/` |
| security评审 | 审批高风险新能力 | 含securityImpact的新功能 |

## 7. 工具链references用

- **文档追踪**：via GitHub PR / Issues manage变更request
- **ADR manage**：[`docs_zh/adr/README.md`](../adr/README.md)
- **Contract 注册**：[`docs_zh/contracts/README.md`](../contracts/README.md)
- **Architecture索references**：[`docs_zh/architecture/README.md`](../architecture/README.md)
- **现状追踪**：[`docs_zh/reviews/`](../reviews/) 下各 review 文档
