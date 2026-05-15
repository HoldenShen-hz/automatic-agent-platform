# Memory Boundary

This directory owns memory and experience-cache services used by state/evidence flows.

## Rules

- Keep memory storage policy explicit: TTL, limit, pagination, or persistence boundary.
- Avoid unbounded in-memory maps for production-facing state.
- Search/query APIs should expose pagination or bounded limits.
