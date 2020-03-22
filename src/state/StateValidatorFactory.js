import jsonSchemaValidator from 'ajv';


export default class {

    constructor(categories = []) {
        this.categories = categories;
        this.validatorCreator = new jsonSchemaValidator();
    }

    create = () => this.validatorCreator.compile(this.createSchema());

    createSchema = () => {
        return {
            "type": "object",
            "properties": {
                "name": { "type": "string" },
                "levels": { 
                    "type": "object",
                    "properties": this.categories.reduce((result, category) => Object.assign(result, {[category.getKey()]: {"type": "number"}}), {}),
                    "required": this.categories.map(category => category.key)
                },
                "roleKey": { "type": "string" },
                "tags": { "type": "array" },
                "compareTo": { "type": "string" }
            },
            "required": ["name", "roleKey", "levels", "tags"]
        }
    };

}