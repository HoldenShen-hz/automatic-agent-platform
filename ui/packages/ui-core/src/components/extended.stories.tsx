import type { Meta, StoryObj } from "@storybook/react";
import { Accordion, Card, Drawer, Pagination, PieChart, SegmentedControl, Skeleton, Stepper, Tabs, Toast, Tooltip } from "./extended";

const meta = {
  title: "Core/Extended",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const NavigationAndFeedback: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <Tabs
          tabs={[
            { id: "overview", label: "Overview", panel: <div>Overview content</div> },
            { id: "details", label: "Details", panel: <div>Details content</div> },
          ]}
        />
      </Card>
      <Card>
        <Pagination page={12} totalPages={48} />
      </Card>
      <Card>
        <Stepper steps={["Draft", "Review", "Release"]} activeStep={1} />
      </Card>
      <Card>
        <Accordion
          items={[
            { id: "policy", title: "Policy", content: <div>Policy controls</div> },
            { id: "evidence", title: "Evidence", content: <div>Evidence bundle</div> },
          ]}
        />
      </Card>
      <Card>
        <SegmentedControl
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          value="week"
        />
      </Card>
      <Card>
        <Tooltip label="Evidence freshness indicator">
          <span>Hover or focus me</span>
        </Tooltip>
      </Card>
      <Toast message="Release evidence exported" tone="success" />
      <Skeleton width="100%" height={24} />
    </div>
  ),
};

export const DrawerAndCharts: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 16 }}>
      <Drawer open title="Operator actions">
        <button type="button">Approve</button>
      </Drawer>
      <Card>
        <PieChart
          slices={[
            { label: "Stable", value: 62 },
            { label: "Canary", value: 24 },
            { label: "Blocked", value: 14 },
          ]}
        />
      </Card>
    </div>
  ),
};
