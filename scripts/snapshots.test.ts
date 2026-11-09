// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseConfig } from "../src/config";
import type { Config, Person } from "../src/model";
import { parseState, toUrl } from "../src/urlState";
import {
  SnapshotError,
  checkSnapshots,
  readSnapshotRows,
  recordPerson,
  resolveSnapshotsFolder,
  snapshotLink,
  type Problem,
} from "./snapshots";

const category = (key: string, highest: number) => ({
  key,
  name: key,
  expectations: Array.from({ length: highest }, (_, i) => ({ summary: `s${i + 1}`, level: i + 1 })),
});
const role = (key: string, levels: Record<string, number> = {}) => ({ key, name: key, levels });

const config: Config = parseConfig({
  categories: [category("comm", 4), category("pm", 3), category("back", 2)],
  roles: [role("aswe", { comm: 2 }), role("front", { comm: 3, pm: 2 })],
  site: null,
});
const withoutBack: Config = parseConfig({
  categories: [category("comm", 4), category("pm", 3)],
  roles: [role("aswe"), role("front")],
  site: null,
});

const BASE = "http://localhost:5173/";
const linkOf = (person: Partial<Person>, using: Config = config) =>
  toUrl({ name: "", levels: {}, tags: [], ...person }, using, BASE);

const ANA: Partial<Person> = {
  name: "Ana García",
  roleKey: "aswe",
  compareTo: "front",
  tags: ["tech", "design"],
  levels: { comm: 2, pm: 1, back: 0 },
};
const HEADER = "id,name,role,compare,tags,comm,pm,back";
const ANA_ROW = "ana-garcia,Ana García,aswe,front,tech|design,2,1,0";

let root: string;
const snapshots = () => join(root, "snapshots");
const read = (name: string, folder = snapshots()) => readFileSync(join(folder, name), "utf8");
const put = (name: string, content: string | Buffer, folder = snapshots()) => {
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, name), content);
};
const record = (options: Partial<Parameters<typeof recordPerson>[0]> = {}) =>
  recordPerson({
    root,
    config,
    link: linkOf(ANA),
    id: "ana-garcia",
    snapshot: "2026-11-07.csv",
    ...options,
  });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "radar-snapshots-"));
  // The project root is a sub-folder, so that "../" stays inside the temporary folder.
  root = join(root, "project");
  mkdirSync(root);
});
afterEach(() => rmSync(join(root, ".."), { recursive: true, force: true }));

describe("resolveSnapshotsFolder", () => {
  it("is snapshots/ at the project root by default", () => {
    expect(resolveSnapshotsFolder(root, undefined)).toEqual({ path: join(root, "snapshots"), label: "snapshots" });
  });

  it("follows PROGRESSION_RADAR_SNAPSHOTS_DIR, relative to the project root or absolute", () => {
    expect(resolveSnapshotsFolder(root, "../data/")).toEqual({ path: join(root, "..", "data"), label: "../data" });
    expect(resolveSnapshotsFolder(root, join(root, "abs"))).toEqual({ path: join(root, "abs"), label: join(root, "abs") });
  });
});

describe("recordPerson in a new snapshot", () => {
  it("creates the file with the header and one row, and creates the folder", () => {
    const result = record();
    expect(read("2026-11-07.csv")).toBe(`${HEADER}\n${ANA_ROW}\n`);
    expect(result).toMatchObject({ file: "snapshots/2026-11-07.csv", created: true, line: 2, row: ANA_ROW });
    expect(result.ignored).toEqual([]);
  });

  it("uses today's date as the default snapshot", () => {
    const result = record({ snapshot: undefined, today: new Date(2026, 0, 5, 23, 59) });
    expect(result.file).toBe("snapshots/2026-01-05.csv");
    expect(existsSync(join(snapshots(), "2026-01-05.csv"))).toBe(true);
  });

  it("leaves empty cells for what the Person does not have", () => {
    record({ link: linkOf({ name: "Luis", levels: { comm: 1 } }), id: "luis" });
    expect(read("2026-11-07.csv")).toBe(`${HEADER}\nluis,Luis,,,,1,0,0\n`);
  });

  it("quotes values with commas and quotes as standard CSV", () => {
    record({ link: linkOf({ ...ANA, name: 'García, "Ana"' }) });
    expect(read("2026-11-07.csv")).toBe(`${HEADER}\nana-garcia,"García, ""Ana""",aswe,front,tech|design,2,1,0\n`);
  });

  it("records the normalised Person and reports the Ignored fields", () => {
    const link = `${linkOf(ANA)}&xx=2`.replace("comm=2", "comm=9");
    const result = record({ link });
    expect(read("2026-11-07.csv")).toBe(`${HEADER}\nana-garcia,Ana García,aswe,front,tech|design,4,1,0\n`);
    expect(result.ignored).toEqual(["xx", "comm=9 (changed to 4)"]);
  });

  it("reads legacy links", () => {
    const legacy = `${BASE}?state=${encodeURIComponent(JSON.stringify({ name: "Ana", levels: { comm: 3 }, roleKey: "aswe", tags: [] }))}`;
    record({ link: legacy });
    expect(read("2026-11-07.csv")).toBe(`${HEADER}\nana-garcia,Ana,aswe,,,3,0,0\n`);
  });

  it("writes in the folder of PROGRESSION_RADAR_SNAPSHOTS_DIR", () => {
    const result = record({ setting: "../ladder-data/snapshots" });
    expect(result.file).toBe("../ladder-data/snapshots/2026-11-07.csv");
    expect(read("2026-11-07.csv", join(root, "..", "ladder-data", "snapshots"))).toBe(`${HEADER}\n${ANA_ROW}\n`);
    expect(existsSync(snapshots())).toBe(false);
  });

  it.each([
    ["not a URL", "ana"],
    ["no data", `${BASE}`],
    ["no field this app knows", `${BASE}#foo=1`],
    ["the state is not valid JSON", `${BASE}?state=%7Bnope`],
  ])("refuses a link that is not a valid Share link (%s) and writes nothing", (_reason, link) => {
    expect(() => record({ link })).toThrow(SnapshotError);
    expect(existsSync(snapshots())).toBe(false);
  });

  it("gives the reason of an invalid link", () => {
    expect(() => record({ link: `${BASE}#foo=1` })).toThrow("it has no field this app knows");
  });

  it.each(["notes.csv", "2026-13-01.csv", "2026-02-30.csv", "2026-11-07", "2026-11-07.txt", "../2026-11-07.csv", "a/2026-11-07.csv"])(
    "refuses the snapshot name %s and shows the expected form",
    (snapshot) => {
      expect(() => record({ snapshot })).toThrow(/2026-11-07\.csv/);
      expect(existsSync(snapshots())).toBe(false);
    },
  );

  it("accepts a free text after the date", () => {
    record({ snapshot: "2026-11-07-q4 review.csv" });
    expect(existsSync(join(snapshots(), "2026-11-07-q4 review.csv"))).toBe(true);
  });

  it.each(["", "ana garcia", "ana,garcia", "ana;garcia", 'ana"garcia', "ana|garcia"])("refuses the id %j", (id) => {
    expect(() => record({ id })).toThrow(/id/);
    expect(existsSync(snapshots())).toBe(false);
  });

  it("refuses a Person tag that contains |", () => {
    expect(() => record({ link: linkOf({ ...ANA, tags: ["a|b"] }) })).toThrow(/tag "a\|b"/);
    expect(existsSync(snapshots())).toBe(false);
  });
});

describe("recordPerson in an existing snapshot", () => {
  beforeEach(() => {
    record();
  });

  it("appends a row and leaves everything before it byte for byte as it was", () => {
    const before = read("2026-11-07.csv");
    const result = record({ link: linkOf({ name: "Luis", levels: { comm: 1 } }), id: "luis" });
    expect(read("2026-11-07.csv")).toBe(`${before}luis,Luis,,,,1,0,0\n`);
    expect(result).toMatchObject({ created: false, line: 3 });
  });

  it("refuses an id the file already holds, naming it and its line", () => {
    const before = read("2026-11-07.csv");
    expect(() => record()).toThrow('"ana-garcia"');
    expect(() => record()).toThrow("line 2");
    expect(read("2026-11-07.csv")).toBe(before);
  });

  it("adds the missing line break when the file does not end with one", () => {
    put("2026-11-08.csv", `${HEADER}\n${ANA_ROW}`);
    record({ snapshot: "2026-11-08.csv", id: "luis" });
    expect(read("2026-11-08.csv")).toBe(`${HEADER}\n${ANA_ROW}\nluis,Ana García,aswe,front,tech|design,2,1,0\n`);
  });

  it("follows the header of the file and says which current Category it did not record", () => {
    put("2026-01-10.csv", "id,name,comm,pm\nluis,Luis,1,1\n");
    const result = record({ snapshot: "2026-01-10.csv" });
    expect(read("2026-01-10.csv")).toBe("id,name,comm,pm\nluis,Luis,1,1\nana-garcia,Ana García,2,1\n");
    expect(result.notRecorded).toEqual(["back"]);
  });

  it("leaves an empty cell for a header column that is no longer in the Configuration", () => {
    put("2026-01-10.csv", "id,name,pm,gone,comm\nluis,Luis,1,2,1\n");
    record({ snapshot: "2026-01-10.csv" });
    expect(read("2026-01-10.csv")).toBe("id,name,pm,gone,comm\nluis,Luis,1,2,1\nana-garcia,Ana García,1,,2\n");
  });

  it("reads the columns by name, in any order", () => {
    put("2026-01-10.csv", "comm,tags,id\n3,,luis\n");
    record({ snapshot: "2026-01-10.csv" });
    expect(read("2026-01-10.csv")).toBe("comm,tags,id\n3,,luis\n2,tech|design,ana-garcia\n");
  });

  it("refuses a file without an id column and suggests the check", () => {
    put("2026-01-10.csv", "name,comm\nLuis,1\n");
    expect(() => record({ snapshot: "2026-01-10.csv" })).toThrow("snapshot:check");
  });

  it("refuses a file that cannot be read as CSV and suggests the check", () => {
    put("2026-01-10.csv", 'id,name\nluis,"Luis\n');
    expect(() => record({ snapshot: "2026-01-10.csv" })).toThrow("snapshot:check");
    expect(read("2026-01-10.csv")).toBe('id,name\nluis,"Luis\n');
  });

  it("refuses an empty file", () => {
    put("2026-01-10.csv", "");
    expect(() => record({ snapshot: "2026-01-10.csv" })).toThrow("snapshot:check");
  });
});

describe("snapshots saved by a spreadsheet", () => {
  const spreadsheet = `﻿comm;id;name;role;compare;tags;pm\r\n3;luis;"García; Luis";aswe;;;1\r\n`;

  it("keeps the separator, the line breaks and the byte-order mark when appending", () => {
    put("2026-01-10.csv", spreadsheet);
    record({ snapshot: "2026-01-10.csv" });
    expect(read("2026-01-10.csv")).toBe(`${spreadsheet}2;ana-garcia;Ana García;aswe;front;tech|design;1\r\n`);
  });

  it("quotes with the separator of the file", () => {
    put("2026-01-10.csv", spreadsheet);
    record({ snapshot: "2026-01-10.csv", link: linkOf({ ...ANA, name: "García; Ana" }) });
    expect(read("2026-01-10.csv")).toContain('2;ana-garcia;"García; Ana";');
  });

  it("finds an id in a spreadsheet file", () => {
    put("2026-01-10.csv", spreadsheet);
    expect(() => record({ snapshot: "2026-01-10.csv", id: "luis" })).toThrow("line 2");
  });

  it("reports a file that is not UTF-8 with the hint to save it as CSV UTF-8", () => {
    put("2026-01-10.csv", Buffer.from("id;name\nluis;Garc\xeda\n", "latin1"));
    expect(() => record({ snapshot: "2026-01-10.csv" })).toThrow("CSV UTF-8");
  });
});

describe("snapshotLink", () => {
  const link = (options: Partial<Parameters<typeof snapshotLink>[0]> = {}) =>
    snapshotLink({ root, config, snapshot: "2026-11-07.csv", id: "ana-garcia", ...options });

  beforeEach(() => {
    record();
  });

  it("builds a Share link that gives the same Person back", () => {
    const { link: url } = link();
    expect(url.startsWith(BASE + "#")).toBe(true);
    const parsed = parseState({ search: new URL(url).search, hash: new URL(url).hash }, config);
    expect(parsed).toEqual({
      kind: "ok",
      issues: [],
      person: { name: "Ana García", roleKey: "aswe", compareTo: "front", tags: ["tech", "design"], levels: { comm: 2, pm: 1, back: 0 } },
    });
  });

  it("builds the link on the given base", () => {
    expect(link({ base: "https://radar.example.com/" }).link.startsWith("https://radar.example.com/#")).toBe(true);
  });

  it("refuses a base that is not a URL", () => {
    expect(() => link({ base: "radar" })).toThrow("--base");
  });

  it("finds the row by name in any column order", () => {
    put("2026-01-10.csv", "comm,tags,id,name\n3,x|y,luis,Luis\n");
    const { link: url } = link({ snapshot: "2026-01-10.csv", id: "luis" });
    expect(new URL(url).hash).toBe("#name=Luis&tag=x&tag=y&comm=3&pm=0&back=0");
  });

  it("errors on an id that is not in the snapshot, naming the id and the file", () => {
    expect(() => link({ id: "luis" })).toThrow(/"luis".*snapshots\/2026-11-07\.csv/);
  });

  it("errors on a snapshot that does not exist", () => {
    expect(() => link({ snapshot: "2020-01-01.csv" })).toThrow("snapshots/2020-01-01.csv");
  });

  it("carries the columns the Configuration no longer has, and lists them as ignored by the app", () => {
    put("2026-01-10.csv", "id,name,comm,pm,gone\nluis,Luis,1,2,3\n");
    const result = link({ snapshot: "2026-01-10.csv", id: "luis", config: withoutBack });
    expect(new URL(result.link).hash).toBe("#name=Luis&comm=1&pm=2&gone=3");
    expect(result.ignoredColumns).toEqual(["gone"]);
  });

  it("reads a spreadsheet file", () => {
    put("2026-01-10.csv", `﻿id;name;comm\r\nluis;"García; Luis";3\r\n`);
    const { link: url } = link({ snapshot: "2026-01-10.csv", id: "luis" });
    expect(new URL(url).hash).toBe("#name=Garc%C3%ADa%3B+Luis&comm=3&pm=0&back=0");
  });

  it("refuses a level that is not a number and suggests the check", () => {
    put("2026-01-10.csv", "id,comm\nluis,two\n");
    expect(() => link({ snapshot: "2026-01-10.csv", id: "luis" })).toThrow("snapshot:check");
  });
});

describe("checkSnapshots", () => {
  const check = (options: Partial<Parameters<typeof checkSnapshots>[0]> = {}) => checkSnapshots({ root, config, ...options });
  const summary = (problems: Problem[]) =>
    problems.map((problem) => `${problem.severity} ${problem.file}${problem.line ? `:${problem.line}` : ""} ${problem.message}`);

  it("reports nothing for what the record script wrote", () => {
    record();
    record({ id: "luis" });
    expect(check()).toEqual({ checked: 1, problems: [] });
  });

  it("is happy with no snapshots folder", () => {
    expect(check()).toEqual({ checked: 0, problems: [] });
  });

  it("warns, without changing the file, about an unknown column, a level above the Highest level and unknown roles", () => {
    put("2026-11-07.csv", "id,name,role,compare,comm,pm\nana,Ana,boss,ghost,5,1\n");
    const before = read("2026-11-07.csv");
    const { problems } = check();
    expect(summary(problems)).toEqual([
      'warning snapshots/2026-11-07.csv:2 role "boss" is not a role of the current Configuration',
      'warning snapshots/2026-11-07.csv:2 compare "ghost" is not a role of the current Configuration',
      'warning snapshots/2026-11-07.csv:2 level 5 in "comm" is above its highest level, 4',
    ]);
    expect(read("2026-11-07.csv")).toBe(before);
  });

  it("warns about a column that is not a Category of the Configuration", () => {
    put("2026-11-07.csv", "id,pm,gone\nana,1,2\n");
    expect(summary(check({ config: withoutBack }).problems)).toEqual([
      'warning snapshots/2026-11-07.csv:1 column "gone" is not a Category of the current Configuration: the data is kept but the app ignores it',
    ]);
  });

  it("does not mind a Category added after the snapshot, empty cells or a header-only file", () => {
    put("2026-11-07.csv", "id,name,comm\nana,,\n");
    put("2026-11-08.csv", HEADER + "\n");
    expect(check()).toEqual({ checked: 2, problems: [] });
  });

  it("reports duplicated ids, rows of the wrong length and levels that are not numbers as errors", () => {
    put("2026-11-07.csv", "id,name,comm\nana,Ana,1\nluis,Luis,two\nana,Ana,2\nmar,Mar\nmar2,Mar,1,9\n,Empty,1\n");
    expect(summary(check().problems)).toEqual([
      'error snapshots/2026-11-07.csv:3 level "two" in "comm" is not a non-negative integer',
      'error snapshots/2026-11-07.csv:4 duplicated id "ana" (also on line 2)',
      "error snapshots/2026-11-07.csv:5 has 2 fields and the header has 3",
      "error snapshots/2026-11-07.csv:6 has 4 fields and the header has 3",
      "error snapshots/2026-11-07.csv:7 has an empty id",
    ]);
  });

  it("reports negative and fractional levels as errors", () => {
    put("2026-11-07.csv", "id,comm,pm\nana,-1,1.5\n");
    expect(summary(check().problems).map((line) => line.split(" ")[0])).toEqual(["error", "error"]);
  });

  it("reports a missing id column, a duplicated column and unbalanced quotes as errors", () => {
    put("2026-01-01.csv", "name,comm\nAna,1\n");
    put("2026-01-02.csv", "id,comm,comm\nana,1,1\n");
    put("2026-01-03.csv", 'id,name\nana,"Ana\nluis,Luis\n');
    put("2026-01-04.csv", "");
    expect(summary(check().problems)).toEqual([
      "error snapshots/2026-01-01.csv:1 has no id column",
      'error snapshots/2026-01-02.csv:1 duplicated column "comm"',
      "error snapshots/2026-01-03.csv:2 A quote is opened and never closed",
      "error snapshots/2026-01-04.csv has no header",
    ]);
  });

  it("checks a file name without a valid date, and still checks the other snapshots", () => {
    put("notes.csv", `${HEADER}\n`);
    put("2026-11-07.csv", "id,comm\nana,x\n");
    const problems = summary(check().problems);
    expect(problems[0]).toMatch(/^error snapshots\/2026-11-07\.csv:2 /);
    expect(problems[1]).toMatch(/^error snapshots\/notes\.csv .*2026-11-07\.csv/);
    expect(problems).toHaveLength(2);
  });

  it("ignores README.md and warns about other files that are not snapshots", () => {
    put("README.md", "# Snapshots");
    put("notes.txt", "x");
    expect(summary(check().problems)).toEqual(["warning snapshots/notes.txt is not a snapshot: only .csv files are read"]);
  });

  it("checks one file only", () => {
    put("2026-11-07.csv", "id,comm\nana,x\n");
    put("2026-11-08.csv", "id,comm\nana,y\n");
    const result = check({ file: "2026-11-08.csv" });
    expect(result.checked).toBe(1);
    expect(summary(result.problems)).toEqual(['error snapshots/2026-11-08.csv:2 level "y" in "comm" is not a non-negative integer']);
  });

  it("errors on a file that does not exist", () => {
    expect(() => check({ file: "2020-01-01.csv" })).toThrow("snapshots/2020-01-01.csv");
  });

  it("reads files saved by a spreadsheet: byte-order mark, ;, \\r\\n and any column order", () => {
    put("2026-11-07.csv", `﻿comm;id;name\r\n3;ana;"García; Ana"\r\n`);
    expect(check()).toEqual({ checked: 1, problems: [] });
  });

  it("reports a header that can be split with , or ; in different ways", () => {
    put("2026-11-07.csv", "id,a;id\nx,y\n");
    expect(summary(check().problems)).toEqual([expect.stringMatching(/^error snapshots\/2026-11-07\.csv:1 /)]);
  });

  it("reports a file that is not UTF-8 with the hint to save it as CSV UTF-8", () => {
    put("2026-11-07.csv", Buffer.from("id;name\nana;Garc\xeda\n", "latin1"));
    const problems = summary(check().problems);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^error snapshots\/2026-11-07\.csv is not UTF-8.*CSV UTF-8/);
  });

  it("does not touch the folder", () => {
    put("2026-11-07.csv", "id,comm\nana,x\n");
    const before = readdirSync(snapshots());
    check();
    expect(readdirSync(snapshots())).toEqual(before);
  });
});

describe("readSnapshotRows", () => {
  const rows = () => readSnapshotRows({ root, config });

  it("reads every snapshot in order of file name without .csv, with the Person of each row", () => {
    record({ snapshot: "2027-02-10.csv" });
    record({ snapshot: "2027-02-10-q1-review.csv" });
    record({ snapshot: "2026-11-07.csv" });
    record({ snapshot: "2026-11-07.csv", id: "luis", link: linkOf({ name: "Luis", levels: { comm: 1 } }) });
    const result = rows();
    expect(result.problems).toEqual([]);
    expect(result.checked).toBe(3);
    expect(result.rows.map((row) => `${row.file} ${row.id}`)).toEqual([
      "2026-11-07.csv ana-garcia",
      "2026-11-07.csv luis",
      "2027-02-10.csv ana-garcia",
      "2027-02-10-q1-review.csv ana-garcia",
    ]);
    expect(result.rows[0]).toMatchObject({ label: "snapshots/2026-11-07.csv", date: "2026-11-07", line: 2 });
    expect(result.rows[0].person).toEqual({
      name: "Ana García",
      roleKey: "aswe",
      compareTo: "front",
      tags: ["tech", "design"],
      levels: { comm: 2, pm: 1, back: 0 },
    });
  });

  it("leaves a Category with no column or an empty cell out of the levels, but keeps an explicit 0", () => {
    put("2026-11-07.csv", "id,name,comm,pm\nana,Ana,0,\n");
    expect(rows().rows[0].person.levels).toEqual({ comm: 0 });
  });

  it("reads files saved by a spreadsheet", () => {
    put("2026-11-07.csv", "\ufeffid;name;comm\r\nana;Ana;3\r\n");
    expect(rows().rows[0].person.levels).toEqual({ comm: 3 });
  });

  it("returns the problems and no rows when a snapshot has an error", () => {
    record({ snapshot: "2026-01-10.csv" });
    put("2026-02-10.csv", "id,comm\nana,1\nana,2\n");
    const result = rows();
    expect(result.rows).toEqual([]);
    expect(result.problems.map((problem) => `${problem.severity} ${problem.file}:${problem.line}`)).toEqual([
      "error snapshots/2026-02-10.csv:3",
    ]);
  });

  it("returns the warnings together with the rows", () => {
    put("2026-11-07.csv", "id,name,compare,comm\nana,Ana,ghost,5\n");
    const result = rows();
    expect(result.rows).toHaveLength(1);
    expect(result.problems.map((problem) => problem.severity)).toEqual(["warning", "warning"]);
  });

  it("is empty with no snapshots folder", () => {
    expect(rows()).toEqual({ rows: [], problems: [], checked: 0 });
  });

  describe("narrowed", () => {
    const narrowed = (options: Partial<Parameters<typeof readSnapshotRows>[0]>) => readSnapshotRows({ root, config, ...options });
    const ids = (result: ReturnType<typeof readSnapshotRows>) => result.rows.map((row) => `${row.date} ${row.id}`);
    beforeEach(() => {
      for (const snapshot of ["2026-01-10.csv", "2026-02-10.csv", "2026-03-10.csv"]) {
        record({ snapshot });
        record({ snapshot, id: "luis" });
      }
    });

    it("to the given files, in snapshot order", () => {
      expect(ids(narrowed({ files: ["2026-03-10.csv", "2026-01-10.csv"], id: "luis" }))).toEqual(["2026-01-10 luis", "2026-03-10 luis"]);
    });

    it("to one Person id", () => {
      expect(ids(narrowed({ id: "luis" }))).toEqual(["2026-01-10 luis", "2026-02-10 luis", "2026-03-10 luis"]);
      expect(narrowed({ id: "nobody" }).rows).toEqual([]);
    });

    it("to a period, with both ends included", () => {
      expect(ids(narrowed({ from: "2026-02-10", to: "2026-03-10", id: "ana-garcia" }))).toEqual(["2026-02-10 ana-garcia", "2026-03-10 ana-garcia"]);
      expect(ids(narrowed({ to: "2026-01-10", id: "luis" }))).toEqual(["2026-01-10 luis"]);
      expect(ids(narrowed({ from: "2026-03-10", id: "luis" }))).toEqual(["2026-03-10 luis"]);
      expect(narrowed({ from: "2026-04-01" }).rows).toEqual([]);
    });

    it("combining the filters", () => {
      expect(ids(narrowed({ files: ["2026-01-10.csv", "2026-03-10.csv"], from: "2026-02-01", id: "luis" }))).toEqual(["2026-03-10 luis"]);
    });

    it("without reading the errors of a snapshot that is left out", () => {
      put("2026-04-10.csv", "id,comm\nana,1\nana,2\n");
      expect(narrowed({ files: ["2026-01-10.csv"] }).problems).toEqual([]);
      expect(narrowed({ to: "2026-03-31" }).problems).toEqual([]);
      expect(narrowed({}).problems).toHaveLength(1);
    });

    it("refusing a file that does not exist, a path and a date that is not one", () => {
      expect(() => narrowed({ files: ["2020-01-01.csv"] })).toThrow(/snapshots\/2020-01-01\.csv does not exist/);
      expect(() => narrowed({ files: ["../x.csv"] })).toThrow(SnapshotError);
      expect(() => narrowed({ from: "yesterday" })).toThrow(/--from "yesterday" is not a date/);
      expect(() => narrowed({ to: "2026-13-01" })).toThrow(/--to/);
    });
  });
});
