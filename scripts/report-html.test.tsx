// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderReport } from "./report-html";
import type { Cell, Report } from "./report";

const cell = (key: string, name: string, level: number | undefined, max: number, target?: number): Cell => ({
  key,
  name,
  level,
  above: level !== undefined && level > max,
  max,
  progress: level === undefined ? undefined : Math.round((Math.min(level, max) / max) * 100),
  target: level === undefined ? undefined : target,
});

const report = (): Report => ({
  generatedOn: "2027-02-11",
  compare: undefined,
  categories: [
    { key: "comm", name: "Communication" },
    { key: "pm", name: "Product" },
  ],
  snapshots: ["2026-11-07", "2027-02-10"],
  persons: [
    {
      id: "ana",
      name: "Ana",
      role: "Associate",
      radar: [
        { snapshot: "2027-02-10", values: [100, 50], recorded: [true, true] },
        { snapshot: "2026-11-07", values: [50, 0], recorded: [true, false] },
      ],
      changes: [7, undefined],
      entries: [
        {
          snapshot: "2026-11-07",
          cells: [cell("comm", "Communication", 2, 4, 2), cell("pm", "Product", undefined, 2)],
          recorded: 1,
          total: 2,
          overall: 50,
          gap: { role: "Senior", met: 1, total: 1, levelsToGo: 0 },
        },
        {
          snapshot: "2027-02-10",
          cells: [cell("comm", "Communication", 9, 4, 2), cell("pm", "Product", 1, 2, 2)],
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
        cells: [cell("comm", "Communication", 9, 4, 2), cell("pm", "Product", undefined, 2)],
        recorded: 1,
        total: 2,
        overall: 100,
        gap: { role: "Senior", met: 1, total: 1, levelsToGo: 0 },
      },
    },
  ],
  teamAverage: [100, undefined],
  problems: [],
});
const render = (r = report(), options: { title?: string; heading?: string; css?: string } = {}) =>
  renderReport(r, { title: "Radar", css: ":root{--color-text:#000}", ...options });
/** The text of some HTML as a screen reader gets it: no CSS, no aria-hidden text, a space for each tag, spaces collapsed. */
const text = (html: string) =>
  html
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/<(span|sup|p)[^>]*aria-hidden="true"[^>]*>[^<]*<\/\1>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
/** The HTML of the section labelled by `id`. */
const section = (html: string, id: string) => {
  const start = html.indexOf(`aria-labelledby="${id}"`);
  return html.slice(start, html.indexOf("</section>", start));
};

describe("renderReport", () => {
  it("is a self-contained page: no script, a Content-Security-Policy that blocks every request, inline CSS", () => {
    const html = render();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">`,
    );
    expect(html).toContain("--color-text:#000");
    expect(html).not.toMatch(/<link|<img|src="http|href="http/i);
  });

  it("has a language, a title, a viewport and the heading", () => {
    const html = render(report(), { heading: "Growth" });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Radar</title>");
    expect(html).toContain('name="viewport"');
    expect(html).toContain("<h1>Growth</h1>");
    expect(render()).toContain("<h1>Radar</h1>");
  });

  it("says how many Persons and Snapshots it covers, the period, the role and when it was generated", () => {
    const masthead = text(render().slice(0, render().indexOf("<main>")));
    expect(masthead).toContain("Persons 1");
    expect(masthead).toContain("Snapshots 2");
    expect(masthead).toContain("Period 2026-11-07 – 2027-02-10");
    expect(masthead).toContain("Compared with the role of each row");
    expect(masthead).toContain("Generated 2027-02-11");
    expect(text(render({ ...report(), compare: "Senior" }))).toContain("Compared with Senior");
  });

  it("escapes everything read from a snapshot", () => {
    const hostile = "<script>alert(1)</script>";
    const r = report();
    r.persons[0].name = hostile;
    r.persons[0].id = '"><script>';
    r.problems = [{ severity: "warning", file: "snapshots/<b>.csv", line: 3, message: hostile }];
    const html = render(r, { title: "</title><script>", heading: hostile });
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("does not let the CSS close the style element", () => {
    expect(render(report(), { css: "a{} </style><script>x</script>" })).not.toMatch(/<script/i);
  });

  it("shows, per Person, a table of Categories by Snapshot with the Reached levels and the Overall progress", () => {
    const html = section(render(), "evolution");
    expect(html).toContain("<h3>Ana</h3>");
    expect(html).toContain('id="person-ana"');
    expect(html).toContain(">2026-11-07</th>");
    expect(html).toContain(">2027-02-10</th>");
    expect(html).toContain('<th scope="row">Communication</th>');
    expect(text(html)).toContain("50 % 1 of 2 categories");
    expect(text(html)).toContain("75 % 2 of 2 categories");
  });

  it("introduces each Person with their id, Role, Snapshots and the figures of their latest row", () => {
    const head = text(section(render(), "evolution"));
    expect(head).toContain("ana · Associate · 2 Snapshots, 2026-11-07 – 2027-02-10");
    expect(head).toContain("Overall 75 %");
    expect(head).toContain("On target 1 /2");
    expect(head).toContain("Levels to go 3");
  });

  it("gives the change of each Category from the first to the last level recorded, when there are several rows", () => {
    const html = section(render(), "evolution");
    expect(html).toContain(">Change</th>");
    expect(text(html)).toContain("+7");
    const r = report();
    r.persons[0].entries = [r.persons[0].entries[1]];
    expect(section(render(r), "evolution")).not.toContain(">Change</th>");
  });

  it("says not recorded for a Category without a level, and flags a level above the Highest level", () => {
    const html = render();
    expect(html).toContain("not recorded");
    expect(html).toContain("above the highest level");
  });

  it("marks each recorded level against the target of the role, in words as well as with a sign", () => {
    const html = render();
    expect(text(html)).toContain("2 of 4, meets the target of 2");
    expect(text(html)).toContain("1 of 2, 1 level below the target of 2");
    expect(text(html)).toContain("9 of 4, above the highest level, 7 levels above the target of 2");
    expect(html).toContain('class="report-heat" data-heat="3" data-status="met"');
    expect(html).toContain('class="report-heat" data-heat="3" data-status="below"');
    expect(html).toContain('class="report-heat" data-heat="5" data-status="above"');
    expect(html).toMatch(/>−1</);
    expect(html).toMatch(/>\+7</);
  });

  it("tones each level against its role: green from meeting it, darker above it; red below it, darker the bigger the gap", () => {
    const r = report();
    r.categories = ["comm", "pm", "a", "b", "c", "d"].map((key) => ({ key, name: key }));
    const entry = r.persons[0].entries[1];
    entry.cells = [
      cell("comm", "Communication", 2, 5, 2),
      cell("pm", "Product", 3, 5, 2),
      cell("a", "A", 5, 5, 2),
      cell("b", "B", 1, 5, 2),
      cell("c", "C", 0, 5, 4),
      cell("d", "D", 3, 5),
    ];
    r.persons[0].entries = [entry];
    r.persons[0].radar = [{ snapshot: entry.snapshot, values: [40, 60, 100, 20, 0, 60], recorded: Array(6).fill(true) }];
    r.persons[0].changes = Array(6).fill(undefined);
    const html = section(render(r), "evolution");
    const tone = (attributes: string) => html.includes(`data-heat="${attributes}`);
    expect(tone('2" data-status="met" data-step="1"')).toBe(true);
    expect(tone('3" data-status="above" data-step="2"')).toBe(true);
    expect(tone('5" data-status="above" data-step="3"')).toBe(true);
    expect(tone('1" data-status="below" data-step="1"')).toBe(true);
    expect(tone('0" data-status="below" data-step="3"')).toBe(true);
    // Without a role to compare, the level keeps the neutral scale of its Progress.
    expect(html).toContain('<td class="report-heat" data-heat="3"><span class="report-heat-level">3</span>');
  });

  it("explains both scales in the legend only when the map uses them", () => {
    const legend = (r: Report) => text(render(r).slice(render(r).indexOf("report-legend"), render(r).indexOf("</ul>")));
    expect(legend(report())).toContain("Against the role");
    expect(legend(report())).not.toContain("No role");
    const r = report();
    r.persons[0].entries[0].cells[0].target = undefined;
    expect(legend(r)).toContain("No role");
  });

  it("counts the Categories above the role next to the Role gap", () => {
    const team = text(section(render(), "team-overview"));
    expect(team).toContain("1 above the role");
    expect(text(section(render(), "evolution"))).toContain("Above the role 1");
  });

  it("tints each level by its Progress on a scale of 0 to 5 steps", () => {
    const html = section(render(), "team-overview");
    expect(html).toMatch(/class="report-heat" data-heat="5"/); // 9 of 4: capped at 100%
    expect(html).toMatch(/class="report-heat" data-heat="none"/);
    expect(html).toContain("How to read the map");
  });

  it("says 1 category in the singular and shows no progress for a row that records nothing", () => {
    const r = report();
    r.persons[0].entries = [{ ...r.persons[0].entries[0], recorded: 0, total: 1, overall: undefined, gap: undefined }];
    const html = render(r);
    expect(text(html)).toContain("0 of 1 category");
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
    const words = text(html);
    expect(words).toContain("On target in 1 of 1 category");
    expect(words).toContain("0 levels to go");
    expect(words).toContain("On target in 1 of 2 categories");
    expect(words).toContain("3 levels to go");
    expect(words).toContain("Senior, covers 1 of 2 categories");
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
    const words = text(render(r));
    expect(words).toContain("On target in 1 of 1 category");
    expect(words).toContain("1 level to go");
  });

  it("draws one radar per Person with the last and the first row, labelled with their Snapshots", () => {
    const html = render();
    expect(html.match(/<svg[^>]*role="img"/g)).toHaveLength(1);
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
    const html = render(r);
    expect(html.slice(html.indexOf("<body>"))).not.toContain("radar-series--compare");
  });

  it("has no script inside the chart", () => {
    expect(render()).not.toMatch(/<script/i);
  });

  it("starts with the Team overview: a heat map of every Person by Category at their latest row, with its date", () => {
    const html = render();
    expect(html).toContain('<h2 id="team-overview">Team overview</h2>');
    expect(html.indexOf("Team overview")).toBeLessThan(html.indexOf("Evolution of each Person"));
    const team = section(html, "team-overview");
    expect(team).toContain('<a href="#person-ana">Ana</a>');
    expect(text(team)).toContain("2027-02-10 · Associate");
    expect(team).toContain("<span>Communication</span>");
    expect(team).toContain("above the highest level");
    expect(team).toContain("not recorded");
    expect(text(team)).toContain("100 % 1 of 2 categories");
    expect(text(team)).toContain("On target in 1 of 1 category");
  });

  it("draws the Overall progress of every row of a Person as a line next to their latest one", () => {
    const team = section(render(), "team-overview");
    expect(team).toContain('class="report-spark"');
    const r = report();
    r.persons[0].entries = [r.persons[0].entries[1]];
    expect(section(render(r), "team-overview")).not.toContain('class="report-spark"');
  });

  it("adds the team average of each Category when there are several Persons", () => {
    expect(render()).not.toContain("Team average");
    const r = report();
    r.team = [r.team[0], { ...r.team[0], id: "luis", name: "Luis" }];
    r.teamAverage = [62, undefined];
    const words = text(section(render(r), "team-overview"));
    expect(words).toContain("Team average");
    expect(words).toContain("62 %");
  });

  it("names the role of --compare in the Team overview and escapes the names", () => {
    const r = { ...report(), compare: "Senior" };
    r.team[0].name = "<b>x</b>";
    const html = render(r);
    expect(html).toContain(">Role gap against Senior</th>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });
});
