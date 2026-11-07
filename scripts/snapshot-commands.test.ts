// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config";
import { parseState } from "../src/urlState";
import { runSnapshotCommand } from "./snapshot-commands";

// These tests run the commands against the resolved configuration of the project, as the npm scripts do.
let root: string;
let out: string[];
let err: string[];

const run = (...argv: string[]) =>
  runSnapshotCommand(argv, {
    root,
    env: {},
    io: { out: (line) => out.push(line), err: (line) => err.push(line) },
    today: new Date(2026, 10, 7),
  });
const file = (name: string) => readFileSync(join(root, "snapshots", name), "utf8");

const config = loadConfig();
const keys = config.categories.map((category) => category.key);
const ANA_LINK = `http://localhost:5173/#name=Ana+Garc%C3%ADa&tag=tech&tag=design&${keys.map((key, i) => `${key}=${i % 2}`).join("&")}`;

beforeEach(() => {
  // The project root is a sub-folder, so that "../" stays inside the temporary folder.
  root = join(mkdtempSync(join(tmpdir(), "radar-commands-")), "project");
  mkdirSync(root);
  out = [];
  err = [];
});
afterEach(() => rmSync(join(root, ".."), { recursive: true, force: true }));

describe("snapshot:record", () => {
  it("creates today's snapshot and prints the row written", () => {
    expect(run("record", ANA_LINK, "--id", "ana-garcia")).toBe(0);
    const lines = file("2026-11-07.csv").split("\n");
    expect(lines[0]).toBe(`id,name,role,compare,tags,${keys.join(",")}`);
    expect(lines[1]).toBe(`ana-garcia,Ana García,,,tech|design,${keys.map((_, i) => i % 2).join(",")}`);
    expect(out.join("\n")).toContain("Recorded ana-garcia in snapshots/2026-11-07.csv (new file, line 2)");
    expect(out.join("\n")).toContain(lines[1]);
    expect(err).toEqual([]);
  });

  it("prints the Ignored fields of the link", () => {
    expect(run("record", `${ANA_LINK}&pm-gone=3`, "--id", "ana-garcia", "--snapshot", "2026-11-08.csv")).toBe(0);
    expect(out.join("\n")).toContain("Ignored in the link: pm-gone");
  });

  it("says when a snapshot appended to has no column for a current Category", () => {
    mkdirSync(join(root, "snapshots"));
    writeFileSync(join(root, "snapshots", "2026-11-07.csv"), "id,name\nluis,Luis\n");
    expect(run("record", ANA_LINK, "--id", "ana-garcia")).toBe(0);
    expect(out.join("\n")).toContain(`snapshots/2026-11-07.csv has no column for: ${keys.join(", ")}`);
  });

  it("fails with a message and writes nothing for an invalid link, id or name", () => {
    expect(run("record", "http://localhost:5173/#foo=1", "--id", "ana")).toBe(1);
    expect(err.join("\n")).toContain("it has no field this app knows");
    expect(run("record", ANA_LINK, "--id", "ana garcia")).toBe(1);
    expect(run("record", ANA_LINK, "--id", "ana", "--snapshot", "notes.csv")).toBe(1);
    expect(err.join("\n")).toContain("2026-11-07.csv");
    expect(() => file("2026-11-07.csv")).toThrow();
  });

  it("asks for the link and the id", () => {
    expect(run("record", "--id", "ana")).toBe(1);
    expect(err.join("\n")).toContain("Share link");
    err = [];
    expect(run("record", ANA_LINK)).toBe(1);
    expect(err.join("\n")).toContain("--id");
  });

  it("writes in the folder of PROGRESSION_RADAR_SNAPSHOTS_DIR", () => {
    const code = runSnapshotCommand(["record", ANA_LINK, "--id", "ana"], {
      root,
      env: { PROGRESSION_RADAR_SNAPSHOTS_DIR: "../elsewhere" },
      io: { out: (line) => out.push(line), err: (line) => err.push(line) },
      today: new Date(2026, 10, 7),
    });
    expect(code).toBe(0);
    expect(readFileSync(join(root, "..", "elsewhere", "2026-11-07.csv"), "utf8")).toContain("ana,Ana García");
  });
});

describe("snapshot:link", () => {
  beforeEach(() => {
    run("record", ANA_LINK, "--id", "ana-garcia", "--snapshot", "2026-11-07.csv");
    out = [];
  });

  it("prints only the Share link on stdout", () => {
    expect(run("link", "2026-11-07.csv", "ana-garcia")).toBe(0);
    expect(out).toHaveLength(1);
    const url = new URL(out[0]);
    expect(url.origin + url.pathname).toBe("http://localhost:5173/");
    const state = parseState({ search: url.search, hash: url.hash }, config);
    expect(state).toMatchObject({ kind: "ok", issues: [], person: { name: "Ana García", tags: ["tech", "design"] } });
  });

  it("builds the link on --base", () => {
    expect(run("link", "2026-11-07.csv", "ana-garcia", "--base", "https://radar.example.com/")).toBe(0);
    expect(out[0].startsWith("https://radar.example.com/#")).toBe(true);
  });

  it("prints nothing on stdout for an unknown id and names the id and file", () => {
    expect(run("link", "2026-11-07.csv", "luis")).toBe(1);
    expect(out).toEqual([]);
    expect(err.join("\n")).toMatch(/"luis".*snapshots\/2026-11-07\.csv/);
  });

  it("says on stderr which columns the app will ignore", () => {
    writeFileSync(join(root, "snapshots", "2026-11-09.csv"), "id,name,gone\nluis,Luis,3\n");
    expect(run("link", "2026-11-09.csv", "luis")).toBe(0);
    expect(new URL(out[0]).hash).toContain("gone=3");
    expect(err.join("\n")).toContain('"gone"');
    expect(err.join("\n")).toContain("ignore");
  });

  it("asks for the snapshot and the id", () => {
    expect(run("link", "2026-11-07.csv")).toBe(1);
    expect(err.join("\n")).toContain("snapshot:link");
  });
});

describe("snapshot:check", () => {
  it("prints each problem with file, line and severity, then a summary, and fails only on errors", () => {
    mkdirSync(join(root, "snapshots"));
    writeFileSync(join(root, "snapshots", "2026-11-07.csv"), "id,gone\nana,1\nana,2\n");
    expect(run("check")).toBe(1);
    expect(out).toEqual([
      'snapshots/2026-11-07.csv:1: warning: column "gone" is not a Category of the current Configuration: the data is kept but the app ignores it',
      'snapshots/2026-11-07.csv:3: error: duplicated id "ana" (also on line 2)',
      "Checked 1 snapshot: 1 error, 1 warning.",
    ]);
  });

  it("exits 0 when there are only warnings", () => {
    mkdirSync(join(root, "snapshots"));
    writeFileSync(join(root, "snapshots", "2026-11-07.csv"), "id,gone\nana,1\n");
    expect(run("check")).toBe(0);
    expect(out.at(-1)).toBe("Checked 1 snapshot: 0 errors, 1 warning.");
  });

  it("checks one file", () => {
    mkdirSync(join(root, "snapshots"));
    writeFileSync(join(root, "snapshots", "2026-11-07.csv"), "id\nana\n");
    expect(run("check", "2026-11-07.csv")).toBe(0);
    expect(out).toEqual(["Checked 1 snapshot: 0 errors, 0 warnings."]);
  });

  it("says there is nothing to check without a snapshots folder", () => {
    expect(run("check")).toBe(0);
    expect(out).toEqual(["No snapshots to check in snapshots/."]);
  });

  it("fails with a message for a file that does not exist", () => {
    expect(run("check", "2020-01-01.csv")).toBe(1);
    expect(err.join("\n")).toContain("snapshots/2020-01-01.csv");
  });
});

describe("a Configuration with problems", () => {
  it("fails and lists the problems instead of reading snapshots against it", () => {
    const code = runSnapshotCommand(["check"], {
      root,
      env: {},
      io: { out: (line) => out.push(line), err: (line) => err.push(line) },
      loadConfig: () => {
        throw new ConfigError(['config/categories/01-id.md: the category key "id" is reserved by the snapshots']);
      },
    });
    expect(code).toBe(1);
    expect(err.join("\n")).toContain('config/categories/01-id.md: the category key "id" is reserved by the snapshots');
  });
});

describe("usage", () => {
  it("fails with the list of commands for an unknown command or option", () => {
    expect(run("remove")).toBe(1);
    expect(err.join("\n")).toContain("snapshot:record");
    err = [];
    expect(run("check", "--force")).toBe(1);
    expect(err.join("\n")).toContain("--force");
  });
});
