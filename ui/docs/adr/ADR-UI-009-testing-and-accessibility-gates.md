# ADR-UI-009 测试金字塔与可访问性门禁

- 状态：Accepted
- 决策日期：2026-05-07

## 决策

UI 必须同时具备 unit、integration、E2E 和 accessibility gate。

- shared package 以 unit 为主，覆盖率阈值最高。
- feature package 需要 integration 测试覆盖页面状态机与 API/WS 协议。
- E2E 至少覆盖 cockpit、approval、clarification、takeover 主链。
- accessibility gate 必须对关键页面运行 axe 或等价规则集。

## 后果

- UI contract 漂移和交互回归可以被持续发现。
- 无障碍能力不再停留在文档要求。
