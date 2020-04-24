export default class Category {
  constructor(key, name, kpis) {
    this.key = key;
    this.name = name;
    this.KPIs = kpis;
  }

  getKey = () => this.key;

  getLevels = () =>
    this.KPIs.map(kpi => kpi.level).reduce(
      (levels, current) =>
        levels.includes(current) ? levels : [...levels, current],
      []
    );

  getKpisByLevel = level => this.KPIs.filter(kpi => kpi.level === level);
}
