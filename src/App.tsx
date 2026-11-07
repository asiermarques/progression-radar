import { useEffect, useRef, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import CategoryPanel from "./components/CategoryPanel";
import PersonPanel from "./components/PersonPanel";
import ProgressSummary from "./components/ProgressSummary";
import RadarChart, { type RadarSeries } from "./components/RadarChart";
import LinkNotice from "./components/LinkNotice";
import ShareButton from "./components/ShareButton";
import { findRole, maxLevel, percentage, requiredLevel, type Config, type Person } from "./model";
import { noticeFor, parseState, saveUrl, toUrl } from "./urlState";

interface Props {
  config: Config;
  initialPerson: Person;
  /** What to tell the person about the link they opened, if anything. */
  initialNotice?: string | null;
  /** No link was opened, so the address bar does not hold `initialPerson` yet: write it on load. */
  writeOnLoad?: boolean;
}

/** The address bar is written this long after the last change, so typing does not hammer the history API. */
const URL_WRITE_DELAY = 250;

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export default function App({ config, initialPerson, initialNotice = null, writeOnLoad = false }: Props) {
  const { site, categories, roles } = config;
  const [person, setPerson] = useState(initialPerson);
  const [selectedKey, setSelectedKey] = useState(categories[0]?.key);
  const categoriesRef = useRef<HTMLDivElement>(null);

  const [notice, setNotice] = useState(initialNotice);

  // Keep the address bar in sync, debounced and not on load, so it can be bookmarked or shared.
  useEffect(() => {
    if (person === initialPerson && !writeOnLoad) return;
    const write = () => saveUrl(person, config);
    const timeout = window.setTimeout(write, URL_WRITE_DELAY);
    const flush = () => {
      window.clearTimeout(timeout);
      write();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pagehide", flush);
    };
  }, [person, initialPerson, writeOnLoad, config]);

  // The link can be edited by hand in the address bar; the app's own writes (replaceState) do not fire this.
  useEffect(() => {
    function readFragment() {
      const state = parseState(window.location, config);
      if (state.kind === "ok") setPerson(state.person);
      setNotice(noticeFor(state, "it was ignored"));
    }
    window.addEventListener("hashchange", readFragment);
    return () => window.removeEventListener("hashchange", readFragment);
  }, [config]);

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
        <ShareButton link={toUrl(person, config, window.location.href)} />
      </Header>
      {notice && <LinkNotice message={notice} onDismiss={() => setNotice(null)} />}

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
      <p className="app-footer-title">{site.title}</p>
      <div className="app-footer-text">
        <Markdown>{site.footer}</Markdown>
      </div>
    </footer>
  );
}
