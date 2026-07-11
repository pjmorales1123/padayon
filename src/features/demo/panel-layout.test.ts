import { describe, expect, it } from "vitest";
import { DEFAULT_DEMO_PANEL_WIDTHS, resizeDemoPanels } from "./panel-layout";

describe("demo panel layout", () => {
  it("defaults to summary 20, chat 60, agents 20", () => {
    expect(DEFAULT_DEMO_PANEL_WIDTHS).toEqual([20, 60, 20]);
  });

  it("keeps chat as the largest panel while resizing dividers", () => {
    expect(resizeDemoPanels([20, 60, 20], "left", 8)).toEqual([28, 52, 20]);
    expect(resizeDemoPanels([20, 60, 20], "right", -8)).toEqual([20, 52, 28]);
  });

  it("prevents side panels from squeezing chat too far", () => {
    expect(resizeDemoPanels([20, 60, 20], "left", 50)).toEqual([35, 45, 20]);
    expect(resizeDemoPanels([20, 60, 20], "right", -50)).toEqual([20, 45, 35]);
  });
});
