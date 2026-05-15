# UI Apps

`ui/apps/` contains platform shells that compose shared packages and feature modules.

## Rules

- Keep platform shell concerns here: routing, app bootstrap, platform-specific providers, and deployment wiring.
- Product capability code belongs in `ui/packages/features/`.
- Shared UI primitives belong in `ui/packages/ui-core` or `ui/packages/ui-mobile`.
- Shared API/auth/state/sync logic belongs in `ui/packages/shared/*`.

## Validation

Use focused app or Playwright checks for shell changes. Feature-only changes should validate the affected feature package rather than every app shell.
