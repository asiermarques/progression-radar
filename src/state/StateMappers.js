import queryStringParser from "query-string";
import { INVALID_INPUT_STATE } from "./StateErrors";

const URL_PARAM = "state";

export const queryParamaDataToUrl = params =>
  "/?" + URL_PARAM + (params ? "=" + JSON.stringify(params) : "");

export const extractQueryStringData = queryString => {
  if (!queryString) return null;

  const data = queryStringParser.parse(queryString);
  return JSON.parse(data[URL_PARAM]);
};

export const processQueryString = (queryString, validator, roleRepository) => {
  const data = extractQueryStringData(queryString);
  if (!validator.validate(data)) throw INVALID_INPUT_STATE;

  return Object.assign({}, data, {
    personLevels: [],
    compareToLevels: [],
    compareTo: data["compareTo"]
      ? roleRepository.getRoleByKey(data["compareTo"])
      : null
  });
};

export const stateToQueryParamData = state => {
  return {
    name: state.name,
    levels: state.levels,
    roleKey: state.roleKey,
    tags: state.tags,
    compareTo: state.compareTo?.key
  };
};
