// The three snapshot commands behind `npm run snapshot:record`, `snapshot:link` and `snapshot:check`: argument
// parsing, output and exit codes. The rules are in snapshots.ts; this file only talks to the person who runs them.
import { parseArgs } from "node:util";
import { ConfigError, loadConfig } from "../src/config.ts";
import type { Config } from "../src/model.ts";
import {
  SNAPSHOTS_DIR_VARIABLE,
  SnapshotError,
  checkSnapshots,
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
  /** The Configuration to use; default: the resolved configuration of the project. */
  loadConfig?: () => Config;
}

const USAGE = [
  "Usage:",
  '  npm run snapshot:record -- "<share link>" --id <id> [--snapshot <YYYY-MM-DD[-text].csv>]',
  "  npm run snapshot:link -- <snapshot.csv> <id> [--base <app URL>]",
  "  npm run snapshot:check -- [<snapshot.csv>]",
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
  if (command !== "record" && command !== "link" && command !== "check") {
    io.err(USAGE.join("\n"));
    return 1;
  }

  let parsed: ReturnType<typeof parseArgs<{ allowPositionals: true; options: Record<string, { type: "string" }> }>>;
  try {
    parsed = parseArgs({
      args: rest,
      allowPositionals: true,
      options: { id: { type: "string" }, snapshot: { type: "string" }, base: { type: "string" } },
    });
  } catch (error) {
    io.err(`${(error as Error).message}\n${USAGE.join("\n")}`);
    return 1;
  }
  const { positionals, values } = parsed;
  const setting = context.env[SNAPSHOTS_DIR_VARIABLE] || undefined;
  const common = { root: context.root, setting };

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
