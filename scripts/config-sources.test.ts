// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configModuleSource, describeSources, resolveConfigSources } from "./config-sources";

let root: string;

const put = (folder: string, ...names: string[]) => {
  mkdirSync(join(root, folder), { recursive: true });
  for (const name of names) writeFileSync(join(root, folder, name), "");
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "radar-sources-"));
  put("config.example", "categories.yml", "roles.yml", "site.yml", "theme.css", "logo.svg");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("resolveConfigSources", () => {
  it("reads every file from the example when config/ holds only a README", () => {
    put("config", "README.md");
    const sources = resolveConfigSources(root, undefined);
    expect(Object.values(sources.files).map((file) => file.label)).toEqual([
      "config.example/categories.yml",
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
    expect(files["categories.yml"].label).toBe("config.example/categories.yml");
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
    put("my-config", "categories.yml");
    const { files, configLabel } = resolveConfigSources(root, "my-config/");
    expect(configLabel).toBe("my-config");
    expect(files["categories.yml"].label).toBe("my-config/categories.yml");
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

describe("configModuleSource", () => {
  it("imports the resolved files and exposes where each one came from", () => {
    put("config", "site.yml", "logo.svg");
    const source = configModuleSource(resolveConfigSources(root, undefined));
    expect(source).toContain(`import site from ${JSON.stringify(join(root, "config", "site.yml"))};`);
    expect(source).toContain(`import categories from ${JSON.stringify(join(root, "config.example", "categories.yml"))};`);
    expect(source).toContain(`import image0 from ${JSON.stringify(`${join(root, "config", "logo.svg")}?url`)};`);
    expect(source).toContain('"site":"config/site.yml"');
    expect(source).toContain('"categories":"config.example/categories.yml"');
    expect(source).toContain('"folders":["config/","config.example/"]');
  });
});

describe("describeSources", () => {
  it("says where each file was read from, with no warning when everything is recognised", () => {
    put("config", "README.md", "logo.svg", "site.yml");
    expect(describeSources(resolveConfigSources(root, undefined))).toEqual({
      info: ["categories.yml ← config.example/", "roles.yml ← config.example/", "site.yml ← config/", "theme.css ← config.example/"],
      warnings: [],
    });
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
