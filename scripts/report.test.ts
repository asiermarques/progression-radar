// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config";
import type { Config, Person } from "../src/model";
import { buildReport } from "./report";
import type { SnapshotRow } from "./snapshots";

const category = (key: string, highest: number) => ({
  key,
  name: key,
  expectations: Array.from({ length: highest }, (_, i) => ({ summary: `s${i + 1}`, level: i + 1 })),
});
const config: Config = parseConfig({
  categories: [category("comm", 4), category("pm", 2), category("back", 2)],
  roles: [
    { key: "aswe", name: "Associate", levels: { comm: 2, pm: 1 } },
    { key: "pem", name: "Principal", levels: { comm: 4, pm: 2, back: 2 } },
  ],
  site: null,
});

const row = (file: string, id: string, person: Partial<Person>, line = 2): SnapshotRow => ({
  file,
  label: `snapshots/${file}`,
  date: file.slice(0, 10),
  line,
  id,
  person: { name: id, tags: [], levels: {}, ...person },
});
const build = (rows: SnapshotRow[], compare?: string) =>
  buildReport({ config, rows, problems: [], generatedOn: "2027-02-11", compare });

describe("buildReport", () => {
  const report = build([
    row("2026-11-07.csv", "ana", { name: "Ana", levels: { comm: 2, pm: 1 } }),
    row("2026-11-07.csv", "luis", { name: "Luis", levels: { comm: 1, pm: 0, back: 0 } }),
    row("2027-02-10.csv", "ana", { name: "Ana G.", levels: { comm: 4, pm: 1, back: 1 } }),
  ]);

  it("groups rows by Person id in snapshot order, named as in their latest row", () => {
    expect(report.persons.map((person) => [person.id, person.name, person.entries.map((entry) => entry.snapshot)])).toEqual([
      ["ana", "Ana G.", ["2026-11-07", "2027-02-10"]],
      ["luis", "Luis", ["2026-11-07"]],
    ]);
  });

  it("lists every Category as a cell, not recorded when the row has no level for it", () => {
    expect(report.persons[0].entries[0].cells).toEqual([
      { key: "comm", name: "comm", level: 2, above: false },
      { key: "pm", name: "pm", level: 1, above: false },
      { key: "back", name: "back", level: undefined, above: false },
    ]);
  });

  it("computes the Overall progress over the recorded Categories and says how many they are", () => {
    const [first, last] = report.persons[0].entries;
    expect(first).toMatchObject({ overall: 50, recorded: 2, total: 3 });
    expect(last).toMatchObject({ overall: Math.round((100 + 50 + 50) / 3), recorded: 3, total: 3 });
  });

  it("shows no progress for a row that records no Category", () => {
    const [entry] = build([row("2026-11-07.csv", "ana", {})]).persons[0].entries;
    expect(entry).toMatchObject({ overall: undefined, recorded: 0 });
  });

  it("flags a level above the Highest level, keeps it as recorded and caps its progress at 100%", () => {
    const [entry] = build([row("2026-11-07.csv", "ana", { levels: { comm: 9, pm: 0 } })]).persons[0].entries;
    expect(entry.cells[0]).toMatchObject({ level: 9, above: true });
    expect(entry.overall).toBe(50);
  });

  it("falls back to the id when the row has no name", () => {
    expect(build([row("2026-11-07.csv", "ana", { name: "" })]).persons[0].name).toBe("ana");
  });

  describe("role gap", () => {
    const rows = [
      row("2026-11-07.csv", "ana", { compareTo: "aswe", levels: { comm: 2, pm: 1 } }),
      row("2027-02-10.csv", "ana", { levels: { comm: 1, pm: 1, back: 0 } }),
    ];

    it("uses the Compared role of each row, and shows no Role gap for a row with none", () => {
      const [first, second] = build(rows).persons[0].entries;
      expect(first.gap).toEqual({ role: "Associate", met: 2, total: 2, levelsToGo: 0 });
      expect(second.gap).toBeUndefined();
    });

    it("compares every row with the given role instead, over the recorded Categories only", () => {
      const result = build(rows, "pem");
      expect(result.compare).toBe("Principal");
      const [first, second] = result.persons[0].entries;
      expect(first.gap).toEqual({ role: "Principal", met: 0, total: 2, levelsToGo: 2 + 1 });
      expect(second.gap).toEqual({ role: "Principal", met: 0, total: 3, levelsToGo: 3 + 1 + 2 });
    });

    it("shows no Role gap for a Compared role that is not in the Configuration", () => {
      expect(build([row("2026-11-07.csv", "ana", { compareTo: "ghost", levels: { comm: 1 } })]).persons[0].entries[0].gap).toBeUndefined();
    });

    it("shows no Role gap for a row that records no Category", () => {
      expect(build([row("2026-11-07.csv", "ana", { compareTo: "aswe" })], "pem").persons[0].entries[0].gap).toBeUndefined();
    });
  });

  describe("radar", () => {
    const rows = [
      row("2026-11-07.csv", "ana", { levels: { comm: 2, pm: 1 } }),
      row("2026-12-01.csv", "ana", { levels: { comm: 3, pm: 2, back: 1 } }),
      row("2027-02-10.csv", "ana", { levels: { comm: 4, pm: 2, back: 2 } }),
      row("2026-11-07.csv", "luis", { levels: { comm: 1 } }, 3),
    ];

    it("has the last row first and the first row second, labelled with their Snapshots", () => {
      const [ana] = build(rows).persons;
      expect(ana.radar.map((series) => series.snapshot)).toEqual(["2027-02-10", "2026-11-07"]);
      expect(ana.radar[0].values).toEqual([100, 100, 100]);
      expect(ana.radar[1].values).toEqual([50, 50, 0]);
    });

    it("says which Categories each series recorded, so they are not drawn as 0", () => {
      const [ana] = build(rows).persons;
      expect(ana.radar[1].recorded).toEqual([true, true, false]);
      expect(ana.radar[0].recorded).toEqual([true, true, true]);
    });

    it("has one series for a Person with a single row", () => {
      const luis = build(rows).persons[1];
      expect(luis.radar).toHaveLength(1);
      expect(luis.radar[0]).toMatchObject({ snapshot: "2026-11-07", recorded: [true, false, false] });
    });
  });

  describe("team", () => {
    const rows = [
      row("2026-11-09.csv", "ana-garcia", { name: "Ana", compareTo: "aswe", levels: { comm: 1, pm: 1 } }),
      row("2026-11-09.csv", "asier", { name: "Asier", levels: { comm: 1 } }),
      row("2027-02-10.csv", "asier", { name: "Asier M.", levels: { comm: 3, back: 1 } }),
    ];

    it("has every Person at their latest row in any Snapshot, with its Snapshot", () => {
      expect(build(rows).team.map((member) => [member.id, member.name, member.snapshot])).toEqual([
        ["ana-garcia", "Ana", "2026-11-09"],
        ["asier", "Asier M.", "2027-02-10"],
      ]);
    });

    it("has the cells, Overall progress and Role gap of that row, with the same rule as the rest of the Report", () => {
      const [ana, asier] = build(rows, "pem").team;
      expect(ana.entry.cells.map((cell) => cell.level)).toEqual([1, 1, undefined]);
      expect(ana.entry.gap).toEqual({ role: "Principal", met: 0, total: 2, levelsToGo: 3 + 1 });
      expect(asier.entry).toMatchObject({ recorded: 2, total: 3, overall: Math.round((75 + 50) / 2) });
      expect(asier.entry.gap).toEqual({ role: "Principal", met: 0, total: 2, levelsToGo: 1 + 1 });
      expect(build(rows).team[0].entry.gap).toMatchObject({ role: "Associate" });
    });

    it("takes the row of the snapshot that sorts last when two have the same date", () => {
      const same = build([
        row("2027-02-10.csv", "asier", { levels: { comm: 1 } }),
        row("2027-02-10-q1-review.csv", "asier", { levels: { comm: 3 } }),
      ]);
      expect(same.team[0].snapshot).toBe("2027-02-10-q1-review");
      expect(same.team[0].entry.cells[0].level).toBe(3);
    });
  });
});
