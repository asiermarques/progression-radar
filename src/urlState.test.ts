import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";
import { examplePerson, noticeFor, normalizePerson, parseState, toFragment, toUrl } from "./urlState";

const config = parseConfig({
  categories: [
    { key: "comm", name: "Communication", kpis: [1, 2, 3].map((level) => ({ summary: `s${level}`, level })) },
    { key: "back", name: "Backend", kpis: [{ summary: "s", level: 1 }] },
  ],
  roles: [
    { key: "swe", name: "Software Engineer", levels: { comm: 2, back: 1 } },
    { key: "lead", name: "Lead", levels: { comm: 3, back: 1 } },
  ],
  site: {},
});

const fragment = (hash: string) => parseState({ search: "", hash }, config);
const legacy = (search: string, hash = "") => parseState({ search, hash }, config);

describe("share link in the fragment", () => {
  const person = { name: "John Connor", levels: { comm: 2, back: 1 }, roleKey: "swe", tags: ["tech"], compareTo: "lead" };

  it("writes readable parameters, categories last", () => {
    expect(toFragment(person, config)).toBe("#name=John+Connor&role=swe&compare=lead&tag=tech&comm=2&back=1");
  });

  it("omits empty fields but always writes every category", () => {
    expect(toFragment({ name: "", levels: {}, tags: [] }, config)).toBe("#comm=0&back=0");
  });

  it("round-trips special characters", () => {
    const tricky = { ...person, name: "Ana & Co = #1 + ñ 成長", tags: ["a b", "c&d", "e=f", "#"] };
    expect(fragment(toFragment(tricky, config))).toEqual({ kind: "ok", person: tricky, issues: [] });
  });

  it("opens a person with nothing set instead of the example", () => {
    const empty = { name: "", levels: { comm: 0, back: 0 }, roleKey: undefined, tags: [], compareTo: undefined };
    expect(fragment(toFragment(empty, config))).toEqual({ kind: "ok", person: empty, issues: [] });
  });

  it("reads a hand-written fragment", () => {
    expect(fragment("#name=Ana&comm=3")).toMatchObject({ kind: "ok", person: { name: "Ana", levels: { comm: 3, back: 0 } } });
  });

  it("is empty without a fragment or state", () => {
    expect(fragment("")).toEqual({ kind: "empty" });
    expect(fragment("#")).toEqual({ kind: "empty" });
  });

  it("builds a url that replaces the legacy state and keeps the other parameters", () => {
    const href = 'https://example.com/radar/?state={"name":"x"}&utm=1#old=1';
    expect(toUrl(person, config, href)).toBe(
      "https://example.com/radar/?utm=1#name=John+Connor&role=swe&compare=lead&tag=tech&comm=2&back=1",
    );
  });
});

describe("legacy share link", () => {
  it("reads legacy, non-encoded URLs", () => {
    const search = '?state={"name":"John","levels":{"comm":1,"back":0},"roleKey":"swe","tags":[]}';
    expect(legacy(search)).toMatchObject({ kind: "ok", person: { name: "John", levels: { comm: 1, back: 0 } } });
  });

  it("reads percent-encoded JSON", () => {
    const search = "?" + new URLSearchParams({ state: JSON.stringify({ name: "Ada & Co", levels: { comm: 2 } }) });
    expect(legacy(search)).toMatchObject({ kind: "ok", person: { name: "Ada & Co", levels: { comm: 2, back: 0 } } });
  });

  it("wins over the fragment", () => {
    expect(legacy('?state={"name":"Legacy"}', "#name=Fragment")).toMatchObject({ person: { name: "Legacy" } });
  });

  it("is invalid, with a reason, when the JSON is broken or not an object", () => {
    expect(legacy("?state={oops")).toEqual({ kind: "invalid", reason: "the state is not valid JSON" });
    expect(legacy("?state=[]")).toEqual({ kind: "invalid", reason: "the state is not a JSON object" });
  });
});

describe("unusable link data", () => {
  it("is invalid when no field is known", () => {
    expect(fragment("#foo=bar")).toEqual({ kind: "invalid", reason: "it has no field this app knows" });
  });

  it("keeps the valid data and names unknown categories", () => {
    expect(fragment("#name=Ana&comm=2&gone=3")).toMatchObject({
      kind: "ok",
      person: { name: "Ana", levels: { comm: 2, back: 0 } },
      issues: ["gone"],
    });
  });

  it("names unknown roles", () => {
    const state = fragment("#name=Ana&role=nope&compare=nada");
    expect(state).toMatchObject({ kind: "ok", person: { roleKey: undefined, compareTo: undefined } });
    expect(state.kind === "ok" && state.issues).toEqual(['role "nope"', 'compare "nada"']);
  });

  it("names clamped and non-numeric levels", () => {
    const state = fragment("#comm=99&back=abc");
    expect(state).toMatchObject({ kind: "ok", person: { levels: { comm: 3, back: 0 } } });
    expect(state.kind === "ok" && state.issues).toEqual(["comm=99 (changed to 3)", "back=abc (not a number)"]);
  });

  it("applies the same rules to legacy links", () => {
    const state = legacy('?state={"name":"x","levels":{"comm":1,"gone":2},"extra":true,"roleKey":"nope"}');
    expect(state.kind === "ok" && state.issues).toEqual(["extra", "role \"nope\"", "gone"]);
  });

  it("reports nothing for a clean link", () => {
    const person = { name: "A", levels: { comm: 1, back: 1 }, roleKey: "swe", tags: [], compareTo: "lead" };
    expect(fragment(toFragment(person, config))).toMatchObject({ kind: "ok", issues: [] });
    expect(legacy('?state={"name":"A","levels":{"comm":1}}')).toMatchObject({ issues: [] });
  });

  it("explains each state in a notice", () => {
    expect(noticeFor({ kind: "empty" }, "x")).toBeNull();
    expect(noticeFor({ kind: "ok", person: examplePerson(config), issues: [] }, "x")).toBeNull();
    expect(noticeFor({ kind: "invalid", reason: "r" }, "an example is shown instead")).toBe(
      "This link is not valid (r), so an example is shown instead.",
    );
    expect(noticeFor({ kind: "ok", person: examplePerson(config), issues: ["gone", 'role "x"'] }, "x")).toBe(
      'Some data in this link was ignored or corrected: gone, role "x".',
    );
  });
});

describe("normalizePerson", () => {
  it("drops unknown data and clamps levels to the configuration", () => {
    expect(
      normalizePerson({ levels: { comm: 99, back: -1, gone: 3 }, roleKey: "nope", compareTo: 1, tags: ["a", 2] }, config),
    ).toEqual({ name: "", levels: { comm: 3, back: 0 }, roleKey: undefined, tags: ["a"], compareTo: undefined });
  });

  it("rejects anything that is not an object", () => {
    expect(normalizePerson([], config)).toBeNull();
    expect(normalizePerson(null, config)).toBeNull();
  });
});

describe("example person", () => {
  it("is built from a role", () => {
    expect(examplePerson(config, () => 0)).toMatchObject({ roleKey: "swe", levels: { comm: 2, back: 1 } });
  });
});
