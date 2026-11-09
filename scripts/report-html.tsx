// Renders a Report as one self-contained HTML page: CSS inline, no script. Rendered with React on the server, so every
// value read from a snapshot is escaped by construction. See docs/adr/0007.
import { renderToStaticMarkup } from "react-dom/server";
import RadarChart from "../src/components/RadarChart.tsx";
import type { Cell, Entry, PersonHistory, Report } from "./report.ts";

/** Blocks every request: the page works offline and cannot send what it holds anywhere. */
export const CONTENT_SECURITY_POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

export interface RenderOptions {
  /** The title of the page. */
  title: string;
  /** The CSS that comes before the Report's own: the app's custom properties and the resolved theme. */
  css: string;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
/** "3 categories", "1 category". */
const categories = (count: number) => `${count} ${count === 1 ? "category" : "categories"}`;
const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function Level({ cell }: { cell: Cell }) {
  if (cell.level === undefined) return <span className="report-not-recorded">not recorded</span>;
  if (cell.above) {
    return (
      <span className="report-above">
        {cell.level} <small>(above the highest level)</small>
      </span>
    );
  }
  return <>{cell.level}</>;
}

function Overall({ entry }: { entry: Entry }) {
  const covers = `${entry.recorded} of ${categories(entry.total)}`;
  return (
    <>
      {entry.overall === undefined ? "–" : `${entry.overall}%`} <small>{covers}</small>
    </>
  );
}

function Gap({ entry }: { entry: Entry }) {
  if (!entry.gap) return <small>no role to compare</small>;
  const { met, total, levelsToGo, role } = entry.gap;
  return (
    <>
      On target in {met} of {categories(total)}
      {" · "}
      {plural(levelsToGo, "level")} to go{" "}
      <small>
        {role}, covers {entry.recorded} of {categories(entry.total)}
      </small>
    </>
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

function TeamOverview({ report }: { report: Report }) {
  const gapTitle = report.compare ? `Role gap against ${report.compare}` : "Role gap";
  return (
    <section aria-labelledby="team-overview">
      <h2 id="team-overview">Team overview</h2>
      <p className="report-note">Each Person at their latest row in any Snapshot.</p>
      <div className="report-scroll">
        <table className="report-table">
          <caption className="visually-hidden">Reached level of each Category, for every Person at their latest row</caption>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Snapshot</th>
              {report.categories.map((category) => (
                <th scope="col" key={category.key}>
                  {category.name}
                </th>
              ))}
              <th scope="col">Overall progress</th>
              <th scope="col">{gapTitle}</th>
            </tr>
          </thead>
          <tbody>
            {report.team.map((member) => (
              <tr key={member.id}>
                <th scope="row">{member.name}</th>
                <td>{member.snapshot}</td>
                {member.entry.cells.map((cell) => (
                  <td key={cell.key}>
                    <Level cell={cell} />
                  </td>
                ))}
                <td>
                  <Overall entry={member.entry} />
                </td>
                <td>
                  <Gap entry={member.entry} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportBody({ report, title }: { report: Report; title: string }) {
  return (
    <main className="report">
      <header className="report-header">
        <h1>{title}</h1>
        <p>
          {plural(report.persons.length, "Person")} · generated on {report.generatedOn}
        </p>
      </header>
      <TeamOverview report={report} />
      <section aria-labelledby="evolution">
        <h2 id="evolution">Evolution of each Person</h2>
        {report.persons.map((person) => (
          <details open key={person.id} className="report-person">
            <summary>
              <h3>{person.name}</h3> <small>{person.id}</small>
            </summary>
            <div className="report-person-body">
              <table className="report-table">
                <caption>Reached level of each Category by Snapshot, with the Overall progress and the Role gap of each row</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    {person.entries.map((entry) => (
                      <th scope="col" key={entry.snapshot}>
                        {entry.snapshot}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.categories.map((category, index) => (
                    <tr key={category.key}>
                      <th scope="row">{category.name}</th>
                      {person.entries.map((entry) => (
                        <td key={entry.snapshot}>
                          <Level cell={entry.cells[index]} />
                        </td>
                      ))}
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
                  </tr>
                  <tr>
                    <th scope="row">{report.compare ? `Role gap against ${report.compare}` : "Role gap"}</th>
                    {person.entries.map((entry) => (
                      <td key={entry.snapshot}>
                        <Gap entry={entry} />
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
              <Radar person={person} report={report} />
            </div>
          </details>
        ))}
      </section>
      {report.problems.length > 0 && (
        <section aria-labelledby="report-problems">
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
  );
}

const REPORT_CSS = `
.report{max-width:var(--max-width);margin:0 auto;padding:2rem 1.5rem 4rem}
.report h1,.report h2,.report h3{font-family:var(--font-display);font-weight:600;margin:0}
.report h1{font-size:2rem}
.report h2{font-size:1.4rem;margin:2.5rem 0 .75rem;border-bottom:1px solid var(--color-border);padding-bottom:.4rem}
.report h3{display:inline;font-size:1.15rem}
.report small{color:var(--color-muted)}
.report-header p{margin:.25rem 0 0;color:var(--color-muted)}
.report-person{border:1px solid var(--color-border);border-radius:var(--radius);margin:1rem 0;padding:.75rem 1rem;overflow-x:auto}
.report-person>summary{cursor:pointer}
.report-person-body{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:2rem;align-items:start}
.report-note{font-size:.85rem;color:var(--color-muted);margin:.5rem 0 0}
.report-radar .radar-series{animation:none}
@media (max-width:800px){.report-person-body{grid-template-columns:minmax(0,1fr)}}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.report-scroll{overflow-x:auto}
.report-table{border-collapse:collapse;width:100%;margin-top:1rem;font-variant-numeric:tabular-nums}
.report-table caption{text-align:left;color:var(--color-muted);font-size:.85rem;padding-bottom:.4rem}
.report-table th,.report-table td{border-bottom:1px solid var(--color-border);padding:.4rem .75rem;text-align:left;vertical-align:top}
.report-table thead th{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--color-muted)}
.report-table tfoot th,.report-table tfoot td{background:var(--color-band);border-bottom:0}
.report-not-recorded{color:var(--color-muted);font-style:italic}
.report-above{color:var(--color-primary);font-weight:600}
@media print{body{background:none}.report-person{break-inside:avoid}}
`;

/** The whole page. */
export function renderReport(report: Report, options: RenderOptions): string {
  const body = renderToStaticMarkup(<ReportBody report={report} title={options.title} />);
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
