// Domain types and pure functions. No React, no browser APIs.

/** A skill, behaviour or concept expected of a person at one level of a category. */
export interface Expectation {
  summary: string;
  description: string;
  level: number;
}

export interface Category {
  key: string;
  name: string;
  description: string;
  expectations: Expectation[];
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

/** Snapshot column names: a category cannot use them as its key either, but they are not share link fields. */
export const SNAPSHOT_RESERVED_KEYS = ["id"];

/** Selectable levels of a category: 0 plus every level used by its expectations, ascending. */
export function levelsOf(category: Category): number[] {
  return [...new Set([0, ...category.expectations.map((expectation) => expectation.level)])].sort((a, b) => a - b);
}

export function maxLevel(category: Category): number {
  return Math.max(0, ...category.expectations.map((expectation) => expectation.level));
}

/** How far `level` is towards the highest level of the category, from 0 to 100. */
export function percentage(category: Category, level: number): number {
  const max = maxLevel(category);
  if (max === 0) return 0;
  return Math.round((Math.min(Math.max(level, 0), max) / max) * 100);
}

export function expectationsAt(category: Category, level: number): Expectation[] {
  return category.expectations.filter((expectation) => expectation.level === level);
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

/** The categories that have a level in `levels`: the others are "not recorded", which is not level 0. */
export function recordedCategories(categories: Category[], levels: Levels): Category[] {
  return categories.filter((category) => Object.hasOwn(levels, category.key));
}

/** Overall progress over the recorded categories only, and how many they are; undefined when none is recorded. */
export function recordedOverallPercentage(
  categories: Category[],
  levels: Levels,
): { percentage: number; recorded: number } | undefined {
  const recorded = recordedCategories(categories, levels);
  if (recorded.length === 0) return undefined;
  return { percentage: overallPercentage(recorded, levels), recorded: recorded.length };
}

/** The role gap over the recorded categories only; undefined when none is recorded. */
export function recordedRoleGap(categories: Category[], levels: Levels, role: Role): RoleGap | undefined {
  const recorded = recordedCategories(categories, levels);
  return recorded.length === 0 ? undefined : roleGap(recorded, levels, role);
}

/** Up to two initials for the person's seal, e.g. "Ada Lovelace" -> "AL". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => Array.from(word)[0]!.toLocaleUpperCase()).join("");
}
