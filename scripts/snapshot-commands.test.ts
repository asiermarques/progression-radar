// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    packageRoot: process.cwd(),
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

describe("snapshot:report", () => {
  const report = (name = "2026-11-07.html") => readFileSync(join(root, "reports", name), "utf8");
  const record = (snapshot: string, link = ANA_LINK, id = "ana-garcia") => run("record", link, "--id", id, "--snapshot", snapshot);
  const higher = (n: number) => `http://localhost:5173/#name=Ana+Garc%C3%ADa&${keys.map((key) => `${key}=${n}`).join("&")}`;

  it("writes reports/<today>.html with the Persons' evolution and prints only its path", () => {
    record("2026-11-09.csv", higher(1));
    record("2027-02-10.csv", higher(2));
    out = [];
    expect(run("report")).toBe(0);
    expect(out).toEqual(["reports/2026-11-07.html"]);
    expect(err).toEqual([]);
    const html = report();
    expect(html).toContain("Ana García");
    expect(html).toContain('<th scope="col" class="report-num">2026-11-09</th>');
    expect(html).toContain('<th scope="col" class="report-num">2027-02-10</th>');
    for (const category of config.categories) expect(html).toContain(category.name.replace(/&/g, "&amp;"));
  });

  it("replaces the report of the same day when it is generated again", () => {
    record("2026-11-09.csv");
    run("report");
    writeFileSync(join(root, "reports", "2026-11-07.html"), "old");
    expect(run("report")).toBe(0);
    expect(report()).toContain("<!doctype html>");
  });

  it("has the custom properties of the app and then the resolved theme.css, and no script", () => {
    record("2026-11-09.csv");
    run("report");
    const html = report();
    expect(html).toContain("--color-person:");
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("default-src 'none'");
    const theme = readFileSync(join(process.cwd(), "config.example", "theme.css"), "utf8");
    expect(html.indexOf("--color-person:")).toBeLessThan(html.indexOf(theme.slice(0, 40).replace(/</g, "")));
  });

  it("embeds the fonts the app loads, so it looks the same and still makes no request", () => {
    record("2026-11-09.csv");
    run("report");
    const html = report();
    expect(html).toContain("font-family: 'Shippori Mincho'");
    expect(html).toContain("font-family: 'Zen Kaku Gothic New'");
    expect(html).toMatch(/src: url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{1000,}\) format\('woff2'\);/);
    expect(html).not.toMatch(/url\(\.\/files|\.woff\)/);
    expect(html).toContain("font-src data:");
  });

  it("reads the theme.css of the Config folder before the example one", () => {
    mkdirSync(join(root, "config"));
    writeFileSync(join(root, "config", "theme.css"), ":root { --color-person: hotpink; }");
    record("2026-11-09.csv");
    run("report");
    expect(report()).toContain("--color-person: hotpink;");
  });

  it("draws the radar of each Person as inline SVG, styled with the app's radar rules and then the theme", () => {
    mkdirSync(join(root, "config"));
    writeFileSync(join(root, "config", "theme.css"), ":root { --color-person: hotpink; }");
    record("2026-11-09.csv", higher(1));
    record("2027-02-10.csv", higher(2));
    run("report");
    const html = report();
    expect(html.match(/<svg[^>]*role="img"/g)).toHaveLength(1);
    expect(html).toContain("radar-series radar-series--person");
    expect(html).toContain("radar-series radar-series--compare");
    expect(html).not.toMatch(/<script/i);
    expect(html.indexOf(".radar-area {")).toBeGreaterThan(-1);
    expect(html.indexOf(".radar-area {")).toBeLessThan(html.indexOf("--color-person: hotpink;"));
    expect(html).not.toContain(".category-panel");
  });

  it("shows a Category the Snapshot has no column for as not recorded, not as level 0", () => {
    mkdirSync(join(root, "snapshots"));
    writeFileSync(join(root, "snapshots", "2026-11-09.csv"), `id,name,${keys[0]}\nana,Ana,2\n`);
    expect(run("report")).toBe(0);
    const html = report();
    expect(html).toContain("not recorded");
    expect(html).toContain(`1 of ${keys.length} categories`);
  });

  it("escapes the name of a Person", () => {
    mkdirSync(join(root, "snapshots"));
    writeFileSync(join(root, "snapshots", "2026-11-09.csv"), `id,name,${keys[0]}\nana,<script>alert(1)</script>,2\n`);
    expect(run("report")).toBe(0);
    expect(report()).not.toMatch(/<script/i);
    expect(report()).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("prints the warnings and lists them in the report", () => {
    mkdirSync(join(root, "snapshots"));
    writeFileSync(join(root, "snapshots", "2026-11-09.csv"), `id,name,gone\nana,Ana,1\n`);
    expect(run("report")).toBe(0);
    expect(out).toEqual(["reports/2026-11-07.html"]);
    expect(err.join("\n")).toContain("snapshots/2026-11-09.csv:1: warning: column \"gone\"");
    expect(report()).toContain("snapshots/2026-11-09.csv:1");
  });

  it("fails with the errors, file and line, and writes no file", () => {
    mkdirSync(join(root, "snapshots"));
    writeFileSync(join(root, "snapshots", "2026-11-09.csv"), "id,name\nana,Ana\nana,Ana\n");
    expect(run("report")).toBe(1);
    expect(out).toEqual([]);
    expect(err.join("\n")).toContain('snapshots/2026-11-09.csv:3: error: duplicated id "ana"');
    expect(existsSync(join(root, "reports"))).toBe(false);
  });

  it("explains that there is no row to report, and writes no file, for an empty or missing Snapshots folder", () => {
    expect(run("report")).toBe(1);
    expect(err.join("\n")).toContain("no row to report in snapshots/");
    mkdirSync(join(root, "snapshots"));
    writeFileSync(join(root, "snapshots", "2026-11-09.csv"), "id,name\n");
    err = [];
    expect(run("report")).toBe(1);
    expect(err.join("\n")).toContain("no row to report");
    expect(existsSync(join(root, "reports"))).toBe(false);
  });

  it("fails for an invalid Configuration, like the other commands", () => {
    const code = runSnapshotCommand(["report"], {
      root,
      env: {},
      io: { out: (line) => out.push(line), err: (line) => err.push(line) },
      loadConfig: () => {
        throw new ConfigError(["config/roles.yml: broken"]);
      },
    });
    expect(code).toBe(1);
    expect(err.join("\n")).toContain("config/roles.yml: broken");
  });

  describe("narrowing and the output path", () => {
    const person = (name: string) => `http://localhost:5173/#name=${name}&${keys.map((key) => `${key}=1`).join("&")}`;
    beforeEach(() => {
      for (const snapshot of ["2026-11-09.csv", "2027-02-10.csv", "2027-05-12.csv"]) {
        record(snapshot, person("Asier"), "asier");
        record(snapshot, person("Ana"), "ana-garcia");
      }
      out = [];
    });
    const columns = (html: string) =>
      [...html.matchAll(/<th scope="col" class="report-num">(\d{4}-\d{2}-\d{2})<\/th>/g)].map((match) => match[1]);

    it("to one Person", () => {
      expect(run("report", "--id", "asier")).toBe(0);
      const html = report();
      expect(html).toContain("<h3>Asier</h3>");
      expect(html).not.toContain("<h3>Ana</h3>");
    });

    it("to a period, both ends included", () => {
      expect(run("report", "--from", "2027-02-10", "--to", "2027-05-12")).toBe(0);
      expect([...new Set(columns(report()))]).toEqual(["2027-02-10", "2027-05-12"]);
    });

    it("to the snapshots given", () => {
      expect(run("report", "2026-11-09.csv", "2027-05-12.csv")).toBe(0);
      expect([...new Set(columns(report()))]).toEqual(["2026-11-09", "2027-05-12"]);
    });

    it("writes to --out and prints that path", () => {
      expect(run("report", "--id", "asier", "--out", "reports/asier.html")).toBe(0);
      expect(out).toEqual(["reports/asier.html"]);
      expect(report("asier.html")).toContain("<h3>Asier</h3>");
      expect(existsSync(join(root, "reports", "2026-11-07.html"))).toBe(false);
    });

    it("creates the folder of --out", () => {
      expect(run("report", "--out", "out/q1/report.html")).toBe(0);
      expect(readFileSync(join(root, "out", "q1", "report.html"), "utf8")).toContain("<!doctype html>");
    });

    it("refuses --out inside the Snapshots folder or dist/, and writes nothing", () => {
      for (const path of ["snapshots/report.html", "snapshots/sub/../report.html", "dist/report.html", "./dist/a/b.html"]) {
        err = [];
        expect(run("report", "--out", path)).toBe(1);
        expect(err.join("\n")).toMatch(/Snapshots folder|dist\//);
      }
      expect(existsSync(join(root, "snapshots", "report.html"))).toBe(false);
      expect(existsSync(join(root, "dist"))).toBe(false);
    });

    it("refuses --out inside a Snapshots folder set with PROGRESSION_RADAR_SNAPSHOTS_DIR", () => {
      const code = runSnapshotCommand(["report", "--out", "elsewhere/x.html"], {
        root,
        env: { PROGRESSION_RADAR_SNAPSHOTS_DIR: "elsewhere" },
        io: { out: (line) => out.push(line), err: (line) => err.push(line) },
      });
      expect(code).toBe(1);
      expect(err.join("\n")).toContain("Snapshots folder");
    });

    it("explains that no row matches, and writes no file, for an unknown Person id or an empty period", () => {
      for (const args of [["--id", "nobody"], ["--from", "2030-01-01"], ["--id", "asier", "--to", "2020-01-01"]]) {
        err = [];
        expect(run("report", ...args)).toBe(1);
        expect(err.join("\n")).toContain("no row to report");
      }
      expect(existsSync(join(root, "reports"))).toBe(false);
    });

    it("fails for a snapshot that does not exist or a date that is not one", () => {
      expect(run("report", "2020-01-01.csv")).toBe(1);
      expect(err.join("\n")).toContain("snapshots/2020-01-01.csv does not exist");
      err = [];
      expect(run("report", "--from", "tomorrow")).toBe(1);
      expect(err.join("\n")).toContain("--from");
    });

    it("lists the options in the usage", () => {
      expect(run("report", "--snapshot", "x.csv")).toBe(1);
      expect(err.join("\n")).toContain("--out");
    });
  });

  describe("team overview", () => {
    const person = (name: string, level: number) => `http://localhost:5173/#name=${name}&${keys.map((key) => `${key}=${level}`).join("&")}`;
    const team = (html: string) => html.slice(html.indexOf('aria-labelledby="team-overview"'), html.indexOf('aria-labelledby="evolution"'));

    it("shows each Person at their latest row in any Snapshot, with its date", () => {
      record("2026-11-09.csv", person("Ana", 1), "ana-garcia");
      record("2026-11-09.csv", person("Asier", 1), "asier");
      record("2027-02-10.csv", person("Asier", 2), "asier");
      expect(run("report")).toBe(0);
      const html = team(report());
      expect(html).toContain('<a href="#person-ana-garcia">Ana</a><small>2026-11-09');
      expect(html).toContain('<a href="#person-asier">Asier</a><small>2027-02-10');
    });

    it("uses the snapshot that sorts last when two have the same date", () => {
      record("2027-02-10.csv", person("Asier", 1), "asier");
      record("2027-02-10-q1-review.csv", person("Asier", 2), "asier");
      run("report");
      expect(team(report())).toContain("<small>2027-02-10-q1-review");
    });

    it("has the Role gap of --compare and not recorded cells, and follows the filters", () => {
      mkdirSync(join(root, "snapshots"));
      writeFileSync(join(root, "snapshots", "2026-11-09.csv"), `id,name,${keys[0]}\nana,Ana,1\nasier,Asier,2\n`);
      expect(run("report", "--compare", config.roles[0].key, "--id", "asier")).toBe(0);
      const html = team(report());
      expect(html).toContain("not recorded");
      expect(html).toContain(`Role gap against ${config.roles[0].name.replace(/&/g, "&amp;")}`);
      expect(html).toContain(`covers 1 of ${keys.length} categories`);
      expect(html).not.toContain(">Ana<");
    });
  });

  describe("role gap", () => {
    const [first, second] = config.roles;
    const withCompare = (compare: string) => `${higher(1)}&compare=${compare}`;

    it("shows the Role gap of each row against its own Compared role, and none for a row without one", () => {
      mkdirSync(join(root, "snapshots"));
      writeFileSync(join(root, "snapshots", "2026-11-09.csv"), `id,name,compare,${keys[0]}\nana,Ana,${first.key},1\nluis,Luis,,1\n`);
      expect(run("report")).toBe(0);
      const html = report();
      expect(html).toContain(first.name.replace(/&/g, "&amp;"));
      // Luis, in the Team overview and in his own table
      expect(html.match(/no role to compare/g)).toHaveLength(2);
      expect(html).not.toContain("Role gap against");
    });

    it("uses the role of --compare for every row, whatever its own", () => {
      record("2026-11-09.csv", withCompare(first.key));
      expect(run("report", "--compare", second.key)).toBe(0);
      const html = report();
      expect(html).toContain(`Role gap against ${second.name.replace(/&/g, "&amp;")}`);
      expect(html).not.toContain("no role to compare");
    });

    it("fails naming the unknown role, listing the roles, and writes no file", () => {
      record("2026-11-09.csv");
      expect(run("report", "--compare", "nope")).toBe(1);
      expect(err.join("\n")).toContain('"nope"');
      expect(err.join("\n")).toContain(first.key);
      expect(existsSync(join(root, "reports"))).toBe(false);
    });

    it("warns about a Compared role of a row that is not a role any more, and shows no Role gap for it", () => {
      mkdirSync(join(root, "snapshots"));
      writeFileSync(join(root, "snapshots", "2026-11-09.csv"), `id,name,compare,${keys[0]}\nana,Ana,ghost,1\n`);
      expect(run("report")).toBe(0);
      expect(err.join("\n")).toContain('snapshots/2026-11-09.csv:2: warning: compare "ghost" is not a role');
      expect(report()).toContain("no role to compare");
    });

    it("asks for the role after --compare", () => {
      expect(run("report", "--compare")).toBe(1);
      expect(err.join("\n")).toContain("--compare");
    });
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
