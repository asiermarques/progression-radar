import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";
import { examplePerson, normalizePerson, parseState, toSearch } from "./urlState";

const config = parseConfig({
  categories: [
    { key: "comm", name: "Communication", kpis: [1, 2, 3].map((level) => ({ summary: `s${level}`, level })) },
    { key: "back", name: "Backend", kpis: [{ summary: "s", level: 1 }] },
  ],
  roles: [{ key: "swe", name: "Software Engineer", levels: { comm: 2, back: 1 } }],
  site: {},
});

describe("url state", () => {
  it("round-trips a person through the URL", () => {
    const person = { name: "Ada & Co", levels: { comm: 2, back: 1 }, roleKey: "swe", tags: ["tech"], compareTo: "swe" };
    expect(parseState(toSearch(person), config)).toEqual({ kind: "ok", person });
  });

  it("reads legacy, non-encoded URLs", () => {
    const search = '?state={"name":"John","levels":{"comm":1,"back":0},"roleKey":"swe","tags":[]}';
    const result = parseState(search, config);
    expect(result).toMatchObject({ kind: "ok", person: { name: "John", levels: { comm: 1, back: 0 } } });
  });

  it("distinguishes an empty state from an invalid one", () => {
    expect(parseState("", config)).toEqual({ kind: "empty" });
    expect(parseState("?state={oops", config)).toEqual({ kind: "invalid" });
    expect(parseState("?state=[]", config)).toEqual({ kind: "invalid" });
  });

  it("drops unknown data and clamps levels to the configuration", () => {
    expect(
      normalizePerson({ levels: { comm: 99, back: -1, gone: 3 }, roleKey: "nope", compareTo: 1, tags: ["a", 2] }, config),
    ).toEqual({ name: "", levels: { comm: 3, back: 0 }, roleKey: undefined, tags: ["a"], compareTo: undefined });
  });

  it("builds an example from a role", () => {
    expect(examplePerson(config, () => 0)).toMatchObject({ roleKey: "swe", levels: { comm: 2, back: 1 } });
  });
});
