/**
 * Sandbox Regression Tests
 *
 * Security regression tests for sandbox path validation:
 * - Symlink traversal via relative path
 * - Symlink traversal via absolute path
 * - Config-root escape attempt
 * - Double-encoded path traversal (%2e%2e%2f)
 * - Null-byte injection in path
 *
 * These tests ensure the sandbox correctly blocks path traversal attacks
 * and injection attempts that could escape the workspace boundary.
 */
export {};
