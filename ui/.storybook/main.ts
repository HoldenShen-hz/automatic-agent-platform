import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../packages/ui-core/src/**/*.stories.@(ts|tsx)"],
  addons: [],
};

export default config;
