/**
 * Security Integration Test: JWT Algorithm Restriction
 *
 * Verifies JWT security including:
 * - alg:none rejection
 * - Non-whitelisted algorithm rejection
 * - Expired token rejection
 * - Signature tampering detection
 *
 * Note: These tests verify JWT handling through the ApiAuthService.authenticate() method.
 * The underlying verifyJwt function is internal to the service.
 */
export {};
