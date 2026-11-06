import { useEffect, useRef, type CSSProperties } from "react";
import Markdown from "react-markdown";
import { kpisAt, levelsOf, maxLevel, percentage, requiredLevel, type Category, type Levels, type Role } from "../model";

interface Props {
  categories: Category[];
  levels: Levels;
  compareTo?: Role;
  selectedKey: string | undefined;
  onSelect: (categoryKey: string) => void;
  onLevelChange: (categoryKey: string, level: number) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function CategoryPanel({ categories, levels, compareTo, selectedKey, onSelect, onLevelChange }: Props) {
  const index = Math.max(
    0,
    categories.findIndex((c) => c.key === selectedKey),
  );
  const category = categories[index];
  const navRef = useRef<HTMLElement>(null);

  // When the nav scrolls sideways (small screens), bring the selected category into view without moving the page.
  useEffect(() => {
    const nav = navRef.current;
    const button = nav?.querySelector<HTMLElement>("[aria-current]");
    if (!nav || !button || nav.scrollWidth <= nav.clientWidth) return;
    const left = nav.scrollLeft + button.getBoundingClientRect().left - nav.getBoundingClientRect().left;
    nav.scrollTo?.({ left: left - 16, behavior: "smooth" });
  }, [category?.key]);

  if (!category) return null;

  const level = levels[category.key] ?? 0;
  const max = maxLevel(category);
  const target = compareTo && requiredLevel(compareTo, category);
  const kpis = kpisAt(category, level);

  return (
    <section className="category-panel">
      <div className="category-sidebar">
        <p className="section-label">Areas</p>
        <nav className="category-nav" aria-label="Categories" ref={navRef}>
          {categories.map((c, i) => {
            const reached = levels[c.key] ?? 0;
            const required = compareTo && requiredLevel(compareTo, c);
            const active = c.key === category.key;
            return (
              <button
                key={c.key}
                type="button"
                className={active ? "active" : undefined}
                aria-current={active ? "true" : undefined}
                data-status={required === undefined ? undefined : reached >= required ? "met" : "below"}
                onClick={() => onSelect(c.key)}
              >
                <span className="category-nav-index" aria-hidden="true">
                  {pad(i + 1)}
                </span>
                <span className="category-nav-name">{c.name}</span>
                <span className="category-nav-level">
                  <span className="visually-hidden">level </span>
                  {reached}
                  <span className="category-nav-max">/{maxLevel(c)}</span>
                </span>
                <span className="category-nav-meter" aria-hidden="true">
                  <span className="category-nav-meter-fill" style={{ width: `${percentage(c, reached)}%` }} />
                  {required !== undefined && (
                    <span className="category-nav-meter-target" style={{ left: `${percentage(c, required)}%` }} />
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="category-detail" key={category.key}>
        <header className="category-header">
          <p className="category-eyebrow">
            <span className="category-index">{pad(index + 1)}</span>
            <span aria-hidden="true"> / </span>
            <span className="visually-hidden"> of </span>
            {pad(categories.length)}
          </p>
          <h2 className="category-name">{category.name}</h2>
          {category.description && <p className="category-description">{category.description}</p>}
        </header>

        <div
          className="level-nav"
          role="group"
          aria-label="Level"
          style={{ "--level-count": levelsOf(category).length } as CSSProperties}
        >
          {levelsOf(category).map((l) => (
            <button
              key={l}
              type="button"
              className={[l <= level ? "reached" : "", l === target ? "target" : ""].join(" ").trim() || undefined}
              aria-label={`Level ${l}`}
              aria-pressed={l === level}
              title={l === target ? `Level required by ${compareTo?.name}` : undefined}
              onClick={() => onLevelChange(category.key, l)}
            >
              <span className="level-number">{l}</span>
              {l === target && <span className="level-target-label">Target</span>}
            </button>
          ))}
        </div>

        <p className="level-status">
          Level <strong>{level}</strong> of {max}
          {target !== undefined && (
            <>
              {" · "}
              {level >= target ? (
                <span className="level-status-met">meets {compareTo?.name}</span>
              ) : (
                <span className="level-status-below">
                  {target - level} {target - level === 1 ? "level" : "levels"} below {compareTo?.name}
                </span>
              )}
            </>
          )}
        </p>

        <div className="kpi-list">
          {kpis.length === 0 ? (
            <p className="kpi-empty">
              {level === 0
                ? "Level 0 is the starting point. Select a level to see what is expected to reach it."
                : `There are no KPIs defined for level ${level}.`}
            </p>
          ) : (
            <p className="kpi-list-heading">What level {level} looks like</p>
          )}
          {kpis.map((kpi, i) => (
            <article className="kpi" key={`${level}-${i}`} style={{ "--kpi-index": i } as CSSProperties}>
              <span className="kpi-index" aria-hidden="true">
                {level}.{i + 1}
              </span>
              <div className="kpi-body">
                <h3 className="kpi-summary">{kpi.summary}</h3>
                {kpi.description && (
                  <div className="kpi-description">
                    <Markdown>{kpi.description}</Markdown>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
