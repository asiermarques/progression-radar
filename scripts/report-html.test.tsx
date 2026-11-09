// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderReport } from "./report-html";
import type { Report } from "./report";

const report = (): Report => ({
  generatedOn: "2027-02-11",
  compare: undefined,
  categories: [
    { key: "comm", name: "Communication" },
    { key: "pm", name: "Product" },
  ],
  persons: [
    {
      id: "ana",
      name: "Ana",
      radar: [
        { snapshot: "2027-02-10", values: [100, 50], recorded: [true, true] },
        { snapshot: "2026-11-07", values: [50, 0], recorded: [true, false] },
      ],
      entries: [
        {
          snapshot: "2026-11-07",
          cells: [
            { key: "comm", name: "Communication", level: 2, above: false },
            { key: "pm", name: "Product", level: undefined, above: false },
          ],
          recorded: 1,
          total: 2,
          overall: 50,
          gap: { role: "Senior", met: 1, total: 1, levelsToGo: 0 },
        },
        {
          snapshot: "2027-02-10",
          cells: [
            { key: "comm", name: "Communication", level: 9, above: true },
            { key: "pm", name: "Product", level: 1, above: false },
          ],
          recorded: 2,
          total: 2,
          overall: 75,
          gap: { role: "Senior", met: 1, total: 2, levelsToGo: 3 },
        },
      ],
    },
  ],
  team: [
    {
      id: "ana",
      name: "Ana",
      snapshot: "2027-02-10",
      entry: {
        snapshot: "2027-02-10",
        cells: [
          { key: "comm", name: "Communication", level: 9, above: true },
          { key: "pm", name: "Product", level: undefined, above: false },
        ],
        recorded: 1,
        total: 2,
        overall: 100,
        gap: { role: "Senior", met: 1, total: 1, levelsToGo: 0 },
      },
    },
  ],
  problems: [],
});
const render = (r = report(), options: { title?: string; css?: string } = {}) =>
  renderReport(r, { title: "Radar", css: ":root{--color-text:#000}", ...options });

describe("renderReport", () => {
  it("is a self-contained page: no script, a Content-Security-Policy that blocks every request, inline CSS", () => {
    const html = render();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`,
    );
    expect(html).toContain("--color-text:#000");
    expect(html).not.toMatch(/<link|<img|src="http|href="http/i);
  });

  it("has a language, a title and a viewport", () => {
    const html = render();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Radar</title>");
    expect(html).toContain('name="viewport"');
  });

  it("escapes everything read from a snapshot", () => {
    const hostile = "<script>alert(1)</script>";
    const r = report();
    r.persons[0].name = hostile;
    r.problems = [{ severity: "warning", file: "snapshots/<b>.csv", line: 3, message: hostile }];
    const html = render(r, { title: "</title><script>" });
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("does not let the CSS close the style element", () => {
    expect(render(report(), { css: "a{} </style><script>x</script>" })).not.toMatch(/<script/i);
  });

  it("shows, per Person, a table of Categories by Snapshot with the Reached levels and the Overall progress", () => {
    const html = render();
    expect(html).toContain("<h3>Ana</h3>");
    expect(html).toContain('<th scope="col">2026-11-07</th>');
    expect(html).toContain('<th scope="col">2027-02-10</th>');
    expect(html).toContain('<th scope="row">Communication</th>');
    expect(html).toContain("50%");
    expect(html).toContain("1 of 2 categories");
    expect(html).toContain("75%");
    expect(html).toContain("2 of 2 categories");
  });

  it("says not recorded for a Category without a level, and flags a level above the Highest level", () => {
    const html = render();
    expect(html).toContain("not recorded");
    expect(html).toContain("above the highest level");
  });

  it("says 1 category in the singular and shows no progress for a row that records nothing", () => {
    const r = report();
    r.persons[0].entries = [{ ...r.persons[0].entries[0], recorded: 0, total: 1, overall: undefined, gap: undefined }];
    const html = render(r);
    expect(html).toContain("0 of 1 category");
    expect(html).not.toContain("NaN");
  });

  it("lists the problems found with file and line", () => {
    const html = render({
      ...report(),
      problems: [{ severity: "warning", file: "snapshots/2026-11-07.csv", line: 2, message: 'compare "x" is not a role' }],
    });
    expect(html).toContain("snapshots/2026-11-07.csv:2");
    expect(html).toContain("is not a role");
  });

  it("shows the Role gap of each row: On target Categories and Levels to go, the role and how many Categories it covers", () => {
    const html = render();
    expect(html).toContain('<th scope="row">Role gap</th>');
    expect(html).toContain("On target in 1 of 1 category");
    expect(html).toContain("0 levels to go");
    expect(html).toContain("On target in 1 of 2 categories");
    expect(html).toContain("3 levels to go");
    expect(html).toContain("Senior");
    expect(html).toContain("covers 1 of 2 categories");
  });

  it("says no role to compare for a row without a Role gap", () => {
    const r = report();
    r.persons[0].entries[0].gap = undefined;
    expect(render(r)).toContain("no role to compare");
  });

  it("says which role every Role gap is against when it was chosen for the whole Report", () => {
    expect(render({ ...report(), compare: "Senior" })).toContain("Role gap against Senior");
  });

  it("writes 1 category and 1 level in the singular", () => {
    const r = report();
    r.persons[0].entries[0].gap = { role: "Senior", met: 1, total: 1, levelsToGo: 1 };
    const html = render(r);
    expect(html).toContain("On target in 1 of 1 category");
    expect(html).toContain("1 level to go");
  });

  it("draws one radar per Person with the last and the first row, labelled with their Snapshots", () => {
    const html = render();
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toContain('role="img"');
    expect(html).toContain("radar-series radar-series--person");
    expect(html).toContain("radar-series radar-series--compare");
    expect(html).toContain('class="radar-legend-item radar-series--person">2027-02-10<');
    expect(html).toContain('class="radar-legend-item radar-series--compare">2026-11-07<');
  });

  it("does not draw a Category that was not recorded at 0 and says so on the chart, in its text alternative and in the page", () => {
    const html = render();
    expect(html).toContain("Product not recorded");
    expect(html).toContain('class="radar-label-note"');
    expect(html).not.toContain("2026-11-07 · Product: 0%");
    expect(html).toContain("not recorded");
  });

  it("draws a single series for a Person with one row", () => {
    const r = report();
    r.persons[0].radar = [r.persons[0].radar[0]];
    r.persons[0].entries = [r.persons[0].entries[1]];
    expect(render(r)).not.toContain("radar-series--compare");
  });

  it("has no script inside the chart", () => {
    expect(render()).not.toMatch(/<script/i);
  });

  it("starts with the Team overview: a table of every Person by Category at their latest row, with its date", () => {
    const html = render();
    expect(html).toContain('<h2 id="team-overview">Team overview</h2>');
    expect(html.indexOf("Team overview")).toBeLessThan(html.indexOf("Evolution of each Person"));
    const team = html.slice(html.indexOf('aria-labelledby="team-overview"'), html.indexOf('aria-labelledby="evolution"'));
    expect(team).toContain('<th scope="row">Ana</th>');
    expect(team).toContain("<td>2027-02-10</td>");
    expect(team).toContain('<th scope="col">Communication</th>');
    expect(team).toContain("above the highest level");
    expect(team).toContain("not recorded");
    expect(team).toContain("100%");
    expect(team).toContain("1 of 2 categories");
    expect(team).toContain("On target in 1 of 1 category");
  });

  it("names the role of --compare in the Team overview and escapes the names", () => {
    const r = { ...report(), compare: "Senior" };
    r.team[0].name = "<b>x</b>";
    const html = render(r);
    expect(html).toContain('<th scope="col">Role gap against Senior</th>');
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });
});
