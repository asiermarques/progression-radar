// Loads the YAML files in /config and turns them into a validated, typed Config.
import categoriesYaml from "../config/categories.yml";
import rolesYaml from "../config/roles.yml";
import siteYaml from "../config/site.yml";
import type { Category, Config, KPI, Levels, Role, Site } from "./model";

/** Image files dropped in /config, by file name, so `logo: logo.svg` can be resolved. */
const configImages: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("../config/*.{svg,png,jpg,jpeg,webp,gif}", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([path, url]) => [path.split("/").pop()!, url]),
);

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join("\n- ")}`);
    this.name = "ConfigError";
  }
}

export function loadConfig(): Config {
  return parseConfig({ categories: categoriesYaml, roles: rolesYaml, site: siteYaml }, configImages);
}

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
export function parseConfig(raw: RawConfig, images: Record<string, string> = {}): Config {
  const problems: string[] = [];

  const categories = parseCategories(raw.categories, problems);
  const roles = parseRoles(raw.roles, categories, problems);
  const site = parseSite(raw.site, images, problems);

  if (problems.length > 0) throw new ConfigError(problems);
  return { site, categories, roles };
}

function parseCategories(raw: unknown, problems: string[]): Category[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.push("categories.yml must contain a non-empty list of categories");
    return [];
  }

  const seen = new Set<string>();
  return raw.flatMap((item, index): Category[] => {
    const where = `categories.yml entry #${index + 1}`;
    if (!isObject(item) || !isNonEmptyString(item.key) || !isNonEmptyString(item.name)) {
      problems.push(`${where} needs a "key" and a "name"`);
      return [];
    }
    if (seen.has(item.key)) problems.push(`${where}: duplicated category key "${item.key}"`);
    seen.add(item.key);

    const kpis = Array.isArray(item.kpis) ? item.kpis : [];
    if (!Array.isArray(item.kpis)) problems.push(`category "${item.key}" needs a "kpis" list`);

    return [
      {
        key: item.key,
        name: item.name,
        description: optionalString(item.description),
        kpis: kpis.flatMap((kpi, kpiIndex) => parseKpi(kpi, `category "${item.key}" KPI #${kpiIndex + 1}`, problems)),
      },
    ];
  });
}

function parseKpi(raw: unknown, where: string, problems: string[]): KPI[] {
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

function parseRoles(raw: unknown, categories: Category[], problems: string[]): Role[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.push("roles.yml must contain a list of roles");
    return [];
  }

  const categoryKeys = new Set(categories.map((category) => category.key));
  const seen = new Set<string>();
  return raw.flatMap((item, index): Role[] => {
    const where = `roles.yml entry #${index + 1}`;
    if (!isObject(item) || !isNonEmptyString(item.key) || !isNonEmptyString(item.name)) {
      problems.push(`${where} needs a "key" and a "name"`);
      return [];
    }
    if (seen.has(item.key)) problems.push(`${where}: duplicated role key "${item.key}"`);
    seen.add(item.key);

    const levels: Levels = {};
    for (const [key, level] of Object.entries(isObject(item.levels) ? item.levels : {})) {
      if (!categoryKeys.has(key)) problems.push(`role "${item.key}" references unknown category "${key}"`);
      else if (typeof level !== "number" || level < 0) problems.push(`role "${item.key}" has an invalid level for "${key}"`);
      else levels[key] = level;
    }
    return [{ key: item.key, name: item.name, levels }];
  });
}

function parseSite(raw: unknown, images: Record<string, string>, problems: string[]): Site {
  const site = isObject(raw) ? raw : {};
  const logoFile = optionalString(site.logo);
  if (logoFile && !images[logoFile]) problems.push(`site.yml: logo "${logoFile}" was not found in the config folder`);

  return {
    title: isNonEmptyString(site.title) ? site.title : "Progression Radar",
    logo: images[logoFile],
    footer: optionalString(site.footer) || undefined,
  };
}
