import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import CategoryService from './domain/service/CategoryService';
import App from './views/App';
import * as serviceWorker from './serviceWorker';
import UpdateLevelsReducer from './reducers/all';
import StateValidator from './state/StateValidator';
import ParseError from './views/ParseError';
import { categoryRepositoryInstance } from './repository/CategoryRepository';
import { roleRepositoryInstance} from './repository/RoleRepository';
import { INVALID_INPUT_STATE, NO_INPUT_STATE } from './state/StateErrors';
import { stateSettedUp } from './actions/all';
import { NO_ROLES_EXCEPTION, ExampleService } from "./domain/service/ExampleService";
import { onStateChangeQueryListener } from './state/StateQueryParamListeners';
import { queryParamaDataToUrl, processQueryString } from './state/StateMappers';

const categoryService = new CategoryService(categoryRepositoryInstance);
const exampleService = new ExampleService(roleRepositoryInstance);
const stateValidator = new StateValidator(categoryService.getCategories());

try {

    if(!window.location.search) 
        throw NO_INPUT_STATE;

    const state = processQueryString(window.location.search, stateValidator, roleRepositoryInstance);
    const store = createStore(UpdateLevelsReducer, state);

    store.dispatch(stateSettedUp(state));
    store.subscribe(() => onStateChangeQueryListener(store.getState()));

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

        case NO_INPUT_STATE:
            window.location.href = queryParamaDataToUrl(exampleService.getExample());
            break;

        case INVALID_INPUT_STATE:
            ReactDOM.render(<ParseError schema={JSON.stringify(StateValidator.createSchema(), null, 1)}/>, document.getElementById('root'));
            break;

        case NO_ROLES_EXCEPTION:
            alert(NO_ROLES_EXCEPTION);
            break;

        default:
            alert("unexpected error");
            console.log(err);
    }

}
