import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, parseConfig, type Origins } from "./config";

// The example configuration on its own, read straight from config.example/ (never through the resolved folders).
const exampleFiles = import.meta.glob<string>("../config.example/*.yml", { eager: true, query: "?raw", import: "default" });
const exampleImages = Object.keys(import.meta.glob("../config.example/*.{svg,png,jpg,jpeg,webp,gif}"));

const category = { key: "comm", name: "Communication", kpis: [{ summary: "Talks", level: 1 }] };

function problemsOf(raw: Parameters<typeof parseConfig>[0], origins?: Origins): string[] {
  try {
    parseConfig(raw, {}, origins);
    return [];
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
}

const exampleOrigins: Origins = {
  categories: "config.example/categories.yml",
  roles: "config.example/roles.yml",
  site: "config.example/site.yml",
  folders: ["config/", "config.example/"],
};

describe("config", () => {
  it("loads the resolved configuration (config folder plus example fallback) without problems", () => {
    const config = loadConfig();
    expect(config.categories.length).toBeGreaterThan(0);
    expect(config.roles.length).toBeGreaterThan(0);
  });

  it("validates config.example/ on its own, even when config/ overrides it", () => {
    const example = (name: string) => parse(exampleFiles[`../config.example/${name}`]);
    const images = Object.fromEntries(exampleImages.map((path) => [path.split("/").pop()!, path]));
    const config = parseConfig(
      { categories: example("categories.yml"), roles: example("roles.yml"), site: example("site.yml") },
      images,
      exampleOrigins,
    );
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
      'categories.yml: category "x" KPI #1 needs a "level" that is a positive integer',
      'roles.yml: role "r" references unknown category "unknown"',
      'site.yml: logo "missing.svg" was not found in the config folder',
    ]);
  });

  it("names the file and folder each problem comes from", () => {
    const origins: Origins = {
      categories: "config/categories.yml",
      roles: "config.example/roles.yml",
      site: "my-config/site.yml",
      folders: ["my-config/", "config.example/"],
    };
    const problems = problemsOf(
      {
        categories: [category, category, { key: "x", name: "X", kpis: [{ summary: "Bad", level: 0 }] }, { key: "y" }, { key: "z", name: "Z" }],
        roles: [{ key: "r", name: "R", levels: { comm: 1, unknown: 2, x: -1 } }, { key: "r" }],
        site: { logo: "missing.svg" },
      },
      origins,
    );
    expect(problems).toEqual([
      'config/categories.yml entry #2: duplicated category key "comm"',
      'config/categories.yml: category "x" KPI #1 needs a "level" that is a positive integer',
      'config/categories.yml entry #4 needs a "key" and a "name"',
      'config/categories.yml: category "z" needs a "kpis" list',
      'config.example/roles.yml: role "r" references unknown category "unknown"',
      'config.example/roles.yml: role "r" has an invalid level for "x"',
      'config.example/roles.yml entry #2 needs a "key" and a "name"',
      'my-config/site.yml: logo "missing.svg" was not found in my-config/ or config.example/',
    ]);
  });

  it("names the file when the lists are missing or malformed", () => {
    const origins: Origins = { ...exampleOrigins, categories: "config/categories.yml", roles: "config/roles.yml" };
    expect(problemsOf({ categories: [], roles: "nope", site: {} }, origins)).toEqual([
      "config/categories.yml must contain a non-empty list of categories",
      "config/roles.yml must contain a list of roles",
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
