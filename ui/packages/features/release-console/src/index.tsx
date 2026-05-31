import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { LeadershipClaimsWebView, ReleaseConsoleWebView } from "./web";

const featureCopy = translateFeatureCopy("release-console");

const releaseConsoleFeature = {
  ...createFeatureModule({
  id: "release-console",
  title: featureCopy.title,
  group: "Operations",
  path: "/operations/release-console",
  permission: "authenticated",
  status: "Implemented/Internal",
  summary: featureCopy.summary,
  render: ReleaseConsoleWebView,
  }),
  subPages: [
    {
      id: "leadership-claims",
      path: "leadership-claims",
      label: translateMessage("ui.releaseConsole.claims.nav"),
      Component: LeadershipClaimsWebView,
    },
  ],
} as const;

export default releaseConsoleFeature;
export { createReleaseConsoleMobileCards } from "./mobile";
export { useReleaseConsoleVm } from "./hooks";
export { LeadershipClaimsWebView, ReleaseConsoleWebView } from "./web";
