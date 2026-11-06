import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { parseConfig } from "./config";

const config = parseConfig({
  categories: [
    {
      key: "comm",
      name: "Communication",
      kpis: [
        { summary: "Gives status updates", description: "**Daily**", level: 1 },
        { summary: "Drives meetings", level: 2 },
      ],
    },
    { key: "ops", name: "Operations", kpis: [{ summary: "Runs deploys", level: 1 }] },
  ],
  roles: [{ key: "lead", name: "Lead", levels: { comm: 2 } }],
  site: { title: "My Radar", footer: "Made by [us](https://example.com)" },
});

const person = { name: "Ada", levels: { comm: 1 }, tags: ["tech"] };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the person, the KPIs of the current level and the footer", () => {
    render(<App config={config} initialPerson={person} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("My Radar");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Ada");
    expect(screen.getByText("Gives status updates")).toBeTruthy();
    expect(screen.getByText("Daily").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "us" })).toBeTruthy();
  });

  it("updates the URL when a level or the compared role changes", () => {
    render(<App config={config} initialPerson={person} />);

    fireEvent.click(screen.getByRole("button", { name: "Level 2" }));
    expect(screen.getByText("Drives meetings")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "lead" } });
    expect(screen.getByText("Lead", { selector: ".radar-legend-item" })).toBeTruthy();

    const state = JSON.parse(new URLSearchParams(window.location.search).get("state")!);
    expect(state).toEqual({ name: "Ada", levels: { comm: 2 }, tags: ["tech"], compareTo: "lead" });
  });

  it("summarises the progress and the gap with the compared role", () => {
    render(<App config={config} initialPerson={{ ...person, compareTo: "lead" }} />);
    const summary = document.querySelector(".progress-summary")!;
    expect(summary.textContent).toContain("Overall25%");
    expect(summary.textContent).toContain("On target1/ 2");
    expect(summary.textContent).toContain("Level to go1");
    expect(screen.getByText(/1 level below Lead/)).toBeTruthy();
  });

  it("selects a category from the radar labels", () => {
    render(<App config={config} initialPerson={person} />);
    fireEvent.click(screen.getByText("Operations", { selector: ".radar-label tspan" }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Operations");
    expect(screen.getByRole("button", { name: /Operations/, current: true })).toBeTruthy();
  });

  it("copies the shareable URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<App config={config} initialPerson={person} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy link" })));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole("button", { name: "Link copied" })).toBeTruthy();
  });
});
