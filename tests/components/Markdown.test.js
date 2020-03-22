import React from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { act } from "react-dom/test-utils";
import pretty from "pretty";
import markdownText from "../fixtures/markdownText";

import Markdown from "../../src/components/Markdown";

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

it("should render a markdown text", () => {
  act(() => {
    render(<Markdown input={markdownText} />, container);
  });
  expect(pretty(container.innerHTML)).toMatchInlineSnapshot(`
    "<p><strong>Example behaviors:</strong></p>
    <ul>
      <li>
        <p>Communicates project status clearly and effectively</p>
      </li>
      <li>
        <p>Collaborates with others with empathy</p>
      </li>
      <li>
        <p>Asks for help at the appropriate juncture </p>
      </li>
    </ul>
    <p><strong>Example tasks:</strong> </p>
    <ul>
      <li>
        <p>Updated The Watch before running a backfill</p>
      </li>
      <li>
        <p>Updated project status changes in Asana promptly</p>
      </li>
      <li>
        <p>Gave thoughtful check-in and check-out comments</p>
      </li>
    </ul>"
  `);
});
