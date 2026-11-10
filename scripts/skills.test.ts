// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copySkills, skillsWarning } from "./skills";

let base: string;
let packageRoot: string;
let cwd: string;
let lines: string[];

const put = (root: string, file: string, content: string) => {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeFileSync(join(root, file), content);
};
const read = (file: string) => readFileSync(join(cwd, ".claude", "skills", file), "utf8");
const copy = () => copySkills({ cwd, packageRoot, log: (line) => lines.push(line) });

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "radar-skills-"));
  packageRoot = join(base, "radar");
  cwd = join(base, "ladder");
  lines = [];
  put(packageRoot, ".claude/skills/progression-radar-report/SKILL.md", "report v2");
  put(packageRoot, ".claude/skills/progression-radar-snapshots/SKILL.md", "snapshots v2");
  put(packageRoot, ".claude/skills/progression-radar-snapshots/references/format.md", "format");
  mkdirSync(cwd);
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("copySkills", () => {
  it("copies every shipped skill with its files to .claude/skills/ and asks to commit them", () => {
    copy();
    expect(read("progression-radar-report/SKILL.md")).toBe("report v2");
    expect(read("progression-radar-snapshots/references/format.md")).toBe("format");
    expect(lines.join("\n")).toMatch(/Copied .*progression-radar-report, progression-radar-snapshots\. Commit them\./);
  });

  it("replaces a previous copy whole, dropping the files the new version no longer has", () => {
    put(cwd, ".claude/skills/progression-radar-report/SKILL.md", "report v1");
    put(cwd, ".claude/skills/progression-radar-report/old.md", "old");
    copy();
    expect(read("progression-radar-report/SKILL.md")).toBe("report v2");
    expect(existsSync(join(cwd, ".claude/skills/progression-radar-report/old.md"))).toBe(false);
  });

  it("removes the copies of skills the radar no longer ships, and leaves the other skills alone", () => {
    put(cwd, ".claude/skills/progression-radar-gone/SKILL.md", "gone");
    put(cwd, ".claude/skills/our-own/SKILL.md", "ours");
    copy();
    expect(existsSync(join(cwd, ".claude/skills/progression-radar-gone"))).toBe(false);
    expect(read("our-own/SKILL.md")).toBe("ours");
    expect(lines.join("\n")).toContain("no longer ships: progression-radar-gone");
  });

  it("says when the skills are up to date", () => {
    copy();
    lines = [];
    copy();
    expect(lines).toEqual(["The skills in .claude/skills/ are up to date."]);
  });

  it("does nothing in a fork, where the skills already are", () => {
    copySkills({ cwd: packageRoot, packageRoot, log: (line) => lines.push(line) });
    expect(readFileSync(join(packageRoot, ".claude/skills/progression-radar-report/SKILL.md"), "utf8")).toBe("report v2");
    expect(lines.join("\n")).toContain("already");
  });
});

describe("skillsWarning", () => {
  const warning = () => skillsWarning({ cwd, packageRoot });

  it("is silent when the repository has no skills of the radar, or a fork", () => {
    expect(warning()).toBeUndefined();
    expect(skillsWarning({ cwd: packageRoot, packageRoot })).toBeUndefined();
  });

  it("is silent when the copies match the installed radar", () => {
    copy();
    expect(warning()).toBeUndefined();
  });

  it("names the skills that changed, are missing or are no longer shipped, and how to update them", () => {
    copy();
    put(cwd, ".claude/skills/progression-radar-report/SKILL.md", "report v1");
    rmSync(join(cwd, ".claude/skills/progression-radar-snapshots"), { recursive: true });
    put(cwd, ".claude/skills/progression-radar-gone/SKILL.md", "gone");
    expect(warning()).toBe(
      "The skills in .claude/skills/ do not match the installed radar (progression-radar-report, progression-radar-snapshots, progression-radar-gone): run `npx progression-radar skills` and commit the result.",
    );
  });
});
