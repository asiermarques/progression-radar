import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App, { Footer, Header } from "./App";
import { ConfigError, loadConfig } from "./config";
import type { Config } from "./model";
import { examplePerson, parseState } from "./urlState";
// Self-hosted fonts, Latin subsets only: CJK characters fall back to the system fonts in the font stacks.
import "@fontsource/shippori-mincho/latin-700.css";
import "@fontsource/shippori-mincho/latin-ext-700.css";
import "@fontsource/shippori-mincho/latin-800.css";
import "@fontsource/zen-kaku-gothic-new/latin-400.css";
import "@fontsource/zen-kaku-gothic-new/latin-500.css";
import "@fontsource/zen-kaku-gothic-new/latin-700.css";
import "@fontsource/zen-kaku-gothic-new/latin-ext-400.css";
import "@fontsource/zen-kaku-gothic-new/latin-ext-500.css";
import "@fontsource/zen-kaku-gothic-new/latin-ext-700.css";
import "./styles.css";
import "../config/theme.css";

const root = createRoot(document.getElementById("root")!);
const render = (node: ReactNode) => root.render(<StrictMode>{node}</StrictMode>);

function ErrorScreen({ config, children }: { config?: Config; children: ReactNode }) {
  return (
    <div className="app">
      <Header site={config?.site ?? { title: "Progression Radar" }} />
      <div className="error-message" role="alert">
        {children}
      </div>
      {config && <Footer site={config.site} />}
    </div>
  );
}

try {
  const config = loadConfig();
  document.title = config.site.title;

  const state = parseState(window.location.search, config);
  if (state.kind === "invalid") {
    render(
      <ErrorScreen config={config}>
        <p>
          The <code>state</code> parameter in this URL is not valid JSON. See the README for the expected format.
        </p>
        <p>
          <a href="./">Start with an example</a>
        </p>
      </ErrorScreen>,
    );
  } else {
    render(<App config={config} initialPerson={state.kind === "ok" ? state.person : examplePerson(config)} />);
  }
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error);
  render(
    <ErrorScreen>
      <p>The configuration in the config/ folder has problems:</p>
      <ul>
        {error.problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </ErrorScreen>,
  );
}
