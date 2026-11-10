// `progression-radar init`: prepares an empty Adopter repository. It copies the whole Sample configuration to
// config/, adds the npm scripts of a fork to the package.json, keeps `reports/` out of git in the .gitignore, writes a
// README.md that links to the guides and copies the skills for Claude Code to .claude/skills/. It never overwrites
// anything that exists, except the skills, which upstream owns (see skills.ts).
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { DEFAULT_CONFIG_FOLDER, EXAMPLE_FOLDER } from "./config-sources.ts";
import { copySkills } from "./skills.ts";

export class InitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitError";
  }
}

/** The npm scripts of a fork, each calling the binary. */
export const SCRIPTS: Record<string, string> = {
  dev: "progression-radar dev",
  build: "progression-radar build",
  preview: "progression-radar preview",
  check: "progression-radar check",
  "snapshot:record": "progression-radar snapshot record",
  "snapshot:link": "progression-radar snapshot link",
  "snapshot:check": "progression-radar snapshot check",
  "snapshot:report": "progression-radar snapshot report",
  "config:convert-categories": "progression-radar config convert-categories",
};

export interface InitOptions {
  /** The Adopter repository: where config/ and package.json are. */
  cwd: string;
  /** The installed radar, where config.example/ is. */
  packageRoot: string;
  log?: (line: string) => void;
}

function copyMissing(from: string, to: string, root: string, copied: string[], kept: string[]) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) copyMissing(source, target, root, copied, kept);
    else if (existsSync(target)) kept.push(relative(root, target));
    else {
      copyFileSync(source, target);
      copied.push(relative(root, target));
    }
  }
}

/** The folder the Reports are written to: they hold personal data, so `init` keeps it out of git. */
const REPORTS_IGNORE = "reports/";
const IGNORES_REPORTS = /^\/?reports(\/(\*\*)?)?$/;

/** Creates the .gitignore with `reports/`, or appends the line when no line ignores it. Other lines are not touched. */
function ignoreReports(cwd: string, log: (line: string) => void): void {
  const path = join(cwd, ".gitignore");
  if (!existsSync(path)) {
    writeFileSync(path, `${REPORTS_IGNORE}\n`);
    log(`Created .gitignore with ${REPORTS_IGNORE}: the Reports hold personal data and must not be committed`);
    return;
  }
  const text = readFileSync(path, "utf8");
  if (text.split(/\r?\n/).some((line) => IGNORES_REPORTS.test(line.trim()))) return;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  appendFileSync(path, `${text === "" || /\n$/.test(text) ? "" : eol}${REPORTS_IGNORE}${eol}`);
  log(`Added ${REPORTS_IGNORE} to .gitignore: the Reports hold personal data and must not be committed`);
}

/** The guides the README of an Adopter repository links to, by file name in docs/guides/ of the radar. */
export const GUIDES: [file: string, title: string, what: string][] = [
  ["getting-started.md", "Getting started", "the commands and what they read and write"],
  ["configuration.md", "Configuration", "the files in config/ and how they fall back to the sample"],
  ["categories.md", "Categories", "one Markdown file per category, with its levels and expectations"],
  ["roles.md", "Roles", "the levels each role expects"],
  ["styles.md", "Styles", "colours, fonts and logo"],
  ["share-link.md", "Share link", "how a person's levels live in the URL"],
  ["snapshots.md", "Snapshots", "recording people over time, the reports and the skills for Claude Code"],
  ["deployment.md", "Deployment", "putting the radar online"],
  ["upgrading.md", "Upgrading", "what to do when a new version comes out"],
];

/** The repository and the version of the installed radar, from its package.json. */
function installedRadar(packageRoot: string): { repository: string; version: string } {
  const { repository, version } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  const url = String(typeof repository === "string" ? repository : (repository?.url ?? ""));
  return { repository: url.replace(/^git\+/, "").replace(/\.git$/, ""), version };
}

/** Where the guides of the installed version are on GitHub: the tag of that version, so they match what it does. */
export const guidesUrl = (packageRoot: string): string => {
  const { repository, version } = installedRadar(packageRoot);
  return `${repository}/blob/v${version}/docs/guides`;
};

/** The README.md of a new Adopter repository. */
export function readme(packageRoot: string): string {
  const { repository, version } = installedRadar(packageRoot);
  const guides = guidesUrl(packageRoot);
  return `# Our ladder

The career ladder of this team, drawn with [Progression Radar](${repository}) as a dependency of this
repository. It holds only our data: the radar itself is in \`node_modules\` and is upgraded by changing its version.

## Commands

\`\`\`sh
npm run dev       # the radar with our ladder; the page reloads when config/ changes
npm run check     # the configuration and the snapshots
npm run build     # the static site, in dist/
\`\`\`

\`npx progression-radar --help\` lists every command, the snapshot ones included.

## What is here

- \`config/\`: our ladder (categories, roles, site and styles). A file that is not here comes from the sample of the radar.
- \`snapshots/\`: dated CSV files with the levels of each person, if we record them. They hold personal data.
- \`reports/\`: the reports made from the snapshots. Git-ignored, because they hold personal data.
- \`.claude/skills/\`: the skills that let Claude Code record snapshots and make reports when asked. Upstream owns
  them: \`npx progression-radar skills\` updates them after an upgrade.

## Guides

The guides of version ${version} of the radar, the one this repository was created with (after upgrading, change the
version in these links):

${GUIDES.map(([file, title, what]) => `- [${title}](${guides}/${file}): ${what}.`).join("\n")}
`;
}

/** Writes README.md when the repository has none. */
function writeReadme(cwd: string, packageRoot: string, log: (line: string) => void): void {
  const path = join(cwd, "README.md");
  if (existsSync(path)) {
    log("README.md already exists, kept");
    return;
  }
  writeFileSync(path, readme(packageRoot));
  log("Created README.md with links to the guides");
}

export function initAdopterRepository({ cwd, packageRoot, log = console.log }: InitOptions): void {
  const packagePath = join(cwd, "package.json");
  if (!existsSync(packagePath)) {
    throw new InitError("There is no package.json here. Run `npm init` (or `pnpm init`, `yarn init`) and install progression-radar first.");
  }
  const configPath = join(cwd, DEFAULT_CONFIG_FOLDER);
  if (existsSync(configPath) && !statSync(configPath).isDirectory()) {
    throw new InitError(`${DEFAULT_CONFIG_FOLDER} exists and is not a folder.`);
  }
  const gitignorePath = join(cwd, ".gitignore");
  if (existsSync(gitignorePath) && !statSync(gitignorePath).isFile()) throw new InitError(".gitignore exists and is not a file.");

  const copied: string[] = [];
  const kept: string[] = [];
  copyMissing(join(packageRoot, EXAMPLE_FOLDER), configPath, cwd, copied, kept);
  for (const file of kept) log(`${file} already exists, kept`);
  if (copied.length > 0) log(`Copied ${copied.length} files of ${EXAMPLE_FOLDER}/ to ${DEFAULT_CONFIG_FOLDER}/. Edit them to describe your Ladder.`);

  const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
  const scripts: Record<string, string> = manifest.scripts ?? {};
  const added = Object.keys(SCRIPTS).filter((name) => !(name in scripts));
  if (added.length > 0) {
    manifest.scripts = { ...scripts, ...Object.fromEntries(added.map((name) => [name, SCRIPTS[name]])) };
    writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
    log(`Added to package.json scripts: ${added.join(", ")}`);
  }

  ignoreReports(cwd, log);
  writeReadme(cwd, packageRoot, log);
  copySkills({ cwd, packageRoot, log });
}
