// Dependency-free SVG radar chart. All colours come from CSS (see .radar-* rules in styles.css).
import { useId, type CSSProperties } from "react";

export interface RadarSeries {
  name: string;
  values: number[]; // one percentage (0-100) per axis
  className: string; // e.g. "radar-series--person"
}

interface Props {
  axes: string[];
  series: RadarSeries[];
  /** Optional second line under each axis label, e.g. "2 / 5". */
  notes?: string[];
  /** Index of the highlighted axis. */
  selected?: number;
  /**
   * Called when an axis label is clicked. This is a pointer shortcut only: the chart is a single image for
   * assistive technologies, so keep an accessible way to select a category elsewhere on the page.
   */
  onSelect?: (axis: number) => void;
}

const RADIUS = 200;
const LABEL_RADIUS = RADIUS + 30;
const RINGS = [100, 80, 60, 40, 20];
const LABEL_LINE_LENGTH = 14;

function point(axis: number, total: number, value: number): [number, number] {
  const angle = -Math.PI / 2 + (2 * Math.PI * axis) / total;
  const distance = (RADIUS * value) / 100;
  return [Math.cos(angle) * distance, Math.sin(angle) * distance];
}

const shape = (values: number[]) =>
  values
    .map((value, axis) => {
      const [x, y] = point(axis, values.length, value);
      return `${axis === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join("") + "Z";

/** Splits a label into lines of roughly LABEL_LINE_LENGTH characters. */
function wrap(label: string): string[] {
  return label.split(/\s+/).reduce<string[]>((lines, word) => {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + " " + word).length <= LABEL_LINE_LENGTH) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
    return lines;
  }, []);
}

export default function RadarChart({ axes, series, notes, selected, onSelect }: Props) {
  const total = axes.length;
  const uid = useId().replace(/[^\w-]/g, "");

  return (
    <figure className="radar">
      <svg
        className="radar-svg"
        viewBox="-370 -300 740 600"
        role="img"
        aria-label={series
          .map((s) => `${s.name}: ${axes.map((axis, i) => `${axis} ${s.values[i]}%`).join(", ")}`)
          .join(". ")}
      >
        <defs>
          {series.map((s, index) => (
            <pattern
              key={s.className}
              id={`${uid}-hatch-${index}`}
              className={`radar-hatch ${s.className}`}
              width={7}
              height={7}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1={0} y1={0} x2={0} y2={7} />
            </pattern>
          ))}
        </defs>

        {RINGS.map((ring, index) => (
          <circle
            key={ring}
            className={`radar-ring ${index % 2 ? "radar-ring--even" : "radar-ring--odd"}`}
            r={(RADIUS * ring) / 100}
          />
        ))}

        {axes.map((_, index) => {
          const [x, y] = point(index, total, 100);
          return (
            <line
              key={index}
              className={`radar-axis${index === selected ? " radar-axis--selected" : ""}`}
              x1={0}
              y1={0}
              x2={x}
              y2={y}
            />
          );
        })}

        {/* Drawn in reverse so the first series (the person) stays on top. */}
        {series
          .map((s, index) => ({ s, index }))
          .reverse()
          .map(({ s, index }) => {
            const d = shape(s.values);
            // The `d` style lets browsers that support it animate the shape between states.
            const animated = { d: `path("${d}")` } as CSSProperties;
            return (
              <g key={s.className} className={`radar-series ${s.className}`}>
                <path className="radar-area" d={d} style={animated} />
                <path className="radar-texture" d={d} style={animated} fill={`url(#${uid}-hatch-${index})`} />
                {s.values.map((value, axis) => {
                  const [x, y] = point(axis, total, value);
                  return (
                    <circle
                      key={axis}
                      className="radar-point"
                      r={4.5}
                      style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` }}
                    >
                      <title>{`${s.name} · ${axes[axis]}: ${value}%`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}

        {axes.map((axis, index) => {
          const [x, y] = point(index, total, (LABEL_RADIUS / RADIUS) * 100);
          const lines = wrap(axis);
          const note = notes?.[index];
          const count = lines.length + (note ? 1 : 0);
          const anchor = Math.abs(x) < 1 ? "middle" : x > 0 ? "start" : "end";
          // Labels above the centre grow upwards, labels below grow downwards.
          const firstLineOffset = Math.abs(y) < 1 ? -(count - 1) / 2 : y < 0 ? -(count - 1) : 0;
          return (
            <text
              key={index}
              className={`radar-label${index === selected ? " radar-label--selected" : ""}${onSelect ? " radar-label--interactive" : ""}`}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              onClick={onSelect && (() => onSelect(index))}
            >
              {lines.map((line, lineIndex) => (
                <tspan key={lineIndex} x={x} dy={lineIndex === 0 ? `${firstLineOffset * 1.2}em` : "1.2em"}>
                  {line}
                </tspan>
              ))}
              {note && (
                <tspan className="radar-label-note" x={x} dy="1.35em">
                  {note}
                </tspan>
              )}
            </text>
          );
        })}
      </svg>

      <figcaption className="radar-legend">
        {series.map((s) => (
          <span key={s.className} className={`radar-legend-item ${s.className}`}>
            {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
