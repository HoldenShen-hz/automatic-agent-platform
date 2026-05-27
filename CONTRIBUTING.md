# Contributing to Automatic Agent Platform

Thank you for your interest in contributing to the Automatic Agent Platform. This document provides guidelines and instructions for contributing.

## Development Environment Setup

### Prerequisites

- Node.js 22.x (match `package.json#engines`)
- npm 10+
- SQLite (for local development)

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd automatic_agent_platform

# Install dependencies
npm install

# Build the project
npm run build

# Run health diagnostics
npm run doctor
```

### Environment Configuration

Copy `.env.example` to `.env` and configure required environment variables:

```bash
cp .env.example .env
```

Key environment variables:
- `AA_DB_PATH` — SQLite database path (default: `data/sqlite/phase1a-demo.db`)
- `AA_API_JWT_SECRET` — JWT signing secret (required for API server)
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — LLM provider API keys

## Branch Strategy

- `main` — stable, always deployable
- `feature/*` — new feature development
- `fix/*` — bug fixes
- `refactor/*` — code refactoring without behavior change
- `docs/*` — documentation improvements

## Making Changes

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code standards:
   - Run `npm run typecheck` to verify type correctness
   - Run `npm test` to ensure tests pass
   - Run `npm run lint` to verify static rules

3. **Commit** using short imperative subjects:
   ```bash
   git commit -m "Add new tool registration API"
   ```

4. **Push** and create a pull request:
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Standards

### TypeScript

- Use strict TypeScript; no `any` without explicit justification
- All function parameters and return types must be typed
- Use ESM modules with `.js` extension in imports
- Follow existing naming conventions (snake_case for DB columns, camelCase for TS)

### Testing

- New features must include unit tests
- Run tests with: `npm run test:unit`
- Integration tests: `npm run test:integration`
- All tests must pass before merging

### Error Handling

- Use `AppError.wrap(err)` in runtime layer catch blocks
- Follow the error code format: `{domain}.{error_type}:{context}`
- Never swallow errors silently

## Pull Request Process

1. Fill out the PR template completely
2. Ensure all CI checks pass
3. Request review from at least one maintainer
4. Address all review feedback
5. Squash commits before merging

## Commit Message Convention

Prefer short imperative subjects that describe the behavioral change directly.

Examples:
- `Add Phase 1B DAG planning`
- `Patch API key timing comparison`
- `Update HTTP API server documentation`

## Useful Commands

```bash
npm run build          # Compile TypeScript
npm run typecheck      # Type-check without emitting
npm run lint           # Run static rule checks
npm run test           # Run all tests
npm run doctor         # Health diagnostics
npm run inspect        # Entity inspection (set AA_INSPECT_KIND, AA_TASK_ID)
```

## Getting Help

- Check [CLAUDE.md](./CLAUDE.md) for architecture and design decisions
- Check [AGENTS.md](./AGENTS.md) for workspace development standards
- Open an issue for bugs or feature requests
