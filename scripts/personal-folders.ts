// What the dev server serves: the folders it may read (servedFolders) and the folders with personal data (the Snapshots
// folder and reports/) that it never serves, whichever way a URL reaches them. Used by the Vite plugin in
// vite.config.ts. See docs/adr/0005 and docs/adr/0007.
import { basename, dirname, posix, resolve } from "node:path";

/** Whether the dev server URL `url` points to a file inside one of `folders` (absolute paths). */
export function isInsideFolders(url: string, root: string, folders: string[]): boolean {
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]);
  } catch {
    return false; // not a path of the file system: nothing to serve
  }
  const FS_PREFIX = "/@fs";
  const target = pathname.startsWith(`${FS_PREFIX}/`)
    ? posix.normalize(pathname.slice(FS_PREFIX.length))
    : posix.normalize(posix.join(root.replace(/\\/g, "/"), pathname));
  return folders.some((folder) => {
    const base = resolve(folder).replace(/\\/g, "/").replace(/\/$/, "");
    return target === base || target.startsWith(`${base}/`);
  });
}

const isWithin = (folder: string, path: string) => {
  const base = resolve(folder).replace(/\\/g, "/").replace(/\/$/, "");
  const target = resolve(path).replace(/\\/g, "/");
  return target === base || target.startsWith(`${base}/`);
};

export interface ServedFoldersOptions {
  /** The radar: Vite's root. */
  root: string;
  /** The directory the command runs in. */
  cwd: string;
  /** What Vite allows by itself: the workspace root and the folders of its client, the pnpm store, the Yarn cache. */
  viteAllow: string[];
  /** The Config folder and config.example/. */
  configFolders: string[];
  /** Vite's cache, where the pre-bundled dependencies are. */
  cacheDir: string;
}

/**
 * The folders the dev server may serve (`server.fs.allow`): the radar, the Config folders, Vite's cache, the
 * node_modules folders the radar is installed in (its dependencies, the fonts among them, sit next to it in an Adopter
 * repository) and what Vite allows by itself, except a folder that holds the directory the command runs in: that one
 * would serve the whole Adopter repository. In a fork that directory is the radar, and the middleware of
 * isInsideFolders() keeps the personal folders out.
 */
export function servedFolders({ root, cwd, viteAllow, configFolders, cacheDir }: ServedFoldersOptions): string[] {
  const installedIn: string[] = [];
  for (let folder = resolve(root); dirname(folder) !== folder; folder = dirname(folder)) {
    if (basename(folder) === "node_modules") installedIn.push(folder);
  }
  const fromVite = viteAllow.filter((folder) => !isWithin(folder, cwd));
  return [...new Set([root, ...configFolders, cacheDir, ...installedIn, ...fromVite].map((folder) => resolve(folder)))];
}
