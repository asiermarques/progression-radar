// Reads one category file (Markdown with a YAML frontmatter) into the raw shape of one entry of categories.yml.
// Build time only: it never reaches the bundle. See docs/adr/0003.
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Heading, Nodes, RootContent } from "mdast";
import { LineCounter, isMap, isScalar, parseDocument } from "yaml";

export interface RawCategory {
  key: string;
  name: string;
  description?: string;
  expectations: { summary: string; description: string; level: number }[];
}

export interface CategoryReading {
  /** Missing only when the frontmatter has no usable "key" and "name". */
  category?: RawCategory;
  /** Each mistake as `<file>:<line>: <message>`. */
  problems: string[];
}

const ALLOWED_KEYS = ["key", "name", "description"];

const plainText = (node: Nodes): string => {
  if ("value" in node && node.type !== "html") return node.value;
  return "children" in node ? (node.children as Nodes[]).map(plainText).join("") : "";
};

/** Splits "---\n…\n---\n" off the start of the file. `bodyLine` is the line (1-based) where the body begins. */
function splitFrontmatter(source: string): { yaml: string; body: string; bodyLine: number } | "missing" | "unclosed" {
  const lines = source.split("\n");
  if (lines[0].trimEnd() !== "---") return "missing";
  const end = lines.findIndex((line, index) => index > 0 && line.trimEnd() === "---");
  if (end === -1) return "unclosed";
  return { yaml: lines.slice(1, end).join("\n"), body: lines.slice(end + 1).join("\n"), bodyLine: end + 2 };
}

/**
 * Reads a category file. `label` is how the file is named in problems, e.g. "config/categories/01-comm.md".
 * Throws on a YAML syntax error in the frontmatter, like the other YAML files do.
 */
export function readCategoryFile(source: string, label: string): CategoryReading {
  const problems: string[] = [];
  const report = (line: number, message: string) => problems.push(`${label}:${line}: ${message}`);

  const parts = splitFrontmatter(source.replace(/\r\n?/g, "\n"));
  if (parts === "missing") {
    report(1, 'the file must start with a frontmatter ("---" on the first line) holding "key" and "name"');
    return { problems };
  }
  if (parts === "unclosed") {
    report(1, 'the frontmatter is not closed; add a "---" line after it');
    return { problems };
  }

  const front = readFrontmatter(parts.yaml, label, report);
  readBody(parts.body, parts.bodyLine - 1, report, front.category);
  return { category: front.category, problems };
}

function readFrontmatter(yaml: string, label: string, report: (line: number, message: string) => void) {
  // The frontmatter starts on line 2 of the file, after the opening "---".
  const lineCounter = new LineCounter();
  const document = parseDocument(yaml, { lineCounter });
  if (document.errors.length > 0) {
    const error = document.errors[0];
    const line = (error.linePos?.[0].line ?? 1) + 1;
    throw new Error(`${label}:${line}: ${error.message.split("\n")[0]}`);
  }

  const map = document.contents;
  if (!isMap(map)) {
    report(2, 'the frontmatter must be a list of "key: value" lines');
    return {};
  }

  const lineOf = (offset: number) => lineCounter.linePos(offset).line + 1;
  const values: Record<string, unknown> = {};
  const lines: Record<string, number> = {};
  for (const pair of map.items) {
    const name = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
    const line = isScalar(pair.key) && pair.key.range ? lineOf(pair.key.range[0]) : 2;
    if (!ALLOWED_KEYS.includes(name)) {
      report(line, `"${name}" is not allowed in the frontmatter; use only "key", "name" and "description"`);
      continue;
    }
    values[name] = isScalar(pair.value) ? pair.value.value : pair.value?.toJSON?.();
    lines[name] = line;
  }

  let valid = true;
  for (const name of ["key", "name"]) {
    if (!(name in values)) {
      report(1, `the frontmatter needs a "${name}"`);
      valid = false;
    } else if (typeof values[name] !== "string" || values[name].trim() === "") {
      report(lines[name], `"${name}" must be a non-empty text`);
      valid = false;
    }
  }
  if ("description" in values && values.description !== null && typeof values.description !== "string") {
    report(lines.description, '"description" must be text');
  }
  if (!valid) return {};

  const category: RawCategory = { key: values.key as string, name: values.name as string, expectations: [] };
  if (typeof values.description === "string") category.description = values.description;
  return { category };
}

interface OpenLevel {
  number: number;
  line: number;
  count: number;
  /** A repeated level is read but not kept. */
  ignored: boolean;
}

function readBody(
  body: string,
  lineOffset: number,
  report: (line: number, message: string) => void,
  category: RawCategory | undefined,
) {
  const tree = fromMarkdown(body);
  const lineOf = (node: RootContent) => node.position!.start.line + lineOffset;
  const offsetEnd = (node: RootContent) => node.position!.end.offset!;
  const offsetStart = (node: RootContent) => node.position!.start.offset!;

  const levels = new Map<number, number>();
  let level: OpenLevel | undefined;
  let expectation: { summary: string; level: number; from: number } | undefined;
  let strayReported = false;

  const closeExpectation = (until: number) => {
    if (expectation && category && !level?.ignored) {
      category.expectations.push({
        summary: expectation.summary,
        description: body.slice(expectation.from, until).trim(),
        level: expectation.level,
      });
    }
    expectation = undefined;
  };
  const closeLevel = () => {
    if (level && level.count === 0) {
      report(level.line, `"## Level ${level.number}" has no expectation; add a "###" heading under it`);
    }
  };

  for (const node of tree.children) {
    const heading = node.type === "heading" ? node : undefined;

    if (heading?.depth === 1) {
      closeExpectation(offsetStart(node));
      report(lineOf(node), 'a "#" heading is not allowed; the category name is in the frontmatter, and "## Level N" opens a level');
    } else if (heading?.depth === 2) {
      closeExpectation(offsetStart(node));
      closeLevel();
      level = undefined;
      strayReported = false;
      const text = plainText(heading);
      const number = levelNumber(heading);
      if (number === undefined) {
        report(lineOf(node), `"## ${text}" is not a level heading; use "## Level N"`);
        // Its expectations are read but not kept, so they are not reported again as being outside a level.
        level = { number: 0, line: lineOf(node), count: 1, ignored: true };
        continue;
      }
      const first = levels.get(number);
      if (first !== undefined) report(lineOf(node), `"## Level ${number}" is repeated; the first one is on line ${first}`);
      else levels.set(number, lineOf(node));
      level = { number, line: lineOf(node), count: 0, ignored: first !== undefined };
    } else if (heading?.depth === 3) {
      closeExpectation(offsetStart(node));
      const summary = plainText(heading).trim();
      if (!level) {
        report(lineOf(node), `"### ${summary}" is before the first "## Level N"; every expectation belongs to a level`);
        strayReported = true;
        continue;
      }
      if (summary === "") {
        report(lineOf(node), 'the "###" heading is empty; write the summary of the expectation');
        level.count++;
        strayReported = true;
        continue;
      }
      level.count++;
      expectation = { summary, level: level.number, from: offsetEnd(node) };
    } else if (!expectation && !strayReported) {
      strayReported = true;
      report(
        lineOf(node),
        level
          ? `content between "## Level ${level.number}" and its first "###"; write it in the description of an expectation`
          : 'content before the first "## Level N"; every expectation belongs to a level',
      );
    }
  }
  closeExpectation(body.length);
  closeLevel();
}

/** N of a heading that is exactly "Level N" with N a positive integer, else undefined. */
function levelNumber(heading: Heading): number | undefined {
  if (heading.children.length !== 1 || heading.children[0].type !== "text") return undefined;
  const match = /^Level ([1-9]\d*)$/.exec(heading.children[0].value);
  return match ? Number(match[1]) : undefined;
}
