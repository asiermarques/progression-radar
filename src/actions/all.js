export const SELECT_CATEGORY_LEVEL = "SELECT_CATEGORY_LEVEL";
export const SELECT_COMPARATION_ROLE = "SELECT_COMPARATION_ROLE";
export const UPDATE_NAME = "UPDATE_NAME";
export const STATE_SETTED_UP = "STATE_SETTED_UP";

export function selectCategoryLevel(category, level) {
  return { type: SELECT_CATEGORY_LEVEL, category, level };
}

export function selectComparationRole(roleKey) {
  return { type: SELECT_COMPARATION_ROLE, roleKey };
}

export function updateName(state) {
  return { type: UPDATE_NAME, state };
}

export function stateSettedUp(state) {
  return { type: STATE_SETTED_UP, state };
}
