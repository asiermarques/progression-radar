// The folders with personal data (the Snapshots folder and reports/) that the dev server never serves, whichever
// way a URL reaches them. Used by the Vite plugin in vite.config.ts. See docs/adr/0007.
import { posix, resolve } from "node:path";

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
