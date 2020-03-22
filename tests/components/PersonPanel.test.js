import React from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { act } from "react-dom/test-utils";
import pretty from "pretty";
import PersonPanel from "../../src/components/PersonPanel";
import Role from "../../src/domain/Role";

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
      <PersonPanel
        name="Test"
        tags={["test", "test2"]}
        role={new Role("test", "Test", {})}
      />,
      container
    );
  });
  expect(pretty(container.innerHTML)).toMatchInlineSnapshot(`
    "<section id=\\"person-panel\\">
      <h3 class=\\"name\\">Test</h3>
      <p class=\\"role\\">Test</p>
      <p><span class=\\"badge badge-success\\">test</span><span class=\\"badge badge-success\\">test2</span></p>
    </section>"
  `);
});
