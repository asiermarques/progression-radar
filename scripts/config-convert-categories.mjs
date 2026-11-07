#!/usr/bin/env node
// Converts config/categories.yml into a config/categories/ folder of Markdown category files (see
// docs/guides/categories.md). The folder is PROGRESSION_RADAR_CONFIG_DIR, or config. It never stages or commits.
//
//   npm run config:convert-categories
//
// The logic is in convert-categories.ts, which reuses the validation of src/config.ts. Vite loads that TypeScript,
// so the command needs no build step and no Node flags; the virtual module of the app is stubbed because the
// converter reads only the file it is given.
import { runnerImport } from "vite";

const stubVirtualConfig = {
  name: "stub-virtual-config",
  resolveId: (id) => (id === "virtual:progression-radar-config" ? `\0${id}` : null),
  load: (id) =>
    id === "\0virtual:progression-radar-config" ? "export const raw = {}; export const images = {}; export const origins = {};" : null,
};

const { module } = await runnerImport(new URL("./convert-categories.ts", import.meta.url).pathname, {
  configFile: false,
  logLevel: "silent",
  plugins: [stubVirtualConfig],
});

try {
  await module.convertCategories({ cwd: process.cwd(), configDir: process.env.PROGRESSION_RADAR_CONFIG_DIR || "config" });
} catch (error) {
  if (!(error instanceof module.ConversionError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
