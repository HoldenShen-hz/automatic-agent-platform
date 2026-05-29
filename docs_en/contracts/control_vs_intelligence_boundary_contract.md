# Control Vs Intelligence Boundary Contract

## 1. 范围

本 contract defines智能层vs控制层之间的硬边界。

核心principle：`LLM 负责Recommendation，系统code负责裁决。`

相关文档：

- `policy_engine_contract.md`
- `runtime_execution_contract.md`
- `approval_and_hitl_contract.md`

## 2. 目标

- 防止模型输出directly越权控制系统。
- 把高风险Decision收回到 deterministic system code。
- 明确哪些字段可以由 LLM 提议，哪些字段必须由系统生成或覆盖。

## 3. LLM 可以做的事

- 提议 division / role / plan
- 生成中间内容
- 给出风险Description
- 生成候选操作
- 生成user可读解释
- 生成 `FeedbackSignal` / `LearningObject` / `ImprovementCandidate` 草案
- 生成 knowledge 摘要vs assess Recommendation

## 4. LLM 不可以directly做的事

- directly放lines destructive action
- directly决定 `timeout_behavior`
- directlybypassing precondition
- directly写最终 authoritative Status
- directly提升自身permission
- directly签发 approval via结果
- directly把 `LearningObject` 标记为 `validated/promoted`
- directly把 `ImprovementCandidate` 推进到 `accepted/deployed/rolled_back`
- directly修改 `StrategyVersion` Status
- directly推进 `RolloutRecord` 的 stage / status
- directly修改 trust tier、L5/L6 memory promotion 或 feedback occurrences置结果

## 5. 边界图

```mermaid
flowchart LR
    A["LLM Suggestion"] --> B["Validation / Policy / Preconditions"]
    B --> C["System Decision"]
    C --> D["Authoritative State Write"]
```

## 5A. OAPEFLIR 边界图

```mermaid
flowchart LR
    A["Observe / Assess / Plan Suggestions"] --> B["Policy / Validation / Guardrail"]
    B --> C["Feedback / Learn / Improve / Release Control"]
    C --> D["Authoritative State"]
```

## 6. 系统必须覆盖的字段

以下字段若出现在模型输出中，也只可视为Recommendation，不得directly信任：

- `timeout_behavior`
- `approval_required`
- `risk_level`
- `final_status`
- `destructive_allowed`
- `budget_override`
- `policy_decision`
- `sandbox_mode`
- `allowed_paths`
- `allowed_tools`
- `promotion_status`
- `rollout_status`
- `guardrail_reason_codes`

## 7. 工程要求

- agent 输出 schema 要区分 `suggested_*` 和 authoritative 字段。
- repository / transition service 只acceptsvia过系统层验证后的结构。
- audit 中应能看出“模型Recommendation”和“系统最终裁决”的差异。
- UI / inspect / explainability 视图应能同时展示Recommendation值、最终值和覆盖原因。
- OAPEFLIR 闭环中，`Observe/Assess/Plan` 可由模型辅助，但 `Learn.validate`、`Improve.guardrail`、`Release.transition` 必须由 deterministic code 执lines。

## 8. 收口Conclusion

工业级系统如果让模型既提议又裁决，就很难做到可审计、可预测、可托底。

因此这条边界必须is architecture-level hard rule，而不is编码时的默契。
