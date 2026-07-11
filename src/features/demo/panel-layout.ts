// Keeps demo panel resizing predictable while preserving a large chat column.
export type DemoPanelWidths = [number, number, number];
export type DemoPanelDivider = "left" | "right";

export const DEFAULT_DEMO_PANEL_WIDTHS: DemoPanelWidths = [20, 60, 20];

const SIDE_MIN = 12;
const CHAT_MIN = 45;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function resizeDemoPanels(
  widths: DemoPanelWidths,
  divider: DemoPanelDivider,
  deltaPercent: number,
): DemoPanelWidths {
  const [summary, , agents] = widths;

  if (divider === "left") {
    const nextSummary = clamp(summary + deltaPercent, SIDE_MIN, 100 - agents - CHAT_MIN);
    return [nextSummary, 100 - nextSummary - agents, agents];
  }

  const nextAgents = clamp(agents - deltaPercent, SIDE_MIN, 100 - summary - CHAT_MIN);
  return [summary, 100 - summary - nextAgents, nextAgents];
}
