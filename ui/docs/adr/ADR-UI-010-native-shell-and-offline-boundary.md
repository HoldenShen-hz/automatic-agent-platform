# ADR-UI-010 Native Shell 与 Offline 边界

- 状态：Accepted
- 决策日期：2026-05-07

## 决策

桌面 / 移动壳层属于 UI 应用边界的一部分，但不得自行定义第二套 contract。

- native shell 只负责窗口、通知、文件接入、离线缓存和设备能力桥接。
- runtime truth、cockpit DTO、WS envelope 与 auth/session 规则必须与 web 共享。
- 离线态只允许缓存 projection，不得在本地伪造 authoritative state transition。

## 后果

- Web / Desktop / Mobile 可以共享同一套 SDK surface 与 UI contracts。
- 原生壳不会把离线缓存误升格成 truth source。
