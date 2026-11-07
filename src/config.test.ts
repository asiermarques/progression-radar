import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, parseConfig } from "./config";

const category = { key: "comm", name: "Communication", kpis: [{ summary: "Talks", level: 1 }] };

function problemsOf(raw: Parameters<typeof parseConfig>[0]): string[] {
  try {
    parseConfig(raw);
    return [];
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
}

describe("config", () => {
  it("loads the shipped configuration without problems", () => {
    const config = loadConfig();
    expect(config.categories.length).toBeGreaterThan(0);
    expect(config.roles.length).toBeGreaterThan(0);
  });

  it("fills optional fields with defaults", () => {
    const config = parseConfig({ categories: [category], roles: null, site: null });
    expect(config.site.title).toBe("Progression Radar");
    expect(config.roles).toEqual([]);
    expect(config.categories[0].kpis[0]).toEqual({ summary: "Talks", description: "", level: 1, tags: [] });
  });

  it("reports every problem at once", () => {
    const problems = problemsOf({
      categories: [category, category, { key: "x", name: "X", kpis: [{ summary: "Bad", level: 0 }] }],
      roles: [{ key: "r", name: "R", levels: { comm: 1, unknown: 2 } }],
      site: { logo: "missing.svg" },
    });
    expect(problems).toEqual([
      'categories.yml entry #2: duplicated category key "comm"',
      'category "x" KPI #1 needs a "level" that is a positive integer',
      'role "r" references unknown category "unknown"',
      'site.yml: logo "missing.svg" was not found in the config folder',
    ]);
  });

  it.each(["name", "role", "compare", "tag", "state"])("rejects the reserved category key %s", (key) => {
    const problems = problemsOf({ categories: [{ ...category, key }], roles: null, site: null });
    expect(problems).toEqual([`categories.yml entry #1: the category key "${key}" is reserved by the share link`]);
  });

  it("allows keys that only look like reserved ones", () => {
    const categories = [{ ...category, key: "names" }, { ...category, key: "Role" }];
    expect(problemsOf({ categories, roles: null, site: null })).toEqual([]);
  });

  it("requires at least one category", () => {
    expect(problemsOf({ categories: [], roles: [], site: {} })).toHaveLength(1);
  });

  it("resolves the logo from the config images", () => {
    const config = parseConfig({ categories: [category], roles: [], site: { logo: "logo.svg" } }, { "logo.svg": "/assets/logo.svg" });
    expect(config.site.logo).toBe("/assets/logo.svg");
  });
});
