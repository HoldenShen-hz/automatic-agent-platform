import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
import { NetworkEgressPolicyService } from "../../platform/control-plane/iam/network-egress-policy.js";
export interface GithubAdapterPluginOptions {
    apiBaseUrl?: string;
    policy?: NetworkEgressPolicyService;
}
export declare function createGithubAdapterPlugin(options?: GithubAdapterPluginOptions): ExternalAdapterPlugin;
