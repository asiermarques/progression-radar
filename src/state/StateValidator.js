import Ajv from "ajv";

export default class StateValidator {
  constructor(categories = []) {
    this.categories = categories;
    this.validator = new Ajv().compile(this.createSchema());
  }

  validate = data => this.validator(data);

  createSchema = () => {
    return {
      type: "object",
      properties: {
        name: { type: "string" },
        levels: {
          type: "object",
          properties: this.categories.reduce(
            (result, category) =>
              Object.assign(result, {
                [category.getKey()]: { type: "number" }
              }),
            {}
          ),
          required: this.categories.map(category => category.key)
        },
        roleKey: { type: "string" },
        tags: { type: "array" },
        compareTo: { type: "string" }
      },
      required: ["name", "roleKey", "levels", "tags"]
    };
  };
}
