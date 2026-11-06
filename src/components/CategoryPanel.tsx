import { useState } from "react";
import Markdown from "react-markdown";
import { kpisAt, levelsOf, percentage, type Category, type Levels, type Role } from "../model";

interface Props {
  categories: Category[];
  levels: Levels;
  compareTo?: Role;
  onLevelChange: (categoryKey: string, level: number) => void;
}

export default function CategoryPanel({ categories, levels, compareTo, onLevelChange }: Props) {
  const [selectedKey, setSelectedKey] = useState(categories[0]?.key);
  const category = categories.find((c) => c.key === selectedKey) ?? categories[0];
  if (!category) return null;

  const level = levels[category.key] ?? 0;
  const targetLevel = compareTo?.levels[category.key];
  const kpis = kpisAt(category, level);

  return (
    <section className="category-panel">
      <nav className="category-nav" aria-label="Categories">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            className={c.key === category.key ? "active" : undefined}
            aria-current={c.key === category.key ? "true" : undefined}
            onClick={() => setSelectedKey(c.key)}
          >
            {c.name}
          </button>
        ))}
      </nav>

      <div className="category-detail">
        <h2 className="category-name">{category.name}</h2>
        {category.description && <p className="category-description">{category.description}</p>}

        <div className="level-nav" role="group" aria-label="Level">
          {levelsOf(category).map((l) => (
            <button
              key={l}
              type="button"
              className={[l <= level ? "reached" : "", l === targetLevel ? "target" : ""].join(" ").trim() || undefined}
              aria-pressed={l === level}
              title={l === targetLevel ? `Level required by ${compareTo?.name}` : undefined}
              onClick={() => onLevelChange(category.key, l)}
            >
              Level {l}
            </button>
          ))}
        </div>

        <div
          className="progress"
          role="progressbar"
          aria-valuenow={percentage(category, level)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-bar" style={{ width: `${percentage(category, level)}%` }} />
        </div>

        {kpis.length === 0 && <p className="kpi-empty">Select a level to see what is expected to reach it.</p>}
        {kpis.map((kpi, index) => (
          <article className="kpi" key={index}>
            <h3 className="kpi-summary">{kpi.summary}</h3>
            <div className="kpi-description">
              <Markdown>{kpi.description}</Markdown>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
