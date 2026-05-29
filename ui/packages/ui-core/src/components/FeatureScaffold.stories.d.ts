import type { StoryObj } from "@storybook/react";
import { FeatureScaffold } from "./index";
declare const meta: {
    title: string;
    component: typeof FeatureScaffold;
};
export default meta;
type Story = StoryObj<typeof meta>;
export declare const Basic: Story;
