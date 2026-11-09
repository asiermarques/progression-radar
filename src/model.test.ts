import { describe, expect, it } from "vitest";
import {
  initials,
  expectationsAt,
  levelsOf,
  maxLevel,
  overallPercentage,
  percentage,
  recordedOverallPercentage,
  recordedRoleGap,
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

describe("overall progress over the recorded categories", () => {
  const cat = (key: string, max: number): Category => ({
    key,
    name: key,
    description: "",
    expectations: [{ summary: "s", description: "", level: max }],
  });
  const a = cat("a", 4);
  const b = cat("b", 2);
  const c = cat("c", 2);

  it("averages the progress of the categories that have a level, and counts them", () => {
    expect(recordedOverallPercentage([a, b, c], { a: 2, b: 2 })).toEqual({ percentage: 75, recorded: 2 });
  });

  it("does not count a category with no level as level 0, but does count an explicit 0", () => {
    expect(recordedOverallPercentage([a, b], { a: 4 })?.percentage).toBe(100);
    expect(recordedOverallPercentage([a, b], { a: 4, b: 0 })?.percentage).toBe(50);
  });

  it("has no overall progress when nothing is recorded", () => {
    expect(recordedOverallPercentage([a, b], {})).toBeUndefined();
  });

  it("keeps overallPercentage() as the app uses it: a missing level is 0", () => {
    expect(overallPercentage([a, b], { a: 4 })).toBe(50);
  });
});

describe("role gap over the recorded categories", () => {
  const cat = (key: string, max: number): Category => ({
    key,
    name: key,
    description: "",
    expectations: [{ summary: "s", description: "", level: max }],
  });
  const [a, b, c] = [cat("a", 4), cat("b", 2), cat("c", 2)];
  const role = { key: "r", name: "R", levels: { a: 2, b: 2, c: 2 } };

  it("counts only the recorded categories, so one that is not recorded adds nothing to the levels to go", () => {
    expect(recordedRoleGap([a, b, c], { a: 1, b: 2 }, role)).toEqual({ met: 1, total: 2, levelsToGo: 1 });
  });

  it("counts an explicit 0 as level 0", () => {
    expect(recordedRoleGap([a, b, c], { a: 0, b: 2 }, role)).toEqual({ met: 1, total: 2, levelsToGo: 2 });
  });

  it("has no role gap when nothing is recorded", () => {
    expect(recordedRoleGap([a, b, c], {}, role)).toBeUndefined();
  });

  it("keeps roleGap() as the app uses it: a missing level is 0", () => {
    expect(roleGap([a, b, c], { a: 1, b: 2 }, role)).toEqual({ met: 1, total: 3, levelsToGo: 3 });
  });
});
