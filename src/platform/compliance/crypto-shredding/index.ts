/**
 * Crypto-Shredding Module
 *
 * Implements GDPR-compliant "right to be forgotten" using the crypto-shredding pattern.
 * Instead of deleting data directly, we destroy the DEK (Data Encryption Key) used to
 * encrypt the subject's PII data, making all encrypted data permanently unrecoverable.
 */

export {
  // DEK Manager types
  type DekStatus,
  type DekMetadata,
  type CreateDekResult,
  type EncryptWithDekResult,
  // DEK Manager classes
  DekStore,
  DekManager,
} from "./dek-manager.js";

export {
  // Crypto-Shredding Service types
  type ShredResult,
  type ShredAuditRecord,
  type PiiFieldSpec,
  type EncryptRecordResult,
  type ShredAuditTrail,
  // Crypto-Shredding Service classes
  InMemoryShredAuditTrail,
  CryptoShreddingService,
} from "./crypto-shredding-service.js";
