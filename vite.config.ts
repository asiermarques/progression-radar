/// <reference types="vitest/config" />
import { join } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { parse } from "yaml";
import { readCategoryFile } from "./scripts/category-markdown.ts";
import { isInsideFolders } from "./scripts/personal-folders.ts";
import { resolveSnapshotsFolder, SNAPSHOTS_DIR_VARIABLE } from "./scripts/snapshots.ts";
import {
  CATEGORIES_FOLDER,
  CONFIG_DIR_VARIABLE,
  configModuleSource,
  describeSources,
  isConfigPath,
  resolveConfigSources,
  themeModuleSource,
  type ConfigSources,
} from "./scripts/config-sources.ts";

// Turns `import data from "./file.yml"` into the parsed YAML document.
// A syntax error in a YAML file fails the dev server / build with a clear message.
function yaml(): Plugin {
  const yamlFile = /\.ya?ml$/;
  return {
    name: "yaml",
    transform: {
      filter: { id: yamlFile },
      handler(source, id) {
        if (!yamlFile.test(id)) return null;
        return {
          code: `export default ${JSON.stringify(parse(source))};`,
          map: null,
          moduleType: "js",
        };
      },
    },
  };
}

const CONFIG_MODULE = "virtual:progression-radar-config";
const THEME_MODULE = "virtual:progression-radar-theme";
const resolvedId = (id: string) => `\0${id}`;

// Reads the configuration from the folder in PROGRESSION_RADAR_CONFIG_DIR (default: config/) of the directory the command
// runs in, file by file, and from config.example/ of the radar (Vite's root) for every file that the folder does not
// have. In a fork both are the same folder. The app imports the result through two virtual
// modules, so which folder was used never appears in the source code. See docs/adr/0002.
function configFolder(): Plugin {
  let resolved: ResolvedConfig;
  const sources = (): ConfigSources => resolveConfigSources(process.cwd(), process.env[CONFIG_DIR_VARIABLE], resolved.root);

  return {
    name: "progression-radar-config",
    configResolved(config) {
      resolved = config;
      sources(); // fails the dev server and the build when the folder is wrong
    },
    buildStart() {
      if (resolved.mode === "test") return;
      const { info, warnings } = describeSources(sources());
      for (const line of info) resolved.logger.info(`config: ${line}`);
      for (const warning of warnings) resolved.logger.warn(`config: ${warning}`);
    },
    // Turns `import reading from "01-comm.md?category"` into { category, problems }: see scripts/category-markdown.ts.
    transform: {
      filter: { id: /\.md\?category$/ },
      handler(source, id) {
        const path = id.replace(/\?category$/, "");
        const label = sources().categories.files.find((file) => file.path === path)?.label ?? path;
        // A YAML syntax error in the frontmatter throws, failing the dev server and the build.
        return { code: `export default ${JSON.stringify(readCategoryFile(source, label))};`, map: null, moduleType: "js" };
      },
    },
    configureServer(server) {
      const { configPath, examplePath } = sources();
      // The radar itself and the config folder, which may be outside it: nothing else of the directory the command runs
      // in (the snapshots, for one) is served.
      server.config.server.fs.allow.splice(0, Infinity, resolved.root, configPath, examplePath);
      // In a fork the directory the command runs in is Vite's root, so the Snapshots and the Reports, which hold
      // personal data, would be served by URL or with /@fs/: answer 404 before anything else sees the request.
      const personal = [resolveSnapshotsFolder(process.cwd(), process.env[SNAPSHOTS_DIR_VARIABLE]).path, join(process.cwd(), "reports")];
      server.middlewares.use((req, res, next) => {
        if (!req.url || !isInsideFolders(req.url, resolved.root, personal)) return next();
        res.statusCode = 404;
        res.end();
      });
      // Vite only watches imported files: reload also when a file is added to or removed from the folders, or from
      // their categories/ folder. Editing an existing category file reloads through its import.
      const folders = [configPath, examplePath];
      server.watcher.add([...folders, ...folders.map((folder) => join(folder, CATEGORIES_FOLDER))]);
      const reload = (file: string) => {
        if (!isConfigPath(file, folders)) return;
        for (const id of [CONFIG_MODULE, THEME_MODULE]) {
          const module = server.moduleGraph.getModuleById(resolvedId(id));
          if (module) server.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", reload).on("unlink", reload).on("addDir", reload).on("unlinkDir", reload);
    },
    resolveId(id) {
      return id === CONFIG_MODULE || id === THEME_MODULE ? resolvedId(id) : null;
    },
    load(id) {
      if (id === resolvedId(CONFIG_MODULE)) return configModuleSource(sources());
      if (id === resolvedId(THEME_MODULE)) return themeModuleSource(sources());
      return null;
    },
  };
}

export default defineConfig({
  // Relative asset URLs: the build works from any path (root domain, sub-folder, GitHub Pages...).
  base: "./",
  plugins: [react(), yaml(), configFolder()],
  test: {
    environment: "happy-dom",
  },
});
