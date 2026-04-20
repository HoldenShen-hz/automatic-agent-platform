/**
 * Testing Utilities Module
 *
 * Provides shared testing utilities and test fixtures for the platform.
 *
 * ## Overview
 *
 * This module provides common testing utilities used across unit and integration tests.
 *
 * ## Contents
 *
 * - File system helpers (createTempWorkspace, createFile, cleanupPath)
 * - Mock factories for common types
 * - Assertion helpers
 * - Test fixture builders
 *
 * @see tests/helpers/ for actual implementations
 */

export { createTempWorkspace, createFile, cleanupPath, createSymlink } from "../../tests/helpers/fs.js";
export { createSeededApiContext } from "../../tests/helpers/api.js";
