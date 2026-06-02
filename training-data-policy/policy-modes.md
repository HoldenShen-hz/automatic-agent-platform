# Training Data Policy Modes

- `redacted_only`: 仅允许经过脱敏或合成后的训练样本进入训练出口，禁止任何可逆还原到原始用户/仓库敏感数据的原文。
- `restricted`: 允许进入更窄的受控内部训练池，但仍禁止 heldout eval、未脱敏客户数据、未授权受限内部资料进入训练导出。

所有 division policy 必须通过 `policyModeRef: training-data-policy/policy-modes.md` 显式绑定到这份语义说明，避免部门各自解释 `policyMode`。
