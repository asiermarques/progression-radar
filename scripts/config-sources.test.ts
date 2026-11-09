// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configModuleSource, describeSources, isConfigPath, resolveConfigSources } from "./config-sources";

let root: string;

const put = (folder: string, ...names: string[]) => {
  mkdirSync(join(root, folder), { recursive: true });
  for (const name of names) writeFileSync(join(root, folder, name), "");
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "radar-sources-"));
  put("config.example", "roles.yml", "site.yml", "theme.css", "logo.svg");
  put("config.example/categories", "01-comm.md");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("resolveConfigSources with two roots", () => {
  let adopter: string;
  beforeEach(() => {
    adopter = mkdtempSync(join(tmpdir(), "radar-adopter-"));
  });
  afterEach(() => rmSync(adopter, { recursive: true, force: true }));

  it("reads the config folder from the working directory and the example from the package root", () => {
    mkdirSync(join(adopter, "config"));
    writeFileSync(join(adopter, "config", "roles.yml"), "");
    const { files, folders } = resolveConfigSources(adopter, undefined, root);
    expect(files["roles.yml"]).toEqual({ path: join(adopter, "config", "roles.yml"), label: "config/roles.yml" });
    expect(files["site.yml"]).toEqual({ path: join(root, "config.example", "site.yml"), label: "config.example/site.yml" });
    expect(folders).toEqual(["config/", "config.example/"]);
  });

  it("builds the sample configuration when the working directory has no config folder", () => {
    const sources = resolveConfigSources(adopter, undefined, root);
    expect(sources.files["roles.yml"].path).toBe(join(root, "config.example", "roles.yml"));
    expect(sources.categories.label).toBe("config.example/categories/");
    expect(sources.categories.files[0].path).toBe(join(root, "config.example", "categories", "01-comm.md"));
  });

  it("resolves a relative PROGRESSION_RADAR_CONFIG_DIR from the working directory", () => {
    mkdirSync(join(adopter, "ladder"));
    writeFileSync(join(adopter, "ladder", "site.yml"), "");
    const sources = resolveConfigSources(adopter, "ladder", root);
    expect(sources.configLabel).toBe("ladder");
    expect(sources.files["site.yml"].label).toBe("ladder/site.yml");
  });

  it("exposes the example folder so the dev server can watch it", () => {
    expect(resolveConfigSources(adopter, undefined, root).examplePath).toBe(join(root, "config.example"));
  });
});

describe("resolveConfigSources", () => {
  it("reads every file from the example when config/ holds only a README", () => {
    put("config", "README.md");
    const sources = resolveConfigSources(root, undefined);
    expect(Object.values(sources.files).map((file) => file.label)).toEqual([
      "config.example/roles.yml",
      "config.example/site.yml",
      "config.example/theme.css",
    ]);
    expect(sources.unrecognised).toEqual([]);
  });

  it("works when the default config/ folder does not exist", () => {
    const sources = resolveConfigSources(root, undefined);
    expect(sources.files["site.yml"].label).toBe("config.example/site.yml");
    expect(sources.configLabel).toBe("config");
  });

  it("takes each file from config/ when it is there, and from the example otherwise", () => {
    put("config", "site.yml", "theme.css");
    const { files } = resolveConfigSources(root, undefined);
    expect(files["site.yml"]).toEqual({ path: join(root, "config", "site.yml"), label: "config/site.yml" });
    expect(files["theme.css"].label).toBe("config/theme.css");
    expect(files["roles.yml"].label).toBe("config.example/roles.yml");
  });

  it("looks images up in the config folder first, then in the example", () => {
    put("config", "logo.svg", "mark.png");
    put("config.example", "only-example.webp");
    const { images } = resolveConfigSources(root, undefined);
    expect(images).toEqual({
      "logo.svg": join(root, "config", "logo.svg"),
      "mark.png": join(root, "config", "mark.png"),
      "only-example.webp": join(root, "config.example", "only-example.webp"),
    });
  });

  it("warns about files it does not recognise, but not about images, the README or hidden files", () => {
    put("config", "category.yml", "README.md", "logo.svg", ".DS_Store", "notes.txt");
    expect(resolveConfigSources(root, undefined).unrecognised).toEqual(["category.yml", "notes.txt"]);
  });

  it("does not report files of the example", () => {
    put("config.example", "whatever.txt");
    expect(resolveConfigSources(root, undefined).unrecognised).toEqual([]);
  });

  it("resolves a relative folder from the project root and ignores config/", () => {
    put("config", "site.yml");
    put("my-config", "roles.yml");
    const { files, configLabel } = resolveConfigSources(root, "my-config/");
    expect(configLabel).toBe("my-config");
    expect(files["roles.yml"].label).toBe("my-config/roles.yml");
    expect(files["site.yml"].label).toBe("config.example/site.yml");
  });

  it("resolves a folder outside the project", () => {
    const outside = mkdtempSync(join(tmpdir(), "radar-outside-"));
    try {
      writeFileSync(join(outside, "roles.yml"), "");
      const { files } = resolveConfigSources(join(root, "config.example"), outside);
      expect(files["roles.yml"].path).toBe(join(outside, "roles.yml"));
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("labels an absolute folder with the variable name, so the path never reaches the bundle", () => {
    const outside = mkdtempSync(join(tmpdir(), "radar-private-ladder-"));
    try {
      writeFileSync(join(outside, "roles.yml"), "");
      const sources = resolveConfigSources(root, outside);
      expect(sources.files["roles.yml"].label).toBe("PROGRESSION_RADAR_CONFIG_DIR/roles.yml");
      const origins = configModuleSource(sources).split("export const origins = ")[1];
      expect(origins).not.toContain("private-ladder");
      expect(sources.folders).toEqual(["PROGRESSION_RADAR_CONFIG_DIR/", "config.example/"]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("fails with the path when the variable points to a missing folder", () => {
    expect(() => resolveConfigSources(root, "my-confg")).toThrow(/PROGRESSION_RADAR_CONFIG_DIR.*my-confg/);
  });

  it("fails when the variable points to a file", () => {
    put("config", "README.md");
    expect(() => resolveConfigSources(root, "config/README.md")).toThrow(/not a folder/);
  });

  it("treats an empty variable as not set", () => {
    expect(resolveConfigSources(root, "").configLabel).toBe("config");
  });
});

const markdown = (folder: string, ...names: string[]) => put(`${folder}/categories`, ...names);

describe("category files", () => {
  const labelsOf = (sources: ReturnType<typeof resolveConfigSources>) => sources.categories.files.map((file) => file.label);

  it("reads the categories/ folder of the example when nothing is in config/", () => {
    const sources = resolveConfigSources(root, undefined);
    expect(sources.categories).toMatchObject({ form: "folder", label: "config.example/categories/", problems: [] });
    expect(labelsOf(sources)).toEqual(["config.example/categories/01-comm.md"]);
  });

  it("reads the categories/ folder of config/ and replaces the example categories whole", () => {
    markdown("config", "01-comm.md");
    const sources = resolveConfigSources(root, undefined);
    expect(sources.categories).toMatchObject({ form: "folder", label: "config/categories/", problems: [] });
    expect(labelsOf(sources)).toEqual(["config/categories/01-comm.md"]);
    expect(sources.categories.files[0].path).toBe(join(root, "config", "categories", "01-comm.md"));
  });

  it("reads the example's categories/ folder in its order", () => {
    markdown("config.example", "02-b.md", "01-a.md");
    const sources = resolveConfigSources(root, undefined);
    expect(labelsOf(sources)).toEqual([
      "config.example/categories/01-a.md",
      "config.example/categories/01-comm.md",
      "config.example/categories/02-b.md",
    ]);
  });

  it("sorts by the leading number, then by name character by character, unnumbered last", () => {
    markdown("config", "10-ops.md", "2-back.md", "notes.md", "1-comm.md", "01-first.md", "Zeta.md", "alpha.md", "1-b.md");
    expect(labelsOf(resolveConfigSources(root, undefined)).map((label) => label.split("/").pop())).toEqual([
      "01-first.md",
      "1-b.md",
      "1-comm.md",
      "2-back.md",
      "10-ops.md",
      "Zeta.md",
      "alpha.md",
      "notes.md",
    ]);
  });

  it("ignores README.md and warns about anything else that is not a .md file", () => {
    markdown("config", "01-comm.md", "README.md", "draft.txt");
    mkdirSync(join(root, "config", "categories", "old"));
    const sources = resolveConfigSources(root, undefined);
    expect(labelsOf(sources)).toEqual(["config/categories/01-comm.md"]);
    expect(sources.unrecognised).toEqual(["categories/draft.txt", "categories/old/"]);
  });

  it("is a problem, never a fallback to the example, when config/ has a categories.yml", () => {
    put("config", "categories.yml");
    const { categories } = resolveConfigSources(root, undefined);
    expect(categories).toMatchObject({ form: "none", label: "config/categories/", files: [] });
    expect(categories.problems).toEqual(["config/categories.yml is no longer read; convert it with npm run config:convert-categories"]);
  });

  it("is a problem when config/ has a categories.yml next to its categories/ folder", () => {
    put("config", "categories.yml");
    markdown("config", "01-comm.md");
    const { categories } = resolveConfigSources(root, undefined);
    expect(categories.files).toEqual([]);
    expect(categories.problems).toEqual([
      "config/categories.yml is no longer read; delete it if config/categories/ already has your categories, " +
        "or remove that folder and convert it with npm run config:convert-categories",
    ]);
  });

  it("names the folder of PROGRESSION_RADAR_CONFIG_DIR in the problem", () => {
    put("my-ladder", "categories.yml");
    expect(resolveConfigSources(root, "my-ladder").categories.problems[0]).toMatch(/^my-ladder\/categories\.yml is no longer read/);
  });

  it("does not report a categories.yml in config/ as an unrecognised file, but warns about the converter's backup", () => {
    put("config", "categories.yml", "categories.yml.bak");
    expect(resolveConfigSources(root, undefined).unrecognised).toEqual(["categories.yml.bak"]);
  });

  it("is a problem, pointing to config:migrate, when the example has a categories.yml next to categories/", () => {
    put("config.example", "categories.yml");
    const { categories } = resolveConfigSources(root, undefined);
    expect(categories.problems).toEqual([
      "config.example/categories.yml is no longer read; move it to your config folder with npm run config:migrate",
    ]);
  });

  it("reports the example's categories.yml even when config/ has its own categories/ folder", () => {
    put("config.example", "categories.yml");
    markdown("config", "01-comm.md");
    const { categories } = resolveConfigSources(root, undefined);
    expect(categories.label).toBe("config/categories/");
    expect(categories.problems).toEqual([
      "config.example/categories.yml is no longer read; move it to your config folder with npm run config:migrate",
    ]);
  });

  it("reports both files when config/ and the example have a categories.yml", () => {
    put("config", "categories.yml");
    put("config.example", "categories.yml");
    expect(resolveConfigSources(root, undefined).categories.problems).toEqual([
      "config/categories.yml is no longer read; convert it with npm run config:convert-categories",
      "config.example/categories.yml is no longer read; move it to your config folder with npm run config:migrate",
    ]);
  });

  it("names the missing folder when neither folder has categories", () => {
    rmSync(join(root, "config.example", "categories"), { recursive: true });
    const { categories } = resolveConfigSources(root, undefined);
    expect(categories).toMatchObject({ form: "none", label: "config/categories/", files: [] });
    expect(categories.problems).toEqual(["There are no categories: add a config/categories/ folder with a .md file for each category"]);
  });

  it("is a problem, never a fallback to the example, when categories/ has no category file", () => {
    markdown("config", "README.md");
    const { categories } = resolveConfigSources(root, undefined);
    expect(categories.files).toEqual([]);
    expect(categories.label).toBe("config/categories/");
    expect(categories.problems).toEqual(["config/categories/ has no category file; add a .md file for each category"]);
  });

  it("is a problem when categories/ is empty", () => {
    markdown("config");
    expect(resolveConfigSources(root, undefined).categories.problems).toHaveLength(1);
  });
});

describe("isConfigPath", () => {
  const folders = ["/p/config", "/p/config.example"];

  it("matches direct children of the folders and of their categories/ folder, and categories/ itself", () => {
    expect(isConfigPath("/p/config/roles.yml", folders)).toBe(true);
    expect(isConfigPath("/p/config.example/categories/01-a.md", folders)).toBe(true);
    expect(isConfigPath("/p/config/categories", folders)).toBe(true);
  });

  it("does not match deeper or unrelated paths", () => {
    expect(isConfigPath("/p/config/categories/old/x.md", folders)).toBe(false);
    expect(isConfigPath("/p/src/App.tsx", folders)).toBe(false);
  });
});

describe("configModuleSource", () => {
  it("imports each category file with ?category, in order, and exposes the reader problems", () => {
    markdown("config", "2-b.md", "1-a.md");
    const source = configModuleSource(resolveConfigSources(root, undefined));
    const first = JSON.stringify(`${join(root, "config", "categories", "1-a.md")}?category`);
    const second = JSON.stringify(`${join(root, "config", "categories", "2-b.md")}?category`);
    expect(source).toContain(`import category0 from ${first};`);
    expect(source).toContain(`import category1 from ${second};`);
    expect(source).not.toContain("categories.yml");
    expect(source).toContain('"config/categories/1-a.md","config/categories/2-b.md"');
  });

  it("never imports a categories.yml, and passes its problem to the app", () => {
    put("config", "categories.yml");
    const source = configModuleSource(resolveConfigSources(root, undefined));
    expect(source).not.toContain(JSON.stringify(join(root, "config", "categories.yml")));
    expect(source).not.toContain("?category");
    expect(source).toContain("config/categories.yml is no longer read");
  });

  it("passes the resolution problems to the app", () => {
    markdown("config", "README.md");
    expect(configModuleSource(resolveConfigSources(root, undefined))).toContain("has no category file");
  });

  it("imports the resolved files and exposes where each one came from", () => {
    put("config", "site.yml", "logo.svg");
    const source = configModuleSource(resolveConfigSources(root, undefined));
    expect(source).toContain(`import site from ${JSON.stringify(join(root, "config", "site.yml"))};`);
    expect(source).toContain(`import category0 from ${JSON.stringify(`${join(root, "config.example", "categories", "01-comm.md")}?category`)};`);
    expect(source).toContain(`import image0 from ${JSON.stringify(`${join(root, "config", "logo.svg")}?url`)};`);
    expect(source).toContain('"site":"config/site.yml"');
    expect(source).toContain('"categories":"config.example/categories/"');
    expect(source).toContain('"folders":["config/","config.example/"]');
  });
});

describe("describeSources", () => {
  it("says where each file was read from, with no warning when everything is recognised", () => {
    put("config", "README.md", "logo.svg", "site.yml");
    expect(describeSources(resolveConfigSources(root, undefined))).toEqual({
      info: ["categories/ ← config.example/ (1 file)", "roles.yml ← config.example/", "site.yml ← config/", "theme.css ← config.example/"],
      warnings: [],
    });
  });

  it("says which form the categories were read from, and from which folder", () => {
    markdown("config", "01-comm.md");
    expect(describeSources(resolveConfigSources(root, undefined)).info[0]).toBe("categories/ ← config/ (1 file)");
    rmSync(join(root, "config"), { recursive: true });
    put("config", "categories.yml");
    expect(describeSources(resolveConfigSources(root, undefined)).info[0]).toBe("categories/ ← config/");
  });

  it("warns about each unrecognised file", () => {
    put("config", "category.yml");
    const { warnings } = describeSources(resolveConfigSources(root, undefined));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^config\/category\.yml is not a configuration file/);
  });

  it("shows the real path of an absolute folder in the log", () => {
    const outside = mkdtempSync(join(tmpdir(), "radar-log-"));
    try {
      writeFileSync(join(outside, "site.yml"), "");
      const { info } = describeSources(resolveConfigSources(root, outside));
      expect(info).toContain(`site.yml ← ${outside}/`);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
