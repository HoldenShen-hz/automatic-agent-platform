import { mkdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { ValidationError } from "../../contracts/errors.js";
/** Valid pattern for profile IDs: alphanumeric, dots, underscores, hyphens, 1-64 chars */
const PROFILE_ID_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;
/**
 * Normalizes and validates a profile ID string.
 * @throws ValidationError if profile ID contains invalid characters or is too long
 */
function normalizeProfileId(profileId) {
    const candidate = profileId?.trim() || "default";
    if (!PROFILE_ID_PATTERN.test(candidate)) {
        throw new ValidationError("profile_home.invalid_profile_id", "profile_home.invalid_profile_id");
    }
    return candidate;
}
/**
 * Resolves the home root directory for agent profiles.
 * Uses explicit AA_AGENT_HOME or AGENT_HOME if set, otherwise defaults to managed location.
 */
function resolveHomeRoot(env, cwd) {
    const explicit = env.AA_AGENT_HOME?.trim() || env.AGENT_HOME?.trim();
    if (explicit) {
        return {
            profileHome: isAbsolute(explicit) ? resolve(explicit) : resolve(cwd, explicit),
            source: "explicit_home",
        };
    }
    return {
        profileHome: resolve(cwd, ".aa-profile-homes", normalizeProfileId(env.AA_PROFILE_ID)),
        source: "default_managed_home",
    };
}
/**
 * Resolves the complete profile home layout including all standard directories.
 * Profile ID is normalized and used to derive the home path.
 *
 * @param env - Process environment variables
 * @param cwd - Current working directory for relative path resolution
 * @returns Complete profile home layout with all directory paths
 */
export function resolveAgentProfileHome(env = process.env, cwd = process.cwd()) {
    const profileId = normalizeProfileId(env.AA_PROFILE_ID);
    const home = resolveHomeRoot(env, cwd);
    const profileHome = home.source === "explicit_home"
        ? home.profileHome
        : resolve(cwd, ".aa-profile-homes", profileId);
    return {
        profileId,
        profileHome,
        configRoot: join(profileHome, "config"),
        dataRoot: join(profileHome, "data"),
        cacheRoot: join(profileHome, "cache"),
        promptCacheRoot: join(profileHome, "cache", "prompt-partitions"),
        tempRoot: join(profileHome, "tmp"),
        shadowSnapshotRoot: join(profileHome, "shadow-snapshots"),
        source: home.source,
    };
}
/**
 * Ensures all profile home directories exist by creating them recursively.
 * Returns the layout unchanged for chaining.
 */
export function ensureAgentProfileHome(layout) {
    for (const directory of [
        layout.profileHome,
        layout.configRoot,
        layout.dataRoot,
        layout.cacheRoot,
        layout.promptCacheRoot,
        layout.tempRoot,
        layout.shadowSnapshotRoot,
    ]) {
        mkdirSync(directory, { recursive: true });
    }
    return layout;
}
//# sourceMappingURL=profile-home.js.map