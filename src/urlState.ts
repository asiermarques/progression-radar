// The whole app state lives in the `state` query parameter as JSON, so a URL is a shareable snapshot.
import { findRole, maxLevel, type Config, type Levels, type Person } from "./model";

const PARAM = "state";

export type ParsedState =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "ok"; person: Person };

export function parseState(search: string, config: Config): ParsedState {
  const raw = new URLSearchParams(search).get(PARAM);
  if (!raw) return { kind: "empty" };

  try {
    const person = normalizePerson(JSON.parse(raw), config);
    return person ? { kind: "ok", person } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

export function toSearch(person: Person): string {
  return "?" + new URLSearchParams({ [PARAM]: JSON.stringify(person) }).toString();
}

/**
 * Lenient: keeps what makes sense for the current configuration and drops the rest,
 * so old links keep working when categories or roles change.
 */
export function normalizePerson(data: unknown, config: Config): Person | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const input = data as Record<string, unknown>;
  const inputLevels = (typeof input.levels === "object" && input.levels) || {};

  const levels: Levels = {};
  for (const category of config.categories) {
    const level = Number((inputLevels as Record<string, unknown>)[category.key]);
    levels[category.key] = Number.isFinite(level) ? Math.min(Math.max(Math.round(level), 0), maxLevel(category)) : 0;
  }

  const roleKey = typeof input.roleKey === "string" ? input.roleKey : undefined;
  const compareTo = typeof input.compareTo === "string" ? input.compareTo : undefined;

  return {
    name: typeof input.name === "string" ? input.name : "",
    levels,
    roleKey: findRole(config.roles, roleKey)?.key,
    tags: Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string") : [],
    compareTo: findRole(config.roles, compareTo)?.key,
  };
}

/** Starting point when the URL has no state: a random role's levels. */
export function examplePerson(config: Config, random = Math.random): Person {
  const role = config.roles[Math.floor(random() * config.roles.length)];
  return normalizePerson({ name: "John Connor", levels: role?.levels ?? {}, roleKey: role?.key, tags: [] }, config)!;
}
