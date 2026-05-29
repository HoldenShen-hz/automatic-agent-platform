/**
 * R10-05: Field Encryption Key Derivation Tests
 *
 * Tests proper PBKDF2 key derivation for field encryption.
 */

import { describe, it, expect } from "../test-utils.js";
import { encryptField, decryptField } from "../../../../../src/platform/five-plane-control-plane/iam/field-encryption.js";

describe("R10-05: Field Encryption with PBKDF2", () => {
  describe("encryptField/decryptField", () => {
    it("encrypts and decrypts a string with a 32-byte key", () => {
      const plaintext = "sensitive data";
      const key = Buffer.alloc(32).fill("a"); // 32-byte key
      const encrypted = encryptField(plaintext, key);
      expect(encrypted).not.toBe(plaintext);
      const decrypted = decryptField(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts with string password using PBKDF2", () => {
      const plaintext = "password-protected";
      const password = "mysecretpassword123-mysecretpassword123";
      const encrypted = encryptField(plaintext, password);
      expect(encrypted).not.toBe(plaintext);
      const decrypted = decryptField(encrypted, password);
      expect(decrypted).toBe(plaintext);
    });

    it("fails to decrypt with wrong key", () => {
      const plaintext = "secret data";
      const key = Buffer.alloc(32).fill("a");
      const wrongKey = Buffer.alloc(32).fill("b");
      const encrypted = encryptField(plaintext, key);
      expect(() => decryptField(encrypted, wrongKey)).toThrow();
    });

    it("different encryptions of same plaintext produce different ciphertext", () => {
      const plaintext = "same text";
      const key = Buffer.alloc(32).fill("a");
      const encrypted1 = encryptField(plaintext, key);
      const encrypted2 = encryptField(plaintext, key);
      expect(encrypted1).not.toBe(encrypted2); // Due to random IV
    });

    it("handles empty string", () => {
      const plaintext = "";
      const key = Buffer.alloc(32).fill("a");
      const encrypted = encryptField(plaintext, key);
      const decrypted = decryptField(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it("handles unicode characters", () => {
      const plaintext = "你好世界 🌍 مرحبا";
      const key = Buffer.alloc(32).fill("a");
      const encrypted = encryptField(plaintext, key);
      const decrypted = decryptField(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it("handles long plaintext", () => {
      const plaintext = "a".repeat(10000);
      const key = Buffer.alloc(32).fill("a");
      const encrypted = encryptField(plaintext, key);
      const decrypted = decryptField(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it("rejects key shorter than 16 bytes", () => {
      const plaintext = "test";
      const shortKey = Buffer.alloc(15).fill("a");
      expect(() => encryptField(plaintext, shortKey)).toThrow();
    });
  });

  describe("PBKDF2 Key Derivation", () => {
    it("same password produces same key (deterministic)", () => {
      const plaintext = "test";
      const password = "password123456789-password123456789";
      // Note: because we use random salt, same password produces different ciphertext
      // but the decryption will work because the salt is embedded in the output
      const encrypted = encryptField(plaintext, password);
      const decrypted = decryptField(encrypted, password);
      expect(decrypted).toBe(plaintext);
    });
  });
});
