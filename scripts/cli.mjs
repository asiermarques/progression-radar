#!/usr/bin/env node
// The `progression-radar` command: one entry point for a fork and for an Adopter repository (docs/adr/0005).
//
//   progression-radar dev|build|preview|check|init
//   progression-radar snapshot record|link|check
//   progression-radar config convert-categories
//
// It runs from the directory it is called in: that directory holds the Config folder, the Snapshots folder and dist/.
// The code, index.html, public/ and config.example/ are read from the radar itself (the folder above this one).
// Vite is driven through its JavaScript API with the radar's own vite.config.ts, and every TypeScript file is loaded
// through Vite: Node's own type stripping does not work inside node_modules.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer, loadConfigFromFile, preview, runnerImport } from "vite";

const packageRoot = fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/, "");
const workingDir = process.cwd();

const USAGE = `Usage: progression-radar <command>

Commands:
  dev [--host [host]] [--port <port>] [--open [path]]   Start the dev server
  build                                                  Build the static site to dist/
  preview [--host [host]] [--port <port>] [--open [path]]  Serve dist/
  check                                                  Check the Configuration and the Snapshots
  init                                                   Copy the Sample configuration to config/ and add the npm scripts
  snapshot record|link|check [...]                       Record, link to or check Snapshots
  config convert-categories                              Convert categories.yml to a categories/ folder`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// Vite's cache goes in the directory the command runs in: an installed package can sit in a read-only store.
const cacheDir = join(workingDir, existsSync(join(workingDir, "node_modules")) ? "node_modules" : ".", ".vite");

// `--host`, `--port` and `--open` as `vite` takes them: `--host` and `--open` may or may not have a value.
function serverOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--") continue; // pnpm passes the separator on to the script
    const [flag, inline] = args[index].split(/=(.*)/s, 2);
    const next = () => (inline !== undefined ? inline : args[index + 1] && !args[index + 1].startsWith("-") ? args[++index] : undefined);
    if (flag === "--host") options.host = next() ?? true;
    else if (flag === "--open") options.open = next() ?? true;
    else if (flag === "--port") {
      const port = Number(next());
      if (!Number.isInteger(port)) fail(`--port needs a number.\n${USAGE}`);
      options.port = port;
    } else fail(`Unknown option ${args[index]}.\n${USAGE}`);
  }
  return options;
}

const viteConfig = (extra = {}) => ({
  configFile: join(packageRoot, "vite.config.ts"),
  configLoader: "runner",
  root: packageRoot,
  cacheDir,
  ...extra,
});

/** Loads one of the radar's TypeScript modules through Vite, with the plugins that resolve the Configuration. */
async function importScript(name, { resolveConfiguration = true } = {}) {
  let plugins = [];
  if (resolveConfiguration) {
    const loaded = await loadConfigFromFile({ command: "serve", mode: "development" }, join(packageRoot, "vite.config.ts"), packageRoot, "silent", undefined, "runner");
    plugins = (loaded?.config.plugins ?? []).flat(Infinity).filter((plugin) => ["yaml", "progression-radar-config"].includes(plugin?.name));
  }
  try {
    return (await runnerImport(join(packageRoot, "scripts", name), { configFile: false, root: packageRoot, cacheDir, logLevel: "silent", plugins })).module;
  } catch (error) {
    // The folder in PROGRESSION_RADAR_CONFIG_DIR is wrong, or a YAML file does not parse, for example.
    fail(error instanceof Error ? error.message : String(error));
  }
}

const commandContext = () => ({
  root: workingDir,
  env: process.env,
  io: { out: (line) => console.log(line), err: (line) => console.error(line) },
});

async function main([command, ...args]) {
  switch (command) {
    case "dev": {
      const server = await createServer(viteConfig({ server: serverOptions(args) }));
      await server.listen();
      server.printUrls();
      server.bindCLIShortcuts({ print: true });
      return;
    }
    case "preview": {
      const server = await preview(viteConfig({ build: { outDir: join(workingDir, "dist") }, preview: serverOptions(args) }));
      server.printUrls();
      server.bindCLIShortcuts({ print: true });
      return;
    }
    case "build": {
      if (args.length > 0) fail(`build takes no options.\n${USAGE}`);
      // An invalid Configuration fails the build before anything is written, listing every problem.
      const { configurationProblems, problemsMessage } = await importScript("check-command.ts");
      const problems = configurationProblems();
      if (problems.length > 0) fail(`${problemsMessage(problems)}\nThe build was not run.`);
      // dist/ is outside Vite's root, so it has to be emptied explicitly.
      await build(viteConfig({ build: { outDir: join(workingDir, "dist"), emptyOutDir: true } }));
      return;
    }
    case "check": {
      const { runCheck } = await importScript("check-command.ts");
      process.exitCode = runCheck(commandContext());
      return;
    }
    case "init": {
      const { initAdopterRepository, InitError } = await importScript("init.ts", { resolveConfiguration: false });
      try {
        initAdopterRepository({ cwd: workingDir, packageRoot });
      } catch (error) {
        if (!(error instanceof InitError)) throw error;
        fail(error.message);
      }
      return;
    }
    case "snapshot": {
      const { runSnapshotCommand } = await importScript("snapshot-commands.ts");
      process.exitCode = runSnapshotCommand(args, commandContext());
      return;
    }
    case "config": {
      if (args[0] !== "convert-categories") fail(`Unknown command "${["config", args[0]].filter(Boolean).join(" ")}".\n${USAGE}`);
      // The converter reads only the file it is given: the virtual module of the app is stubbed.
      const stub = {
        name: "stub-virtual-config",
        resolveId: (id) => (id === "virtual:progression-radar-config" ? `\0${id}` : null),
        load: (id) => (id === "\0virtual:progression-radar-config" ? "export const raw = {}; export const images = {}; export const origins = {};" : null),
      };
      const { module } = await runnerImport(join(packageRoot, "scripts", "convert-categories.ts"), {
        configFile: false,
        root: packageRoot,
        cacheDir,
        logLevel: "silent",
        plugins: [stub],
      });
      try {
        await module.convertCategories({ cwd: workingDir, configDir: process.env.PROGRESSION_RADAR_CONFIG_DIR || "config" });
      } catch (error) {
        if (!(error instanceof module.ConversionError)) throw error;
        fail(error.message);
      }
      return;
    }
    case "--help":
    case "-h":
    case "help":
      console.log(USAGE);
      return;
    default:
      fail(command ? `Unknown command "${command}".\n${USAGE}` : USAGE);
  }
}

await main(process.argv.slice(2));
