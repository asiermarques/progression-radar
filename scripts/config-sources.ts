// Decides, at build time, which folder each configuration file is read from.
// Used by the Vite plugin in vite.config.ts; the app itself never sees these paths.
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

// The categories are a unit of their own: categories.yml or the categories/ folder (see CategoriesSource).
export const CONFIG_FILES = ["roles.yml", "site.yml", "theme.css"] as const;
export type ConfigFile = (typeof CONFIG_FILES)[number];
export const CATEGORIES_FILE = "categories.yml";
export const CATEGORIES_FOLDER = "categories";

export const IMAGE_EXTENSIONS = ["svg", "png", "jpg", "jpeg", "webp", "gif"] as const;

export const EXAMPLE_FOLDER = "config.example";
export const DEFAULT_CONFIG_FOLDER = "config";
export const CONFIG_DIR_VARIABLE = "PROGRESSION_RADAR_CONFIG_DIR";

/** Where the categories come from: one categories.yml, or one Markdown file per category in categories/. */
export interface CategoriesSource {
  /** "none" when the folder cannot be read (see `problems`). */
  form: "file" | "folder" | "none";
  /** The file or folder as named in messages, e.g. "config/categories.yml" or "config/categories/". */
  label: string;
  /** Absolute path of categories.yml (form "file"). */
  path: string;
  /** The category files in the order they are shown (form "folder"). */
  files: { path: string; label: string }[];
  /** Mistakes in the choice of source, reported with the other configuration problems. */
  problems: string[];
}

export interface ConfigSources {
  /** How the configuration folder is named in messages: "config", "my-ladder"… */
  configLabel: string;
  /** Absolute path of the configuration folder, for the build log only. */
  configPath: string;
  /** Each file with its absolute path and the label shown in problems, e.g. "config/roles.yml". */
  files: Record<ConfigFile, { path: string; label: string }>;
  categories: CategoriesSource;
  /** Image files by name. Those of the configuration folder win over the example ones. */
  images: Record<string, string>;
  /** Files of the configuration folder that the app does not use, e.g. "notes.txt" or "categories/draft.txt". */
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

const leadingNumber = /^(\d+)/;

/** Order of the category files: by leading number, then by name character by character, unnumbered last. */
export function compareCategoryFiles(a: string, b: string): number {
  const first = leadingNumber.exec(a)?.[1].replace(/^0+(?=\d)/, "");
  const second = leadingNumber.exec(b)?.[1].replace(/^0+(?=\d)/, "");
  if (first !== undefined && second !== undefined && first !== second) {
    return first.length - second.length || (first < second ? -1 : 1);
  }
  if ((first === undefined) !== (second === undefined)) return first === undefined ? 1 : -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

const isCategoryFile = (name: string) => name.endsWith(".md") && name !== "README.md";

/** The categories of one folder, or undefined when it has neither form. */
function categoriesOf(path: string, label: string, present: Set<string>): CategoriesSource | undefined {
  const hasFile = present.has(CATEGORIES_FILE);
  const hasFolder = present.has(`${CATEGORIES_FOLDER}/`);
  const none = (unit: string, problem: string): CategoriesSource => ({ form: "none", label: unit, path: "", files: [], problems: [problem] });

  if (hasFile && hasFolder) {
    return none(
      `${label}/${CATEGORIES_FILE}`,
      `${label}/${CATEGORIES_FILE} and ${label}/${CATEGORIES_FOLDER}/ both exist; keep only one of them`,
    );
  }
  if (hasFile) {
    return { form: "file", label: `${label}/${CATEGORIES_FILE}`, path: join(path, CATEGORIES_FILE), files: [], problems: [] };
  }
  if (!hasFolder) return undefined;

  const folder = join(path, CATEGORIES_FOLDER);
  const files = listFiles(folder)
    .filter(isCategoryFile)
    .sort(compareCategoryFiles)
    .map((name) => ({ path: join(folder, name), label: `${label}/${CATEGORIES_FOLDER}/${name}` }));
  const unit = `${label}/${CATEGORIES_FOLDER}/`;
  if (files.length === 0) return none(unit, `${unit} has no category file; add a .md file for each category`);
  return { form: "folder", label: unit, path: folder, files, problems: [] };
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

  const categories =
    categoriesOf(config.path, config.label, present) ??
    categoriesOf(examplePath, EXAMPLE_FOLDER, new Set(listFiles(examplePath))) ??
    // Neither folder has categories: the import of the example's categories.yml reports the missing file.
    categoriesOf(examplePath, EXAMPLE_FOLDER, new Set([CATEGORIES_FILE]))!;

  const images: Record<string, string> = {};
  for (const [folder, path] of [[examplePath, examplePath], [config.path, config.path]] as const) {
    for (const name of listFiles(folder).filter(isImage)) images[name] = join(path, name);
  }

  const known = (name: string) =>
    (CONFIG_FILES as readonly string[]).includes(name) ||
    [CATEGORIES_FILE, `${CATEGORIES_FOLDER}/`].includes(name) ||
    isImage(name) ||
    name === "README.md";
  // Inside categories/ only the category files and the README are used.
  const unusedCategories =
    categories.form === "folder" && categories.path === join(config.path, CATEGORIES_FOLDER)
      ? listFiles(categories.path)
          .filter((name) => !isCategoryFile(name) && name !== "README.md")
          .map((name) => `${CATEGORIES_FOLDER}/${name}`)
      : [];
  return {
    configLabel: config.label,
    configPath: config.path,
    files,
    categories,
    images,
    unrecognised: [...[...present].filter((name) => !known(name)), ...unusedCategories],
    folders: [`${config.label}/`, `${EXAMPLE_FOLDER}/`],
  };
}

/**
 * Whether a change at `file` can alter the configuration: a direct child of one of the folders, or of their
 * categories/ folder, or that folder itself. Used by the dev server to reload when files are added or removed.
 */
export function isConfigPath(file: string, folders: string[]): boolean {
  const parent = dirname(file);
  return folders.some((folder) => parent === folder || parent === join(folder, CATEGORIES_FOLDER) || file === join(folder, CATEGORIES_FOLDER));
}

const identifier = (name: string) => name.replace(/\.[^.]+$/, "").replace(/\W/g, "_");

/** Source of the virtual module `virtual:progression-radar-config`: the resolved raw data and where it came from. */
export function configModuleSource(sources: ConfigSources): string {
  const yaml = ["roles.yml", "site.yml"] as const;
  const imageNames = Object.keys(sources.images);
  const { categories } = sources;
  const origins = {
    ...Object.fromEntries(yaml.map((name) => [identifier(name), sources.files[name].label])),
    categories: categories.label,
    folders: sources.folders,
  };
  const labels = categories.files.map((file) => file.label);

  const categoryImports =
    categories.form === "file"
      ? [`import categories from ${JSON.stringify(categories.path)};`, `const readings = [];`]
      : [
          ...categories.files.map((file, index) => `import category${index} from ${JSON.stringify(`${file.path}?category`)};`),
          `const readings = [${categories.files.map((_, index) => `category${index}`).join(", ")}];`,
          `const categories = readings.flatMap((reading) => (reading.category ? [reading.category] : []));`,
        ];
  return [
    ...categoryImports,
    ...yaml.map((name) => `import ${identifier(name)} from ${JSON.stringify(sources.files[name].path)};`),
    ...imageNames.map((name, index) => `import image${index} from ${JSON.stringify(`${sources.images[name]}?url`)};`),
    `const problems = [...${JSON.stringify(categories.problems)}, ...readings.flatMap((reading) => reading.problems)];`,
    `export const raw = { categories, roles, site, problems };`,
    `export const images = { ${imageNames.map((name, index) => `${JSON.stringify(name)}: image${index}`).join(", ")} };`,
    // Only the categories that could be read are in `raw`: their labels stay aligned with them.
    `export const origins = { ...${JSON.stringify(origins)}${
      categories.form === "folder"
        ? `, categoryFiles: ${JSON.stringify(labels)}.filter((_, index) => readings[index].category)`
        : ""
    } };`,
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
  const folderOf = (label: string) => (label.startsWith(`${EXAMPLE_FOLDER}/`) ? EXAMPLE_FOLDER : own);

  const { categories } = sources;
  const unit = categories.form === "folder" ? `${CATEGORIES_FOLDER}/` : CATEGORIES_FILE;
  const count = categories.form === "folder" ? ` (${categories.files.length} ${categories.files.length === 1 ? "file" : "files"})` : "";
  const info = [
    `${unit} ← ${folderOf(categories.label)}/${count}`,
    ...CONFIG_FILES.map((name) => `${name} ← ${folderOf(sources.files[name].label)}/`),
  ];
  const warnings = sources.unrecognised.map(
    (name) =>
      `${own}/${name} is not a configuration file and is ignored. ` +
      `The app reads ${CATEGORIES_FILE} (or ${CATEGORIES_FOLDER}/), ${CONFIG_FILES.join(", ")} and the images they reference.`,
  );
  return { info, warnings };
}
