// YAML files are parsed at build time by the plugin in vite.config.ts.
// Their content is validated in src/config.ts, so it is typed as unknown here.
declare module "*.yml" {
  const data: unknown;
  export default data;
}
