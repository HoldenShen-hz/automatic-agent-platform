# Assistive Technology Regression Checklist

This checklist is the manual fallback for native shells where browser-first axe coverage is not sufficient.

## Coverage targets

- `web`: keyboard-only navigation, focus visibility, landmark traversal, and screen reader labels.
- `windows` / `macos` / `linux`: shell launch, route switching, focus order, and secure dialog announcements.
- `android` / `ios`: TalkBack or VoiceOver traversal, tab order, modal dismissal, and haptic-backed confirmation prompts.

## Core scenarios

1. Open Dashboard, Alerts, Task Cockpit, Approval Center, and Settings.
2. Traverse primary navigation using keyboard or rotor gestures only.
3. Confirm every action button exposes a readable name and state.
4. Confirm theme and locale controls remain operable without pointer input.
5. Trigger one incident or approval item and verify announcement text remains meaningful.

## Evidence to capture

- Screen recording or screenshot per platform shell.
- Screen reader transcript snippets for one mission-control flow and one settings flow.
- Any regression issue linked to the affected feature route and platform shell.
