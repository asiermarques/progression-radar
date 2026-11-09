// Loads scripts/convert-categories.ts through Vite, for the `config convert-categories` command and for
// `config:migrate`, which converts the categories.yml it moves. Node's own type stripping does not work inside
// node_modules, so TypeScript is always loaded this way.
import { join } from "node:path";
import { runnerImport } from "vite";

// The converter reads only the file it is given: the app's virtual configuration module is stubbed.
const stub = {
  name: "stub-virtual-config",
  resolveId: (id) => (id === "virtual:progression-radar-config" ? `\0${id}` : null),
  load: (id) => (id === "\0virtual:progression-radar-config" ? "export const raw = {}; export const images = {}; export const origins = {};" : null),
};

/** The convert-categories module of the radar at `packageRoot`, with Vite's cache in `cacheDir`. */
export async function loadConverter({ packageRoot, cacheDir }) {
  const { module } = await runnerImport(join(packageRoot, "scripts", "convert-categories.ts"), {
    configFile: false,
    root: packageRoot,
    cacheDir,
    logLevel: "silent",
    plugins: [stub],
  });
  return module;
}
