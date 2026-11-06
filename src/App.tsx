import { useEffect, useRef, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import CategoryPanel from "./components/CategoryPanel";
import PersonPanel from "./components/PersonPanel";
import ProgressSummary from "./components/ProgressSummary";
import RadarChart, { type RadarSeries } from "./components/RadarChart";
import ShareButton from "./components/ShareButton";
import { findRole, maxLevel, percentage, requiredLevel, type Config, type Person } from "./model";
import { toSearch } from "./urlState";

interface Props {
  config: Config;
  initialPerson: Person;
}

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export default function App({ config, initialPerson }: Props) {
  const { site, categories, roles } = config;
  const [person, setPerson] = useState(initialPerson);
  const [selectedKey, setSelectedKey] = useState(categories[0]?.key);
  const categoriesRef = useRef<HTMLDivElement>(null);

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
      values: categories.map((c) => percentage(c, requiredLevel(compareTo, c))),
    });
  }

  function selectFromChart(axis: number) {
    const category = categories[axis];
    if (!category) return;
    setSelectedKey(category.key);
    categoriesRef.current?.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="app">
      <Header site={site}>
        <p className="app-meta">
          {categories.length} {categories.length === 1 ? "area" : "areas"} · {roles.length}{" "}
          {roles.length === 1 ? "role" : "roles"}
        </p>
        <ShareButton />
      </Header>

      <main>
        <div className="overview">
          <div className="overview-side">
            <PersonPanel
              person={person}
              role={role}
              roles={roles}
              onNameChange={(name) => setPerson((p) => ({ ...p, name }))}
              onCompareToChange={(key) => setPerson((p) => ({ ...p, compareTo: key }))}
            />
            <ProgressSummary categories={categories} levels={person.levels} compareTo={compareTo} />
          </div>
          <RadarChart
            axes={categories.map((c) => c.name)}
            notes={categories.map((c) => `${person.levels[c.key] ?? 0} / ${maxLevel(c)}`)}
            series={series}
            selected={categories.findIndex((c) => c.key === selectedKey)}
            onSelect={selectFromChart}
          />
        </div>

        <div className="categories-anchor" ref={categoriesRef}>
          <CategoryPanel
            categories={categories}
            levels={person.levels}
            compareTo={compareTo}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            onLevelChange={(key, level) => setPerson((p) => ({ ...p, levels: { ...p.levels, [key]: level } }))}
          />
        </div>
      </main>

      <Footer site={site} />
    </div>
  );
}

export function Header({ site, children }: { site: Config["site"]; children?: ReactNode }) {
  return (
    <header className="app-header">
      <div className="app-brand">
        {site.logo && <img className="app-logo" src={site.logo} alt="" />}
        <h1 className="app-title">{site.title}</h1>
      </div>
      {children && <div className="app-header-aside">{children}</div>}
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
