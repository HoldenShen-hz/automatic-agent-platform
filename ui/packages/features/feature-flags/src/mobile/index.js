export function createFeatureFlagsMobileCards(flags) {
    return flags.map((flag) => ({
        title: flag.id,
        subtitle: `${flag.enabled ? "enabled" : "disabled"} · rollout ${flag.rolloutPercentage}%`,
    }));
}
