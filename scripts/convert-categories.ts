// Converts the categories.yml of the configuration folder into a categories/ folder of Markdown category files.
// Node only, build-time tooling: it never stages or commits. Run it with `npm run config:convert-categories`.
// The only code that reads a categories.yml: the app no longer does (docs/adr/0006).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import { parse, stringify } from "yaml";
import { ConfigError, parseConfig } from "../src/config.ts";
import type { Category } from "../src/model.ts";
import { CATEGORIES_FILE, CATEGORIES_FOLDER, DEFAULT_CONFIG_FOLDER } from "./config-sources.ts";

/** A problem the person can fix; the message says how. */
export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionError";
  }
}

export interface ConvertOptions {
  /** The project root. */
  cwd: string;
  /** The configuration folder, relative to `cwd` (default "config"), e.g. the value of PROGRESSION_RADAR_CONFIG_DIR. */
  configDir?: string;
  log?: (line: string) => void;
}

export interface ConvertResult {
  /** The files written, relative to `cwd`. */
  written: string[];
  /** What was changed on the way, one line each. */
  changes: string[];
}

const BACKUP = `${CATEGORIES_FILE}.bak`;

/** Backslash-escapes what would otherwise be read as Markdown inside a heading. */
function escapeHeading(text: string): string {
  return text.replace(/[\\`*_[\]<>]/g, "\\$&").replace(/(^|\s)(#+)$/, "$1\\$2");
}

interface Lowered {
  text: string;
  /** One line per heading changed. */
  changes: string[];
}

/** Turns the #, ## and ### headings of a Markdown description (and only those, not code or quotes) into ####. */
export function lowerHeadings(description: string): Lowered {
  const tree = fromMarkdown(description);
  const changes: string[] = [];
  let text = description;
  const headings = tree.children.flatMap((node) => (node.type === "heading" && node.depth <= 3 ? [node] : []));
  // From the end, so the offsets of the headings before stay valid.
  for (const heading of headings.reverse()) {
    const start = heading.position!.start.offset!;
    const end = heading.position!.end.offset!;
    const original = description.slice(start, end);
    const first = heading.children[0]?.position?.start.offset;
    const last = heading.children.at(-1)?.position?.end.offset;
    const inner = first !== undefined && last !== undefined ? description.slice(first, last) : "";
    const lowered = `#### ${inner}`.trimEnd();
    text = text.slice(0, start) + lowered + text.slice(end);
    const setext = !original.trimStart().startsWith("#");
    changes.unshift(
      setext ? `"${inner}" (underlined) became "${lowered}"` : `"${original.trim()}" became "${lowered}"`,
    );
  }
  return { text, changes };
}

function categoryFile(category: Category): { text: string; changes: string[] } {
  const changes: string[] = [];
  const front: Record<string, string> = { key: category.key, name: category.name };
  if (category.description !== "") front.description = category.description;
  const sections = [`---\n${stringify(front, { lineWidth: 0 }).trimEnd()}\n---`];

  const levels = [...new Set(category.expectations.map((expectation) => expectation.level))].sort((a, b) => a - b);
  for (const level of levels) {
    sections.push(`## Level ${level}`);
    for (const expectation of category.expectations.filter((candidate) => candidate.level === level)) {
      const summary = expectation.summary.trim().replace(/\s*\n\s*/g, " ");
      if (summary !== expectation.summary.trim()) {
        changes.push(`${category.key}: the summary "${summary}" had a line break; it is now one line`);
      }
      sections.push(`### ${escapeHeading(summary)}`);

      const { text, changes: lowered } = lowerHeadings(expectation.description.trim());
      for (const change of lowered) changes.push(`${category.key} / "${summary}": ${change}`);
      if (text !== "") sections.push(text);
    }
  }
  return { text: `${sections.join("\n\n")}\n`, changes };
}

/**
 * Reads "kpis", the legacy name of "expectations" that only a categories.yml can have, so that it converts too.
 * A category with both is a reason not to convert.
 */
function withLegacyNames(raw: unknown, file: string, reasons: string[]): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((item: unknown, index) => {
    if (typeof item !== "object" || item === null || !("kpis" in item)) return item;
    const { kpis, ...category } = item as Record<string, unknown>;
    if ("expectations" in category) {
      reasons.push(`${file} entry #${index + 1}: category "${String(category.key)}" has both "expectations" and "kpis"; keep only "expectations"`);
      return category;
    }
    return { ...category, expectations: kpis };
  });
}

/**
 * Converts `<configDir>/categories.yml` into `<configDir>/categories/NN-<key>.md` and renames the YAML to
 * `categories.yml.bak`. Writes nothing and throws a ConversionError when the YAML has a configuration problem or
 * the destination is taken.
 */
export async function convertCategories(options: ConvertOptions): Promise<ConvertResult> {
  const { cwd, configDir = DEFAULT_CONFIG_FOLDER, log = console.log } = options;
  const folder = join(cwd, configDir);
  const source = join(folder, CATEGORIES_FILE);
  const target = join(folder, CATEGORIES_FOLDER);
  const label = (name: string) => `${configDir}/${name}`;

  if (!existsSync(source)) throw new ConversionError(`${label(CATEGORIES_FILE)} does not exist; there is nothing to convert.`);
  const reasons: string[] = [];
  if (existsSync(target)) reasons.push(`${label(CATEGORIES_FOLDER)}/ already exists; remove it or convert by hand.`);
  if (existsSync(join(folder, BACKUP))) reasons.push(`${label(BACKUP)} already exists; remove it first.`);

  let categories: Category[] = [];
  try {
    const raw = withLegacyNames(parse(readFileSync(source, "utf8")), label(CATEGORIES_FILE), reasons);
    categories = parseConfig({ categories: raw, roles: null, site: null }, {}, {
      categories: label(CATEGORIES_FILE),
      // The app names categories by their file; here each one is an entry of the YAML list.
      categoryFiles: Array.isArray(raw) ? raw.map((_, index) => `${label(CATEGORIES_FILE)} entry #${index + 1}`) : [],
      roles: "roles.yml",
      site: "site.yml",
      folders: [],
    }).categories;
  } catch (error) {
    if (error instanceof ConfigError) reasons.push(...error.problems);
    else if (error instanceof Error) reasons.push(`${label(CATEGORIES_FILE)}: ${error.message}`);
    else throw error;
  }
  if (reasons.length > 0) {
    throw new ConversionError(`Nothing was converted:\n${reasons.map((reason) => `  - ${reason}`).join("\n")}`);
  }

  // At least two digits (01-comm.md), more when there are a hundred categories or more.
  const width = Math.max(2, String(categories.length).length);
  mkdirSync(target, { recursive: true });
  const written: string[] = [];
  const changes: string[] = [];
  categories.forEach((category, index) => {
    const safeKey = category.key.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    const name = `${String(index + 1).padStart(width, "0")}-${safeKey}.md`;
    const file = categoryFile(category);
    writeFileSync(join(target, name), file.text);
    written.push(`${label(CATEGORIES_FOLDER)}/${name}`);
    changes.push(...file.changes);
  });
  renameSync(source, join(folder, BACKUP));

  log(`Wrote ${written.length} category file(s):\n${written.map((file) => `  ${file}`).join("\n")}`);
  if (changes.length > 0) log(`\nChanged on the way:\n${changes.map((change) => `  ${change}`).join("\n")}`);
  log(
    [
      "",
      `${label(CATEGORIES_FILE)} was renamed to ${label(BACKUP)}. The build warns about it until you remove it.`,
      "Nothing was staged or committed. Next steps:",
      "  1. Run npm run dev and check the ladder.",
      `  2. Delete ${label(BACKUP)} when you are happy with the result.`,
    ].join("\n"),
  );
  return { written, changes };
}
