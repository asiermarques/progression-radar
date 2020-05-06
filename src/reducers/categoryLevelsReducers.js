import {
  SELECT_CATEGORY_LEVEL,
  STATE_SETTED_UP,
  SELECT_COMPARATION_ROLE
} from "../actions/all";

export function personLevelsContainer(categoryService) {
  return function(state = [], action) {
    switch (action.type) {
      case STATE_SETTED_UP:
        return categoryService.categoriesWithLevels(action.state.levels);
      case SELECT_CATEGORY_LEVEL:
        return state.map(categoryLevel =>
          categoryLevel.category.key === action.category.key
            ? categoryService.createCategoryLevel(
                categoryLevel.category,
                action.level
              )
            : categoryLevel
        );
      default:
        return state;
    }
  };
}

export function compareToLevelsContainer(
  categoryService,
  roleRepositoryInstance
) {
  return function(state = [], action) {
    switch (action.type) {
      case STATE_SETTED_UP:
        return action.state.compareTo
          ? categoryService.categoriesWithLevels(action.state.compareTo.levels)
          : state;
      case SELECT_COMPARATION_ROLE:
        const role = roleRepositoryInstance.getRoleByKey(action.roleKey);
        return role ? categoryService.categoriesWithLevels(role.levels) : [];
      default:
        return state;
    }
  };
}
