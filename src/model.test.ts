import { describe, expect, it } from "vitest";
import { kpisAt, levelsOf, maxLevel, percentage, type Category } from "./model";

const kpi = (level: number) => ({ summary: `KPI ${level}`, description: "", level, tags: [] });
const category = (levels: number[]): Category => ({ key: "c", name: "C", description: "", kpis: levels.map(kpi) });

describe("model", () => {
  it("lists level 0 plus every KPI level, unique and sorted", () => {
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

  it("returns the KPIs of a level", () => {
    const c = category([1, 1, 2]);
    expect(kpisAt(c, 1)).toHaveLength(2);
    expect(kpisAt(c, 4)).toEqual([]);
  });
});
