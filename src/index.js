import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import CategoryService from './domain/service/CategoryService';
import App from './views/App';
import * as serviceWorker from './serviceWorker';
import UpdateLevelsReducer from './reducers/all';
import StateValidatorFactory from './state/StateValidatorFactory';
import StateParser from './state/StateParser';
import ParseError from './views/ParseError';
import {categoryRepositoryInstance} from './repository/CategoryRepository';
import {roleRepositoryInstance} from './repository/RoleRepository';
import { INVALID_INPUT_STATE } from './state/StateErrors';
import { stateSettedUp } from './actions/all';
import {NO_ROLES_EXCEPTION, ExampleService } from "./domain/service/ExampleService";

const categoryService = new CategoryService(categoryRepositoryInstance);
const exampleService = new ExampleService(roleRepositoryInstance);
const stateValidatorFactory = new StateValidatorFactory(categoryService.getCategories());
const stateParser = new StateParser(stateValidatorFactory.create(), categoryService, roleRepositoryInstance);

try {

    const status = exampleService.getExample();
    if(!window.location.search)
        window.location.href = stateParser.toUrl(status);

    const state = stateParser.fromUrl(window.location);
    const store = createStore(UpdateLevelsReducer, state);
    store.dispatch(stateSettedUp(state));

    ReactDOM.render(<Provider store={store}><App 
        status={state}
        categories={categoryService.getCategories()} 
        roles={roleRepositoryInstance.getRoles()}
        /></Provider>, document.getElementById('root'));

    // If you want your app to work offline and load faster, you can change
    // unregister() to register() below. Note this comes with some pitfalls.
    // Learn more about service workers: https://bit.ly/CRA-PWA
    serviceWorker.unregister();

} catch(err) {

    switch (err) {
        case INVALID_INPUT_STATE:
            ReactDOM.render(<ParseError schema={JSON.stringify(stateValidatorFactory.createSchema(), null, 1)}/>, document.getElementById('root'));
            break;

        case NO_ROLES_EXCEPTION:
            alert(NO_ROLES_EXCEPTION);
            break;

        default:
            alert("unexpected error");
            console.log(err);
    }

}
