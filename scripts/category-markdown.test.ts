// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readCategoryFile } from "./category-markdown";

const FILE = "config/categories/01-comm.md";
const read = (...lines: string[]) => readCategoryFile(lines.join("\n"), FILE);

const header = ["---", "key: comm", "name: Communication", "description: Shares information", "---", ""];

describe("readCategoryFile", () => {
  it("reads the frontmatter and the expectations grouped by level", () => {
    const { category, problems } = read(
      ...header,
      "## Level 1",
      "",
      "### Gives updates",
      "",
      "Some **text**.",
      "",
      "### Writes things down",
      "",
      "## Level 2",
      "",
      "### Leads meetings",
      "",
      "* one",
      "* two",
    );
    expect(problems).toEqual([]);
    expect(category).toEqual({
      key: "comm",
      name: "Communication",
      description: "Shares information",
      expectations: [
        { summary: "Gives updates", description: "Some **text**.", level: 1 },
        { summary: "Writes things down", description: "", level: 1 },
        { summary: "Leads meetings", description: "* one\n* two", level: 2 },
      ],
    });
  });

  it("makes the description optional", () => {
    const { category } = read("---", "key: comm", "name: Communication", "---", "## Level 1", "### A");
    expect(category).toEqual({ key: "comm", name: "Communication", expectations: [{ summary: "A", description: "", level: 1 }] });
  });

  it("accepts levels in any order and with gaps", () => {
    const { category, problems } = read(...header, "## Level 5", "### A", "## Level 2", "### B");
    expect(problems).toEqual([]);
    expect(category?.expectations.map((e) => e.level)).toEqual([5, 2]);
  });

  it("keeps the description as written, with #### headings, lists and code", () => {
    const { category, problems } = read(
      ...header,
      "## Level 1",
      "### A",
      "",
      "#### Notes",
      "",
      "```md",
      "## x",
      "### y",
      "```",
      "",
      "    ## indented",
      "",
      "> ## quoted",
      "",
      "- ## in a list",
      "",
      "tags: [tech]",
    );
    expect(problems).toEqual([]);
    expect(category?.expectations).toHaveLength(1);
    expect(category?.expectations[0].description).toBe(
      ["#### Notes", "", "```md", "## x", "### y", "```", "", "    ## indented", "", "> ## quoted", "", "- ## in a list", "", "tags: [tech]"].join("\n"),
    );
  });

  it("reads setext headings as headings", () => {
    const { category, problems } = read(...header, "Level 1", "-------", "", "Summary", "=======");
    expect(problems.join("\n")).toContain(`${FILE}:10: a "#" heading`);
    expect(category?.expectations).toEqual([]);
    const level = read(...header, "Level 1", "-------", "### A");
    expect(level.problems).toEqual([]);
    expect(level.category?.expectations).toEqual([{ summary: "A", description: "", level: 1 }]);
  });

  it("reads the summary as plain text", () => {
    const { category } = read(...header, "## Level 1", "### Uses `code` and *emphasis* well");
    expect(category?.expectations[0].summary).toBe("Uses code and emphasis well");
  });

  describe("problems", () => {
    it("needs the frontmatter on the first line", () => {
      expect(read("", "---", "key: a", "name: b", "---").problems).toEqual([
        `${FILE}:1: the file must start with a frontmatter ("---" on the first line) holding "key" and "name"`,
      ]);
      expect(read("# Title").problems).toHaveLength(1);
    });

    it("needs the frontmatter to be closed", () => {
      expect(read("---", "key: a", "name: b").problems).toEqual([`${FILE}:1: the frontmatter is not closed; add a "---" line after it`]);
    });

    it("needs key and name", () => {
      expect(read("---", "key: a", "---", "## Level 1", "### A").problems).toEqual([`${FILE}:1: the frontmatter needs a "name"`]);
      expect(read("---", "name: a", "---", "## Level 1", "### A").problems).toEqual([`${FILE}:1: the frontmatter needs a "key"`]);
      expect(read("---", "key: [a]", "name: b", "---", "## Level 1", "### A").problems).toEqual([
        `${FILE}:2: "key" must be a non-empty text`,
      ]);
    });

    it("rejects other frontmatter keys, with the line of the key", () => {
      const { problems } = read("---", "key: a", "name: b", "descripton: typo", "---", "## Level 1", "### A");
      expect(problems).toEqual([`${FILE}:4: "descripton" is not allowed in the frontmatter; use only "key", "name" and "description"`]);
    });

    it("needs the frontmatter to be a mapping", () => {
      expect(read("---", "- a", "---").problems).toEqual([`${FILE}:2: the frontmatter must be a list of "key: value" lines`]);
    });

    it("throws on a YAML syntax error in the frontmatter, naming the file and line", () => {
      expect(() => read("---", "key: a", "name: [unclosed", "---", "## Level 1", "### A")).toThrow(/config\/categories\/01-comm\.md:\d/);
    });

    it("reports content before the first level", () => {
      expect(read(...header, "Intro text.", "", "## Level 1", "### A").problems).toEqual([
        `${FILE}:7: content before the first "## Level N"; every expectation belongs to a level`,
      ]);
    });

    it("reports content between a level and its first expectation", () => {
      expect(read(...header, "## Level 1", "", "A paragraph.", "", "### A").problems).toEqual([
        `${FILE}:9: content between "## Level 1" and its first "###"; write it in the description of an expectation`,
      ]);
    });

    it("reports an expectation before any level", () => {
      expect(read(...header, "### A", "## Level 1", "### B").problems).toEqual([
        `${FILE}:7: "### A" is before the first "## Level N"; every expectation belongs to a level`,
      ]);
    });

    it("reports a # heading", () => {
      expect(read(...header, "# Communication", "## Level 1", "### A").problems).toEqual([
        `${FILE}:7: a "#" heading is not allowed; the category name is in the frontmatter, and "## Level N" opens a level`,
      ]);
    });

    it("reports a ## heading that is not Level N, naming the expected form", () => {
      expect(read(...header, "## Nivel 2", "### A").problems).toEqual([
        `${FILE}:7: "## Nivel 2" is not a level heading; use "## Level N"`,
      ]);
      expect(read(...header, "## Level 0", "### A").problems).toEqual([
        `${FILE}:7: "## Level 0" is not a level heading; use "## Level N"`,
      ]);
      expect(read(...header, "## Level 1.5", "### A")).toMatchObject({ problems: [expect.stringContaining('use "## Level N"')] });
      expect(read(...header, "## **Level** 1", "### A").problems).toHaveLength(1);
    });

    it("reports the same level twice", () => {
      expect(read(...header, "## Level 2", "### A", "## Level 2", "### B").problems).toEqual([
        `${FILE}:9: "## Level 2" is repeated; the first one is on line 7`,
      ]);
    });

    it("reports a level with no expectation", () => {
      expect(read(...header, "## Level 1", "### A", "## Level 3").problems).toEqual([
        `${FILE}:9: "## Level 3" has no expectation; add a "###" heading under it`,
      ]);
    });

    it("reports an empty ### heading", () => {
      expect(read(...header, "## Level 1", "###", "text").problems).toEqual([`${FILE}:8: the "###" heading is empty; write the summary of the expectation`]);
      expect(read(...header, "## Level 1", "### ", "text").problems).toHaveLength(1);
    });

    it("collects every problem of the file", () => {
      const { problems } = read("---", "key: a", "other: x", "---", "# T", "## Nivel 1", "### A", "## Level 1");
      expect(problems).toHaveLength(5);
    });

    it("still returns the category when the structure has problems but key and name are there", () => {
      const { category, problems } = read(...header, "## Nivel 1", "### A", "## Level 2", "### B");
      expect(problems).toHaveLength(1);
      expect(category?.key).toBe("comm");
    });

    it("returns no category when key or name is missing", () => {
      expect(read("---", "name: x", "---", "## Level 1", "### A").category).toBeUndefined();
    });
  });
});
