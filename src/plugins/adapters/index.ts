export { createAssetProductionAdapterPlugin } from "./asset-production-adapter.js";
export { createCrmAdapterPlugin, type CrmAdapterPluginOptions } from "./crm-adapter.js";
export { createGameDevAdapterPlugin } from "./game-dev-adapter.js";
export { createGithubAdapterPlugin, createPluginManifestHash, type GithubAdapterPluginOptions } from "./github-adapter.js";
export { createLivestreamAdapterPlugin, type LivestreamAdapterPluginOptions } from "./livestream-adapter.js";
export {
  buildHashedCredentialFingerprint,
  createZeroableCredentialSecret,
  type ZeroableCredentialSecret,
} from "./credential-hygiene.js";
