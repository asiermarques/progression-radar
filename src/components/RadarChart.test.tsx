import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RadarChart from "./RadarChart";

const axes = ["A", "B", "C", "D"];

describe("RadarChart", () => {
  it("renders on the server, as the Report does", () => {
    const html = renderToStaticMarkup(
      <RadarChart axes={axes} series={[{ name: "Ana", values: [100, 50, 0, 25], className: "radar-series--person" }]} />,
    );
    expect(html).toContain("<svg");
    expect(html).toContain('aria-label="Ana: A 100%, B 50%, C 0%, D 25%"');
    expect(html.match(/class="radar-point"/g)).toHaveLength(4);
  });

  it("draws an axis that is not recorded neither at 0 nor with a point, and says so in the text alternative", () => {
    const html = renderToStaticMarkup(
      <RadarChart
        axes={axes}
        series={[{ name: "Ana", values: [100, 50, 0, 25], recorded: [true, true, false, true], className: "radar-series--person" }]}
      />,
    );
    expect(html).toContain('aria-label="Ana: A 100%, B 50%, C not recorded, D 25%"');
    expect(html.match(/class="radar-point"/g)).toHaveLength(3);
    // the polygon goes from B to D without passing through the centre
    expect(html).toContain('d="M0.0,-200.0L100.0,0.0L-50.0,0.0Z"');
    expect(html).not.toContain("C: 0%");
  });

  it("draws no polygon for a series with nothing recorded", () => {
    const html = renderToStaticMarkup(
      <RadarChart axes={axes} series={[{ name: "Ana", values: [0, 0, 0, 0], recorded: [false, false, false, false], className: "radar-series--person" }]} />,
    );
    expect(html).not.toContain("radar-point");
    expect(html).not.toContain(' d="M');
  });

  it("is drawn as before when every axis is recorded", () => {
    const plain = renderToStaticMarkup(
      <RadarChart axes={axes} series={[{ name: "Ana", values: [100, 50, 0, 25], className: "radar-series--person" }]} />,
    );
    const all = renderToStaticMarkup(
      <RadarChart axes={axes} series={[{ name: "Ana", values: [100, 50, 0, 25], recorded: [true, true, true, true], className: "radar-series--person" }]} />,
    );
    expect(all.replace(/_R_[^-"]*-/g, "")).toBe(plain.replace(/_R_[^-"]*-/g, ""));
  });
});
