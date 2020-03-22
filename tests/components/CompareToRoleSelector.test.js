import React from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { act } from "react-dom/test-utils";
import pretty from "pretty";
import PersonPanel from "../../src/components/PersonPanel";
import Role from "../../src/domain/Role";
import CompareToRoleSelector from "../../src/components/CompareToRoleSelector";

let container = null;
beforeEach(() => {
  // setup a DOM element as a render target
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  // cleanup on exiting
  unmountComponentAtNode(container);
  container.remove();
  container = null;
});

it("should render the component", () => {
  act(() => {
    render(
      <CompareToRoleSelector
        compareTo={new Role("test", "Test", {})}
        selectComparationRole={(category, level) => undefined}
        roles={[new Role("test", "Test", {})]}
      />,
      container
    );
  });
  expect(pretty(container.innerHTML)).toMatchInlineSnapshot(`
    "<label>Compare to <select class=\\"form-control roles\\">
        <option>Select a role</option>
        <option value=\\"test\\" selected=\\"\\">Test</option>
      </select></label>"
  `);
});
