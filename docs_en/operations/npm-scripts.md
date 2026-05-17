# NPM Scripts Maintenance

`package.json` contains many operator, CI, stable-release, and targeted validation scripts. This document defines how to maintain them without turning the scripts section into an unreviewable command dump.

## Categories

- Build: `build`, `build:*`.
- Tests: `test`, `test:*`, targeted `tsx --test` wrappers.
- Runtime: `doctor`, `inspect`, `dispatch-*`, worker and runtime commands.
- Stable evidence: `*:stable`, release rehearsal, and evidence report commands.
- CI helpers: commands that wrap `scripts/ci/*`.

## Rules

- Prefer adding a script only when it is reused by humans, CI, or documentation.
- Put one-off logic in `scripts/` with a README entry instead of embedding long shell commands in `package.json`.
- Keep destructive or environment-mutating commands explicit in the name.
- Document new stable or operator scripts in the matching operations guide.

## Validation

For script-only changes, run the specific script or a dry-run/inspection command. Do not require a full test suite unless the script intentionally covers the full suite.