# Division Catalog

本目录用于收敛容易混淆的 division 家族，避免把“名称相近”误读成“职责相同”。

## 质量家族

| division | 角色定位 | 说明 |
| --- | --- | --- |
| `quality-assurance` | canonical | 生产发布前的完整回归、缺陷归因、质量认证 |
| `qa` | legacy alias | 仅用于轻量 smoke validation / 快速回归分诊，不承担 release certification |

## 运维家族

| division | 角色定位 | 说明 |
| --- | --- | --- |
| `engineering_ops` | build/release delivery | 工程交付、流水线、构建与发布协同 |
| `general_ops` | generic operator fallback | 通用兜底执行面，适合低专属度任务 |
| `operations` | service operations | 服务运行、值守、日常操作 |
| `it-operations` | workstation / identity ops | 终端、账号、设备与身份域操作 |

## 机器可校验来源

- `config/quality/division-catalog.json`
- `scripts/ci/audit-division-workflows.mjs`

## 维护规则

- 新增名称相近的 division 前，必须先补 family map。
- alias division 必须在描述、workflow、schema 上明确缩窄作用域，不能与 canonical division 形成同义重复。
