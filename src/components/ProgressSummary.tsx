import { overallPercentage, roleGap, type Category, type Levels, type Role } from "../model";

interface Props {
  categories: Category[];
  levels: Levels;
  compareTo?: Role;
}

/** Headline numbers: overall progress and, when comparing, how far the person is from the role. */
export default function ProgressSummary({ categories, levels, compareTo }: Props) {
  const overall = overallPercentage(categories, levels);
  const gap = compareTo && roleGap(categories, levels, compareTo);

  return (
    <dl className="progress-summary">
      <div className="stat stat--overall">
        <dt>Overall</dt>
        <dd>
          <span className="stat-value">{overall}</span>
          <span className="stat-unit">%</span>
        </dd>
      </div>
      {gap && (
        <>
          <div className="stat stat--met">
            <dt>On target</dt>
            <dd>
              <span className="stat-value">{gap.met}</span>
              <span className="stat-unit">/ {gap.total}</span>
            </dd>
          </div>
          <div className="stat stat--to-go">
            <dt>{gap.levelsToGo === 1 ? "Level to go" : "Levels to go"}</dt>
            <dd>
              <span className="stat-value">{gap.levelsToGo}</span>
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}
