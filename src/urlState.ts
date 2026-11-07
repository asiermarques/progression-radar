// The whole app state lives in the share link, so a URL is a shareable snapshot (ADR 0001).
//   #name=John+Connor&role=aswe&compare=front&tag=tech&comm=2&pm=1&…
// Links from earlier versions (`?state=<JSON>`) are read forever; only the fragment format is written.
import { findRole, maxLevel, RESERVED_KEYS, type Config, type Levels, type Person } from "./model";

const LEGACY_PARAM = "state";
const LEGACY_FIELDS = ["name", "levels", "roleKey", "tags", "compareTo"];
const FRAGMENT_FIELDS = RESERVED_KEYS.filter((key) => key !== LEGACY_PARAM);

export type ParsedState =
  | { kind: "empty" }
  | { kind: "invalid"; reason: string }
  | { kind: "ok"; person: Person; issues: string[] };

/** Reads the share link: the legacy `state` query wins, otherwise the fragment. */
export function parseState(location: { search: string; hash: string }, config: Config): ParsedState {
  const legacy = new URLSearchParams(location.search).get(LEGACY_PARAM);
  return legacy ? parseLegacy(legacy, config) : parseFragment(location.hash, config);
}

function parseLegacy(raw: string, config: Config): ParsedState {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: "invalid", reason: "the state is not valid JSON" };
  }
  const issues: string[] = [];
  const person = normalizePerson(data, config, issues);
  return person ? { kind: "ok", person, issues } : { kind: "invalid", reason: "the state is not a JSON object" };
}

function parseFragment(hash: string, config: Config): ParsedState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const names = [...new Set(params.keys())];
  if (names.length === 0) return { kind: "empty" };

  const categoryKeys = config.categories.map((category) => category.key);
  const isKnown = (name: string) => FRAGMENT_FIELDS.includes(name) || categoryKeys.includes(name);
  if (!names.some(isKnown)) return { kind: "invalid", reason: "it has no field this app knows" };

  const issues = names.filter((name) => !isKnown(name));
  const levels: Record<string, string> = {};
  for (const key of categoryKeys) {
    const level = params.get(key);
    if (level !== null) levels[key] = level;
  }
  const person = normalizePerson(
    {
      name: params.get("name") ?? undefined,
      roleKey: params.get("role") ?? undefined,
      compareTo: params.get("compare") ?? undefined,
      tags: params.getAll("tag"),
      levels,
    },
    config,
    issues,
  );
  return { kind: "ok", person: person!, issues };
}

/** The share link fragment: optional fields first, then every category, so the link ends in a digit. */
export function toFragment(person: Person, config: Config): string {
  const params = new URLSearchParams();
  if (person.name) params.append("name", person.name);
  if (person.roleKey) params.append("role", person.roleKey);
  if (person.compareTo) params.append("compare", person.compareTo);
  for (const tag of person.tags) params.append("tag", tag);
  for (const category of config.categories) params.append(category.key, String(person.levels[category.key] ?? 0));
  return "#" + params.toString();
}

/** `href` with the person in the fragment and without the legacy `state` query. */
export function toUrl(person: Person, config: Config, href: string): string {
  const url = new URL(href);
  url.searchParams.delete(LEGACY_PARAM);
  url.hash = toFragment(person, config);
  return url.toString();
}

/** Rewrites the address bar. Browsers throw when this is called too often: the app must survive that. */
export function saveUrl(person: Person, config: Config): void {
  try {
    window.history.replaceState(null, "", toUrl(person, config, window.location.href));
  } catch (error) {
    console.warn("The share link could not be written to the address bar", error);
  }
}

/** What to tell the person about how a link was read, or null when there is nothing to say. */
export function noticeFor(state: ParsedState, fallback: string): string | null {
  if (state.kind === "invalid") return `This link is not valid (${state.reason}), so ${fallback}.`;
  if (state.kind === "ok" && state.issues.length > 0) {
    return `Some data in this link was ignored or corrected: ${state.issues.join(", ")}.`;
  }
  return null;
}

/**
 * Lenient: keeps what makes sense for the current configuration and drops the rest,
 * so old links keep working when categories or roles change. What it drops or corrects is added to `issues`.
 */
export function normalizePerson(data: unknown, config: Config, issues: string[] = []): Person | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const input = data as Record<string, unknown>;
  issues.push(...Object.keys(input).filter((field) => !LEGACY_FIELDS.includes(field)));

  const roleKey = pickRole(input.roleKey, "role", config, issues);
  const compareTo = pickRole(input.compareTo, "compare", config, issues);

  const rawLevels = typeof input.levels === "object" && input.levels !== null ? input.levels : {};
  const known = new Set(config.categories.map((category) => category.key));
  const levels: Levels = {};
  const levelIssues = Object.keys(rawLevels).filter((key) => !known.has(key));
  for (const category of config.categories) {
    levels[category.key] = pickLevel(rawLevels, category.key, maxLevel(category), levelIssues);
  }

  const tags = Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string") : [];
  if (isPresent(input.tags) && (!Array.isArray(input.tags) || tags.length < input.tags.length)) issues.push("tags");
  if (isPresent(input.name) && typeof input.name !== "string") issues.push("name");
  issues.push(...levelIssues);

  return { name: typeof input.name === "string" ? input.name : "", levels, roleKey, tags, compareTo };
}

const isPresent = (value: unknown) => value !== undefined && value !== null;

function pickRole(value: unknown, field: string, config: Config, issues: string[]): string | undefined {
  if (!isPresent(value) || value === "") return undefined;
  if (typeof value !== "string") {
    issues.push(field);
    return undefined;
  }
  const role = findRole(config.roles, value);
  if (!role) issues.push(`${field} ${JSON.stringify(value)}`);
  return role?.key;
}

function pickLevel(levels: object, key: string, max: number, issues: string[]): number {
  if (!Object.hasOwn(levels, key)) return 0;
  const raw = (levels as Record<string, unknown>)[key];
  if (raw === undefined) return 0;
  const shown = `${key}=${typeof raw === "string" ? raw : JSON.stringify(raw)}`;
  const level = typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "") ? Number(raw) : NaN;
  if (!Number.isFinite(level)) {
    issues.push(`${shown} (not a number)`);
    return 0;
  }
  const fixed = Math.min(Math.max(Math.round(level), 0), max);
  if (fixed !== level) issues.push(`${shown} (changed to ${fixed})`);
  return fixed;
}

/** Starting point when the URL has no state: a random role's levels. */
export function examplePerson(config: Config, random = Math.random): Person {
  const role = config.roles[Math.floor(random() * config.roles.length)];
  return normalizePerson({ name: "John Connor", levels: role?.levels ?? {}, roleKey: role?.key, tags: [] }, config)!;
}
