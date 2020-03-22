import {roleRepositoryInstance} from "../repository/RoleRepository";
import { SELECT_COMPARATION_ROLE } from "../actions/all";

export function compareTo(state="", action) {
    switch(action.type) {
        case SELECT_COMPARATION_ROLE:
            return roleRepositoryInstance.getRoleByKey(action.roleKey);
        default:
            return state;
    }
}