/**
 * Layout structure for an agent profile home directory.
 * Defines standard directories for configuration, data, cache, and temporary files.
 */
export interface AgentProfileHomeLayout {
    profileId: string;
    profileHome: string;
    configRoot: string;
    dataRoot: string;
    cacheRoot: string;
    promptCacheRoot: string;
    tempRoot: string;
    shadowSnapshotRoot: string;
    source: "default_managed_home" | "explicit_home";
}
/**
 * Resolves the complete profile home layout including all standard directories.
 * Profile ID is normalized and used to derive the home path.
 *
 * @param env - Process environment variables
 * @param cwd - Current working directory for relative path resolution
 * @returns Complete profile home layout with all directory paths
 */
export declare function resolveAgentProfileHome(env?: NodeJS.ProcessEnv, cwd?: string): AgentProfileHomeLayout;
/**
 * Ensures all profile home directories exist by creating them recursively.
 * Returns the layout unchanged for chaining.
 */
export declare function ensureAgentProfileHome(layout: AgentProfileHomeLayout): AgentProfileHomeLayout;
