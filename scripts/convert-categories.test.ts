// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { parseConfig } from "../src/config";
import { readCategoryFile } from "./category-markdown";
import { ConversionError, convertCategories } from "./convert-categories";

let cwd: string;
let output: string[];

const write = (path: string, content: string) => {
  mkdirSync(join(cwd, path, ".."), { recursive: true });
  writeFileSync(join(cwd, path), content);
};
const read = (path: string) => readFileSync(join(cwd, path), "utf8");
const run = (options: Record<string, unknown> = {}) => convertCategories({ cwd, log: (line) => output.push(line), ...options });

/** The Configuration the app would get from the files in config/categories/, in file order. */
function loadWritten(folder = "config/categories") {
  const names = readdirSync(join(cwd, folder)).sort();
  const readings = names.map((name) => readCategoryFile(read(`${folder}/${name}`), `${folder}/${name}`));
  expect(readings.flatMap((reading) => reading.problems)).toEqual([]);
  return parseConfig({ categories: readings.map((reading) => reading.category), roles: null, site: null }).categories;
}

const yamlConfig = (path = "config/categories.yml") => parseConfig({ categories: parseYaml(read(path)), roles: null, site: null }).categories;

const trimmed = (categories: ReturnType<typeof yamlConfig>) =>
  categories.map((category) => ({
    ...category,
    // The files group the expectations by ascending level, so that is the order to compare with.
    expectations: category.expectations
      .map((expectation) => ({ ...expectation, description: expectation.description.trim() }))
      .sort((a, b) => a.level - b.level),
  }));

const SAMPLE = `
- key: comm
  name: Communication
  description: Shares the right amount of information
  expectations:
    - summary: Gives updates
      level: 2
      tags: [tech]
      description: |
        **Example behaviours:**

        * Communicates status
        * Exposes blockers

        \`\`\`sh
        # not a heading
        ## nor this
        \`\`\`
    - summary: Writes things down
      level: 1
    - summary: Listens
      level: 2
- key: back
  name: "Backend: the \\"hard\\" part"
  kpis:
    - summary: Uses \`code\`, *stars* and a trailing hash \#
      level: 3
      description: "Single line"
    - summary: R&D <b> [link]
      level: 1
    - summary: "Learns C #"
      level: 1
- key: ops
  name: Operations
  expectations: []
`;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "radar-convert-"));
  output = [];
});

afterEach(() => rmSync(cwd, { recursive: true, force: true }));

describe("convertCategories", () => {
  it("writes one numbered file per category, in the order of the YAML, and keeps the old file as .bak", async () => {
    write("config/categories.yml", SAMPLE);
    const original = yamlConfig();
    await run();
    expect(readdirSync(join(cwd, "config/categories")).sort()).toEqual(["01-comm.md", "02-back.md", "03-ops.md"]);
    expect(existsSync(join(cwd, "config/categories.yml"))).toBe(false);
    expect(read("config/categories.yml.bak")).toBe(SAMPLE);
    expect(loadWritten()).toEqual(trimmed(original));
  });

  it("pads the numbers to two digits", async () => {
    const entries = Array.from({ length: 12 }, (_, index) => `- key: c${index}\n  name: C${index}\n  expectations: []\n`);
    write("config/categories.yml", entries.join(""));
    await run();
    const names = readdirSync(join(cwd, "config/categories")).sort();
    expect(names[0]).toBe("01-c0.md");
    expect(names[11]).toBe("12-c11.md");
  });

  it("groups the expectations by ascending level, keeping their order within a level", async () => {
    write("config/categories.yml", SAMPLE);
    await run();
    const text = read("config/categories/01-comm.md");
    expect(text.startsWith("---\nkey: comm\nname: Communication\ndescription: Shares the right amount of information\n---\n")).toBe(true);
    expect(text.indexOf("## Level 1")).toBeLessThan(text.indexOf("## Level 2"));
    expect(text.indexOf("### Gives updates")).toBeLessThan(text.indexOf("### Listens"));
  });

  it("writes no tags and reads the legacy kpis", async () => {
    write("config/categories.yml", SAMPLE);
    await run();
    expect(read("config/categories/01-comm.md")).not.toContain("tech");
    expect(read("config/categories/02-back.md")).toContain("## Level 3");
  });

  it("leaves '#' lines inside code blocks alone", async () => {
    write("config/categories.yml", SAMPLE);
    await run();
    expect(read("config/categories/01-comm.md")).toContain("# not a heading\n## nor this");
    expect(output.join("\n")).not.toContain("lowered");
  });

  it("lowers #, ## and ### headings of a description to #### and reports each one", async () => {
    write(
      "config/categories.yml",
      [
        "- key: a",
        "  name: A",
        "  expectations:",
        "    - summary: Does things",
        "      level: 1",
        "      description: |",
        "        Intro",
        "",
        "        # Title",
        "",
        "        ## Notes",
        "",
        "        Setext heading",
        "        --------------",
        "",
        "        ### Details ###",
        "",
        "        #### Already fine",
        "",
        "        > ## quoted stays",
        "",
      ].join("\n"),
    );
    const original = yamlConfig();
    await run();

    const text = read("config/categories/01-a.md");
    expect(text).toContain("\n#### Title\n");
    expect(text).toContain("\n#### Notes\n");
    expect(text).toContain("\n#### Setext heading\n");
    expect(text).toContain("\n#### Details\n");
    expect(text).toContain("> ## quoted stays");
    expect(text).not.toMatch(/^#{1,3} (Title|Notes|Details)/m);

    const report = output.join("\n");
    expect(report).toContain('a / "Does things": "# Title" became "#### Title"');
    expect(report).toContain('"## Notes" became "#### Notes"');
    expect(report).toContain('"Setext heading" (underlined) became "#### Setext heading"');
    expect(report).toContain('"### Details ###" became "#### Details"');
    expect(report).not.toContain("Already fine");

    // Same Ladder apart from the lowered headings.
    const [written] = loadWritten();
    expect(written.expectations).toHaveLength(1);
    expect(written.expectations[0].description).toBe(
      trimmed(original)[0].expectations[0].description
        .replace("# Title", "#### Title")
        .replace("## Notes", "#### Notes")
        .replace("Setext heading\n--------------", "#### Setext heading")
        .replace("### Details ###", "#### Details"),
    );
  });

  it("joins a summary with line breaks into one line and reports it", async () => {
    write(
      "config/categories.yml",
      '- key: a\n  name: A\n  expectations:\n    - summary: "Line one\\nline two"\n      level: 1\n',
    );
    await run();
    expect(read("config/categories/01-a.md")).toContain("### Line one line two\n");
    expect(output.join("\n")).toContain('a: the summary "Line one line two" had a line break; it is now one line');
    expect(loadWritten()[0].expectations[0].summary).toBe("Line one line two");
  });

  it("lists what it wrote and the next steps, and never touches git", async () => {
    write("config/categories.yml", SAMPLE);
    await run();
    const report = output.join("\n");
    expect(report).toContain("config/categories/01-comm.md");
    expect(report).toContain("categories.yml.bak");
    expect(existsSync(join(cwd, ".git"))).toBe(false);
  });

  it("uses the folder it is given", async () => {
    write("my-ladder/categories.yml", SAMPLE);
    await run({ configDir: "my-ladder" });
    expect(existsSync(join(cwd, "my-ladder/categories/01-comm.md"))).toBe(true);
    expect(existsSync(join(cwd, "my-ladder/categories.yml.bak"))).toBe(true);
  });

  describe("refuses, writing nothing", () => {
    const refusal = async () => {
      const error = await run().then(
        () => undefined,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(ConversionError);
      return (error as ConversionError).message;
    };

    it("when categories.yml has a configuration problem", async () => {
      write("config/categories.yml", "- key: a\n  name: A\n  expectations:\n    - summary: No level\n- key: a\n  name: Dup\n  expectations: []\n");
      const message = await refusal();
      expect(message).toContain('config/categories.yml: category "a" expectation #1 needs a "level" that is a positive integer');
      expect(message).toContain('duplicated category key "a"');
      expect(existsSync(join(cwd, "config/categories"))).toBe(false);
      expect(existsSync(join(cwd, "config/categories.yml"))).toBe(true);
    });

    it("when the folder already has categories/", async () => {
      write("config/categories.yml", SAMPLE);
      write("config/categories/old.md", "x");
      expect(await refusal()).toContain("config/categories/ already exists");
      expect(read("config/categories.yml")).toBe(SAMPLE);
    });

    it("when there is no categories.yml", async () => {
      mkdirSync(join(cwd, "config"));
      expect(await refusal()).toContain("config/categories.yml does not exist");
    });

    it("when a categories.yml.bak is already there", async () => {
      write("config/categories.yml", SAMPLE);
      write("config/categories.yml.bak", "old");
      expect(await refusal()).toContain("categories.yml.bak already exists");
      expect(existsSync(join(cwd, "config/categories"))).toBe(false);
    });

    it("when the YAML has a syntax error", async () => {
      write("config/categories.yml", "- key: [unclosed");
      expect(await refusal()).toContain("config/categories.yml");
    });
  });
});
