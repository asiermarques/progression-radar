import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { parse } from "yaml";

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

export default defineConfig({
  // Relative asset URLs: the build works from any path (root domain, sub-folder, GitHub Pages...).
  base: "./",
  plugins: [react(), yaml()],
  test: {
    environment: "happy-dom",
  },
});
