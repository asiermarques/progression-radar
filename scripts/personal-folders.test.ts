// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isInsideFolders, servedFolders } from "./personal-folders";

const folders = ["/work/ladder/reports", "/work/ladder/snapshots"];
const blocked = (url: string) => isInsideFolders(url, "/work/ladder", folders);

describe("isInsideFolders", () => {
  it("blocks the files of the folders, by their URL under the root and with /@fs/", () => {
    expect(blocked("/reports/2026-11-09.html")).toBe(true);
    expect(blocked("/snapshots/2026-11-09.csv?import")).toBe(true);
    expect(blocked("/@fs/work/ladder/reports/2026-11-09.html")).toBe(true);
  });

  it("blocks the folders written with encodings and dot segments", () => {
    expect(blocked("/%72eports/a.html")).toBe(true);
    expect(blocked("/src/../reports/a.html")).toBe(true);
    expect(blocked("/@fs/work/ladder/src/../reports/a.html")).toBe(true);
    expect(blocked("/reports")).toBe(true);
  });

  it("lets everything else through, also folders that only start with the same letters", () => {
    expect(blocked("/")).toBe(false);
    expect(blocked("/src/main.tsx")).toBe(false);
    expect(blocked("/reports-guide/a.html")).toBe(false);
    expect(blocked("/@fs/work/ladder/config/theme.css")).toBe(false);
    expect(blocked("/%E0%A4%A")).toBe(false);
  });
});

describe("servedFolders", () => {
  it("in an Adopter repository, serves the radar, its dependencies and Vite's client next to it, never the repository", () => {
    const root = "/work/ladder/node_modules/progression-radar";
    const served = servedFolders({
      root,
      cwd: "/work/ladder",
      viteAllow: [root, "/work/ladder/node_modules/vite/dist/client"],
      configFolders: ["/work/ladder/config", `${root}/config.example`],
      cacheDir: "/work/ladder/node_modules/.vite",
    });
    expect(served).toEqual([
      root,
      "/work/ladder/config",
      `${root}/config.example`,
      "/work/ladder/node_modules/.vite",
      "/work/ladder/node_modules",
      "/work/ladder/node_modules/vite/dist/client",
    ]);
  });

  it("with pnpm, serves every node_modules folder the radar is installed in, and keeps the store Vite adds", () => {
    const root = "/work/ladder/node_modules/.pnpm/progression-radar@1.3.0/node_modules/progression-radar";
    const served = servedFolders({
      root,
      cwd: "/work/ladder",
      viteAllow: [root, "/work/ladder/node_modules/.pnpm"],
      configFolders: ["/work/ladder/config"],
      cacheDir: "/work/ladder/node_modules/.vite",
    });
    expect(served).toContain("/work/ladder/node_modules/.pnpm/progression-radar@1.3.0/node_modules");
    expect(served).toContain("/work/ladder/node_modules");
    expect(served).toContain("/work/ladder/node_modules/.pnpm");
  });

  it("drops a folder of Vite that holds the directory the command runs in, such as a workspace root", () => {
    const served = servedFolders({
      root: "/work/ladder/node_modules/progression-radar",
      cwd: "/work/ladder",
      viteAllow: ["/work", "/work/ladder", "/work/ladder/node_modules/vite/dist/client"],
      configFolders: ["/work/ladder/config"],
      cacheDir: "/work/ladder/node_modules/.vite",
    });
    expect(served).not.toContain("/work");
    expect(served).not.toContain("/work/ladder");
    expect(served).toContain("/work/ladder/node_modules/vite/dist/client");
  });

  it("in a fork, serves the radar, which is the directory the command runs in", () => {
    const served = servedFolders({
      root: "/work/radar",
      cwd: "/work/radar",
      viteAllow: ["/work/radar"],
      configFolders: ["/work/radar/config", "/work/radar/config.example"],
      cacheDir: "/work/radar/node_modules/.vite",
    });
    expect(served).toEqual(["/work/radar", "/work/radar/config", "/work/radar/config.example", "/work/radar/node_modules/.vite"]);
  });
});
