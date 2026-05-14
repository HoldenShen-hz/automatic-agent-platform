# Integration Tests

Phase 1a integration tests cover SQLite persistence, recovery, event durability, and storage migration paths.

## External Services

- Tests that require PostgreSQL, Redis, network services, or cloud credentials must declare the required environment variables in the test file.
- Prefer local service containers or explicit test doubles over hidden developer-machine dependencies.
- If a test is intentionally skipped because a service is unavailable, the skip reason must name the missing service and the command that enables it.

## Validation

Run the specific integration file affected by a change instead of the full integration suite unless the change intentionally spans multiple services.
