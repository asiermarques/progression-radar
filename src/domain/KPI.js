export default class KPI {
  constructor(summary, description, level, tags) {
    this.summary = summary;
    this.description = description;
    this.level = level;
    this.tags = tags;
  }

  valueOf = () => this.summary;
}
