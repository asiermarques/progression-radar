// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GUIDES, guidesUrl, InitError, initAdopterRepository, SCRIPTS } from "./init";

let base: string;
let packageRoot: string;
let cwd: string;
let lines: string[];

const put = (root: string, file: string, content: string) => {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeFileSync(join(root, file), content);
};
const init = () => initAdopterRepository({ cwd, packageRoot, log: (line) => lines.push(line) });
const scripts = () => JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")).scripts;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "radar-init-"));
  packageRoot = join(base, "radar");
  cwd = join(base, "ladder");
  lines = [];
  put(packageRoot, "config.example/roles.yml", "roles");
  put(packageRoot, "config.example/site.yml", "site");
  put(packageRoot, "config.example/categories/01-build.md", "build");
  put(packageRoot, "package.json", JSON.stringify({ name: "progression-radar", version: "1.3.0", repository: { type: "git", url: "git+https://github.com/asiermarques/progression-radar.git" } }));
  put(packageRoot, ".claude/skills/progression-radar-report/SKILL.md", "report skill");
  mkdirSync(cwd);
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "ladder", dependencies: { "progression-radar": "^1.0.0" } }));
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("init", () => {
  it("copies the whole sample configuration to config/", () => {
    init();
    expect(readFileSync(join(cwd, "config", "roles.yml"), "utf8")).toBe("roles");
    expect(readFileSync(join(cwd, "config", "categories", "01-build.md"), "utf8")).toBe("build");
    expect(lines.join("\n")).toContain("config/");
  });

  it("never overwrites a file already in config/", () => {
    put(cwd, "config/roles.yml", "mine");
    init();
    expect(readFileSync(join(cwd, "config", "roles.yml"), "utf8")).toBe("mine");
    expect(readFileSync(join(cwd, "config", "site.yml"), "utf8")).toBe("site");
    expect(lines.join("\n")).toContain("config/roles.yml already exists, kept");
  });

  it("adds the scripts that are missing and keeps the existing ones", () => {
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "ladder", scripts: { build: "mine", test: "x" } }));
    init();
    expect(scripts()).toEqual({ ...SCRIPTS, build: "mine", test: "x" });
  });

  it("declares the scripts of a fork, each calling progression-radar", () => {
    expect(Object.keys(SCRIPTS)).toEqual([
      "dev",
      "build",
      "preview",
      "check",
      "snapshot:record",
      "snapshot:link",
      "snapshot:check",
      "snapshot:report",
      "config:convert-categories",
    ]);
    expect(SCRIPTS["snapshot:report"]).toBe("progression-radar snapshot report");
    expect(SCRIPTS["snapshot:record"]).toBe("progression-radar snapshot record");
  });

  it("can be run twice", () => {
    init();
    lines = [];
    init();
    expect(lines.join("\n")).not.toContain("Copied");
  });

  it("fails without a package.json, writing nothing", () => {
    rmSync(join(cwd, "package.json"));
    expect(init).toThrow(InitError);
    expect(existsSync(join(cwd, "config"))).toBe(false);
  });

  it("fails when config/ is not a folder", () => {
    put(cwd, "config", "file");
    expect(init).toThrow(InitError);
  });
});

describe("init and .gitignore", () => {
  const gitignore = () => readFileSync(join(cwd, ".gitignore"), "utf8");

  it("creates .gitignore with reports/ when there is none, and says so", () => {
    init();
    expect(gitignore()).toBe("reports/\n");
    expect(lines.join("\n")).toContain("reports/");
    expect(lines.join("\n")).toContain(".gitignore");
  });

  it("appends reports/ to an existing .gitignore, keeping every other line as it was", () => {
    writeFileSync(join(cwd, ".gitignore"), "node_modules\ndist\n");
    init();
    expect(gitignore()).toBe("node_modules\ndist\nreports/\n");
  });

  it("adds the line break a .gitignore without a final one needs, and keeps its line breaks", () => {
    writeFileSync(join(cwd, ".gitignore"), "node_modules");
    init();
    expect(gitignore()).toBe("node_modules\nreports/\n");
    writeFileSync(join(cwd, ".gitignore"), "node_modules\r\ndist\r\n");
    init();
    expect(gitignore()).toBe("node_modules\r\ndist\r\nreports/\r\n");
  });

  it("does not change a .gitignore that already ignores reports/, written any usual way", () => {
    for (const content of ["reports/\n", "node_modules\n/reports\n", "reports\n", "/reports/\n", "reports/**\n"]) {
      writeFileSync(join(cwd, ".gitignore"), content);
      lines = [];
      init();
      expect(gitignore()).toBe(content);
      expect(lines.join("\n")).not.toContain(".gitignore");
    }
  });

  it("is not fooled by a commented line or by a negation", () => {
    writeFileSync(join(cwd, ".gitignore"), "# reports/\n");
    init();
    expect(gitignore()).toBe("# reports/\nreports/\n");
  });

  it("fails, writing nothing, when .gitignore is not a file", () => {
    mkdirSync(join(cwd, ".gitignore"));
    expect(init).toThrow(InitError);
    expect(existsSync(join(cwd, "config"))).toBe(false);
  });
});

describe("init, the README and the skills", () => {
  const readme = () => readFileSync(join(cwd, "README.md"), "utf8");

  it("writes a README.md that links to every guide of the installed version on GitHub", () => {
    init();
    for (const [file, title] of GUIDES) {
      expect(readme()).toContain(`[${title}](https://github.com/asiermarques/progression-radar/blob/v1.3.0/docs/guides/${file})`);
    }
    expect(lines.join("\n")).toContain("Created README.md");
  });

  it("links only to guides that exist in the radar", () => {
    const radar = join(__dirname, "..");
    for (const [file] of GUIDES) expect(existsSync(join(radar, "docs", "guides", file)), file).toBe(true);
    expect(guidesUrl(radar)).toMatch(/^https:\/\/github\.com\/asiermarques\/progression-radar\/blob\/v\d+\.\d+\.\d+\/docs\/guides$/);
  });

  it("never overwrites an existing README.md", () => {
    writeFileSync(join(cwd, "README.md"), "# Mine\n");
    init();
    expect(readme()).toBe("# Mine\n");
    expect(lines.join("\n")).toContain("README.md already exists, kept");
  });

  it("copies the skills for Claude Code to .claude/skills/", () => {
    init();
    expect(readFileSync(join(cwd, ".claude", "skills", "progression-radar-report", "SKILL.md"), "utf8")).toBe("report skill");
    expect(lines.join("\n")).toContain("progression-radar-report");
  });
});
