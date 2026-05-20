/**
 * Unit tests for EnvironmentBackedManagedSecretProvider, HybridManagedSecretProvider,
 * and createDefaultProviders from secret-management-support.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EnvSecretProvider } from "../../../../../src/platform/five-plane-control-plane/iam/env-secret-provider.js";
import type { ManagedSecretProvider, SecretProviderMetadata } from "../../../../../src/platform/five-plane-control-plane/iam/env-secret-provider.js";
import {
  EnvironmentBackedManagedSecretProvider,
  HybridManagedSecretProvider,
  createDefaultProviders,
} from "../../../../../src/platform/five-plane-control-plane/iam/secret-management-support.js";

// Helper to create a mock provider
function createMockProvider(config: {
  providerKind: "environment" | "vault" | "kms" | "secret_manager";
  isConfigured?: () => boolean;
  describeSecretResponse: SecretProviderMetadata;
  requireSecretResponse: SecretProviderMetadata & { value: string };
  issueSecretLeaseResponse?: ReturnType<ManagedSecretProvider["issueSecretLease"]>;
}): ManagedSecretProvider & { isConfigured?: () => boolean } {
  return {
    providerKind: config.providerKind,
    isConfigured: config.isConfigured,
    async describeSecret(_secretRef: string) {
      return config.describeSecretResponse;
    },
    async requireSecret(_secretRef: string) {
      return config.requireSecretResponse;
    },
    async issueSecretLease(_secretRef: string) {
      return config.issueSecretLeaseResponse ?? null;
    },
  };
}

test("EnvironmentBackedManagedSecretProvider delegates to EnvSecretProvider", async () => {
  const env = { AA_SECRET_TEST_KEY: "secret-value" };
  const envProvider = new EnvSecretProvider({ env });
  const wrapper = new EnvironmentBackedManagedSecretProvider("environment", envProvider);

  assert.equal(wrapper.providerKind, "environment");

  const metadata = await wrapper.describeSecret("secret://test/key");
  assert.equal(metadata.secretRef, "secret://test/key");
  assert.equal(metadata.resolved, true);
  assert.equal(metadata.maskedValue, "**********ue");

  const value = await wrapper.requireSecret("secret://test/key");
  assert.equal(value.value, "secret-value");
});

test("EnvironmentBackedManagedSecretProvider reports unresolved for missing secrets", async () => {
  const env = {};
  const envProvider = new EnvSecretProvider({ env });
  const wrapper = new EnvironmentBackedManagedSecretProvider("environment", envProvider);

  const metadata = await wrapper.describeSecret("secret://test/key");
  assert.equal(metadata.resolved, false);
  assert.equal(metadata.maskedValue, null);
});

test("HybridManagedSecretProvider uses primary when configured", async () => {
  const primaryResponse: SecretProviderMetadata = {
    secretRef: "secret://test/key",
    envName: "AA_SECRET_TEST_KEY",
    scope: "test",
    source: "vault",
    resolved: true,
    maskedValue: "primary-masked",
  };

  const primary = createMockProvider({
    providerKind: "vault",
    isConfigured: () => true,
    describeSecretResponse: primaryResponse,
    requireSecretResponse: { ...primaryResponse, value: "primary-value" },
  });

  const fallbackResponse: SecretProviderMetadata = {
    secretRef: "secret://test/key",
    envName: "AA_SECRET_TEST_KEY",
    scope: "test",
    source: "environment",
    resolved: true,
    maskedValue: "fallback-masked",
  };

  const fallback = createMockProvider({
    providerKind: "environment",
    describeSecretResponse: fallbackResponse,
    requireSecretResponse: { ...fallbackResponse, value: "fallback-value" },
  });

  const hybrid = new HybridManagedSecretProvider("vault", primary, fallback);

  const result = await hybrid.describeSecret("secret://test/key");
  // Primary is configured, so primary response should be returned
  assert.equal(result.source, "vault");
});

test("HybridManagedSecretProvider falls back when primary not configured", async () => {
  const primary = createMockProvider({
    providerKind: "vault",
    isConfigured: () => false,
    describeSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "vault",
      resolved: false,
      maskedValue: null,
    },
    requireSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "vault",
      resolved: false,
      maskedValue: null,
      value: "",
    },
  });

  const fallbackResponse: SecretProviderMetadata = {
    secretRef: "secret://test/key",
    envName: "AA_SECRET_TEST_KEY",
    scope: "test",
    source: "environment",
    resolved: true,
    maskedValue: "fallback-masked",
  };

  const fallback = createMockProvider({
    providerKind: "environment",
    describeSecretResponse: fallbackResponse,
    requireSecretResponse: { ...fallbackResponse, value: "fallback-value" },
  });

  const hybrid = new HybridManagedSecretProvider("vault", primary, fallback);

  const result = await hybrid.describeSecret("secret://test/key");
  // Primary not configured, should use fallback
  assert.equal(result.source, "environment");
});

test("HybridManagedSecretProvider falls back when isConfigured not a function", async () => {
  // Primary without isConfigured function
  const primaryResponse: SecretProviderMetadata = {
    secretRef: "secret://test/key",
    envName: "AA_SECRET_TEST_KEY",
    scope: "test",
    source: "vault",
    resolved: false,
    maskedValue: null,
  };

  const primary = createMockProvider({
    providerKind: "vault",
    describeSecretResponse: primaryResponse,
    requireSecretResponse: { ...primaryResponse, value: "" },
  });

  const fallbackResponse: SecretProviderMetadata = {
    secretRef: "secret://test/key",
    envName: "AA_SECRET_TEST_KEY",
    scope: "test",
    source: "environment",
    resolved: true,
    maskedValue: "fallback-masked",
  };

  const fallback = createMockProvider({
    providerKind: "environment",
    describeSecretResponse: fallbackResponse,
    requireSecretResponse: { ...fallbackResponse, value: "fallback-value" },
  });

  const hybrid = new HybridManagedSecretProvider("vault", primary, fallback);

  const result = await hybrid.describeSecret("secret://test/key");
  // Without isConfigured, falls back by checking env vars - no vault env vars so uses fallback
  assert.equal(result.source, "environment");
});

test("HybridManagedSecretProvider requireSecret uses primary when configured", async () => {
  const primary = createMockProvider({
    providerKind: "vault",
    isConfigured: () => true,
    describeSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "vault",
      resolved: true,
      maskedValue: "primary-masked",
    },
    requireSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "vault",
      resolved: true,
      maskedValue: "primary-masked",
      value: "primary-secret",
    },
  });

  const fallback = createMockProvider({
    providerKind: "environment",
    describeSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "environment",
      resolved: true,
      maskedValue: "fallback-masked",
    },
    requireSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "environment",
      resolved: true,
      maskedValue: "fallback-masked",
      value: "fallback-secret",
    },
  });

  const hybrid = new HybridManagedSecretProvider("vault", primary, fallback);

  const result = await hybrid.requireSecret("secret://test/key");
  assert.equal(result.value, "primary-secret");
});

test("HybridManagedSecretProvider issueSecretLease delegates to primary when configured", async () => {
  const primary = createMockProvider({
    providerKind: "vault",
    isConfigured: () => true,
    describeSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "vault",
      resolved: true,
      maskedValue: "primary-masked",
    },
    requireSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "vault",
      resolved: true,
      maskedValue: "primary-masked",
      value: "primary-secret",
    },
    issueSecretLeaseResponse: Promise.resolve({
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "vault",
      resolved: true,
      maskedValue: "primary-masked",
      value: "leased-secret",
      leaseId: "lease-123",
      expiresAt: "2026-04-28T00:00:00.000Z",
      renewable: true,
      issuedBy: "vault",
    }),
  });

  const fallback = createMockProvider({
    providerKind: "environment",
    describeSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "environment",
      resolved: true,
      maskedValue: "fallback-masked",
    },
    requireSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "environment",
      resolved: true,
      maskedValue: "fallback-masked",
      value: "fallback-secret",
    },
  });

  const hybrid = new HybridManagedSecretProvider("vault", primary, fallback);

  const result = await hybrid.issueSecretLease("secret://test/key");
  assert.notEqual(result, null);
  assert.equal(result!.leaseId, "lease-123");
});

test("HybridManagedSecretProvider issueSecretLease returns null when primary not configured", async () => {
  const primary = createMockProvider({
    providerKind: "vault",
    isConfigured: () => false,
    describeSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "vault",
      resolved: false,
      maskedValue: null,
    },
    requireSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "vault",
      resolved: false,
      maskedValue: null,
      value: "",
    },
  });

  const fallback = createMockProvider({
    providerKind: "environment",
    describeSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "environment",
      resolved: true,
      maskedValue: "fallback-masked",
    },
    requireSecretResponse: {
      secretRef: "secret://test/key",
      envName: "AA_SECRET_TEST_KEY",
      scope: "test",
      source: "environment",
      resolved: true,
      maskedValue: "fallback-masked",
      value: "fallback-secret",
    },
  });

  const hybrid = new HybridManagedSecretProvider("vault", primary, fallback);

  const result = await hybrid.issueSecretLease("secret://test/key");
  assert.equal(result, null);
});

test("createDefaultProviders creates environment provider", () => {
  const providers = createDefaultProviders({});

  assert.ok(providers.environment);
  assert.equal(providers.environment.providerKind, "environment");
});

test("createDefaultProviders creates vault provider without AA_VAULT_ADDR", () => {
  const providers = createDefaultProviders({});

  assert.equal(providers.vault.providerKind, "vault");
});

test("createDefaultProviders creates kms provider without AA_AWS_ACCESS_KEY_ID", () => {
  const providers = createDefaultProviders({});

  assert.equal(providers.kms.providerKind, "kms");
});

test("createDefaultProviders creates secret_manager provider without AA_GCP_PROJECT_ID", () => {
  const providers = createDefaultProviders({});

  assert.equal(providers.secret_manager.providerKind, "secret_manager");
});

test("createDefaultProviders returns all four provider kinds", () => {
  const providers = createDefaultProviders({});

  const kinds = Object.keys(providers);
  assert.ok(kinds.includes("environment"));
  assert.ok(kinds.includes("vault"));
  assert.ok(kinds.includes("kms"));
  assert.ok(kinds.includes("secret_manager"));
});
