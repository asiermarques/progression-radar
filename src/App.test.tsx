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

const DEBOUNCE = 300;

function setHash(hash: string) {
  window.history.replaceState(null, "", "/" + hash);
}

function editHash(hash: string) {
  setHash(hash);
  act(() => {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
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
    vi.useFakeTimers();
    render(<App config={config} initialPerson={person} />);

    fireEvent.click(screen.getByRole("button", { name: "Level 2" }));
    expect(screen.getByText("Drives meetings")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "lead" } });
    expect(screen.getByText("Lead", { selector: ".radar-legend-item" })).toBeTruthy();

    act(() => vi.advanceTimersByTime(DEBOUNCE));
    expect(window.location.hash).toBe("#name=Ada&compare=lead&tag=tech&comm=2&ops=0");
    expect(window.location.search).toBe("");
  });

  it("writes the URL once for several changes in a row", () => {
    vi.useFakeTimers();
    const replaceState = vi.spyOn(window.history, "replaceState");
    render(<App config={config} initialPerson={person} />);

    fireEvent.click(screen.getByRole("button", { name: "Level 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Level 0" }));
    fireEvent.click(screen.getByRole("button", { name: "Level 2" }));
    expect(replaceState).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(DEBOUNCE));
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toContain("comm=2");
  });

  it("does not rewrite the URL when the app loads", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/?state=%7B%22name%22%3A%22Ada%22%7D");
    const before = window.location.href;
    const replaceState = vi.spyOn(window.history, "replaceState");
    render(<App config={config} initialPerson={person} />);
    act(() => vi.advanceTimersByTime(DEBOUNCE * 2));
    expect(replaceState).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: "Level 2" }));
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    expect(window.location.search).toBe("");
    expect(window.location.hash).toContain("comm=2");
  });

  it("writes the example person to the URL when no link was opened", () => {
    vi.useFakeTimers();
    render(<App config={config} initialPerson={person} writeOnLoad />);
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    expect(window.location.hash).toBe("#name=Ada&tag=tech&comm=1&ops=0");
  });

  it("keeps working while the name is typed quickly, and the URL gets the final name", () => {
    vi.useFakeTimers();
    render(<App config={config} initialPerson={person} />);
    const input = screen.getByLabelText("Name");
    for (let i = 1; i <= 300; i++) fireEvent.change(input, { target: { value: "x".repeat(i) } });
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    expect((input as HTMLInputElement).value).toBe("x".repeat(300));
    expect(new URLSearchParams(window.location.hash.slice(1)).get("name")).toBe("x".repeat(300));
  });

  it("survives a history API that throws", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {
      throw new DOMException("Too many calls", "SecurityError");
    });
    render(<App config={config} initialPerson={person} />);
    fireEvent.click(screen.getByRole("button", { name: "Level 2" }));
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    expect(screen.getByText("Drives meetings")).toBeTruthy();
  });

  it("writes a pending change when the page is hidden", () => {
    vi.useFakeTimers();
    render(<App config={config} initialPerson={person} />);
    fireEvent.click(screen.getByRole("button", { name: "Level 2" }));
    expect(window.location.hash).toBe("");
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(window.location.hash).toContain("comm=2");
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

  describe("copy link", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const copy = () => act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy link" })));

    it("copies a readable link even before any change", async () => {
      vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
      render(<App config={config} initialPerson={person} />);
      await copy();
      expect(writeText).toHaveBeenLastCalledWith(
        `${window.location.origin}/#name=Ada&tag=tech&comm=1&ops=0`,
      );
      expect(screen.getByRole("button", { name: "Link copied" })).toBeTruthy();
    });

    it("includes a change that is not in the address bar yet", async () => {
      vi.useFakeTimers();
      vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
      render(<App config={config} initialPerson={person} />);
      fireEvent.click(screen.getByRole("button", { name: "Level 2" }));
      expect(window.location.hash).toBe("");
      await copy();
      expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining("comm=2"));
    });
  });

  describe("editing the link by hand", () => {
    it("applies a changed level, name and clamped value without reloading", () => {
      render(<App config={config} initialPerson={person} />);
      editHash("#name=Ana&comm=2&ops=0");
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Ana");
      expect(screen.getByRole("button", { name: "Level 2" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.queryByRole("status")).toBeNull();

      editHash("#name=Ana&comm=9");
      expect(screen.getByRole("button", { name: "Level 2" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("status").textContent).toContain("comm=9 (changed to 2)");
    });

    it("keeps the selected category", () => {
      render(<App config={config} initialPerson={person} />);
      fireEvent.click(screen.getByText("Operations", { selector: ".radar-label tspan" }));
      editHash("#name=Ana&comm=2");
      expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Operations");
    });

    it("keeps the person and tells when the edited link is not valid", () => {
      render(<App config={config} initialPerson={person} />);
      editHash("#foo=bar");
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Ada");
      expect(screen.getByRole("status").textContent).toContain(
        "This link is not valid (it has no field this app knows), so it was ignored.",
      );
    });

    it("ignores an emptied fragment", () => {
      render(<App config={config} initialPerson={person} />);
      editHash("");
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Ada");
    });
  });

  describe("link notice", () => {
    it("is not shown without a notice", () => {
      render(<App config={config} initialPerson={person} />);
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("is shown, does not block the page and can be dismissed", () => {
      vi.useFakeTimers();
      render(<App config={config} initialPerson={person} initialNotice="Some data was ignored: gone." />);
      expect(screen.getByRole("status").textContent).toContain("Some data was ignored: gone.");

      fireEvent.click(screen.getByRole("button", { name: "Level 2" }));
      expect(screen.getByText("Drives meetings")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(screen.queryByRole("status")).toBeNull();
    });
  });
});
