/**
 * @fileoverview CAS Module - Compare-And-Swap and Fencing Token implementations.
 *
 * Provides optimistic concurrency control and distributed fencing for
 * state consistency in execution layer.
 *
 * @see §25 Data Consistency in docs_zh/architecture/00-platform-architecture.md
 * @see R16-35: SqliteCasRepository provides durable storage for CAS records
 */

export { CasService, type CasResult, type CasRepository, createInMemoryCasService, createSqliteCasService } from "./cas-service.js";
export { SqliteCasRepository } from "./sqlite-cas-repository.js";
export { SqliteFenceRepository } from "./sqlite-fence-repository.js";
export {
  FencingTokenService,
  type FenceRepository,
  type FenceMode,
  type FenceInfo,
  type FencingTokenValidation,
  createSqliteFencingTokenService,
} from "./fencing-token-service.js";
