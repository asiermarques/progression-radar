// The project skills for Claude Code that drive the commands (docs/adr/0004). They ship in the package and
// `progression-radar skills` (run by `init`) copies them to the Adopter repository's .claude/skills/, where Claude Code
// loads them and where the adopter commits them, so a change to a skill arrives as a reviewable diff (docs/adr/0005).
// Upstream owns every skill whose folder starts with "progression-radar-": a copy replaces it whole.
import { cpSync, existsSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const SKILLS_FOLDER = join(".claude", "skills");
const PREFIX = "progression-radar-";

const skillsIn = (root: string): string[] => {
  const folder = join(root, SKILLS_FOLDER);
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(PREFIX))
    .map((entry) => entry.name)
    .sort();
};

/** Every file of a folder, by its path inside it, with its content. */
const contents = (folder: string): Map<string, string> => {
  const files = new Map<string, string>();
  const walk = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.set(relative(folder, full), readFileSync(full, "utf8"));
    }
  };
  walk(folder);
  return files;
};

const sameFolder = (a: string, b: string) => {
  if (!existsSync(a) || !statSync(a).isDirectory() || !existsSync(b)) return false;
  const left = contents(a);
  const right = contents(b);
  return left.size === right.size && [...left].every(([path, text]) => right.get(path) === text);
};

/** A fork runs the commands in the radar itself: its skills are already in place. */
const isFork = (cwd: string, packageRoot: string) => realpathSync(cwd) === realpathSync(packageRoot);

export interface SkillsOptions {
  /** The Adopter repository. */
  cwd: string;
  /** The installed radar, where the shipped skills are. */
  packageRoot: string;
  log?: (line: string) => void;
}

/**
 * Copies the shipped skills to .claude/skills/, replacing the copies there, and removes the copies of skills the
 * radar no longer ships. Other skills of the repository are not touched.
 */
export function copySkills({ cwd, packageRoot, log = console.log }: SkillsOptions): void {
  if (isFork(cwd, packageRoot)) {
    log(`The skills are already in ${SKILLS_FOLDER}/ of this repository.`);
    return;
  }
  const shipped = skillsIn(packageRoot);
  const copied = skillsIn(cwd);
  const target = join(cwd, SKILLS_FOLDER);
  const updated: string[] = [];
  for (const name of shipped) {
    if (sameFolder(join(packageRoot, SKILLS_FOLDER, name), join(target, name))) continue;
    rmSync(join(target, name), { recursive: true, force: true });
    cpSync(join(packageRoot, SKILLS_FOLDER, name), join(target, name), { recursive: true });
    updated.push(name);
  }
  const removed = copied.filter((name) => !shipped.includes(name));
  for (const name of removed) rmSync(join(target, name), { recursive: true, force: true });

  if (updated.length > 0) log(`Copied the skills for Claude Code to ${SKILLS_FOLDER}/: ${updated.join(", ")}. Commit them.`);
  if (removed.length > 0) log(`Removed from ${SKILLS_FOLDER}/ the skills the radar no longer ships: ${removed.join(", ")}`);
  if (updated.length === 0 && removed.length === 0) log(`The skills in ${SKILLS_FOLDER}/ are up to date.`);
}

/**
 * The warning `check` prints when the copied skills do not match the installed radar, for example after an upgrade;
 * undefined when they match, in a fork, or when the repository has none (it may not use Claude Code).
 */
export function skillsWarning({ cwd, packageRoot }: Omit<SkillsOptions, "log">): string | undefined {
  if (isFork(cwd, packageRoot)) return undefined;
  const copied = skillsIn(cwd);
  if (copied.length === 0) return undefined;
  const shipped = skillsIn(packageRoot);
  const stale = [
    ...shipped.filter((name) => !sameFolder(join(packageRoot, SKILLS_FOLDER, name), join(cwd, SKILLS_FOLDER, name))),
    ...copied.filter((name) => !shipped.includes(name)),
  ];
  if (stale.length === 0) return undefined;
  return `The skills in ${SKILLS_FOLDER}/ do not match the installed radar (${stale.join(", ")}): run \`npx progression-radar skills\` and commit the result.`;
}
