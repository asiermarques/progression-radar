// Loads the configuration files resolved at build time (the config folder, falling back to config.example/)
// and turns them into a validated, typed Config.
import { images as configImages, origins, raw as rawConfig } from "virtual:progression-radar-config";
import { RESERVED_KEYS, type Category, type Config, type Expectation, type Levels, type Role, type Site } from "./model";

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join("\n- ")}`);
    this.name = "ConfigError";
  }
}

export function loadConfig(): Config {
  return parseConfig(rawConfig, configImages, origins);
}

/** Where each file was read from, e.g. "config/roles.yml", so problems can name it. */
export interface Origins {
  categories: string;
  roles: string;
  site: string;
  /** Folders searched for images, in order, e.g. ["config/", "config.example/"]. */
  folders: string[];
}

const defaultOrigins: Origins = { categories: "categories.yml", roles: "roles.yml", site: "site.yml", folders: [] };

interface RawConfig {
  categories: unknown;
  roles: unknown;
  site: unknown;
}

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const optionalString = (value: unknown): string => (typeof value === "string" ? value : "");

/** Validates raw YAML data. Throws a ConfigError listing every problem found. */
export function parseConfig(
  raw: RawConfig,
  images: Record<string, string> = {},
  origins: Origins = defaultOrigins,
): Config {
  const problems: string[] = [];

  const categories = parseCategories(raw.categories, origins.categories, problems);
  const roles = parseRoles(raw.roles, categories, origins.roles, problems);
  const site = parseSite(raw.site, images, origins, problems);

  if (problems.length > 0) throw new ConfigError(problems);
  return { site, categories, roles };
}

function parseCategories(raw: unknown, file: string, problems: string[]): Category[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.push(`${file} must contain a non-empty list of categories`);
    return [];
  }

  const seen = new Set<string>();
  return raw.flatMap((item, index): Category[] => {
    const where = `${file} entry #${index + 1}`;
    if (!isObject(item) || !isNonEmptyString(item.key) || !isNonEmptyString(item.name)) {
      problems.push(`${where} needs a "key" and a "name"`);
      return [];
    }
    if (seen.has(item.key)) problems.push(`${where}: duplicated category key "${item.key}"`);
    seen.add(item.key);
    if (RESERVED_KEYS.includes(item.key)) {
      problems.push(`${where}: the category key "${item.key}" is reserved by the share link`);
    }

    // "kpis" is the legacy name of "expectations", still accepted so existing configurations keep working.
    if (item.expectations !== undefined && item.kpis !== undefined) {
      problems.push(`${file}: category "${item.key}" has both "expectations" and "kpis"; keep only "expectations"`);
    }
    const list = item.expectations ?? item.kpis;
    const expectations = Array.isArray(list) ? list : [];
    if (!Array.isArray(list)) problems.push(`${file}: category "${item.key}" needs an "expectations" list`);

    return [
      {
        key: item.key,
        name: item.name,
        description: optionalString(item.description),
        expectations: expectations.flatMap((expectation, i) =>
          parseExpectation(expectation, `${file}: category "${item.key}" expectation #${i + 1}`, problems),
        ),
      },
    ];
  });
}

function parseExpectation(raw: unknown, where: string, problems: string[]): Expectation[] {
  if (!isObject(raw) || !isNonEmptyString(raw.summary)) {
    problems.push(`${where} needs a "summary"`);
    return [];
  }
  if (!Number.isInteger(raw.level) || (raw.level as number) < 1) {
    problems.push(`${where} needs a "level" that is a positive integer`);
    return [];
  }
  return [
    {
      summary: raw.summary,
      description: optionalString(raw.description),
      level: raw.level as number,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === "string") : [],
    },
  ];
}

function parseRoles(raw: unknown, categories: Category[], file: string, problems: string[]): Role[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.push(`${file} must contain a list of roles`);
    return [];
  }

  const categoryKeys = new Set(categories.map((category) => category.key));
  const seen = new Set<string>();
  return raw.flatMap((item, index): Role[] => {
    const where = `${file} entry #${index + 1}`;
    if (!isObject(item) || !isNonEmptyString(item.key) || !isNonEmptyString(item.name)) {
      problems.push(`${where} needs a "key" and a "name"`);
      return [];
    }
    if (seen.has(item.key)) problems.push(`${where}: duplicated role key "${item.key}"`);
    seen.add(item.key);

    const levels: Levels = {};
    for (const [key, level] of Object.entries(isObject(item.levels) ? item.levels : {})) {
      if (!categoryKeys.has(key)) problems.push(`${file}: role "${item.key}" references unknown category "${key}"`);
      else if (typeof level !== "number" || level < 0) problems.push(`${file}: role "${item.key}" has an invalid level for "${key}"`);
      else levels[key] = level;
    }
    return [{ key: item.key, name: item.name, levels }];
  });
}

function parseSite(raw: unknown, images: Record<string, string>, origins: Origins, problems: string[]): Site {
  const site = isObject(raw) ? raw : {};
  const logoFile = optionalString(site.logo);
  if (logoFile && !images[logoFile]) {
    const searched = origins.folders.length > 0 ? origins.folders.join(" or ") : "the config folder";
    problems.push(`${origins.site}: logo "${logoFile}" was not found in ${searched}`);
  }

  return {
    title: isNonEmptyString(site.title) ? site.title : "Progression Radar",
    logo: images[logoFile],
    footer: optionalString(site.footer) || undefined,
  };
}
