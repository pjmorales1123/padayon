import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/library",
}));

import AppNavigation from "./AppNavigation";

describe("AppNavigation", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("marks the current route and carries the learner into links", () => {
    render(<AppNavigation userId="demo-bisaya-learner" />);
    expect(screen.getByRole("link", { name: "Library" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toBe(
      "/profile?userId=demo-bisaya-learner",
    );
  });
});
