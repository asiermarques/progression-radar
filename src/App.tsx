import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import CategoryPanel from "./components/CategoryPanel";
import PersonPanel from "./components/PersonPanel";
import RadarChart, { type RadarSeries } from "./components/RadarChart";
import { findRole, percentage, type Config, type Person } from "./model";
import { toSearch } from "./urlState";

interface Props {
  config: Config;
  initialPerson: Person;
}

export default function App({ config, initialPerson }: Props) {
  const { site, categories, roles } = config;
  const [person, setPerson] = useState(initialPerson);

  // Keep the URL in sync so it can always be bookmarked or shared.
  useEffect(() => {
    window.history.replaceState(null, "", toSearch(person));
  }, [person]);

  const role = findRole(roles, person.roleKey);
  const compareTo = findRole(roles, person.compareTo);

  const series: RadarSeries[] = [
    {
      name: person.name || "You",
      className: "radar-series--person",
      values: categories.map((c) => percentage(c, person.levels[c.key] ?? 0)),
    },
  ];
  if (compareTo) {
    series.push({
      name: compareTo.name,
      className: "radar-series--compare",
      values: categories.map((c) => percentage(c, compareTo.levels[c.key] ?? 0)),
    });
  }

  return (
    <div className="app">
      <div className="overview">
        <div>
          <Header site={site} />
          <PersonPanel
            person={person}
            role={role}
            roles={roles}
            onNameChange={(name) => setPerson((p) => ({ ...p, name }))}
            onCompareToChange={(key) => setPerson((p) => ({ ...p, compareTo: key }))}
          />
        </div>
        <RadarChart axes={categories.map((c) => c.name)} series={series} />
      </div>

      <CategoryPanel
        categories={categories}
        levels={person.levels}
        compareTo={compareTo}
        onLevelChange={(key, level) => setPerson((p) => ({ ...p, levels: { ...p.levels, [key]: level } }))}
      />

      <Footer site={site} />
    </div>
  );
}

export function Header({ site }: { site: Config["site"] }) {
  return (
    <header className="app-header">
      {site.logo && <img className="app-logo" src={site.logo} alt="" />}
      <h1 className="app-title">{site.title}</h1>
    </header>
  );
}

export function Footer({ site }: { site: Config["site"] }) {
  if (!site.footer) return null;
  return (
    <footer className="app-footer">
      <Markdown>{site.footer}</Markdown>
    </footer>
  );
}
