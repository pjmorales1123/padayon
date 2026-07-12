import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HtmlVisual from "./HtmlVisual";

describe("HtmlVisual", () => {
  it("offers a full-screen view for a visual that does not fit in chat", () => {
    render(<HtmlVisual topic="Types of Conflict" title="Conflict Visual" html="<p>Visual</p>" />);

    const openButton = screen.getByRole("button", { name: "Open Types of Conflict visual full screen" });
    expect(openButton).toBeTruthy();
    fireEvent.click(openButton);
    expect(screen.getByRole("dialog", { name: "Types of Conflict visual" })).toBeTruthy();
  });
});
