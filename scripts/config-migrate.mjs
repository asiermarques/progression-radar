#!/usr/bin/env node
// Moves the customisations of a fork out of config.example/ into the configuration folder, after pulling the
// update that introduced config.example/. Uses Node and the git CLI only; it never stages, commits or fetches.
//
//   npm run config:migrate                      compares with upstream/master and asks before moving
//   npm run config:migrate -- other/ref         compares with another git ref
//   npm run config:migrate -- --dry-run         only lists the files
//   npm run config:migrate -- --yes             does not ask for confirmation
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const EXAMPLE = "config.example";
const DEFAULT_REF = "upstream/master";
const UPSTREAM_URL = "https://github.com/asiermarques/progression-radar.git";

/** A problem the person can fix; the message says how. */
export class MigrationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MigrationError";
  }
}

function git(cwd, ...args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (error.code === "ENOENT") throw new MigrationError("git is not installed or not in the PATH.");
    throw error;
  }
}

const gitSucceeds = (cwd, ...args) => {
  try {
    git(cwd, ...args);
    return true;
  } catch (error) {
    if (error instanceof MigrationError) throw error;
    return false;
  }
};

const lines = (text) => text.split("\n").filter(Boolean);

function checkPreconditions(cwd, ref) {
  if (!gitSucceeds(cwd, "rev-parse", "--git-dir")) {
    throw new MigrationError("This is not a git repository. Run the command from the root of your fork.");
  }
  if (!gitSucceeds(cwd, "rev-parse", "--verify", "--quiet", `${ref}^{commit}`)) {
    throw new MigrationError(
      `The git ref "${ref}" does not exist. Add the upstream repository and fetch it, then run this again:\n\n` +
        `  git remote add upstream ${UPSTREAM_URL}\n  git fetch upstream\n\n` +
        `Or pass another ref: npm run config:migrate -- <ref>`,
    );
  }
  for (const [marker, name] of [["MERGE_HEAD", "merge"], ["rebase-merge", "rebase"], ["rebase-apply", "rebase"], ["CHERRY_PICK_HEAD", "cherry-pick"]]) {
    if (existsSync(join(cwd, git(cwd, "rev-parse", "--git-path", marker)))) {
      throw new MigrationError(`A ${name} is in progress. Finish or abort it, then run this again.`);
    }
  }
  if (lines(git(cwd, "ls-files", "--unmerged", "--", EXAMPLE)).length > 0) {
    throw new MigrationError(`${EXAMPLE}/ has conflicts. Resolve them (git status) and run this again.`);
  }
}

/** Paths, relative to config.example/, that differ from the ref or that the ref does not have. */
function customisedFiles(cwd, ref) {
  const changed = lines(git(cwd, "diff", "--no-renames", "--diff-filter=AM", "--name-only", ref, "--", EXAMPLE));
  const untracked = lines(git(cwd, "ls-files", "--others", "--exclude-standard", "--", EXAMPLE));
  return [...new Set([...changed, ...untracked])].map((path) => relative(EXAMPLE, path)).sort();
}

async function askToContinue(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } catch {
    return false; // stdin closed
  } finally {
    rl.close();
  }
}

/**
 * Moves the customised files of config.example/ to the configuration folder and restores config.example/ from `ref`.
 * Resolves to { files, moved, skipped }. Throws a MigrationError, before changing anything, when a precondition fails.
 */
export async function migrate({
  cwd = process.cwd(),
  ref = DEFAULT_REF,
  configDir = "config",
  dryRun = false,
  yes = false,
  confirm = askToContinue,
  log = console.log,
} = {}) {
  checkPreconditions(cwd, ref);

  const files = customisedFiles(cwd, ref);
  if (files.length === 0) {
    log(`Nothing to migrate: ${EXAMPLE}/ already matches ${ref}.`);
    return { files, moved: [], skipped: [] };
  }

  log(`These files in ${EXAMPLE}/ differ from ${ref}:\n${files.map((file) => `  ${file}`).join("\n")}\n`);
  if (dryRun) {
    log(`Dry run: nothing was changed. Run again without --dry-run to move them to ${configDir}/.`);
    return { files, moved: [], skipped: [] };
  }
  const question = `Move them to ${configDir}/ and restore ${EXAMPLE}/ from ${ref}? [y/N] `;
  if (!yes && !(await confirm(question))) {
    log("Nothing was changed.");
    return { files, moved: [], skipped: [] };
  }

  const moved = [];
  const skipped = [];
  for (const file of files) {
    const target = join(cwd, configDir, file);
    if (existsSync(target)) {
      skipped.push(file);
      log(`Skipped ${file}: ${configDir}/${file} already exists. Your copy stays in ${EXAMPLE}/; merge it by hand.`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(cwd, EXAMPLE, file), target);
    moved.push(file);
  }

  for (const file of moved) {
    const path = `${EXAMPLE}/${file}`;
    if (gitSucceeds(cwd, "cat-file", "-e", `${ref}:${path}`)) git(cwd, "restore", `--source=${ref}`, "--worktree", "--", path);
    else rmSync(join(cwd, path)); // a file the fork added: upstream does not have it
  }

  if (moved.length > 0) log(`Moved ${moved.length} file(s) to ${configDir}/ and restored ${EXAMPLE}/ from ${ref}.`);
  log(
    [
      "",
      "Nothing was staged or committed. Next steps:",
      "  1. Check the result with git status.",
      "  2. Keep your configuration in your fork, either:",
      `     - commit it with: git add -f ${configDir}   (the config/ folder is git-ignored), or`,
      "     - commit it in a folder you track and set PROGRESSION_RADAR_CONFIG_DIR to it where you build.",
      `  3. Commit the restored ${EXAMPLE}/ with: git add ${EXAMPLE}`,
    ].join("\n"),
  );
  return { files, moved, skipped };
}

function parseArguments(argv, env) {
  // `npm run config:migrate --dry-run` is taken by npm itself, which passes it on as npm_config_dry_run.
  const options = { dryRun: env.npm_config_dry_run === "true", yes: env.npm_config_yes === "true" };
  for (const argument of argv) {
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--yes" || argument === "-y") options.yes = true;
    else if (argument.startsWith("-")) throw new MigrationError(`Unknown option ${argument}. Options: --dry-run, --yes.`);
    else options.ref = argument;
  }
  return options;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArguments(process.argv.slice(2), process.env);
    await migrate({ ...options, configDir: process.env.PROGRESSION_RADAR_CONFIG_DIR || "config" });
  } catch (error) {
    if (!(error instanceof MigrationError)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
}
