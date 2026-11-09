// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config";
import { configurationProblems, runCheck } from "./check-command";

let root: string;
let out: string[];
let err: string[];

const invalid = () => {
  throw new ConfigError(['config/roles.yml: role "r" references unknown category "unknown"', "config/site.yml: title is missing"]);
};

const check = (loader: () => ReturnType<typeof loadConfig> = loadConfig) =>
  runCheck({ root, env: {}, io: { out: (line) => out.push(line), err: (line) => err.push(line) }, loadConfig: loader });

beforeEach(() => {
  root = join(mkdtempSync(join(tmpdir(), "radar-check-")), "project");
  mkdirSync(root);
  out = [];
  err = [];
});
afterEach(() => rmSync(join(root, ".."), { recursive: true, force: true }));

describe("configurationProblems", () => {
  it("is empty for a valid Configuration", () => {
    expect(configurationProblems(loadConfig)).toEqual([]);
  });

  it("lists every problem of an invalid Configuration", () => {
    expect(configurationProblems(invalid)).toHaveLength(2);
  });

  it("lets other errors through", () => {
    expect(() =>
      configurationProblems(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
  });
});

describe("check", () => {
  it("reports a valid Configuration and that there are no snapshots", () => {
    expect(check()).toBe(0);
    expect(out).toEqual(["The Configuration is valid.", "No snapshots to check in snapshots/."]);
  });

  it("prints every problem, skips the snapshots and fails when the Configuration is invalid", () => {
    expect(check(invalid)).toBe(1);
    expect(err.join("\n")).toContain('- config/roles.yml: role "r" references unknown category "unknown"');
    expect(err.join("\n")).toContain("- config/site.yml: title is missing");
    expect(err.join("\n")).toContain("The snapshots were not checked against it.");
    expect(out).toEqual([]);
  });

  it("prints a snapshot error with file and line and fails", () => {
    mkdirSync(join(root, "snapshots"));
    const keys = loadConfig().categories.map((category) => category.key);
    writeFileSync(
      join(root, "snapshots", "2026-11-07.csv"),
      `id,name,${keys.join(",")}\nana,Ana,${keys.map(() => 1).join(",")}\nana,Ana,${keys.map(() => 1).join(",")}\n`,
    );
    expect(check()).toBe(1);
    expect(out[0]).toBe("The Configuration is valid.");
    expect(out.join("\n")).toMatch(/snapshots\/2026-11-07\.csv:3: error:/);
  });

  it("does not fail for a snapshot warning", () => {
    mkdirSync(join(root, "snapshots"));
    const keys = loadConfig().categories.map((category) => category.key);
    writeFileSync(
      join(root, "snapshots", "2026-11-07.csv"),
      `id,name,${keys.join(",")},gone\nana,Ana,${keys.map(() => 1).join(",")},2\n`,
    );
    expect(check()).toBe(0);
    expect(out.join("\n")).toContain("warning");
  });
});
