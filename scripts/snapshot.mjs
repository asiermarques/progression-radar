#!/usr/bin/env node
// Entry point of `npm run snapshot:record`, `snapshot:link` and `snapshot:check` (see docs/guides/snapshots.md).
//
//   node scripts/snapshot.mjs record|link|check ...
//
// The logic is in snapshot-commands.ts. Vite loads that TypeScript together with the project's plugins that resolve the
// configuration, so the commands read the same Configuration as the build (the config folder, falling back to
// config.example/) and need no build step.
import { loadConfigFromFile, runnerImport } from "vite";

const loaded = await loadConfigFromFile({ command: "serve", mode: "development" }, new URL("../vite.config.ts", import.meta.url).pathname);
const plugins = (loaded?.config.plugins ?? []).flat(Infinity).filter((plugin) => ["yaml", "progression-radar-config"].includes(plugin?.name));

let commands;
try {
  ({ module: commands } = await runnerImport(new URL("./snapshot-commands.ts", import.meta.url).pathname, { logLevel: "silent", plugins }));
} catch (error) {
  // The folder in PROGRESSION_RADAR_CONFIG_DIR is wrong, for example.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

process.exitCode = commands.runSnapshotCommand(process.argv.slice(2), {
  root: process.cwd(),
  env: process.env,
  io: { out: (line) => console.log(line), err: (line) => console.error(line) },
});
