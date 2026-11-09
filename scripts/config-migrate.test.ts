// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error: a plain Node script, written in JavaScript so `node` runs it without a build step
import { MigrationError, migrate } from "./config-migrate.mjs";
import { convertCategories } from "./convert-categories";

let repo: string;
let output: string[];

const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const write = (path: string, content: string) => {
  mkdirSync(join(repo, path, ".."), { recursive: true });
  writeFileSync(join(repo, path), content);
};
const read = (path: string) => readFileSync(join(repo, path), "utf8");
const run = (options: Record<string, unknown> = {}) =>
  migrate({ cwd: repo, yes: true, convert: convertCategories, log: (line: string) => output.push(line), ...options });

/**
 * A fork after pulling the update: upstream/master has config.example/ with its own content, and the fork's last
 * commit has the fork's edits in config.example/ (git moved them there when it detected the rename).
 */
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "radar-migrate-"));
  output = [];
  git("init", "-q", "-b", "master");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  git("config", "commit.gpgsign", "false");
  write("config.example/categories.yml", "upstream categories\n");
  write("config.example/roles.yml", "upstream roles\n");
  write("config.example/theme.css", "/* upstream theme */\n");
  write("config/README.md", "readme\n");
  git("add", "-A");
  git("commit", "-q", "-m", "upstream");
  git("update-ref", "refs/remotes/upstream/master", "HEAD");
  write("config.example/categories.yml", "fork categories\n");
  write("config.example/theme.css", "/* fork theme */\n");
  write("config.example/logo.svg", "<svg/>\n");
  git("add", "-A");
  git("commit", "-q", "-m", "fork");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("migrate", () => {
  it("lists the files the fork changed or added, and changes nothing in a dry run", async () => {
    const result = await run({ dryRun: true });
    expect(result.files).toEqual(["categories.yml", "logo.svg", "theme.css"]);
    expect(output.join("\n")).toMatch(/categories\.yml/);
    expect(output.join("\n")).not.toMatch(/roles\.yml/);
    expect(read("config.example/categories.yml")).toBe("fork categories\n");
    expect(existsSync(join(repo, "config/categories.yml"))).toBe(false);
    expect(git("status", "--porcelain")).toBe("");
  });

  it("moves them to config/, restores config.example/ and stages nothing", async () => {
    await run();
    expect(read("config/categories.yml")).toBe("fork categories\n");
    expect(read("config/theme.css")).toBe("/* fork theme */\n");
    expect(read("config/logo.svg")).toBe("<svg/>\n");
    expect(read("config.example/categories.yml")).toBe("upstream categories\n");
    expect(read("config.example/theme.css")).toBe("/* upstream theme */\n");
    expect(existsSync(join(repo, "config.example/logo.svg"))).toBe(false);
    expect(git("diff", "--cached", "--name-only")).toBe("");
    expect(git("diff", "--name-only", "upstream/master", "--", "config.example")).toBe("");
  });

  it("moves a categories.yml that upstream no longer ships, and leaves the new categories/ folder alone", async () => {
    // Upstream replaced config.example/categories.yml with config.example/categories/; the fork kept its own file
    // when it resolved the modify/delete conflict.
    git("checkout", "-q", "upstream/master", "--detach");
    git("rm", "-q", "config.example/categories.yml");
    write("config.example/categories/01-a.md", "---\nkey: a\nname: A\n---\n");
    git("add", "-A");
    git("commit", "-q", "-m", "upstream: category files");
    git("update-ref", "refs/remotes/upstream/master", "HEAD");
    write("config.example/categories.yml", "fork categories\n");
    git("add", "-A");
    git("commit", "-q", "-m", "fork keeps its categories.yml");

    const result = await run({ dryRun: true });
    expect(result.files).toEqual(["categories.yml"]);
    await run();
    expect(read("config/categories.yml")).toBe("fork categories\n");
    expect(existsSync(join(repo, "config.example/categories.yml"))).toBe(false);
    expect(read("config.example/categories/01-a.md")).toContain("key: a");
    expect(git("diff", "--name-only", "upstream/master", "--", "config.example")).toBe("");
  });

  describe("converting the categories.yml it moves", () => {
    const VALID = "- key: a\n  name: A\n  expectations:\n    - summary: Does things\n      level: 1\n";
    const forkWithValidYaml = () => {
      write("config.example/categories.yml", VALID);
      git("commit", "-q", "-am", "fork edits its categories");
    };

    it("converts it into category files in the config folder, with the same keys", async () => {
      forkWithValidYaml();
      const result = await run();
      expect(result.converted).toBe(true);
      expect(read("config/categories/01-a.md")).toContain("key: a");
      expect(read("config/categories.yml.bak")).toBe(VALID);
      expect(existsSync(join(repo, "config/categories.yml"))).toBe(false);
      expect(read("config.example/categories.yml")).toBe("upstream categories\n");
      expect(output.join("\n")).toContain("config/categories/01-a.md");
    });

    it("lists the conversion in a dry run without doing it", async () => {
      forkWithValidYaml();
      await run({ dryRun: true });
      expect(output.join("\n")).toContain("categories.yml will be converted into config/categories/");
      expect(existsSync(join(repo, "config/categories"))).toBe(false);
    });

    it("asks about the conversion with the move", async () => {
      forkWithValidYaml();
      let question = "";
      await run({ yes: false, confirm: async (asked: string) => ((question = asked), false) });
      expect(question).toContain("convert categories.yml into category files");
    });

    it("converts in the folder of PROGRESSION_RADAR_CONFIG_DIR", async () => {
      forkWithValidYaml();
      await run({ configDir: "my-config" });
      expect(read("my-config/categories/01-a.md")).toContain("key: a");
    });

    it("still moves the file when the conversion cannot run, and says what to fix", async () => {
      const result = await run();
      expect(result.converted).toBe(false);
      expect(read("config/categories.yml")).toBe("fork categories\n");
      const text = output.join("\n");
      expect(text).toContain("config/categories.yml was moved but not converted");
      expect(text).toContain("must contain a non-empty list of categories");
      expect(text).toContain("Fix them and run npm run config:convert-categories.");
    });

    it("does not convert over an existing categories/ folder, and says why", async () => {
      forkWithValidYaml();
      write("config/categories/01-mine.md", "mine");
      const result = await run();
      expect(result.converted).toBe(false);
      expect(read("config/categories/01-mine.md")).toBe("mine");
      expect(output.join("\n")).toContain("config/categories/ already exists");
    });
  });

  it("prints the next steps", async () => {
    await run();
    const text = output.join("\n");
    expect(text).toContain("git add -f config");
    expect(text).toContain("PROGRESSION_RADAR_CONFIG_DIR");
  });

  it("asks before changing anything and stops when the answer is no", async () => {
    const result = await run({ yes: false, confirm: async () => false });
    expect(result.moved).toEqual([]);
    expect(read("config.example/categories.yml")).toBe("fork categories\n");
    expect(existsSync(join(repo, "config/categories.yml"))).toBe(false);
  });

  it("never overwrites a file of the config folder: it reports it and keeps the example copy", async () => {
    write("config/theme.css", "/* mine */\n");
    const result = await run();
    expect(read("config/theme.css")).toBe("/* mine */\n");
    expect(result.skipped).toEqual(["theme.css"]);
    expect(result.moved).toEqual(["categories.yml", "logo.svg"]);
    expect(output.join("\n")).toMatch(/theme\.css.*already exists/);
    // The fork's copy is not lost: it stays in config.example/ for the person to merge by hand.
    expect(read("config.example/theme.css")).toBe("/* fork theme */\n");
  });

  it("follows PROGRESSION_RADAR_CONFIG_DIR", async () => {
    await run({ configDir: "my-config" });
    expect(read("my-config/categories.yml")).toBe("fork categories\n");
    expect(existsSync(join(repo, "config/categories.yml"))).toBe(false);
    expect(output.join("\n")).toContain("git add -f my-config");
  });

  it("uses the ref it is given", async () => {
    git("update-ref", "refs/heads/other", "HEAD~1");
    const result = await run({ ref: "other", dryRun: true });
    expect(result.files).toEqual(["categories.yml", "logo.svg", "theme.css"]);
  });

  it("does nothing when config.example/ already matches the ref", async () => {
    git("update-ref", "refs/remotes/upstream/master", "HEAD");
    const result = await run();
    expect(result.files).toEqual([]);
    expect(output.join("\n")).toMatch(/nothing to migrate/i);
  });

  it("also finds changes that are not committed yet", async () => {
    write("config.example/roles.yml", "edited roles\n");
    write("config.example/untracked.css", "x\n");
    const result = await run({ dryRun: true });
    expect(result.files).toEqual(["categories.yml", "logo.svg", "roles.yml", "theme.css", "untracked.css"]);
  });

  it("explains how to add the upstream remote when the ref does not exist, and changes nothing", async () => {
    git("update-ref", "-d", "refs/remotes/upstream/master");
    const error = await run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MigrationError);
    expect((error as Error).message).toContain("git remote add upstream");
    expect((error as Error).message).toContain("git fetch upstream");
    expect(read("config.example/categories.yml")).toBe("fork categories\n");
  });

  it("stops in a folder that is not a git repository", async () => {
    const outside = mkdtempSync(join(tmpdir(), "radar-nogit-"));
    try {
      await expect(migrate({ cwd: outside, yes: true, log: () => {} })).rejects.toThrow(/git repository/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("stops while a merge is in progress", async () => {
    write(".git/MERGE_HEAD", `${git("rev-parse", "HEAD")}\n`);
    await expect(run()).rejects.toThrow(/merge/i);
    expect(read("config.example/categories.yml")).toBe("fork categories\n");
  });

  it("stops when config.example/ has conflicts", async () => {
    git("checkout", "-q", "-b", "side", "HEAD~1");
    write("config.example/roles.yml", "side roles\n");
    git("commit", "-q", "-am", "side");
    git("checkout", "-q", "master");
    write("config.example/roles.yml", "master roles\n");
    git("commit", "-q", "-am", "master");
    try {
      git("merge", "side");
    } catch {
      // the conflict is what this test needs
    }
    rmSync(join(repo, ".git/MERGE_HEAD"));
    await expect(run()).rejects.toThrow(/conflict/i);
  });
});
