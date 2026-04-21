/**
 * API Server CLI
 *
 * This module provides the main HTTP API server entry point for the Automatic Agent system.
 * It initializes all core services (health, metrics, approvals, gateway, billing), starts the
 * HTTP server with optional authentication, and registers graceful shutdown handlers for clean
 * termination.
 *
 * Environment Variables (via loadApiServerEnv):
 *   - AA_DB_PATH: Optional custom path to the SQLite database file
 *   - AA_API_HOST: Optional host to bind the server to
 *   - AA_API_PORT: Optional port to listen on
 *   - AA_LOG_FILE_PATH: Optional path for structured log output
 *   - AA_LOG_FILE_MAX_BYTES: Max size of each log file
 *   - AA_LOG_FILE_MAX_FILES: Number of rotated log files to retain
 *   - AA_WEBHOOK_SECRET: Secret for webhook signature verification
 *   - AA_JWT_SECRET: Secret for JWT authentication
 *   - AA_API_KEYS: Comma-separated list of valid API keys
 *
 * Usage: npm run api-server
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for system architecture
 * @see {@link docs_zh/contracts/observability_contract.md} for health and metrics
 */
export {};
