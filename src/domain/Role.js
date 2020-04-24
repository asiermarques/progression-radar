export default class Role {
  constructor(key, name, levels) {
    this.key = key;
    this.name = name;
    this.levels = levels;
  }

  getKey = () => this.key;

  getName = () => this.name;

  getLevels = () => this.levels;
}
