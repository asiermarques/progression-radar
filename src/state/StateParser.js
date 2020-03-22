import queryStringParser from 'query-string';
import { INVALID_INPUT_STATE } from './StateErrors';



export default class{

    constructor(stateValidator, categoryService, roleRepository) {
        this.validator = stateValidator;
        this.roleRepository = roleRepository;
        this.categoryService = categoryService;
    }

    fromUrl = (location) => this.completeAndHidrate(this.validate(this.parseFromUrl(location.search)));

    toUrl = (params) => "/?state" + (params?"="+JSON.stringify(params):"");

    completeAndHidrate = (params) => Object.assign({}, params, {
      "personLevels": [], 
      "compareToLevels": [],
      "compareTo": params["compareTo"] ? this.roleRepository.getRoleByKey(params["compareTo"]) : null
    });

    parseFromUrl = (queryString) => {
        if(!queryString) return null;

        const data = queryStringParser.parse(queryString);
        return JSON.parse(data.state);
    }

    validate = (parsed) => {
        if(!this.validator(parsed))
            throw INVALID_INPUT_STATE;

        return parsed;
    }
}