# Platform Panic And Resume Contract

## 1. 范围

本 contract 定义 `§60` 的全局熔断、传播机制、恢复协议和演练要求。

## 2. Canonical 对象

- `PlatformPanicDirective`
- `PanicPropagationRecord`
- `ResumePlan`
- `PanicDrillRecord`

## 3. `PlatformPanicDirective` 最小字段

- `directive_id`
- `scope`
- `reason_code`
- `issued_by`
- `issued_at`
- `freeze_modes`
- `allow_list?`

## 4. 规则

- panic 必须可作用于 platform / tenant / org / domain / workflow 多层级。
- panic 生效后，新的高风险执行必须被阻断。
- 恢复必须通过显式 `ResumePlan`，不得靠隐式重启解除。

## 5. 测试要求

- unit：scope match、propagation、resume validation
- integration：panic -> execution block -> resume
- contract：panic 期间不得出现未审计的自动恢复

