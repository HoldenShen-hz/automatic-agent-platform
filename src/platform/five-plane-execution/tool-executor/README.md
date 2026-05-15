# Tool Executor Boundary

This directory owns execution-plane tool invocation, access checks, path scope checks, parallel execution coordination, and tool-specific adapters.

## Rules

- Keep security checks in guard/scope modules, not inside individual tool call sites.
- Tool adapters should preserve typed validation errors instead of converting them to generic success payloads.
- New tool families should use focused files and avoid adding unrelated behavior to an existing executor.
- Cross-plane policy decisions should call control-plane policy services rather than importing policy internals.
