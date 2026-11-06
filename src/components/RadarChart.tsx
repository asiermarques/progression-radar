// Dependency-free SVG radar chart. All colours come from CSS (see .radar-* rules in styles.css).

export interface RadarSeries {
  name: string;
  values: number[]; // one percentage (0-100) per axis
  className: string; // e.g. "radar-series--person"
}

interface Props {
  axes: string[];
  series: RadarSeries[];
}

const RADIUS = 200;
const LABEL_RADIUS = RADIUS + 22;
const RINGS = [100, 80, 60, 40, 20];
const LABEL_LINE_LENGTH = 14;

function point(axis: number, total: number, value: number): [number, number] {
  const angle = -Math.PI / 2 + (2 * Math.PI * axis) / total;
  const distance = (RADIUS * value) / 100;
  return [Math.cos(angle) * distance, Math.sin(angle) * distance];
}

const polygon = (values: number[]) =>
  values.map((value, axis) => point(axis, values.length, value).map((n) => n.toFixed(1)).join(",")).join(" ");

/** Splits a label into lines of roughly LABEL_LINE_LENGTH characters. */
function wrap(label: string): string[] {
  return label.split(/\s+/).reduce<string[]>((lines, word) => {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + " " + word).length <= LABEL_LINE_LENGTH) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
    return lines;
  }, []);
}

export default function RadarChart({ axes, series }: Props) {
  const total = axes.length;

  return (
    <figure className="radar">
      <svg
        className="radar-svg"
        viewBox="-340 -290 680 580"
        role="img"
        aria-label={series
          .map((s) => `${s.name}: ${axes.map((axis, i) => `${axis} ${s.values[i]}%`).join(", ")}`)
          .join(". ")}
      >
        {RINGS.map((ring, index) => (
          <polygon
            key={ring}
            className={`radar-ring ${index % 2 ? "radar-ring--even" : "radar-ring--odd"}`}
            points={polygon(axes.map(() => ring))}
          />
        ))}

        {axes.map((_, index) => {
          const [x, y] = point(index, total, 100);
          return <line key={index} className="radar-axis" x1={0} y1={0} x2={x} y2={y} />;
        })}

        {series.map((s) => (
          <g key={s.className} className={`radar-series ${s.className}`}>
            <polygon className="radar-area" points={polygon(s.values)} />
            {s.values.map((value, index) => {
              const [x, y] = point(index, total, value);
              return (
                <circle key={index} className="radar-point" cx={x} cy={y} r={4}>
                  <title>{`${s.name} · ${axes[index]}: ${value}%`}</title>
                </circle>
              );
            })}
          </g>
        ))}

        {axes.map((axis, index) => {
          const [x, y] = point(index, total, (LABEL_RADIUS / RADIUS) * 100);
          const lines = wrap(axis);
          const anchor = Math.abs(x) < 1 ? "middle" : x > 0 ? "start" : "end";
          // Labels above the centre grow upwards, labels below grow downwards.
          const firstLineOffset = Math.abs(y) < 1 ? -(lines.length - 1) / 2 : y < 0 ? -(lines.length - 1) : 0;
          return (
            <text key={index} className="radar-label" x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
              {lines.map((line, lineIndex) => (
                <tspan key={lineIndex} x={x} dy={lineIndex === 0 ? `${firstLineOffset * 1.2}em` : "1.2em"}>
                  {line}
                </tspan>
              ))}
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
