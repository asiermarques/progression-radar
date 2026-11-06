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
