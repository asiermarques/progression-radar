// The data of a Report: what each Person recorded in each Snapshot. Pure: no files and no HTML. The rules (progress,
// recorded Categories) are those of src/model.ts. See docs/adr/0007.
import {
  findRole,
  maxLevel,
  percentage,
  recordedOverallPercentage,
  recordedRoleGap,
  requiredLevel,
  type Config,
} from "../src/model.ts";
import type { Problem, SnapshotRow } from "./snapshots.ts";

export interface Cell {
  key: string;
  name: string;
  /** The Reached level as recorded; undefined when the row does not record the Category. */
  level: number | undefined;
  /** The level is above the Highest level of the Category. */
  above: boolean;
  /** The Highest level of the Category. */
  max: number;
  /** Progress of the level (0-100, capped at the Highest level); undefined when not recorded. */
  progress: number | undefined;
  /** The level the role of the Role gap requires; undefined when the row has no role to compare. */
  target: number | undefined;
}

export interface Entry {
  /** The Snapshot, as its file name without `.csv`. */
  snapshot: string;
  cells: Cell[];
  /** Categories recorded in the row, and all the Categories of the Configuration. */
  recorded: number;
  total: number;
  /** Overall progress over the recorded Categories; undefined when none is recorded. */
  overall: number | undefined;
  /** Role gap over the recorded Categories (`total` of them), against the role named in `role`; undefined if none. */
  gap: { role: string; met: number; total: number; levelsToGo: number } | undefined;
}

/** One series of the radar of a Person. */
export interface RadarSnapshot {
  snapshot: string;
  /** One percentage per Category; the radar skips the ones that are not recorded. */
  values: number[];
  recorded: boolean[];
}

export interface PersonHistory {
  id: string;
  name: string;
  /** The name of the Role of their latest row, when it is a role of the Configuration. */
  role: string | undefined;
  entries: Entry[];
  /** The last row first and the first row second; just the one row for a Person with a single row. */
  radar: RadarSnapshot[];
  /**
   * Per Category, the latest recorded level minus the earliest recorded one; undefined when fewer than two rows
   * record it.
   */
  changes: (number | undefined)[];
}

/** A Person at their latest row in any Snapshot. */
export interface TeamMember {
  id: string;
  name: string;
  /** The Snapshot of that row. */
  snapshot: string;
  entry: Entry;
}

export interface Report {
  /** `YYYY-MM-DD`. */
  generatedOn: string;
  /** The name of the role every Role gap is against; undefined when each row uses its own Compared role. */
  compare: string | undefined;
  categories: { key: string; name: string }[];
  /** The Snapshots the rows come from, in order. */
  snapshots: string[];
  persons: PersonHistory[];
  /** Every Person at their latest row, in order of first appearance. */
  team: TeamMember[];
  /** Per Category, the average Progress of the Team overview over the Persons who recorded it; undefined if none. */
  teamAverage: (number | undefined)[];
  problems: Problem[];
}

export interface BuildOptions {
  config: Config;
  /** In snapshot order: the last row of a Person is their latest. */
  rows: SnapshotRow[];
  problems: Problem[];
  generatedOn: string;
  /** The key of a role of the Configuration (the caller has checked it) that every Role gap is against. */
  compare?: string;
}

function entryOf(row: SnapshotRow, config: Config, compare: string | undefined): Entry {
  const { levels } = row.person;
  const overall = recordedOverallPercentage(config.categories, levels);
  const role = findRole(config.roles, compare ?? row.person.compareTo);
  const gap = role ? recordedRoleGap(config.categories, levels, role) : undefined;
  return {
    snapshot: row.file.replace(/\.csv$/, ""),
    cells: config.categories.map((category) => {
      const level = Object.hasOwn(levels, category.key) ? levels[category.key] : undefined;
      const max = maxLevel(category);
      return {
        key: category.key,
        name: category.name,
        level,
        above: level !== undefined && level > max,
        max,
        progress: level === undefined ? undefined : percentage(category, level),
        target: role && gap ? requiredLevel(role, category) : undefined,
      };
    }),
    recorded: overall?.recorded ?? 0,
    total: config.categories.length,
    overall: overall?.percentage,
    gap: role && gap ? { role: role.name, ...gap } : undefined,
  };
}

function radarOf(row: SnapshotRow, config: Config): RadarSnapshot {
  const { levels } = row.person;
  return {
    snapshot: row.file.replace(/\.csv$/, ""),
    values: config.categories.map((category) => percentage(category, levels[category.key] ?? 0)),
    recorded: config.categories.map((category) => Object.hasOwn(levels, category.key)),
  };
}

/** Per Category, the latest recorded level minus the earliest recorded one. */
function changesOf(entries: Entry[], count: number): (number | undefined)[] {
  return Array.from({ length: count }, (_, index) => {
    const levels = entries.map((entry) => entry.cells[index].level).filter((level) => level !== undefined);
    return levels.length < 2 ? undefined : levels[levels.length - 1] - levels[0];
  });
}

const average = (values: number[]) =>
  values.length === 0 ? undefined : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

export function buildReport({ config, rows, problems, generatedOn, compare }: BuildOptions): Report {
  const byPerson = new Map<string, { name: string; entries: Entry[]; first: SnapshotRow; last: SnapshotRow }>();
  for (const row of rows) {
    const person = byPerson.get(row.id) ?? { name: row.id, entries: [], first: row, last: row };
    person.name = row.person.name || row.id; // the latest row names the Person
    person.last = row;
    person.entries.push(entryOf(row, config, compare));
    byPerson.set(row.id, person);
  }
  const team = [...byPerson].map(([id, { name, entries }]) => ({
    id,
    name,
    snapshot: entries[entries.length - 1].snapshot,
    entry: entries[entries.length - 1],
  }));
  return {
    generatedOn,
    compare: findRole(config.roles, compare)?.name,
    categories: config.categories.map(({ key, name }) => ({ key, name })),
    snapshots: [...new Set(rows.map((row) => row.file.replace(/\.csv$/, "")))],
    persons: [...byPerson].map(([id, { name, entries, first, last }]) => ({
      id,
      name,
      role: findRole(config.roles, last.person.roleKey)?.name,
      entries,
      radar: [radarOf(last, config), ...(first === last ? [] : [radarOf(first, config)])],
      changes: changesOf(entries, config.categories.length),
    })),
    team,
    teamAverage: config.categories.map((_, index) =>
      average(team.map((member) => member.entry.cells[index].progress).filter((progress) => progress !== undefined)),
    ),
    problems,
  };
}
