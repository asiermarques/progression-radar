import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
  ],
  roles: [{ key: "lead", name: "Lead", levels: { comm: 2 } }],
  site: { title: "My Radar", footer: "Made by [us](https://example.com)" },
});

const person = { name: "Ada", levels: { comm: 1 }, tags: ["tech"] };

afterEach(cleanup);

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
});
