// Domain types and pure functions. No React, no browser APIs.

export interface KPI {
  summary: string;
  description: string;
  level: number;
  tags: string[];
}

export interface Category {
  key: string;
  name: string;
  description: string;
  kpis: KPI[];
}

export interface Role {
  key: string;
  name: string;
  levels: Levels;
}

export interface Site {
  title: string;
  logo?: string; // resolved URL of the logo image
  footer?: string; // markdown
}

export interface Config {
  site: Site;
  categories: Category[];
  roles: Role[];
}

/** Category key -> reached level. */
export type Levels = Record<string, number>;

/** Everything that is stored in the URL. */
export interface Person {
  name: string;
  levels: Levels;
  roleKey?: string;
  tags: string[];
  compareTo?: string;
}

/** Share link field names: a category cannot use them as its key. */
export const RESERVED_KEYS = ["name", "role", "compare", "tag", "state"];

/** Selectable levels of a category: 0 plus every level used by its KPIs, ascending. */
export function levelsOf(category: Category): number[] {
  return [...new Set([0, ...category.kpis.map((kpi) => kpi.level)])].sort((a, b) => a - b);
}

export function maxLevel(category: Category): number {
  return Math.max(0, ...category.kpis.map((kpi) => kpi.level));
}

/** How far `level` is towards the highest level of the category, from 0 to 100. */
export function percentage(category: Category, level: number): number {
  const max = maxLevel(category);
  if (max === 0) return 0;
  return Math.round((Math.min(Math.max(level, 0), max) / max) * 100);
}

export function kpisAt(category: Category, level: number): KPI[] {
  return category.kpis.filter((kpi) => kpi.level === level);
}

export function findRole(roles: Role[], key: string | undefined): Role | undefined {
  return key === undefined ? undefined : roles.find((role) => role.key === key);
}

/** The level a role requires in a category. Categories the role does not mention count as level 0. */
export function requiredLevel(role: Role, category: Category): number {
  return role.levels[category.key] ?? 0;
}

/** Average progress across all categories, from 0 to 100. */
export function overallPercentage(categories: Category[], levels: Levels): number {
  if (categories.length === 0) return 0;
  const sum = categories.reduce((total, c) => total + percentage(c, levels[c.key] ?? 0), 0);
  return Math.round(sum / categories.length);
}

export interface RoleGap {
  /** Categories where the person reaches the level required by the role. */
  met: number;
  total: number;
  /** Levels still missing, added up across all categories. */
  levelsToGo: number;
}

export function roleGap(categories: Category[], levels: Levels, role: Role): RoleGap {
  let met = 0;
  let levelsToGo = 0;
  for (const category of categories) {
    const missing = requiredLevel(role, category) - (levels[category.key] ?? 0);
    if (missing <= 0) met++;
    else levelsToGo += missing;
  }
  return { met, total: categories.length, levelsToGo };
}

/** Up to two initials for the person's seal, e.g. "Ada Lovelace" -> "AL". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => Array.from(word)[0]!.toLocaleUpperCase()).join("");
}
