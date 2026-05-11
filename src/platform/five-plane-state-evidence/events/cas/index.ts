/**
 * @fileoverview CAS Module - Compare-And-Swap and Fencing Token implementations.
 *
 * Provides optimistic concurrency control and distributed fencing for
 * state consistency in execution layer.
 *
 * @see §25 Data Consistency in docs_zh/architecture/00-platform-architecture.md
 */

export {
  CasService,
  createInMemoryCasService,
  createDistributedCasService,
  type CasRecord,
  type CasRepository,
  type CasResult,
} from "./cas-service.js";
export {
  FencingTokenService,
  type FenceMode,
  type FenceInfo,
  type FencingTokenValidation,
} from "./fencing-token-service.js";
