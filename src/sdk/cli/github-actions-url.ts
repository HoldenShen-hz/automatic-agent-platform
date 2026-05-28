const GITHUB_ACTION_RUN_URL_PREFIX = "https://github.com/automatic-agent/automatic-agent-platform/actions/runs/";

export function buildGithubActionRunUrl(runId: string | null): string {
  return `${GITHUB_ACTION_RUN_URL_PREFIX}${runId}`;
}
