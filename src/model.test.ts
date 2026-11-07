import { describe, expect, it } from "vitest";
import {
  initials,
  expectationsAt,
  levelsOf,
  maxLevel,
  overallPercentage,
  percentage,
  roleGap,
  type Category,
} from "./model";

const expectation = (level: number) => ({ summary: `Expectation ${level}`, description: "", level });
const category = (levels: number[]): Category => ({ key: "c", name: "C", description: "", expectations: levels.map(expectation) });

describe("model", () => {
  it("lists level 0 plus every expectation level, unique and sorted", () => {
    expect(levelsOf(category([3, 1, 1, 2]))).toEqual([0, 1, 2, 3]);
    expect(levelsOf(category([]))).toEqual([0]);
  });

  it("computes the max level", () => {
    expect(maxLevel(category([1, 5, 2]))).toBe(5);
    expect(maxLevel(category([]))).toBe(0);
  });

  it("computes the percentage relative to the max level, clamped", () => {
    const c = category([1, 2, 3, 4, 5]);
    expect(percentage(c, 0)).toBe(0);
    expect(percentage(c, 2)).toBe(40);
    expect(percentage(c, 5)).toBe(100);
    expect(percentage(c, 9)).toBe(100);
    expect(percentage(category([]), 3)).toBe(0);
  });

  it("returns the expectations of a level", () => {
    const c = category([1, 1, 2]);
    expect(expectationsAt(c, 1)).toHaveLength(2);
    expect(expectationsAt(c, 4)).toEqual([]);
  });

  it("averages the progress of every category", () => {
    const a = { ...category([1, 2]), key: "a" };
    const b = { ...category([1, 2, 3, 4]), key: "b" };
    expect(overallPercentage([a, b], { a: 2, b: 1 })).toBe(63);
    expect(overallPercentage([a, b], {})).toBe(0);
    expect(overallPercentage([], {})).toBe(0);
  });

  it("measures the gap with a role, counting missing categories as level 0", () => {
    const a = { ...category([1, 2, 3]), key: "a" };
    const b = { ...category([1, 2, 3]), key: "b" };
    const c = { ...category([1, 2, 3]), key: "c" };
    const role = { key: "r", name: "R", levels: { a: 3, b: 1 } };
    expect(roleGap([a, b, c], { a: 1, b: 2 }, role)).toEqual({ met: 2, total: 3, levelsToGo: 2 });
  });

  it("builds initials from the first and last words", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("  grace  brewster murray hopper ")).toBe("GH");
    expect(initials("ada")).toBe("A");
    expect(initials("成長")).toBe("成");
    expect(initials("")).toBe("");
  });
});
