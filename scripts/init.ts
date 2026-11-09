// `progression-radar init`: prepares an empty Adopter repository. It copies the whole Sample configuration to
// config/ and adds the npm scripts of a fork to the package.json. It never overwrites anything that exists.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { DEFAULT_CONFIG_FOLDER, EXAMPLE_FOLDER } from "./config-sources.ts";

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

export function initAdopterRepository({ cwd, packageRoot, log = console.log }: InitOptions): void {
  const packagePath = join(cwd, "package.json");
  if (!existsSync(packagePath)) {
    throw new InitError("There is no package.json here. Run `npm init` (or `pnpm init`, `yarn init`) and install progression-radar first.");
  }
  const configPath = join(cwd, DEFAULT_CONFIG_FOLDER);
  if (existsSync(configPath) && !statSync(configPath).isDirectory()) {
    throw new InitError(`${DEFAULT_CONFIG_FOLDER} exists and is not a folder.`);
  }

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
}
