// Renders a Report as one self-contained HTML page: CSS and fonts inline, no script. Rendered with React on the server,
// so every value read from a snapshot is escaped by construction. See docs/adr/0007.
import type { CSSProperties, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RadarChart from "../src/components/RadarChart.tsx";
import { initials } from "../src/model.ts";
import type { Cell, Entry, PersonHistory, Report } from "./report.ts";

/** Blocks every request: the page works offline and cannot send what it holds anywhere. Fonts are embedded. */
export const CONTENT_SECURITY_POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";

export interface RenderOptions {
  /** The title of the page. */
  title: string;
  /** The main heading; the title when not given. */
  heading?: string;
  /** The CSS that comes before the Report's own: fonts, the app's custom properties and the resolved theme. */
  css: string;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
/** "3 categories", "1 category". */
const categories = (count: number) => `${count} ${count === 1 ? "category" : "categories"}`;
const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** A custom property for the CSS, e.g. `{ "--heat": 3 }`. */
const vars = (values: Record<string, string | number>) => values as CSSProperties;

/** The step of the heat scale: 0 for no progress, then one step per fifth, up to 5 at the Highest level. */
const heat = (progress: number) => (progress <= 0 ? 0 : Math.min(5, Math.ceil(progress / 20)));

function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}

/** Where a level stands against the level the role requires: above it, at it, below it (the gap) or nothing to compare. */
function targetStatus(cell: Cell) {
  if (cell.target === undefined || cell.level === undefined) return undefined;
  return cell.level > cell.target ? "above" : cell.level === cell.target ? "met" : "below";
}

/**
 * How strong the tone of a level against its role is, from 1 to 3: for the gap, one step per level below (3 for three
 * or more); for a level that meets the role, 1, and one more step per level above it.
 */
const toneStep = (status: "above" | "met" | "below", difference: number) =>
  Math.min(3, status === "below" ? difference : 1 + difference);

/** The Categories of a row above the level of its role. */
const aboveTheRole = (entry: Entry) => entry.cells.filter((cell) => targetStatus(cell) === "above").length;

/** One Reached level as a cell of a heat map, tinted by its Progress and marked against the role's target. */
function HeatCell({ cell }: { cell: Cell }) {
  if (cell.level === undefined) {
    return (
      <td className="report-heat" data-heat="none">
        <span className="report-heat-level" aria-hidden="true">
          –
        </span>
        <VisuallyHidden>not recorded</VisuallyHidden>
      </td>
    );
  }
  const status = targetStatus(cell);
  const difference = cell.target === undefined ? 0 : Math.abs(cell.target - cell.level);
  return (
    <td
      className="report-heat"
      data-heat={heat(cell.progress ?? 0)}
      data-status={status}
      data-step={status === undefined ? undefined : toneStep(status, difference)}
    >
      <span className="report-heat-level">
        {cell.level}
        {cell.above && (
          <sup className="report-above" aria-hidden="true">
            +
          </sup>
        )}
      </span>
      {status && (
        <span className="report-heat-mark" aria-hidden="true">
          {status === "met" ? "✓" : `${status === "above" ? "+" : "−"}${difference}`}
        </span>
      )}
      <VisuallyHidden>
        {` of ${cell.max}`}
        {cell.above ? ", above the highest level" : ""}
        {status === "met" ? `, meets the target of ${cell.target}` : ""}
        {status === "below" ? `, ${plural(difference, "level")} below the target of ${cell.target}` : ""}
        {status === "above" ? `, ${plural(difference, "level")} above the target of ${cell.target}` : ""}
      </VisuallyHidden>
    </td>
  );
}

/** A thin vermilion line of the Overall progress of every row of a Person. */
function Sparkline({ entries }: { entries: Entry[] }) {
  const points = entries.map((entry) => entry.overall).filter((value) => value !== undefined);
  if (points.length < 2) return null;
  const [width, height, pad] = [72, 22, 3];
  const xy = points.map((value, index) => [
    pad + ((width - 2 * pad) * index) / (points.length - 1),
    height - pad - ((height - 2 * pad) * value) / 100,
  ]);
  const last = xy[xy.length - 1];
  return (
    <svg className="report-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <line className="report-spark-base" x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} />
      <polyline points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} />
      <circle cx={last[0]} cy={last[1]} r={2.6} />
    </svg>
  );
}

function Overall({ entry, history }: { entry: Entry; history?: Entry[] }) {
  return (
    <div className="report-overall">
      <span className="report-figure">
        {entry.overall === undefined ? "–" : entry.overall}
        {entry.overall !== undefined && <small>%</small>}
      </span>
      {history && <Sparkline entries={history} />}
      <span className="report-meter" aria-hidden="true">
        <span style={vars({ "--value": `${entry.overall ?? 0}%` })} />
      </span>
      <small className="report-covers">
        {entry.recorded} of {categories(entry.total)}
      </small>
    </div>
  );
}

function Gap({ entry }: { entry: Entry }) {
  if (!entry.gap) return <small className="report-muted">no role to compare</small>;
  const { met, total, levelsToGo, role } = entry.gap;
  const above = aboveTheRole(entry);
  return (
    <div className="report-gap" data-status={met === total ? "met" : "below"}>
      <span>
        On target in <b className="report-figure report-figure--compare">{met}</b> of {categories(total)}
      </span>
      <span>
        <b className={`report-figure${levelsToGo > 0 ? " report-figure--below" : ""}`}>{levelsToGo}</b>{" "}
        {levelsToGo === 1 ? "level" : "levels"} to go
      </span>
      {above > 0 && (
        <span>
          <b className="report-figure report-figure--above">{above}</b> above the role
        </span>
      )}
      <small className="report-covers">
        {role}, covers {entry.recorded} of {categories(entry.total)}
      </small>
    </div>
  );
}

function HeatLegend({ compare, progress }: { compare: boolean; progress: boolean }) {
  return (
    <ul className="report-legend" aria-label="How to read the map">
      {compare && (
        <li className="report-legend-scale">
          <span className="report-legend-label">Against the role</span>
          <span className="report-legend-steps report-legend-steps--role" aria-hidden="true">
            {[3, 2, 1].map((step) => (
              <i key={`below-${step}`} className="report-heat" data-status="below" data-step={step}>
                −{step}
                {step === 3 ? "…" : ""}
              </i>
            ))}
            {[1, 2, 3].map((step) => (
              <i key={`above-${step}`} className="report-heat" data-status={step === 1 ? "met" : "above"} data-step={step}>
                {step === 1 ? "✓" : `+${step - 1}`}
                {step === 3 ? "…" : ""}
              </i>
            ))}
          </span>
          <span className="report-legend-ends">
            <span className="report-figure--below">gap</span> · <span className="report-figure--above">met</span>
          </span>
        </li>
      )}
      {progress && (
        <li className="report-legend-scale">
          <span className="report-legend-label">{compare ? "No role" : "Progress"}</span>
          <span className="report-legend-steps" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((step) => (
              <i key={step} className="report-heat" data-heat={step} />
            ))}
          </span>
          <span className="report-legend-ends">0 – 100%</span>
        </li>
      )}
      <li>
        <i className="report-heat" data-heat="none" aria-hidden="true" /> not recorded, never counted as 0
      </li>
      <li>
        <sup className="report-above">+</sup> above the highest level
      </li>
    </ul>
  );
}

function TeamOverview({ report }: { report: Report }) {
  const gapTitle = report.compare ? `Role gap against ${report.compare}` : "Role gap";
  const histories = new Map(report.persons.map((person) => [person.id, person]));
  const cells = report.persons.flatMap((person) => person.entries.flatMap((entry) => entry.cells));
  const compares = cells.some((cell) => targetStatus(cell) !== undefined);
  const progressOnly = report.team.length > 1 || cells.some((cell) => cell.level !== undefined && targetStatus(cell) === undefined);
  return (
    <section className="report-section" aria-labelledby="team-overview">
      <header className="report-section-head">
        <p className="report-eyebrow" aria-hidden="true">
          01
        </p>
        <h2 id="team-overview">Team overview</h2>
        <p className="report-note">
          Each Person at their latest row in any Snapshot. Against the role of their Role gap, a level is green when it
          meets the role, darker the further above it, and red when it is below, darker the bigger the gap. Without a
          role to compare, ink shows how close the level is to the highest one.
        </p>
      </header>
      <HeatLegend compare={compares} progress={progressOnly} />
      <div className="report-scroll">
        <table className="report-heatmap">
          <caption className="visually-hidden">
            Reached level of each Category, for every Person at their latest row, with the Overall progress and the Role
            gap
          </caption>
          <thead>
            <tr>
              <th scope="col" className="report-corner">
                Person
              </th>
              {report.categories.map((category) => (
                <th scope="col" key={category.key} className="report-category">
                  <span>{category.name}</span>
                </th>
              ))}
              <th scope="col" className="report-col-overall">
                Overall progress
              </th>
              <th scope="col" className="report-col-gap">
                {gapTitle}
              </th>
            </tr>
          </thead>
          <tbody>
            {report.team.map((member, index) => {
              const person = histories.get(member.id);
              return (
                <tr key={member.id} style={vars({ "--row": index })}>
                  <th scope="row" className="report-person-cell">
                    <a href={`#person-${member.id}`}>{member.name}</a>
                    <small>
                      {member.snapshot}
                      {person?.role ? ` · ${person.role}` : ""}
                    </small>
                  </th>
                  {member.entry.cells.map((cell) => (
                    <HeatCell key={cell.key} cell={cell} />
                  ))}
                  <td>
                    <Overall entry={member.entry} history={person?.entries} />
                  </td>
                  <td>
                    <Gap entry={member.entry} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {report.team.length > 1 && (
            <tfoot>
              <tr>
                <th scope="row" className="report-person-cell">
                  Team average
                  <small>progress of who recorded it</small>
                </th>
                {report.teamAverage.map((value, index) =>
                  value === undefined ? (
                    <td key={report.categories[index].key} className="report-heat" data-heat="none">
                      <span className="report-heat-level" aria-hidden="true">
                        –
                      </span>
                      <VisuallyHidden>not recorded</VisuallyHidden>
                    </td>
                  ) : (
                    <td key={report.categories[index].key} className="report-heat report-average" data-heat={heat(value)}>
                      <span className="report-heat-level">
                        {value}
                        <small>%</small>
                      </span>
                    </td>
                  ),
                )}
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function Radar({ person, report }: { person: PersonHistory; report: Report }) {
  const axes = report.categories.map((category) => category.name);
  // A Category that one of the series did not record says so under its label.
  const notes = axes.map((_, index) => (person.radar.some((series) => !series.recorded[index]) ? "not recorded" : ""));
  const series = person.radar.map((item, index) => ({
    name: item.snapshot,
    values: item.values,
    recorded: item.recorded,
    className: index === 0 ? "radar-series--person" : "radar-series--compare",
  }));
  return (
    <div className="report-radar">
      <RadarChart axes={axes} notes={notes} series={series} />
      <p className="report-note">
        {person.radar.length > 1 ? "The last and the first Snapshot. " : ""}A Category that is not recorded is not drawn.
        All the values are in the table.
      </p>
    </div>
  );
}

function Change({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="report-muted">–</span>;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return (
    <span className="report-change" data-direction={value > 0 ? "up" : value < 0 ? "down" : "same"}>
      {sign}
      {Math.abs(value)}
    </span>
  );
}

function PersonSection({ person, report, index }: { person: PersonHistory; report: Report; index: number }) {
  const latest = person.entries[person.entries.length - 1];
  const first = person.entries[0];
  const several = person.entries.length > 1;
  return (
    <details open className="report-person" id={`person-${person.id}`} style={vars({ "--row": index })}>
      <summary>
        <span className="report-seal" aria-hidden="true">
          {initials(person.name) || "?"}
        </span>
        <span className="report-person-heading">
          <h3>{person.name}</h3>
          <small>
            {person.id}
            {person.role ? ` · ${person.role}` : ""}
            {" · "}
            {plural(person.entries.length, "Snapshot")}
            {several ? `, ${first.snapshot} – ${latest.snapshot}` : `, ${latest.snapshot}`}
          </small>
        </span>
        <dl className="report-stats">
          <div>
            <dt>Overall</dt>
            <dd className="report-figure">
              {latest.overall ?? "–"}
              {latest.overall !== undefined && <small>%</small>}
            </dd>
          </div>
          {latest.gap && (
            <>
              <div>
                <dt>On target</dt>
                <dd className="report-figure report-figure--compare">
                  {latest.gap.met}
                  <small>/{latest.gap.total}</small>
                </dd>
              </div>
              <div>
                <dt>{latest.gap.levelsToGo === 1 ? "Level to go" : "Levels to go"}</dt>
                <dd className={`report-figure${latest.gap.levelsToGo > 0 ? " report-figure--below" : ""}`}>
                  {latest.gap.levelsToGo}
                </dd>
              </div>
              {aboveTheRole(latest) > 0 && (
                <div>
                  <dt>Above the role</dt>
                  <dd className="report-figure report-figure--above">{aboveTheRole(latest)}</dd>
                </div>
              )}
            </>
          )}
        </dl>
      </summary>
      <div className="report-person-body">
        <div className="report-scroll">
          <table className="report-table">
            <caption>Reached level of each Category by Snapshot, with the Overall progress and the Role gap of each row</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                {person.entries.map((entry) => (
                  <th scope="col" key={entry.snapshot} className="report-num">
                    {entry.snapshot}
                  </th>
                ))}
                {several && (
                  <th scope="col" className="report-num">
                    Change
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {report.categories.map((category, row) => (
                <tr key={category.key}>
                  <th scope="row">{category.name}</th>
                  {person.entries.map((entry) => (
                    <HeatCell key={entry.snapshot} cell={entry.cells[row]} />
                  ))}
                  {several && (
                    <td className="report-num">
                      <Change value={person.changes[row]} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Overall progress</th>
                {person.entries.map((entry) => (
                  <td key={entry.snapshot}>
                    <Overall entry={entry} />
                  </td>
                ))}
                {several && <td />}
              </tr>
              <tr>
                <th scope="row">{report.compare ? `Role gap against ${report.compare}` : "Role gap"}</th>
                {person.entries.map((entry) => (
                  <td key={entry.snapshot}>
                    <Gap entry={entry} />
                  </td>
                ))}
                {several && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
        <Radar person={person} report={report} />
      </div>
    </details>
  );
}

function ReportBody({ report, heading }: { report: Report; heading: string }) {
  const { snapshots } = report;
  const period = snapshots.length > 1 ? `${snapshots[0]} – ${snapshots[snapshots.length - 1]}` : snapshots[0];
  return (
    <div className="report">
      <header className="report-masthead">
        <p className="report-eyebrow">Progression report</p>
        <h1>{heading}</h1>
        <dl className="report-meta">
          <div>
            <dt>Persons</dt>
            <dd>{report.persons.length}</dd>
          </div>
          <div>
            <dt>Snapshots</dt>
            <dd>{snapshots.length}</dd>
          </div>
          {period && (
            <div>
              <dt>Period</dt>
              <dd>{period}</dd>
            </div>
          )}
          <div>
            <dt>Compared with</dt>
            <dd>{report.compare ?? "the role of each row"}</dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{report.generatedOn}</dd>
          </div>
        </dl>
        <p className="visually-hidden">
          {plural(report.persons.length, "Person")} · generated on {report.generatedOn}
        </p>
      </header>
      <main>
        <TeamOverview report={report} />
        <section className="report-section" aria-labelledby="evolution">
          <header className="report-section-head">
            <p className="report-eyebrow" aria-hidden="true">
              02
            </p>
            <h2 id="evolution">Evolution of each Person</h2>
            <p className="report-note">
              Every Snapshot of each Person, the change from the first to the last level recorded, and their radar.
            </p>
          </header>
          {report.persons.map((person, index) => (
            <PersonSection key={person.id} person={person} report={report} index={index} />
          ))}
        </section>
        {report.problems.length > 0 && (
          <section className="report-section report-problems" aria-labelledby="report-problems">
            <h2 id="report-problems">{plural(report.problems.length, "warning")} in the snapshots</h2>
            <ul>
              {report.problems.map((problem, index) => (
                <li key={index}>
                  <code>
                    {problem.file}
                    {problem.line ? `:${problem.line}` : ""}
                  </code>{" "}
                  {problem.message}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer className="report-footer">
        <p className="report-footer-title">{heading}</p>
        <p>
          Generated on {report.generatedOn} from {plural(snapshots.length, "Snapshot")}. A Category that is not recorded
          is never counted as level 0.
        </p>
      </footer>
    </div>
  );
}

const REPORT_CSS = `
/* Report */
*,*::before,*::after{box-sizing:border-box}
html{font-size:var(--font-size);-webkit-text-size-adjust:100%}
body{margin:0;background:var(--color-background);color:var(--color-text);font-family:var(--font-family);line-height:1.6;font-variant-numeric:tabular-nums}
::selection{background:var(--color-primary);color:var(--color-on-primary)}
a{color:inherit;text-decoration-color:color-mix(in oklab,var(--color-primary) 55%,transparent);text-underline-offset:.2em}
a:hover{color:var(--color-primary)}
a:focus-visible,summary:focus-visible{outline:2px solid var(--color-primary);outline-offset:3px}
.visually-hidden{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.report{--gutter:clamp(1rem,4vw,3rem);--bleed:max(var(--gutter),calc((100% - var(--max-width))/2))}
.report h1,.report h2,.report h3{font-family:var(--font-display);font-weight:800;margin:0;line-height:1.15;letter-spacing:-.01em}
.report small{font-size:.78em}
.report-muted,.report-covers{color:var(--color-muted)}
.report-figure{font-family:var(--font-display);font-weight:700;font-variant-numeric:tabular-nums}
.report-figure small{font-size:.5em;margin-left:.1em;color:var(--color-muted);font-weight:700}
.report-figure--below{color:var(--color-below)}
.report-figure--above{color:var(--color-above)}
.report-figure--compare{color:var(--color-compare)}
.report-eyebrow,.report-meta dt,.report-stats dt,.report-legend-label,.report-heatmap thead th,.report-table thead th,.report-corner{font-family:var(--font-family);font-size:.7rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--color-muted)}
.report-note{font-size:.88rem;color:var(--color-muted);margin:.4rem 0 0;max-width:68ch}

/* Masthead: the washi band */
.report-masthead{padding:clamp(2.5rem,6vw,4.5rem) var(--bleed) clamp(2rem,4vw,3rem);background:radial-gradient(60rem 22rem at 100% 0,color-mix(in oklab,var(--color-primary) 9%,transparent),transparent 70%),radial-gradient(50rem 20rem at 0 100%,color-mix(in oklab,var(--color-compare) 6%,transparent),transparent 70%),var(--texture),var(--color-band);animation:rise .7s var(--ease) both}
.report-masthead .report-eyebrow{margin:0 0 .6rem;color:var(--color-primary)}
.report-masthead .report-eyebrow::before{content:"";display:inline-block;width:.5rem;height:.5rem;margin-right:.6rem;background:var(--color-primary);transform:translateY(-.08em) rotate(45deg)}
.report-masthead h1{font-size:clamp(2rem,5vw,3.4rem);max-width:22ch}
.report-meta{display:flex;flex-wrap:wrap;gap:1rem clamp(1.5rem,4vw,3rem);margin:clamp(1.5rem,3vw,2.25rem) 0 0}
.report-meta div{min-width:0}
.report-meta dd{margin:.15rem 0 0;font-family:var(--font-display);font-weight:700;font-size:1.05rem}

/* Sections */
main{padding:0 var(--bleed)}
.report-section{padding-top:clamp(2.5rem,6vw,4rem);animation:rise .7s var(--ease) .12s both}
.report-section+.report-section{animation-delay:.2s}
.report-section-head{display:grid;grid-template-columns:auto 1fr;column-gap:1rem;align-items:baseline;margin-bottom:1.25rem}
.report-section-head .report-eyebrow{margin:0;font-family:var(--font-display);font-size:1rem;letter-spacing:.04em;color:var(--color-primary)}
.report-section-head h2{font-size:clamp(1.5rem,3vw,2rem)}
.report-section-head .report-note{grid-column:2}

/* Heat scale: sumi ink washed into the paper, denser the closer to the Highest level. Neutral on purpose: a pale cell
   is a lower level, not an alarm. --color-heat (ink by default) follows any theme and both palettes. */
.report-heat{--heat-mix:0%;background:color-mix(in oklab,var(--color-heat) var(--heat-mix),var(--color-background));-webkit-print-color-adjust:exact;print-color-adjust:exact}
.report-heat[data-heat="0"]{background:var(--color-background);box-shadow:inset 0 0 0 1px var(--color-border)}
.report-heat[data-heat="1"]{--heat-mix:7%}
.report-heat[data-heat="2"]{--heat-mix:16%}
.report-heat[data-heat="3"]{--heat-mix:30%}
.report-heat[data-heat="4"]{--heat-mix:58%;color:var(--color-background)}
.report-heat[data-heat="5"]{--heat-mix:84%;color:var(--color-background)}
.report-heat[data-heat="none"]{color:var(--color-muted);background:repeating-linear-gradient(45deg,color-mix(in oklab,var(--color-border) 80%,transparent) 0 1px,transparent 1px 6px),var(--color-background)}
.report-heat-level{font-family:var(--font-display);font-weight:700;font-size:1.15rem;line-height:1}
.report-heat-level small{font-size:.6em;opacity:.8}
/* Against the role: green when the level meets it, darker the further above; red below it, darker the bigger the gap. */
.report-heat[data-status]{--tone:var(--color-above);--tone-mix:20%;color:var(--color-text);background:color-mix(in oklab,var(--tone) var(--tone-mix),var(--color-background))}
.report-heat[data-status="below"]{--tone:var(--color-below)}
.report-heat[data-status][data-step="2"]{--tone-mix:44%}
.report-heat[data-status][data-step="3"]{--tone-mix:72%;color:var(--color-background)}
.report-heat-mark{font-family:var(--font-display);font-size:.68rem;font-weight:800;line-height:1;opacity:.85}
.report-above{color:inherit;font-family:var(--font-display);font-weight:800;font-size:.7em;margin-left:.05em}

/* Legend */
.report-legend{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1.5rem;margin:0 0 1rem;padding:0;list-style:none;font-size:.82rem;color:var(--color-muted)}
.report-legend li{display:inline-flex;align-items:center;gap:.45rem}
.report-legend i.report-heat{display:inline-block;width:1.1rem;height:1.1rem}
.report-legend-steps{display:inline-flex}
.report-legend-steps i.report-heat{width:1.4rem;height:.8rem}
.report-legend-steps--role i.report-heat{display:inline-grid;place-items:center;width:1.9rem;height:1.25rem;font-style:normal;font-family:var(--font-display);font-weight:800;font-size:.66rem}
.report-legend-ends{font-family:var(--font-display);font-weight:700}
.report-legend-ends span{font-weight:800}
.report-legend .report-above{color:var(--color-text);font-size:1rem}

/* Heat map of the team */
.report-scroll{overflow-x:auto;scrollbar-width:thin}
.report-heatmap{border-collapse:separate;border-spacing:3px}
.report-heatmap th,.report-heatmap td{padding:0;text-align:left;vertical-align:middle}
.report-heatmap thead th{vertical-align:bottom;padding:0 .5rem .6rem 0;font-size:.66rem;letter-spacing:.12em}
.report-heatmap .report-category{width:3.4rem;min-width:3.4rem;padding:0 0 .6rem;text-align:left}
.report-category span{display:block;writing-mode:vertical-rl;transform:rotate(180deg);max-height:11rem;margin:0 auto;line-height:1.25;letter-spacing:.08em;text-transform:none;font-size:.8rem;font-weight:500;color:var(--color-text)}
.report-heatmap td.report-heat{position:relative;width:3.4rem;height:3.4rem;text-align:center}
.report-heatmap .report-heat-mark{position:absolute;top:4px;right:5px;font-size:.62rem}
.report-heatmap tbody tr{animation:rise .5s var(--ease) both;animation-delay:calc(.25s + var(--row,0) * 60ms)}
.report-heatmap .report-person-cell{position:sticky;left:0;z-index:1;min-width:10rem;max-width:14rem;padding:.35rem 1rem .35rem 0;background:var(--color-background)}
.report-person-cell a,.report-heatmap tfoot .report-person-cell{display:block;font-family:var(--font-display);font-weight:700;font-size:1.02rem;line-height:1.25;text-decoration:none}
.report-person-cell small{display:block;margin-top:.15rem;font-family:var(--font-family);font-weight:500;font-size:.72rem;color:var(--color-muted);letter-spacing:.02em}
.report-heatmap .report-col-overall,.report-heatmap .report-col-gap{padding-left:1.25rem}
.report-heatmap tbody td:not(.report-heat),.report-heatmap tfoot td:not(.report-heat){padding:.35rem 0 .35rem 1.25rem;min-width:11rem}
.report-heatmap tfoot th,.report-heatmap tfoot td{padding-top:.75rem}
.report-heatmap tfoot .report-person-cell{font-size:.9rem}
.report-average .report-heat-level{font-size:.92rem}

/* Overall and gap */
.report-overall{display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:.6rem;row-gap:.2rem}
.report-overall .report-figure{font-size:1.5rem;line-height:1}
.report-overall .report-meter,.report-overall .report-covers{grid-column:1/-1}
.report-meter{display:block;height:3px;background:color-mix(in oklab,var(--color-surface) 80%,transparent);max-width:9rem}
.report-meter span{display:block;height:100%;width:var(--value);background:var(--color-text)}
.report-spark{display:block;overflow:visible}
.report-spark polyline{fill:none;stroke:var(--color-text);stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}
.report-spark circle{fill:var(--color-text)}
.report-spark-base{stroke:var(--color-grid);stroke-dasharray:2 3}
.report-gap{display:grid;gap:.05rem;font-size:.86rem;line-height:1.35}
.report-gap .report-figure{font-size:1.05rem}
.report-gap[data-status="met"]>span:first-child::after{content:" ✓";color:var(--color-compare);font-weight:700}

/* Each Person */
.report-person{padding:clamp(1.5rem,3vw,2.25rem) 0;border-top:1px solid var(--color-border);animation:rise .6s var(--ease) both;animation-delay:calc(.3s + var(--row,0) * 70ms)}
.report-person>summary{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:1rem 1.25rem;padding-right:2rem;cursor:pointer;list-style:none}
.report-person>summary::-webkit-details-marker{display:none}
.report-person>summary::after{content:"";position:absolute;top:1.1rem;right:.4rem;width:.55rem;height:.55rem;border-right:1.5px solid var(--color-muted);border-bottom:1.5px solid var(--color-muted);transform:rotate(45deg) translateY(-.2rem);transition:transform .25s var(--ease)}
.report-person:not([open])>summary::after{transform:rotate(-45deg)}
.report-person>summary:hover h3{color:var(--color-primary)}
.report-seal{flex:none;display:grid;place-items:center;width:3.4rem;aspect-ratio:1;font-family:var(--font-display);font-size:1.2rem;font-weight:800;letter-spacing:-.04em;line-height:1;color:var(--color-primary);border:2px solid currentColor;border-radius:6px;box-shadow:inset 0 0 0 2.5px var(--color-background),inset 0 0 0 3.6px currentColor;transform:rotate(-5deg);mix-blend-mode:var(--seal-blend)}
.report-person-heading{flex:1;min-width:12rem}
.report-person-heading h3{font-size:clamp(1.35rem,2.6vw,1.75rem);transition:color .2s}
.report-person-heading small{display:block;margin-top:.2rem;color:var(--color-muted);font-size:.82rem}
.report-stats{display:flex;gap:clamp(1rem,3vw,2rem);margin:0}
.report-stats div{min-width:0}
.report-stats dd{margin:.1rem 0 0;font-size:2rem;line-height:1}
.report-person-body{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:clamp(1.5rem,3vw,2.5rem);align-items:start;margin-top:1.5rem}

/* Table of a Person */
.report-table{border-collapse:separate;border-spacing:0 3px;width:100%}
.report-table caption{text-align:left;color:var(--color-muted);font-size:.82rem;padding-bottom:.35rem;caption-side:top}
.report-table th,.report-table td{padding:.45rem .7rem;text-align:left;vertical-align:middle}
.report-table thead th{padding-bottom:.3rem;white-space:nowrap}
.report-table tbody th{min-width:10rem;font-weight:500;padding-left:0;font-size:.92rem;line-height:1.3}
.report-table td.report-heat{text-align:center;min-width:5.5rem;border-left:3px solid var(--color-background)}
.report-table td.report-heat .report-heat-level{font-size:1.05rem}
.report-table td.report-heat .report-heat-mark{margin-left:.4rem;vertical-align:.2em;font-size:.62rem}
.report-table .report-num{text-align:center}
.report-table tfoot th,.report-table tfoot td{vertical-align:top;border-top:1px solid color-mix(in oklab,var(--color-border) 60%,transparent);padding-top:.75rem}
.report-table tfoot th{font-size:.82rem;font-weight:700;padding-left:0}
.report-table tfoot td{min-width:8rem}
.report-table tfoot .report-gap{font-size:.8rem}
.report-table tfoot .report-overall .report-figure{font-size:1.2rem}
.report-change{font-family:var(--font-display);font-weight:700;font-size:1rem}
.report-change[data-direction="same"]{color:var(--color-muted)}
.report-radar .radar-series{animation:none}
/* Red is the gap in the Report: the radar compares two dates of the Person, the last in ink, the first muted. */
.report-radar .radar-series--person,.report-radar .radar-hatch.radar-series--person,.report-radar .radar-legend-item.radar-series--person{--series-color:var(--color-text)}
.report-radar .radar-series--compare,.report-radar .radar-hatch.radar-series--compare,.report-radar .radar-legend-item.radar-series--compare{--series-color:var(--color-muted)}
.report-radar .report-note{text-align:center;margin:0 auto}
.radar-legend{display:flex;justify-content:center;flex-wrap:wrap;gap:.4rem 1.25rem;margin-top:.5rem;font-size:.8rem}
.radar-legend-item{display:inline-flex;align-items:center;gap:.45rem;font-family:var(--font-display);font-weight:700}
.radar-legend-item::before{content:"";width:1.4rem;height:.6rem;background:color-mix(in oklab,var(--series-color) 20%,transparent);border:2px solid var(--series-color)}
.radar-legend-item.radar-series--compare::before{border-style:dashed;background:repeating-linear-gradient(45deg,color-mix(in oklab,var(--series-color) 55%,transparent) 0 1px,transparent 1px 5px)}

/* Problems and footer */
.report-problems ul{margin:1rem 0 0;padding:.9rem 1.2rem;list-style:none;border-left:3px solid var(--color-primary);background:color-mix(in oklab,var(--color-surface) 45%,transparent)}
.report-problems li+li{margin-top:.35rem}
.report-problems code{font-size:.85em;color:var(--color-muted)}
.report-footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem 2rem;margin:clamp(3rem,6vw,4.5rem) var(--bleed) 0;padding:1.25rem 0 2.5rem;border-top:1px solid var(--color-border);font-size:.82rem;color:var(--color-muted)}
.report-footer p{margin:0}
.report-footer-title{font-family:var(--font-display);font-weight:700;color:var(--color-text)}
.report-footer-title::before{content:"";display:inline-block;width:.45rem;height:.45rem;margin-right:.6rem;background:var(--color-primary);transform:translateY(-.1em) rotate(45deg)}

@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (max-width:899px){.report-person-body{grid-template-columns:minmax(0,1fr)}.report-stats{width:100%}.report-heatmap .report-person-cell{min-width:8rem}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none !important;transition:none !important}}
@media print{
  .report-masthead{background:none;padding-top:0}
  .report-section,.report-person,.report-heatmap tbody tr{animation:none}
  .report-person{break-inside:avoid}
  .report-person>summary::after{display:none}
  .report-scroll{overflow:visible}
  .report-heatmap .report-person-cell{position:static}
  .report-seal{mix-blend-mode:normal}
}
`;

/** The whole page. */
export function renderReport(report: Report, options: RenderOptions): string {
  const body = renderToStaticMarkup(<ReportBody report={report} heading={options.heading ?? options.title} />);
  // The CSS is text in a <style> element, which ends at the first `</style`: a `<` can only be in a string or a
  // comment of the CSS, so it is written as the CSS escape for it.
  const css = `${options.css}\n${REPORT_CSS}`.replace(/</g, "\\3c ");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeText(options.title)}</title>`,
    `<style>${css}</style>`,
    "</head>",
    `<body>${body}</body>`,
    "</html>",
    "",
  ].join("\n");
}
