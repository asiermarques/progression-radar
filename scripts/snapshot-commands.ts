// The snapshot commands behind `npm run snapshot:record`, `snapshot:link`, `snapshot:check` and `snapshot:report`: argument
// parsing, output and exit codes. The rules are in snapshots.ts; this file only talks to the person who runs them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ConfigError, loadConfig } from "../src/config.ts";
import type { Config } from "../src/model.ts";
import { CONFIG_DIR_VARIABLE, resolveConfigSources } from "./config-sources.ts";
import { buildReport } from "./report.ts";
import { renderReport } from "./report-html.tsx";
import {
  SNAPSHOTS_DIR_VARIABLE,
  SnapshotError,
  checkSnapshots,
  isoDate,
  readSnapshotRows,
  recordPerson,
  resolveSnapshotsFolder,
  snapshotLink,
} from "./snapshots.ts";

export interface Io {
  /** Standard output: what other programs may read, e.g. the link. */
  out(line: string): void;
  /** Standard error: messages for the person. */
  err(line: string): void;
}

export interface Context {
  /** The project root. */
  root: string;
  env: Record<string, string | undefined>;
  io: Io;
  /** The date of "today", for the default snapshot name. */
  today?: Date;
  /** The installed radar, where config.example/ is; default: the project root (a fork). */
  packageRoot?: string;
  /** The Configuration to use; default: the resolved configuration of the project. */
  loadConfig?: () => Config;
}

const USAGE = [
  "Usage:",
  '  npm run snapshot:record -- "<share link>" --id <id> [--snapshot <YYYY-MM-DD[-text].csv>]',
  "  npm run snapshot:link -- <snapshot.csv> <id> [--base <app URL>]",
  "  npm run snapshot:check -- [<snapshot.csv>]",
  "  npm run snapshot:report -- [<snapshot.csv>...] [--id <id>] [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--compare <role>] [--out <path>]",
];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Runs one command. Returns the exit code: 0 when it worked, 1 when it did not. */
export function runSnapshotCommand(argv: string[], context: Context): number {
  const { io } = context;
  try {
    return run(argv, context);
  } catch (error) {
    if (error instanceof SnapshotError) {
      io.err(error.message);
      return 1;
    }
    if (error instanceof ConfigError) {
      io.err(`The Configuration has problems, so the snapshots cannot be read against it:\n- ${error.problems.join("\n- ")}`);
      return 1;
    }
    throw error;
  }
}

function run(argv: string[], context: Context): number {
  const { io } = context;
  const [command, ...rest] = argv;
  if (command !== "record" && command !== "link" && command !== "check" && command !== "report") {
    io.err(USAGE.join("\n"));
    return 1;
  }

  let parsed: ReturnType<typeof parseArgs<{ allowPositionals: true; options: Record<string, { type: "string" }> }>>;
  try {
    parsed = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        id: { type: "string" },
        snapshot: { type: "string" },
        base: { type: "string" },
        compare: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        out: { type: "string" },
      },
    });
  } catch (error) {
    io.err(`${(error as Error).message}\n${USAGE.join("\n")}`);
    return 1;
  }
  const { positionals, values } = parsed;
  const setting = context.env[SNAPSHOTS_DIR_VARIABLE] || undefined;
  const common = { root: context.root, setting };

  if (command === "report") {
    const { snapshot, base, ...options } = values;
    if (snapshot !== undefined || base !== undefined) throw new SnapshotError(`snapshot:report does not take --snapshot or --base.\n${USAGE[4]}`);
    return report(context, { setting: common.setting, files: positionals, ...options });
  }

  if (command === "record") {
    const [link] = positionals;
    if (!link) throw new SnapshotError(`Give the Share link of the Person, in quotes.\n${USAGE[1]}`);
    if (values.id === undefined) throw new SnapshotError(`Give the id of the Person with --id, e.g. --id ana-garcia.\n${USAGE[1]}`);
    const config = (context.loadConfig ?? loadConfig)();
    const result = recordPerson({ ...common, config, link, id: values.id, snapshot: values.snapshot, today: context.today });
    io.out(`Recorded ${values.id} in ${result.file} (${result.created ? "new file" : "existing file"}, line ${result.line}):`);
    io.out(result.row);
    if (result.ignored.length > 0) io.out(`Ignored in the link: ${result.ignored.join(", ")}`);
    if (result.notRecorded.length > 0) io.out(`${result.file} has no column for: ${result.notRecorded.join(", ")}; they were not recorded`);
    return 0;
  }

  if (command === "link") {
    const [snapshot, id] = positionals;
    if (!snapshot || !id) throw new SnapshotError(`Give the snapshot and the id.\n${USAGE[2]}`);
    const config = (context.loadConfig ?? loadConfig)();
    const result = snapshotLink({ ...common, config, snapshot, id, base: values.base });
    io.out(result.link);
    for (const column of result.ignoredColumns) {
      io.err(`The column "${column}" is not a Category of the current Configuration: the link carries it and the app will ignore it`);
    }
    return 0;
  }

  const config = (context.loadConfig ?? loadConfig)();
  const { checked, problems } = checkSnapshots({ ...common, config, file: positionals[0] });
  if (checked === 0 && problems.length === 0) {
    io.out(`No snapshots to check in ${resolveSnapshotsFolder(context.root, setting).label}/.`);
    return 0;
  }
  for (const problem of problems) {
    io.out(`${problem.file}${problem.line ? `:${problem.line}` : ""}: ${problem.severity}: ${problem.message}`);
  }
  const errors = problems.filter((problem) => problem.severity === "error").length;
  io.out(`Checked ${plural(checked, "snapshot")}: ${plural(errors, "error")}, ${plural(problems.length - errors, "warning")}.`);
  return errors > 0 ? 1 : 0;
}

const REPORTS_FOLDER = "reports";

/** The part of src/styles.css between two of its section comments, e.g. the custom properties before `/* Base *\/`. */
function stylesBetween(styles: string, from: string | undefined, to: string): string {
  const start = from === undefined ? 0 : styles.indexOf(from);
  const end = styles.indexOf(to);
  if (start === -1 || end === -1) throw new Error(`src/styles.css has no \`${from ?? "start"}\` or \`${to}\` comment`);
  return styles.slice(start, end);
}

/** What the Report takes from the app's styles: the custom properties, light and dark, and the radar rules. */
function appStyles(): string {
  const styles = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
  return [stylesBetween(styles, undefined, "/* Base */"), stylesBetween(styles, "/* Radar chart */", "/* Categories */")].join("\n");
}

/** The theme.css of the Config folder, else the example one: the same file the app is built with. */
function themeCss(context: Context): string {
  const path = resolveConfigSources(context.root, context.env[CONFIG_DIR_VARIABLE] || undefined, context.packageRoot ?? context.root)
    .files["theme.css"].path;
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

interface ReportArguments {
  setting: string | undefined;
  files: string[];
  id?: string;
  from?: string;
  to?: string;
  compare?: string;
  out?: string;
}

/** Where the Report is written: never inside the Snapshots folder (where the check warns about any file that is not a CSV) or dist/. */
function reportPath(context: Context, setting: string | undefined, out: string | undefined, generatedOn: string): { path: string; shown: string } {
  const shown = out ?? `${REPORTS_FOLDER}/${generatedOn}.html`;
  const path = resolve(context.root, shown);
  const inside = (folder: string) => {
    const fromFolder = relative(folder, path);
    return fromFolder !== "" && !fromFolder.startsWith("..") && !isAbsolute(fromFolder);
  };
  const snapshots = resolveSnapshotsFolder(context.root, setting);
  if (inside(snapshots.path)) {
    throw new SnapshotError(`${shown} is inside the Snapshots folder (${snapshots.label}/), where only snapshots belong: choose a path in ${REPORTS_FOLDER}/`);
  }
  if (inside(join(context.root, "dist"))) throw new SnapshotError(`${shown} is inside dist/, which a build empties and deploys: choose a path in ${REPORTS_FOLDER}/`);
  return { path, shown };
}

function report(context: Context, { setting, files, id, from, to, compare, out }: ReportArguments): number {
  const { io } = context;
  const config = (context.loadConfig ?? loadConfig)();
  if (compare !== undefined && !config.roles.some((role) => role.key === compare)) {
    const known = config.roles.map((role) => role.key).join(", ");
    throw new SnapshotError(`--compare ${JSON.stringify(compare)} is not a role of the Configuration${known ? `; the roles are: ${known}` : ""}`);
  }
  const generatedOn = isoDate(context.today ?? new Date());
  const target = reportPath(context, setting, out, generatedOn);
  const { rows, problems } = readSnapshotRows({ root: context.root, setting, config, files, id, from, to });
  const print = (problem: (typeof problems)[number]) =>
    io.err(`${problem.file}${problem.line ? `:${problem.line}` : ""}: ${problem.severity}: ${problem.message}`);
  problems.forEach(print);
  if (problems.some((problem) => problem.severity === "error")) {
    io.err("No report was written: fix the errors above (see `npm run snapshot:check`).");
    return 1;
  }
  if (rows.length === 0) {
    const narrowed = files.length > 0 || id !== undefined || from !== undefined || to !== undefined;
    io.err(
      narrowed
        ? "There is no row to report with these snapshots, --id and dates: check them against `npm run snapshot:check`."
        : `There is no row to report in ${resolveSnapshotsFolder(context.root, setting).label}/: record a Person with \`npm run snapshot:record\` first.`,
    );
    return 1;
  }

  const html = renderReport(buildReport({ config, rows, problems, generatedOn, compare }), {
    title: `${config.site.title} · Progression report`,
    css: `${appStyles()}\n${themeCss(context)}`,
  });
  mkdirSync(dirname(target.path), { recursive: true });
  writeFileSync(target.path, html);
  io.out(target.shown);
  return 0;
}
