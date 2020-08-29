import {SELECT_CATEGORY_LEVEL, UPDATE_NAME} from "../actions/all";

export function name(state = "", action) {
  switch (action.type) {
    case UPDATE_NAME:
      return action.state;
    default:
      return state;
  }
}

export function levels(state = {}, action) {
  switch (action.type) {
    case SELECT_CATEGORY_LEVEL:
      return state[action.category.key] || state[action.category.key] === 0
        ? Object.assign({}, state, { [action.category.key]: action.level })
        : state;
    default:
      return state;
  }
}

export function roleKey(state = "", action) {
  return state;
}

export function tags(state = "", action) {
  return state;
}

export { compareToContainer } from "./compareToReducer";
export { personLevelsContainer } from "./categoryLevelsReducers";
export { compareToLevelsContainer } from "./categoryLevelsReducers";
