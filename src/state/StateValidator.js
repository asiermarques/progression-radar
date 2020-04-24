import jsonSchemaValidator from "ajv";

export default class {
  constructor(categories = []) {
    this.categories = categories;
    this.validator = new jsonSchemaValidator().compile(this.createSchema());
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
