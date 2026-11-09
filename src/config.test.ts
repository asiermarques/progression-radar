import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { readCategoryFile } from "../scripts/category-markdown";
import { compareCategoryFiles } from "../scripts/config-sources";
import { ConfigError, loadConfig, parseConfig, type Origins } from "./config";

// The example configuration on its own, read straight from config.example/ (never through the resolved folders).
const exampleFiles = import.meta.glob<string>("../config.example/*.yml", { eager: true, query: "?raw", import: "default" });
const exampleCategoryFiles = import.meta.glob<string>("../config.example/categories/*.md", { eager: true, query: "?raw", import: "default" });
const exampleImages = Object.keys(import.meta.glob("../config.example/*.{svg,png,jpg,jpeg,webp,gif}"));

const category = { key: "comm", name: "Communication", expectations: [{ summary: "Talks", level: 1 }] };

function problemsOf(raw: Parameters<typeof parseConfig>[0], origins?: Origins): string[] {
  try {
    parseConfig(raw, {}, origins);
    return [];
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
}

const exampleCategoryLabels = Object.keys(exampleCategoryFiles)
  .map((path) => path.replace("../", ""))
  .sort((a, b) => compareCategoryFiles(a.split("/").pop()!, b.split("/").pop()!));

const exampleOrigins: Origins = {
  categories: "config.example/categories/",
  categoryFiles: exampleCategoryLabels,
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
    const readings = exampleCategoryLabels.map((label) => readCategoryFile(exampleCategoryFiles[`../${label}`], label));
    const config = parseConfig(
      {
        categories: readings.map((reading) => reading.category),
        roles: example("roles.yml"),
        site: example("site.yml"),
        problems: readings.flatMap((reading) => reading.problems),
      },
      images,
      exampleOrigins,
    );
    expect(config.categories.length).toBeGreaterThan(0);
    expect(config.roles.length).toBeGreaterThan(0);
  });

  it("ships the example categories as category files, in order, without categories.yml or tags", () => {
    expect(exampleCategoryLabels.length).toBeGreaterThan(0);
    expect(exampleCategoryLabels[0]).toMatch(/\/01-[^/]+\.md$/);
    expect(Object.keys(exampleFiles).map((path) => path.split("/").pop())).not.toContain("categories.yml");
    for (const source of Object.values(exampleCategoryFiles)) {
      expect(source.split("\n---\n")[0]).not.toMatch(/^tags:/m);
    }
  });

  it("fills optional fields with defaults", () => {
    const config = parseConfig({ categories: [category], roles: null, site: null });
    expect(config.site.title).toBe("Progression Radar");
    expect(config.roles).toEqual([]);
    expect(config.categories[0].expectations[0]).toEqual({ summary: "Talks", description: "", level: 1 });
  });

  it("ignores a \"tags\" key on an expectation, like any key it does not know", () => {
    const withTags = { key: "comm", name: "Communication", expectations: [{ summary: "Talks", level: 1, tags: ["tech"] }] };
    const config = parseConfig({ categories: [withTags], roles: null, site: null });
    expect(config.categories[0].expectations).toEqual([{ summary: "Talks", description: "", level: 1 }]);
    expect(config.categories[0].expectations[0]).not.toHaveProperty("tags");
  });

  it("does not read the legacy \"kpis\" list: only the converter does", () => {
    const legacy = { key: "comm", name: "Communication", kpis: [{ summary: "Talks", level: 1 }] };
    expect(problemsOf({ categories: [legacy], roles: null, site: null })).toEqual([
      'category #1: category "comm" needs an "expectations" list',
    ]);
  });

  it("reports every problem at once", () => {
    const problems = problemsOf({
      categories: [category, category, { key: "x", name: "X", expectations: [{ summary: "Bad", level: 0 }] }],
      roles: [{ key: "r", name: "R", levels: { comm: 1, unknown: 2 } }],
      site: { logo: "missing.svg" },
    });
    expect(problems).toEqual([
      'category #2: duplicated category key "comm"',
      'category #3: category "x" expectation #1 needs a "level" that is a positive integer',
      'roles.yml: role "r" references unknown category "unknown"',
      'site.yml: logo "missing.svg" was not found in the config folder',
    ]);
  });

  it("names the file and folder each problem comes from", () => {
    const origins: Origins = {
      categories: "config/categories/",
      categoryFiles: ["01-a.md", "02-b.md", "03-x.md", "04-y.md", "05-z.md"].map((name) => `config/categories/${name}`),
      roles: "config.example/roles.yml",
      site: "my-config/site.yml",
      folders: ["my-config/", "config.example/"],
    };
    const problems = problemsOf(
      {
        categories: [category, category, { key: "x", name: "X", expectations: [{ summary: "Bad", level: 0 }] }, { key: "y" }, { key: "z", name: "Z" }],
        roles: [{ key: "r", name: "R", levels: { comm: 1, unknown: 2, x: -1 } }, { key: "r" }],
        site: { logo: "missing.svg" },
      },
      origins,
    );
    expect(problems).toEqual([
      'config/categories/02-b.md: duplicated category key "comm"',
      'config/categories/03-x.md: category "x" expectation #1 needs a "level" that is a positive integer',
      'config/categories/04-y.md needs a "key" and a "name"',
      'config/categories/05-z.md: category "z" needs an "expectations" list',
      'config.example/roles.yml: role "r" references unknown category "unknown"',
      'config.example/roles.yml: role "r" has an invalid level for "x"',
      'config.example/roles.yml entry #2 needs a "key" and a "name"',
      'my-config/site.yml: logo "missing.svg" was not found in my-config/ or config.example/',
    ]);
  });

  it("names the file when the lists are missing or malformed", () => {
    const origins: Origins = { ...exampleOrigins, categories: "config/categories/", roles: "config/roles.yml" };
    expect(problemsOf({ categories: [], roles: "nope", site: {} }, origins)).toEqual([
      "config/categories/ must contain a non-empty list of categories",
      "config/roles.yml must contain a list of roles",
    ]);
  });

  it.each(["name", "role", "compare", "tag", "state"])("rejects the reserved category key %s", (key) => {
    const problems = problemsOf({ categories: [{ ...category, key }], roles: null, site: null });
    expect(problems).toEqual([`category #1: the category key "${key}" is reserved by the share link`]);
  });

  it("rejects the category key id, which is the column that identifies a person in a snapshot", () => {
    const problems = problemsOf({ categories: [{ ...category, key: "id" }], roles: null, site: null });
    expect(problems).toEqual(['category #1: the category key "id" is reserved by the snapshots']);
  });

  it("allows keys that only look like reserved ones", () => {
    const categories = [{ ...category, key: "names" }, { ...category, key: "Role" }];
    expect(problemsOf({ categories, roles: null, site: null })).toEqual([]);
  });

  describe("categories read from category files", () => {
    const files = ["config/categories/01-comm.md", "config/categories/02-role.md", "config/categories/03-pm.md"];
    const origins: Origins = { ...exampleOrigins, categories: "config/categories/", categoryFiles: files };

    it("names the category file instead of the entry number", () => {
      const problems = problemsOf(
        {
          categories: [category, { ...category, key: "role" }, category, { key: "x", name: "X" }],
          roles: null,
          site: null,
        },
        { ...origins, categoryFiles: [...files, "config/categories/04-x.md"] },
      );
      expect(problems).toEqual([
        'config/categories/02-role.md: the category key "role" is reserved by the share link',
        'config/categories/03-pm.md: duplicated category key "comm"',
        'config/categories/04-x.md: category "x" needs an "expectations" list',
      ]);
    });

    it("names a category by its position only when no file is given for it", () => {
      const problems = problemsOf({ categories: [category, category], roles: null, site: null });
      expect(problems).toEqual(['category #2: duplicated category key "comm"']);
    });

    it("reports only the source problem, not every role reference, when no category could be read", () => {
      const problems = problemsOf({
        categories: [],
        roles: [{ key: "r", name: "R", levels: { comm: 1, data: 2 } }],
        site: null,
        problems: ["config/categories.yml is no longer read; convert it with npm run config:convert-categories"],
      });
      expect(problems).toEqual(["config/categories.yml is no longer read; convert it with npm run config:convert-categories"]);
    });

    it("lists the problems found while reading the files with its own", () => {
      const problems = problemsOf(
        {
          categories: [category],
          roles: [{ key: "r", name: "R", levels: { unknown: 1 } }],
          site: null,
          problems: ['config/categories/01-comm.md:14: "## Nivel 2" is not a level heading; use "## Level N"'],
        },
        origins,
      );
      expect(problems).toEqual([
        'config/categories/01-comm.md:14: "## Nivel 2" is not a level heading; use "## Level N"',
        'config.example/roles.yml: role "r" references unknown category "unknown"',
      ]);
    });

    it("does not add \"empty list\" noise to a problem that explains why there are no categories", () => {
      const problem = "config/categories/ has no category file; add a .md file for each category";
      expect(problemsOf({ categories: [], roles: null, site: null, problems: [problem] }, origins)).toEqual([problem]);
    });
  });

  it("requires at least one category", () => {
    expect(problemsOf({ categories: [], roles: [], site: {} })).toHaveLength(1);
  });

  it("resolves the logo from the config images", () => {
    const config = parseConfig({ categories: [category], roles: [], site: { logo: "logo.svg" } }, { "logo.svg": "/assets/logo.svg" });
    expect(config.site.logo).toBe("/assets/logo.svg");
  });
});
