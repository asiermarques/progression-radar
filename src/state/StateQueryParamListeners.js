import { stateToQueryParamData } from "./StateMappers";

export const onStateChangeQueryListener = state =>
  window.history.pushState(
    {},
    window.document.title,
    "/?state=" + JSON.stringify(stateToQueryParamData(state))
  );
