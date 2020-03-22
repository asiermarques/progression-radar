import {roleRepositoryInstance} from "../repository/RoleRepository";
import { SELECT_CATEGORY_LEVEL, STATE_SETTED_UP, SELECT_COMPARATION_ROLE } from "../actions/all";
import CategoryService from "../domain/service/CategoryService";
import {categoryRepositoryInstance} from "../repository/CategoryRepository";

const categoryService = new CategoryService(categoryRepositoryInstance);

export function personLevels(state=[], action) {
    switch(action.type) {
        case STATE_SETTED_UP:
            return categoryService.categoriesWithLevels(action.state.levels);
        case SELECT_CATEGORY_LEVEL:
            return state.map(categoryLevel => 
                               categoryLevel.category.key === action.category.key ? 
                                  categoryService.createCategoryLevel(categoryLevel.category, action.level) : 
                                  categoryLevel);
        default:
            return state;
    }
}

export function compareToLevels(state=[], action) {
    switch(action.type) {
        case STATE_SETTED_UP:
            return action.state.compareTo ? categoryService.categoriesWithLevels(action.state.compareTo) : state;
        case SELECT_COMPARATION_ROLE:
            const role = roleRepositoryInstance.getRoleByKey(action.roleKey);
            return role ? categoryService.categoriesWithLevels(role.levels) : [];
        default:
            return state;
    }
}