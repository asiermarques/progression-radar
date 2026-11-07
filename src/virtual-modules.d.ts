// Virtual modules generated at build time by the plugin in vite.config.ts.
declare module "virtual:progression-radar-config" {
  /** The resolved configuration files, untyped: src/config.ts validates them. `problems` are found while reading. */
  export const raw: { categories: unknown; roles: unknown; site: unknown; problems: string[] };
  /** Image files by name, as URLs. */
  export const images: Record<string, string>;
  /**
   * Where each file was read from (e.g. "config/roles.yml"), the file of each category when they are category
   * files, and the folders searched for images.
   */
  export const origins: { categories: string; categoryFiles?: string[]; roles: string; site: string; folders: string[] };
}

/** The resolved theme.css, loaded for its side effect. */
declare module "virtual:progression-radar-theme" {}
