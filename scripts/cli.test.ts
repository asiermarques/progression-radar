// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// These tests run the real command, from an empty folder as an Adopter repository would: the Config folder, the
// Snapshots folder and dist/ are those of that folder; the code and the Sample configuration are the radar's own.
const cli = fileURLToPath(new URL("./cli.mjs", import.meta.url));
let cwd: string;

const run = (args: string[], env: Record<string, string> = {}) => {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  return { code: result.status, out: result.stdout, err: result.stderr };
};
const write = (file: string, content: string) => {
  mkdirSync(join(cwd, file, ".."), { recursive: true });
  writeFileSync(join(cwd, file), content);
};
const twoProblems = () => {
  write("config/roles.yml", '- key: r\n  name: R\n  levels: { unknown: 2 }\n');
  write("config/site.yml", "title: Ladder\nlogo: missing.svg\n");
};

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "radar-cli-"));
});
afterEach(() => rmSync(cwd, { recursive: true, force: true }));

describe("progression-radar", () => {
  it("lists the commands with --help and exits with 0", () => {
    const { code, out } = run(["--help"]);
    expect(code).toBe(0);
    for (const command of ["dev", "build", "preview", "check", "snapshot record|link|check", "config convert-categories"]) {
      expect(out).toContain(command);
    }
  });

  it("prints the usage and fails for an unknown command or none", () => {
    expect(run(["nope"]).code).toBe(1);
    expect(run(["nope"]).err).toContain('Unknown command "nope"');
    expect(run([]).code).toBe(1);
  });

  it("has no config migrate: that command exists only in a fork", () => {
    const { code, err } = run(["config", "migrate"]);
    expect(code).toBe(1);
    expect(err).toContain('Unknown command "config migrate"');
  });

  it("rejects an unknown option of dev", () => {
    expect(run(["dev", "--nope"]).code).toBe(1);
  });
});

describe("progression-radar check", () => {
  it("checks the Sample configuration of a folder with no config/", () => {
    const { code, out } = run(["check"]);
    expect(code).toBe(0);
    expect(out).toContain("The Configuration is valid.");
    expect(out).toContain("No snapshots to check in snapshots/.");
  });

  it("prints every problem with its file and folder and fails", () => {
    twoProblems();
    const { code, err } = run(["check"]);
    expect(code).toBe(1);
    expect(err).toContain('config/roles.yml: role "r" references unknown category "unknown"');
    expect(err).toContain('config/site.yml: logo "missing.svg" was not found in config/ or config.example/');
    expect(err).toContain("The snapshots were not checked against it.");
  });

  it("follows PROGRESSION_RADAR_CONFIG_DIR, relative to the folder it runs in", () => {
    write("ladder/roles.yml", '- key: r\n  name: R\n  levels: { unknown: 2 }\n');
    const { code, err } = run(["check"], { PROGRESSION_RADAR_CONFIG_DIR: "ladder" });
    expect(code).toBe(1);
    expect(err).toContain("ladder/roles.yml: role");
  });

  it("fails when PROGRESSION_RADAR_CONFIG_DIR names a folder that does not exist", () => {
    const { code, err } = run(["check"], { PROGRESSION_RADAR_CONFIG_DIR: "nowhere" });
    expect(code).toBe(1);
    expect(err).toContain("PROGRESSION_RADAR_CONFIG_DIR is set to");
  });
});

describe("progression-radar build", () => {
  it("writes dist/ in the folder it runs in, not in the radar", () => {
    write("config/site.yml", "title: Built in the Adopter repository\n");
    const { code } = run(["build"]);
    expect(code).toBe(0);
    expect(existsSync(join(cwd, "dist", "index.html"))).toBe(true);
  }, 30000);

  it("fails listing every Configuration problem and writes no dist/", () => {
    twoProblems();
    mkdirSync(join(cwd, "dist"));
    writeFileSync(join(cwd, "dist", "kept.txt"), "from the last build");
    const { code, err } = run(["build"]);
    expect(code).toBe(1);
    expect(err).toContain('config/roles.yml: role "r" references unknown category "unknown"');
    expect(err).toContain("config/site.yml: logo");
    expect(existsSync(join(cwd, "dist", "kept.txt"))).toBe(true);
    expect(existsSync(join(cwd, "dist", "index.html"))).toBe(false);
  });
});

describe("progression-radar init", () => {
  it("copies the Sample configuration to config/ and adds the scripts", () => {
    write("package.json", JSON.stringify({ name: "ladder" }));
    const { code, out } = run(["init"]);
    expect(code).toBe(0);
    expect(out).toContain("Copied");
    expect(existsSync(join(cwd, "config", "roles.yml"))).toBe(true);
    expect(existsSync(join(cwd, "config", "categories"))).toBe(true);
    expect(readFileSync(join(cwd, "package.json"), "utf8")).toContain('"build": "progression-radar build"');
    expect(run(["check"]).code).toBe(0);
  });

  it("fails without a package.json", () => {
    const { code, err } = run(["init"]);
    expect(code).toBe(1);
    expect(err).toContain("no package.json");
  });
});

describe("progression-radar snapshot", () => {
  it("reads the Snapshots folder of the folder it runs in", () => {
    const { code, out } = run(["snapshot", "check"]);
    expect(code).toBe(0);
    expect(out).toContain("No snapshots to check in snapshots/.");
  });
});
