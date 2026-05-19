/**
 * Unit tests for ServiceRegistry transitive dependency resolution.
 *
 * Tests that services with transitive dependencies (A depends on B, B depends on C)
 * are initialized in the correct order regardless of registration order.
 */
export {};
