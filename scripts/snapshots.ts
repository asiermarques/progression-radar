// Records Persons in dated CSV snapshots, turns a recorded row back into a Share link and checks snapshots against the
// current Configuration. Node only, local tooling: the app never reads these files. Run it through
// `npm run snapshot:record`, `snapshot:link` and `snapshot:check`. See docs/adr/0004.
//
// The Share link is read with src/urlState.ts and the Configuration comes from parseConfig(), so the rules live in one
// place. A snapshot is history: the only thing this file does to an existing snapshot is append a row at its end.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { maxLevel, type Config, type Person } from "../src/model.ts";
import { parseState, toUrl } from "../src/urlState.ts";
import {
  CsvError,
  detectLineBreak,
  formatRow,
  parseCsv,
  splitHeader,
  type CsvRecord,
  type LineBreak,
  type Separator,
} from "./csv.ts";

export const SNAPSHOTS_DIR_VARIABLE = "PROGRESSION_RADAR_SNAPSHOTS_DIR";
export const DEFAULT_SNAPSHOTS_FOLDER = "snapshots";
/** Where the app runs in development: the default base of the links that `snapshot:link` prints. */
export const DEFAULT_BASE_URL = "http://localhost:5173/";

/** The columns every snapshot has, before the one column per Category. They are the Share link field names. */
export const FIXED_COLUMNS = ["id", "name", "role", "compare", "tags"];
export const TAGS_SEPARATOR = "|";

const EXAMPLE_NAME = "2026-11-07.csv";
const CHECK_HINT = "run `npm run snapshot:check` to see what is wrong with the file";

/** A problem the person can fix; the message says how. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

export interface SnapshotsFolder {
  path: string;
  /** How the folder is named in messages: "snapshots", or the value of PROGRESSION_RADAR_SNAPSHOTS_DIR. */
  label: string;
}

/** The snapshots folder: `snapshots/` at the project root, or `setting` (PROGRESSION_RADAR_SNAPSHOTS_DIR). */
export function resolveSnapshotsFolder(root: string, setting: string | undefined): SnapshotsFolder {
  if (!setting) return { path: join(root, DEFAULT_SNAPSHOTS_FOLDER), label: DEFAULT_SNAPSHOTS_FOLDER };
  const label = setting.length > 1 ? setting.replace(/[\\/]+$/, "") : setting;
  return { path: isAbsolute(setting) ? resolve(setting) : resolve(root, setting), label };
}

// ---------------------------------------------------------------------------------------------------------------------
// Names

const SNAPSHOT_NAME = /^(\d{4})-(\d{2})-(\d{2})(.*)\.csv$/;

/** Whether a file name starts with a real `YYYY-MM-DD` date and ends in `.csv`. */
export function isSnapshotName(name: string): boolean {
  const match = SNAPSHOT_NAME.exec(name);
  if (!match || /[\\/]/.test(name)) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const NOT_A_SNAPSHOT_NAME = `it must start with a date and end in .csv, e.g. ${EXAMPLE_NAME} or 2026-11-07-q4-review.csv`;

const isoDate = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part, i) => String(part).padStart(i === 0 ? 4 : 2, "0")).join("-");

/** The name of a snapshot to read or write, with the same check in every command. */
function requireFileName(name: string, strict: boolean): string {
  if (/[\\/]/.test(name)) throw new SnapshotError(`"${name}" is a path: give the name of a file in the snapshots folder, e.g. ${EXAMPLE_NAME}`);
  if (strict && !isSnapshotName(name)) throw new SnapshotError(`"${name}" is not a valid snapshot name: ${NOT_A_SNAPSHOT_NAME}`);
  return name;
}

function requireId(id: string): string {
  if (id === "" || /[\s,;"|]/.test(id)) {
    throw new SnapshotError(`The id ${JSON.stringify(id)} is not valid: it needs at least one character and no spaces or , ; " | (for example ana-garcia)`);
  }
  return id;
}

// ---------------------------------------------------------------------------------------------------------------------
// Rows

/** The header of a new snapshot: the fixed columns, then one per Category in Configuration order. */
export function headerFor(config: Config): string[] {
  return [...FIXED_COLUMNS, ...config.categories.map((category) => category.key)];
}

/** One cell of the row of `person`, for the column named `column`; empty for a column that is not in the Configuration. */
function cellFor(column: string, id: string, person: Person): string {
  switch (column) {
    case "id":
      return id;
    case "name":
      return person.name;
    case "role":
      return person.roleKey ?? "";
    case "compare":
      return person.compareTo ?? "";
    case "tags":
      return person.tags.join(TAGS_SEPARATOR);
    default:
      return Object.hasOwn(person.levels, column) ? String(person.levels[column]) : "";
  }
}

const isLevel = (cell: string) => /^\d+$/.test(cell);

/** A recorded row as a Person: the reverse of `cellFor`. A level cell that is empty is not recorded. */
function personOf(cells: Record<string, string>, config: Config): Person | undefined {
  const levels: Person["levels"] = {};
  for (const category of config.categories) {
    const cell = cells[category.key];
    if (cell === undefined || cell === "") continue;
    if (!isLevel(cell)) return undefined;
    levels[category.key] = Number(cell);
  }
  return {
    name: cells.name ?? "",
    roleKey: cells.role || undefined,
    compareTo: cells.compare || undefined,
    tags: (cells.tags ?? "").split(TAGS_SEPARATOR).filter((tag) => tag !== ""),
    levels,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Reading a snapshot

interface SnapshotFile {
  text: string;
  separator: Separator;
  eol: LineBreak;
  columns: string[];
  /** The records after the header. */
  rows: CsvRecord[];
}

const BOM = "﻿";

class NotUtf8 extends Error {}

/** The text of a file without its byte-order mark, which is left in the file. */
function decode(buffer: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);
  } catch {
    throw new NotUtf8();
  }
  return text.startsWith(BOM) ? text.slice(1) : text;
}

const NOT_UTF8 = 'is not UTF-8: save it from your spreadsheet as "CSV UTF-8"';

/** Splits the text of a snapshot into its header and rows. Throws CsvError when it cannot be read unambiguously. */
function parseSnapshot(text: string): SnapshotFile {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() !== "");
  if (headerIndex === -1) throw new CsvError("has no header");
  let split: ReturnType<typeof splitHeader>;
  try {
    split = splitHeader(lines[headerIndex]);
  } catch (error) {
    if (error instanceof CsvError) throw new CsvError(error.reason, headerIndex + 1);
    throw error;
  }
  const [, ...rows] = parseCsv(text, split.separator);
  return { text, separator: split.separator, eol: detectLineBreak(text), columns: split.columns, rows };
}

/** The snapshot for `record` and `link`: anything it cannot read is refused, with the hint to run the check. */
function readSnapshot(path: string, label: string): SnapshotFile {
  if (!existsSync(path) || !statSync(path).isFile()) throw new SnapshotError(`${label} does not exist`);
  let text: string;
  try {
    text = decode(readFileSync(path));
  } catch (error) {
    if (error instanceof NotUtf8) throw new SnapshotError(`${label} ${NOT_UTF8}`);
    throw error;
  }
  let file: SnapshotFile;
  try {
    file = parseSnapshot(text);
  } catch (error) {
    if (!(error instanceof CsvError)) throw error;
    throw new SnapshotError(`${label} cannot be read: ${error.message}; ${CHECK_HINT}`);
  }
  if (!file.columns.includes("id")) throw new SnapshotError(`${label} has no id column; ${CHECK_HINT}`);
  return file;
}

// ---------------------------------------------------------------------------------------------------------------------
// Recording

export interface RecordOptions {
  /** The project root. */
  root: string;
  /** The value of PROGRESSION_RADAR_SNAPSHOTS_DIR. */
  setting?: string;
  config: Config;
  /** The Share link of the Person. */
  link: string;
  id: string;
  /** The file name; default: today's date and `.csv`. */
  snapshot?: string;
  today?: Date;
}

export interface RecordResult {
  /** The snapshot as named in messages, e.g. "snapshots/2026-11-07.csv". */
  file: string;
  created: boolean;
  /** The line of the new row. */
  line: number;
  /** The row as written, without the line break. */
  row: string;
  /** Data of the link that Normalisation dropped or corrected. */
  ignored: string[];
  /** Current Categories that the header of an existing snapshot does not have, so they are not recorded. */
  notRecorded: string[];
}

function personFromLink(link: string, config: Config): { person: Person; ignored: string[] } {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new SnapshotError(`"${link}" is not a Share link: it is not a URL. Copy it from the app with "Copy link" and put it in quotes`);
  }
  const state = parseState({ search: url.search, hash: url.hash }, config);
  if (state.kind === "empty") throw new SnapshotError("The link has no data: copy it from the app with \"Copy link\", and put it in quotes");
  if (state.kind === "invalid") throw new SnapshotError(`The link is not valid: ${state.reason}`);
  return { person: state.person, ignored: state.issues };
}

/** Appends a Person to a snapshot, creating the file with its header when it does not exist. Refuses a repeated id. */
export function recordPerson(options: RecordOptions): RecordResult {
  const { root, config, link } = options;
  const id = requireId(options.id);
  const name = requireFileName(options.snapshot ?? `${isoDate(options.today ?? new Date())}.csv`, true);
  const { person, ignored } = personFromLink(link, config);
  const badTag = person.tags.find((tag) => tag.includes(TAGS_SEPARATOR));
  if (badTag !== undefined) {
    throw new SnapshotError(`The tag "${badTag}" has a "${TAGS_SEPARATOR}", which separates the tags in a snapshot: rename it in the app and copy the link again`);
  }

  const folder = resolveSnapshotsFolder(root, options.setting);
  const path = join(folder.path, name);
  const file = `${folder.label}/${name}`;

  if (!existsSync(path)) {
    const columns = headerFor(config);
    const row = formatRow(columns.map((column) => cellFor(column, id, person)), ",");
    mkdirSync(folder.path, { recursive: true });
    writeFileSync(path, `${formatRow(columns, ",")}\n${row}\n`, { flag: "wx" });
    return { file, created: true, line: 2, row, ignored, notRecorded: [] };
  }

  const existing = readSnapshot(path, file);
  const idColumn = existing.columns.indexOf("id");
  const repeated = existing.rows.find((row) => row.fields[idColumn] === id);
  if (repeated) throw new SnapshotError(`The id "${id}" is already in ${file} on line ${repeated.line}; snapshots are never rewritten, so edit that row by hand or use another id`);

  const row = formatRow(existing.columns.map((column) => cellFor(column, id, person)), existing.separator);
  // Only bytes at the end of the file are added; a missing final line break is the one thing completed first.
  const physicalLines = existing.text.split("\n").length - (existing.text.endsWith("\n") ? 1 : 0);
  appendFileSync(path, `${existing.text.endsWith("\n") ? "" : existing.eol}${row}${existing.eol}`);
  const notRecorded = config.categories.map((category) => category.key).filter((key) => !existing.columns.includes(key));
  return { file, created: false, line: physicalLines + 1, row, ignored, notRecorded };
}

// ---------------------------------------------------------------------------------------------------------------------
// Opening a recorded Person

export interface LinkOptions {
  root: string;
  setting?: string;
  config: Config;
  snapshot: string;
  id: string;
  /** The URL of the app the link opens; default: the development server. */
  base?: string;
}

export interface LinkResult {
  link: string;
  /** Columns with data that the Configuration no longer has: the link carries them and the app ignores them. */
  ignoredColumns: string[];
}

/** The Share link of a recorded row. */
export function snapshotLink(options: LinkOptions): LinkResult {
  const { config, id } = options;
  const base = options.base ?? DEFAULT_BASE_URL;
  try {
    new URL(base);
  } catch {
    throw new SnapshotError(`--base ${JSON.stringify(base)} is not a URL; give the address of the app, e.g. ${DEFAULT_BASE_URL}`);
  }
  const folder = resolveSnapshotsFolder(options.root, options.setting);
  const name = requireFileName(options.snapshot, false);
  const file = `${folder.label}/${name}`;
  const snapshot = readSnapshot(join(folder.path, name), file);

  const idColumn = snapshot.columns.indexOf("id");
  const row = snapshot.rows.find((candidate) => candidate.fields[idColumn] === id);
  if (!row) throw new SnapshotError(`There is no row with the id "${id}" in ${file}`);
  if (row.fields.length !== snapshot.columns.length) {
    throw new SnapshotError(`The row of "${id}" in ${file} (line ${row.line}) has ${row.fields.length} fields and the header has ${snapshot.columns.length}; ${CHECK_HINT}`);
  }
  const cells = Object.fromEntries(snapshot.columns.map((column, index) => [column, row.fields[index]]));
  const person = personOf(cells, config);
  if (!person) throw new SnapshotError(`The row of "${id}" in ${file} (line ${row.line}) has a level that is not a number; ${CHECK_HINT}`);

  const known = new Set([...FIXED_COLUMNS, ...config.categories.map((category) => category.key)]);
  const extra = snapshot.columns.filter((column) => !known.has(column) && cells[column] !== "");
  const url = new URL(toUrl(person, config, base));
  const params = new URLSearchParams(url.hash.slice(1));
  for (const column of extra) params.append(column, cells[column]);
  url.hash = params.toString();
  return { link: url.toString(), ignoredColumns: extra };
}

// ---------------------------------------------------------------------------------------------------------------------
// Checking

export interface Problem {
  /** Errors are wrong whatever the Ladder is; warnings are data that no longer fits the Configuration and is kept. */
  severity: "error" | "warning";
  /** The snapshot as named in messages, e.g. "snapshots/2026-11-07.csv". */
  file: string;
  line?: number;
  message: string;
}

export interface CheckOptions {
  root: string;
  setting?: string;
  config: Config;
  /** One file name in the snapshots folder; default: every file in it. */
  file?: string;
}

export interface CheckResult {
  /** Snapshot files read. */
  checked: number;
  problems: Problem[];
}

/** Checks one snapshot or the whole folder against the Configuration. It never changes a file. */
export function checkSnapshots(options: CheckOptions): CheckResult {
  const folder = resolveSnapshotsFolder(options.root, options.setting);
  const problems: Problem[] = [];

  let names: string[];
  if (options.file !== undefined) {
    const name = requireFileName(options.file, false);
    if (!existsSync(join(folder.path, name)) || !statSync(join(folder.path, name)).isFile()) {
      throw new SnapshotError(`${folder.label}/${name} does not exist`);
    }
    names = [name];
  } else if (!existsSync(folder.path)) {
    return { checked: 0, problems };
  } else {
    names = readdirSync(folder.path, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && entry.name !== "README.md")
      .map((entry) => entry.name)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  let checked = 0;
  for (const name of names) {
    const file = `${folder.label}/${name}`;
    if (!name.endsWith(".csv")) {
      problems.push({ severity: "warning", file, message: "is not a snapshot: only .csv files are read" });
      continue;
    }
    checked++;
    problems.push(...checkFile(join(folder.path, name), name, file, options.config));
  }
  return { checked, problems };
}

function checkFile(path: string, name: string, file: string, config: Config): Problem[] {
  const problems: Problem[] = [];
  const error = (message: string, line?: number) => problems.push({ severity: "error", file, line, message });
  const warning = (message: string, line?: number) => problems.push({ severity: "warning", file, line, message });

  if (!isSnapshotName(name)) error(`is not a valid snapshot name: ${NOT_A_SNAPSHOT_NAME}`);

  let snapshot: SnapshotFile;
  try {
    snapshot = parseSnapshot(decode(readFileSync(path)));
  } catch (caught) {
    if (caught instanceof NotUtf8) error(NOT_UTF8);
    else if (caught instanceof CsvError) error(caught.reason, caught.line);
    else throw caught;
    return problems;
  }

  const { columns } = snapshot;
  if (!columns.includes("id")) {
    error("has no id column", 1);
    return problems;
  }
  const categories = new Map(config.categories.map((category) => [category.key, category]));
  const seenColumns = new Set<string>();
  for (const column of columns) {
    if (seenColumns.has(column)) error(`duplicated column "${column}"`, 1);
    else if (!FIXED_COLUMNS.includes(column) && !categories.has(column)) {
      warning(`column "${column}" is not a Category of the current Configuration: the data is kept but the app ignores it`, 1);
    }
    seenColumns.add(column);
  }

  const idColumn = columns.indexOf("id");
  const seenIds = new Map<string, number>();
  for (const row of snapshot.rows) {
    if (row.fields.length !== columns.length) {
      error(`has ${row.fields.length} fields and the header has ${columns.length}`, row.line);
      continue;
    }
    const id = row.fields[idColumn];
    if (id === "") error("has an empty id", row.line);
    else if (seenIds.has(id)) error(`duplicated id "${id}" (also on line ${seenIds.get(id)})`, row.line);
    else seenIds.set(id, row.line);

    columns.forEach((column, index) => {
      const cell = row.fields[index];
      if ((column === "role" || column === "compare") && cell !== "" && !config.roles.some((role) => role.key === cell)) {
        warning(`${column} "${cell}" is not a role of the current Configuration`, row.line);
      }
      const category = categories.get(column);
      if (!category || cell === "") return;
      if (!isLevel(cell)) error(`level "${cell}" in "${column}" is not a non-negative integer`, row.line);
      else if (Number(cell) > maxLevel(category)) {
        warning(`level ${cell} in "${column}" is above its highest level, ${maxLevel(category)}`, row.line);
      }
    });
  }
  return problems;
}
