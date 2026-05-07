# ADR-UI-005 Design Token 与主题分层

- 状态：Accepted
- 决策日期：2026-05-07

## 决策

UI Core 的设计令牌必须分为 primitive 与 semantic 两层。

- primitive token 只表达颜色、字号、间距、圆角、阴影等原始量值。
- semantic token 表达 `surface / text / accent / danger / success / warning` 等语义用途。
- feature package 不得直接硬编码 primitive token。

## 后果

- 主题切换与品牌变体不会污染 feature 业务代码。
- contract 与 design review 可以围绕 semantic token 进行。
