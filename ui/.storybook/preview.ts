import type { Preview } from "@storybook/react";
import { withStorybookUiRuntime } from "../packages/storybook/src";

const preview: Preview = {
  decorators: [withStorybookUiRuntime],
  globalTypes: {
    locale: {
      name: "Locale",
      defaultValue: "en-US",
      toolbar: {
        icon: "globe",
        items: ["en-US", "zh-CN"],
      },
    },
    theme: {
      name: "Theme",
      defaultValue: "light",
      toolbar: {
        icon: "paintbrush",
        items: ["light", "dark", "high-contrast"],
      },
    },
    route: {
      name: "Route",
      defaultValue: "/mission-control/dashboard",
      toolbar: {
        icon: "sidebar",
        items: ["/mission-control/dashboard", "/mission-control/approvals", "/shared/settings"],
      },
    },
  },
  parameters: {
    a11y: {
      test: "error",
    },
    controls: {
      expanded: true,
    },
    layout: "fullscreen",
    viewport: {
      defaultViewport: "responsive",
    },
  },
};

export default preview;
