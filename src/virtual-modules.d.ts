// Virtual modules generated at build time by the plugin in vite.config.ts.
declare module "virtual:progression-radar-config" {
  /** The YAML files of the resolved configuration, untyped: src/config.ts validates them. */
  export const raw: { categories: unknown; roles: unknown; site: unknown };
  /** Image files by name, as URLs. */
  export const images: Record<string, string>;
  /** Where each file was read from (e.g. "config/roles.yml") and the folders searched for images. */
  export const origins: { categories: string; roles: string; site: string; folders: string[] };
}

/** The resolved theme.css, loaded for its side effect. */
declare module "virtual:progression-radar-theme" {}
