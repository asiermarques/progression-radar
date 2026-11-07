// Decides, at build time, which folder each configuration file is read from.
// Used by the Vite plugin in vite.config.ts; the app itself never sees these paths.
import { existsSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export const CONFIG_FILES = ["categories.yml", "roles.yml", "site.yml", "theme.css"] as const;
export type ConfigFile = (typeof CONFIG_FILES)[number];

export const IMAGE_EXTENSIONS = ["svg", "png", "jpg", "jpeg", "webp", "gif"] as const;

export const EXAMPLE_FOLDER = "config.example";
export const DEFAULT_CONFIG_FOLDER = "config";
export const CONFIG_DIR_VARIABLE = "PROGRESSION_RADAR_CONFIG_DIR";

export interface ConfigSources {
  /** How the configuration folder is named in messages: "config", "my-ladder"… */
  configLabel: string;
  /** Absolute path of the configuration folder, for the build log only. */
  configPath: string;
  /** Each file with its absolute path and the label shown in problems, e.g. "config/roles.yml". */
  files: Record<ConfigFile, { path: string; label: string }>;
  /** Image files by name. Those of the configuration folder win over the example ones. */
  images: Record<string, string>;
  /** Files of the configuration folder that the app does not use. */
  unrecognised: string[];
  /** Where files are looked up, in order, with a trailing slash: ["config/", "config.example/"]. */
  folders: string[];
}

const isImage = (name: string) => IMAGE_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(`.${extension}`));

function listFiles(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
}

function configFolder(root: string, setting: string | undefined) {
  if (!setting) return { path: join(root, DEFAULT_CONFIG_FOLDER), label: DEFAULT_CONFIG_FOLDER };

  const path = resolve(root, setting);
  if (!existsSync(path)) {
    throw new Error(`${CONFIG_DIR_VARIABLE} is set to "${setting}" but the folder ${path} does not exist.`);
  }
  if (!statSync(path).isDirectory()) {
    throw new Error(`${CONFIG_DIR_VARIABLE} is set to "${setting}" but ${path} is not a folder.`);
  }
  // An absolute path stays out of the messages, which end up in the bundle.
  const label = isAbsolute(setting) ? CONFIG_DIR_VARIABLE : setting.replace(/[\\/]+$/, "");
  return { path, label };
}

/**
 * Resolves the configuration of a project.
 * `setting` is the value of PROGRESSION_RADAR_CONFIG_DIR: when it is set the folder must exist, otherwise the
 * default `config` folder may be missing or empty. Throws when the folder is wrong.
 */
export function resolveConfigSources(root: string, setting: string | undefined): ConfigSources {
  const config = configFolder(root, setting);
  const examplePath = join(root, EXAMPLE_FOLDER);

  const present = new Set(listFiles(config.path));
  const files = Object.fromEntries(
    CONFIG_FILES.map((name) => {
      const own = present.has(name);
      const label = `${own ? config.label : EXAMPLE_FOLDER}/${name}`;
      return [name, { path: join(own ? config.path : examplePath, name), label }];
    }),
  ) as ConfigSources["files"];

  const images: Record<string, string> = {};
  for (const [folder, path] of [[examplePath, examplePath], [config.path, config.path]] as const) {
    for (const name of listFiles(folder).filter(isImage)) images[name] = join(path, name);
  }

  const known = (name: string) => (CONFIG_FILES as readonly string[]).includes(name) || isImage(name) || name === "README.md";
  return {
    configLabel: config.label,
    configPath: config.path,
    files,
    images,
    unrecognised: [...present].filter((name) => !known(name)),
    folders: [`${config.label}/`, `${EXAMPLE_FOLDER}/`],
  };
}

const identifier = (name: string) => name.replace(/\.[^.]+$/, "").replace(/\W/g, "_");

/** Source of the virtual module `virtual:progression-radar-config`: the resolved raw data and where it came from. */
export function configModuleSource(sources: ConfigSources): string {
  const yaml = ["categories.yml", "roles.yml", "site.yml"] as const;
  const imageNames = Object.keys(sources.images);
  const origins = {
    ...Object.fromEntries(yaml.map((name) => [identifier(name), sources.files[name].label])),
    folders: sources.folders,
  };

  return [
    ...yaml.map((name) => `import ${identifier(name)} from ${JSON.stringify(sources.files[name].path)};`),
    ...imageNames.map((name, index) => `import image${index} from ${JSON.stringify(`${sources.images[name]}?url`)};`),
    `export const raw = { categories, roles, site };`,
    `export const images = { ${imageNames.map((name, index) => `${JSON.stringify(name)}: image${index}`).join(", ")} };`,
    `export const origins = ${JSON.stringify(origins)};`,
  ].join("\n");
}

/** Source of the virtual module `virtual:progression-radar-theme`: just the resolved stylesheet. */
export function themeModuleSource(sources: ConfigSources): string {
  return `import ${JSON.stringify(sources.files["theme.css"].path)};`;
}

/** The build log: where each file was read from, and a warning per file that is not used. */
export function describeSources(sources: ConfigSources): { info: string[]; warnings: string[] } {
  // The log may show the real path of a folder that the messages in the bundle hide.
  const own = sources.configLabel === CONFIG_DIR_VARIABLE ? sources.configPath : sources.configLabel;
  const info = CONFIG_FILES.map((name) => {
    const folder = sources.files[name].label.startsWith(`${EXAMPLE_FOLDER}/`) ? EXAMPLE_FOLDER : own;
    return `${name} ← ${folder}/`;
  });
  const warnings = sources.unrecognised.map(
    (name) =>
      `${own}/${name} is not a configuration file and is ignored. ` +
      `The app reads ${CONFIG_FILES.join(", ")} and the images they reference.`,
  );
  return { info, warnings };
}
