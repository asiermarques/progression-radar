import { combineReducers } from 'redux';
import {SELECT_CATEGORY_LEVEL} from '../actions/all'
import {compareTo} from './compareToReducer';
import {personLevels, compareToLevels} from './categoryLevelsReducers'

function name(state="", action) {
    return state;
}

function levels(state={}, action) {
    switch(action.type) {
        case SELECT_CATEGORY_LEVEL:
            return state[action.category.key] ? 
                     Object.assign({}, state, {[action.category.key]: action.level }) : state;
        default:
            return state;
    }
}

function roleKey(state="", action) {
    return state;
}

function tags(state="", action) {
    return state;
}

export default combineReducers({
    name,
    levels,
    roleKey,
    tags,
    compareTo,
    personLevels,
    compareToLevels
})