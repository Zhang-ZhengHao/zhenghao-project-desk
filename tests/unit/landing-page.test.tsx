import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

const projectLinks = [
  "https://github.com/Zhang-ZhengHao/commerce-ops-desk",
  "https://github.com/Zhang-ZhengHao/ecommerce-lead-automation",
  "https://github.com/Zhang-ZhengHao/haurux-erp-portfolio",
];

describe("public landing page", () => {
  it("states a concrete service promise without pretending intake is open", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Full-stack tools for business workflows.",
      }),
    ).toBeInTheDocument();

    const supportingCopy = screen.getByTestId("hero-supporting-copy");
    expect(supportingCopy.textContent?.trim().split(/\s+/)).toHaveLength(17);

    expect(
      screen.getByRole("link", { name: "View selected work" }),
    ).toHaveAttribute("href", "#work");
    expect(
      screen.getByRole("heading", { level: 2, name: "Project intake" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Project intake" }),
    ).not.toBeInTheDocument();
  });

  it("links to three real public projects and identifies synthetic evidence", () => {
    render(<HomePage />);

    const work = screen.getByRole("region", { name: "Selected work" });
    expect(within(work).getAllByRole("article")).toHaveLength(3);

    for (const href of projectLinks) {
      const link = within(work)
        .getAllByRole("link")
        .find((candidate) => candidate.getAttribute("href") === href);

      expect(link, `missing public project link ${href}`).toBeDefined();
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }

    expect(within(work).getAllByText("Synthetic data")).toHaveLength(2);
    expect(
      within(work).getByText("Self-initiated concept"),
    ).toBeInTheDocument();
  });

  it("uses real project screenshots with descriptive alternatives", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("img", {
        name: /CommerceOps Desk exception queue beside an open refund case/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /Chinese-language lead queue showing synthetic customer messages/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /HAURUX ERP operational dashboard showing synthetic order/i,
      }),
    ).toBeInTheDocument();
  });

  it("selects image widths at the same responsive breakpoints as the layout", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("img", {
        name: /CommerceOps Desk manager view with an exception queue/i,
      }),
    ).toHaveAttribute("sizes", "(max-width: 980px) 100vw, 48vw");
    expect(
      screen.getByRole("img", {
        name: /CommerceOps Desk exception queue beside an open refund case/i,
      }),
    ).toHaveAttribute("sizes", "(max-width: 980px) 100vw, 58vw");
    expect(
      screen.getByRole("img", {
        name: /Chinese-language lead queue showing synthetic customer messages/i,
      }),
    ).toHaveAttribute("sizes", "(max-width: 700px) 100vw, 42vw");
  });

  it("keeps unfinished demo functionality out of the public navigation", () => {
    render(<HomePage />);

    expect(
      screen.getByText("Work in progress: project intake is not open yet."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /try the demo/i }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/demo"]')).toBeNull();
    expect(document.querySelector('a[href="/start"]')).toBeNull();
  });

  it("provides keyboard navigation, delivery boundaries, and safe contact guidance", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(
      screen.getByText(
        /Do not send passwords, API keys, production data, or payment details/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The intake form is not available in this preview/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/continue in that same thread/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This preview does not collect project briefs or accept payments/i,
      ),
    ).toBeInTheDocument();
  });

  it("does not publish fabricated social proof or AI-style dash punctuation", () => {
    const { container } = render(<HomePage />);
    const visibleCopy = container.textContent ?? "";

    expect(visibleCopy).not.toMatch(/[—–]/u);
    expect(visibleCopy).not.toMatch(
      /trusted by|customer logos|client results|revenue|conversion rate|99\.9%/i,
    );
    expect(visibleCopy).not.toMatch(
      /real business workflows|real interface evidence|real interface captures|secure intake|each engagement begins|contact me through X/i,
    );
  });
});
